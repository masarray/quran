import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), 'utf8');

const serviceWorker = await read('src/service-worker.js');
assert.match(serviceWorker, /self\.addEventListener\('install',[\s\S]*?event\.waitUntil/);
assert.match(serviceWorker, /cache\.addAll\(\[withBase\('\/'\), \.\.\.build\.map\(withBase\)\]\)/);
assert.ok(serviceWorker.includes('getVersionedCoreCacheNames'), 'previous healthy core cache fallback must be retained');
assert.ok(serviceWorker.includes('offlineRecoveryResponse'), 'navigation must have a branded recovery response');
assert.ok(serviceWorker.includes('const sameOrigin = url.origin === scopeUrl.origin;'), 'service worker must distinguish same-origin app shell requests');
assert.equal(serviceWorker.includes('if (sameOrigin && cachingEnabled && networkResponse.ok)'), false, 'normal network responses must not be written into the core app-shell cache');
assert.ok(serviceWorker.includes('matchOfflineDataCaches(event.request)'), 'explicitly downloaded cross-origin offline assets must remain readable');
assert.ok(serviceWorker.includes('OFFLINE_CONTENT_CACHE_NAMES'), 'offline content must use an explicit cache allowlist');
assert.ok(serviceWorker.includes('OFFLINE_ASSET_ORIGINS'), 'cross-origin interception must be restricted to approved Quran asset origins');
assert.ok(serviceWorker.includes('if (!sameOrigin && !approvedOfflineOrigin) return;'), 'unrelated external traffic must bypass the service worker');
assert.ok(serviceWorker.includes('replyToMessage(event'), 'transactional cache operations must acknowledge completion');
assert.ok(serviceWorker.includes("event.data.type === 'REPAIR_CORE_CACHE'"), 'app-shell repair must be handled transactionally by the service worker');
assert.ok(serviceWorker.includes('existing caches are retained'), 'failed app-shell repair must retain the previous core cache');
assert.ok(serviceWorker.includes("source: 'cache'"), 'interrupted downloads must resume from already verified cache entries');
assert.equal(serviceWorker.includes('await cache.put(event.request, networkResponse.clone())'), false, 'normal network traffic must never be duplicated into the app-shell cache');
assert.ok(serviceWorker.includes("url.searchParams.has('__network_probe')"), 'network probe must bypass the service worker');
assert.ok(serviceWorker.includes('cacheNames.core, cacheNames.config, cacheNames.audioData'), 'disabling offline mode must preserve the app shell');
assert.equal(serviceWorker.includes('networkTimeout'), false, 'hard network timeout must not gate PWA startup');
assert.equal(serviceWorker.includes('fetchWithTimeout'), false, 'hard network timeout helper must stay removed');
assert.equal(serviceWorker.includes('Offline - resource not cached'), false, 'raw technical 503 text must never be the navigation UX');

const audioController = await read('src/utils/audioController.js');
assert.ok(audioController.includes('fetchWithRetry'), 'audio playback must retry transient media failures');
assert.ok(audioController.includes('isUsableAudioResponse'), 'audio responses must be validated before cache/playback');
assert.ok(audioController.includes('await audio.play()'), 'media playback rejection must be observed');
assert.equal(audioController.includes('checkOnlineAndAlert'), false, 'audio must not depend on an unrelated same-origin connectivity probe');
assert.equal(audioController.includes('return url;'), false, 'failed controlled audio fetches must not escape to an untracked raw-URL fallback');

const networkFetch = await read('src/utils/networkFetch.js');
assert.ok(networkFetch.includes('isRetryableHttpStatus'), 'network retry policy must be explicit');
assert.ok(networkFetch.includes('timeoutMs = 30000'), 'data/media retries must have a bounded per-attempt timeout');

const config = await read('svelte.config.js');
assert.ok(config.includes("fallback: '404.html'"), 'GitHub Pages must generate a 404 SPA fallback');
assert.equal(config.includes("fallback: 'index.html'"), false, 'index.html must not be overwritten as the adapter fallback');

const chapterRoute = await read('src/routes/[chapter]/+page.js');
assert.ok(chapterRoute.includes("import { base } from '$app/paths';"));
assert.ok(chapterRoute.includes('goto(`${base}/${chapter}/${verse}`'));
assert.ok(chapterRoute.includes('goto(`${base}/${getIdByKeyword(params.chapter)}`'));

const juzRoute = await read('src/routes/juz/[juz]/+page.js');
assert.ok(juzRoute.includes('goto(`${base}/juz?id=${juz}`'));

const hizbRoute = await read('src/routes/hizb/[hizb]/+page.js');
assert.ok(hizbRoute.includes('goto(`${base}/hizb?id=${hizb}`'));

const morphologyRoute = await read('src/routes/morphology/[word]/+page.js');
assert.ok(morphologyRoute.includes('goto(`${base}/morphology?word=${key}`'));

const offlinePage = await read('src/routes/offline/+page.svelte');
assert.ok(offlinePage.includes("import { base } from '$app/paths';"));
assert.ok(offlinePage.includes('(_, i) => `${base}/${i + 1}`'));
assert.ok(offlinePage.includes('cacheUrlWithServiceWorker'), 'offline downloads must wait for service-worker acknowledgement');
assert.ok(offlinePage.includes("'quranwbw-font-data'"), 'shared Quran fonts must use a dedicated offline cache');
assert.equal(offlinePage.includes('setTimeout(resolve, 50)'), false, 'offline progress must not be driven by artificial delays');
assert.ok(offlinePage.includes('ensureStorageCapacity'), 'offline downloads must preflight browser storage capacity');
assert.ok(offlinePage.includes('inspectOfflineCacheHealth'), 'saved download flags must be reconciled against real CacheStorage');
assert.ok(offlinePage.includes('getDexieTableCount'), 'IndexedDB-only offline sections must be health-checked');
assert.ok(offlinePage.includes('requireCacheWrite: true'), 'offline JSON downloads must require durable IndexedDB writes');
assert.equal(offlinePage.includes('unregisterServiceWorkerAndClearCache'), false, 'removing optional offline data must not remove the always-available PWA app shell');

const fetchData = await read('src/utils/fetchData.js');
assert.ok(fetchData.includes('requireCacheWrite = false'), 'JSON cache helper must support a strict durability mode');
assert.ok(fetchData.includes('Failed to persist offline data'), 'strict offline writes must fail closed when IndexedDB storage fails');

const storageHealth = await read('src/utils/storageHealth.js');
assert.ok(storageHealth.includes('navigator.storage?.estimate'), 'storage quota must be estimated before large downloads');
assert.ok(storageHealth.includes('navigator.storage?.persist'), 'offline mode should request persistent browser storage');
assert.ok(storageHealth.includes('StorageCapacityError'), 'insufficient storage must produce a specific recoverable error');

const offlineHandler = await read('src/utils/offlineModeHandler.js');
assert.ok(offlineHandler.includes('new MessageChannel()'), 'service-worker requests must use a MessageChannel acknowledgement');
assert.ok(offlineHandler.includes("type: 'CACHE_URL'"), 'offline handler must expose transactional URL caching');
assert.ok(offlineHandler.includes("type: 'DELETE_CACHE'"), 'offline handler must await cache deletion');
assert.ok(offlineHandler.includes("type: 'REPAIR_CORE_CACHE'"), 'app-shell recovery must request an acknowledged non-destructive core-cache repair');
assert.equal(offlineHandler.includes('if (registration) await registration.unregister();'), false, 'app-shell recovery must not unregister the healthy worker before replacement is proven');

const appHtml = await read('src/app.html');
assert.ok(appHtml.includes("const appBasePath = '%sveltekit.assets%'.replace(/\\/$/, '');"));
assert.ok(appHtml.includes('__QURAN_BOOT_USER_SETTINGS__'), 'boot HTML must isolate malformed settings before module startup');
assert.equal(appHtml.includes("JSON.parse(localStorage.getItem('userSettings'))"), false, 'boot HTML must not directly parse untrusted settings');

const hooksClient = await read('src/hooks.client.js');
assert.ok(hooksClient.includes('loadUserSettings'), 'client hook must repair user settings before stores initialize');
assert.ok(hooksClient.includes('handleError'), 'client runtime errors must enter the diagnostic/recovery path');

const settingsStorage = await read('src/utils/settingsStorage.js');
assert.ok(settingsStorage.includes('mergeSettingsWithDefaults'), 'nested settings must be structurally repaired');
assert.ok(settingsStorage.includes('quranRecovery:userSettingsCorrupt'), 'malformed settings must be isolated with a local recovery copy');

const settingsManager = await read('src/utils/settingsManager.js');
assert.equal(settingsManager.includes('window.umami.track('), false, 'settings import/export must not depend on analytics availability');
assert.ok(settingsManager.includes('window.umami?.track?.('), 'settings telemetry must be best-effort only');

const rootError = await read('src/routes/+error.svelte');
assert.ok(rootError.includes('repairPwaAppShell'), 'root error boundary must expose non-destructive app-shell recovery');

const pwaRecoveryBanner = await read('src/components/ui/PwaRecoveryBanner.svelte');
assert.ok(pwaRecoveryBanner.includes('wasUserSettingsRecoveredThisSession'), 'automatic settings recovery must be visible to the user');

if (existsSync(path.join(root, 'build'))) {
	const requiredArtifacts = ['build/index.html', 'build/404.html', 'build/service-worker.js'];
	for (const artifact of requiredArtifacts) {
		assert.ok(existsSync(path.join(root, artifact)), `missing build artifact: ${artifact}`);
	}

	const builtWorker = await read('build/service-worker.js');
	assert.equal(builtWorker.includes('Offline - resource not cached'), false, 'built service worker regressed to raw offline error text');
}

console.log('PWA reliability assertions passed.');
