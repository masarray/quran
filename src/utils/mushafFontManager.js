import { getMushafWordFontLink } from '$utils/getMushafWordFontLink';
import { cacheMushafFontWithServiceWorker } from '$utils/offlineModeHandler';
import { getMushafFontPrefetchPlan, shouldRetryMushafFontStatus } from '$utils/mushafFontPolicy';

export const smartMushafFontCacheName = 'quranwbw-mushaf-font-smart-v1';
const fullMushafCacheName = 'quranwbw-mushaf-data';
const cacheSearchOrder = [smartMushafFontCacheName, fullMushafCacheName];

const states = new Map();
const cacheInFlight = new Map();
const loadedFamilies = new Map();
const backgroundQueue = [];
const queuedBackgroundUrls = new Set();

const MAX_BACKGROUND_QUEUE = 8;
const MAX_ACTIVE_RETRIES = 3;

let backgroundRunning = false;
let recoveryListenersInstalled = false;
let lastCriticalPage = null;

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

function publicState(state) {
	return {
		page: state.page,
		url: state.url,
		family: state.family,
		status: state.status,
		source: state.source,
		attempts: state.attempts,
		updatedAt: state.updatedAt,
		queueDepth: backgroundQueue.length
	};
}

function notify(state) {
	state.updatedAt = now();
	const snapshot = publicState(state);
	for (const subscriber of state.subscribers) subscriber(snapshot);
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

async function findCachedFont(url) {
	if (!('caches' in window)) return null;

	for (const cacheName of cacheSearchOrder) {
		const cache = await caches.open(cacheName);
		const response = await cache.match(url);
		if (!response) continue;
		if (await isValidCachedWoff2(response)) return { response, source: cacheName };
		await cache.delete(url);
	}
	return null;
}

async function ensureCachedFont(url) {
	const existing = await findCachedFont(url);
	if (existing) return existing;

	if (cacheInFlight.has(url)) {
		await cacheInFlight.get(url);
		const cachedAfterSharedDownload = await findCachedFont(url);
		if (!cachedAfterSharedDownload) throw new Error('Mushaf font download completed without a durable cache entry.');
		return cachedAfterSharedDownload;
	}

	if (navigator.onLine === false) {
		const error = new Error('Mushaf font is not cached and the device is offline.');
		error.code = 'OFFLINE';
		throw error;
	}

	const task = cacheMushafFontWithServiceWorker(url, { timeout: 60000 }).finally(() => cacheInFlight.delete(url));
	cacheInFlight.set(url, task);
	await task;

	const cached = await findCachedFont(url);
	if (!cached) throw new Error('Mushaf font was not durably stored after download.');
	return cached;
}

async function activateFont(state, cached) {
	const alreadyLoaded = loadedFamilies.get(state.family);
	if (alreadyLoaded?.url === state.url && alreadyLoaded.face?.status === 'loaded') return;

	const blob = await cached.response.blob();
	if (!blob.size) throw new Error('Cached Mushaf font is empty.');

	const objectUrl = URL.createObjectURL(blob);
	try {
		const face = new FontFace(state.family, `url("${objectUrl}")`);
		await face.load();

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
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

function clearRetry(state) {
	if (!state.retryTimer) return;
	clearTimeout(state.retryTimer);
	state.retryTimer = null;
}

function scheduleActiveRetry(state) {
	clearRetry(state);
	if (!state.subscribers.size || state.attempts >= MAX_ACTIVE_RETRIES || navigator.onLine === false) return;

	const delay = Math.min(20000, 2000 * 2 ** Math.max(0, state.attempts - 1));
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

function runBackgroundQueue() {
	if (backgroundRunning || !backgroundQueue.length || navigator.onLine === false || document.hidden) return;
	backgroundRunning = true;

	scheduleIdle(async () => {
		try {
			while (backgroundQueue.length && navigator.onLine !== false && !document.hidden) {
				const item = backgroundQueue.shift();
				queuedBackgroundUrls.delete(item.url);
				try {
					const cached = await findCachedFont(item.url);
					if (!cached) await ensureCachedFont(item.url);
					window.dispatchEvent(
						new CustomEvent('mushaf-font-progress', {
							detail: {
								page: item.page,
								url: item.url,
								status: 'prefetched',
								source: cached?.source || 'network',
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
			if (backgroundQueue.length && navigator.onLine !== false && !document.hidden) runBackgroundQueue();
		}
	});
}

function retryActiveFonts() {
	for (const state of states.values()) {
		if (!state.subscribers.size || !shouldRetryMushafFontStatus(state.status)) continue;
		state.attempts = 0;
		ensureMushafFont(state.page, state.url).catch(() => {});
	}
	runBackgroundQueue();
}

function installRecoveryListeners() {
	if (recoveryListenersInstalled || !isBrowserReady()) return;
	recoveryListenersInstalled = true;

	window.addEventListener('online', retryActiveFonts);
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) retryActiveFonts();
	});

	const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
	connection?.addEventListener?.('change', () => {
		if (navigator.onLine !== false) {
			retryActiveFonts();
			const activePages = [...states.values()].filter((state) => state.subscribers.size && state.status === 'ready').map((state) => state.page);
			if (activePages.length) queueNeighborPrefetch(activePages[activePages.length - 1]);
		}
	});
}

export async function ensureMushafFont(page, url = getMushafWordFontLink(page)) {
	if (!isBrowserReady()) throw new Error('Mushaf fonts can only be loaded in a browser.');
	installRecoveryListeners();

	const state = getState(page, url);
	const loaded = loadedFamilies.get(state.family);
	if (loaded?.url === url && loaded.face?.status === 'loaded') {
		if (state.status !== 'ready') setState(state, { status: 'ready', source: 'memory', attempts: 0 });
		return publicState(state);
	}

	if (state.status === 'checking' || state.status === 'downloading' || state.status === 'activating') {
		const shared = cacheInFlight.get(url);
		if (shared) await shared.catch(() => {});
		const ready = loadedFamilies.get(state.family);
		if (ready?.url === url && ready.face?.status === 'loaded') return publicState(state);
	}

	try {
		setState(state, { status: 'checking' });
		let cached = await findCachedFont(url);
		if (!cached) {
			setState(state, { status: 'downloading', attempts: state.attempts + 1 });
			cached = await ensureCachedFont(url);
		}

		setState(state, { status: 'activating', source: cached.source });
		await activateFont(state, cached);
		clearRetry(state);
		setState(state, { status: 'ready', source: cached.source, attempts: 0 });
		queueNeighborPrefetch(page);
		return publicState(state);
	} catch (error) {
		const offline = navigator.onLine === false || error?.code === 'OFFLINE';
		setState(state, {
			status: offline ? 'waiting-network' : 'error',
			source: null
		});
		scheduleActiveRetry(state);
		throw error;
	}
}

export function subscribeMushafFont(page, url, subscriber) {
	if (!isBrowserReady()) return () => {};
	installRecoveryListeners();

	const state = getState(page, url);
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
		states: snapshots
	};
}
