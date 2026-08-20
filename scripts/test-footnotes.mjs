import assert from 'node:assert/strict';
import test from 'node:test';

import { recoverCompositeFootnotes, resolveFootnote, splitCompositeFootnote } from '../src/utils/footnotes.js';

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

test('recovers punctuation-adjacent boundary like Fatir 35:10', () => {
	const composite =
		'* Sebagian mufasir mengatakan bahwa perkataan yang baik itu ialah Kalimat Tauhid yaitu Lā ilāha illallāh; dan ada pula yang mengatakan zikir kepada Allah dan semua perkataan yang baik yang diucapkan karena Allah.708) Perkataan baik dan amal yang baik itu dinaikkan untuk diterima dan diberi-Nya pahala.';

	const sections = splitCompositeFootnote(composite, 2);
	assert.equal(sections?.length, 2);
	assert.match(sections[0], /karena Allah\.$/);
	assert.match(sections[1], /^Perkataan baik dan amal yang baik/);
	assert.equal(sections[0].includes('708)'), false);
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
	const footnotes = [
		'* Catatan pertama yang tetap menjadi sumber utama.708) Catatan kedua hasil recovery.',
		''
	];

	const first = resolveFootnote(footnotes, '1', 1, { markerCount: 2 });
	const second = resolveFootnote(footnotes, '2', 2, { markerCount: 2 });

	assert.equal(first?.strategy, 'display-number');
	assert.match(first?.content ?? '', /Catatan pertama/);
	assert.equal(second?.strategy, 'composite-sequential-boundaries');
	assert.equal(second?.recovered, true);
	assert.equal(second?.content, 'Catatan kedua hasil recovery.');
});
