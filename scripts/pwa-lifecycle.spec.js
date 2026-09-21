import { test, expect } from '@playwright/test';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const buildRoot = path.resolve('build');
const host = '127.0.0.1';
const port = 4173;
const origin = `http://${host}:${port}`;
const base = '/quran';

let server;
let swVariant = 'normal';

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safeBuildPath(relativePath) {
  const candidate = path.resolve(buildRoot, relativePath.replace(/^\/+/, ''));
  if (!candidate.startsWith(buildRoot + path.sep) && candidate !== buildRoot) return null;
  return candidate;
}

async function existingFile(candidates) {
  for (const candidate of candidates) {
    const full = safeBuildPath(candidate);
    if (!full) continue;
    try {
      if ((await stat(full)).isFile()) return full;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function serveFile(res, file, statusCode = 200, bodyOverride = null) {
  const body = bodyOverride ?? (await readFile(file));
  res.statusCode = statusCode;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
  res.end(body);
}

async function requestHandler(req, res) {
  const url = new URL(req.url ?? '/', origin);
  let pathname = decodeURIComponent(url.pathname);

  if (!pathname.startsWith(base)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const relative = pathname.slice(base.length) || '/';

  if (relative === '/service-worker.js') {
    const file = path.join(buildRoot, 'service-worker.js');
    const source = await readFile(file, 'utf8');
    let body = source;
    if (swVariant === 'broken-update') {
      body =
        "self.addEventListener('install', (event) => event.waitUntil(Promise.reject(new Error('forced lifecycle update failure'))));\n" +
        source;
    } else if (swVariant === 'successful-update') {
      body = "const __pwaLifecycleUpdateMarker = 'r0.1-success';\n" + source;
    }
    await serveFile(res, file, 200, body);
    return;
  }

  if (url.searchParams.get('slow') === '1' && (relative === '/' || relative === '/index.html')) {
    await new Promise((resolve) => setTimeout(resolve, 10750));
  }

  let file;
  if (relative === '/' || relative === '') {
    file = path.join(buildRoot, 'index.html');
  } else {
    const noLeadingSlash = relative.replace(/^\/+/, '');
    file = await existingFile([
      noLeadingSlash,
      `${noLeadingSlash}.html`,
      path.join(noLeadingSlash, 'index.html')
    ]);
  }

  if (file) {
    await serveFile(res, file);
    return;
  }

  await serveFile(res, path.join(buildRoot, '404.html'), 404);
}

async function waitForControlledPage(page) {
  await page.waitForFunction(
    () => 'serviceWorker' in navigator,
    null,
    { timeout: 10_000 }
  );

  await page.evaluate(async () => {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('service worker did not become ready')), 12_000)
    );
    const ready = navigator.serviceWorker.ready;
    await Promise.race([ready, timeout]);

    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
        ),
        timeout
      ]);
    }
  });

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const keys = await caches.keys();
          return keys.some((key) => key.startsWith('quranwbw-cache-'));
        }),
      { timeout: 12_000 }
    )
    .toBe(true);
}

async function assertAppShell(page) {
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Offline - resource not cached');
  expect(body).not.toContain('Al Quran belum dapat dimuat');
  expect((await page.title()).toLowerCase()).toContain('quran');
}

async function sendServiceWorkerRequest(page, message) {
  return page.evaluate(async ({ message }) => {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) throw new Error('missing active service worker');

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error(`service worker request timed out: ${message.type}`)), 10_000);

      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data);
      };

      worker.postMessage(message, [channel.port2]);
    });
  }, { message });
}

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    requestHandler(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) res.statusCode = 500;
      res.end('Test server error');
    });
  });
  await new Promise((resolve) => server.listen(port, host, resolve));
});

test.afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(() => {
  swVariant = 'normal';
});

test('cold GitHub Pages deep link boots through 404.html', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const response = await page.goto(`${origin}${base}/18`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000
  });

  expect(response?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  expect(await page.locator('body').innerText()).not.toContain('Not found');
  expect((await page.title()).toLowerCase()).toContain('quran');

  await context.close();
});

