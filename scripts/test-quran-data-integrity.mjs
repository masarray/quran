import assert from 'node:assert/strict';
import test from 'node:test';

import {
	QuranDataIntegrityError,
	assertQuranDataIntegrity,
	expectedQuranVerseCount,
	expectedVersesInChapter,
	validateArabicWordData,
	validateMorphologySummaryData,
	validateTafsirChapterData,
	validateVerseKeyData,
	validateVerseTranslationData,
	validateWordDatasetAlignment,
	validateWordLanguageData
} from '../src/utils/quranDataIntegrity.js';

function createCompleteVerseKeyData() {
	const data = {};
	for (let chapter = 1; chapter <= 114; chapter += 1) {
		for (let verse = 1; verse <= expectedVersesInChapter(chapter); verse += 1) {
			data[`${chapter}:${verse}`] = {
				page: Math.min(604, chapter + verse),
				words: 3
			};
		}
	}
	return data;
}

function createCompleteTranslationData() {
	const data = {};
	for (let chapter = 1; chapter <= 114; chapter += 1) {
		for (let verse = 1; verse <= expectedVersesInChapter(chapter); verse += 1) {
			data[`${chapter}:${verse}`] = { text: `Translation ${chapter}:${verse}` };
		}
	}
	return data;
}

function createCompleteWordData({ arabic = false } = {}) {
	const data = {};
	for (let chapter = 1; chapter <= 114; chapter += 1) {
		data[chapter] = {};
		for (let verse = 1; verse <= expectedVersesInChapter(chapter); verse += 1) {
			data[chapter][verse] = [[arabic ? 'قُرْآن' : 'word']];
		}
	}
	return data;
}

test('canonical metadata contains exactly 6236 Quran verses', () => {
	assert.equal(expectedQuranVerseCount, 6236);
});

test('verse-key metadata requires complete first, middle, and last coverage', () => {
	const data = createCompleteVerseKeyData();
	assert.equal(validateVerseKeyData(data), true);

	delete data['2:255'];
	assert.equal(validateVerseKeyData(data), false);
});

test('verse-key metadata rejects invalid page and word counts', () => {
	const data = createCompleteVerseKeyData();
	data['18:10'].page = 0;
	assert.equal(validateVerseKeyData(data), false);

	data['18:10'] = { page: 294, words: 0 };
	assert.equal(validateVerseKeyData(data), false);
});

test('word datasets must align with canonical per-verse word counts', () => {
	const metaVerseData = createCompleteVerseKeyData();
	const arabicWordData = createCompleteWordData({ arabic: true });
	const translationWordData = createCompleteWordData();
	const transliterationWordData = createCompleteWordData();

	assert.equal(
		validateWordDatasetAlignment({
			arabicWordData,
			translationWordData,
			transliterationWordData,
			metaVerseData
		}),
		true
	);

	metaVerseData['2:255'].words = 2;
	assert.equal(
		validateWordDatasetAlignment({
			arabicWordData,
			translationWordData,
			transliterationWordData,
			metaVerseData
		}),
		false
	);
});

test('verse translations require all 6236 non-empty verse entries', () => {
	const data = createCompleteTranslationData();
	assert.equal(validateVerseTranslationData(data), true);

	data['36:58'].text = '';
	assert.equal(validateVerseTranslationData(data), false);

	data['36:58'].text = 'Peace';
	delete data['114:6'];
	assert.equal(validateVerseTranslationData(data), false);
});

test('Arabic and word-language datasets require every Quran verse', () => {
	const arabic = createCompleteWordData({ arabic: true });
	const language = createCompleteWordData();

	assert.equal(validateArabicWordData(arabic), true);
	assert.equal(validateWordLanguageData(language), true);

	delete arabic[18][50];
	delete language[55][13];
	assert.equal(validateArabicWordData(arabic), false);
	assert.equal(validateWordLanguageData(language), false);
});

test('tafsir chapter validation accepts upstream arrays and requires exact verse coverage with text', () => {
	const chapter = 18;
	const ayahs = [];
	for (let verse = 1; verse <= expectedVersesInChapter(chapter); verse += 1) {
		ayahs.push({ surah: chapter, ayah: verse, text: `Tafsir ${verse}` });
	}

	assert.equal(validateTafsirChapterData(ayahs, chapter), true);
	assert.equal(validateTafsirChapterData({ ayahs }, chapter), true);

	ayahs.splice(56, 1);
	assert.equal(validateTafsirChapterData(ayahs, chapter), false);
});

test('morphology summary validation requires at least one valid word for every verse', () => {
	const chapter = 67;
	const entries = {};
	for (let verse = 1; verse <= expectedVersesInChapter(chapter); verse += 1) {
		entries[`${chapter}:${verse}:1`] = `Summary ${verse}`;
	}

	assert.equal(validateMorphologySummaryData({ data: entries }, chapter), true);
	delete entries[`${chapter}:15:1`];
	assert.equal(validateMorphologySummaryData({ data: entries }, chapter), false);
});

test('integrity assertion throws a typed fail-closed error', () => {
	assert.throws(
		() => assertQuranDataIntegrity({}, validateVerseTranslationData, { cacheKey: 'verse-translations/33.json', kind: 'translation' }),
		(error) => error instanceof QuranDataIntegrityError && error.cacheKey === 'verse-translations/33.json'
	);
});
