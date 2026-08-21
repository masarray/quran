<script>
	export let value;

	import CrossSolid from '$svgs/CrossSolid.svelte';
	import Skeleton from '$ui/FlowbiteSvelte/skeleton/Skeleton.svelte';
	import { __currentPage, __verseTranslations, __verseTranslationData, __userSettings } from '$utils/stores';
	import { fetchVerseTranslationData } from '$utils/fetchData';
	import { extractFootnoteMarkers, resolveFootnote } from '$utils/footnotes';
	import { selectableVerseTranslations } from '$data/options';

	$: fontSizes = JSON.parse($__userSettings).displaySettings.fontSizes;
	$: verseTranslationClasses = `verseTranslationText flex flex-col space-y-4 leading-normal ${fontSizes.verseTranslationText}`;

	// Fetch verse translations for pages other than chapter (reactive)
	$: if ($__currentPage !== 'chapter') fetchVerseTranslationData({ reRenderWhenTheseUpdates: $__verseTranslations });

	// Retrieve URL parameters
	const params = new URLSearchParams(window.location.search);
	const searchQuery = params.get('query') === null ? '' : params.get('query');

	// Keep footnote markers compact and visually above the reading baseline without
	// creating a bulky pill that interrupts translation line rhythm.
	const footnoteSupClasses =
		'ml-1 inline-flex min-w-6 h-6 items-center justify-center px-1.5 rounded-full align-super text-[0.58em] leading-none font-semibold cursor-pointer system-font text-theme-accent border border-theme-accent/10 bg-theme-accent/5 transition-colors hover:border-theme-accent/30 hover:bg-theme-accent/10';

	let footnoteId;
	let footnoteChapter;
	let footnoteVerse;
	let footnoteTranslation;
	let footnoteText = 'loading...';
	let footnoteNumber = '...';

	// Toggles a footnote open or closed when its superscript number is clicked
	async function supClick(event) {
		const newFootnoteId = event.getAttribute('foot_note') ?? '';
		const newFootnoteChapter = +event.getAttribute('data-chapter');
		const newFootnoteVerse = +event.getAttribute('data-verse');
		const newFootnoteTranslation = +event.getAttribute('data-translation');
		const parsedFootnoteNumber = Number.parseInt(event.textContent?.trim() ?? '', 10);
		const newFootnoteNumber = Number.isFinite(parsedFootnoteNumber) ? parsedFootnoteNumber : 1;

		const selector = `.footnote-${newFootnoteChapter}-${newFootnoteVerse}-${newFootnoteTranslation}`;
		const footnoteBlock = document.querySelector(selector);
		const isCurrentlyOpen = footnoteBlock?.classList.contains('block') ?? false;
		const isSameFootnote = newFootnoteId === footnoteId && newFootnoteChapter === footnoteChapter && newFootnoteVerse === footnoteVerse && newFootnoteTranslation === footnoteTranslation;

		// Toggle closed if clicking the same open footnote
		if (isCurrentlyOpen && isSameFootnote) {
			hideFootnote(newFootnoteChapter, newFootnoteVerse, newFootnoteTranslation, true);
			return;
		}

		footnoteText = 'loading...';
		footnoteId = newFootnoteId;
		footnoteChapter = newFootnoteChapter;
		footnoteVerse = newFootnoteVerse;
		footnoteTranslation = newFootnoteTranslation;
		footnoteNumber = newFootnoteNumber;

		const verseKey = `${footnoteChapter}:${footnoteVerse}`;
		const verseData = $__verseTranslationData?.[footnoteTranslation]?.[verseKey];
		const footnotes = verseData?.footnotes;
		const markerCount = extractFootnoteMarkers(verseData?.text ?? '').length;
		const resolvedFootnote = resolveFootnote(footnotes, footnoteId, footnoteNumber, { markerCount });
		footnoteText = resolvedFootnote?.content || 'Catatan kaki tidak tersedia.';

		if (!resolvedFootnote) {
			console.warn('[footnote] unresolved footnote', {
				chapter: footnoteChapter,
				verse: footnoteVerse,
				translation: footnoteTranslation,
				footnoteId,
				footnoteNumber,
				markerCount
			});
		}

		window.umami?.track?.('Verse Footnote Button');
	}

	$: {
		if (footnoteId !== undefined) {
			const selector = `.footnote-${footnoteChapter}-${footnoteVerse}-${footnoteTranslation}`;
			const footnoteBlock = document.querySelector(selector);

			if (footnoteBlock) {
				const footnoteBlockNumber = footnoteBlock.querySelector('.footnote-header .title .footnote-number');
				const footnoteBlockText = footnoteBlock.querySelector('.text');

				if (footnoteBlockNumber) footnoteBlockNumber.innerText = footnoteNumber;
				if (footnoteBlockText) footnoteBlockText.innerHTML = footnoteText;
				footnoteBlock.classList.remove('hidden');
				footnoteBlock.classList.add('block');
			}
		}
	}

	// Hides the footnote block for a given chapter, verse, and translation
	// Optionally resets the tracked footnote ID to allow reopening the same footnote
	function hideFootnote(chapter, verse, translation, resetId = false) {
		const selector = `.footnote-${chapter}-${verse}-${translation}`;
		const footnoteBlocks = document.querySelectorAll(selector);

		footnoteBlocks.forEach((element) => {
			element.classList.remove('block');
			element.classList.add('hidden');
		});

		if (resetId) footnoteId = undefined;
	}

	// Determines if a translation is right-to-left based on its ID
	function isTranslationRTL(id) {
		return selectableVerseTranslations[id]?.is_rtl === true;
	}

	// Highlights occurrences of the search query within verse text using bold tags
	function highlightSearchedText(searchQuery, verseText) {
		const regex = new RegExp(`(?<!<[^>]*)\\b(${searchQuery})\\b(?![^<]*>)`, 'gi');
		const result = verseText.replace(regex, (match) => `<b>${match}</b>`);
		return result;
	}

	// Applies search highlighting and injects footnote sup attributes/styles into verse text
	function verseTextModifier(verseText, verseTranslationID) {
		let updatedVerseText = verseText.text;

		// If query parameter was set (from the search page), highlight the query in the verse translation
		if (params.get('query') !== null) {
			updatedVerseText = highlightSearchedText(searchQuery, updatedVerseText);
		}

		updatedVerseText = updatedVerseText.replace(/<sup/g, `<sup onclick='supClick(this)' title='Show footnote' data-chapter='${value.meta.chapter}' data-verse='${value.meta.verse}' data-translation=${verseTranslationID} class='${footnoteSupClasses}'`);
		return updatedVerseText;
	}

	window.supClick = supClick;
