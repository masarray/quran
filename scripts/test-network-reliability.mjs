import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { fetchWithRetry, isAudioContentType, isRetryableHttpStatus, isUsableAudioResponse } from '../src/utils/networkFetch.js';

async function withServer(handler, run) {
	const server = http.createServer(handler);
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const origin = `http://127.0.0.1:${address.port}`;

	try {
		await run(origin);
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
}

test('retry classification covers transient HTTP failures only', () => {
	for (const status of [408, 425, 429, 500, 502, 503, 504, 599]) {
		assert.equal(isRetryableHttpStatus(status), true, String(status));
	}
	for (const status of [200, 301, 400, 401, 403, 404, 409, 422]) {
		assert.equal(isRetryableHttpStatus(status), false, String(status));
	}
});

test('audio response validation rejects HTML error bodies even with HTTP 200', () => {
	assert.equal(isAudioContentType('audio/mpeg'), true);
	assert.equal(isAudioContentType('audio/mp3; charset=binary'), true);
	assert.equal(isAudioContentType('application/octet-stream'), true);
	assert.equal(isAudioContentType('text/html'), false);
	assert.equal(isAudioContentType('application/json'), false);

	const good = new Response('audio', { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
	const bad = new Response('<html>error</html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
	assert.equal(isUsableAudioResponse(good), true);
	assert.equal(isUsableAudioResponse(bad), false);
});

test('retries transient 503 responses and returns the eventual success', async () => {
	let requests = 0;
	await withServer(
		(_req, res) => {
			requests += 1;
			if (requests < 3) {
				res.statusCode = 503;
				res.end('temporary');
				return;
			}
			res.statusCode = 200;
			res.end('ok');
		},
		async (origin) => {
			const response = await fetchWithRetry(`${origin}/retry`, {}, { attempts: 3, baseDelayMs: 1, maxDelayMs: 2, timeoutMs: 2000 });
			assert.equal(response.status, 200);
			assert.equal(await response.text(), 'ok');
			assert.equal(requests, 3);
		}
	);
});

test('does not retry a permanent 404 response', async () => {
	let requests = 0;
	await withServer(
		(_req, res) => {
			requests += 1;
			res.statusCode = 404;
			res.end('missing');
		},
		async (origin) => {
			const response = await fetchWithRetry(`${origin}/missing`, {}, { attempts: 4, baseDelayMs: 1, timeoutMs: 2000 });
			assert.equal(response.status, 404);
			assert.equal(requests, 1);
		}
	);
});

test('retries a timed-out attempt and can recover', async () => {
	let requests = 0;
	await withServer(
		(_req, res) => {
			requests += 1;
			if (requests === 1) {
				setTimeout(() => {
					if (!res.headersSent) {
						res.statusCode = 200;
						res.end('late');
					}
				}, 80);
				return;
			}
			res.statusCode = 200;
			res.end('fast');
		},
		async (origin) => {
			const response = await fetchWithRetry(`${origin}/timeout`, {}, { attempts: 2, baseDelayMs: 1, timeoutMs: 25 });
			assert.equal(response.status, 200);
			assert.equal(await response.text(), 'fast');
			assert.equal(requests, 2);
		}
	);
});

test('honors caller abort without continuing retries', async () => {
	let requests = 0;
	await withServer(
		(_req, res) => {
			requests += 1;
			setTimeout(() => {
				if (!res.headersSent) {
					res.statusCode = 200;
					res.end('late');
				}
			}, 100);
		},
		async (origin) => {
			const controller = new AbortController();
			setTimeout(() => controller.abort(new Error('caller stopped')), 10);

			await assert.rejects(
				() => fetchWithRetry(`${origin}/abort`, { signal: controller.signal }, { attempts: 4, baseDelayMs: 1, timeoutMs: 1000 }),
				/caller stopped|aborted/i
			);
			assert.equal(requests, 1);
		}
	);
});
