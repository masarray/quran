<script>
	export let data, startVerse, endVerse;

	import PageHead from '$misc/PageHead.svelte';
	import Bismillah from '$misc/Bismillah.svelte';
	import Chapter from '$display/verses/modes/Chapter.svelte';
	import Spinner from '$svgs/Spinner.svelte';
	import ErrorLoadingData from '$misc/ErrorLoadingData.svelte';
	import { parseURL } from '$utils/parseURL';
	import { fetchChapterData, fetchVerseTranslationData } from '$utils/fetchData';
	
	import { selectableDisplays } from '$data/options';
	import { __userSettings, __currentPage, __chapterNumber, __displayType, __fontType, __wordTranslation, __wordTransliteration, __verseTranslations, __firstVerseOnPage, __lastRead } from '$utils/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { term } from '$utils/terminologies';
	import { getChapterDisplayMeta } from '$utils/chapterLocalization';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';

	let chapterData;
	$: effectiveDisplayType = JSON.parse($__userSettings).displaySettings.displayType === 6 ? 1 : JSON.parse($__userSettings).displaySettings.displayType;

	// Fetch verses whenever there's a change in chapter or URL parameters
	$: {
		// Update current chapter number
		__chapterNumber.set(+data.chapter);

		// Parse URL to get the range of verses to load
		[startVerse, endVerse] = parseURL();

		// Fetch chapter data
		chapterData = fetchChapterData({ chapter: $__chapterNumber });

		// Update the first verse on page
		__firstVerseOnPage.set(startVerse);

		// Check for store updates (page URL, display type, font type, word translation, transliteration)
		if ($page.url.href || $__displayType || $__fontType || $__wordTranslation || $__wordTransliteration) {
			// Do nothing except re-run the block
		}
	}

	$: fetchVerseTranslationData({ reRenderWhenTheseUpdates: $__verseTranslations });

	// Match the chapter action chips to the page-divider chip for a consistent visual rhythm.
	$: topActionButtonsClasses = `flex ${selectableDisplays[effectiveDisplayType].continuous ? 'flex-row-reverse' : 'flex-row'} flex-wrap justify-center text-center mx-auto w-full max-w-md mt-6 mb-1 gap-2`;
	$: compactActionClasses = 'inline-flex items-center justify-center text-center py-1.5 px-3 text-xs md:text-sm rounded-full border border-theme-accent/10 hover:border-theme-accent/30 bg-theme-accent/5 leading-none whitespace-nowrap';

	// Function to load the previous verse
	function loadPreviousVerse() {
		const versesOnPage = document.getElementsByClassName('verse');
		const firstVerseOnPage = +versesOnPage[0].id.split(':')[1];
		goto(`?startVerse=${+firstVerseOnPage - 1}`, { replaceState: false });
	}

	__currentPage.set('chapter');
</script>

<PageHead title={`${getChapterDisplayMeta($__chapterNumber).transliteration} (${$__chapterNumber})`} />

{#await chapterData}
	<Spinner />
{:then}
	<div id="chapter-block" in:fade={{ duration: 300 }}>
		<Bismillah {startVerse} />

		<!-- need custom stylings if display type is 3 or 4 - continuous -->
		<div id="verses-block" class={selectableDisplays[effectiveDisplayType].customClasses}>
			<!-- compact top actions -->
			{#if Object.prototype.hasOwnProperty.call($__lastRead, 'chapter') || startVerse > 1}
				<div class={topActionButtonsClasses}>
					{#if Object.prototype.hasOwnProperty.call($__lastRead, 'chapter')}
						<a href={`${base}/${$__lastRead.chapter}?startVerse=${$__lastRead.verse}`} class={compactActionClasses}>Lanjut bacaan terakhir</a>
					{/if}

					{#if startVerse > 1}
						<a href={`${base}/${$__chapterNumber}`} class={compactActionClasses}>Awal {term('chapter')}</a>
						<button on:click={loadPreviousVerse} class={compactActionClasses}>Ayat sebelumnya</button>
					{/if}
				</div>
			{/if}

			<Chapter {startVerse} {endVerse} />
		</div>
	</div>
{:catch error}
	<ErrorLoadingData {error} />
{/await}
