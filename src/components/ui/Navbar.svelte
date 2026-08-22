<script>
	import Menu from '$svgs/Menu.svelte';
	import Home from '$svgs/Home.svelte';
	import ChevronDown from '$svgs/ChevronDown.svelte';
	import Mecca from '$svgs/Mecca.svelte';
	import Madinah from '$svgs/Madinah.svelte';
	import { quranMetaData } from '$data/quranMeta';
	import { getChapterDisplayMeta } from '$utils/chapterLocalization';
	import { __chapterNumber, __currentPage, __lastRead, __topNavbarVisible, __pageNumber, __morphologyKey, __mushafPageDivisions, __siteNavigationModalVisible, __quranNavigationModalVisible, __wideWesbiteLayoutEnabled, __fullVersesDisplayKeys } from '$utils/stores';
	import { term } from '$utils/terminologies';
	import { getWebsiteWidth } from '$utils/getWebsiteWidth';
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	let lastReadPage;
	let lastReadJuz;
	let navbarChapterName;
	let mushafChapters = [];
	let mushafJuz = '...';
	let mushafChapterInfo = [];

	const pageLabels = {
		home: 'Beranda',
		bookmarks: 'Penanda Ayat',
		search: 'Cari',
		topics: 'Topik',
		morphology: 'Morfologi',
		about: 'Tentang',
		changelog: 'Pembaruan',
		offline: 'Mode Offline',
		'Offline Mode (Beta)': 'Mode Offline (Beta)',
		games: 'Permainan',
		'Tebak Kata': 'Tebak Kata'
	};

	function getPageLabel(pageName) {
		return pageLabels[pageName] || pageName;
	}

	$: navbarClasses = `bg-theme-bg border-b border-theme-accent/20 fixed w-full z-20 top-0 left-0 print:hidden ${$__currentPage === 'home' ? 'hidden' : 'block'}`;
	$: topNavClasses = `
		${getWebsiteWidth($__wideWesbiteLayoutEnabled)}
		${$__topNavbarVisible ? 'block' : 'hidden'} 
		${['chapter', 'mushaf'].includes($__currentPage) && `border-b border-theme-accent/20 `}
		flex flex-row items-center justify-between mx-auto px-4 py-2
	`;

	$: try {
		const lastReadElement = document.getElementById(`${$__lastRead.chapter}:${$__lastRead.verse}`);
		lastReadPage = lastReadElement?.getAttribute('data-page');
		lastReadJuz = lastReadElement?.getAttribute('data-juz');
	} catch (error) {
		console.warn(error);
	}

	$: chapterRevelation = quranMetaData[$__chapterNumber].revelation;

	let RevelationIcon;
	$: revelation = chapterRevelation === 1 ? { termKey: 'meccan', Icon: Mecca } : { termKey: 'medinan', Icon: Madinah };
	$: revelationTerm = term(revelation.termKey);
	$: RevelationIcon = revelation.Icon;

	$: readingProgress = (() => {
		if (!Object.prototype.hasOwnProperty.call($__lastRead, 'chapter')) return 0;

		if ($__currentPage === 'chapter') {
			return ($__lastRead.verse / quranMetaData[$__lastRead.chapter].verses) * 100;
		}

		if ($__fullVersesDisplayKeys?.length) {
			const keys = typeof $__fullVersesDisplayKeys === 'string' ? $__fullVersesDisplayKeys.split(',') : $__fullVersesDisplayKeys;

			const index = keys.findLastIndex((k) => {
				const [kChap, kVerse] = k.split(':').map(Number);
				return kChap < $__lastRead.chapter || (kChap === $__lastRead.chapter && kVerse <= $__lastRead.verse);
			});

			if (index === -1) return 0;
			return ((index + 1) / keys.length) * 100;
		}

		return 0;
	})();

	$: {
		const chapterMeta = getChapterDisplayMeta($__chapterNumber);
		navbarChapterName = chapterMeta.transliteration;

		if (chapterMeta.transliteration !== chapterMeta.translation) {
			navbarChapterName += `<span class="hidden md:inline-block">&nbsp;(${chapterMeta.translation})</span>`;
		}
	}

	$: if ($__mushafPageDivisions?.juz && $__mushafPageDivisions?.chapters) {
		try {
			mushafJuz = `${term('juz')} ${$__mushafPageDivisions.juz}`;
			mushafChapters = Object.values($__mushafPageDivisions.chapters).map((value) => getChapterDisplayMeta(value).transliteration);
			mushafChapterInfo = Object.values($__mushafPageDivisions.chapters).map((chapter) => ({
				name: getChapterDisplayMeta(chapter).transliteration,
				Icon: quranMetaData[chapter].revelation === 1 ? Mecca : Madinah
			}));
		} catch (error) {
			console.warn(error);
		}
	}

	$: juzOrHizbId = Number($page.url.searchParams.get('id')) || 1;
