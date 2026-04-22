import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	const page = params.page;

	if (page < 1 || page > 604 || isNaN(page)) {
		throw error(404, {
			message: 'Not found'
		});
	}

	goto(`${base}/page?id=${page}`, { replaceState: false });
}
