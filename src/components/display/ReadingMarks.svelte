<script>
	import { base } from '$app/paths';
	import BookmarkFilled from '$svgs/BookmarkFilled.svelte';
	import Trash from '$svgs/Trash.svelte';
	import { __readingMarks } from '$utils/stores';
	import { updateSettings } from '$utils/updateSettings';
	import { getChapterDisplayMeta } from '$utils/chapterLocalization';
	import { getReadingMarkLabel } from '$utils/readingMarks';
	import { showConfirm } from '$utils/confirmationAlertHandler';

	export let cardGridClasses;
	export let cardInnerClasses;

	$: hasReadingMarks = $__readingMarks.length > 0;

	function deleteMark(event, mark) {
		event.preventDefault();
		event.stopPropagation();

		showConfirm(`Hapus penanda ${getReadingMarkLabel(mark)}?`, null, () => {
			updateSettings({ type: 'readingMark', id: mark.id, delete: true });
			window.umami?.track('Delete Reading Mark');
		});
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between px-2">
		<div>
			<div class="text-sm font-semibold text-theme-accent">Penanda Bacaan</div>
			<div class="text-xs opacity-70">Slot berpindah ke ayat baru saat dipilih ulang.</div>
		</div>
		{#if hasReadingMarks}
			<div class="rounded-full border border-theme-accent/20 px-3 py-1 text-xs text-theme-accent">{$__readingMarks.length}</div>
		{/if}
	</div>

	{#if !hasReadingMarks}
		<div class="flex flex-row justify-start text-xs md:text-sm opacity-70 px-2">
			<span class="leading-relaxed">
				Belum ada penanda bacaan. Buka menu ayat, lalu pilih
				<span class="font-medium text-theme-accent">Simpan ke Penanda Bacaan</span>
				untuk membuat slot yang bisa dipindahkan.
			</span>
		</div>
	{:else}
		<div class="{cardGridClasses} grid-cols-1 md:!grid-cols-3">
			{#each $__readingMarks as mark (mark.id)}
				{@const chapterMeta = getChapterDisplayMeta(mark.chapter)}
				<a href={`${base}/${mark.chapter}?startVerse=${mark.verse}`} class="relative !justify-start {cardInnerClasses} overflow-hidden">
					<span class="absolute inset-y-4 left-0 w-1 rounded-r-full bg-theme-accent/50"></span>
					<div class="flex min-w-0 flex-1 items-center gap-3 pl-1">
						<div class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-theme-accent/20 bg-theme-accent/10 text-theme-accent">
							<BookmarkFilled size={4} />
						</div>
						<div class="min-w-0">
							<div class="truncate text-sm font-semibold">{getReadingMarkLabel(mark)}</div>
							<div class="mt-1 truncate text-xs opacity-70">{chapterMeta.transliteration}, {mark.chapter}:{mark.verse}</div>
						</div>
					</div>
					<button on:click={(event) => deleteMark(event, mark)} class="ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent opacity-60 transition hover:border-theme-accent/20 hover:bg-theme-accent/10 hover:opacity-100" aria-label="Hapus penanda {getReadingMarkLabel(mark)}">
						<Trash size={4} />
					</button>
				</a>
			{/each}
		</div>
	{/if}
</div>
