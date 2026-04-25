import { get } from 'svelte/store';
import { __englishTerminology } from '$utils/stores';

export const englishTerms = {
	true: {
		chapter: 'Chapter',
		chapters: 'Chapters',
		verse: 'Verse',
		verses: 'Verses',
		supplications: 'Supplications',
		tafsir: 'Exegesis',
		tajweed: 'Pronunciation',
		juz: 'Part',
		juzs: 'Parts',
		hizb: 'Division',
		hizbs: 'Divisions',
		meccan: 'Meccan',
		medinan: 'Medinan'
	},
	false: {
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
	}
};

export function term(terminology) {
	const isEnglish = get(__englishTerminology);
	return englishTerms[isEnglish][terminology];
}
