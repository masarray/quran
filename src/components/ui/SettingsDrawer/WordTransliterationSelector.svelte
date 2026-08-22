<script>
	import Radio from '$ui/FlowbiteSvelte/forms/Radio.svelte';
	import { onMount } from 'svelte';
	import { __wordTransliteration, __offlineModeSettings } from '$utils/stores';
	import { selectableWordTransliterations } from '$data/options';
	import { updateSettings } from '$utils/updateSettings';
	import { selectedRadioOrCheckboxClasses, individualRadioClasses } from '$data/commonClasses';
	import { isUserOnline } from '$utils/offlineModeHandler';

	$: downloadedWordTransliterations = $__offlineModeSettings?.downloadedDataSettings?.wordTransliterations ?? [];

	let userOnline = false;
	let networkCheckPerformed = false;

	onMount(async () => {
		userOnline = await isUserOnline();
		networkCheckPerformed = true;
	});

	function shouldShowTransliteration(transliterationId) {
		if (userOnline) return true;
		return downloadedWordTransliterations.includes(transliterationId);
	}
</script>

{#if networkCheckPerformed}
	<div class="grid gap-3 w-full">
		{#each Object.entries(selectableWordTransliterations) as [_, translation]}
			{#if shouldShowTransliteration(translation.id)}
				<Radio name="wordTranslation" bind:group={$__wordTransliteration} value={translation.id} on:change={(event) => updateSettings({ type: 'wordTransliteration', value: +event.target.value })} custom>
					<div class="{individualRadioClasses} {$__wordTransliteration === translation.id && selectedRadioOrCheckboxClasses}">
						<div class="w-full">{translation.language}</div>
					</div>
				</Radio>
			{/if}
		{/each}
	</div>

	<div class="text-xs pt-6 opacity-70">Jangan hanya mengandalkan transliterasi untuk membaca Al Quran karena pelafalan dapat menjadi kurang tepat. Untuk memperoleh bacaan yang lebih baik, pelajari membaca Al Quran langsung dalam tulisan Arab.</div>
{/if}
