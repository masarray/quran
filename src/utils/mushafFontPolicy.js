export const totalMushafPages = 604;

function clampPage(page) {
	const numeric = Number(page);
	if (!Number.isInteger(numeric)) return null;
	if (numeric < 1 || numeric > totalMushafPages) return null;
	return numeric;
}

export function getMushafFontPrefetchPlan({ page, previousPage = null, effectiveType = '', saveData = false } = {}) {
	const current = clampPage(page);
	if (!current || saveData) return [];

	const type = String(effectiveType || '').toLowerCase();
	if (type === 'slow-2g' || type === '2g') return [];

	const previous = clampPage(previousPage);
	const direction = previous && previous !== current ? Math.sign(current - previous) : 1;
	const forward = direction >= 0 ? 1 : -1;
	const backward = -forward;

	const offsets = type === '3g' ? [forward] : [forward, forward * 2, backward];
	const pages = [];
	for (const offset of offsets) {
		const candidate = clampPage(current + offset);
		if (candidate && !pages.includes(candidate)) pages.push(candidate);
	}
	return pages;
}

export function shouldRetryMushafFontStatus(status) {
	return status === 'waiting-network' || status === 'error';
}
