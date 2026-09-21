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
