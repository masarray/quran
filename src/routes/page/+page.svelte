<script>
	export let data;

	import Bismillah from '$misc/Bismillah.svelte';
	import ChapterHeader from '$misc/ChapterHeader.svelte';
	import PageHead from '$misc/PageHead.svelte';
	import WordsBlock from '$display/verses/WordsBlock.svelte';
	import Spinner from '$svgs/Spinner.svelte';
	import Minimize from '$svgs/Minimize.svelte';
	import Tooltip from '$ui/FlowbiteSvelte/tooltip/Tooltip.svelte';
	import ErrorLoadingData from '$misc/ErrorLoadingData.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onDestroy } from 'svelte';
	import { __pageNumber, __currentPage, __fontType, __wordTranslation, __mushafPageDivisions, __displayType, __mushafMinimalModeEnabled, __lastRead } from '$utils/stores';
	import { updateSettings } from '$utils/updateSettings';
	import { quranMetaData } from '$data/quranMeta';
	import { selectableFontTypes } from '$data/options';
	import { toggleMushafMinimalMode } from '$utils/toggleMushafMinimalMode';
	import { getMushafWordFontLink } from '$utils/getMushafWordFontLink';
	import { fetchChapterData } from '$utils/fetchData';
	import { getSegmentKeys } from '$utils/getSegmentKeys';
	import { fade } from 'svelte/transition';
	import '$utils/swiped-events.min.js';

	let pageData;
	let startingLine;
	let endingLine;
	let chapters = [];
	let verses = [];
	let lines = [];
	let pageBlock;

	let pageDataStore = {};
	const prefetchedPages = new Set();
	let swipedLeftHandler = null;
	let swipedRightHandler = null;
	let currentLoadId = 0;

	const centeredPageLines = ['1:9', '1:10', '1:11', '1:12', '1:13', '1:14', '1:15', '2:10', '2:11', '2:12', '2:13', '2:14', '2:15', '255:2', '528:9', '534:6', '545:6', '586:1', '593:2', '594:5', '600:10', '602:5', '602:11', '602:15', '603:10', '603:15', '604:4', '604:9', '604:14', '604:15'];

	$: page = +data.id;

	$: if ([2, 3].includes($__fontType)) {
		for (let thisPage = +page - 2; thisPage <= +page + 2; thisPage++) {
			if (thisPage > 0 && thisPage <= 604 && !prefetchedPages.has(thisPage)) {
				prefetchedPages.add(thisPage);
				fetch(getMushafWordFontLink(thisPage));
			}
		}
	}

	$: {
		chapters = [];
		verses = [];
		lines = [];
		pageDataStore = {};

		pageData = (async () => {
			const thisLoadId = ++currentLoadId;
			const data = await fetchVersesByPage(page, selectableFontTypes[$__fontType].id, $__wordTranslation);
			const verseData = data.verses;

			if (thisLoadId !== currentLoadId) return;

			pageDataStore = verseData;
			localStorage.setItem('pageData', JSON.stringify(verseData));

			const firstVerse = Object.keys(verseData)[0];
			startingLine = verseData[firstVerse].words.line[0];

			const lastVerse = Object.keys(verseData)[Object.keys(verseData).length - 1];
			const lastWord = verseData[lastVerse].words.line;
			endingLine = lastWord[lastWord.length - 1];

			for (const key of Object.keys(verseData)) {
				const chapter = +key.split(':')[0];
				if (!chapters.includes(chapter)) chapters.push(chapter);
			}

			chapters.forEach((chapter) => {
				for (let verse = 1; verse <= quranMetaData[chapter].verses; verse++) {
					if (verseData[`${chapter}:${verse}`]) {
						verses.push(verse);
						break;
					}
				}
			});

			chapters.forEach((chapter, index) => {
				lines.push(+verseData[`${chapter}:${verses[index]}`].words.line[0]);
			});

			__mushafPageDivisions.set({
				chapters: chapters,
				juz: verseData[Object.keys(verseData)[0]].meta.juz
			});

			updateSettings({ type: 'lastRead', value: verseData[Object.keys(verseData)[0]].meta });
			return verseData;
		})();

		__pageNumber.set(page);
	}

	async function fetchVersesByPage(page) {
		try {
			const data = await getSegmentKeys('page');
			const keysInPage = data[page];
			const chaptersWithVerses = {};

			keysInPage.split(',').forEach((key) => {
				const [chapter, verse] = key.split(':').map(Number);
				if (!chaptersWithVerses[chapter]) chaptersWithVerses[chapter] = [];
				if (!chaptersWithVerses[chapter].includes(verse)) chaptersWithVerses[chapter].push(verse);
			});

			let stitchedVerses = {};
			const fetchPromises = Object.entries(chaptersWithVerses).map(async ([chapter, verses]) => {
				try {
					const data = await fetchChapterData({ chapter, preventStoreUpdate: true });

					verses.forEach((verse) => {
						const verseKey = `${chapter}:${verse}`;
						if (data[verseKey]) stitchedVerses[verseKey] = data[verseKey];
					});
				} catch (error) {
					console.warn(error);
				}
			});

			await Promise.all(fetchPromises);

			const sortedVerses = Object.keys(stitchedVerses)
				.sort((a, b) => {
					const [chapterA, verseA] = a.split(':').map(Number);
					const [chapterB, verseB] = b.split(':').map(Number);
					return chapterA - chapterB || verseA - verseB;
				})
				.reduce((obj, key) => {
					obj[key] = stitchedVerses[key];
					return obj;
				}, {});

			return { verses: sortedVerses };
		} catch (error) {
			console.warn(error);
			return { verses: {} };
		}
	}

	$: if (pageBlock) {
		if (swipedLeftHandler) pageBlock.removeEventListener('swiped-left', swipedLeftHandler);
		if (swipedRightHandler) pageBlock.removeEventListener('swiped-right', swipedRightHandler);

		swipedLeftHandler = () => goto(`${base}/page?id=${page === 1 ? 1 : page - 1}`, { replaceState: false });
		swipedRightHandler = () => goto(`${base}/page?id=${page === 604 ? 604 : page + 1}`, { replaceState: false });

		pageBlock.addEventListener('swiped-left', swipedLeftHandler);
		pageBlock.addEventListener('swiped-right', swipedRightHandler);
	}

	onDestroy(() => {
		if (pageBlock) {
			if (swipedLeftHandler) pageBlock.removeEventListener('swiped-left', swipedLeftHandler);
			if (swipedRightHandler) pageBlock.removeEventListener('swiped-right', swipedRightHandler);
		}
	});

	$__displayType = 6;
	__currentPage.set('mushaf');
