function defaultArabicFontSize() {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'text-2xl';
	return window.matchMedia('(min-width: 768px)').matches ? 'text-4xl' : 'text-2xl';
}

export const defaultSettings = {
	displaySettings: {
		websiteTheme: 1,
		displayType: 1,
		fontType: 1,
		wordTranslationEnabled: true,
		wordTransliterationEnabled: true,
		wordTooltip: 1,
		wakeLockEnabled: false,
		englishTerminology: false,
		hideNonDuaPart: false,
		wordMorphologyOnClick: false,
		fontSizes: {
			arabicText: defaultArabicFontSize(),
			wordTranslationText: 'text-sm',
			verseTranslationText: 'text-sm'
		},
		wideWesbiteLayoutEnabled: false,
		signLanguageModeEnabled: false,
		homepageLayoutPreferences: {
			extrasPanelVisible: true,
			divisionsActiveTab: 1,
			extrasActiveTab: 1,
			chaptersSortIsAscending: true,
			juzSortIsAscending: true,
			hizbSortIsAscending: true
		}
	},
	translations: {
		word: 4,
		verse_v1: [33],
		tafsir: 30
	},
	transliteration: {
		word: 1
	},
	audioSettings: {
		reciter: 10,
		translationReciter: 1,
		playbackSpeed: 4,
		versePlayButton: 1,
		rememberSettings: true,
		audioType: 'verse',
		audioRange: 'playThisVerse',
		language: 'arabic',
		timesToRepeat: 1,
		repeatType: 'repeatVerse',
		audioDelay: 1,
		savedPlaySettings: {},
		wbwAutoScrollEnabled: true
	},
	quiz: {
		correctAnswers: 0,
		wrongAnswers: 0
	},
	lastRead: {},
	lastReadAuto: {},
	lastReadManual: {},
	readingAnalytics: {
		entries: [],
		lastTrackedVerseKey: null,
		lastTrackedAt: null
	},
	readingMarks: [],
	userBookmarks: [],
	userFavoriteChapters: [],
	userNotes: {},
	chapter: 1,
	offlineModeSettings: {}
};
