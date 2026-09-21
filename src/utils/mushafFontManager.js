import { getMushafWordFontLink } from '$utils/getMushafWordFontLink';
import { cacheMushafFontWithServiceWorker } from '$utils/offlineModeHandler';
import { getMushafFontPrefetchPlan, shouldRetryMushafFontStatus } from '$utils/mushafFontPolicy';
import {
	canPrefetchMushafFonts,
	createMushafFontNetworkHealth,
	getMushafFontActiveRetryDelay,
	markMushafFontNetworkFailure,
	markMushafFontNetworkSignal,
	markMushafFontNetworkSuccess
} from '$utils/mushafFontNetworkHealth';

export const smartMushafFontCacheName = 'quranwbw-mushaf-font-smart-v1';
const fullMushafCacheName = 'quranwbw-mushaf-data';
const cacheSearchOrder = [smartMushafFontCacheName, fullMushafCacheName];

const states = new Map();
const cacheInFlight = new Map();
const fontReadyInFlight = new Map();
const loadedFamilies = new Map();
const desiredUrlByFamily = new Map();
const backgroundQueue = [];
const queuedBackgroundUrls = new Set();

const MAX_BACKGROUND_QUEUE = 8;
const MIN_BACKGROUND_STORAGE_HEADROOM_BYTES = 12 * 1024 * 1024;
const MIN_RECOVERY_PROBE_GAP_MS = 4000;

let backgroundRunning = false;
let recoveryListenersInstalled = false;
let lastCriticalPage = null;
let lastRecoveryProbeAt = 0;
let networkHealth = createMushafFontNetworkHealth();

function now() {
	return Date.now();
}

