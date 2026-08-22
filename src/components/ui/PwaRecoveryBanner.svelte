<script>
	import { base } from '$app/paths';
	import Refresh from '$svgs/Refresh.svelte';
	import Offline from '$svgs/Offline.svelte';
	import { onMount } from 'svelte';

	let isOffline = false;
	let fontIssue = false;

	$: visible = isOffline || fontIssue;
	$: message = fontIssue ? 'Tampilan ayat belum lengkap. Muat ulang saat koneksi stabil.' : 'Perangkat sedang offline. Beberapa data mungkin belum tersedia.';

	function refreshPage() {
		location.reload();
	}

	function inspectFonts() {
		if (!document.fonts) return;
		fontIssue = Array.from(document.fonts).some((font) => font.status === 'error');
	}

	onMount(() => {
		isOffline = !navigator.onLine;
		inspectFonts();

		const handleOffline = () => (isOffline = true);
		const handleOnline = () => {
			isOffline = false;
			inspectFonts();
		};
		const handleFontDone = () => inspectFonts();

		window.addEventListener('offline', handleOffline);
		window.addEventListener('online', handleOnline);
		document.fonts?.addEventListener?.('loadingdone', handleFontDone);
		document.fonts?.addEventListener?.('loadingerror', handleFontDone);

		return () => {
			window.removeEventListener('offline', handleOffline);
			window.removeEventListener('online', handleOnline);
			document.fonts?.removeEventListener?.('loadingdone', handleFontDone);
			document.fonts?.removeEventListener?.('loadingerror', handleFontDone);
		};
	});
</script>

{#if visible}
	<div class="fixed inset-x-3 bottom-24 z-[60] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-theme-accent/20 bg-theme-bg/95 px-4 py-3 text-sm shadow-lg backdrop-blur md:bottom-5">
		<div class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-theme-accent/10 text-theme-accent">
			<Offline size={4} />
		</div>
		<div class="min-w-0 flex-1 leading-relaxed">
			{message}
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<button class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-theme-accent/20 bg-theme-accent/5 text-theme-accent" on:click={refreshPage} aria-label="Muat ulang halaman">
				<Refresh size={4} />
			</button>
			<a href={`${base}/offline`} class="hidden rounded-full border border-theme-accent/20 bg-theme-accent/5 px-3 py-2 text-xs text-theme-accent sm:inline-flex">Mode Offline</a>
		</div>
	</div>
{/if}
