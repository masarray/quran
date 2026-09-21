import { quranMetaData } from '../data/quranMeta.js';

export class QuranDataIntegrityError extends Error {
	constructor(message, { cacheKey = '', kind = 'unknown' } = {}) {
		super(message);
		this.name = 'QuranDataIntegrityError';
		this.cacheKey = cacheKey;
		this.kind = kind;
	}
}

export const expectedQuranVerseCount = quranMetaData.slice(1).reduce((total, chapter) => total + (chapter?.verses || 0), 0);

export function expectedVersesInChapter(chapter) {
	return quranMetaData[chapter]?.verses || 0;
}

function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

function hasAllExpectedVerses(predicate) {
	for (let chapter = 1; chapter <= 114; chapter += 1) {
		const expected = expectedVersesInChapter(chapter);
		if (!expected) return false;

		for (let verse = 1; verse <= expected; verse += 1) {
			if (!predicate(chapter, verse)) return false;
		}
	}
	return true;
}

export function validateVerseKeyData(data) {
	if (!isObject(data)) return false;

	return hasAllExpectedVerses((chapter, verse) => {
		const entry = data[`${chapter}:${verse}`];
		if (!isObject(entry)) return false;

		const page = Number(entry.page);
		const words = Number(entry.words);
		return Number.isInteger(page) && page >= 1 && page <= 604 && Number.isInteger(words) && words >= 1;
	});
}

export function validateArabicWordData(data) {
	if (!isObject(data)) return false;

	return hasAllExpectedVerses((chapter, verse) => {
		const verseData = data[chapter]?.[verse];
		if (!Array.isArray(verseData) || !Array.isArray(verseData[0]) || verseData[0].length === 0) return false;
		return verseData[0].every((word) => isNonEmptyString(word));
	});
}

export function validateWordLanguageData(data) {
	if (!isObject(data)) return false;

	return hasAllExpectedVerses((chapter, verse) => {
		const verseData = data[chapter]?.[verse];
		if (!Array.isArray(verseData) || !Array.isArray(verseData[0]) || verseData[0].length === 0) return false;
		return verseData[0].every((word) => typeof word === 'string');
	});
}

export function validateWordDatasetAlignment({ arabicWordData, translationWordData, transliterationWordData, metaVerseData }) {
	if (!validateArabicWordData(arabicWordData) || !validateWordLanguageData(translationWordData) || !validateWordLanguageData(transliterationWordData) || !validateVerseKeyData(metaVerseData)) {
		return false;
	}

	return hasAllExpectedVerses((chapter, verse) => {
		const key = `${chapter}:${verse}`;
		const expectedWords = Number(metaVerseData[key]?.words);
		const arabicWords = arabicWordData[chapter]?.[verse]?.[0];
		const translationWords = translationWordData[chapter]?.[verse]?.[0];
		const transliterationWords = transliterationWordData[chapter]?.[verse]?.[0];

		return (
			Number.isInteger(expectedWords) &&
			expectedWords > 0 &&
			arabicWords?.length === expectedWords &&
			translationWords?.length === expectedWords &&
			transliterationWords?.length === expectedWords
		);
	});
}

export function validateVerseTranslationData(data) {
	if (!isObject(data)) return false;

	let seen = 0;
	const complete = hasAllExpectedVerses((chapter, verse) => {
		const entry = data[`${chapter}:${verse}`];
		if (!isObject(entry) || !isNonEmptyString(entry.text)) return false;
		seen += 1;
		return true;
	});

	return complete && seen === expectedQuranVerseCount;
}

export function normalizeTafsirChapterData(data) {
	if (Array.isArray(data)) return { ayahs: data };
	if (isObject(data) && (Array.isArray(data.ayahs) || isObject(data.ayahs))) return data;
	return data;
}

export function validateTafsirChapterData(data, chapter) {
	const expected = expectedVersesInChapter(chapter);
	const normalized = normalizeTafsirChapterData(data);
	if (!expected || !isObject(normalized) || (!isObject(normalized.ayahs) && !Array.isArray(normalized.ayahs))) return false;

	const ayahs = Object.values(normalized.ayahs);
	const coverage = new Map();

	for (const entry of ayahs) {
		if (!isObject(entry)) continue;
		if (Number(entry.surah) !== chapter) continue;

		const ayah = Number(entry.ayah);
		if (!Number.isInteger(ayah) || ayah < 1 || ayah > expected || !isNonEmptyString(entry.text)) continue;
		coverage.set(ayah, entry);
	}

	if (coverage.size !== expected) return false;
	for (let verse = 1; verse <= expected; verse += 1) {
		if (!coverage.has(verse)) return false;
	}
	return true;
}

export function validateMorphologySummaryData(data, chapter) {
	const expected = expectedVersesInChapter(chapter);
	if (!expected || !isObject(data) || !isObject(data.data)) return false;

	const coveredVerses = new Set();
	for (const [key, value] of Object.entries(data.data)) {
		const [keyChapter, keyVerse, keyWord] = key.split(':').map(Number);
		if (keyChapter !== chapter) continue;
		if (!Number.isInteger(keyVerse) || keyVerse < 1 || keyVerse > expected) continue;
		if (!Number.isInteger(keyWord) || keyWord < 1) continue;
		if (!isNonEmptyString(value)) continue;
		coveredVerses.add(keyVerse);
	}

	if (coveredVerses.size !== expected) return false;
	for (let verse = 1; verse <= expected; verse += 1) {
		if (!coveredVerses.has(verse)) return false;
	}
	return true;
}

export function validateMorphologyStaticData(data) {
	return isObject(data) && isObject(data.data) && Object.keys(data.data).length > 0;
}

export function chapterFromJsonPath(pathname) {
	const match = pathname.match(/\/(\d+)\.json$/);
	if (!match) return null;
	const chapter = Number(match[1]);
	return chapter >= 1 && chapter <= 114 ? chapter : null;
}

export function assertQuranDataIntegrity(data, validator, { cacheKey = '', kind = 'unknown' } = {}) {
	if (!validator || validator(data)) return true;

	throw new QuranDataIntegrityError(`Quran data integrity check failed: ${cacheKey || kind}`, {
		cacheKey,
		kind
	});
}
