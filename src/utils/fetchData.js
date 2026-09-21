import { cacheTableMap } from '$utils/dexie';
import { get } from 'svelte/store';
import { __fontType, __chapterData, __verseTranslationData, __wordTranslation, __wordTransliteration, __verseTranslations } from '$utils/stores';
import { staticEndpoint, cdnStaticDataUrls } from '$data/websiteSettings';
import { selectableFontTypes, selectableWordTranslations, selectableWordTransliterations, selectableVerseTranslations } from '$data/options';
import { assertQuranDataIntegrity, chapterFromJsonPath, validateArabicWordData, validateWordLanguageData, validateVerseTranslationData, validateVerseKeyData, validateTafsirChapterData, validateMorphologySummaryData, validateMorphologyStaticData } from '$utils/quranDataIntegrity';

// Keep track of in-progress fetches globally
const inFlightRequests = new Map();

// Fetches and combines word-by-word data for a chapter including Arabic, translation, transliteration, and metadata
export async function fetchChapterData(props) {
	if (!props.preventStoreUpdate) __chapterData.set(null);

	const chapter = Number(props.chapter);
	const fontType = props.fontType || get(__fontType);
	const wordTranslation = props.wordTranslation || get(__wordTranslation);
	const wordTransliteration = props.wordTransliteration || get(__wordTransliteration);

	const { arabicWordData, translationWordData, transliterationWordData, metaVerseData } = await fetchWordData(fontType, wordTranslation, wordTransliteration, {
		requireCacheWrite: props.requireCacheWrite === true
	});

	const result = {};
	const arabicVerses = arabicWordData[chapter] || {};
	const translationVerses = translationWordData[chapter] || {};
	const transliterationVerses = transliterationWordData[chapter] || {};

	for (const verseStr in arabicVerses) {
		const verseKey = `${chapter}:${verseStr}`;

		const [arabicWords = [], lineNumbers = [], endIcons = []] = arabicVerses[verseStr];
		const translations = (translationVerses[verseStr] && translationVerses[verseStr][0]) || [];
		const transliterations = (transliterationVerses[verseStr] && transliterationVerses[verseStr][0]) || [];
		const meta = metaVerseData[verseKey] || {
			chapter: chapter,
			verse: parseInt(verseStr, 10),
			page: null,
			juz: null,
			hizb: null,
			words: arabicWords.length
		};

		result[verseKey] = {
			meta: {
				chapter: chapter,
				verse: parseInt(verseStr, 10),
				page: meta.page,
				juz: meta.juz,
				hizb: meta.hizb,
				words: meta.words
			},
			words: {
				arabic: arabicWords,
				translation: translations,
				transliteration: transliterations,
				line: lineNumbers,
				end: endIcons[0] || ''
			}
		};
	}

	// Update store
	if (!props.preventStoreUpdate) __chapterData.set(result);

	return result;
}

// Fetch specific translations and cache the data.
// Fail closed: do not publish a partially loaded translation set to the UI.
export async function fetchVerseTranslationData(props = {}) {
	const translations = get(__verseTranslations);
	const existingData = get(__verseTranslationData) || {};
	const updatedData = { ...existingData };

	const results = await Promise.all(
		translations.map(async (id) => {
			const translation = selectableVerseTranslations[id];
			if (!translation) throw new Error(`Unknown verse translation ID: ${id}`);

			const data = await fetchAndCacheJson(`${staticEndpoint}/verse-translations/${id}.json?version=${translation.version}`, 'translation', {
				requireCacheWrite: props.requireCacheWrite === true
			});

			return { id, data };
		})
	);

	for (const { id, data } of results) updatedData[id] = data;

	if (!props.preventStoreUpdate) __verseTranslationData.set(updatedData);
	return updatedData;
}

