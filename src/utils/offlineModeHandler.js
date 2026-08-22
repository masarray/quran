import { showAlert } from '$utils/confirmationAlertHandler';
import { base } from '$app/paths';
import { dev } from '$app/environment';

export const dataUnavailableWhileOfflineMessage = 'Data tidak tersedia saat offline.';

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
		}

		await navigator.serviceWorker.ready;

		navigator.serviceWorker.addEventListener('message', (event) => {
			if (event.data.type === 'CACHE_STARTED') {
				window.dispatchEvent(
					new CustomEvent('sw-cache-started', {
						detail: event.data
					})
				);
			} else if (event.data.type === 'CACHE_PROGRESS') {
				window.dispatchEvent(
					new CustomEvent('sw-cache-progress', {
						detail: event.data
					})
				);
			} else if (event.data.type === 'CACHE_COMPLETE') {
				window.dispatchEvent(
					new CustomEvent('sw-cache-complete', {
						detail: event.data
					})
				);
			}
		});

		if (startCaching) {
			navigator.serviceWorker.controller?.postMessage({ type: 'START_CACHING' });
		}

		return { success: true, registration };
	} catch (error) {
		console.warn(error);
		return { success: false, error: error.message };
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

		navigator.serviceWorker.controller?.postMessage({ type: 'DISABLE_CACHING' });
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

export async function isUserOnline(timeout = 1000) {
	if (!navigator.onLine) return false;

	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch('https://www.gstatic.com/generate_204?cacheBust=' + Date.now(), {
			method: 'GET',
			mode: 'no-cors',
			cache: 'no-store',
			signal: controller.signal
		});

		clearTimeout(id);
		return response.type === 'opaque' || (response.status >= 200 && response.status < 300);
	} catch (error) {
		clearTimeout(id);
		console.warn(error);
		return false;
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
