<script>
	import Modal from '$ui/FlowbiteSvelte/modal/Modal.svelte';
	import Radio from '$ui/FlowbiteSvelte/forms/Radio.svelte';
	import Checkbox from '$ui/FlowbiteSvelte/forms/Checkbox.svelte';

	import { __verseKey, __copyShareVerseModalVisible, __verseTranslationData } from '$utils/stores';
	import { linkClasses, buttonClasses, selectedRadioOrCheckboxClasses } from '$data/commonClasses';
	import { term } from '$utils/terminologies';
	import { getModalTransition } from '$utils/getModalTransition';
	import { selectableVerseTranslations } from '$data/options';
	import { getChapterDisplayMeta } from '$utils/chapterLocalization';

	const radioClasses = 'inline-flex justify-between items-center py-2 px-4 w-full bg-theme-bg rounded-lg border-2 border-theme-accent/20 cursor-pointer peer-checked:border-2 peer-checked:border-theme-accent hover:bg-theme-accent/5';

	let copyType = 1;
	let textType = 1;
	let includeKey = true;
	let includeTranslationNames = true;
	let includeFootNotes = false;
	let includeLink = true;
	let generatedVerseData = '';
	let websiteLink = '';

	$: [chapter, verse] = $__verseKey.split(':').map(Number);
	$: websiteLink = `https://quranwbw.com/${chapter}/${verse}`;
	$: if ($__copyShareVerseModalVisible || $__verseKey || copyType || textType || includeKey || includeTranslationNames || includeFootNotes || includeLink) generatedVerseData = '';

	function getVerseArabicText(key) {
		try {
			const [chapter, verse] = key.split(':').map(Number);
			const words = document.querySelectorAll(`.verse-${chapter}-${verse} .arabicText`);
			let wordsArray = [];
			words.forEach((word) => wordsArray.push(word.innerText));
			return wordsArray.join(' ');
		} catch (error) {
			console.warn(error);
			return key;
		}
	}

	function getVerseTranslationText(key, includeTranslationNames = true, includeFootnotes = true) {
		const allTranslations = [];
		let output = '';
		let footnoteCounter = 1;
		const allFootnotes = [];

		for (const translationId in $__verseTranslationData) {
			const translation = $__verseTranslationData[translationId];
			if (translation && translation[key]) {
				allTranslations.push({
					translationId,
					authorName: selectableVerseTranslations[translationId].resource_name,
					text: translation[key].text,
					footnotes: translation[key].footnotes || null
				});
			}
		}

		for (const entry of allTranslations) {
			let text = entry.text.replace(/<sup[^>]*?>\d+<\/sup>/g, () => `[${footnoteCounter++}]`);
			text = text.replace(/<[^>]+>/g, '');
			output += text;

			if (includeTranslationNames) output += `\n— ${entry.authorName}`;
			output += `\n\n`;

			if (includeFootnotes && entry.footnotes) {
				for (const footnote of entry.footnotes) {
					const cleanFootnote = footnote.replace(/<[^>]+>/g, '').trim();
					output += `[${allFootnotes.length + 1}] ${cleanFootnote}\n\n`;
					allFootnotes.push(cleanFootnote);
				}
			}
		}

		return output.trim();
	}

	function advancedCopy(key, textType, includeKey, includeTranslationNames, includeFootNotes, includeLink) {
		let results = '';
		const [chapter] = key.split(':');

		if (includeKey) results += `${getChapterDisplayMeta(chapter).transliteration}, ${key}\n\n`;

		const arabicText = getVerseArabicText(key);
		const translationText = getVerseTranslationText(key, includeTranslationNames, includeFootNotes);

		if (textType === 1) results += `${arabicText}\n\n`;
		else if (textType === 2) results += `${translationText}\n\n`;
		else if (textType === 3) results += `${arabicText}\n\n${translationText}\n\n`;

		if (includeLink) results += websiteLink;
		return results.trim();
	}

	async function processAndCopyVerseData() {
		if (copyType === 1) generatedVerseData = getVerseArabicText($__verseKey);
		else if (copyType === 2) generatedVerseData = websiteLink;
		else if (copyType === 3) generatedVerseData = advancedCopy($__verseKey, textType, includeKey, includeTranslationNames, includeFootNotes, includeLink);

		navigator.clipboard.writeText(generatedVerseData);
	}

	function downloadTextFile(name, data) {
		const link = document.createElement('a');
		const file = new Blob([data], { type: 'text/plain' });
		link.href = URL.createObjectURL(file);
		link.download = `${name}.txt`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<Modal id="copyShareVerseModal" bind:open={$__copyShareVerseModalVisible} transitionParams={getModalTransition('bottom')} size="xs" class="!rounded-b-none md:!rounded-3xl !theme max-h-[90vh] flex flex-col" bodyClass="p-6 flex flex-col min-h-0 overflow-hidden" placement="center" position="bottom" outsideclose>
	<h3 id="modal-title" class="mb-2 text-xl font-medium flex-shrink-0">
		{getChapterDisplayMeta(chapter || 1).transliteration}, {$__verseKey}
	</h3>

	<div class="flex-1 min-h-0 overflow-y-auto w-full pr-2">
		<div class="flex flex-col space-y-4 py-4">
			<span class="text-sm">Jenis</span>
			<div class="flex flex-row space-x-2">
				<div class="flex items-center">
					<Radio bind:group={copyType} value={1} custom>
						<div class="{radioClasses} {copyType === 1 && selectedRadioOrCheckboxClasses}"><div class="w-full">Teks</div></div>
					</Radio>
				</div>
				<div class="flex items-center">
					<Radio bind:group={copyType} value={2} custom>
						<div class="{radioClasses} {copyType === 2 && selectedRadioOrCheckboxClasses}"><div class="w-full">Tautan</div></div>
					</Radio>
				</div>
				<div class="flex items-center">
					<Radio bind:group={copyType} value={3} custom>
						<div class="{radioClasses} {copyType === 3 && selectedRadioOrCheckboxClasses}"><div class="w-full">Lanjutan</div></div>
					</Radio>
				</div>
			</div>

			{#if copyType !== 3}
				<span class="flex flex-col space-y-3 text-xs opacity-70">
					{#if copyType === 1}
						<span>Salin hanya teks Arab dari {term('verse').toLowerCase()} ini.</span>
					{:else if copyType === 2}
						<span>Salin hanya tautan halaman {term('verse').toLowerCase()} ini.</span>
					{/if}
				</span>
			{/if}
		</div>

		{#if copyType === 3}
			<div class="flex flex-col">
				<div class="flex flex-col">
					<div class="flex flex-col space-y-4 py-4 border-t border-theme-accent/20">
						<span class="text-sm">Teks</span>
						<div class="flex flex-row space-x-2">
							<div class="flex items-center">
								<Radio bind:group={textType} value={1} custom>
									<div class="{radioClasses} {textType === 1 && selectedRadioOrCheckboxClasses}"><div class="w-full">Arab</div></div>
								</Radio>
							</div>
							<div class="flex items-center">
								<Radio bind:group={textType} value={2} custom>
									<div class="{radioClasses} {textType === 2 && selectedRadioOrCheckboxClasses}"><div class="w-full">Terjemahan</div></div>
								</Radio>
							</div>
							<div class="flex items-center">
								<Radio bind:group={textType} value={3} custom>
									<div class="{radioClasses} {textType === 3 && selectedRadioOrCheckboxClasses}"><div class="w-full">Keduanya</div></div>
								</Radio>
							</div>
						</div>
					</div>
				</div>

				<div class="flex flex-col space-y-2 py-4 border-t border-theme-accent/20">
					<Checkbox checked={includeKey} on:click={() => (includeKey = !includeKey)} class="space-x-2 pb-2 font-normal bg-theme-bg">
						<span>Sertakan Nama {term('chapter')} & Nomor {term('verse')}</span>
					</Checkbox>

					{#if textType === 2 || textType === 3}
						<Checkbox checked={includeTranslationNames} on:click={() => (includeTranslationNames = !includeTranslationNames)} class="space-x-2 pb-2 font-normal bg-theme-bg">
							<span>Sertakan Nama Penerjemah</span>
						</Checkbox>

						<Checkbox checked={includeFootNotes} on:click={() => (includeFootNotes = !includeFootNotes)} class="space-x-2 pb-2 font-normal bg-theme-bg">
							<span>Sertakan Catatan Kaki</span>
						</Checkbox>
					{/if}

					<Checkbox checked={includeLink} on:click={() => (includeLink = !includeLink)} class="space-x-2 pb-2 font-normal bg-theme-bg">
						<span>Sertakan Tautan Situs</span>
					</Checkbox>
				</div>
			</div>
		{/if}

		{#if generatedVerseData !== ''}
			<div class="text-xs opacity-70 mb-6 text-left">
				{#if copyType === 1 || copyType === 3}
					<span>Teks telah disalin ke papan klip.</span>
					<button on:click={downloadTextFile(`quran-${chapter}-${verse}`, generatedVerseData)} class={linkClasses} data-umami-event="Download Verse File Button">Unduh sebagai berkas teks.</button>
				{:else}
					<span>Tautan telah disalin ke papan klip.</span>
				{/if}
			</div>
		{/if}
	</div>

	<div class="flex-shrink-0 mt-4">
		<button class="w-full {buttonClasses}" on:click={processAndCopyVerseData} data-umami-event="Copy Verse Button">Salin</button>
	</div>
</Modal>
