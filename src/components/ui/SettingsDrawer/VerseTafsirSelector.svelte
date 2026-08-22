<script>
	import Radio from '$ui/FlowbiteSvelte/forms/Radio.svelte';
	import { onMount } from 'svelte';
	import { __verseTafsir, __offlineModeSettings } from '$utils/stores';
	import { verseTafsirLanguages, selectableTafsirs } from '$data/selectableTafsirs';
	import { updateSettings } from '$utils/updateSettings';
	import { selectedRadioOrCheckboxClasses, individualRadioClasses } from '$data/commonClasses';
	import { dataUnavailableWhileOfflineMessage, isUserOnline } from '$utils/offlineModeHandler';

	$: downloadedTafsirs = $__offlineModeSettings?.downloadedDataSettings?.tafsirs ?? [];

	let userOnline = false;
	let networkCheckPerformed = false;

	const languageLabels = {
		Albanian: 'Albania',
		Arabic: 'Arab',
		Bangla: 'Bengali',
		English: 'Inggris',
		Russian: 'Rusia',
		Urdu: 'Urdu'
	};

	onMount(async () => {
		userOnline = await isUserOnline();
		networkCheckPerformed = true;
	});

	function shouldShowTafsir(tafsirId) {
		if (userOnline) return true;
		return downloadedTafsirs.includes(tafsirId);
	}

	function localizeLanguage(language) {
		return languageLabels[language] || language;
	}
</script>

{#if networkCheckPerformed}
	<div class="grid gap-3 w-full">
		{#each Object.entries(verseTafsirLanguages) as [_, language]}
			<div class="flex flex-col space-y-2 pb-6">
				<div id="translation-name" class="text-md font-medium">{localizeLanguage(language.language)}</div>
				<div id="translation-list" class="space-y-3">
					{#if userOnline || Object.values(selectableTafsirs).some((tafsir) => tafsir.language === language.language && shouldShowTafsir(tafsir.id))}
						{#each Object.entries(selectableTafsirs) as [_, tafsir]}
							{#if tafsir.language === language.language && shouldShowTafsir(tafsir.id)}
								<div class="flex items-center w-full">
									<Radio name="verseTafsir" bind:group={$__verseTafsir} value={tafsir.id} on:change={(event) => updateSettings({ type: 'verseTafsir', value: +event.target.value })} custom>
										<div class="{individualRadioClasses} {$__verseTafsir === tafsir.id && selectedRadioOrCheckboxClasses}">
											<div class="flex flex-col space-y-2 w-full">
												<span>{tafsir.name}</span>
											</div>
										</div>
									</Radio>
								</div>
							{/if}
						{/each}
					{:else}
						<p class="text-xs opacity-70">{dataUnavailableWhileOfflineMessage}</p>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
