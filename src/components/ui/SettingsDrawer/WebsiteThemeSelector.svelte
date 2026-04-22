<script>
	import { __websiteTheme } from '$utils/stores';
	import { selectableThemes, themeColors } from '$data/options';
	import { updateSettings } from '$utils/updateSettings';
	import { selectedRadioOrCheckboxClasses, individualRadioClasses } from '$data/commonClasses';

	function applyTheme(themeId, event) {
		event?.preventDefault?.();
		event?.stopPropagation?.();
		updateSettings({ type: 'websiteTheme', value: themeId });
	}
</script>

<div class="grid gap-3 w-full">
	{#each themeColors as color}
		<div class="flex flex-col space-y-2 pb-6">
			<div id="color-name" class="text-md font-medium capitalize">{color}</div>
			<div id="color-list" class="space-y-3">
				{#each Object.entries(selectableThemes) as [_, theme]}
					{#if theme.color === color}
						<button
							type="button"
							class="{individualRadioClasses} w-full text-left {$__websiteTheme === theme.id && selectedRadioOrCheckboxClasses}"
							aria-pressed={$__websiteTheme === theme.id}
							on:click={(event) => applyTheme(theme.id, event)}
						>
							<div class="w-full">{theme.name}</div>
						</button>
					{/if}
				{/each}
			</div>
		</div>
	{/each}
</div>
