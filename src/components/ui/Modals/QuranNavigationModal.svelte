<script>
	import { base } from '$app/paths';
	import Modal from '$ui/FlowbiteSvelte/modal/Modal.svelte';
	import Input from '$ui/FlowbiteSvelte/forms/Input.svelte';
	import CloseButton from '$ui/FlowbiteSvelte/utils/CloseButton.svelte';
	import Spinner from '$svgs/Spinner.svelte';
	import Search from '$svgs/Search.svelte';
	import { quranMetaData, startPageOfChapters, pageNumberKeys, juzMeta, hizbMeta, mostRead } from '$data/quranMeta';
	import { buttonClasses } from '$data/commonClasses';
	import { __chapterNumber, __pageURL, __currentPage, __pageNumber, __quranNavigationModalVisible, __lastRead, __morphologyKey, __wideWesbiteLayoutEnabled } from '$utils/stores';
	import { inview } from 'svelte-inview';
	import { validateKey } from '$utils/validateKey';
	import { cdnStaticDataUrls } from '$data/websiteSettings';
	import { page } from '$app/stores';
	import { term } from '$utils/terminologies';
	import { getChapterDisplayMeta } from '$utils/chapterLocalization';
	import { getModalTransition } from '$utils/getModalTransition';
	import { fetchAndCacheJson } from '$utils/fetchData';
	import { getWebsiteWidth } from '$utils/getWebsiteWidth';

	// CSS classes
	const linkClasses = 'flex flex-row space-x-2 items-center';
	const linkTextClasses = 'px-4 py-2 rounded-3xl border border-theme-accent/20 hover:bg-theme-accent/5 w-fit text-sm';
	const listItemClasses = 'py-2 px-2 text-sm w-full text-left font-normal rounded-3xl border border-transparent hover:border-theme-accent hover:bg-theme-accent/5';

	let maxChaptersLoaded = false;
	let maxVersesLoaded = false;
	let maxItemsToLoad = 20;
	let maxVersesToLoad = 1;
	let searchedKey = '';
	let placeholder = 'Cari surah, ayat, juz, hizb, atau halaman';
	let verseKeyData;
	let searchResults;
	let morphologyKey = '1:1';

	// Hide the navigation modal when page URL or chapter/page number changes
	$: if ($page.url.href || $__pageURL || $__chapterNumber || $__pageNumber) {
		__quranNavigationModalVisible.set(false);
	}

	// Clear the searched key when the current page changes
	$: if ($__currentPage) {
		searchedKey = '';
	}

	// Get the number of verses in the current chapter
	$: chapterVerses = quranMetaData[$__chapterNumber]?.verses ?? 0;

	// Validate the searched key and fetch search results
	$: (async () => {
		searchResults = await validateKey(searchedKey);
	})();

	// Update the max number of verses to load
	$: {
		maxVersesLoaded = false;
		maxVersesToLoad = Math.min(chapterVerses, maxItemsToLoad);
	}

	// Load verse key data externally to reduce bundle size
	$: if ($__quranNavigationModalVisible || ['mushaf', 'morphology'].includes($__currentPage)) {
		(async () => {
			verseKeyData = await fetchAndCacheJson(cdnStaticDataUrls.verseKeyData, 'other');
		})();
	}

	// Focus the search input box
	$: if ($__quranNavigationModalVisible) {
		setTimeout(() => {
			document.getElementById('searchKey').focus();
		}, 1);
	}

	// Update morphology key for the morphology page
	$: if ($__morphologyKey) {
		morphologyKey = $__morphologyKey.split(':').slice(0, 2).join(':');
	}

	// Load all chapters when necessary
	function loadMaxChapters() {
		if (!maxChaptersLoaded) {
			maxItemsToLoad = 114;
			maxChaptersLoaded = true;
		}
	}

	// Load all verses when necessary
	function loadMaxVerses() {
		if (!maxVersesLoaded) {
			maxVersesToLoad = chapterVerses;
			maxVersesLoaded = true;
		}
	}
</script>