test('service worker registration does not depend on an idle callback', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.requestIdleCallback = () => 1;
    window.cancelIdleCallback = () => {};
  });
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000
  });

  await waitForControlledPage(page);
  await assertAppShell(page);

  await context.close();
});

test('malformed local settings cannot brick a cold deep-link startup', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('userSettings', '{ definitely broken');
  });
  const page = await context.newPage();

  await page.goto(`${origin}${base}/18`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000
  });

  await expect.poll(
    () => page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('userSettings'))?.displaySettings?.fontType;
      } catch {
        return null;
      }
    }),
    { timeout: 10_000 }
  ).toBe(1);

  const recovery = await page.evaluate(() => ({
    backup: localStorage.getItem('quranRecovery:userSettingsCorrupt'),
    flag: sessionStorage.getItem('quran-settings-recovered')
  }));
  expect(recovery.backup).toContain('{ definitely broken');
  expect(recovery.flag).toBe('1');
  await expect(page.locator('body')).toContainText('Pengaturan lokal dipulihkan');
  expect((await page.title()).toLowerCase()).toContain('quran');

  await context.close();
});

test('structurally damaged settings are repaired without deleting user notes', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem(
      'userSettings',
      JSON.stringify({
        displaySettings: 'invalid',
        userNotes: {
          '1:1': { note: 'catatan tetap ada', modified_at: '2026-09-21T00:00:00.000Z' }
        }
      })
    );
  });
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000
  });

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          try {
            const repaired = JSON.parse(localStorage.getItem('userSettings'));
            return {
              fontType: repaired?.displaySettings?.fontType,
              note: repaired?.userNotes?.['1:1']?.note
            };
          } catch {
            return null;
          }
        }),
      { timeout: 10_000 }
    )
    .toEqual({ fontType: 1, note: 'catatan tetap ada' });

  await assertAppShell(page);

  await context.close();
});

test('installed PWA survives a complete offline relaunch', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
  await assertAppShell(page);

  await context.close();
});

test('offline deep link falls back to the verified app shell', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  await context.setOffline(true);
  await page.goto(`${origin}${base}/18`, {
    waitUntil: 'domcontentloaded',
    timeout: 20_000
  });
  await assertAppShell(page);

  await context.close();
});