function isBrowserReady() {
	return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function createState(page, url) {
	return {
		page,
		url,
		family: `p${page}`,
		status: 'idle',
		source: null,
		attempts: 0,
		updatedAt: now(),
		subscribers: new Set(),
		retryTimer: null
	};
}

function getState(page, url) {
	let state = states.get(url);
	if (!state) {
		state = createState(page, url);
		states.set(url, state);
	}
	return state;
}

function networkHealthSnapshot() {
	return {
		status: networkHealth.status,
		failureStreak: networkHealth.failureStreak,
		cooldownUntil: networkHealth.cooldownUntil,
		lastFailureAt: networkHealth.lastFailureAt,
		lastSuccessAt: networkHealth.lastSuccessAt,
		lastReason: networkHealth.lastReason
	};
}

function publishNetworkHealth() {
	if (!isBrowserReady()) return;
	window.dispatchEvent(new CustomEvent('mushaf-font-network-health', { detail: networkHealthSnapshot() }));
}

function updateNetworkHealth(next) {
	networkHealth = next;
	publishNetworkHealth();
}

function noteNetworkFailure(error, { offline = false, reason = 'font-request-failed' } = {}) {
	updateNetworkHealth(markMushafFontNetworkFailure(networkHealth, { offline, reason }));
	clearBackgroundQueue();
	if (error) console.warn('[Fonts] Mushaf font network degraded.', error);
}

function noteNetworkSuccess(reason = 'font-request-success') {
	updateNetworkHealth(markMushafFontNetworkSuccess(networkHealth, { reason }));
}

function publicState(state) {
	return {
		page: state.page,
		url: state.url,
		family: state.family,
		status: state.status,
		source: state.source,
		attempts: state.attempts,
		updatedAt: state.updatedAt,
		queueDepth: backgroundQueue.length,
		network: networkHealthSnapshot()
	};
}

function notify(state) {
	state.updatedAt = now();
	const snapshot = publicState(state);
	for (const subscriber of state.subscribers) {
		try {
			subscriber(snapshot);
		} catch (error) {
			console.warn('[Fonts] Mushaf font subscriber failed.', error);
		}
	}
	window.dispatchEvent(new CustomEvent('mushaf-font-progress', { detail: snapshot }));
}

function setState(state, patch) {
	Object.assign(state, patch);
	notify(state);
}

async function isValidCachedWoff2(response) {
	if (!response?.ok) return false;
	const contentType = (response.headers.get('content-type') || '').toLowerCase();
	if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain')) return false;

	try {
		const bytes = new Uint8Array(await response.clone().arrayBuffer());
		return bytes.length >= 4 && bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32;
	} catch {
		return false;
	}
}

async function promoteUsedOfflineFont(url, response) {
	try {
		const smartCache = await caches.open(smartMushafFontCacheName);
		await smartCache.put(url, response.clone());
		return { response, source: smartMushafFontCacheName, promoted: true };
	} catch (error) {
		console.warn('[Fonts] Used offline Mushaf font could not be promoted to smart cache.', error);
		return { response, source: fullMushafCacheName, promoted: false };
	}
}

async function findCachedFont(url) {
	if (!('caches' in window)) return null;

	const existingCacheNames = new Set(await caches.keys());
	for (const cacheName of cacheSearchOrder) {
		if (!existingCacheNames.has(cacheName)) continue;
		const cache = await caches.open(cacheName);
		const response = await cache.match(url);
		if (!response) continue;
		if (await isValidCachedWoff2(response)) {
			if (cacheName === fullMushafCacheName) return promoteUsedOfflineFont(url, response);
			return { response, source: cacheName };
		}
		await cache.delete(url);
	}
	return null;
}

function uncachedNetworkResult(result) {
	if (result?.persisted !== false) return null;
	const bytes = result.bytes;
	if (bytes && bytes.byteLength) {
		return {
			response: new Response(bytes, { status: 200, headers: { 'Content-Type': 'font/woff2' } }),
			source: result.source || 'network-uncached'
		};
	}
	return { response: null, source: result?.source || 'network-uncached' };
}

async function ensureCachedFont(url, { priority = 'critical' } = {}) {
	const existing = await findCachedFont(url);
	if (existing) return existing;

	if (priority === 'prefetch' && !canPrefetchMushafFonts(networkHealth, { online: navigator.onLine !== false })) {
		const error = new Error('Background Mushaf font prefetch is suspended while the network is unstable.');
		error.code = 'PREFETCH_SUSPENDED';
		throw error;
	}

	const shared = cacheInFlight.get(url);
	if (shared) {
		try {
			const sharedResult = await shared.promise;
			if (sharedResult?.persisted === false) return uncachedNetworkResult(sharedResult);
			const cachedAfterSharedDownload = await findCachedFont(url);
			if (cachedAfterSharedDownload) return cachedAfterSharedDownload;
		} catch (error) {
			// If a short speculative prefetch failed while this page became critical,
			// immediately allow the critical request to use its larger retry budget.
			if (!(priority === 'critical' && shared.priority === 'prefetch')) throw error;
		}
	}

	if (navigator.onLine === false) {
		noteNetworkFailure(null, { offline: true, reason: 'navigator-offline' });
		const error = new Error('Mushaf font is not cached and the device is offline.');
		error.code = 'OFFLINE';
		throw error;
	}

	const timeout = priority === 'prefetch' ? 12000 : 55000;
	let taskPromise;
	taskPromise = cacheMushafFontWithServiceWorker(url, { timeout, priority })
		.then((result) => {
			if (String(result?.source || '').startsWith('network')) noteNetworkSuccess(`${priority}-font-success`);
			return result;
		})
		.catch((error) => {
			if (error?.code !== 'PREFETCH_SUSPENDED') noteNetworkFailure(error, { reason: `${priority}-font-failure` });
			throw error;
		})
		.finally(() => {
			if (cacheInFlight.get(url)?.promise === taskPromise) cacheInFlight.delete(url);
		});

	cacheInFlight.set(url, { promise: taskPromise, priority });
	const result = await taskPromise;
	if (result?.persisted === false) return uncachedNetworkResult(result);

	const cached = await findCachedFont(url);
	if (!cached) throw new Error('Mushaf font was not durably stored after download.');
	return cached;
}

async function activateFont(state, cached) {
	const alreadyLoaded = loadedFamilies.get(state.family);
	if (alreadyLoaded?.url === state.url && alreadyLoaded.face?.status === 'loaded') return true;

	let objectUrl = null;
	try {
		let source = `url("${state.url}")`;
		if (cached.response) {
			const blob = await cached.response.blob();
			if (!blob.size) throw new Error('Cached Mushaf font is empty.');
			objectUrl = URL.createObjectURL(blob);
			source = `url("${objectUrl}")`;
		}

		const face = new FontFace(state.family, source);
		await face.load();

		// A theme/font change may have selected a different URL while this one was loading.
		// Keep the obsolete response cached, but never let it replace the newly desired face.
		if (desiredUrlByFamily.get(state.family) !== state.url) return false;

		const previous = loadedFamilies.get(state.family);
		if (previous?.face && previous.face !== face) {
			try {
				document.fonts.delete(previous.face);
			} catch {
				// Replacing an old runtime font is best-effort.
			}
		}

		document.fonts.add(face);
		loadedFamilies.set(state.family, { url: state.url, face });
		return true;
	} finally {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	}
}

function clearRetry(state) {
	if (!state.retryTimer) return;
	clearTimeout(state.retryTimer);
	state.retryTimer = null;
}

function scheduleActiveRetry(state) {
	clearRetry(state);
	if (!state.subscribers.size || navigator.onLine === false) return;

	const delay = getMushafFontActiveRetryDelay({
		attempts: state.attempts,
		networkFailureStreak: networkHealth.failureStreak
	});
	state.retryTimer = setTimeout(() => {
		state.retryTimer = null;
		if (state.subscribers.size && shouldRetryMushafFontStatus(state.status)) {
			ensureMushafFont(state.page, state.url).catch(() => {});
		}
	}, delay);
}

function getConnectionInfo() {
	const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
	return {
		effectiveType: connection?.effectiveType || '',
		saveData: Boolean(connection?.saveData)
	};
}

function scheduleIdle(callback) {
	if (typeof requestIdleCallback === 'function') {
		requestIdleCallback(callback, { timeout: 2500 });
	} else {
		setTimeout(callback, 500);
	}
}

function queueNeighborPrefetch(page) {
	if (!canPrefetchMushafFonts(networkHealth, { online: navigator.onLine !== false })) return;
	const previousPage = lastCriticalPage;
	lastCriticalPage = page;

	const { effectiveType, saveData } = getConnectionInfo();
	const plan = getMushafFontPrefetchPlan({ page, previousPage, effectiveType, saveData });

	for (const targetPage of plan) {
		if (backgroundQueue.length >= MAX_BACKGROUND_QUEUE) break;
		const url = getMushafWordFontLink(targetPage);
		if (cacheInFlight.has(url) || queuedBackgroundUrls.has(url)) continue;
		const loaded = loadedFamilies.get(`p${targetPage}`);
		if (loaded?.url === url) continue;
		queuedBackgroundUrls.add(url);
		backgroundQueue.push({ page: targetPage, url });
	}

	runBackgroundQueue();
}

async function hasBackgroundStorageHeadroom() {
	try {
		if (!navigator.storage?.estimate) return true;
		const estimate = await navigator.storage.estimate();
		if (!Number.isFinite(estimate.quota) || !Number.isFinite(estimate.usage)) return true;
		return estimate.quota - estimate.usage >= MIN_BACKGROUND_STORAGE_HEADROOM_BYTES;
	} catch {
		return true;
	}
}

function clearBackgroundQueue() {
	backgroundQueue.length = 0;
	queuedBackgroundUrls.clear();
}

function runBackgroundQueue() {
	if (backgroundRunning || !backgroundQueue.length || navigator.onLine === false || document.hidden) return;
	if (!canPrefetchMushafFonts(networkHealth, { online: true })) return;
	const connection = getConnectionInfo();
	if (connection.saveData || ['slow-2g', '2g'].includes(String(connection.effectiveType).toLowerCase())) {
		clearBackgroundQueue();
		return;
	}
	backgroundRunning = true;

	scheduleIdle(async () => {
		try {
			if (!(await hasBackgroundStorageHeadroom())) {
				clearBackgroundQueue();
				return;
			}
			while (backgroundQueue.length && navigator.onLine !== false && !document.hidden) {
				const item = backgroundQueue.shift();
				queuedBackgroundUrls.delete(item.url);
				try {
					const cached = await findCachedFont(item.url);
					const result = cached || (await ensureCachedFont(item.url, { priority: 'prefetch' }));
					if (result.source === 'network-uncached') {
						clearBackgroundQueue();
						break;
					}
					window.dispatchEvent(
						new CustomEvent('mushaf-font-progress', {
							detail: {
								page: item.page,
								url: item.url,
								status: 'prefetched',
								source: result.source,
								queueDepth: backgroundQueue.length,
								updatedAt: now()
							}
						})
					);
				} catch (error) {
					console.warn('[Fonts] Background Mushaf font prefetch paused.', error);
					break;
				}
			}
		} finally {
			backgroundRunning = false;
			if (backgroundQueue.length && navigator.onLine !== false && !document.hidden && canPrefetchMushafFonts(networkHealth, { online: true })) runBackgroundQueue();
		}
	});
}

function retryActiveFonts({ reason = 'recovery-signal', forceProbe = false } = {}) {
	if (navigator.onLine === false) return;
	const timestamp = now();
	if (forceProbe && timestamp - lastRecoveryProbeAt < MIN_RECOVERY_PROBE_GAP_MS) return;
	if (forceProbe) lastRecoveryProbeAt = timestamp;

	for (const state of states.values()) {
		if (!state.subscribers.size || !shouldRetryMushafFontStatus(state.status)) continue;
		ensureMushafFont(state.page, state.url).catch(() => {});
	}

	if (canPrefetchMushafFonts(networkHealth, { online: true })) runBackgroundQueue();
	if (isBrowserReady()) window.dispatchEvent(new CustomEvent('mushaf-font-recovery-probe', { detail: { reason, at: timestamp } }));
}

function installRecoveryListeners() {
	if (recoveryListenersInstalled || !isBrowserReady()) return;
	recoveryListenersInstalled = true;
	updateNetworkHealth(
		markMushafFontNetworkSignal(networkHealth, {
			online: navigator.onLine !== false,
			reason: navigator.onLine === false ? 'startup-offline' : 'startup-online'
		})
	);

	window.addEventListener('offline', () => {
		updateNetworkHealth(markMushafFontNetworkSignal(networkHealth, { online: false, reason: 'offline-event' }));
		clearBackgroundQueue();
	});
	window.addEventListener('online', () => {
		updateNetworkHealth(markMushafFontNetworkSignal(networkHealth, { online: true, reason: 'online-event' }));
		retryActiveFonts({ reason: 'online-event', forceProbe: true });
	});
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) retryActiveFonts({ reason: 'foreground', forceProbe: networkHealth.failureStreak > 0 });
	});

	const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
	connection?.addEventListener?.('change', () => {
		if (navigator.onLine !== false) {
			updateNetworkHealth(markMushafFontNetworkSignal(networkHealth, { online: true, reason: 'connection-change' }));
			retryActiveFonts({ reason: 'connection-change', forceProbe: true });
			if (canPrefetchMushafFonts(networkHealth, { online: true })) {
				const activePages = [...states.values()].filter((state) => state.subscribers.size && state.status === 'ready').map((state) => state.page);
				if (activePages.length) queueNeighborPrefetch(activePages[activePages.length - 1]);
			}
		}
	});
}

