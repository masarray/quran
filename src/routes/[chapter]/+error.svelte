<script>
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { __currentPage } from '$utils/stores';
	import { linkClasses } from '$data/commonClasses';

	__currentPage.set('error');
</script>

<div class="flex flex-col space-y-4 items-center justify-center text-center pt-28">
	{#if $page.status === 404}
		<span>Konten yang Anda cari tidak ditemukan.</span>
	{:else}
		<span>Terjadi kendala saat memuat konten. Silakan coba lagi nanti.</span>
	{/if}

	<span>Jika menurut Anda kendala ini seharusnya tidak terjadi, silakan beri tahu kami melalui <a class={linkClasses} href="mailto:quranwbw@gmail.com">email</a>.</span>

	<a class="{linkClasses} pt-8" href={`${base}/`}>Kembali ke beranda.</a>
</div>
