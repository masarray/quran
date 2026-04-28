<script>
	import { isUserOnline } from '$utils/offlineModeHandler';
	import { onMount } from 'svelte';

	// Whether the message should be vertically centered
	export let center;

	// Error object passed from the parent (usually from a failed fetch)
	export let error = null;

	// Default centering behavior
	$: center = center === undefined ? true : center;

	// Optional error code extracted from the error message (if JSON-encoded)
	let errorCode = null;

	// Attempt to extract HTTP status code from the error message
	$: if (error && typeof error.message === 'string') {
		try {
			const parsed = JSON.parse(error.message);
			errorCode = parsed.status;
		} catch {
			// Ignore parsing errors and fall back to a generic message
			errorCode = null;
		}
	}

	// Log the error once for debugging purposes
	if (error !== null) {
		console.warn(error);
	}

	// Tracks the user's network state
	let userOnline = true;

	// Check online status when the component mounts
	onMount(async () => {
		userOnline = await isUserOnline();
	});
</script>

<div class="flex flex-col space-y-4 justify-center text-center !text-sm max-w-xl mx-auto" class:pt-[30vh]={center === true}>
	<p>Data ayat belum berhasil dimuat dengan lengkap. Silakan muat ulang data halaman ini.</p>

	{#if !userOnline}
		<p>Perangkat sedang offline. Jika ingin membaca tanpa internet, pastikan data offline yang dibutuhkan sudah diunduh sebelumnya.</p>
	{/if}

	<button type="button" class="w-fit mx-auto px-4 py-2 rounded-full border border-theme-accent/20 bg-theme-accent/5 hover:border-theme-accent" on:click={() => location.reload()}>
		Muat Ulang Data{errorCode !== null ? ` (${errorCode})` : ''}
	</button>
</div>
