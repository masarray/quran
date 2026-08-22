<script>
	import Radio from '$ui/FlowbiteSvelte/forms/Radio.svelte';
	import { onMount } from 'svelte';
	import { __currentPage, __fontType, __offlineModeSettings } from '$utils/stores';
	import { selectableFontTypes, fontTypes } from '$data/options';
	import { updateSettings } from '$utils/updateSettings';
	import { selectedRadioOrCheckboxClasses, individualRadioClasses } from '$data/commonClasses';
	import { dataUnavailableWhileOfflineMessage, isUserOnline } from '$utils/offlineModeHandler';

	$: downloadedFontTypes = $__offlineModeSettings?.downloadedDataSettings?.fontTypes ?? [];

	let userOnline = false;
	let networkCheckPerformed = false;

	onMount(async () => {
		userOnline = await isUserOnline();
		networkCheckPerformed = true;
	});

	function shouldShowFontType(fontType, fontKey) {
		const isAllowedOnPage = !fontType.disallowedInPages.includes($__currentPage);
		if (userOnline) return isAllowedOnPage;

		const isFontDownloaded = downloadedFontTypes.includes(Number(fontKey));
		return isAllowedOnPage && isFontDownloaded;
	}

	function getFontVisibilityStatus(type) {
		const fontsForType = Object.entries(selectableFontTypes).filter(([_, fontType]) => fontType.type === type);
		const pageAllowedFonts = fontsForType.filter(([_, fontType]) => !fontType.disallowedInPages.includes($__currentPage));

		if (pageAllowedFonts.length === 0) return 'not-allowed-on-page';

		const hasVisible = pageAllowedFonts.some(([fontKey, fontType]) => shouldShowFontType(fontType, fontKey));
		if (hasVisible) return 'has-visible';

		return 'offline-not-downloaded';
	}

	function localizeFontGroup(type) {
		if (type === 'Uthmanic') return 'Utsmani';
		if (type === 'Indopak / Nastaleeq') return 'Indopak / Nastaliq';
		return type;
	}
</script>

{#if networkCheckPerformed}
	<div class="grid gap-3 w-full">
		{#each fontTypes as type}
			<div class="flex flex-col space-y-2 pb-6">
				<div id="font-type" class="text-md font-medium capitalize">{localizeFontGroup(type)}</div>
				<div id="font-list" class="space-y-3">
					{#if getFontVisibilityStatus(type) === 'has-visible'}
						{#each Object.entries(selectableFontTypes).sort((a, b) => a[1].displayOrder - b[1].displayOrder) as [fontKey, fontType]}
							{#if fontType.type === type && shouldShowFontType(fontType, fontKey)}
								<Radio name="fontType" bind:group={$__fontType} value={Number(fontKey)} on:change={(event) => updateSettings({ type: 'fontType', value: +event.target.value })} custom>
									<div class="{individualRadioClasses} {$__fontType === Number(fontKey) && selectedRadioOrCheckboxClasses}">
										<div class="w-full">{fontType.font}</div>
									</div>
								</Radio>
							{/if}
						{/each}
					{:else if getFontVisibilityStatus(type) === 'not-allowed-on-page'}
						<p class="text-xs opacity-70">Data tidak tersedia.</p>
					{:else}
						<p class="text-xs opacity-70">{dataUnavailableWhileOfflineMessage}</p>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
