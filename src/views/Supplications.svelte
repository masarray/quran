<!-- for supplications and duas routes -->
<script>
	import PageHead from '$misc/PageHead.svelte';
	import FullVersesDisplay from '$display/verses/modes/FullVersesDisplay.svelte';
	import { __currentPage } from '$utils/stores';
	import { supplicationsFromQuran } from '$data/quranMeta';

	__currentPage.set('supplications');
</script>

<PageHead title="Doa dalam Al Quran" />

<div id="individual-verses-block">
	<FullVersesDisplay keys={Object.keys(supplicationsFromQuran).toString()} />
</div>
