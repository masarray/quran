import { writeFile } from 'node:fs/promises';

import { selectableReciters, selectableTranslationReciters } from '../src/data/options.js';
import { staticEndpoint, wordsAudioURL } from '../src/data/websiteSettings.js';

const output = process.env.MEDIA_SOURCE_REPORT || 'media-source-report.json';
const defaultReciterId = 10;
const defaultTranslationReciterId = 1;

function verseUrl(baseUrl, chapter = 1, verse = 1) {
	const filename = `${String(chapter).padStart(3, '0')}${String(verse).padStart(3, '0')}.mp3`;
	return `${baseUrl.replace(/\/$/, '')}/${filename}`;
}

async function probe(url, { expect = 'audio', timeoutMs = 20000 } = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const started = Date.now();

	try {
		const response = await fetch(url, {
			headers: {
				Range: 'bytes=0-4095',
				'User-Agent': 'quran-media-source-audit/1.0'
			},
			redirect: 'follow',
			signal: controller.signal
		});

		const contentType = (response.headers.get('content-type') || '').toLowerCase();
		const contentLength = Number(response.headers.get('content-length') || 0);
		const cors = response.headers.get('access-control-allow-origin');
		const partial = response.status === 206;
		const statusOk = response.ok;
		const typeOk =
			expect === 'json'
				? contentType.includes('json') || contentType.includes('text/plain') || contentType === ''
				: contentType.startsWith('audio/') || contentType.includes('octet-stream') || contentType === '';

		let sampleBytes = 0;
		if (response.body) {
			const reader = response.body.getReader();
			const { value } = await reader.read();
			sampleBytes = value?.byteLength || 0;
			await reader.cancel();
		}

		return {
			ok: statusOk && typeOk && sampleBytes > 0,
			status: response.status,
			contentType,
			contentLength,
			sampleBytes,
			partial,
			cors,
			finalUrl: response.url,
			elapsedMs: Date.now() - started
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
			elapsedMs: Date.now() - started
		};
	} finally {
		clearTimeout(timer);
	}
}

async function main() {
	const targets = [];

	for (const reciter of Object.values(selectableReciters)) {
		targets.push({
			name: `verse-reciter-${reciter.id}-${reciter.reciter}`,
			url: verseUrl(reciter.url),
			required: reciter.id === defaultReciterId,
			expect: 'audio'
		});
	}

	for (const reciter of Object.values(selectableTranslationReciters)) {
		targets.push({
			name: `translation-reciter-${reciter.id}-${reciter.reciter}`,
			url: verseUrl(reciter.url),
			required: reciter.id === defaultTranslationReciterId,
			expect: 'audio'
		});
	}

	targets.push(
		{
			name: 'word-audio-1-1-1',
			url: `${wordsAudioURL}/1/001_001_001.mp3?version=2`,
			required: true,
			expect: 'audio'
		},
		{
			name: 'word-timestamps',
			url: `${staticEndpoint}/timestamps/timestamps.json?version=2`,
			required: true,
			expect: 'json'
		}
	);

	const results = [];
	const concurrency = 4;
	let next = 0;

	const worker = async () => {
		while (next < targets.length) {
			const target = targets[next++];
			const result = await probe(target.url, { expect: target.expect });
			results.push({ ...target, ...result });

			const marker = result.ok ? 'PASS' : target.required ? 'FAIL' : 'WARN';
			console.log(
				`${marker} ${target.name}: status=${result.status ?? '-'} type=${result.contentType ?? '-'} cors=${result.cors ?? '-'} sample=${result.sampleBytes ?? 0} url=${target.url}`
			);
		}
	};

	await Promise.all(Array.from({ length: concurrency }, () => worker()));
	results.sort((a, b) => a.name.localeCompare(b.name));

	const requiredFailures = results.filter((entry) => entry.required && !entry.ok);
	const corsMissing = results.filter((entry) => entry.ok && !entry.cors);

	const report = {
		generatedAt: new Date().toISOString(),
		requiredFailures: requiredFailures.length,
		corsMissing: corsMissing.map((entry) => entry.name),
		results
	};

	await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

	if (requiredFailures.length > 0) {
		throw new Error(`${requiredFailures.length} required media source probe(s) failed`);
	}

	console.log(`Required media sources healthy. ${corsMissing.length} reachable source(s) did not advertise CORS.`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.stack || error.message : error);
	process.exitCode = 1;
});
