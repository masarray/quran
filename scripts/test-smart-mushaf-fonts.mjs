import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getMushafFontPrefetchPlan, shouldRetryMushafFontStatus } from '../src/utils/mushafFontPolicy.js';

test('fast/default connections prefetch in reading direction with a bounded look-behind', () => {
	assert.deepEqual(
		getMushafFontPrefetchPlan({ page: 19, previousPage: 18, effectiveType: '4g', saveData: false }),
		[20, 21, 18]
	);
	assert.deepEqual(
		getMushafFontPrefetchPlan({ page: 20, previousPage: 21, effectiveType: '4g', saveData: false }),
		[19, 18, 21]
	);
});

test('slow or data-saving connections do not waste bandwidth', () => {
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, effectiveType: '2g' }), []);
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, effectiveType: 'slow-2g' }), []);
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, effectiveType: '4g', saveData: true }), []);
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 19, effectiveType: '3g' }), [20]);
});

test('prefetch plan respects Mushaf page boundaries', () => {
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 1, effectiveType: '4g' }), [2, 3]);
	assert.deepEqual(getMushafFontPrefetchPlan({ page: 604, previousPage: 603, effectiveType: '4g' }), [603]);
});

test('only recoverable active font states are retried', () => {
	assert.equal(shouldRetryMushafFontStatus('waiting-network'), true);
	assert.equal(shouldRetryMushafFontStatus('error'), true);
	assert.equal(shouldRetryMushafFontStatus('ready'), false);
	assert.equal(shouldRetryMushafFontStatus('downloading'), false);
});

test('smart font implementation keeps persistent cache and removes permanent session failure memory', async () => {
	const [worker, manager, words] = await Promise.all([
		readFile('src/service-worker.js', 'utf8'),
		readFile('src/utils/mushafFontManager.js', 'utf8'),
		readFile('src/components/display/verses/WordsBlock.svelte', 'utf8')
	]);

	assert.match(worker, /quranwbw-mushaf-font-smart-v1/);
	assert.match(worker, /CACHE_MUSHAF_FONT/);
	assert.match(worker, /isMushafFontUrl/);
	assert.match(worker, /Invalid WOFF2 payload/);
	assert.match(worker, /PERSISTENT_AUTOMATIC_CACHE_NAMES/);
	assert.match(worker, /persisted: false/);
	assert.match(worker, /could not be persisted/);
	assert.match(manager, /cacheSearchOrder = \[smartMushafFontCacheName, fullMushafCacheName\]/);
	assert.match(manager, /cacheInFlight/);
	assert.match(manager, /fontReadyInFlight/);
	assert.match(manager, /desiredUrlByFamily/);
	assert.match(manager, /MIN_BACKGROUND_STORAGE_HEADROOM_BYTES/);
	assert.match(manager, /network-uncached/);
	assert.match(manager, /navigator\.connection/);
	assert.match(manager, /mushaf-font-progress/);
	assert.doesNotMatch(words, /failedMushafFonts/);
	assert.match(words, /subscribeMushafFont/);
	assert.match(words, /opacity-0 select-none/);
});
