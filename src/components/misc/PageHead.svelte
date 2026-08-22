<script>
	export let title;

	import { websiteTagline, websiteURL } from '$data/websiteSettings';

	const exactTitles = {
		Bookmarks: 'Penanda Ayat',
		Topics: 'Topik',
		Search: 'Cari',
		Settings: 'Pengaturan',
		About: 'Tentang',
		Changelog: 'Pembaruan',
		Morphology: 'Morfologi',
		'Offline Mode (Beta)': 'Mode Offline (Beta)'
	};

	function localizeTitle(value = '') {
		if (exactTitles[value]) return exactTitles[value];
		if (/^Page\s+\d+/i.test(value)) return value.replace(/^Page/i, 'Halaman');
		return value;
	}

	$: localizedTitle = localizeTitle(title);
</script>

<svelte:head>
	<title>{localizedTitle} - {websiteURL}</title>
	<meta name="description" content="{localizedTitle} - {websiteTagline}. Aplikasi Al Quran berbahasa Indonesia." />
</svelte:head>
