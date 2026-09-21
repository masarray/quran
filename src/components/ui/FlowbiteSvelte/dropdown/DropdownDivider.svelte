<script>
	import { twMerge } from 'tailwind-merge';
	export let divClass = 'my-1 h-px';
	let className = '';
	export { className as class };
</script>

<div role="separator" class={twMerge(divClass, className)}></div>

<!--
@component
[Go to docs](https://flowbite-svelte.com/)
## Props
@prop export let divClass: string = 'my-1 h-px';
-->
