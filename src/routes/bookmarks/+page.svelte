<script>
	import PageHead from '$misc/PageHead.svelte';
	import FullVersesDisplay from '$display/verses/modes/FullVersesDisplay.svelte';
	import Bookmark from '$svgs/Bookmark.svelte';
	import { __currentPage, __displayType, __userBookmarks } from '$utils/stores';
	import { term } from '$utils/terminologies';

	if ([3, 4].includes($__displayType)) $__displayType = 1;

	__currentPage.set('bookmarks');
</script>

<PageHead title={'Penanda Ayat'} />

<div id="individual-verses-block">
	{#if $__userBookmarks.length === 0}
		<div class="flex flex-row justify-center text-xs md:text-sm opacity-70">
			<span class="leading-relaxed">Belum ada {term('verse').toLowerCase()} yang ditandai. Ketuk ikon <Bookmark classes="inline mt-[-4px] mx-1" /> pada {term('verse').toLowerCase()} yang ingin disimpan agar mudah dibuka kembali nanti.</span>
		</div>
	{:else}
		<FullVersesDisplay keys={$__userBookmarks.toString()} />
	{/if}
</div>
