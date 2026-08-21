import assert from 'node:assert/strict';
import test from 'node:test';

import { extractFootnoteMarkers, recoverCompositeFootnotes, resolveFootnote, splitCompositeFootnote } from '../src/utils/footnotes.js';

test('recovers five sequential composite footnotes like Al-Maidah 5:2', () => {
	const composite =
		'* Syiar-syiar kesucian Allah ialah segala amalan yang dilakukan dalam rangka ibadah haji. 254) Bulan haram ialah Zulkaidah, Zulhijah, Muharam dan Rajab. 255) Hadyu ialah hewan yang disembelih sebagai pengganti (dam). 256) Qalāid ialah hewan hadyu yang diberi kalung. 257) Dimaksud dengan karunia ialah keuntungan yang diberikan Allah dalam perjalanan ibadah haji.';

	const sections = splitCompositeFootnote(composite, 5);
	assert.equal(sections?.length, 5);
	assert.match(sections[0], /^Syiar-syiar/);
	assert.match(sections[1], /^Bulan haram/);
	assert.match(sections[2], /^Hadyu/);
	assert.match(sections[3], /^Qalāid/);
	assert.match(sections[4], /^Dimaksud dengan karunia/);
});

test('smoke: extracts and resolves markers 1 through 5 without empty content', () => {
	const verseText = [
		'A <sup foot_note="1">1</sup>',
		'B <sup foot_note="2">2</sup>',
		'C <sup foot_note="3">3</sup>',
		'D <sup foot_note="4">4</sup>',
		'E <sup foot_note="5">5</sup>'
	].join(' ');
	const footnotes = [
		'* Catatan pertama yang valid. 254) Catatan kedua yang valid. 255) Catatan ketiga yang valid. 256) Catatan keempat yang valid. 257) Catatan kelima yang valid.',
		'',
		'',
		'',
		''
	];

	const markers = extractFootnoteMarkers(verseText);
	assert.deepEqual(
		markers.map((marker) => marker.displayNumber),
		[1, 2, 3, 4, 5]
	);

	const resolved = markers.map((marker) => resolveFootnote(footnotes, marker.footnoteId, marker.displayNumber, { markerCount: markers.length }));
	assert.equal(resolved.length, 5);
	assert.ok(resolved.every((entry) => typeof entry?.content === 'string' && entry.content.length > 0));
	assert.match(resolved[0].content, /^\* Catatan pertama/);
	assert.equal(resolved[1].content, 'Catatan kedua yang valid.');
	assert.equal(resolved[2].content, 'Catatan ketiga yang valid.');
	assert.equal(resolved[3].content, 'Catatan keempat yang valid.');
	assert.equal(resolved[4].content, 'Catatan kelima yang valid.');
});

test('recovers punctuation-adjacent boundary like Fatir 35:10', () => {
	const composite =
		'* Sebagian mufasir mengatakan bahwa perkataan yang baik itu ialah Kalimat Tauhid yaitu Lā ilāha illallāh; dan ada pula yang mengatakan zikir kepada Allah dan semua perkataan yang baik yang diucapkan karena Allah.708) Perkataan baik dan amal yang baik itu dinaikkan untuk diterima dan diberi-Nya pahala.';

	const sections = splitCompositeFootnote(composite, 2);
	assert.equal(sections?.length, 2);
	assert.match(sections[0], /karena Allah\.$/);
	assert.match(sections[1], /^Perkataan baik dan amal yang baik/);
	assert.equal(sections[0].includes('708)'), false);
});

test('treats nested 404 source entries as unavailable and recovers from the populated entry', () => {
	const footnotes = [
		{ foot_note: { id: 135204, text: '* Catatan pertama yang tersedia.254) Catatan kedua yang tergabung.' } },
		{ status: 404, error: 'Not Found' }
	];

	const second = resolveFootnote(footnotes, '135205', 2, { markerCount: 2 });
	assert.equal(second?.strategy, 'composite-sequential-boundaries');
	assert.equal(second?.content, 'Catatan kedua yang tergabung.');
});

test('does not recover when boundary count does not match marker count', () => {
	const composite = '* Catatan pertama. 254) Catatan kedua.';
	assert.equal(splitCompositeFootnote(composite, 3), null);
});

test('does not recover when source-note numbers are not sequential', () => {
	const composite = '* Catatan pertama. 254) Catatan kedua. 256) Catatan ketiga.';
	assert.equal(splitCompositeFootnote(composite, 3), null);
});

test('does not recover when multiple source entries already contain content', () => {
	const footnotes = ['Catatan pertama.', 'Catatan kedua.'];
	assert.equal(recoverCompositeFootnotes(footnotes, 2), null);
});

test('resolver uses recovered second footnote without changing first-footnote authority', () => {
	const footnotes = ['* Catatan pertama yang tetap menjadi sumber utama.708) Catatan kedua hasil recovery.', ''];

	const first = resolveFootnote(footnotes, '1', 1, { markerCount: 2 });
	const second = resolveFootnote(footnotes, '2', 2, { markerCount: 2 });

	assert.equal(first?.strategy, 'display-number');
	assert.match(first?.content ?? '', /Catatan pertama/);
	assert.equal(second?.strategy, 'composite-sequential-boundaries');
	assert.equal(second?.recovered, true);
	assert.equal(second?.content, 'Catatan kedua hasil recovery.');
});
