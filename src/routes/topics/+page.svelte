<script>
	import PageHead from '$misc/PageHead.svelte';
	import Spinner from '$svgs/Spinner.svelte';
	import ArrowUp from '$svgs/ArrowUp.svelte';
	import FullVersesDisplay from '$display/verses/modes/FullVersesDisplay.svelte';
	import { __currentPage, __displayType } from '$utils/stores';
	import { onMount } from 'svelte';
	import { fetchAndCacheJson } from '$utils/fetchData';
	import { cdnStaticDataUrls } from '$data/websiteSettings';
	import { page } from '$app/stores';

	if ([3, 4].includes($__displayType)) $__displayType = 1;

	let allTopics = [];
	let showScrollTop = false;
	let selectedTopicId = null;
	let selectedTopicKeys = '';
	let selectedTopicName = '';
	let isLoading = true;

	const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

	let groupedTopics = {};

	$: {
		groupedTopics = {};
		for (const item of allTopics) {
			const topic = item.topic;
			const firstLetter = topic[0].toUpperCase();
			if (!groupedTopics[firstLetter]) groupedTopics[firstLetter] = [];
			groupedTopics[firstLetter].push(item);
		}
	}

	$: if ($page) {
		const urlParams = new URLSearchParams($page.url.search);
		const topicId = urlParams.get('id');
		if (topicId) {
			selectedTopicId = parseInt(topicId);
			const topic = allTopics.find((item) => item.id === selectedTopicId);
			if (topic) {
				selectedTopicKeys = topic.verses.join(',');
				selectedTopicName = topic.topic;
			}
		} else {
			selectedTopicId = null;
			selectedTopicKeys = '';
			selectedTopicName = '';
		}
	}

	function handleScroll() {
		showScrollTop = window.scrollY > 70;
	}

	onMount(async () => {
		const rawTopics = await fetchAndCacheJson(cdnStaticDataUrls.quranTopics, 'other');

		allTopics = Object.entries(rawTopics).map(([topic, verses], index) => ({
			id: index + 1,
			topic: topic,
			verses: verses
		}));

		isLoading = false;
		window.addEventListener('scroll', handleScroll);

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});

	__currentPage.set('topics');
</script>

<PageHead title="Topik" />

<div class="mx-auto max-w-6xl">
	{#if isLoading}
		<Spinner />
	{:else if selectedTopicId && selectedTopicKeys}
		{@const resultsCount = selectedTopicKeys.split(',').length}
		<div>
			<div class="my-4 text-center text-xs">Menampilkan {resultsCount} hasil untuk topik "{selectedTopicName}".</div>
			<FullVersesDisplay keys={selectedTopicKeys} />
		</div>
	{:else}
		<div class="my-4">
			<div class="mx-auto flex flex-wrap justify-center px-2">
				{#each alphabet as letter}
					<a href="#{letter}" class="ml-1 mt-1 px-2 py-1 rounded-full cursor-pointer no-underline min-w-[2rem] text-center border border-transparent hover:border-theme-accent bg-theme-accent/5">{letter}</a>
				{/each}
			</div>
		</div>

		{#if allTopics.length > 0}
			{#each alphabet as letter}
				<div id={letter} class="py-6 border-b border-theme-accent/20 scroll-mt-4">
					<h2 class="text-xl font-bold mb-4 text-theme-accent">{letter}</h2>
					{#if groupedTopics[letter] && groupedTopics[letter].length > 0}
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
							{#each groupedTopics[letter] as item}
								<a href="?id={item.id}" class="block py-2 rounded-md hover:underline text-left" rel="noopener">
									{item.topic}
									<span class="text-theme-accent">({item.verses.length})</span>
								</a>
							{/each}
						</div>
					{:else}
						<p>Tidak ada topik untuk huruf ini.</p>
					{/if}
				</div>
			{/each}
		{/if}
	{/if}
</div>

{#if showScrollTop && !selectedTopicId}
	<button on:click={() => window.scrollTo({ top: 0, behavior: 'auto' })} class="z-20 fixed bottom-6 right-6 p-3 rounded-full transition-opacity duration-300 bg-theme-bg border-theme-accent/20 border" title="Kembali ke atas" aria-label="Kembali ke atas">
		<ArrowUp size={5} />
	</button>
{/if}
