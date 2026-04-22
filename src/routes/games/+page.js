import { goto } from '$app/navigation';
import { base } from '$app/paths';

export async function load() {
	goto(`${base}/games/guess-the-word`, { replaceState: false });
}
