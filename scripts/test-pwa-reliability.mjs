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
assert.ok(serviceWorker.includes('if (sameOrigin && cachingEnabled && networkResponse.ok)'), 'cross-origin responses must not leak into the core app-shell cache');
assert.ok(serviceWorker.includes('matchOfflineDataCaches(event.request)'), 'explicitly downloaded cross-origin offline assets must remain readable');
assert.ok(serviceWorker.includes('OFFLINE_CONTENT_CACHE_NAMES'), 'offline content must use an explicit cache allowlist');
assert.ok(serviceWorker.includes('OFFLINE_ASSET_ORIGINS'), 'cross-origin interception must be restricted to approved Quran asset origins');
assert.ok(serviceWorker.includes('if (!sameOrigin && !approvedOfflineOrigin) return;'), 'unrelated external traffic must bypass the service worker');
assert.ok(serviceWorker.includes('replyToMessage(event'), 'transactional cache operations must acknowledge completion');
assert.ok(serviceWorker.includes("source: 'cache'"), 'interrupted downloads must resume from already verified cache entries');
assert.equal(serviceWorker.includes('await cache.put(event.request, networkResponse.clone())'), false, 'normal network traffic must never be duplicated into the app-shell cache');
assert.ok(serviceWorker.includes("url.searchParams.has('__network_probe')"), 'network probe must bypass the service worker');
assert.ok(serviceWorker.includes('cacheNames.core, cacheNames.config, cacheNames.audioData'), 'disabling offline mode must preserve the app shell');
assert.equal(serviceWorker.includes('networkTimeout'), false, 'hard network timeout must not gate PWA startup');
assert.equal(serviceWorker.includes('fetchWithTimeout'), false, 'hard network timeout helper must stay removed');
assert.equal(serviceWorker.includes('Offline - resource not cached'), false, 'raw technical 503 text must never be the navigation UX');

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

const offlineHandler = await read('src/utils/offlineModeHandler.js');
assert.ok(offlineHandler.includes('new MessageChannel()'), 'service-worker requests must use a MessageChannel acknowledgement');
assert.ok(offlineHandler.includes("type: 'CACHE_URL'"), 'offline handler must expose transactional URL caching');
assert.ok(offlineHandler.includes("type: 'DELETE_CACHE'"), 'offline handler must await cache deletion');

const appHtml = await read('src/app.html');
assert.ok(appHtml.includes("const appBasePath = '%sveltekit.assets%'.replace(/\\/$/, '');"));

if (existsSync(path.join(root, 'build'))) {
	const requiredArtifacts = ['build/index.html', 'build/404.html', 'build/service-worker.js'];
	for (const artifact of requiredArtifacts) {
		assert.ok(existsSync(path.join(root, artifact)), `missing build artifact: ${artifact}`);
	}

	const builtWorker = await read('build/service-worker.js');
	assert.equal(builtWorker.includes('Offline - resource not cached'), false, 'built service worker regressed to raw offline error text');
}

console.log('PWA reliability assertions passed.');
