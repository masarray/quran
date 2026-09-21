<script>
	import PageHead from '$misc/PageHead.svelte';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import Download from '$svgs/Download.svelte';
	import Trash from '$svgs/Trash.svelte';
	import Refresh from '$svgs/Refresh.svelte';
	import Info from '$svgs/Info.svelte';
	import { __currentPage, __offlineModeSettings, __verseTafsir, __fontType, __wordTranslation, __wordTransliteration, __verseTranslations } from '$utils/stores';
	import { buttonClasses, disabledClasses } from '$data/commonClasses';
	import { registerServiceWorker, checkOnlineAndAlert, cacheUrlWithServiceWorker, deleteServiceWorkerCache, inspectOfflineCacheHealth, disableHiddenOfflineCaching } from '$utils/offlineModeHandler';
	import { updateSettings } from '$utils/updateSettings';
	import { showConfirm, showAlert } from '$utils/confirmationAlertHandler';
	import { fetchChapterData, fetchVerseTranslationData, fetchAndCacheJson } from '$utils/fetchData';
	import { staticEndpoint, chapterHeaderFontLink, cdnStaticDataUrls, bismillahFonts, morphologyDataUrls, tafsirDataUrls } from '$data/websiteSettings';
	import { getMushafWordFontLink, isIOSorMac } from '$utils/getMushafWordFontLink';
	import { term } from '$utils/terminologies';
	import { selectableTafsirs } from '$data/selectableTafsirs';
	import { clearDexieTable, getDexieTableCount } from '$utils/dexie';
	import { ensureStorageCapacity, isQuotaExceededError } from '$utils/storageHealth';
	import { clearMushafFieldDiagnostics, readMushafFieldDiagnostics } from '$utils/mushafFontFieldDiagnostics';

	const errorAlertMessage = 'Terjadi kesalahan. Silakan coba lagi beberapa saat lagi.';
	const mismatchMessage = 'Pengaturan telah berubah. Unduh ulang agar akses offline tetap bekerja dengan benar.';

	const totalChapters = 114;
	const totalPages = 604;

	let isRegistering = false;
	let isDownloadingChapter = false;
	let isDownloadingMushaf = false;
	let isDownloadingMorphology = false;
	let isDownloadingTafsir = false;
	let downloadProgressPercentage = 0;
	let fieldDiagnostics = null;

	$: adaptiveModeLabel =
		({
			recovery: 'Pemulihan',
			cautious: 'Hemat',
			balanced: 'Seimbang',
			fast: 'Cepat'
		}[fieldDiagnostics?.profile?.adaptiveMode] || 'Seimbang');
	$: recentSuccessPercent = (() => {
		const outcomes = fieldDiagnostics?.profile?.recentOutcomes;
		if (!Array.isArray(outcomes) || outcomes.length === 0) return null;
		return Math.round((outcomes.filter((value) => value === 1).length / outcomes.length) * 100);
	})();
	$: learnedLatency = Number.isFinite(fieldDiagnostics?.profile?.ewmaLatencyMs)
		? fieldDiagnostics.profile.ewmaLatencyMs < 1000
			? `${fieldDiagnostics.profile.ewmaLatencyMs} ms`
			: `${(fieldDiagnostics.profile.ewmaLatencyMs / 1000).toFixed(1)} dtk`
		: null;

	ensureOfflineSettingsStructure('serviceWorker');
	ensureOfflineSettingsStructure('chapterData');
	ensureOfflineSettingsStructure('mushafData');
	ensureOfflineSettingsStructure('morphologyData');
	ensureOfflineSettingsStructure('tafsirData');
	ensureOfflineSettingsStructure('downloadedDataSettings', {
		fontTypes: [],
		wordTranslations: [],
		wordTransliterations: [],
		verseTranslations: [],
		tafsirs: []
	});

	$: offlineModeSettings = $__offlineModeSettings;
	$: isServiceWorkerRegistered = offlineModeSettings?.serviceWorker?.downloaded ?? false;
	$: isChapterDataDownloaded = offlineModeSettings?.chapterData?.downloaded ?? false;
	$: isMushafDataDownloaded = offlineModeSettings?.mushafData?.downloaded ?? false;
	$: isMorphologyDataDownloaded = offlineModeSettings?.morphologyData?.downloaded ?? false;
	$: isTafsirDataDownloaded = offlineModeSettings?.tafsirData?.downloaded ?? false;
	$: isDownloading = isRegistering || isDownloadingChapter || isDownloadingMushaf || isDownloadingMorphology || isDownloadingTafsir;
	$: mismatchStatus = getOfflineSettingsMismatch($__fontType, $__wordTranslation, $__wordTransliteration, $__verseTranslations, $__verseTafsir, $__offlineModeSettings);
	$: hasTafsirMismatch = mismatchStatus.verseTafsir;

	$: dataSections = [
		{
			id: 'chapterData',
			title: `Data ${term('chapter')}`,
			dataSizeInMB: 20,
			description: `Berkas ini menyimpan data teks Al Quran agar seluruh 114 ${term('chapters')} dapat dibaca secara offline. Konten mengikuti pengaturan bacaan yang dipilih, seperti terjemah dan transliterasi. Berkas font khusus Mushaf tidak termasuk dan perlu diunduh secara terpisah.`,
			isDataDownloaded: isChapterDataDownloaded,
			isDownloading: isDownloadingChapter,
			showMismatchBanner: false,
			onDownload: handleDownloadChaptersData,
			onDelete: () => handleDeleteSpecificData('quranwbw-chapter-data', 'chapterData'),
			onRedownload: () => handleRedownloadData('chapterData')
		},
		{
			id: 'mushafData',
			title: 'Data Mushaf',
			dataSizeInMB: 60,
			description: 'Berkas ini memungkinkan tampilan Mushaf per halaman dibuka secara offline. Seluruh 604 halaman, berkas font yang diperlukan, dan teks Mushaf akan disimpan.',
			isDataDownloaded: isMushafDataDownloaded,
			isDownloading: isDownloadingMushaf,
			showMismatchBanner: false,
			onDownload: handleDownloadMushafData,
			onDelete: () => handleDeleteSpecificData('quranwbw-mushaf-data', 'mushafData'),
			onRedownload: () => handleRedownloadData('mushafData'),
			isSectionDisabled: () => isIOSorMac()
		},
		{
			id: 'morphologyData',
			title: 'Data Morfologi',
			dataSizeInMB: 90,
			description: 'Berkas ini memungkinkan informasi kata terperinci pada bagian Morfologi dibuka secara offline, termasuk makna kata, akar kata, bentuk kata kerja, dan kata terkait di seluruh Al Quran.',
			isDataDownloaded: isMorphologyDataDownloaded,
			isDownloading: isDownloadingMorphology,
			showMismatchBanner: false,
			onDownload: handleDownloadMorphologyData,
			onDelete: () => handleDeleteSpecificData('morphology_data', 'morphologyData'),
			onRedownload: () => handleRedownloadData('morphologyData')
		},
		{
			id: 'tafsirData',
			title: 'Data Tafsir',
			dataSizeInMB: 90,
			description: `Berkas ini memungkinkan ${term('tafsir')} untuk seluruh ${term('chapters')} dibaca secara offline sesuai ${term('tafsir')} yang dipilih di Pengaturan.`,
			isDataDownloaded: isTafsirDataDownloaded,
			isDownloading: isDownloadingTafsir,
			showMismatchBanner: hasTafsirMismatch,
			onDownload: handleDownloadTafsirData,
			onDelete: () => handleDeleteSpecificData('tafsir_data', 'tafsirData'),
			onRedownload: () => handleRedownloadData('tafsirData')
		}
	];


	function ensureOfflineSettingsStructure(key, defaultStructure = { downloaded: false, downloadedAt: null }) {
		if (!$__offlineModeSettings) $__offlineModeSettings = {};
		if (!$__offlineModeSettings[key]) $__offlineModeSettings[key] = { ...defaultStructure };
	}

	function updateOfflineSettingsStructure(key, updates) {
		ensureOfflineSettingsStructure(key);
		offlineModeSettings[key] = {
			...offlineModeSettings[key],
			...updates
		};
		updateSettings({ type: 'offlineModeSettings', value: offlineModeSettings });
	}

	async function reconcileOfflineSettingsWithStorage() {
		try {
			const [cacheHealth, morphologyCount, tafsirCount] = await Promise.all([
				inspectOfflineCacheHealth(),
				getDexieTableCount('morphology_data'),
				getDexieTableCount('tafsir_data')
			]);

			let changed = false;
			const demoteIfMissing = (key, healthy) => {
				if (offlineModeSettings?.[key]?.downloaded && !healthy) {
					offlineModeSettings[key] = {
						...offlineModeSettings[key],
						downloaded: false,
						downloadedAt: null
					};
					changed = true;
				}
			};

			demoteIfMissing('serviceWorker', cacheHealth.coreShellReady && cacheHealth.fontDataCount > 0);
			demoteIfMissing('chapterData', cacheHealth.chapterDataCount >= totalChapters);
			demoteIfMissing('mushafData', cacheHealth.mushafDataCount >= totalPages);
			demoteIfMissing('morphologyData', morphologyCount >= totalChapters + 4);
			demoteIfMissing('tafsirData', tafsirCount >= totalChapters);

			if (changed) {
				updateSettings({ type: 'offlineModeSettings', value: { ...offlineModeSettings } });
			}
		} catch (error) {
			console.warn('[Offline] Unable to reconcile saved download flags with local storage', error);
		}
	}

	async function prepareOfflineDownload(estimatedSizeMB) {
		if (!(await checkOnlineAndAlert())) return false;

		try {
			const storage = await ensureStorageCapacity(estimatedSizeMB);
			if (storage.persisted === false) {
				console.warn('[Offline] Browser did not grant persistent storage; downloaded data can still be evicted under storage pressure.');
			}
			return true;
		} catch (error) {
			console.warn('[Offline] Storage preflight failed', error);
			showAlert(error?.message || 'Ruang penyimpanan perangkat tidak cukup untuk unduhan ini.', '');
			return false;
		}
	}

	function refreshFieldDiagnostics() {
		fieldDiagnostics = readMushafFieldDiagnostics();
	}

	async function copyFieldDiagnostics() {
		const report = readMushafFieldDiagnostics();
		const content = JSON.stringify(report, null, 2);
		try {
			await navigator.clipboard.writeText(content);
			showAlert('Diagnostik jaringan Mushaf telah disalin. Laporan hanya berisi telemetry teknis lokal tanpa riwayat bacaan, URL, lokasi, SSID, atau IP.', '');
		} catch (error) {
			console.warn('[Diagnostics] Unable to copy Mushaf field report.', error);
			showAlert('Diagnostik belum dapat disalin oleh browser ini.', '');
		}
	}

	function resetFieldDiagnostics() {
		clearMushafFieldDiagnostics();
		refreshFieldDiagnostics();
		showAlert('Diagnostik dan pembelajaran jaringan Mushaf telah direset.', '');
	}

	function showDownloadFailure(error) {
		console.warn(error);
		if (isQuotaExceededError(error)) {
			showAlert('Penyimpanan perangkat penuh atau kuota penyimpanan browser tidak mencukupi. Kosongkan ruang lalu coba lagi.', '');
			return;
		}
		showAlert(errorAlertMessage, '');
	}

	onMount(() => {
		const handleCacheStarted = () => {
			isRegistering = true;
		};
		const handleCacheComplete = () => {
			isRegistering = false;
			updateOfflineSettingsStructure('serviceWorker', {
				downloaded: true,
				downloadedAt: new Date().toISOString()
			});
		};
		const handleCacheFailed = () => {
			isRegistering = false;
			updateOfflineSettingsStructure('serviceWorker', {
				downloaded: false,
				downloadedAt: null
			});
		};

		window.addEventListener('sw-cache-started', handleCacheStarted);
		window.addEventListener('sw-cache-complete', handleCacheComplete);
		window.addEventListener('sw-cache-failed', handleCacheFailed);
		const handleAdaptiveProfile = () => refreshFieldDiagnostics();
		window.addEventListener('mushaf-font-adaptive-profile', handleAdaptiveProfile);
		refreshFieldDiagnostics();
		reconcileOfflineSettingsWithStorage();

		return () => {
			window.removeEventListener('sw-cache-started', handleCacheStarted);
			window.removeEventListener('sw-cache-complete', handleCacheComplete);
			window.removeEventListener('sw-cache-failed', handleCacheFailed);
			window.removeEventListener('mushaf-font-adaptive-profile', handleAdaptiveProfile);
		};
	});

	async function cacheUrlsToCache(urls, cacheName, { concurrency = 4, onProgress = () => {} } = {}) {
		let nextIndex = 0;
		const workerCount = Math.min(concurrency, urls.length);

		const worker = async () => {
			while (nextIndex < urls.length) {
				const index = nextIndex++;
				await cacheUrlWithServiceWorker(urls[index], cacheName);
				onProgress(index + 1, urls.length);
			}
		};

		await Promise.all(Array.from({ length: workerCount }, () => worker()));
	}

	async function deleteSpecificCache(cacheName) {
		if (cacheName.startsWith('quranwbw-')) {
			await deleteServiceWorkerCache(cacheName);
		}

		window.umami?.track(`Delete Specific Cache (${cacheName})`);
	}

	function addDownloadedDataSettings({ fontTypes, wordTranslation, wordTransliteration, verseTranslations, tafsir }) {
		ensureOfflineSettingsStructure('downloadedDataSettings', {
			fontTypes: [],
			wordTranslations: [],
			wordTransliterations: [],
			verseTranslations: [],
			tafsirs: []
		});

		const currentSettings = offlineModeSettings.downloadedDataSettings;
		const mergeArrays = (current, newItems) => {
			const itemsArray = Array.isArray(newItems) ? newItems : [newItems];
			return [...new Set([...current, ...itemsArray])];
		};

		if (fontTypes !== undefined && fontTypes !== null) currentSettings.fontTypes = mergeArrays(currentSettings.fontTypes, fontTypes);
		if (wordTranslation !== undefined && wordTranslation !== null) currentSettings.wordTranslations = mergeArrays(currentSettings.wordTranslations, wordTranslation);
		if (wordTransliteration !== undefined && wordTransliteration !== null) currentSettings.wordTransliterations = mergeArrays(currentSettings.wordTransliterations, wordTransliteration);
		if (verseTranslations !== undefined && verseTranslations !== null) currentSettings.verseTranslations = mergeArrays(currentSettings.verseTranslations, verseTranslations);
		if (tafsir !== undefined && tafsir !== null) currentSettings.tafsirs = mergeArrays(currentSettings.tafsirs, tafsir);

		updateSettings({ type: 'offlineModeSettings', value: offlineModeSettings });
	}

	function updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress) {
		downloadProgressPercentage = Math.round((completedStepsInDownloadProgress / totalStepsInDownloadProgress) * 100);
	}

	async function downloadChapterAndVerseTranslationData({ fontType, wordTranslation, wordTransliteration, verseTranslations }) {
		try {
			const activeFontType = fontType ?? $__fontType;
			const activeWordTranslation = wordTranslation ?? $__wordTranslation;
			const activeWordTransliteration = wordTransliteration ?? $__wordTransliteration;
			const activeVerseTranslations = verseTranslations ?? $__verseTranslations;
			const fontTypeForFetch = Array.isArray(activeFontType) ? activeFontType[0] : activeFontType;

			await fetchChapterData({ chapter: 1, fontType: fontTypeForFetch, preventStoreUpdate: true, requireCacheWrite: true });
			await fetchVerseTranslationData({ preventStoreUpdate: true, requireCacheWrite: true });

			addDownloadedDataSettings({
				fontTypes: activeFontType,
				wordTranslation: activeWordTranslation,
				wordTransliteration: activeWordTransliteration,
				verseTranslations: activeVerseTranslations
			});
		} catch (error) {
			console.warn(error);
			throw error;
		}
	}

	function getOfflineSettingsMismatch(fontType, wordTranslation, wordTransliteration, verseTranslations, verseTafsir, offlineSettings) {
		try {
			const downloadedDataSettings = offlineSettings.downloadedDataSettings;
			if (!downloadedDataSettings) return { fontType: false, wordTranslation: false, wordTransliteration: false, verseTafsir: false, verseTranslations: false };

			const { fontTypes = [], wordTranslations = [], wordTransliterations = [], verseTranslations: downloadedVerseTranslations = [], tafsirs = [] } = downloadedDataSettings;

			return {
				fontType: fontTypes.length > 0 && !fontTypes.includes(fontType),
				wordTranslation: wordTranslations.length > 0 && !wordTranslations.includes(wordTranslation),
				wordTransliteration: wordTransliterations.length > 0 && !wordTransliterations.includes(wordTransliteration),
				verseTafsir: tafsirs.length > 0 && !tafsirs.includes(verseTafsir),
				verseTranslations: downloadedVerseTranslations.length > 0 && Array.isArray(verseTranslations) && verseTranslations.some((t) => !downloadedVerseTranslations.includes(t))
			};
		} catch (error) {
			console.warn(error);
			return { fontType: false, wordTranslation: false, wordTransliteration: false, verseTafsir: false, verseTranslations: false };
		}
	}

	async function ensureCoreDataDownloaded(onProgress = () => {}) {
		if (isServiceWorkerRegistered) return;

		const result = await registerServiceWorker();
		if (!result.success) throw new Error(result.error);
		onProgress();

		await downloadAllCdnStaticData();
		onProgress();

		await downloadAllBismillahFonts();
		onProgress();

		await downloadChapterHeaderFont();
		onProgress();
	}

	async function handleDeleteSpecificData(cacheName, objectName) {
		try {
			await Promise.all([deleteSpecificCache(cacheName), clearDexieTable(cacheName)]);

			updateOfflineSettingsStructure(objectName, {
				downloaded: false,
				downloadedAt: null
			});

			const downloadedDataSettings = offlineModeSettings.downloadedDataSettings;

			switch (objectName) {
				case 'tafsirData': {
					downloadedDataSettings.tafsirs = [];
					break;
				}
				case 'chapterData': {
					if (!isChapterDataDownloaded) {
						downloadedDataSettings.fontTypes = [];
						downloadedDataSettings.wordTranslations = [];
						downloadedDataSettings.wordTransliterations = [];
						downloadedDataSettings.verseTranslations = [];
					}
					break;
				}
				case 'mushafData': {
					downloadedDataSettings.fontTypes = (downloadedDataSettings.fontTypes || []).filter((fontId) => fontId !== 2 && fontId !== 3);
					break;
				}
			}

			await clearDownloadedDataSettingsIfNoOfflineData();
			updateSettings({ type: 'offlineModeSettings', value: offlineModeSettings });
		} catch (error) {
			console.warn(error);
			showAlert(errorAlertMessage, '');
		}
	}

	async function clearDownloadedDataSettingsIfNoOfflineData() {
		try {
			if (!offlineModeSettings?.downloadedDataSettings) return;

			const offlineContentKeys = Object.keys(offlineModeSettings).filter((key) => key !== 'serviceWorker' && key !== 'downloadedDataSettings' && typeof offlineModeSettings[key] === 'object' && Object.prototype.hasOwnProperty.call(offlineModeSettings[key], 'downloaded'));
			const hasAnyContentDownloaded = offlineContentKeys.some((key) => offlineModeSettings[key]?.downloaded === true);
			if (hasAnyContentDownloaded) return;

			await disableHiddenOfflineCaching();
			offlineModeSettings.serviceWorker = {
				downloaded: false,
				downloadedAt: null
			};
			offlineModeSettings.downloadedDataSettings = {
				fontTypes: [],
				wordTranslations: [],
				wordTransliterations: [],
				verseTranslations: [],
				tafsirs: []
			};
			updateSettings({ type: 'offlineModeSettings', value: { ...offlineModeSettings } });
		} catch (error) {
			console.warn(error);
		}
	}

	async function handleRedownloadData(dataType) {
		try {
			switch (dataType) {
				case 'chapterData':
					await handleDeleteSpecificData('quranwbw-chapter-data', 'chapterData');
					await handleDownloadChaptersData();
					break;
				case 'mushafData':
					await handleDeleteSpecificData('quranwbw-mushaf-data', 'mushafData');
					await handleDownloadMushafData();
					break;
				case 'morphologyData':
					await handleDeleteSpecificData('morphology_data', 'morphologyData');
					await handleDownloadMorphologyData();
					break;
				case 'tafsirData':
					await handleDeleteSpecificData('tafsir_data', 'tafsirData');
					await handleDownloadTafsirData();
					break;
			}

			window.umami?.track(`Data Re-download: ${dataType}`);
		} catch (error) {
			console.warn(error);
			showAlert(errorAlertMessage, '');
		} finally {
			window.umami?.track(`Data Re-download: ${dataType}`);
		}
	}

	async function handleDownloadChaptersData() {
		if (!(await prepareOfflineDownload(20))) return;

		isDownloadingChapter = true;
		downloadProgressPercentage = 0;
		ensureOfflineSettingsStructure('chapterData', { downloaded: false, downloadedAt: null });

		try {
			const coreSteps = isServiceWorkerRegistered ? 0 : 4;
			const totalStepsInDownloadProgress = coreSteps + totalChapters + 1;
			let completedStepsInDownloadProgress = 0;

			await ensureCoreDataDownloaded(() => {
				completedStepsInDownloadProgress++;
				updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			});

			const chapterRoutes = Array.from({ length: totalChapters }, (_, i) => `${base}/${i + 1}`);
			await cacheUrlsToCache(chapterRoutes, 'quranwbw-chapter-data', {
				concurrency: 4,
				onProgress: () => {
					completedStepsInDownloadProgress++;
					updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
				}
			});

			await downloadChapterAndVerseTranslationData({});
			completedStepsInDownloadProgress++;
			updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);

			updateOfflineSettingsStructure('chapterData', { downloaded: true, downloadedAt: new Date().toISOString() });
			window.umami?.track('Chapter Data Download');
		} catch (error) {
			showDownloadFailure(error);
		} finally {
			isDownloadingChapter = false;
		}
	}

	async function handleDownloadMushafData() {
		if (!(await prepareOfflineDownload(60))) return;

		isDownloadingMushaf = true;
		downloadProgressPercentage = 0;
		ensureOfflineSettingsStructure('mushafData', { downloaded: false, downloadedAt: null });

		try {
			const coreSteps = isServiceWorkerRegistered ? 0 : 4;
			const totalStepsInDownloadProgress = coreSteps + totalPages + 1;
			let completedStepsInDownloadProgress = 0;

			await ensureCoreDataDownloaded(() => {
				completedStepsInDownloadProgress++;
				updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			});

			const mushafFontUrls = Array.from({ length: totalPages }, (_, index) => getMushafWordFontLink(index + 1));
			await cacheUrlsToCache(mushafFontUrls, 'quranwbw-mushaf-data', {
				concurrency: 4,
				onProgress: () => {
					completedStepsInDownloadProgress++;
					updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
				}
			});

			await downloadChapterAndVerseTranslationData({ fontType: [2, 3] });
			completedStepsInDownloadProgress++;
			updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);

			updateOfflineSettingsStructure('mushafData', { downloaded: true, downloadedAt: new Date().toISOString() });
			window.umami?.track('Mushaf Data Download');
		} catch (error) {
			showDownloadFailure(error);
		} finally {
			isDownloadingMushaf = false;
		}
	}

	async function handleDownloadMorphologyData() {
		if (!(await prepareOfflineDownload(90))) return;

		isDownloadingMorphology = true;
		downloadProgressPercentage = 0;
		ensureOfflineSettingsStructure('morphologyData', { downloaded: false, downloadedAt: null });

		try {
			const coreSteps = isServiceWorkerRegistered ? 0 : 4;
			const totalStepsInDownloadProgress = coreSteps + totalChapters + 4 + 1;
			let completedStepsInDownloadProgress = 0;

			await ensureCoreDataDownloaded(() => {
				completedStepsInDownloadProgress++;
				updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			});

			for (let chapter = 1; chapter <= totalChapters; chapter++) {
				await fetchAndCacheJson(morphologyDataUrls.getWordSummary(chapter), 'morphology', { requireCacheWrite: true });
				completedStepsInDownloadProgress++;
				updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			}

			await fetchAndCacheJson(morphologyDataUrls.wordVerbs, 'morphology', { requireCacheWrite: true });
			completedStepsInDownloadProgress++;
			updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			await fetchAndCacheJson(morphologyDataUrls.wordsWithSameRootKeys, 'morphology', { requireCacheWrite: true });
			completedStepsInDownloadProgress++;
			updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			await fetchAndCacheJson(morphologyDataUrls.wordUthmaniAndRoots, 'morphology', { requireCacheWrite: true });
			completedStepsInDownloadProgress++;
			updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			await fetchAndCacheJson(morphologyDataUrls.exactWordsKeys, 'morphology', { requireCacheWrite: true });
			completedStepsInDownloadProgress++;
			updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			await downloadChapterAndVerseTranslationData({});
			completedStepsInDownloadProgress++;
			updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);

			updateOfflineSettingsStructure('morphologyData', { downloaded: true, downloadedAt: new Date().toISOString() });
			window.umami?.track('Morphology Data Download');
		} catch (error) {
			showDownloadFailure(error);
		} finally {
			isDownloadingMorphology = false;
		}
	}

	async function handleDownloadTafsirData() {
		if (!(await prepareOfflineDownload(90))) return;

		isDownloadingTafsir = true;
		downloadProgressPercentage = 0;
		ensureOfflineSettingsStructure('tafsirData', { downloaded: false, downloadedAt: null });

		try {
			const coreSteps = isServiceWorkerRegistered ? 0 : 4;
			const totalStepsInDownloadProgress = coreSteps + totalChapters;
			let completedStepsInDownloadProgress = 0;

			await ensureCoreDataDownloaded(() => {
				completedStepsInDownloadProgress++;
				updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			});

			const selectedTafirId = $__verseTafsir || 30;
			const selectedTafsir = selectableTafsirs[selectedTafirId];

			for (let chapter = 1; chapter <= totalChapters; chapter++) {
				await fetchAndCacheJson(`${tafsirDataUrls[selectedTafsir.url]}/${selectedTafsir.slug}/${chapter}.json`, 'tafsir', { requireCacheWrite: true });
				completedStepsInDownloadProgress++;
				updateDownloadProgress(completedStepsInDownloadProgress, totalStepsInDownloadProgress);
			}

			addDownloadedDataSettings({ tafsir: selectedTafirId });
			updateOfflineSettingsStructure('tafsirData', { downloaded: true, downloadedAt: new Date().toISOString() });
			window.umami?.track('Tafsir Data Download');
		} catch (error) {
			showDownloadFailure(error);
		} finally {
			isDownloadingTafsir = false;
		}
	}

	async function downloadAllCdnStaticData() {
		try {
			const cachePromises = Object.entries(cdnStaticDataUrls).map(([_, url]) => fetchAndCacheJson(url, 'other', { requireCacheWrite: true }));
			await Promise.all(cachePromises);
			console.log('All CDN static data cached successfully');
		} catch (error) {
			console.warn(error);
			throw error;
		}
	}

	async function downloadAllBismillahFonts() {
		try {
			const fontUrls = Object.values(bismillahFonts).map(({ file, version }) => `${staticEndpoint}/fonts/Extras/bismillah/${file}.woff2?version=${version}`);
			await cacheUrlsToCache(fontUrls, 'quranwbw-font-data', { concurrency: 3 });
			console.log('All bismillah fonts cached successfully');
		} catch (error) {
			console.warn(error);
			throw error;
		}
	}

	async function downloadChapterHeaderFont() {
		try {
			await cacheUrlWithServiceWorker(chapterHeaderFontLink, 'quranwbw-font-data');
			console.log('Chapter header font cached successfully');
		} catch (error) {
			console.warn(error);
			throw error;
		}
	}

	__currentPage.set('offline');
