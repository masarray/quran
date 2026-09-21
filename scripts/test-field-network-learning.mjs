import test from 'node:test';
import assert from 'node:assert/strict';
import {
	MAX_MUSHAF_FIELD_EVENTS,
	MUSHAF_NETWORK_PROFILE_TTL_MS,
	createMushafNetworkProfile,
	deriveAdaptiveMushafMode,
	pruneMushafFieldEvents,
	sanitizeMushafFieldEvent,
	updateMushafNetworkProfile
} from '../src/utils/mushafFontFieldDiagnostics.js';
import { getMushafFontPrefetchPlan } from '../src/utils/mushafFontPolicy.js';

test('adaptive profile enters recovery after repeated real failures', () => {
	let profile = createMushafNetworkProfile({ at: 0 });
	profile = updateMushafNetworkProfile(profile, { ok: false, latencyMs: 9000, at: 1000 });
	assert.equal(profile.adaptiveMode, 'cautious');
	profile = updateMushafNetworkProfile(profile, { ok: false, latencyMs: 12000, at: 2000 });
	assert.equal(profile.adaptiveMode, 'recovery');
	assert.equal(deriveAdaptiveMushafMode(profile, { at: 2500 }), 'recovery');
});

test('adaptive profile recovers only after repeated successful evidence', () => {
	let profile = createMushafNetworkProfile({ at: 0 });
	profile = updateMushafNetworkProfile(profile, { ok: false, latencyMs: 10000, at: 1000 });
	profile = updateMushafNetworkProfile(profile, { ok: false, latencyMs: 10000, at: 2000 });
	assert.equal(profile.adaptiveMode, 'recovery');

	for (let index = 0; index < 8; index++) {
		profile = updateMushafNetworkProfile(profile, { ok: true, latencyMs: 900, at: 3000 + index * 1000 });
	}
	assert.equal(profile.adaptiveMode, 'cautious');

	for (let index = 8; index < 12; index++) {
		profile = updateMushafNetworkProfile(profile, { ok: true, latencyMs: 900, at: 3000 + index * 1000 });
	}

	assert.ok(['balanced', 'fast'].includes(profile.adaptiveMode));
	assert.ok(profile.ewmaLatencyMs < 5000);
});

test('stale learning expires instead of poisoning a later commute', () => {
	let profile = createMushafNetworkProfile({ at: 0 });
	profile = updateMushafNetworkProfile(profile, { ok: false, latencyMs: 15000, at: 1000 });
	profile = updateMushafNetworkProfile(profile, { ok: false, latencyMs: 15000, at: 2000 });
	assert.equal(profile.adaptiveMode, 'recovery');

	const later = MUSHAF_NETWORK_PROFILE_TTL_MS + 5000;
	const reset = updateMushafNetworkProfile(profile, { ok: true, latencyMs: 700, at: later });
	assert.equal(reset.sampleCount, 1);
	assert.equal(reset.failureCount, 0);
	assert.equal(reset.successCount, 1);
	assert.equal(reset.adaptiveMode, 'balanced');
});

test('adaptive prefetch depth follows learned mode without overriding Save-Data or 2G', () => {
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, previousPage: 18, effectiveType: '4g', adaptiveMode: 'recovery' }), []);
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, previousPage: 18, effectiveType: '4g', adaptiveMode: 'cautious' }), [20]);
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, previousPage: 18, effectiveType: '4g', adaptiveMode: 'balanced' }), [20, 21, 18]);
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, previousPage: 18, effectiveType: '4g', adaptiveMode: 'fast' }), [20, 21, 22, 18]);
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, effectiveType: '2g', adaptiveMode: 'fast' }), []);
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, effectiveType: '4g', adaptiveMode: 'fast', saveData: true }), []);
});

test('field diagnostics strip reading context and network identifiers', () => {
	const event = sanitizeMushafFieldEvent('network-failure', {
		at: 1234,
		ok: false,
		latencyMs: 7210,
		priority: 'critical',
		source: 'network',
		reason: 'critical-font-failure',
		mode: 'recovery',
		effectiveType: '4g',
		failureStreak: 3,
		url: 'https://example.test/font.woff2',
		page: 19,
		surah: 2,
		ayah: 136,
		path: '/2/136',
		ssid: 'secret',
		ip: '127.0.0.1'
	});

	assert.deepEqual(Object.keys(event).sort(), [
		'at',
		'effectiveType',
		'failureStreak',
		'latencyMs',
		'mode',
		'ok',
		'priority',
		'reason',
		'source',
		'type',
		'version'
	].sort());
	assert.equal(JSON.stringify(event).includes('136'), false);
	assert.equal(JSON.stringify(event).includes('font.woff2'), false);
	assert.equal(JSON.stringify(event).includes('secret'), false);
	assert.equal(JSON.stringify(event).includes('127.0.0.1'), false);
});

test('field event log remains bounded and drops old samples', () => {
	const now = 10 * 24 * 60 * 60 * 1000;
	const events = Array.from({ length: MAX_MUSHAF_FIELD_EVENTS + 25 }, (_, index) => ({
		at: now - index * 1000,
		type: 'network-health'
	})).reverse();
	const pruned = pruneMushafFieldEvents(events, { at: now });
	assert.equal(pruned.length, MAX_MUSHAF_FIELD_EVENTS);

	const oldOnly = [{ at: 1, type: 'network-health' }];
	assert.deepEqual(pruneMushafFieldEvents(oldOnly, { at: now }), []);
});