// Generic fetch and cache utility with safe 7-day expiry logic
export async function fetchAndCacheJson(url, type = 'other', { requireCacheWrite = false } = {}) {
	const parsedUrl = new URL(url);
	const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
	const lastPart = pathParts[pathParts.length - 1] || '';
	const secondLastPart = pathParts[pathParts.length - 2] || 'root';
	const cacheKey = `${secondLastPart}/${lastPart}${parsedUrl.search}`;
	const maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days
	const validator = getCacheValidator(parsedUrl, type);
	const requestKey = requireCacheWrite ? `${cacheKey}::require-cache-write` : cacheKey;

	// 1. Try cache first
	const cachedData = await manageCache(cacheKey, type);

	if (cachedData) {
		let cachedDataValid = true;
		try {
			validateCachedJson(cachedData.data, validator, cacheKey, type);
		} catch (error) {
			cachedDataValid = false;
			console.warn('[integrity] rejecting corrupt cached Quran data', error);
			await deleteCacheRecord(cacheKey, type);
		}

		if (cachedDataValid) {
			const hasValidTimestamp = typeof cachedData.timestamp === 'number' && !isNaN(cachedData.timestamp);
			const age = hasValidTimestamp ? Date.now() - cachedData.timestamp : Infinity;

		// If stale → kick off background fetch (deduplicated)
		if (age > maxCacheAge && !inFlightRequests.has(cacheKey)) {
			inFlightRequests.set(
				cacheKey,
				(async () => {
					try {
						const response = await fetch(url);
						if (!response.ok) throw new Error('CDN response not ok');
						const freshData = await response.json();
						validateCachedJson(freshData, validator, cacheKey, type);
						await manageCache(cacheKey, type, freshData);
						console.log(`[cache] background update done for ${cacheKey}`);
						return freshData;
					} catch (error) {
						console.warn(error);
					} finally {
						inFlightRequests.delete(cacheKey);
					}
				})()
			);
		}

			// Always return a valid stale (or fresh) cache immediately.
			return cachedData.data;
		}
	}

	// 2. No valid cache → see if someone else is already fetching with the same durability requirement
	if (inFlightRequests.has(requestKey)) {
		return inFlightRequests.get(requestKey);
	}

	// 3. Otherwise start a new fetch and store the Promise
	const fetchPromise = (async () => {
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error('Failed to fetch data from the CDN');
			const data = await response.json();
			validateCachedJson(data, validator, cacheKey, type);
			const cacheWriteSucceeded = await manageCache(cacheKey, type, data, { throwOnWriteError: requireCacheWrite });
			if (requireCacheWrite && !cacheWriteSucceeded) {
				throw new Error(`Failed to persist offline data: ${cacheKey}`);
			}
			return data;
		} finally {
			inFlightRequests.delete(requestKey);
		}
	})();

	inFlightRequests.set(requestKey, fetchPromise);

	return fetchPromise;
}

function validateCachedJson(data, validator, cacheKey, kind) {
	return assertQuranDataIntegrity(data, validator, { cacheKey, kind });
}

function getCacheValidator(parsedUrl, type) {
	const pathname = parsedUrl.pathname;

	if (type === 'word' && pathname.includes('/words-data/arabic/')) return validateArabicWordData;

	if (type === 'word' && (pathname.includes('/words-data/translations/') || pathname.includes('/words-data/transliterations/'))) {
		return validateWordLanguageData;
	}

	if (type === 'translation' || pathname.includes('/verse-translations/')) return validateVerseTranslationData;

	if (pathname.includes('/meta/verseKeyData.json')) return validateVerseKeyData;

	if (type === 'tafsir') {
		const chapter = chapterFromJsonPath(pathname);
		return chapter ? (data) => validateTafsirChapterData(data, chapter) : () => false;
	}

	if (type === 'morphology' && pathname.includes('/lexicon/word-summaries/')) {
		const chapter = chapterFromJsonPath(pathname);
		return chapter ? (data) => validateMorphologySummaryData(data, chapter) : () => false;
	}

	if (type === 'morphology') return validateMorphologyStaticData;

	return null;
}

async function deleteCacheRecord(key, type) {
	try {
		const table = cacheTableMap[type];
		if (!table) return;
		await table.delete(key);
	} catch (error) {
		console.warn('[integrity] unable to delete corrupt cache record', error);
	}
}

// Unified cache utility for IndexedDB with version and freshness control
async function manageCache(key, type, dataToSet = undefined, { throwOnWriteError = false } = {}) {
	try {
		const table = cacheTableMap[type];
		if (!table) throw new Error(`Invalid table for type: ${type}`);

		if (dataToSet !== undefined) {
			// Set data in the cache with current timestamp
			await table.put({
				key,
				data: dataToSet,
				timestamp: Date.now()
			});
			return true;
		} else {
			// Attempt to retrieve cached data
			const record = await table.get(key);
			if (!record) return null;
			return record;
		}
	} catch (error) {
		console.warn(error);
		if (dataToSet !== undefined && throwOnWriteError) throw error;
		return dataToSet !== undefined ? false : null;
	}
}

// Fetches Arabic, translation, transliteration, and meta verse data in parallel
export async function fetchWordData(fontType, wordTranslation, wordTransliteration, { requireCacheWrite = false } = {}) {
	const { id: fontID, version: arabicVersion } = selectableFontTypes[fontType];
	const { version: translationVersion } = selectableWordTranslations[wordTranslation];
	const { version: transliterationVersion } = selectableWordTransliterations[wordTransliteration];

	const urls = [
		{ url: `${staticEndpoint}/words-data/arabic/${fontID}.json?version=${arabicVersion}`, type: 'word' },
		{ url: `${staticEndpoint}/words-data/translations/${wordTranslation}.json?version=${translationVersion}`, type: 'word' },
		{ url: `${staticEndpoint}/words-data/transliterations/${wordTransliteration}.json?version=${transliterationVersion}`, type: 'word' },
		{ url: cdnStaticDataUrls.verseKeyData, type: 'other' }
	];

	const [arabicWordData, translationWordData, transliterationWordData, metaVerseData] = await Promise.all(urls.map(({ url, type }) => fetchAndCacheJson(url, type, { requireCacheWrite })));

	return {
		arabicWordData,
		translationWordData,
		transliterationWordData,
		metaVerseData
	};
}
