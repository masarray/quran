import { writeFile } from 'node:fs/promises';
import { auditTranslationFootnotes } from '../src/utils/footnotes.js';

const DEFAULT_ENDPOINT = 'https://static.quranwbw.com/data/v4';

function parseArguments(argv) {
	const options = {
		translations: [33],
		endpoint: process.env.QURANWBW_STATIC_ENDPOINT || DEFAULT_ENDPOINT,
		output: null,
		showProblems: 50,
		failOnMissing: false
	};

	for (const argument of argv) {
		if (argument.startsWith('--translation=')) {
			options.translations = argument
				.slice('--translation='.length)
				.split(',')
				.map((value) => Number(value.trim()))
				.filter((value) => Number.isInteger(value) && value > 0);
		} else if (argument.startsWith('--endpoint=')) {
			options.endpoint = argument.slice('--endpoint='.length).replace(/\/$/, '');
		} else if (argument.startsWith('--output=')) {
			options.output = argument.slice('--output='.length);
		} else if (argument.startsWith('--show-problems=')) {
			const value = Number(argument.slice('--show-problems='.length));
			if (Number.isInteger(value) && value >= 0) options.showProblems = value;
		} else if (argument === '--fail-on-missing') {
			options.failOnMissing = true;
		}
	}

	if (options.translations.length === 0) options.translations = [33];
	return options;
}

function printSummary(translationId, summary) {
	console.log(`\nTranslation ${translationId}`);
	console.log('='.repeat(44));
	console.log(`Verses scanned                 : ${summary.versesScanned}`);
	console.log(`Verses with footnotes          : ${summary.versesWithFootnotes}`);
	console.log(`Footnote markers               : ${summary.markers}`);
	console.log(`Footnote markers #2+           : ${summary.markers2Plus}`);
	console.log(`Resolved                       : ${summary.resolved}`);
	console.log(`Resolved #2+                   : ${summary.resolved2Plus}`);
	console.log(`Recovered from legacy lookup   : ${summary.recoveredFromLegacyFailure}`);
	console.log(`Recovered #2+                  : ${summary.recovered2PlusFromLegacyFailure}`);
	console.log(`Missing                        : ${summary.missing}`);
	console.log(`Missing #2+                    : ${summary.missing2Plus}`);
	console.log(`Empty                          : ${summary.empty}`);
	console.log(`Empty #2+                      : ${summary.empty2Plus}`);
}

function printProblems(problems, limit) {
	if (problems.length === 0) {
		console.log('\nNo unresolved footnotes detected.');
		return;
	}

	console.log(`\nUnresolved footnotes (showing ${Math.min(limit, problems.length)} of ${problems.length})`);
	console.log('-'.repeat(84));

	for (const problem of problems.slice(0, limit)) {
		console.log(
			`${problem.verseKey.padEnd(9)} footnote #${String(problem.displayNumber).padEnd(3)} id=${String(problem.footnoteId).padEnd(10)} ${problem.status.padEnd(7)} source=${problem.footnotesType}(${problem.footnotesCount})`
		);
	}
}

async function fetchTranslation(endpoint, translationId) {
	const url = `${endpoint}/verse-translations/${translationId}.json?version=1`;
	const response = await fetch(url, {
		headers: {
			'User-Agent': 'quran-footnote-integrity-audit/1.0'
		}
	});

	if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
	return { url, data: await response.json() };
}

async function main() {
	const options = parseArguments(process.argv.slice(2));
	const report = {
		generatedAt: new Date().toISOString(),
		endpoint: options.endpoint,
		translations: {}
	};

	let unresolvedTotal = 0;

	for (const translationId of options.translations) {
		const { url, data } = await fetchTranslation(options.endpoint, translationId);
		const audit = auditTranslationFootnotes(data);
		report.translations[translationId] = { source: url, ...audit };
		unresolvedTotal += audit.summary.missing + audit.summary.empty;

		printSummary(translationId, audit.summary);
		printProblems(audit.problems, options.showProblems);
	}

	if (options.output) {
		await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
		console.log(`\nJSON report written to ${options.output}`);
	}

	if (options.failOnMissing && unresolvedTotal > 0) {
		console.error(`\nAudit failed: ${unresolvedTotal} unresolved footnote(s).`);
		process.exitCode = 2;
	}
}

main().catch((error) => {
	console.error('\nFootnote audit failed to run.');
	console.error(error instanceof Error ? error.stack || error.message : error);
	process.exitCode = 1;
});
