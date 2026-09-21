import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const juz = params.juz;

	if (juz < 1 || juz > 30 || isNaN(juz)) {
		throw error(404, {
			message: 'Not found'
		});
	}

	goto(`${base}/juz?id=${juz}`, { replaceState: false });
}