async function performEnsureMushafFont(page, url) {
	const state = getState(page, url);
	const loaded = loadedFamilies.get(state.family);
	if (loaded?.url === url && loaded.face?.status === 'loaded') {
		if (state.status !== 'ready') setState(state, { status: 'ready', source: 'memory', attempts: 0 });
		return publicState(state);
	}

	try {
		setState(state, { status: 'checking' });
		let cached = await findCachedFont(url);
		if (!cached) {
			setState(state, { status: 'downloading' });
			cached = await ensureCachedFont(url, { priority: 'critical' });
		}

		if (desiredUrlByFamily.get(state.family) !== state.url) {
			setState(state, { status: 'superseded', source: cached.source });
			return publicState(state);
		}

		setState(state, { status: 'activating', source: cached.source });
		const activated = await activateFont(state, cached);
		if (!activated) {
			setState(state, { status: 'superseded', source: cached.source });
			return publicState(state);
		}
		clearRetry(state);
		setState(state, { status: 'ready', source: cached.source, attempts: 0 });
		if (cached.source !== 'network-uncached') queueNeighborPrefetch(page);
		return publicState(state);
	} catch (error) {
		const offline = navigator.onLine === false || error?.code === 'OFFLINE';
		setState(state, {
			status: offline ? 'waiting-network' : 'error',
			source: null,
			attempts: state.attempts + 1
		});
		scheduleActiveRetry(state);
		throw error;
	}
}

