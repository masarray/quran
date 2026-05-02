<script>
	export let key, value;

	import VerseOptionButtons from '$display/verses/VerseOptionButtons.svelte';
	import WordsBlock from '$display/verses/WordsBlock.svelte';
	import VerseTranslations from '$display/verses/VerseTranslations.svelte';
	import PageDivider from '$display/verses/PageDivider.svelte';
	import VerseSeparator from '$display/verses/VerseSeparator.svelte';
	import { readingAnchor } from '$utils/readingAnchor';
	import { updateSettings } from '$utils/updateSettings';
	import { __userSettings, __verseTranslations } from '$utils/stores';
	import { inview } from 'svelte-inview';

	// Use two columns when translations are available, otherwise fall back to one
	$: gridCols = $__verseTranslations.length > 0 ? 'grid-cols-2' : 'grid-cols-1';
	$: lastReadManual = JSON.parse($__userSettings).lastReadManual || {};
	$: isManualLastRead = lastReadManual.chapter === value?.meta?.chapter && lastReadManual.verse === value?.meta?.verse;
</script>

{#if value}
	<!-- show page/juz/hizb number  -->
	<PageDivider {key} />

	<div id={key} class="verse flex flex-col py-8 space-y-8 verse-{value.meta.chapter}-{value.meta.verse}" class:last-read-anchor={isManualLastRead} data-words={value.meta.words} data-page={value.meta.page} data-juz={value.meta.juz} data-hizb={value.meta.hizb} use:readingAnchor={value.meta} use:inview on:inview_enter={() => updateSettings({ type: 'lastRead', value: value.meta })}>
		<VerseOptionButtons {key} {value} />

		<div class="grid {gridCols} gap-x-8">
			<!-- words -->
			<div class="order-last inline direction-rtl">
				<WordsBlock {key} {value} />
			</div>

			<!-- verse translations and transliterations -->
			<VerseTranslations {value} />
		</div>
	</div>

	<VerseSeparator {key} />
{/if}
