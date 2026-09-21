import { build, files, version } from '$service-worker';

/**
 * SERVICE WORKER FOR QURANWBW OFFLINE FUNCTIONALITY
 *
 * This service worker enables optional offline access to the website.
 * It does NOT automatically cache anything - users must explicitly enable offline mode.
 *
 * HOW IT WORKS:
 * 1. Service worker registers automatically when user visits the site (but does nothing)
 * 2. User initially downloads the core website files
 * 3. Service worker receives START_CACHING message
 * 4. All website pages are downloaded and cached on the user's device
 * 5. When offline, cached pages are served instead of showing errors
 *
 * UPDATES:
 * When we deploy a new version:
 * - Users with offline mode enabled will automatically get the updated cache
 * - Old cached data is deleted and replaced with new data
 * - Users without offline mode enabled see no difference
 */

// Different cache names for different data types
const CORE_CACHE_PREFIX = 'quranwbw-cache-';
const cacheNames = {
	core: `quranwbw-cache-${version}`, // Core website files (versioned)
	config: 'quranwbw-config', // User preferences (survives across versions)
	audioData: 'quranwbw-audio-cache', // Audio files (recitations and word audios)
	chapterData: 'quranwbw-chapter-data', // Chapter routes and data
	mushafData: 'quranwbw-mushaf-data', // Mushaf pages and fonts
	morphologyData: 'quranwbw-morphology-data', // Morphology data files
	tafsirData: 'quranwbw-tafsir-data' // Tafsir data files
};
const scopeUrl = new URL(self.registration.scope);
const basePath = scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname.slice(0, -1) : scopeUrl.pathname;
function withBase(path) {
	if (/^https?:\/\//i.test(path)) return path;
	const normalized = path.startsWith('/') ? path : `/${path}`;
	if (!basePath) return normalized;
	if (normalized === basePath || normalized.startsWith(`${basePath}/`)) return normalized;
	return `${basePath}${normalized}`;
}

// Files we should never cache (the service worker itself and its settings)
const stuffNotToCache = ['/service-worker.js', '/service-worker-settings.json'];

// Static files built by SvelteKit (CSS, JS, images from /static folder)
const precacheFiles = [
	...files, // Static files from /static folder
	...build // Generated JS/CSS chunks (includes the main bundle)
];

// Important pages we want to cache
const staticRoutesToCache = ['/about', '/bookmarks', '/changelog', '/duas', '/games/guess-the-word', '/morphology', '/offline', '/supplications', '/topics', '/juz', '/hizb', '/page'].map(withBase);

// This flag tracks whether the user has enabled offline mode
// CRITICAL: This must be loaded from cache on startup!
let cachingEnabled = false;
let cachingStatusLoaded = false; // Track if we've loaded the status

/**
 * CHECK IF USER PREVIOUSLY ENABLED OFFLINE MODE
 * Reads from the config cache to see if caching was enabled before
 */
async function getCachingStatus() {
	try {
		const cache = await caches.open(cacheNames.config);
		const response = await cache.match('caching-enabled');
		if (response) {
			const data = await response.json();
			return data.enabled;
		}
	} catch (error) {
		console.warn(error);
	}
	return false;
}

/**
 * SAVE USER'S OFFLINE MODE PREFERENCE
 * Stores whether caching is enabled so it persists across updates
 */
async function saveCachingStatus(enabled) {
	try {
		const cache = await caches.open(cacheNames.config);
		await cache.put(
			'caching-enabled',
			new Response(JSON.stringify({ enabled }), {
				headers: { 'Content-Type': 'application/json' }
			})
		);
	} catch (error) {
		console.warn(error);
	}
}

/**
 * ENSURE CACHING STATUS IS LOADED
 * This must be called before any fetch events use cachingEnabled
 */
async function ensureCachingStatusLoaded() {
	if (!cachingStatusLoaded) {
		cachingEnabled = await getCachingStatus();
		cachingStatusLoaded = true;
		console.log('[SW] Caching status loaded:', cachingEnabled);
	}
}

/**
 * INSTALL EVENT
 * Runs when service worker is first installed
 * We skip waiting so the new service worker activates immediately
 */
self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(cacheNames.core);
			try {
				await cache.addAll([withBase('/'), ...build]);
				await self.skipWaiting();
			} catch (error) {
				await caches.delete(cacheNames.core);
				throw error;
			}
		})()
	);
});

/**
 * ACTIVATE EVENT
 * Runs when service worker becomes active (takes control of the page)
 *
 * This is where we:
 * 1. Check if user had offline mode enabled before
 * 2. If yes, automatically update their cache with new content
 * 3. Delete old caches from previous versions ONLY AFTER new cache is complete
 */
