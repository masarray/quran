<script>
	import PageHead from '$misc/PageHead.svelte';
	import markdown from './ABOUT.md?raw';

	import { __currentPage } from '$utils/stores';
	import { marked } from 'marked';

	const html = marked.parse(markdown);

	__currentPage.set('about');
</script>

<PageHead title={'Tentang'} />

<div class="markdown mx-auto">
	{@html html}
</div>