</script>

<PageHead title={`Halaman ${page}`} />

{#await pageData}
	<Spinner />
{:then}
	<div id="page-block" class="text-center text-xl mt-6 mb-14 overflow-x-hidden overflow-y-hidden" in:fade={{ duration: 300 }} bind:this={pageBlock}>
		<div class="space-y-2 mt-2.5">
			{#if Object.prototype.hasOwnProperty.call($__lastRead, 'page')}
				<div class="flex justify-center pb-2 px-4">
					<a
						href={`${base}/page?id=${$__lastRead.page}`}
						class="inline-flex items-center justify-center text-center py-1.5 px-3 text-xs md:text-sm rounded-full border border-theme-accent/10 hover:border-theme-accent/30 bg-theme-accent/5 leading-none whitespace-nowrap"
					>
						<span>Lanjut bacaan terakhir</span>
					</a>
				</div>
			{/if}

			<div class="max-w-3xl md:max-w-[40rem] pb-2 mx-auto text-[5.4vw] md:text-[36px] lg:text-[36px] {+page === 1 ? 'space-y-1' : 'space-y-2'}">
				{#each Array.from(Array(endingLine + 1).keys()).slice(startingLine) as line}
					{#if chapters.length > 0 && lines.includes(line) && verses[lines.indexOf(line)] === 1}
						<div class="flex flex-col my-2">
							<ChapterHeader chapter={chapters[lines.indexOf(line)]} />
							<Bismillah {chapters} {lines} {line} {page} />
						</div>
					{/if}

					<div class="line {line} flex px-2 arabic-font-{$__fontType} {centeredPageLines.includes(`${+page}:${line}`) ? 'justify-center' : 'justify-between'}">
						{#each Object.entries(pageDataStore) as [key, value]}
							<WordsBlock {key} {value} {line} />
						{/each}
					</div>
				{/each}
			</div>

			<div class="max-w-3xl md:max-w-[40rem] mx-auto justify-center text-sm">
				<div class="flex items-center">
					<div class="flex-1 border-t-2 border-theme-accent/20"></div>
					<span class="px-3">{page}</span>
					<div class="flex-1 border-t-2 border-theme-accent/20"></div>
				</div>
			</div>
		</div>
	</div>
{:catch error}
	<ErrorLoadingData {error} />
{/await}

{#if $__mushafMinimalModeEnabled}
	<div class="flex justify-center -mt-12 pb-16">
		<button class="w-fit flex flex-row space-x-2 py-3 px-3 rounded-xl items-center cursor-pointer border border-transparent hover:border-theme-accent bg-theme-accent/5" on:click={toggleMushafMinimalMode} data-umami-event="Mushaf Minimal Mode Button">
			<Minimize size={3} />
		</button>
		<Tooltip arrow={false} type="light" class="z-30 hidden md:block font-normal">Mode Minimal</Tooltip>
	</div>
{/if}
