<script>
	import { base } from '$app/paths';
	import Tooltip from '$ui/FlowbiteSvelte/tooltip/Tooltip.svelte';
	import ChevronLeft from '$svgs/ChevronLeft.svelte';
	import { __chapterNumber, __currentPage, __pageNumber } from '$utils/stores';
	import { disabledClasses } from '$data/commonClasses';
	import { term } from '$utils/terminologies';
	import { page } from '$app/stores';

	let linkHref;
	let linkText;
	let linkDisabled;

	$: {
		const id = Number($page.url.searchParams.get('id')) || 1;

		if ($__currentPage === 'chapter') {
			linkHref = $__chapterNumber - 1;
			linkText = `${term('chapter')} Sebelumnya`;
			linkDisabled = $__chapterNumber === 1;
		} else if ($__currentPage === 'mushaf') {
			linkHref = `page?id=${$__pageNumber + 1}`;
			linkText = 'Halaman Berikutnya';
			linkDisabled = $__pageNumber === 604;
		} else if ($__currentPage === 'juz') {
			linkHref = `juz?id=${id - 1}`;
			linkText = `${term('juz')} Sebelumnya`;
			linkDisabled = id === 1;
		} else if ($__currentPage === 'hizb') {
			linkHref = `hizb?id=${id - 1}`;
			linkText = `${term('hizb')} Sebelumnya`;
			linkDisabled = id === 1;
		}
	}
</script>

<a href="{base}/{linkHref}" class="inline-flex flex-col items-center justify-center px-5 rounded-s-full group hover:bg-theme-accent/5 {linkDisabled ? disabledClasses : 'opacity-100'}">
	<ChevronLeft size={7} />
	<span class="sr-only">{linkText}</span>
</a>
<Tooltip arrow={false} type="light" class="w-max hidden md:block font-normal">{linkText}</Tooltip>
