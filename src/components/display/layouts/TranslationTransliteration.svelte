<script>
	export let key, value;

	import VerseOptionButtons from '$display/verses/VerseOptionButtons.svelte';
	import WordsBlock from '$display/verses/WordsBlock.svelte';
	import VerseTranslations from '$display/verses/VerseTranslations.svelte';
	import PageDivider from '$display/verses/PageDivider.svelte';
	import VerseSeparator from '$display/verses/VerseSeparator.svelte';
	import { __userSettings } from '$utils/stores';
	import { readingAnchor } from '$utils/readingAnchor';
	import { updateSettings } from '$utils/updateSettings';
	import { inview } from 'svelte-inview';

	$: lastReadManual = JSON.parse($__userSettings).lastReadManual || {};
	$: isManualLastRead = lastReadManual.chapter === value?.meta?.chapter && lastReadManual.verse === value?.meta?.verse;
</script>

{#if value}
	<!-- show page/juz/hizb number  -->
	<PageDivider {key} />

	<div id={key} class="verse flex flex-col py-8 space-y-8 verse-{value.meta.chapter}-{value.meta.verse}" class:last-read-anchor={isManualLastRead} data-words={value.meta.words} data-page={value.meta.page} data-juz={value.meta.juz} data-hizb={value.meta.hizb} use:readingAnchor={value.meta} use:inview on:inview_enter={() => updateSettings({ type: 'lastRead', value: value.meta })}>
		<VerseOptionButtons {key} {value} />

		<!-- words -->
		<div id="verse-{value.meta.chapter}-{value.meta.verse}-words" class="flex flex-row-reverse flex-wrap hidden">
			<WordsBlock {key} {value} />
		</div>

		<!-- verse translations and transliterations -->
		<VerseTranslations {value} />
	</div>

	<VerseSeparator {key} />
{/if}
