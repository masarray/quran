import {
	selectableDisplays,
	selectableFontTypes,
	fontTypes,
	selectableThemes,
	verseTranslationsLanguages,
	selectableWordTranslations,
	selectableWordTransliterations,
	selectableTranslationReciters,
	selectableTooltipOptions,
	selectableVersePlayButtonOptions,
	selectableAudioDelays
} from '$data/options';

const displayNames = {
	1: 'Kata per Kata',
	2: 'Normal',
	3: 'Kata per Kata Berkelanjutan',
	4: 'Normal Berkelanjutan',
	5: 'Berdampingan',
	6: 'Mushaf',
	7: 'Terjemah/Transliterasi'
};

const fontNames = {
	1: 'Font Digital',
	2: 'Mushaf 1441H',
	3: 'Mushaf Tajwid 1441H',
	4: 'Font Digital Qalam (Edisi Madinah)',
	5: 'Font Digital Utsman Taha',
	6: 'Font Digital Qalam (Edisi Hanafi)',
	7: 'Font Digital Tebal',
	8: 'Font Digital Tebal Utsman Taha',
	9: 'Font Digital Isep Misbah Indonesia'
};

const fontTypeNames = {
	Uthmanic: 'Utsmani',
	'Indopak / Nastaleeq': 'Indopak / Nastaliq'
};

const themeNames = {
	1: 'Kilau Emas',
	2: 'Terang Klasik',
	3: 'Kilau Perak',
	4: 'Sepia Vintage',
	5: 'Malam Moka',
	6: 'Biru Tengah Malam',
	7: 'Hijau Hutan',
	8: 'Hitam OLED',
	9: 'Gelap Mewah'
};

const languageNames = {
	Albanian: 'Albania',
	Arabic: 'Arab',
	Bangla: 'Bengali',
	Chinese: 'Mandarin',
	Divehi: 'Divehi',
	English: 'Inggris',
	French: 'Prancis',
	German: 'Jerman',
	Hindi: 'Hindi',
	Indonesian: 'Indonesia',
	Malayalam: 'Malayalam',
	Persian: 'Persia',
	Russian: 'Rusia',
	Sindhi: 'Sindhi',
	Tamil: 'Tamil',
	Transliteration: 'Transliterasi',
	Turkish: 'Turki',
	Urdu: 'Urdu',
	'Sign Language': 'Bahasa Isyarat',
	'Chinese (Traditional)': 'Mandarin (Tradisional)',
	'Chinese (Zhuyin)': 'Mandarin (Zhuyin)',
	'Chinese (Simplified)': 'Mandarin (Sederhana)',
	'Chinese (Pinyin)': 'Mandarin (Pinyin)',
	'Malayalam (Amani Thafseer)': 'Malayalam (Tafsir Amani)',
	'Malayalam (Quran Lalithasaram)': 'Malayalam (Quran Lalithasaram)'
};

Object.entries(displayNames).forEach(([id, name]) => {
	if (selectableDisplays[id]) selectableDisplays[id].displayName = name;
});

Object.entries(fontNames).forEach(([id, name]) => {
	if (selectableFontTypes[id]) selectableFontTypes[id].font = name;
});

fontTypes.forEach((type, index) => {
	fontTypes[index] = fontTypeNames[type] || type;
});
Object.values(selectableFontTypes).forEach((item) => {
	item.type = fontTypeNames[item.type] || item.type;
});

Object.entries(themeNames).forEach(([id, name]) => {
	if (selectableThemes[id]) selectableThemes[id].name = name;
});

verseTranslationsLanguages.forEach((item) => {
	item.language = languageNames[item.language] || item.language;
});

Object.values(selectableWordTranslations).forEach((item) => {
	item.language = languageNames[item.language] || item.language;
});

const wordTransliterationNames = {
	1: 'Transliterasi (Normal)',
	2: 'Transliterasi (Tajwid Sederhana)',
	3: 'Transliterasi (Tajwid Lanjutan)',
	4: 'Transliterasi (Suku Kata)'
};
Object.entries(wordTransliterationNames).forEach(([id, name]) => {
	if (selectableWordTransliterations[id]) selectableWordTransliterations[id].language = name;
});