test('slow navigation beyond ten seconds is not aborted by the service worker', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  const started = Date.now();
  await page.goto(`${origin}${base}/?slow=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 25_000
  });
  const elapsed = Date.now() - started;

  expect(elapsed).toBeGreaterThanOrEqual(10_000);
  await assertAppShell(page);

  await context.close();
});

test('offline cache writes acknowledge durable completion and resume from cache', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  const url = `${origin}${base}/manifest.json`;
  const first = await sendServiceWorkerRequest(page, {
    type: 'CACHE_URL',
    url,
    cacheName: 'quranwbw-chapter-data'
  });
  expect(first.ok).toBe(true);
  expect(first.source).toBe('network');

  const cached = await page.evaluate(async ({ url }) => {
    const cache = await caches.open('quranwbw-chapter-data');
    return Boolean(await cache.match(url));
  }, { url });
  expect(cached).toBe(true);

  const second = await sendServiceWorkerRequest(page, {
    type: 'CACHE_URL',
    url,
    cacheName: 'quranwbw-chapter-data'
  });
  expect(second.ok).toBe(true);
  expect(second.source).toBe('cache');

  await context.close();
});

test('smart Mushaf font cache survives Offline Mode disable and serves while disconnected', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  const fontUrl =
    'https://static.quranwbw.com/data/v4/fonts/Hafs/KFGQPC-v4/COLRv1/QCF4019_COLOR-Regular.woff2?version=12';

  const seeded = await page.evaluate(async ({ fontUrl, base }) => {
    const source = await fetch(`${location.origin}${base}/fonts/qcf-uthmanic-digital.woff2`);
    if (!source.ok) throw new Error('missing local WOFF2 fixture');
    const bytes = await source.arrayBuffer();

    const smartCache = await caches.open('quranwbw-mushaf-font-smart-v1');
    await smartCache.put(
      fontUrl,
      new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'font/woff2',
          'Access-Control-Allow-Origin': '*'
        }
      })
    );

    const configCache = await caches.open('quranwbw-config');
    await configCache.put(
      'caching-enabled',
      new Response(JSON.stringify({ enabled: false }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );

    return bytes.byteLength;
  }, { fontUrl, base });

  expect(seeded).toBeGreaterThan(4);

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller || registration.active;
    if (!worker) throw new Error('missing active service worker');
    worker.postMessage({ type: 'DISABLE_CACHING' });
  });

  await expect
    .poll(
      () =>
        page.evaluate(async ({ fontUrl }) => {
          const cache = await caches.open('quranwbw-mushaf-font-smart-v1');
          return Boolean(await cache.match(fontUrl));
        }, { fontUrl }),
      { timeout: 5_000 }
    )
    .toBe(true);

  await context.setOffline(true);

  const first = await page.evaluate(async ({ fontUrl }) => {
    try {
      const response = await fetch(fontUrl, { mode: 'cors' });
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        ok: response.ok,
        status: response.status,
        signature: String.fromCharCode(...bytes.slice(0, 4))
      };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }, { fontUrl });

  expect(first.ok).toBe(true);
  expect(first.signature).toBe('wOF2');

  const second = await page.evaluate(async ({ fontUrl }) => {
    const response = await fetch(fontUrl, { mode: 'cors' });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      ok: response.ok,
      signature: String.fromCharCode(...bytes.slice(0, 4))
    };
  }, { fontUrl });

  expect(second.ok).toBe(true);
  expect(second.signature).toBe('wOF2');

  await context.close();
});

test('KRL-style repeated network flaps keep a learned Mushaf font available across offline reload', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  const fontUrl =
    'https://static.quranwbw.com/data/v4/fonts/Hafs/KFGQPC-v4/COLRv1/QCF4020_COLOR-Regular.woff2?version=12';

  await page.evaluate(async ({ fontUrl, base }) => {
    const source = await fetch(`${location.origin}${base}/fonts/qcf-uthmanic-digital.woff2`);
    if (!source.ok) throw new Error('missing local WOFF2 fixture');
    const bytes = await source.arrayBuffer();
    const cache = await caches.open('quranwbw-mushaf-font-smart-v1');
    await cache.put(
      fontUrl,
      new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'font/woff2',
          'Access-Control-Allow-Origin': '*'
        }
      })
    );
  }, { fontUrl, base });

  const readLearnedFont = () =>
    page.evaluate(async ({ fontUrl }) => {
      const response = await fetch(fontUrl, { mode: 'cors' });
      const bytes = new Uint8Array(await response.arrayBuffer());
      return {
        ok: response.ok,
        signature: String.fromCharCode(...bytes.slice(0, 4)),
        controlled: Boolean(navigator.serviceWorker.controller)
      };
    }, { fontUrl });

  for (let cycle = 0; cycle < 5; cycle++) {
    await context.setOffline(true);
    const offlineRead = await readLearnedFont();
    expect(offlineRead.ok).toBe(true);
    expect(offlineRead.signature).toBe('wOF2');
    expect(offlineRead.controlled).toBe(true);

    if (cycle === 2) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
      await assertAppShell(page);
      const afterOfflineReload = await readLearnedFont();
      expect(afterOfflineReload.ok).toBe(true);
      expect(afterOfflineReload.signature).toBe('wOF2');
      expect(afterOfflineReload.controlled).toBe(true);
    }

    await context.setOffline(false);
    const onlineRead = await readLearnedFont();
    expect(onlineRead.ok).toBe(true);
    expect(onlineRead.signature).toBe('wOF2');
    expect(onlineRead.controlled).toBe(true);
  }

  const cacheState = await page.evaluate(async ({ fontUrl }) => {
    const cache = await caches.open('quranwbw-mushaf-font-smart-v1');
    const response = await cache.match(fontUrl);
    const keys = await cache.keys();
    return {
      retained: Boolean(response),
      exactEntries: keys.filter((request) => request.url === fontUrl).length
    };
  }, { fontUrl });

  expect(cacheState.retained).toBe(true);
  expect(cacheState.exactEntries).toBe(1);

  await context.close();
});

test('app-shell repair refreshes core cache without deleting offline content or enabling offline mode', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  const sentinelUrl = `${origin}${base}/manifest.json`;
  await page.evaluate(async ({ sentinelUrl }) => {
    const chapterCache = await caches.open('quranwbw-chapter-data');
    await chapterCache.put(sentinelUrl, new Response('sentinel', { headers: { 'Content-Type': 'text/plain' } }));

    const configCache = await caches.open('quranwbw-config');
    await configCache.put(
      'caching-enabled',
      new Response(JSON.stringify({ enabled: false }), { headers: { 'Content-Type': 'application/json' } })
    );
  }, { sentinelUrl });

  const repaired = await sendServiceWorkerRequest(page, { type: 'REPAIR_CORE_CACHE' });
  expect(repaired.ok).toBe(true);

  const state = await page.evaluate(async ({ sentinelUrl, base }) => {
    const chapterCache = await caches.open('quranwbw-chapter-data');
    const configCache = await caches.open('quranwbw-config');
    const configResponse = await configCache.match('caching-enabled');
    const coreKeys = (await caches.keys()).filter((key) => key.startsWith('quranwbw-cache-'));
    let shellReady = false;
    for (const cacheName of coreKeys) {
      const cache = await caches.open(cacheName);
      if (await cache.match(`${location.origin}${base}/`)) {
        shellReady = true;
        break;
      }
    }

    return {
      sentinel: Boolean(await chapterCache.match(sentinelUrl)),
      offlineEnabled: configResponse ? (await configResponse.json()).enabled : null,
      shellReady
    };
  }, { sentinelUrl, base });

  expect(state.sentinel).toBe(true);
  expect(state.offlineEnabled).toBe(false);
  expect(state.shellReady).toBe(true);

  await context.close();
});

test('offline cache protocol rejects unowned caches and failed resources', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  const unowned = await sendServiceWorkerRequest(page, {
    type: 'CACHE_URL',
    url: `${origin}${base}/manifest.json`,
    cacheName: 'unowned-test-cache'
  });
  expect(unowned.ok).toBe(false);
  expect(unowned.error).toContain('Unsupported offline cache');

  const missing = await sendServiceWorkerRequest(page, {
    type: 'CACHE_URL',
    url: `${origin}${base}/missing-offline-resource.json`,
    cacheName: 'quranwbw-chapter-data'
  });
  expect(missing.ok).toBe(false);
  expect(missing.error).toContain('HTTP 404');

  await context.close();
});

test('failed service-worker update keeps the last healthy version usable offline', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  const cacheKeysBefore = await page.evaluate(() => caches.keys());
  expect(cacheKeysBefore.some((key) => key.startsWith('quranwbw-cache-'))).toBe(true);

  swVariant = 'broken-update';
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('missing service worker registration');
    await registration.update();
  });

  await page.waitForTimeout(1_500);

  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return {
      active: Boolean(registration?.active),
      waiting: Boolean(registration?.waiting)
    };
  });
  expect(state.active).toBe(true);
  expect(state.waiting).toBe(false);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
  await assertAppShell(page);

  await context.close();
});

test('successful service-worker update claims the page and remains offline-safe', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${origin}${base}/`, { waitUntil: 'domcontentloaded' });
  await waitForControlledPage(page);

  swVariant = 'successful-update';

  const changed = page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('missing service worker registration');

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('controller did not change')), 15_000);
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {
          clearTimeout(timer);
          resolve(true);
        },
        { once: true }
      );

      registration.update().catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  });

  await expect(changed).resolves.toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
  await assertAppShell(page);

  await context.close();
});
