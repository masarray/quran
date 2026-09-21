import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { error } from '@sveltejs/kit';
import { isValidVerseKey, isValidWordKey } from '$utils/validateKey';

export async function load({ params }) {
	const key = params.word;

	if (!isValidVerseKey(key) && !(await isValidWordKey(key))) {
		throw error(404, {
			message: 'Not found'
		});
	}

	goto(`${base}/morphology?word=${key}`, { replaceState: false });
}