</script>

<nav id="navbar" class={navbarClasses}>
	<div id="top-nav" class={topNavClasses} aria-label="Beranda">
		<a href={`${base}/`} class="flex flex-row items-center p-3 cursor-pointer rounded-3xl border border-transparent hover:border-theme-accent bg-theme-accent/5" aria-label="Beranda">
			<Home />
			<span class="text-xs pl-2 hidden md:block">Beranda</span>
		</a>

		<button class="flex items-center p-3 text-sm w-auto p-2 rounded-3xl border border-transparent hover:border-theme-accent hover:bg-theme-accent/5" on:click={() => __quranNavigationModalVisible.set(true)} data-umami-event="Navbar Navigation Button">
			{#if $__currentPage === 'chapter'}
				{@html navbarChapterName}
				<ChevronDown />
			{/if}

			{#if $__currentPage === 'mushaf'}
				Halaman {$__pageNumber}
				<ChevronDown />
			{/if}

			{#if ['juz', 'hizb'].includes($__currentPage)}
				{term($__currentPage)}
				{juzOrHizbId}
				<ChevronDown />
			{/if}

			{#if $__currentPage === 'supplications'}
				Doa Al-Quran
			{/if}

			{#if !['chapter', 'mushaf', 'supplications', 'juz', 'hizb'].includes($__currentPage)}
				{getPageLabel($__currentPage)}
				{#if $__currentPage === 'morphology'}
					{$__morphologyKey}
				{/if}
			{/if}
		</button>

		<button class="flex flex-row items-center p-3 cursor-pointer rounded-3xl border border-transparent hover:border-theme-accent bg-theme-accent/5" type="button" aria-label="Menu" on:click={() => __siteNavigationModalVisible.set(true)}>
			<span class="text-xs pr-2 hidden md:block">Menu</span>
			<Menu />
		</button>
	</div>

	{#if $__currentPage === 'chapter'}
		<div id="bottom-nav" class={`${getWebsiteWidth($__wideWesbiteLayoutEnabled)} flex flex-row items-center justify-between text-xs mx-auto px-6`}>
			<div id="navbar-bottom-chapter-revalation" class="flex flex-row items-center py-2">
				<span class="py-2 flex flex-row items-center gap-1">
					<svelte:component this={RevelationIcon} />
					{#if !$__topNavbarVisible}
						<span>{@html navbarChapterName}</span>
					{:else}
						{revelationTerm}
					{/if}
				</span>
			</div>
			<div class="flex flex-row items-center py-2">
				<span>{lastReadPage ? `Halaman ${lastReadPage}` : '...'}</span>
				<span class="px-1 opacity-30">&#8226;</span>
				<span>{lastReadJuz ? `${term('juz')} ${lastReadJuz}` : '...'}</span>
			</div>
		</div>
	{/if}

	{#if ['chapter', 'juz', 'hizb'].includes($__currentPage)}
		<div id="progress-bar" class="fixed inset-x-0 z-20 h-1 rounded-r-3xl bg-theme-accent" style="width: {readingProgress}%" />
	{/if}

	{#if $__currentPage === 'mushaf'}
		<div id="bottom-nav" class={`${getWebsiteWidth($__wideWesbiteLayoutEnabled)} flex flex-row items-center justify-between border-t border-theme-accent/20 text-xs mx-auto px-6`}>
			<div class="flex flex-row items-center py-2 truncate">
				{#if !$__topNavbarVisible}
					<span>Halaman {$__pageNumber} -&nbsp;</span>
				{/if}
				<span class="flex items-center">
					{#if mushafChapterInfo.length ?? false}
						{#each mushafChapterInfo as item, i (item.name)}
							<span class="flex items-center gap-1">
								<svelte:component this={item.Icon} />
								{item.name}
							</span>
							{#if i < mushafChapterInfo.length - 1}
								<span class="px-1 opacity-30">&#8226;</span>
							{/if}
						{/each}
					{:else}
						<span>{mushafChapters.join(' / ')}</span>
					{/if}
				</span>
			</div>
			<div class="flex flex-row items-center py-2 truncate">{mushafJuz}</div>
		</div>
	{/if}
</nav>

<div class="{$__currentPage === 'chapter' ? 'pb-8' : 'pb-4'} {$__currentPage === 'home' ? 'hidden' : 'block'}"></div>
