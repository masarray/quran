<script>
	export let key, value;

	import { base } from '$app/paths';
	import VerseOptionsDropdown from '$display/verses/VerseOptionsDropdown.svelte';
	import Bookmark from '$svgs/Bookmark.svelte';
	import BookmarkFilled from '$svgs/BookmarkFilled.svelte';
	import BookmarkAdd from '$svgs/BookmarkAdd.svelte';
	import Play from '$svgs/Play.svelte';
	import Pause from '$svgs/Pause.svelte';
	import NotesFilled from '$svgs/NotesFilled.svelte';
	import DotsHorizontal from '$svgs/DotsHorizontal.svelte';
	import Eye from '$svgs/Eye.svelte';
	import Tooltip from '$ui/FlowbiteSvelte/tooltip/Tooltip.svelte';
	import { playVerseAudio, resetAudioSettings, showAudioModal, playButtonHandler, prepareVersesToPlay } from '$utils/audioController';
	import { __currentPage, __userSettings, __audioSettings, __verseKey, __userNotes, __notesModalVisible, __playButtonsFunctionality, __displayType, __verseWordBlocks, __readingMarks, __readingMarkModalVisible, __readingMarkTarget } from '$utils/stores';
	import { updateSettings } from '$utils/updateSettings';
	import { term } from '$utils/terminologies';
	import { getReadingMarkLabel } from '$utils/readingMarks';

	import { getChapterDisplayMeta } from '$utils/chapterLocalization';

	const chapter = parseInt(key.split(':')[0], 10);
	const verse = parseInt(key.split(':')[1], 10);
	const buttonClasses = 'inline-flex items-center justify-center w-10 h-10 transition-colors duration-150 rounded-3xl focus:shadow-outline print:hidden hover:bg-theme-accent/5';

	// For chapter page, just show the key, else show the complete chapter transliteration & key
	$: verseKeyClasses = `${buttonClasses} w-fit px-4 font-medium text-theme-accent border border-transparent hover:border-theme-accent bg-theme-accent/5`;

	// Update userBookmarks whenever the __userSettings changes
	$: userBookmarks = JSON.parse($__userSettings).userBookmarks;
	$: lastReadManual = JSON.parse($__userSettings).lastReadManual || {};
	$: isManualLastRead = lastReadManual.chapter === chapter && lastReadManual.verse === verse;
	$: verseReadingMarks = $__readingMarks.filter((mark) => mark.chapter === chapter && mark.verse === verse);

	async function audioHandler(key) {
		// Stop any audio if something is playing
		if ($__audioSettings.isPlaying) return resetAudioSettings({ location: 'end' });

		// For these pages, perform action depending on the play button functionality set by the user
		if (['chapter', 'mushaf', 'supplications', 'bookmarks', 'juz', 'hizb'].includes($__currentPage)) {
			switch ($__playButtonsFunctionality.verse) {
				case 1:
					prepareVersesToPlay(key);
					playButtonHandler(key);
					break;
				case 2:
					showAudioModal(key);
					break;
				case 3:
					showAudioModal(key);
					break;
				default:
					showAudioModal(key);
					break;
			}
		} else playVerseAudio({ key, language: 'arabic', timesToRepeat: 1 });
	}

	function readingMarkHandler() {
		const verseMeta = value?.meta;
		if (!verseMeta) return;
		__verseKey.set(key);
		__readingMarkTarget.set(verseMeta);
		__readingMarkModalVisible.set(true);
	}

	function wordsBlockToggler(chapter, verse) {
		const key = `${chapter}:${verse}`;
		__verseWordBlocks.update((blocks) => {
			blocks[key] = !blocks[key];
			document.querySelector(`#verse-${chapter}-${verse}-words`).classList.toggle('hidden');
			return blocks;
		});
	}
</script>

<div class="verseButtons flex flex-row justify-between">
	<div class="flex flex-row w-full space-x-2">
		<div class="flex flex-row space-x-2">
			<a href={`${base}/${chapter}?startVerse=${verse}`} class={verseKeyClasses}>
				<div class="text-xs">
					{#if ['chapter', 'juz', 'hizb'].includes($__currentPage)}
						{key}
					{:else}
						{getChapterDisplayMeta(chapter).transliteration}, {key}
					{/if}
				</div>
			</a>
			{#if isManualLastRead}
				<div class="inline-flex items-center rounded-full px-3 text-[11px] font-medium text-theme-accent border border-theme-accent/20 bg-theme-accent/10">Terakhir Dibaca</div>
			{/if}
			{#each verseReadingMarks as mark (mark.id)}
				<div class="hidden md:inline-flex items-center rounded-full px-3 text-[11px] font-medium text-theme-accent border border-theme-accent/20 bg-theme-accent/5">{getReadingMarkLabel(mark)}</div>
			{/each}
			<Tooltip arrow={false} type="light" placement="top" class="z-30 hidden md:block font-normal">{term('verse')} {key}</Tooltip>
		</div>

		<div class="flex flex-row space-x-2">
			<button on:click={() => audioHandler(key)} class={buttonClasses} aria-label="Putar">
				<div><svelte:component this={$__audioSettings.isPlaying && $__audioSettings.playingKey === key ? Pause : Play} size={3.5} /></div>
			</button>
			<Tooltip arrow={false} type="light" placement="top" class="z-30 hidden md:block font-normal">Putar</Tooltip>

			<button on:click={readingMarkHandler} class={buttonClasses} aria-label="Simpan ke Penanda Bacaan" data-umami-event="Reading Mark Fast Button">
				<div><BookmarkAdd size={3.5} /></div>
			</button>
			<Tooltip arrow={false} type="light" placement="top" class="z-30 hidden md:block font-normal">Simpan ke Penanda Bacaan</Tooltip>

			{#if Object.prototype.hasOwnProperty.call($__userNotes, key)}
				<button
					on:click={() => {
						__verseKey.set(key);
						__notesModalVisible.set(true);
					}}
					class={buttonClasses}
					aria-label="Catatan"
				>
					<div><NotesFilled size={3.5} /></div>
				</button>
				<Tooltip arrow={false} type="light" placement="top" class="z-30 hidden md:block font-normal">Catatan</Tooltip>
			{/if}

			{#if userBookmarks.includes(key)}
				<button on:click={() => updateSettings({ type: 'userBookmarks', key, set: true })} class={buttonClasses} aria-label="Penanda Ayat">
					<div><svelte:component this={userBookmarks.includes(key) ? BookmarkFilled : Bookmark} size={3.5} /></div>
				</button>
				<Tooltip arrow={false} type="light" placement="top" class="z-30 hidden md:block font-normal">Penanda Ayat</Tooltip>
			{/if}

			<button id="verse-options-{verse}" class={buttonClasses} aria-label="Pilihan" on:mouseenter={__verseKey.set(key)} on:click={__verseKey.set(key)}>
				<div><DotsHorizontal size={6} /></div>
			</button>
			<VerseOptionsDropdown page={value.meta.page} meta={value.meta} />
			<Tooltip triggeredBy="#verse-options-{verse}" arrow={false} type="light" placement="top" class="z-30 hidden md:block font-normal">Pilihan</Tooltip>
		</div>
	</div>

	{#if $__displayType === 7}
		<div class="flex flex-row">
			<button class={buttonClasses} aria-label="Tampilkan atau sembunyikan kata" on:click={() => wordsBlockToggler(chapter, verse)}>
				<div><Eye /></div>
			</button>
			<Tooltip arrow={false} type="light" placement="top" class="z-30 hidden md:block font-normal">Tampilkan/Sembunyikan Kata</Tooltip>
		</div>
	{/if}
</div>
