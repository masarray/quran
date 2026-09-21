import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultSettings } from '../src/data/defaultSettings.js';
import { loadUserSettings, mergeSettingsWithDefaults, parseJsonSafely } from '../src/utils/settingsStorage.js';

function createStorage() {
	const data = new Map();
	return {
		getItem(key) {
			return data.has(key) ? data.get(key) : null;
		},
		setItem(key, value) {
			data.set(key, String(value));
		},
		removeItem(key) {
			data.delete(key);
		},
		clear() {
			data.clear();
		}
	};
}

test.beforeEach(() => {
	globalThis.localStorage = createStorage();
	globalThis.sessionStorage = createStorage();
});

test.afterEach(() => {
	delete globalThis.localStorage;
	delete globalThis.sessionStorage;
});

test('safe JSON parsing never throws on malformed values', () => {
	assert.deepEqual(parseJsonSafely('{"ok":true}', {}), { ok: true });
	assert.deepEqual(parseJsonSafely('{broken', { fallback: true }), { fallback: true });
	assert.equal(parseJsonSafely(null, null), null);
});

test('structural settings repair preserves valid user data and restores missing nested defaults', () => {
	const repaired = mergeSettingsWithDefaults(
		{
			displaySettings: 'invalid',
			userNotes: {
				'1:1': { note: 'keep me', modified_at: '2026-09-21T00:00:00.000Z' }
			},
			audioSettings: { reciter: 3 }
		},
		defaultSettings
	);

	assert.equal(typeof repaired.displaySettings, 'object');
	assert.equal(repaired.displaySettings.websiteTheme, 1);
	assert.equal(repaired.userNotes['1:1'].note, 'keep me');
	assert.equal(repaired.audioSettings.reciter, 3);
	assert.equal(repaired.audioSettings.playbackSpeed, defaultSettings.audioSettings.playbackSpeed);
});

test('malformed userSettings are isolated and replaced with usable defaults', () => {
	localStorage.setItem('userSettings', '{ definitely broken');

	const repaired = loadUserSettings(defaultSettings, { persist: true });

	assert.equal(repaired.displaySettings.fontType, defaultSettings.displaySettings.fontType);
	assert.equal(repaired.audioSettings.reciter, defaultSettings.audioSettings.reciter);
	assert.doesNotThrow(() => JSON.parse(localStorage.getItem('userSettings')));

	const backup = JSON.parse(localStorage.getItem('quranRecovery:userSettingsCorrupt'));
	assert.equal(backup.raw, '{ definitely broken');
	assert.equal(sessionStorage.getItem('quran-settings-recovered'), '1');
});

test('valid unknown user fields survive default merging', () => {
	localStorage.setItem(
		'userSettings',
		JSON.stringify({
			customFutureSetting: { enabled: true },
			userBookmarks: ['1:1']
		})
	);

	const repaired = loadUserSettings(defaultSettings, { persist: true });
	assert.deepEqual(repaired.customFutureSetting, { enabled: true });
	assert.deepEqual(repaired.userBookmarks, ['1:1']);
	assert.equal(repaired.translations.word, defaultSettings.translations.word);
});
