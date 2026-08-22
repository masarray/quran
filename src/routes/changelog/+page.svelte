<script>
	import PageHead from '$misc/PageHead.svelte';
	import markdown from './CHANGELOG.md?raw';

	import { __currentPage } from '$utils/stores';
	import { marked } from 'marked';

	const html = marked.parse(markdown);

	__currentPage.set('changelog');
</script>

<PageHead title={'Pembaruan'} />

<div class="markdown changelog mx-auto">
	{@html html}
</div>