<Modal id="quranNavigationModal" bind:open={$__quranNavigationModalVisible} transitionParams={getModalTransition('top')} title="Navigasi" size="md" class="!rounded-t-none md:!rounded-3xl" bodyClass="md:p-2 !border-t-0" headerClass="hidden" placement="center" position="top" outsideclose>
	<div class={`${getWebsiteWidth($__wideWesbiteLayoutEnabled)} flex flex-col space-y-2 justify-between px-4 py-5 mx-auto`}>
		<!-- search block -->
		<div id="search-block" class="mx-2">
			<div id="navigation-inputs" class="flex flex-col justify-start">
				<div class="flex flex-row w-full h-fit items-center">
					<form on:submit|preventDefault={() => (searchedKey = document.getElementById('searchKey').value)} class="flex flex-row w-full">
						<Input id="searchKey" type="text" bind:value={searchedKey} autocomplete="off" {placeholder} size="md" class="bg-transparent rounded-3xl !text-center pl-10 px-8 placeholder:text-theme-accent/50">
							<Search slot="left" size={7} classes="pl-2 pt-1 {searchedKey.length > 0 && 'hidden'}" />
							<CloseButton slot="right" on:click={() => (searchedKey = '')} class="pr-2 {searchedKey.length === 0 && 'hidden'}" />
						</Input>
					</form>
				</div>

				<!-- instructions -->
				<div id="search-instructions" class="text-xs pt-2 opacity-70 pb-4">
					Masukkan nama {term('chapter').toLowerCase()}, nomor halaman, {term('juz').toLowerCase()}/{term('hizb').toLowerCase()}, atau kunci {term('verse').toLowerCase()}/kata seperti 2:255, 2.286, 18-10, atau 2 1 1.
				</div>

				<!-- suggestions (only for home page) -->
				{#if searchedKey.length === 0 && $__currentPage === 'home'}
					<div id="search-suggestions" class="flex flex-col text-base md:text-lg max-h-64 min-h-64 overflow-y-auto">
						<!-- Last Read -->
						{#if Object.prototype.hasOwnProperty.call($__lastRead, 'chapter')}
							{@const lastReadChapter = $__lastRead.chapter}
							{@const lastReadVerse = $__lastRead.verse}
							<div id="last-read-links" class="py-2 space-y-2">
								<span class="text-xs font-semibold pt-2">Terakhir Dibaca</span>
								<div class={linkClasses}>
									<span>⟶</span>
									<a href="{base}/{lastReadChapter}/{lastReadVerse}" class={linkTextClasses}>{getChapterDisplayMeta(lastReadChapter).transliteration}, {lastReadChapter}:{lastReadVerse}</a>
								</div>
							</div>
						{/if}

						<!-- Suggestions -->
						<div id="suggestions-links" class="py-2 space-y-2">
							<span class="text-xs font-semibold pt-2">Saran</span>
							{#each Object.entries(mostRead) as [_, item]}
								<div class={linkClasses}>
									<span>⟶</span>
									<a href={`${base}${item.url}`} class={linkTextClasses}>{getChapterDisplayMeta(item.chapter).transliteration} ({item.verses})</a>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- results -->
				{#if searchedKey.length > 0}
					<div id="search-results" class="flex flex-col text-base md:text-lg max-h-64 min-h-64 overflow-y-auto">
						{#if searchResults}
							<!-- stuff for current chapter -->
							{#each Object.entries(searchResults) as [key, value]}
								<!-- numbers -->
								{#if $__chapterNumber !== 'mushaf'}
									{#if key === 'verse' && $__currentPage === 'chapter'}
										<div id="current-chapter-links" class="py-2 space-y-2">
											<span class="text-xs font-semibold">{term('chapter')} Saat Ini</span>
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/{$__chapterNumber}?startVerse={value}" class={linkTextClasses}>{term('verse')} {value}</a>
											</div>
										</div>
									{/if}
								{/if}
							{/each}

							<!-- Navigate options/links -->
							<div id="navigate-links" class="py-2 space-y-2">
								<span class="text-xs font-semibold">Navigasi</span>
								{#each Object.entries(searchResults) as [key, value]}
									<!-- numbers -->
									{#if $__currentPage === 'mushaf'}
										{#if key === 'chapter'}
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/page?id={startPageOfChapters[value]}" class={linkTextClasses}>{term('chapter')} {value} ({getChapterDisplayMeta(value).transliteration})</a>
											</div>
										{:else if key === 'page'}
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/page?id={value}" class={linkTextClasses}>Page {value}</a>
											</div>
										{/if}

										<!-- only show results of key-pages if we have loaded the data -->
										{#await verseKeyData then verseKeyData}
											{#if key === 'juz'}
												<div class={linkClasses}>
													<span>⟶</span>
													<a href="{base}/page?id={verseKeyData[juzMeta[value - 1].from].page}" class={linkTextClasses}>{term('juz')} {value}</a>
												</div>
											{:else if key === 'hizb'}
												<div class={linkClasses}>
													<span>⟶</span>
													<a href="{base}/page?id={verseKeyData[hizbMeta[value - 1].from].page}" class={linkTextClasses}>{term('hizb')} {value}</a>
												</div>
											{:else if key === 'key'}
												<div class={linkClasses}>
													<span>⟶</span>
													<a href="{base}/page?id={verseKeyData[value].page}" class={linkTextClasses}>{getChapterDisplayMeta(value.split(':')[0]).transliteration}, {term('verse')} {value.split(':')[1]} (Halaman {verseKeyData[value].page})</a>
												</div>
											{/if}
										{/await}
									{:else if $__chapterNumber !== 'mushaf'}
										{#if key === 'chapter'}
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/{value}" class={linkTextClasses}>{term('chapter')} {value} ({getChapterDisplayMeta(value).transliteration})</a>
											</div>
										{:else if key === 'page'}
											{@const [pageChapter, pageVerse] = pageNumberKeys[value - 1].split(':').map(Number)}
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/{pageChapter}/{pageVerse}" class={linkTextClasses}>Halaman {value} ({getChapterDisplayMeta(pageChapter).transliteration})</a>
											</div>

											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/page?id={value}" class={linkTextClasses}>Halaman Mushaf {value} ({getChapterDisplayMeta(pageNumberKeys[value - 1].split(':')[0]).transliteration})</a>
											</div>
										{:else if key === 'juz'}
											{@const [juzChapter, juzVerse] = juzMeta[value - 1]['from'].split(':').map(Number)}
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/{juzChapter}/{juzVerse}" class={linkTextClasses}>{term('juz')} {value} ({juzMeta[value - 1].name})</a>
											</div>
										{:else if key === 'hizb'}
											{@const [hizbChapter, hizbVerse] = hizbMeta[value - 1]['from'].split(':').map(Number)}
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/{hizbChapter}/{hizbVerse}" class={linkTextClasses}>{term('hizb')} {value}</a>
											</div>
										{:else if key === 'key'}
											{@const [keyChapter, keyVerse] = value.split(':').map(Number)}
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/{keyChapter}/{keyVerse}" class={linkTextClasses}>{getChapterDisplayMeta(keyChapter).transliteration}, {term('verse')} {keyVerse}</a>
											</div>
										{:else if key === 'supplications'}
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/duas#{value}" class={linkTextClasses}>{getChapterDisplayMeta(value.split(':')[0]).transliteration}, {value} ({term('supplications')}) </a>
											</div>
										{/if}
									{/if}

									<!-- word key -->
									{#if key === 'word'}
										<div class={linkClasses}>
											<span>⟶</span>
											<a href="{base}/morphology?word={value}" class={linkTextClasses}>Word {value} Morphology</a>
										</div>
									{/if}

									<!-- chapter names -->
									{#if key === 'chapters' && Object.keys(value).length > 0}
										{#each Object.entries(value) as [key, _value]}
											<div class={linkClasses}>
												<span>⟶</span>
												<a href="{base}/{key}" class={linkTextClasses}>
													{term('chapter')} {getChapterDisplayMeta(+key).transliteration}
													<span class="hidden md:inline-block">({getChapterDisplayMeta(+key).translation})</span>
												</a>
											</div>
										{/each}
									{/if}
								{/each}
							</div>
						{/if}

						<!-- always allow user to search the Quran -->
						{#if searchedKey.length > 0}
							<div id="search-quran" class="py-2 space-y-2">
								<span class="text-xs font-semibold">Cari di Al Quran</span>
								<div class={linkClasses}>
									<span>⟶</span>
									<a href="{base}/search?query={searchedKey}" class={linkTextClasses}>"{searchedKey}"</a>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- chapter and verse selectors -->
		{#if $__currentPage !== 'home'}
			<div id="chapter-and-verses-block" class="flex flex-row space-x-4 !mt-[-0rem] max-h-64 min-h-64 {searchedKey.length > 0 ? 'hidden' : 'block'}">
				<!-- chapter selector -->
				{#if !['morphology'].includes($__currentPage)}
					<div class="flex flex-col py-2 space-y-2 w-full">
						<div class="px-2 pb-2 text-xs font-semibold border-b border-theme-accent/20">{term('chapters')}</div>
						<ul id="navbar-chapter-list" class="grow basis-1/2 overflow-y-scroll">
							{#each { length: maxItemsToLoad } as _, chapter}
								<li>
									<a href={$__currentPage === 'mushaf' ? `${base}/page?id=${startPageOfChapters[chapter + 1]}` : `${base}/${chapter + 1}`}>
										<div class="{listItemClasses} {$__currentPage === 'chapter' ? (chapter + 1 === $__chapterNumber ? `bg-theme-accent/5` : null) : null}">
											{chapter + 1}. {getChapterDisplayMeta(chapter + 1).transliteration}

											{#if $__currentPage === 'chapter'}
												<span class="hidden md:inline-block">({getChapterDisplayMeta(chapter + 1).translation})</span>
											{:else}
												<span>({getChapterDisplayMeta(chapter + 1).translation})</span>
											{/if}
										</div>
									</a>
								</li>
							{/each}
							{#if !maxChaptersLoaded}
								<Spinner size="8" inline={true} />
							{/if}
							<div class="invisible" use:inview on:inview_enter={() => loadMaxChapters()}></div>
						</ul>
					</div>
				{/if}

				<!-- verse selector -->
				{#if $__currentPage === 'chapter'}
					<div class="flex flex-col py-2 space-y-2 w-44">
						<div class="mx-4 pb-2 text-xs font-semibold border-b border-theme-accent/20">{term('verses')}</div>
						<ul id="navbar-verse-list" class="grow basis-1/2 px-2 overflow-y-scroll">
							{#key $__chapterNumber}
								{#each { length: maxVersesToLoad } as _, verse}
									<li>
										<a href="{base}/{$__chapterNumber}?startVerse={verse + 1}">
											<div class={listItemClasses}>{term('verse')} {verse + 1}</div>
										</a>
									</li>
								{/each}
								{#if !maxVersesLoaded && chapterVerses > maxItemsToLoad}
									<Spinner size="8" inline={true} />
								{/if}
							{/key}

							<div class="invisible" use:inview on:inview_enter={() => loadMaxVerses()}></div>
						</ul>
					</div>
				{/if}

				<!-- supplications selector -->
				<!-- {#if $__currentPage === 'supplications'}
					<div class="flex flex-col space-y-2 w-full">
						<div class="px-2 text-sm pb-2 border-b border-theme-accent/20 font-medium">{term('supplications')}</div>
						<ul id="navbar-supplications-list" class="grow basis-1/2 px-2 overflow-y-scroll">
							{#each Object.entries(supplicationsFromQuran) as [key, value]}
								<li>
									<a href="#{key}">
										<div class={listItemClasses}>{quranMetaData[key.split(':')[0]].transliteration}, {key}</div>
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/if} -->

				<!-- words selector -->
				{#if $__currentPage === 'morphology'}
					<div class="flex flex-col space-y-2 w-full">
						<div class="px-2 text-sm pb-2 border-b border-theme-accent/20 font-medium">Words</div>
						{#await verseKeyData then verseKeyData}
							<ul id="navbar-words-list" class="grow basis-1/2 px-2 overflow-y-scroll">
								{#each { length: verseKeyData[morphologyKey].words } as _, word}
									<li>
										<a href="{base}/morphology?word={morphologyKey}:{word + 1}">
											<div class={listItemClasses}>Word {morphologyKey}:{word + 1}</div>
										</a>
									</li>
								{/each}
							</ul>
						{/await}
					</div>
				{/if}
			</div>
		{/if}

		<div class="w-full px-2">
			<button class="w-full {buttonClasses}" on:click={() => __quranNavigationModalVisible.set(false)}>Tutup</button>
		</div>
	</div>
</Modal>
