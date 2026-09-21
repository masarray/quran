import { writeFile } from 'node:fs/promises';

import {
	assertQuranDataIntegrity,
	validateArabicWordData,
	validateMorphologySummaryData,
	validateTafsirChapterData,
	validateVerseKeyData,
	validateVerseTranslationData,
	validateWordLanguageData
} from '../src/utils/quranDataIntegrity.js';

const staticEndpoint = process.env.QURANWBW_STATIC_ENDPOINT || 'https://static.quranwbw.com/data/v4';
const tafsirEndpoint = process.env.QURANWBW_TAFSIR_ENDPOINT || 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir';
const output = process.env.QURAN_INTEGRITY_REPORT || 'quran-data-integrity-report.json';

async function fetchJsonWithRetry(url, attempts = 3) {
	let lastError;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			const response = await fetch(url, {
				headers: { 'User-Agent': 'quran-data-integrity-audit/1.0' },
				signal: AbortSignal.timeout(45000)
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const text = await response.text();
			return { data: JSON.parse(text), bytes: Buffer.byteLength(text) };
		} catch (error) {
			lastError = error;
			if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
		}
	}
	throw new Error(`Failed to fetch ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function auditAsset(report, { name, url, validator, kind }) {
	const started = Date.now();
	const { data, bytes } = await fetchJsonWithRetry(url);
	assertQuranDataIntegrity(data, validator, { cacheKey: url, kind });

	const result = {
		name,
		url,
		bytes,
		elapsedMs: Date.now() - started,
		ok: true
	};
	report.assets.push(result);
	console.log(`PASS ${name} (${(bytes / 1024 / 1024).toFixed(2)} MB, ${result.elapsedMs} ms)`);
}

async function main() {
	const report = {
		generatedAt: new Date().toISOString(),
		assets: []
	};

	const assets = [
		{
			name: 'verse-key metadata',
			url: `${staticEndpoint}/meta/verseKeyData.json?version=3`,
			validator: validateVerseKeyData,
			kind: 'metadata'
		},
		{
			name: 'default Arabic word data',
			url: `${staticEndpoint}/words-data/arabic/1.json?version=5`,
			validator: validateArabicWordData,
			kind: 'arabic'
		},
		{
			name: 'Indonesian word translation',
			url: `${staticEndpoint}/words-data/translations/4.json?version=1`,
			validator: validateWordLanguageData,
			kind: 'word-translation'
		},
		{
			name: 'default word transliteration',
			url: `${staticEndpoint}/words-data/transliterations/1.json?version=1`,
			validator: validateWordLanguageData,
			kind: 'word-transliteration'
		},
		{
			name: 'Indonesian Ministry verse translation',
			url: `${staticEndpoint}/verse-translations/33.json?version=1`,
			validator: validateVerseTranslationData,
			kind: 'verse-translation'
		}
	];

	for (const chapter of [1, 18, 114]) {
		assets.push({
			name: `morphology summary chapter ${chapter}`,
			url: `${staticEndpoint}/lexicon/word-summaries/${chapter}.json?version=2`,
			validator: (data) => validateMorphologySummaryData(data, chapter),
			kind: 'morphology'
		});
		assets.push({
			name: `default tafsir chapter ${chapter}`,
			url: `${tafsirEndpoint}/en-tafisr-ibn-kathir/${chapter}.json`,
			validator: (data) => validateTafsirChapterData(data, chapter),
			kind: 'tafsir'
		});
	}

	for (const asset of assets) await auditAsset(report, asset);

	report.ok = report.assets.every((asset) => asset.ok);
	report.totalBytes = report.assets.reduce((total, asset) => total + asset.bytes, 0);
	await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

	console.log(`Validated ${report.assets.length} live Quran datasets; ${(report.totalBytes / 1024 / 1024).toFixed(2)} MB checked.`);
}

main().catch(async (error) => {
	console.error(error instanceof Error ? error.stack || error.message : error);
	try {
		await writeFile(
			output,
			`${JSON.stringify({ generatedAt: new Date().toISOString(), ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
			'utf8'
		);
	} catch {
		// Keep the original audit failure authoritative.
	}
	process.exitCode = 1;
});