export async function ensureMushafFont(page, url = getMushafWordFontLink(page)) {
	if (!isBrowserReady()) throw new Error('Mushaf fonts can only be loaded in a browser.');
	installRecoveryListeners();
	desiredUrlByFamily.set(`p${page}`, url);

	if (fontReadyInFlight.has(url)) return fontReadyInFlight.get(url);

	const task = performEnsureMushafFont(page, url).finally(() => fontReadyInFlight.delete(url));
	fontReadyInFlight.set(url, task);
	return task;
}

export function subscribeMushafFont(page, url, subscriber) {
	if (!isBrowserReady()) return () => {};
	installRecoveryListeners();

	const state = getState(page, url);
	desiredUrlByFamily.set(state.family, url);
	state.subscribers.add(subscriber);
	subscriber(publicState(state));
	ensureMushafFont(page, url).catch((error) => {
		console.warn(`[Fonts] Mushaf page ${page} font is not ready yet.`, error);
	});

	return () => {
		state.subscribers.delete(subscriber);
		if (!state.subscribers.size) clearRetry(state);
	};
}

export function getSmartMushafFontProgress() {
	const snapshots = [...states.values()].map(publicState);
	return {
		ready: snapshots.filter((state) => state.status === 'ready').length,
		pending: snapshots.filter((state) => ['checking', 'downloading', 'activating'].includes(state.status)).length,
		waitingNetwork: snapshots.filter((state) => state.status === 'waiting-network').length,
		error: snapshots.filter((state) => state.status === 'error').length,
		backgroundQueue: backgroundQueue.length,
		network: networkHealthSnapshot(),
		states: snapshots
	};
}
