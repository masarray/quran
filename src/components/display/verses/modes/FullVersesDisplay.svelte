<script>
	export let keys, startIndex, endIndex;

	import Spinner from '$svgs/Spinner.svelte';
	import WordByWord from '$display/layouts/WordByWord.svelte';
	import Normal from '$display/layouts/Normal.svelte';
	import SideBySide from '$display/layouts/SideBySide.svelte';
	import TranslationTransliteration from '$display/layouts/TranslationTransliteration.svelte';
	import Bismillah from '$misc/Bismillah.svelte';
	import ChapterHeader from '$misc/ChapterHeader.svelte';
	import ErrorLoadingData from '$misc/ErrorLoadingData.svelte';
	import { __displayType, __fontType, __wordTranslation, __wordTransliteration, __currentPage, __keysToFetch, __pageURL, __fullVersesDisplayKeys } from '$utils/stores';
	import { buttonClasses } from '$data/commonClasses';
	import { fetchChapterData } from '$utils/fetchData';
	import { isValidVerseKey } from '$utils/validateKey';
	import { goto } from '$app/navigation';
	import { inview } from 'svelte-inview';
	import { term } from '$utils/terminologies';
	import { selectableDisplays } from '$data/options';

	$: $__keysToFetch = keys;
	$__fullVersesDisplayKeys = keys;

	const displayComponents = {
		1: { component: WordByWord },
		2: { component: Normal },
		5: { component: SideBySide },
		7: { component: TranslationTransliteration }
	};

	const maxIndexesAllowedToRender = 5;
	const loadButtonOptions = {
		rootMargin: '2000px',
		unobserveOnEnter: true
	};

	const params = new URLSearchParams(window.location.search);
	let nextVersesProps = {};
	let versesLoadType;
	let keysArray = keys.split(',');
	let keysArrayLength = keysArray.length - 1;
	let keysData = {};
	let nextStartIndex, nextEndIndex;
	let renderedVerses = 0;
	let showLoadPreviousVerseButton = false;
	let showContinueReadingButton = false;
	let dataMap = {};
	let keyToStartWith = null;
	let isLoading = false;
	let fetchError = null;

	$: if (!Object.prototype.hasOwnProperty.call(displayComponents, $__displayType)) {
		$__displayType = 1;
	}

	$: loadPrevNextVerseButtons = `flex ${selectableDisplays[$__displayType].continuous ? 'flex-row-reverse' : 'flex-row'} space-x-4 justify-center`;

	const startKey = params.get('startKey');

	if (typeof startKey === 'string' && startKey.length > 0) {
		try {
			keyToStartWith = params.get('startKey');

			if (isValidVerseKey(keyToStartWith)) {
				const parsedUrl = new URL(window.location.href);
				parsedUrl.searchParams.delete('startKey');
				goto(parsedUrl.toString(), { replaceState: false });
				startIndex = getIndexOfKey(keyToStartWith);
				endIndex = keysArrayLength > maxIndexesAllowedToRender ? startIndex + maxIndexesAllowedToRender : keysArrayLength;

				if (startIndex > 0) showLoadPreviousVerseButton = true;
			}
		} catch (error) {
			console.warn(error);
		}
	}

	if (startIndex === undefined) startIndex = 0;
	if (endIndex === undefined) endIndex = keysArrayLength > maxIndexesAllowedToRender ? startIndex + maxIndexesAllowedToRender : keysArrayLength;
	if (startIndex < 0) startIndex = 0;
	if (endIndex > keysArrayLength) endIndex = keysArrayLength;

	function loadNextVerses() {
		try {
			const lastRenderedId = document.querySelectorAll('.verse')[document.querySelectorAll('.verse').length - 1].id;

			nextStartIndex = findKeyIndices(keys, lastRenderedId, maxIndexesAllowedToRender).startIndex;
			nextEndIndex = findKeyIndices(keys, lastRenderedId, maxIndexesAllowedToRender).endIndex;

			if (nextEndIndex === -1) nextEndIndex = Object.keys(keys).length;
			document.getElementById('loadVersesButton').remove();

			nextVersesProps = {
				keys,
				startIndex: nextStartIndex,
				endIndex: nextEndIndex
			};

			versesLoadType = 'next';
		} catch (error) {
			console.warn(error);
		}
	}

	function findKeyIndices(keyString, key, threshold) {
		let keys = keyString.split(',');
		let keyIndex = keys.indexOf(key);

		if (keyIndex === -1) {
			return { startIndex: -1, endIndex: -1 };
		}

		let startIndex = keyIndex + 1;
		let endIndex = Math.min(keyIndex + threshold, keys.length - 1);
		return { startIndex, endIndex };
	}

	function getIndexOfKey(key, keysString = keys) {
		const keysArray = keysString.split(',');
		let index = keysArray.indexOf(key);
		if (index === -1) index = 0;
		return index;
	}

	function versesRendered() {
		renderedVerses += 1;
		if (renderedVerses === endIndex + 1 - startIndex) showContinueReadingButton = true;
	}

	function gotoPreviousVerse(previousKey) {
		const url = new URL(window.location.href);
		url.searchParams.set('startKey', previousKey);
		goto(url.pathname + url.search, { replaceState: false });
		__pageURL.set(Math.random());
	}

	async function fetchAllChapterData() {
		isLoading = true;
		fetchError = null;

		try {
			const relevantKeys = keysArray.slice(startIndex, endIndex + 1);
			const uniqueChapters = new Set(relevantKeys.map((key) => key.split(':')[0]));
			const chapterFetchPromises = {};
			for (const chapter of uniqueChapters) {
				if (Object.prototype.hasOwnProperty.call(keysData, chapter)) {
					chapterFetchPromises[chapter] = keysData[chapter];
				} else {
					chapterFetchPromises[chapter] = fetchChapterData({ chapter });
				}
			}

			const chapterDataEntries = await Promise.all(
				Object.entries(chapterFetchPromises).map(async ([chapter, promise]) => {
					const data = await promise;
					return [chapter, data];
				})
			);

			const fetchedDataMap = Object.fromEntries(chapterDataEntries);
			relevantKeys.forEach((fullKey) => {
				const chapter = fullKey.split(':')[0];
				dataMap[fullKey] = fetchedDataMap[chapter][fullKey];
			});
		} catch (error) {
			fetchError = error;
			console.warn(error);
		} finally {
			isLoading = false;
		}
	}

	$: if ($__fontType || $__wordTranslation || $__wordTransliteration) {
		fetchAllChapterData();
	}