</script>

{#if $__verseTranslations.length > 0}
	<div class={verseTranslationClasses} data-fontSize={fontSizes.verseTranslationText}>
		{#if $__verseTranslationData}
			{#each $__verseTranslations as verseTranslationID}
				{@const verseKey = `${value.meta.chapter}:${value.meta.verse}`}
				{#if $__verseTranslationData[verseTranslationID] && $__verseTranslationData[verseTranslationID][verseKey]}
					{@const verseTranslation = $__verseTranslationData[verseTranslationID][verseKey]}
					{@const translationFootnoteClasses = `hidden mx-5 mt-4 mb-4 footnote-block px-4 py-3.5 border border-theme-accent/20 bg-theme-accent/[0.025] rounded-xl footnote-${value.meta.chapter}-${value.meta.verse}-${verseTranslationID}`}

					<div class="flex flex-col print:break-inside-avoid">
						<!-- Translation and inline secondary content share one reading column. -->
						<span class="px-5 {isTranslationRTL(verseTranslationID) && 'direction-rtl'} {selectableVerseTranslations[verseTranslationID].font} break-words">
							{@html verseTextModifier(verseTranslation, verseTranslationID)}
						</span>

						<!-- translation footnotes -->
						<div class={translationFootnoteClasses}>
							<div class="footnote-header flex flex-row items-center justify-between gap-3 text-sm font-medium text-theme-accent">
								<div class="title system-font leading-none">
									<span>Footnote </span>
									<span class="footnote-number">...</span>
								</div>

								<!-- Keep a generous touch target while reducing the visual weight of close. -->
								<button
									on:click={() => hideFootnote(value.meta.chapter, value.meta.verse, verseTranslationID, true)}
									title="Tutup catatan kaki"
									aria-label="Tutup catatan kaki"
									class="-mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-60 transition hover:bg-theme-accent/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-theme-accent/20"
								>
									<CrossSolid size={4} />
								</button>
							</div>
							<div class="text mt-2 text-[0.92em] leading-relaxed opacity-90 {isTranslationRTL(verseTranslationID) && 'direction-rtl'} {selectableVerseTranslations[verseTranslationID].font}">...</div>
						</div>

						<!-- show translaton author name only if more than 1 was selected -->
						{#if $__verseTranslations.length > 1}
							<span class="px-5 opacity-70 text-sm {isTranslationRTL(verseTranslationID) && 'direction-rtl'}">&mdash; {selectableVerseTranslations[verseTranslationID].resource_name}</span>
						{/if}
					</div>
				{/if}
			{/each}
		{:else}
			<Skeleton size="xxl" class="mb-2.5" />
		{/if}
	</div>
{/if}
