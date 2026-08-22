<script>
	import Modal from '$ui/FlowbiteSvelte/modal/Modal.svelte';
	import Radio from '$ui/FlowbiteSvelte/forms/Radio.svelte';
	import Checkbox from '$ui/FlowbiteSvelte/forms/Checkbox.svelte';
	import Dropdown from '$ui/FlowbiteSvelte/dropdown/Dropdown.svelte';
	import DropdownItem from '$ui/FlowbiteSvelte/dropdown/DropdownItem.svelte';
	import Input from '$ui/FlowbiteSvelte/forms/Input.svelte';
	import Search from '$svgs/Search.svelte';
	import { quranMetaData } from '$data/quranMeta';
	import { __currentPage, __chapterNumber, __audioSettings, __audioModalVisible, __reciter, __translationReciter } from '$utils/stores';
	import { prepareVersesToPlay, playButtonHandler } from '$utils/audioController';
	import { disabledClasses, buttonClasses, selectedRadioOrCheckboxClasses } from '$data/commonClasses';
	import { selectableAudioDelays, selectableRepeatTimes } from '$data/options';
	import { term } from '$utils/terminologies';
	import { getChapterDisplayMeta } from '$utils/chapterLocalization';
	import { getModalTransition } from '$utils/getModalTransition';
	import { updateSettings } from '$utils/updateSettings';
	import { defaultSettings } from '$src/hooks.client';

	const radioClasses = 'inline-flex justify-between items-center py-2 px-4 w-full bg-theme-bg rounded-lg border-2 border-theme-accent/20 cursor-pointer peer-checked:border-2 peer-checked:border-theme-accent hover:bg-theme-accent/5';
	const dropdownItemClasses = 'flex flex-row items-center space-x-2 font-normal rounded-3xl hover:bg-theme-accent/5';
	let invalidStartVerse = false;
	let invalidEndVerse = false;
	let invalidTimesToRepeat = false;
	let startVerseDropdownOpen = false;
	let endVerseDropdownOpen = false;
	let timesToRepeatDropdownOpen = false;
	let audioDelayDropdownOpen = false;
	let startVerseSearch = '';
	let endVerseSearch = '';
	$: versesInChapter = quranMetaData[$__chapterNumber].verses;

	$: if ($__audioModalVisible) {
		window.versesToPlayArray = [];
		const { startVerse, endVerse, timesToRepeat } = $__audioSettings;
		prepareVersesToPlay($__audioSettings.playingKey);

		if ($__audioSettings.endVerse == null) $__audioSettings.endVerse = startVerse;

		invalidStartVerse = startVerse < 1 || startVerse > versesInChapter;
		invalidEndVerse = endVerse < 1 || endVerse > versesInChapter || endVerse < startVerse;
		invalidTimesToRepeat = !selectableRepeatTimes.includes(timesToRepeat);
	}

	$: if ($__currentPage !== 'chapter' && $__audioSettings.audioRange === 'playRange') {
		$__audioSettings.audioRange = 'playThisVerse';
	}

	if ($__audioSettings.rememberSettings) savedPlaySettingsHandler('get');
	if ($__audioSettings.repeatType === undefined) $__audioSettings.repeatType = 'repeatVerse';
	if ($__audioSettings.audioDelay === undefined) $__audioSettings.audioDelay = 1;
	if ($__audioSettings.timesToRepeat === undefined || !selectableRepeatTimes.includes($__audioSettings.timesToRepeat)) $__audioSettings.timesToRepeat = 1;

	$: if ($__currentPage !== 'chapter') $__audioSettings.repeatType = 'repeatVerse';
	$: if ($__audioSettings && $__audioSettings.rememberSettings === true) savedPlaySettingsHandler('set');
	$: if ($__chapterNumber && $__audioSettings.endVerse > versesInChapter) $__audioSettings.endVerse = versesInChapter;
	$: if ($__audioModalVisible) $__audioSettings.endVerse = versesInChapter;
	$: if ($__audioSettings.endVerse < $__audioSettings.startVerse) $__audioSettings.endVerse = $__audioSettings.startVerse;

	function savedPlaySettingsHandler(action) {
		const audioSettings = $__audioSettings;
		const savedSettings = $__audioSettings.savedPlaySettings || {};

		const assignSettings = (source, target) => {
			Object.assign(target, {
				audioType: source.audioType,
				language: source.language,
				audioRange: source.audioRange,
				timesToRepeat: source.timesToRepeat,
				audioDelay: source.audioDelay
			});
		};

		if (action === 'get') {
			if (Object.keys(savedSettings).length === 0) savedPlaySettingsHandler('set');
			assignSettings(savedSettings, audioSettings);
		} else if (action === 'set') {
			assignSettings(audioSettings, savedSettings);
		} else if (action === 'default') {
			assignSettings(defaultSettings.audioSettings, audioSettings);
			delete audioSettings.savedPlaySettings;
		}

		$__audioSettings.reciter = $__reciter;
		$__audioSettings.translationReciter = $__translationReciter;
		updateSettings({ type: 'audioSettings', value: audioSettings });
	}

	function toggleRememberSettings() {
		const rememberSettings = $__audioSettings.rememberSettings;
		const newSetting = !rememberSettings;
		const settingType = newSetting ? 'set' : 'default';

		$__audioSettings.rememberSettings = newSetting;
		savedPlaySettingsHandler(settingType);
	}