</script>

{#key dataMap}
	{#if isLoading}
		<Spinner />
	{:else if fetchError}
		<ErrorLoadingData error={fetchError} />
	{:else}
		{#if showLoadPreviousVerseButton}
			{@const currentIndex = getIndexOfKey(keyToStartWith)}
			{@const previousKey = keysArray[currentIndex - 1]}
			{@const currentFirstKey = keysArray[currentIndex]}
			{@const isNextVerseFirst = currentFirstKey && Number(currentFirstKey.split(':')[1]) === 1}

			<div class="{loadPrevNextVerseButtons} {isNextVerseFirst && 'pb-12'}">
				<button class="text-sm {buttonClasses}" on:click={() => __pageURL.set(Math.random())}>Awal {$__currentPage === 'hizb' ? term('hizb') : term('juz')}</button>
				<button class="text-sm {buttonClasses}" on:click={() => gotoPreviousVerse(previousKey)}>Ayat Sebelumnya</button>
			</div>
		{/if}

		{#if Object.keys(dataMap).length === endIndex - startIndex + 1}
			{#each Array.from(Array(endIndex + 1).keys()).slice(startIndex) as index}
				{@const key = keysArray[index]}
				{@const value = dataMap[key]}

				{#if ['juz', 'hizb'].includes($__currentPage) && +key.split(':')[1] === 1}
					{@const chapter = +key.split(':')[0]}
					<div class="mt-4">
						<ChapterHeader {chapter} />
						<Bismillah {chapter} startVerse={+key.split(':')[1]} />
					</div>
				{/if}

				<section use:versesRendered>
					<svelte:component this={displayComponents[$__displayType]?.component} {key} {value} />
				</section>
			{/each}
		{/if}

		{#if showContinueReadingButton}
			{#if endIndex < keysArrayLength && document.getElementById('loadVersesButton') === null}
				<div id="loadVersesButton" class="flex justify-center pt-6 pb-18" use:inview={loadButtonOptions} on:inview_enter={() => document.querySelector('#loadVersesButton > button').click()}>
					<button on:click={loadNextVerses} class="text-sm {buttonClasses}"> Lanjut Baca </button>
				</div>
			{/if}
		{/if}

		{#if versesLoadType === 'next'}
			<svelte:self {...nextVersesProps} />
		{/if}
	{/if}
{/key}