</script>

<PageHead title={'Mode Offline (Beta)'} />

<div class="mx-auto">
	<div class="markdown mx-auto">
		<h3>Mode Offline (Beta)</h3>
		<p>
			Mode offline memungkinkan sebagian fitur Al Quran digunakan tanpa koneksi internet dengan menyimpan data yang diperlukan di perangkat. Fitur ini opsional; data yang tersimpan dapat diperbarui atau dihapus kapan saja. Mengaktifkan mode offline akan mengunduh berkas inti aplikasi, sehingga dapat menggunakan cukup banyak data dan memerlukan waktu, terutama pada koneksi lambat atau data seluler. Sebaiknya gunakan koneksi Wi-Fi yang stabil.
		</p>
	</div>

	<div class="my-6 flex flex-col space-y-4 overflow-auto">
		{#each dataSections as section, index}
			<div class="flex flex-col space-y-2 text-sm {(isDownloading && !section.isDownloading) || (section.isSectionDisabled && section.isSectionDisabled()) ? disabledClasses : ''}">
				<div>
					<span class="text-theme-accent">{section.title}</span>
					<span class="opacity-70"> (~{section.dataSizeInMB} MB)</span>
				</div>

				{#if section.isDataDownloaded && section.showMismatchBanner}
					<div class="mt-4 p-3 rounded-md flex flex-row space-x-1 items-start text-sm bg-theme-accent/5">
						<span class="flex-shrink-0 w-5 h-5 mt-1 md:mt-0.5"><Info /></span>
						<span>{mismatchMessage}</span>
					</div>
				{/if}

				<div class="flex flex-row space-x-8 md:space-x-24 justify-between">
					<div class="text-sm">{section.description}</div>

					<div class="flex flex-row space-x-2">
						{#if section.isDataDownloaded}
							<button class="text-sm space-x-2 h-max whitespace-nowrap {buttonClasses}" on:click={section.onRedownload} disabled={isDownloading} aria-label="Unduh ulang {section.title}">
								{#if section.isDownloading}
									<span>{downloadProgressPercentage}%</span>
								{:else}
									<Refresh size={4} />
								{/if}
							</button>

							<button class="text-sm space-x-2 h-max whitespace-nowrap {buttonClasses}" on:click={() => showConfirm('Yakin ingin menghapus data ini?', '', section.onDelete)} disabled={isDownloading} aria-label="Hapus {section.title}">
								<Trash size={4} />
							</button>
						{:else}
							<button class="text-sm space-x-2 h-max whitespace-nowrap {buttonClasses}" on:click={section.onDownload} disabled={isDownloading} aria-label="Unduh {section.title}">
								{#if section.isDownloading}
									<span>{downloadProgressPercentage}%</span>
								{:else}
									<Download size={4} />
								{/if}
							</button>
						{/if}
					</div>
				</div>
			</div>

			{#if index < dataSections.length - 1}
				<div class="border-b border-theme-accent/20"></div>
			{/if}
		{/each}
	</div>

	<div class="mt-7 border-t border-theme-accent/20 pt-5">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<div class="text-sm text-theme-accent">Diagnostik jaringan Mushaf</div>
				<div class="mt-1 text-xs leading-relaxed opacity-70">
					Mode adaptif: {adaptiveModeLabel}
					{#if fieldDiagnostics?.profile?.sampleCount}
						· {fieldDiagnostics.profile.sampleCount} sampel
					{/if}
					{#if recentSuccessPercent !== null}
						· sukses terbaru {recentSuccessPercent}%
					{/if}
					{#if learnedLatency}
						· latensi ±{learnedLatency}
					{/if}
				</div>
				<div class="mt-1 text-xs opacity-60">Disimpan lokal dan terbatas; tidak mencatat bacaan, URL, lokasi, SSID, atau IP.</div>
			</div>
			<div class="flex items-center gap-2">
				<button class="text-xs h-max whitespace-nowrap {buttonClasses}" on:click={copyFieldDiagnostics}>Salin diagnosis</button>
				<button class="text-xs h-max whitespace-nowrap {buttonClasses}" on:click={() => showConfirm('Reset diagnostik dan pembelajaran jaringan?', 'Riwayat teknis lokal akan dihapus dan mode adaptif kembali ke baseline.', resetFieldDiagnostics)}>
					<Trash size={3.5} />
				</button>
			</div>
		</div>
	</div>
</div>
