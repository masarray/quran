<script>
	import Modal from '$ui/FlowbiteSvelte/modal/Modal.svelte';
	import BookmarkFilled from '$svgs/BookmarkFilled.svelte';
	import Check from '$svgs/Check.svelte';
	import { __readingMarkModalVisible, __readingMarkTarget, __readingMarks } from '$utils/stores';
	import { updateSettings } from '$utils/updateSettings';
	import { getModalTransition } from '$utils/getModalTransition';
	import { getChapterDisplayMeta } from '$utils/chapterLocalization';
	import { readingMarkSlots } from '$utils/readingMarks';

	$: target = $__readingMarkTarget;
	$: targetLabel = target?.chapter ? `${getChapterDisplayMeta(target.chapter).transliteration}, ${target.chapter}:${target.verse}` : '';

	function getExistingMark(slotId) {
		return $__readingMarks.find((mark) => mark.id === slotId);
	}

	function saveToSlot(slotId) {
		if (!target) return;
		updateSettings({
			type: 'readingMark',
			id: slotId,
			value: target
		});
		__readingMarkModalVisible.set(false);
		window.umami?.track('Move Reading Mark');
	}
</script>

<Modal id="readingMarkModal" bind:open={$__readingMarkModalVisible} transitionParams={getModalTransition('bottom')} size="sm" class="!rounded-b-none md:!rounded-3xl max-h-[90vh] flex flex-col" bodyClass="p-6 flex flex-col min-h-0 overflow-hidden" position="bottom" center outsideclose>
	<div class="mb-5 flex items-start gap-3">
		<div class="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-theme-accent/20 bg-theme-accent/10 text-theme-accent">
			<BookmarkFilled size={4} />
		</div>
		<div class="min-w-0">
			<h3 class="text-lg font-semibold text-theme-accent">Pindahkan Penanda Bacaan</h3>
			{#if targetLabel}
				<p class="mt-1 text-xs leading-relaxed opacity-70">Pilih satu slot. Slot yang dipilih akan berpindah ke {targetLabel}.</p>
			{/if}
		</div>
	</div>

	<div class="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
		{#each readingMarkSlots as slot (slot.id)}
			{@const existingMark = getExistingMark(slot.id)}
			<button on:click={() => saveToSlot(slot.id)} class="w-full rounded-xl border border-theme-accent/10 bg-theme-accent/5 px-4 py-3 text-left transition hover:border-theme-accent/30 hover:bg-theme-accent/10">
				<div class="flex items-center justify-between gap-3">
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<span class="text-sm font-semibold">{slot.label}</span>
							{#if existingMark?.chapter === target?.chapter && existingMark?.verse === target?.verse}
								<span class="inline-flex items-center rounded-full border border-theme-accent/20 bg-theme-accent/10 px-2 py-0.5 text-[11px] text-theme-accent">
									<Check size={3} />
								</span>
							{/if}
						</div>
						<div class="mt-1 truncate text-xs opacity-70">
							{#if existingMark}
								Sekarang di {getChapterDisplayMeta(existingMark.chapter).transliteration}, {existingMark.chapter}:{existingMark.verse}
							{:else}
								Belum dipakai
							{/if}
						</div>
					</div>
					<span class="shrink-0 rounded-full border border-theme-accent/20 px-3 py-1 text-[11px] text-theme-accent">
						{existingMark ? 'Pindahkan' : 'Pakai'}
					</span>
				</div>
			</button>
		{/each}
	</div>
</Modal>
