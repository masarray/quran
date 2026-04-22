<script>
	import Bookmark from '$svgs/Bookmark.svelte';
	import BookmarkCard from '$display/BookmarkCard.svelte';
	import ScrollableFadeContainer from '$display/ScrollableFadeContainer.svelte';
	import { __userBookmarks } from '$utils/stores';
	import { cdnStaticDataUrls } from '$data/websiteSettings';
	import { fetchAndCacheJson } from '$utils/fetchData';

	export let cardGridClasses;
	export let cardInnerClasses;

	let fullQuranTextData = null;
	let forceCloseDropdowns = 0;

	$: hasBookmarks = $__userBookmarks.length > 0;

	$: if (hasBookmarks && !fullQuranTextData) {
		loadQuranData();
	}

	async function loadQuranData() {
		try {
			fullQuranTextData = await fetchAndCacheJson(cdnStaticDataUrls.fullQuranUthmani, 'other');
		} catch (error) {
			console.warn(error);
		}
	}

	function handleScroll() {
		forceCloseDropdowns += 1;
	}
</script>

<ScrollableFadeContainer containerId="bookmark-cards" onScrollAction={handleScroll}>
	{#if !hasBookmarks}
<div class="flex flex-row justify-start text-xs md:text-sm opacity-70 px-2">
	<span class="leading-relaxed">
		Belum ada ayat yang disimpan.
		Tandai ayat yang menyentuh hati dengan ikon
		<Bookmark classes="inline mt-[-4px] mx-1" />
		agar mudah dibaca kembali.
	</span>
</div>
	{:else}
		<div>
			<div class="{cardGridClasses} grid-cols-2 md:!grid-cols-4">
				{#each $__userBookmarks as bookmark (bookmark)}
					<BookmarkCard {bookmark} {fullQuranTextData} {cardInnerClasses} forceClose={forceCloseDropdowns} />
				{/each}
			</div>
		</div>
	{/if}
</ScrollableFadeContainer>
