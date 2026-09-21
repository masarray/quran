<script>
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { repairPwaAppShell } from '$utils/offlineModeHandler';

	let repairing = false;
	let repairError = '';

	function reloadPage() {
		location.reload();
	}

	async function repairApplication() {
		repairing = true;
		repairError = '';

		const result = await repairPwaAppShell();
		if (!result.success) {
			repairError = result.error || 'Pemulihan belum berhasil.';
			repairing = false;
			return;
		}

		location.replace(`${base}/?recovered=${Date.now()}`);
	}
</script>

<div class="mx-auto flex max-w-xl flex-col items-center justify-center space-y-4 pt-28 text-center text-sm">
	{#if $page.status === 404}
		<p>Konten yang Anda cari tidak ditemukan.</p>
		<a class="rounded-full border border-theme-accent/20 bg-theme-accent/5 px-4 py-2 text-theme-accent" href={`${base}/`}>Kembali ke beranda</a>
	{:else}
		<p>Aplikasi mengalami kendala saat memuat halaman ini.</p>
		<p class="opacity-70">Muat ulang terlebih dahulu. Jika kendala tetap muncul saat internet tersambung, pulihkan berkas inti aplikasi tanpa menghapus catatan, penanda, atau data Quran offline Anda.</p>

		<div class="flex flex-wrap items-center justify-center gap-2 pt-2">
			<button class="rounded-full border border-theme-accent/20 bg-theme-accent/5 px-4 py-2 text-theme-accent" type="button" on:click={reloadPage}>
				Muat Ulang
			</button>
			<button class="rounded-full border border-theme-accent/20 bg-theme-accent/5 px-4 py-2 text-theme-accent" type="button" disabled={repairing} on:click={repairApplication}>
				{repairing ? 'Memulihkan…' : 'Pulihkan Aplikasi'}
			</button>
			<a class="rounded-full border border-theme-accent/20 bg-theme-accent/5 px-4 py-2 text-theme-accent" href={`${base}/`}>Beranda</a>
		</div>

		{#if repairError}
			<p class="opacity-70">{repairError}</p>
		{/if}
	{/if}
</div>
