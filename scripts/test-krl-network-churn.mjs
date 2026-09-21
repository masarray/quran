import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
	KRL_NETWORK_BASE_COOLDOWN_MS,
	KRL_NETWORK_MAX_COOLDOWN_MS,
	createMushafFontNetworkHealth,
	markMushafFontNetworkFailure,
	markMushafFontNetworkSignal,
	markMushafFontNetworkSuccess,
	canPrefetchMushafFonts,
	getMushafFontActiveRetryDelay
} from '../src/utils/mushafFontNetworkHealth.js';

test('4G/online signals do not falsely mark a broken data path healthy', () => {
	let state = createMushafFontNetworkHealth({ online: true, at: 1000 });
	assert.equal(canPrefetchMushafFonts(state, { online: true, at: 1000 }), true);

	state = markMushafFontNetworkFailure(state, { at: 2000, reason: 'critical-timeout' });
	assert.equal(state.status, 'degraded');
	assert.equal(state.failureStreak, 1);
	assert.equal(state.cooldownUntil, 2000 + KRL_NETWORK_BASE_COOLDOWN_MS);
	assert.equal(canPrefetchMushafFonts(state, { online: true, at: 9000 }), false);

	state = markMushafFontNetworkSignal(state, { online: true, at: 10000, reason: '4g-indicator-returned' });
	assert.equal(state.status, 'probing');
	assert.equal(state.failureStreak, 1);
	assert.equal(canPrefetchMushafFonts(state, { online: true, at: 10000 }), false);

	state = markMushafFontNetworkSuccess(state, { at: 11000, reason: 'critical-font-success' });
	assert.equal(state.status, 'healthy');
	assert.equal(state.failureStreak, 0);
	assert.equal(canPrefetchMushafFonts(state, { online: true, at: 11000 }), true);
});

test('repeated KRL failures back off instead of restarting from zero on every signal change', () => {
	let state = createMushafFontNetworkHealth({ online: true, at: 0 });

	for (let index = 1; index <= 8; index++) {
		state = markMushafFontNetworkFailure(state, { at: index * 1000, reason: 'tunnel-drop' });
		state = markMushafFontNetworkSignal(state, { online: true, at: index * 1000 + 100, reason: 'cell-handover' });
		assert.equal(state.failureStreak, index);
		assert.equal(canPrefetchMushafFonts(state, { online: true, at: index * 1000 + 200 }), false);
	}

	assert.equal(state.cooldownUntil - state.lastFailureAt, KRL_NETWORK_MAX_COOLDOWN_MS);
});

test('active retry delay grows and caps while background work remains suspended', () => {
	assert.equal(getMushafFontActiveRetryDelay({ attempts: 1, networkFailureStreak: 1 }), 2000);
	assert.equal(getMushafFontActiveRetryDelay({ attempts: 2, networkFailureStreak: 2 }), 4000);
	assert.equal(getMushafFontActiveRetryDelay({ attempts: 5, networkFailureStreak: 5 }), 32000);
	assert.equal(getMushafFontActiveRetryDelay({ attempts: 99, networkFailureStreak: 99 }), 60000);
});

test('explicit offline state blocks speculative work until a real success occurs', () => {
	let state = createMushafFontNetworkHealth({ online: true, at: 0 });
	state = markMushafFontNetworkSignal(state, { online: false, at: 1000, reason: 'train-tunnel' });
	assert.equal(state.status, 'offline');
	assert.equal(canPrefetchMushafFonts(state, { online: false, at: 2000 }), false);

	state = markMushafFontNetworkSignal(state, { online: true, at: 3000, reason: 'station-signal' });
	assert.equal(state.status, 'probing');
	assert.equal(canPrefetchMushafFonts(state, { online: true, at: 3000 }), false);

	state = markMushafFontNetworkSuccess(state, { at: 4000 });
	assert.equal(canPrefetchMushafFonts(state, { online: true, at: 4000 }), true);
});

test('manager and worker implement priority, circuit breaker and learned-cache promotion contracts', async () => {
	const [manager, worker, offlineHandler] = await Promise.all([
		readFile('src/utils/mushafFontManager.js', 'utf8'),
		readFile('src/service-worker.js', 'utf8'),
		readFile('src/utils/offlineModeHandler.js', 'utf8')
	]);

	assert.match(manager, /canPrefetchMushafFonts/);
	assert.match(manager, /mushaf-font-network-health/);
	assert.match(manager, /MIN_RECOVERY_PROBE_GAP_MS/);
	assert.match(manager, /priority: 'prefetch'/);
	assert.match(manager, /priority: 'critical'/);
	assert.match(manager, /promoteUsedOfflineFont/);
	assert.match(manager, /smartCache\.put\(url, response\.clone\(\)\)/);
	assert.match(manager, /uncachedNetworkResult/);
	assert.match(manager, /new Response\(bytes/);
	assert.doesNotMatch(manager, /state\.attempts = 0;\s*ensureMushafFont/);

	assert.match(worker, /MUSHAF_FONT_FETCH_PROFILES/);
	assert.match(worker, /prefetch: \{ attempts: 1/);
	assert.match(worker, /critical: \{ attempts: 3/);
	assert.match(worker, /event\.data\.priority === 'prefetch'/);
	assert.match(worker, /shared\.priority === 'prefetch'/);
	assert.match(worker, /smartMushafFontInFlight\.set\(url\.href, \{ promise: taskPromise, priority \}\)/);
	assert.match(worker, /bytes = await response\.clone\(\)\.arrayBuffer\(\)/);

	assert.match(offlineHandler, /priority = 'critical'/);
	assert.match(offlineHandler, /CACHE_MUSHAF_FONT', url, priority/);
});
