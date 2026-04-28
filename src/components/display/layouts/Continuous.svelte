<script>
	export let key, value;

	import WordsBlock from '$display/verses/WordsBlock.svelte';
	import PageDivider from '$display/verses/PageDivider.svelte';
	import { __userSettings } from '$utils/stores';
	import { updateSettings } from '$utils/updateSettings';
	import { inview } from 'svelte-inview';

	$: lastReadManual = JSON.parse($__userSettings).lastReadManual || {};
	$: isManualLastRead = lastReadManual.chapter === value?.meta?.chapter && lastReadManual.verse === value?.meta?.verse;
</script>

{#if value}
	<!-- show page/juz/hizb number  -->
	<PageDivider {key} />

	<div id={key} class="verse inline py-2 group verse-{value.meta.chapter}-{value.meta.verse}" class:last-read-anchor={isManualLastRead} data-words={value.meta.words} data-page={value.meta.page} data-juz={value.meta.juz} data-hizb={value.meta.hizb} use:inview on:inview_enter={() => updateSettings({ type: 'lastRead', value: value.meta })}>
		<WordsBlock {key} {value} />
	</div>
{/if}
