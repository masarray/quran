<script>
	import Maximize from '$svgs/Maximize.svelte';
	import Tooltip from '$ui/FlowbiteSvelte/tooltip/Tooltip.svelte';
	import { toggleMushafMinimalMode } from '$utils/toggleMushafMinimalMode';
</script>

<button id="mushafMinimalModeButton" type="button" title="Mode Minimal" class="inline-flex flex-col items-center justify-center px-5 group hover:bg-theme-accent/5" on:click={toggleMushafMinimalMode}>
	<Maximize />
	<span class="sr-only">Mode Minimal</span>
</button>
<Tooltip triggeredBy="#mushafMinimalModeButton" arrow={false} type="light" class="hidden md:block font-normal">Mode Minimal</Tooltip>
