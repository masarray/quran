<script>
	import Modal from '$ui/FlowbiteSvelte/modal/Modal.svelte';
	import Spinner from '$svgs/Spinner.svelte';
	import ArabicVerseWords from '$display/verses/ArabicVerseWords.svelte';
	import ErrorLoadingData from '$misc/ErrorLoadingData.svelte';
	import { quranMetaData } from '$data/quranMeta';
	import { __tafsirModalVisible, __verseKey, __verseTafsir } from '$utils/stores';
	import { buttonClasses } from '$data/commonClasses';
	import { selectableTafsirs } from '$data/selectableTafsirs';
	import { term } from '$utils/terminologies';
	import { getChapterDisplayMeta } from '$utils/chapterLocalization';
	import { fetchAndCacheJson } from '$utils/fetchData';
	import { tafsirDataUrls } from '$data/websiteSettings';

	let tafsirData;

	$: selectedTafirId = $__verseTafsir || 30;
	$: selectedTafsir = selectableTafsirs[selectedTafirId];
	$: [chapter, verse] = $__verseKey.split(':').map(Number);

	$: {
		if ($__tafsirModalVisible) {
			tafsirData = (async () => {
				return await fetchAndCacheJson(`${tafsirDataUrls[selectedTafsir.url]}/${selectedTafsir.slug}/${chapter}.json`, 'tafsir');
			})();
		}
	}

	$: tafsirTextClasses = `
		flex flex-col space-y-4
		${['Arabic', 'Urdu'].includes(selectedTafsir.language) && 'direction-rtl text-lg'}
		${selectedTafsir.font}
	`;

	$: if ($__tafsirModalVisible && verse) {
		try {
			const tafsirModal = document.getElementById('tafsirModal');
			if (tafsirModal) tafsirModal.getElementsByTagName('div')[1].scrollTop = 0;
		} catch (error) {
			console.warn(error);
		}
	}

	function formatTafsir(text) {
		return text.replace(/\n/g, '<br />'.repeat(selectedTafsir?.brPerNewline || 2));
	}
</script>

<Modal
	bind:open={$__tafsirModalVisible}
	title="{getChapterDisplayMeta(chapter).transliteration}, {chapter}:{verse}"
	id="tafsirModal"
	class="!rounded-b-none md:!rounded-3xl"
	bodyClass="p-6 space-y-4 flex-1 overflow-y-auto overscroll-contain !border-t-0"
	headerClass="flex justify-between items-center p-6 rounded-t-3xl"
	classFooter="rounded-b-3xl flex flex-row justify-between !border-t-0"
	size="lg"
	position="bottom"
	center
	outsideclose
>
	<div class="flex flex-col space-y-4">
		{#key verse}
			{#await tafsirData}
				<Spinner inline={true} />
			{:then data}
				<div class="py-4"><ArabicVerseWords key="{chapter}:{verse}" /></div>

				<div class="text-sm flex flex-col space-y-6">
					<div class="flex flex-col space-y-4">
						<div class={tafsirTextClasses}>
							{#each Object.entries(data.ayahs) as [_, tafsir]}
								{#if tafsir.surah === chapter && tafsir.ayah === verse}
									{@html formatTafsir(tafsir.text)}
								{/if}
							{/each}
						</div>
					</div>
				</div>
			{:catch error}
				<ErrorLoadingData center="false" {error} />
			{/await}
		{/key}
	</div>

	<svelte:fragment slot="footer">
		{#key verse}
			{#await tafsirData then}
				<div class="grid grid-cols-2 gap-4 w-full">
					<button class="text-sm {buttonClasses} {verse > 1 ? 'visible' : 'invisible'} w-fit justify-self-start" on:click={() => (verse = verse - 1)}>{term('verse')} Sebelumnya</button>
					<button class="text-sm {buttonClasses} {verse < quranMetaData[chapter].verses ? 'visible' : 'invisible'} w-fit justify-self-end" on:click={() => (verse = verse + 1)}>{term('verse')} Berikutnya</button>
				</div>
			{/await}
		{/key}
	</svelte:fragment>
</Modal>