async function notifyClients(message) {
	const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
	clients.forEach((client) => client.postMessage(message));
}

async function getVersionedCoreCacheNames() {
	const keys = await caches.keys();
	const previous = keys.filter((key) => key.startsWith(CORE_CACHE_PREFIX) && key !== cacheNames.core).reverse();
	return [cacheNames.core, ...previous];
}

async function cleanupOldCoreCaches() {
	const coreCaches = await getVersionedCoreCacheNames();
	const keep = new Set(coreCaches.slice(0, 2));
	await Promise.all(coreCaches.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
}

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			await ensureCachingStatusLoaded();
			let offlineRefreshComplete = true;

			if (cachingEnabled) {
				await notifyClients({ type: 'CACHE_UPDATE_STARTED' });
				try {
					await performCaching();
					await notifyClients({ type: 'CACHE_UPDATE_COMPLETE' });
				} catch (error) {
					offlineRefreshComplete = false;
					console.warn('[SW] Offline cache refresh failed; previous cache is retained.', error);
					await notifyClients({ type: 'CACHE_UPDATE_FAILED' });
				}
			}

			await self.clients.claim();
			if (offlineRefreshComplete) await cleanupOldCoreCaches();
		})()
	);
});
/**
 * PERFORM CACHING
 * Downloads and caches all website content
 * This function is called both when user enables offline mode
 * and when service worker updates automatically
 */
async function performCaching() {
	const cache = await caches.open(cacheNames.core);

	// Cache the homepage and all build files (CSS, JS, etc.)
	await cache.addAll([withBase('/'), ...precacheFiles]);

	// Helper function to cache a list of routes with progress tracking
	const backgroundCache = async (routes, label) => {
		const total = routes.length;
		for (let i = 0; i < routes.length; i++) {
			try {
				// Fetch the page
				const response = await fetch(routes[i]);
				if (response.ok) {
					// Save it to cache
					await cache.put(routes[i], response.clone());
				}
			} catch (error) {
				console.warn(error);
			}

			// Send progress update to the website (so we can show a progress bar)
			const progressClients = await self.clients.matchAll();
			progressClients.forEach((client) => {
				client.postMessage({
					type: 'CACHE_PROGRESS',
					category: label,
					current: i + 1,
					total: total
				});
			});
		}
	};

	// Cache all the different types of pages
	await backgroundCache(staticRoutesToCache, 'static-routes');
}

/**
 * MESSAGE EVENT
 * Listens for messages from the website
 *
 * START_CACHING: User initially downloads the core website files
 * CACHE_URL: Cache a specific URL to a specific cache
 * DELETE_CACHE: Delete a specific cache
 * DISABLE_CACHING: User wants to clear all offline data
 */
self.addEventListener('message', (event) => {
	// User wants to enable offline mode
	if (event.data.type === 'START_CACHING') {
		cachingEnabled = true;
		cachingStatusLoaded = true;
		saveCachingStatus(true); // Remember this preference

		event.waitUntil(
			(async () => {
				// Tell the website we're starting
				const clients = await self.clients.matchAll();
				clients.forEach((client) => {
					client.postMessage({ type: 'CACHE_STARTED' });
				});

				// Download and cache everything
				await performCaching();

				// Tell the website we're done
				const finalClients = await self.clients.matchAll();
				finalClients.forEach((client) => {
					client.postMessage({
						type: 'CACHE_COMPLETE',
						cacheName: cacheNames.core
					});
				});
			})()
		);
	}
	// Cache a specific URL to a specific cache
	else if (event.data.type === 'CACHE_URL') {
		event.waitUntil(
			(async () => {
				try {
					const cacheName = event.data.cacheName || cacheNames.core;
					const cache = await caches.open(cacheName);
					const response = await fetch(event.data.url);
					if (response.ok) {
						await cache.put(event.data.url, response);
					}
				} catch (error) {
					console.warn(error);
				}
			})()
		);
	}
	// Delete a specific cache
	else if (event.data.type === 'DELETE_CACHE') {
		event.waitUntil(
			(async () => {
				try {
					const cacheName = event.data.cacheName;
					await caches.delete(cacheName);

					const clients = await self.clients.matchAll();
					clients.forEach((client) => {
						client.postMessage({
							type: 'CACHE_DELETED',
							cacheName: cacheName
						});
					});
				} catch (error) {
					console.warn(error);
				}
			})()
		);
	}
	// User wants to disable offline mode and clear all data
	else if (event.data.type === 'DISABLE_CACHING') {
		cachingEnabled = false;
		cachingStatusLoaded = true;
		saveCachingStatus(false); // Remember this preference

		event.waitUntil(
			(async () => {
				// Keep the verified app shell, config, and audio cache. Offline content caches are cleared.
				const keys = await caches.keys();
				const preserve = new Set([cacheNames.core, cacheNames.config, cacheNames.audioData]);
				await Promise.all(
					keys.map((key) => {
						if (!preserve.has(key) && !key.startsWith(CORE_CACHE_PREFIX)) {
							return caches.delete(key);
						}
					})
				);
				await cleanupOldCoreCaches();

				// Tell the website cache is cleared
				const clients = await self.clients.matchAll();
				clients.forEach((client) => {
					client.postMessage({ type: 'CACHE_CLEARED' });
				});
			})()
		);
	}
});

