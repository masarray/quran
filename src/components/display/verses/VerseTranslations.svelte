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

	$: if ($__currentPage !== 'chapter') fetchVerseTranslationData({ reRenderWhenTheseUpdates: $__verseTranslations });

	const params = new URLSearchParams(window.location.search);
	const searchQuery = params.get('query') === null ? '' : params.get('query');

	const footnoteSupClasses =
		'ml-1 relative -top-[0.08em] inline-flex min-w-5 h-5 items-center justify-center px-1 rounded-full align-super text-[0.52em] leading-none font-semibold cursor-pointer system-font text-theme-accent border border-theme-accent/10 bg-theme-accent/5 transition-colors hover:border-theme-accent/30 hover:bg-theme-accent/10';

	let footnoteId;
	let footnoteChapter;
	let footnoteVerse;
	let footnoteTranslation;
	let footnoteText = 'Memuat...';
	let footnoteNumber = '...';

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

		if (isCurrentlyOpen && isSameFootnote) {
			hideFootnote(newFootnoteChapter, newFootnoteVerse, newFootnoteTranslation, true);
			return;
		}

		footnoteText = 'Memuat...';
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

	function hideFootnote(chapter, verse, translation, resetId = false) {
		const selector = `.footnote-${chapter}-${verse}-${translation}`;
		const footnoteBlocks = document.querySelectorAll(selector);

		footnoteBlocks.forEach((element) => {
			element.classList.remove('block');
			element.classList.add('hidden');
		});

		if (resetId) footnoteId = undefined;
	}

	function isTranslationRTL(id) {
		return selectableVerseTranslations[id]?.is_rtl === true;
	}

	function highlightSearchedText(searchQuery, verseText) {
		const regex = new RegExp(`(?<!<[^>]*)\\b(${searchQuery})\\b(?![^<]*>)`, 'gi');
		const result = verseText.replace(regex, (match) => `<b>${match}</b>`);
		return result;
	}

	function verseTextModifier(verseText, verseTranslationID) {
		let updatedVerseText = verseText.text;

		if (params.get('query') !== null) {
			updatedVerseText = highlightSearchedText(searchQuery, updatedVerseText);
		}

		updatedVerseText = updatedVerseText.replace(/<sup/g, `<sup onclick='supClick(this)' title='Tampilkan catatan kaki' data-chapter='${value.meta.chapter}' data-verse='${value.meta.verse}' data-translation=${verseTranslationID} class='${footnoteSupClasses}'`);
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
					{@const translationFootnoteClasses = `hidden mx-5 mt-3.5 mb-4 footnote-block px-4 py-3 border border-theme-accent/15 bg-theme-accent/[0.02] rounded-xl footnote-${value.meta.chapter}-${value.meta.verse}-${verseTranslationID}`}

					<div class="flex flex-col print:break-inside-avoid">
						<span class="px-5 {isTranslationRTL(verseTranslationID) && 'direction-rtl'} {selectableVerseTranslations[verseTranslationID].font} break-words">
							{@html verseTextModifier(verseTranslation, verseTranslationID)}
						</span>

						<div class={translationFootnoteClasses}>
							<div class="footnote-header flex flex-row items-center justify-between gap-3 text-sm font-medium text-theme-accent">
								<div class="title system-font leading-none">
									<span>Catatan Kaki </span>
									<span class="footnote-number">...</span>
								</div>

								<button
									on:click={() => hideFootnote(value.meta.chapter, value.meta.verse, verseTranslationID, true)}
									title="Tutup catatan kaki"
									aria-label="Tutup catatan kaki"
									class="-mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-55 transition hover:bg-theme-accent/5 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-theme-accent/20"
								>
									<CrossSolid size={4} />
								</button>
							</div>
							<div class="text mt-1.5 text-[0.92em] leading-relaxed opacity-90 {isTranslationRTL(verseTranslationID) && 'direction-rtl'} {selectableVerseTranslations[verseTranslationID].font}">...</div>
						</div>

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
