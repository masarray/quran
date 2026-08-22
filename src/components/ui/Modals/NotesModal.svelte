<script>
	import Modal from '$ui/FlowbiteSvelte/modal/Modal.svelte';
	import Trash from '$svgs/Trash.svelte';

	import { __verseKey, __userNotes, __notesModalVisible } from '$utils/stores';
	import { buttonClasses } from '$data/commonClasses';
	import { timeAgo } from '$utils/timeAgo';
	import { updateSettings } from '$utils/updateSettings';
	import { getModalTransition } from '$utils/getModalTransition';
	import { showConfirm } from '$utils/confirmationAlertHandler';
	import { getChapterDisplayMeta } from '$utils/chapterLocalization';

	let verseNote,
		noteModifiedAt,
		updateButtonText,
		showDeleteButton = false;

	$: chapter = $__verseKey.split(':')[0];

	$: {
		verseNote = null;
		noteModifiedAt = null;

		if (Object.prototype.hasOwnProperty.call($__userNotes, $__verseKey)) {
			verseNote = $__userNotes[$__verseKey].note;
			noteModifiedAt = timeAgo($__userNotes[$__verseKey].modified_at);
			$__notesModalVisible;
		}

		if (noteModifiedAt === undefined) {
			noteModifiedAt = 'baru saja';
		}
	}

	$: if ($__notesModalVisible) {
		if (Object.prototype.hasOwnProperty.call($__userNotes, $__verseKey)) {
			updateButtonText = 'Perbarui';
			showDeleteButton = true;
		} else {
			updateButtonText = 'Simpan';
			showDeleteButton = false;
		}
	}

	function updateNote() {
		const notesValue = document.getElementById('notes-value').value;
		updateSettings({
			type: 'userNotes',
			key: $__verseKey,
			value: notesValue,
			set: true
		});
	}

	function resetNote() {
		verseNote = '';
		updateSettings({
			type: 'userNotes',
			key: $__verseKey,
			value: '',
			set: true
		});
	}
</script>

<Modal id="notesModal" bind:open={$__notesModalVisible} transitionParams={getModalTransition('bottom')} size="sm" class="!rounded-b-none md:!rounded-3xl max-h-[90vh] flex flex-col" bodyClass="p-6 flex flex-col min-h-0 overflow-hidden" position="bottom" center outsideclose>
	<h3 class="mb-6 text-xl font-medium flex-shrink-0">
		{getChapterDisplayMeta(chapter).transliteration}, {$__verseKey}
	</h3>

	<div class="flex-1 min-h-0 overflow-y-auto w-full pr-2">
		<textarea id="notes-value" rows="8" value={verseNote} class="block p-2.5 w-full text-sm rounded-3xl bg-transparent border border-theme-accent/20 focus:border-theme-accent focus:ring-theme-accent placeholder:text-theme-accent/50 resize-none" placeholder="Tulis catatan Anda di sini..."></textarea>

		{#if noteModifiedAt !== null}
			<div id="notes-last-modified" class="text-xs mt-4">Diubah {noteModifiedAt}.</div>
		{/if}
	</div>

	<div class="flex flex-row space-x-2 flex-shrink-0 mt-4">
		<button on:click={() => updateNote()} class="w-full {buttonClasses}">{updateButtonText}</button>

		{#if showDeleteButton}
			<button on:click={() => showConfirm('Yakin ingin menghapus catatan ini? Tindakan ini tidak dapat dibatalkan.', 'notesModal', () => resetNote())} class="w-fit {buttonClasses}" aria-label="Hapus catatan">
				<span><Trash size={5} /></span>
			</button>
		{/if}
	</div>
</Modal>