const translationReciterNames = {
	1: 'Inggris - Ibrahim Walk (Sahih International)',
	2: 'Urdu - Dr. Farhat Hashmi (Kata per Kata)',
	3: 'Urdu - Shamshad Ali Khan'
};
Object.entries(translationReciterNames).forEach(([id, name]) => {
	if (selectableTranslationReciters[id]) selectableTranslationReciters[id].reciter = name;
});

const tooltipNames = {
	1: 'Tidak Ada',
	2: 'Transliterasi',
	3: 'Terjemah',
	4: 'Keduanya'
};
Object.entries(tooltipNames).forEach(([id, name]) => {
	if (selectableTooltipOptions[id]) selectableTooltipOptions[id].name = name;
});

const versePlayButtonNames = {
	1: 'Putar Audio',
	3: 'Tampilkan Opsi Lanjutan'
};
Object.entries(versePlayButtonNames).forEach(([id, name]) => {
	if (selectableVersePlayButtonOptions[id]) selectableVersePlayButtonOptions[id].name = name;
});

const audioDelayNames = {
	1: 'Tanpa Jeda',
	2: '1 detik',
	3: '3 detik',
	4: '5 detik',
	5: '10 detik',
	6: '15 detik',
	7: 'Sesuai Durasi Audio'
};
Object.entries(audioDelayNames).forEach(([id, name]) => {
	if (selectableAudioDelays[id]) selectableAudioDelays[id].name = name;
});

// Jaring pengaman untuk teks bawaan komponen pihak ketiga atau caption lama
// yang terlewat. Hanya elemen chrome/interaktif yang disentuh agar isi Al Quran,
// terjemahan, tafsir, dan catatan pengguna tidak pernah diubah.
const exactUiText = new Map([
	['Play', 'Putar'],
	['Pause', 'Jeda'],
	['Settings', 'Pengaturan'],
	['Display Type', 'Jenis Tampilan'],
	['Minimal Mode', 'Mode Minimal'],
	['Close', 'Tutup'],
	['Close modal', 'Tutup dialog'],
	['Cancel', 'Batal'],
	['Confirm', 'Konfirmasi'],
	['Got it', 'Mengerti'],
	['Delete', 'Hapus'],
	['Edit', 'Ubah'],
	['Previous Page', 'Halaman Sebelumnya'],
	['Next Page', 'Halaman Berikutnya'],
	['Previous Verse', 'Ayat Sebelumnya'],
	['Next Verse', 'Ayat Berikutnya'],
	['Footnote', 'Catatan Kaki'],
	['Show footnote', 'Tampilkan catatan kaki'],
	['No data available.', 'Data tidak tersedia.'],
	['faq', 'FAQ'],
	['error', 'Kesalahan']
]);

function translateUiValue(value) {
	if (!value) return value;
	const trimmed = value.trim();
	if (exactUiText.has(trimmed)) return value.replace(trimmed, exactUiText.get(trimmed));

	const pageMatch = trimmed.match(/^Page\s+(\d+)$/i);
	if (pageMatch) return value.replace(trimmed, `Halaman ${pageMatch[1]}`);

	return value;
}

function localizeChromeElement(element) {
	if (!(element instanceof Element)) return;

	for (const attribute of ['title', 'aria-label', 'placeholder']) {
		if (element.hasAttribute(attribute)) {
			const current = element.getAttribute(attribute);
			const translated = translateUiValue(current);
			if (translated !== current) element.setAttribute(attribute, translated);
		}
	}

	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let node;
	while ((node = walker.nextNode())) {
		const translated = translateUiValue(node.nodeValue);
		if (translated !== node.nodeValue) node.nodeValue = translated;
	}
}

function installIndonesianUxSafetyNet() {
	if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

	const chromeSelector = 'button, a, label, option, [role="button"], [role="menuitem"], [role="tooltip"], [aria-label], [title], input[placeholder]';
	const apply = (root) => {
		if (!(root instanceof Element || root instanceof Document)) return;
		if (root instanceof Element && root.matches(chromeSelector)) localizeChromeElement(root);
		root.querySelectorAll?.(chromeSelector).forEach(localizeChromeElement);
	};

	const start = () => {
		apply(document);
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'attributes') {
					localizeChromeElement(mutation.target);
					continue;
				}
				mutation.addedNodes.forEach((node) => {
					if (node instanceof Element) apply(node);
				});
			}
		});

		observer.observe(document.documentElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['title', 'aria-label', 'placeholder']
		});
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
	else start();
}

installIndonesianUxSafetyNet();
