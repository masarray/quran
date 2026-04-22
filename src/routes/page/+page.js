import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { error } from '@sveltejs/kit';

export async function load({ url }) {
	const page = url.searchParams.get('id');

	if (!page) {
		goto(`${base}/page?id=1`, { replaceState: false });
	}

	if (page < 1 || page > 604 || isNaN(page)) {
		throw error(404, {
			message: 'Not found'
		});
	}

	return { id: page };
}
