export const indonesianTerms = {
	chapter: 'Surah',
	chapters: 'Surah',
	verse: 'Ayat',
	verses: 'Ayat',
	supplications: 'Doa',
	tafsir: 'Tafsir',
	tajweed: 'Tajwid',
	juz: 'Juz',
	juzs: 'Juz',
	hizb: 'Hizb',
	hizbs: 'Hizb',
	meccan: 'Makkiyah',
	medinan: 'Madaniyah'
};

// Kept as a compatibility export for older imports. Both branches intentionally
// resolve to Indonesian because this application is dedicated to Indonesian users.
export const englishTerms = {
	true: indonesianTerms,
	false: indonesianTerms
};

export function term(terminology) {
	return indonesianTerms[terminology];
}
