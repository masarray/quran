<script>
	import PageHead from '$misc/PageHead.svelte';
	import Spinner from '$svgs/Spinner.svelte';
	import Check from '$svgs/Check.svelte';
	import Cross from '$svgs/Cross.svelte';
	import Radio from '$ui/FlowbiteSvelte/forms/Radio.svelte';
	import ErrorLoadingData from '$misc/ErrorLoadingData.svelte';
	import { __currentPage, __quizCorrectAnswers, __quizWrongAnswers } from '$utils/stores';
	import { buttonClasses, buttonOutlineClasses, disabledClasses, individualRadioClasses } from '$data/commonClasses';
	import { updateSettings } from '$utils/updateSettings';
	import { playWordAudio } from '$utils/audioController';
	import { fetchWordData } from '$utils/fetchData';
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';

	let randomID = 1;
	let selection = null;
	let answerChecked = false;
	let isAnswerCorrect = null;
	let randomWord = Math.floor(Math.random() * 3);
	let party = null;

	$: randomWordsData = fetchRandomWords(randomID);

	onMount(() => {
		const script = document.createElement('script');
		script.src = 'https://cdn.jsdelivr.net/npm/party-js@latest/bundle/party.min.js';
		script.async = true;
		script.onload = () => {
			if (window.party) party = window.party;
		};
		script.onerror = () => {
			console.warn('party-js CDN failed to load. Confetti will be disabled.');
		};
		document.head.appendChild(script);
	});

	async function fetchRandomWords() {
		// Translation id 4 is Indonesian. The game is intentionally Indonesia-only.
		const { arabicWordData, translationWordData, transliterationWordData } = await fetchWordData(1, 4, 1);

		const allWordEntries = [];

		for (const chapter in arabicWordData) {
			const verses = arabicWordData[chapter];
			for (const verse in verses) {
				const [arabicWords = []] = verses[verse];
				const translations = translationWordData[chapter]?.[verse]?.[0] || [];
				const transliterations = transliterationWordData[chapter]?.[verse]?.[0] || [];

				for (let i = 0; i < arabicWords.length; i++) {
					allWordEntries.push({
						word_key: `${chapter}:${verse}:${i + 1}`,
						word_arabic: arabicWords[i],
						word_transliteration: transliterations[i] || '',
						word_translation: translations[i] || ''
					});
				}
			}
		}

		const shuffled = allWordEntries.sort(() => 0.5 - Math.random());
		return shuffled.slice(0, 4);
	}

	function checkAnswer() {
		answerChecked = true;
		isAnswerCorrect = selection === randomWord;

		if (isAnswerCorrect) {
			if (party) {
				party.confetti(document.body, {
					count: 80,
					spread: 100,
					size: 2
				});
			}
			updateSettings({ type: 'quizCorrectAnswers', value: $__quizCorrectAnswers + 1 });
		} else {
			updateSettings({ type: 'quizWrongAnswers', value: $__quizWrongAnswers + 1 });
		}
	}

	function setRandomWord() {
		randomID = Math.floor(Math.random() * 9999999) + 1;
		randomWord = Math.floor(Math.random() * 3);
		selection = null;
		isAnswerCorrect = null;
		answerChecked = false;
	}

	__currentPage.set('Tebak Kata');
</script>

<PageHead title={'Tebak Kata'} />

<div class="space-y-12">
	{#await randomWordsData}
		<Spinner />
	{:then data}
		<div class="flex flex-col space-y-8 my-6 md:my-8 justify-center" in:fade={{ duration: 300 }}>
			<button class="flex flex-col space-y-4 mx-auto items-center" on:click={() => playWordAudio({ key: data[randomWord].word_key })}>
				<span class="text-5xl md:text-7xl arabic-font-1">{data[randomWord].word_arabic}</span>
				<span class="text-xs">{data[randomWord].word_transliteration}</span>
			</button>

			<div id="options" class="pt-8">
				<p class="mb-5 text-sm">Pilih terjemahan yang benar:</p>
				<div class="grid gap-4 md:gap-6 w-full md:grid-cols-2">
					{#each Object.entries(data) as [key, _]}
						<Radio name="bordered" bind:group={selection} value={+key} class={answerChecked === true && selection !== +key ? disabledClasses : null} custom>
							<div class="{individualRadioClasses} {selection === +key ? `border-theme-accent/20` : null}">
								<div class="flex flex-row mr-auto ml-2">{data[key].word_translation}</div>

								{#if answerChecked === true && selection === +key}
									<div class="justify-end"><svelte:component this={selection === randomWord ? Check : Cross} size={5} /></div>
								{/if}
							</div>
						</Radio>
					{/each}
				</div>
			</div>

			{#if answerChecked === true && isAnswerCorrect !== null}
				<div id="answer-results" class="flex justify-center text-center font-medium text-md">
					<span>{isAnswerCorrect ? 'Jawaban Anda benar.' : `Jawaban yang benar adalah "${data[randomWord].word_translation}"`}</span>
				</div>
			{/if}

			<div id="buttons" class="flex flex-row space-x-4 justify-center w-full">
				{#if !answerChecked}
					<div id="confirm-button" class="{selection === null || answerChecked === true ? disabledClasses : null} w-full">
						<button class="{buttonClasses} w-full" on:click={() => checkAnswer()}>Konfirmasi</button>
					</div>
				{/if}

				<div id="skip-word-button" class="w-full">
					<button class="{buttonOutlineClasses} w-full" on:click={() => setRandomWord()}>{answerChecked ? 'Berikutnya' : 'Lewati'} {@html '&#x2192;'}</button>
				</div>
			</div>

			<div id="quiz-stats" class="flex flex-row space-x-4 justify-center text-xs">
				<span>Benar: {$__quizCorrectAnswers}</span>
				<span>|</span>
				<span>Salah: {$__quizWrongAnswers}</span>
			</div>
		</div>
	{:catch error}
		<ErrorLoadingData {error} />
	{/await}
</div>