/**
 * FETCH EVENT
 * Intercepts all network requests from the website
 *
 * If offline mode is enabled:
 * - Try to serve from cache first (checks all caches)
 * - If not in cache, fetch from network and cache it
 * - If offline and not in cache, show error (or homepage for navigation)
 *
 * If offline mode is disabled:
 * - Just fetch from network normally (service worker does nothing)
 */
async function matchVersionedCoreCaches(request) {
	for (const cacheName of await getVersionedCoreCacheNames()) {
		const cache = await caches.open(cacheName);
		const response = await cache.match(request);
		if (response) return response;
	}
	return null;
}

async function matchOfflineDataCaches(request) {
	for (const cacheName of [cacheNames.chapterData, cacheNames.mushafData, cacheNames.morphologyData, cacheNames.tafsirData, cacheNames.audioData]) {
		const cache = await caches.open(cacheName);
		const response = await cache.match(request);
		if (response) return response;
	}
	return null;
}

async function matchAppShell() {
	return matchVersionedCoreCaches(new Request(new URL(withBase('/'), scopeUrl.origin)));
}

function offlineRecoveryResponse() {
	const html = '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Al Quran</title><body style="font-family:system-ui,sans-serif;margin:0;padding:2rem;line-height:1.5"><main style="max-width:32rem;margin:15vh auto"><h1 style="font-size:1.2rem">Al Quran belum dapat dimuat</h1><p>Koneksi sedang tidak tersedia dan data aplikasi lokal belum siap. Sambungkan internet lalu coba lagi.</p><button onclick="location.reload()" style="padding:.7rem 1rem">Coba lagi</button></main></body></html>';
	return new Response(html, {
		status: 503,
		statusText: 'Service Unavailable',
		headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
	});
}

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	if (event.request.method !== 'GET' || stuffNotToCache.some((excluded) => url.pathname.includes(excluded))) return;
	if (url.searchParams.has('__network_probe')) return;
	if (url.origin !== scopeUrl.origin) return;

	event.respondWith(
		(async () => {
			await ensureCachingStatusLoaded();

			if (event.request.mode !== 'navigate') {
				const coreResponse = await matchVersionedCoreCaches(event.request);
				if (coreResponse) return coreResponse;
			}

			if (cachingEnabled) {
				const offlineResponse = await matchOfflineDataCaches(event.request);
				if (offlineResponse) return offlineResponse;
			}

			try {
				const networkResponse = await fetch(event.request);
				if (networkResponse && networkResponse.status < 500) {
					if (cachingEnabled && networkResponse.ok) {
						const cache = await caches.open(cacheNames.core);
						await cache.put(event.request, networkResponse.clone());
					}
					return networkResponse;
				}
			} catch (error) {
				console.warn('[SW] Network request failed; using local fallback when possible.', error);
			}

			const exactCore = await matchVersionedCoreCaches(event.request);
			if (exactCore) return exactCore;

			if (event.request.mode === 'navigate') {
				const shell = await matchAppShell();
				if (shell) return shell;
				return offlineRecoveryResponse();
			}

			if (event.request.destination === 'image') {
				return new Response(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), { headers: { 'Content-Type': 'image/gif' } });
			}

			if (event.request.destination === 'font') {
				return new Response('Font unavailable offline', {
					status: 503,
					statusText: 'Service Unavailable',
					headers: { 'Content-Type': 'text/plain; charset=utf-8' }
				});
			}

			return new Response('Resource unavailable offline', {
				status: 503,
				statusText: 'Service Unavailable',
				headers: { 'Content-Type': 'text/plain; charset=utf-8' }
			});
		})()
	);
});