</script>

<Modal id="audioModal" bind:open={$__audioModalVisible} transitionParams={getModalTransition('bottom')} size="sm" class="!rounded-b-none md:!rounded-3xl !theme max-h-[90vh] flex flex-col" bodyClass="p-6 flex flex-col min-h-0 overflow-hidden" placement="center" position="bottom" outsideclose>
	<h3 id="modal-title" class="mb-2 text-xl font-medium flex-shrink-0">{getChapterDisplayMeta($__audioSettings.playingChapter || 1).transliteration}, {$__audioSettings.playingKey}</h3>

	<div class="flex-1 min-h-0 overflow-y-auto w-full pr-2">
		<div class="flex flex-col">
			<div class="flex flex-col space-y-4 py-4">
				<span class="text-sm">Putar</span>
				<div class="flex flex-row space-x-2">
					<div class="flex items-center">
						<Radio bind:group={$__audioSettings.audioType} value="verse" custom>
							<div class="{radioClasses} {$__audioSettings.audioType === 'verse' && selectedRadioOrCheckboxClasses}">
								<div class="w-full">{term('verse')}</div>
							</div>
						</Radio>
					</div>
					<div class="flex items-center">
						<Radio bind:group={$__audioSettings.audioType} value="word" custom>
							<div class="{radioClasses} {$__audioSettings.audioType === 'word' && selectedRadioOrCheckboxClasses}">
								<div class="w-full">Kata</div>
							</div>
						</Radio>
					</div>
				</div>

				{#if $__audioSettings.audioType === 'word'}
					<span class="flex flex-col space-y-3 text-xs pt-2 opacity-70">
						<span>Fitur ini memungkinkan Anda mendengarkan setiap kata dalam {term('verse').toLowerCase()} satu per satu. Untuk mendengarkan kata tertentu, cukup ketuk kata tersebut. Perlu diketahui, mode ini memutar kata secara berurutan tanpa memperhitungkan huruf sambung yang tidak dibaca. Untuk bacaan yang utuh dan akurat, sebaiknya putar seluruh {term('verse').toLowerCase()}.</span>
					</span>
				{/if}
			</div>

			<div id="recitation-language-block" class="flex flex-col space-y-4 py-4 border-t border-theme-accent/20 {$__audioSettings.audioType === 'word' ? 'hidden' : null}">
				<span class="text-sm">Bahasa</span>
				<div class="flex flex-row space-x-2">
					<div class="flex items-center">
						<Radio bind:group={$__audioSettings.language} value="arabic" custom>
							<div class="{radioClasses} {$__audioSettings.language === 'arabic' && selectedRadioOrCheckboxClasses}">
								<div class="w-full">Arab</div>
							</div>
						</Radio>
					</div>
					<div class="flex items-center">
						<Radio bind:group={$__audioSettings.language} value="translation" custom>
							<div class="{radioClasses} {$__audioSettings.language === 'translation' && selectedRadioOrCheckboxClasses}">
								<div class="w-full">Terjemahan</div>
							</div>
						</Radio>
					</div>
					<div class="flex items-center">
						<Radio bind:group={$__audioSettings.language} value="both" custom>
							<div class="{radioClasses} {$__audioSettings.language === 'both' && selectedRadioOrCheckboxClasses}">
								<div class="w-full">Keduanya</div>
							</div>
						</Radio>
					</div>
				</div>
			</div>

			<div id="single-or-range-block" class="flex flex-col space-y-4 py-4 border-t border-theme-accent/20 {$__audioSettings.audioType === 'word' ? 'hidden' : null}">
				<span class="text-sm">Rentang</span>
				<div class="flex flex-row space-x-2">
					<div class="flex items-center min-w-fit {!['chapter', 'mushaf', 'supplications', 'bookmarks', 'juz', 'hizb'].includes($__currentPage) && disabledClasses}">
						<Radio bind:group={$__audioSettings.audioRange} value="playThisVerse" custom>
							<div class="{radioClasses} {$__audioSettings.audioRange === 'playThisVerse' && selectedRadioOrCheckboxClasses}">
								<div class="w-full">{term('verse')} Ini</div>
							</div>
						</Radio>
					</div>
					<div class="flex items-center min-w-fit {!['chapter', 'mushaf', 'supplications', 'bookmarks', 'juz', 'hizb'].includes($__currentPage) && disabledClasses}">
						<Radio bind:group={$__audioSettings.audioRange} value="playFromHere" custom>
							<div class="{radioClasses} {$__audioSettings.audioRange === 'playFromHere' && selectedRadioOrCheckboxClasses}">
								<div class="w-full">Dari Sini</div>
							</div>
						</Radio>
					</div>
					<div class="flex items-center min-w-fit {!['chapter'].includes($__currentPage) && disabledClasses}">
						<Radio bind:group={$__audioSettings.audioRange} value="playRange" custom>
							<div class="{radioClasses} {$__audioSettings.audioRange === 'playRange' && selectedRadioOrCheckboxClasses}">
								<div class="w-full">Kustom</div>
							</div>
						</Radio>
					</div>
				</div>
			</div>

			{#if $__audioSettings.audioRange === 'playRange'}
				<div id="repeat-type-block" class="flex flex-col space-y-4 py-4 border-t border-theme-accent/20 {$__audioSettings.audioType === 'word' ? 'hidden' : null}">
					<span class="text-sm">Pengulangan</span>
					<div class="flex flex-row space-x-2">
						<div class="flex items-center min-w-fit {!['chapter', 'mushaf', 'supplications', 'bookmarks', 'juz', 'hizb'].includes($__currentPage) && disabledClasses}">
							<Radio bind:group={$__audioSettings.repeatType} value="repeatVerse" custom>
								<div class="{radioClasses} {$__audioSettings.repeatType === 'repeatVerse' && selectedRadioOrCheckboxClasses}">
									<div class="w-full">Setiap {term('verse')}</div>
								</div>
							</Radio>
						</div>
						<div class="flex items-center min-w-fit {!['chapter', 'mushaf', 'supplications', 'bookmarks', 'juz', 'hizb'].includes($__currentPage) && disabledClasses}">
							<Radio bind:group={$__audioSettings.repeatType} value="repeatRange" custom>
								<div class="{radioClasses} {$__audioSettings.repeatType === 'repeatRange' && selectedRadioOrCheckboxClasses}">
									<div class="w-full">Seluruh Rentang</div>
								</div>
							</Radio>
						</div>
					</div>
				</div>
			{/if}
		</div>

		{#if $__currentPage === 'chapter' && $__audioSettings.audioType === 'verse'}
			<div id="audio-range-options" class={$__audioSettings.audioRange === 'playRange' ? 'block' : 'hidden'}>
				<div class="flex flex-col space-y-4 py-4 border-t border-theme-accent/20">
					<div class="flex flex-row space-x-4">
						<div class="flex flex-row space-x-2">
							<span class="m-auto text-sm">Dari</span>

							<button class="{buttonClasses} text-sm"><div>{term('verse')} {$__audioSettings.startVerse}</div></button>
							<Dropdown bind:open={startVerseDropdownOpen} class="w-max">
								<div class="p-2 sticky top-0 z-10">
									<Input min="1" max={versesInChapter} type="number" bind:value={startVerseSearch} autocomplete="off" placeholder="Nomor {term('verse')}" size="md" class="bg-transparent rounded-3xl px-4 w-32 placeholder:text-theme-accent/50">
										<Search slot="left" size={6} classes="pt-1 {startVerseSearch.length > 0 && 'hidden'}" />
									</Input>
								</div>

								<div class="max-h-52 overflow-y-auto my-2 px-2">
									{#each Array.from({ length: versesInChapter }, (_, i) => i + 1).filter((v) => v.toString().includes(startVerseSearch)) as verse}
										<DropdownItem
											class={dropdownItemClasses}
											on:click={() => {
												$__audioSettings.startVerse = verse;
												startVerseDropdownOpen = !startVerseDropdownOpen;
											}}
										>
											{term('verse')} {verse}
										</DropdownItem>
									{/each}
								</div>
							</Dropdown>
						</div>

						<div class="flex flex-row space-x-2">
							<span class="m-auto text-sm">Sampai</span>

							<button class="{buttonClasses} text-sm"><div>{term('verse')} {$__audioSettings.endVerse}</div></button>
							<Dropdown bind:open={endVerseDropdownOpen} class="w-max">
								<div class="p-2 sticky top-0 z-10">
									<Input min="1" max={versesInChapter} type="number" bind:value={endVerseSearch} autocomplete="off" placeholder="Nomor {term('verse')}" size="md" class="bg-transparent rounded-3xl px-4 w-32 placeholder:text-theme-accent/50">
										<Search slot="left" size={6} classes="pt-1 {endVerseSearch.length > 0 && 'hidden'}" />
									</Input>
								</div>

								<div class="max-h-52 overflow-y-auto my-2 px-2">
									{#each Array.from({ length: quranMetaData[$__chapterNumber].verses - $__audioSettings.startVerse + 1 }, (_, i) => i + $__audioSettings.startVerse).filter((v) => v.toString().includes(endVerseSearch)) as verse}
										<DropdownItem
											class={dropdownItemClasses}
											on:click={() => {
												$__audioSettings.endVerse = verse;
												endVerseDropdownOpen = !endVerseDropdownOpen;
											}}
										>
											{term('verse')} {verse}
										</DropdownItem>
									{/each}
								</div>
							</Dropdown>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if $__audioSettings.audioType === 'verse'}
			<div class="flex flex-col space-y-4 py-4 border-t border-theme-accent/20">
				<div class="flex flex-row space-x-4">
					<div class="flex flex-row space-x-2">
						<span class="m-auto text-sm">Ulangi</span>

						<button class="{buttonClasses} text-sm"><div>{$__audioSettings.timesToRepeat} kali</div></button>
						<Dropdown bind:open={timesToRepeatDropdownOpen} class="max-h-52 overflow-y-auto my-2 px-2">
							{#each selectableRepeatTimes as n}
								<DropdownItem
									class={dropdownItemClasses}
									on:click={() => {
										$__audioSettings.timesToRepeat = n;
										timesToRepeatDropdownOpen = !timesToRepeatDropdownOpen;
									}}
								>
									{n} kali
								</DropdownItem>
							{/each}
						</Dropdown>
					</div>

					<div class="flex flex-row space-x-2">
						<span class="m-auto text-sm">Jeda</span>

						<button class="{buttonClasses} text-sm"><div>{selectableAudioDelays[$__audioSettings.audioDelay].name}</div></button>
						<Dropdown bind:open={audioDelayDropdownOpen} class="max-h-52 overflow-y-auto my-2 px-2">
							{#each Object.values(selectableAudioDelays) as delay}
								<DropdownItem
									class={dropdownItemClasses}
									on:click={() => {
										$__audioSettings.audioDelay = delay.id;
										audioDelayDropdownOpen = !audioDelayDropdownOpen;
									}}
								>
									{delay.name}
								</DropdownItem>
							{/each}
						</Dropdown>
					</div>
				</div>
			</div>
		{/if}

		<Checkbox checked={$__audioSettings.rememberSettings} on:click={() => toggleRememberSettings()} class="space-x-2 pb-6 font-normal bg-theme-bg">
			<span>Ingat Pengaturan</span>
		</Checkbox>
	</div>

	<div class="flex-shrink-0 mt-4">
		<button on:click={() => playButtonHandler($__audioSettings.playingKey)} class="w-full {buttonClasses} {invalidStartVerse || invalidEndVerse || invalidTimesToRepeat ? disabledClasses : null}">Putar</button>
	</div>
</Modal>
