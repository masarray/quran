import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { __currentPage, __lastRead } from '$utils/stores';
import { updateSettings } from '$utils/updateSettings';

export function displayTypeChangeHandler(displayId) {
	const nonMushafModes = [1, 2, 3, 4, 5, 7];
	const mushafMode = [6];

	if (nonMushafModes.includes(displayId)) {
		handleNonMushafMode(displayId);
	} else if (mushafMode.includes(displayId)) {
		handleMushafMode();
	}
}

function handleNonMushafMode(displayId) {
	if (get(__currentPage) === 'mushaf') {
		const firstWordKey = document.querySelector('.word').id;
		const [chapter, verse] = firstWordKey.split(':');
		goto(`${base}/${chapter}/${verse}`);
	}

	updateSettings({ type: 'displayType', value: displayId });
}

function handleMushafMode() {
	const lastReadPage = get(__lastRead).page || 1;
	updateSettings({ type: 'displayType', value: 6, skipTrackEvent: true });
	goto(`${base}/page?id=${lastReadPage}`);
}
