import { showAlert } from '$utils/confirmationAlertHandler';
import { base } from '$app/paths';
import { dev } from '$app/environment';

export const dataUnavailableWhileOfflineMessage = 'Data tidak tersedia saat offline.';

let serviceWorkerMessageBridgeInstalled = false;

function dispatchServiceWorkerEvent(type, detail) {
	window.dispatchEvent(new CustomEvent(type, { detail }));
}

function installServiceWorkerMessageBridge() {
	if (serviceWorkerMessageBridgeInstalled || !('serviceWorker' in navigator)) return;
	serviceWorkerMessageBridgeInstalled = true;

	navigator.serviceWorker.addEventListener('message', (event) => {
		switch (event.data?.type) {
			case 'CACHE_STARTED':
				dispatchServiceWorkerEvent('sw-cache-started', event.data);
				break;
			case 'CACHE_PROGRESS':
				dispatchServiceWorkerEvent('sw-cache-progress', event.data);
				break;
			case 'CACHE_COMPLETE':
				dispatchServiceWorkerEvent('sw-cache-complete', event.data);
				break;
			case 'CACHE_FAILED':
				dispatchServiceWorkerEvent('sw-cache-failed', event.data);
				break;
			case 'CACHE_UPDATE_STARTED':
				dispatchServiceWorkerEvent('sw-cache-update-started', event.data);
				break;
			case 'CACHE_UPDATE_COMPLETE':
				dispatchServiceWorkerEvent('sw-cache-update-complete', event.data);
				break;
			case 'CACHE_UPDATE_FAILED':
				dispatchServiceWorkerEvent('sw-cache-update-failed', event.data);
				break;
		}
	});
}

function getActiveServiceWorker(registration) {
	return navigator.serviceWorker.controller || registration?.active || null;
}

function postMessageAndWait(worker, message, { timeout = 120000 } = {}) {
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		const timer = setTimeout(() => {
			channel.port1.close();
			reject(new Error(`Service worker request timed out: ${message.type}`));
		}, timeout);

		channel.port1.onmessage = (event) => {
			clearTimeout(timer);
			channel.port1.close();
			if (event.data?.ok) resolve(event.data);
			else reject(new Error(event.data?.error || `Service worker request failed: ${message.type}`));
		};

		try {
			worker.postMessage(message, [channel.port2]);
		} catch (error) {
			clearTimeout(timer);
			channel.port1.close();
			reject(error);
		}
	});
}

async function getReadyServiceWorker() {
	const registration = await navigator.serviceWorker.getRegistration();
	if (!registration) throw new Error('Service worker belum terdaftar.');

	const readyRegistration = await navigator.serviceWorker.ready;
	const worker = getActiveServiceWorker(readyRegistration || registration);
	if (!worker) throw new Error('Service worker belum aktif. Silakan coba lagi.');
	return worker;
}

export async function cacheUrlWithServiceWorker(url, cacheName, { force = false, timeout = 120000 } = {}) {
	const worker = await getReadyServiceWorker();
	return postMessageAndWait(worker, { type: 'CACHE_URL', url, cacheName, force }, { timeout });
}

export async function deleteServiceWorkerCache(cacheName, { timeout = 30000 } = {}) {
	const worker = await getReadyServiceWorker();
	return postMessageAndWait(worker, { type: 'DELETE_CACHE', cacheName }, { timeout });
}

export async function registerServiceWorker({ startCaching = true } = {}) {
	if (dev) {
		return { success: false, error: 'Service worker dinonaktifkan pada mode pengembangan.' };
	}

	if (!('serviceWorker' in navigator)) {
		return { success: false, error: 'Fitur ini tidak didukung oleh browser.' };
	}

	try {
		let registration = await navigator.serviceWorker.getRegistration();

		if (!registration) {
			registration = await navigator.serviceWorker.register(`${base}/service-worker.js`, {
				type: 'module'
			});
		} else {
			try {
				await registration.update();
			} catch (error) {
				console.warn('[PWA] Service worker update check failed; keeping current worker.', error);
			}
		}

		const readyRegistration = await navigator.serviceWorker.ready;
		installServiceWorkerMessageBridge();

		if (startCaching) {
			const worker = getActiveServiceWorker(readyRegistration || registration);
			if (!worker) return { success: false, error: 'Service worker belum aktif. Silakan coba lagi.' };
			await postMessageAndWait(worker, { type: 'START_CACHING' }, { timeout: 180000 });
		}

		return { success: true, registration: readyRegistration || registration };
	} catch (error) {
		console.warn(error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function disableServiceWorkerInDevelopment() {
	if (!dev || !('serviceWorker' in navigator)) return;
	await unregisterServiceWorkerAndClearCache();
}

export async function disableHiddenOfflineCaching() {
	if (dev || !('serviceWorker' in navigator)) return;

	try {
		const registration = await navigator.serviceWorker.getRegistration();
		if (!registration) return;

		getActiveServiceWorker(registration)?.postMessage({ type: 'DISABLE_CACHING' });
	} catch (error) {
		console.warn(error);
	}
}

export async function unregisterServiceWorkerAndClearCache() {
	try {
		const registrations = await navigator.serviceWorker.getRegistrations();
		await Promise.all(registrations.map((registration) => registration.unregister()));

		const cacheNames = await caches.keys();
		await Promise.all(cacheNames.map((cache) => caches.delete(cache)));

		console.log('All service workers unregistered and caches cleared.');
	} catch (error) {
		console.warn(error);
	}
}

export async function isUserOnline(timeout = 3000) {
	if (!navigator.onLine) return false;

	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeout);
	const probeUrl = `${base}/manifest.json?__network_probe=${Date.now()}`;

	try {
		const response = await fetch(probeUrl, {
			method: 'GET',
			cache: 'no-store',
			signal: controller.signal
		});
		return response.ok;
	} catch (error) {
		console.warn('[PWA] Connectivity probe failed', error);
		return false;
	} finally {
		clearTimeout(id);
	}
}

export function showOfflineAlert() {
	showAlert('Perangkat sedang offline. Sambungkan internet atau buka Mode Offline jika data sudah diunduh.', 'settings-drawer');
	return false;
}

export async function checkOnlineAndAlert() {
	const online = await isUserOnline();
	if (online) return true;

	showOfflineAlert();
	return false;
}
