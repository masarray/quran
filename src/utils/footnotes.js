function normalizeFootnoteContent(value) {
	if (value === null || value === undefined) return null;

	if (typeof value === 'string') {
		return value.trim() === '' ? null : value;
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	if (typeof value === 'object') {
		for (const key of ['text', 'content', 'body', 'footnote', 'value', 'html']) {
			if (typeof value[key] === 'string' && value[key].trim() !== '') return value[key];
		}
	}

	return null;
}

function getEmbeddedFootnoteId(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

	for (const key of ['id', 'foot_note', 'footnote_id', 'footNoteId']) {
		if (value[key] !== null && value[key] !== undefined) return String(value[key]);
	}

	return null;
}

function getArrayCandidate(footnotes, index) {
	if (!Array.isArray(footnotes) || !Number.isInteger(index) || index < 0 || index >= footnotes.length) return undefined;
	return footnotes[index];
}

export function resolveFootnote(footnotes, footnoteId, displayNumber) {
	if (!footnotes) return null;

	const id = footnoteId === null || footnoteId === undefined ? '' : String(footnoteId);
	const number = Number(displayNumber);
	const displayIndex = Number.isInteger(number) && number > 0 ? number - 1 : null;
	const numericId = Number(id);
	const legacyIndex = Number.isInteger(numericId) && numericId > 0 ? numericId - 1 : null;

	if (Array.isArray(footnotes)) {
		if (id !== '') {
			const byEmbeddedId = footnotes.find((entry) => getEmbeddedFootnoteId(entry) === id);
			const content = normalizeFootnoteContent(byEmbeddedId);
			if (content) return { content, strategy: 'embedded-id' };
		}

		const byDisplayNumber = getArrayCandidate(footnotes, displayIndex);
		const displayContent = normalizeFootnoteContent(byDisplayNumber);
		if (displayContent) return { content: displayContent, strategy: 'display-number' };

		if (legacyIndex !== displayIndex) {
			const byLegacyIndex = getArrayCandidate(footnotes, legacyIndex);
			const legacyContent = normalizeFootnoteContent(byLegacyIndex);
			if (legacyContent) return { content: legacyContent, strategy: 'legacy-id-index' };
		}

		return null;
	}

	if (typeof footnotes === 'object') {
		if (id !== '') {
			const directById = normalizeFootnoteContent(footnotes[id]);
			if (directById) return { content: directById, strategy: 'id-map' };
		}

		if (Number.isInteger(number) && number > 0) {
			const directByDisplayNumber = normalizeFootnoteContent(footnotes[String(number)]);
			if (directByDisplayNumber) return { content: directByDisplayNumber, strategy: 'display-number-map' };
		}

		if (displayIndex !== null) {
			const directByDisplayIndex = normalizeFootnoteContent(footnotes[String(displayIndex)]);
			if (directByDisplayIndex) return { content: directByDisplayIndex, strategy: 'display-index-map' };
		}

		if (legacyIndex !== null && legacyIndex !== displayIndex) {
			const directByLegacyIndex = normalizeFootnoteContent(footnotes[String(legacyIndex)]);
			if (directByLegacyIndex) return { content: directByLegacyIndex, strategy: 'legacy-id-index-map' };
		}
	}

	return null;
}

export function resolveLegacyFootnote(footnotes, footnoteId) {
	const numericId = Number(footnoteId);
	if (!Number.isInteger(numericId) || numericId <= 0) return null;
	return normalizeFootnoteContent(footnotes?.[numericId - 1]);
}

export function extractFootnoteMarkers(verseText) {
	if (typeof verseText !== 'string' || verseText.length === 0) return [];

	const markers = [];
	const supRegex = /<sup\b([^>]*)>([\s\S]*?)<\/sup>/gi;
	let match;

	while ((match = supRegex.exec(verseText)) !== null) {
		const attributes = match[1] || '';
		const idMatch = attributes.match(/\bfoot_note\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
		if (!idMatch) continue;

		const footnoteId = idMatch[1] ?? idMatch[2] ?? idMatch[3] ?? '';
		const visibleText = (match[2] || '').replace(/<[^>]+>/g, '').trim();
		const displayNumber = Number.parseInt(visibleText, 10);

		markers.push({
			footnoteId: String(footnoteId),
			displayNumber: Number.isFinite(displayNumber) ? displayNumber : markers.length + 1,
			visibleText
		});
	}

	return markers;
}

function candidateExistsButEmpty(footnotes, footnoteId, displayNumber) {
	if (!footnotes) return false;

	const id = footnoteId === null || footnoteId === undefined ? '' : String(footnoteId);
	const number = Number(displayNumber);
	const displayIndex = Number.isInteger(number) && number > 0 ? number - 1 : null;
	const numericId = Number(id);
	const legacyIndex = Number.isInteger(numericId) && numericId > 0 ? numericId - 1 : null;

	if (Array.isArray(footnotes)) {
		const embedded = footnotes.find((entry) => getEmbeddedFootnoteId(entry) === id);
		if (embedded !== undefined && normalizeFootnoteContent(embedded) === null) return true;

		if (displayIndex !== null && displayIndex < footnotes.length) {
			return normalizeFootnoteContent(footnotes[displayIndex]) === null;
		}

		return false;
	}

	if (typeof footnotes === 'object') {
		const candidateKeys = [id, Number.isInteger(number) && number > 0 ? String(number) : null, displayIndex !== null ? String(displayIndex) : null, legacyIndex !== null ? String(legacyIndex) : null].filter(
			(key, index, keys) => key !== null && key !== '' && keys.indexOf(key) === index
		);

		for (const key of candidateKeys) {
			if (Object.prototype.hasOwnProperty.call(footnotes, key) && normalizeFootnoteContent(footnotes[key]) === null) return true;
		}
	}

	return false;
}

export function auditTranslationFootnotes(translationData) {
	const summary = {
		versesScanned: 0,
		versesWithFootnotes: 0,
		markers: 0,
		markers2Plus: 0,
		resolved: 0,
		resolved2Plus: 0,
		recoveredFromLegacyFailure: 0,
		recovered2PlusFromLegacyFailure: 0,
		missing: 0,
		missing2Plus: 0,
		empty: 0,
		empty2Plus: 0
	};
	const problems = [];

	if (!translationData || typeof translationData !== 'object') return { summary, problems };

	for (const [verseKey, verseData] of Object.entries(translationData)) {
		if (!verseData || typeof verseData !== 'object' || typeof verseData.text !== 'string') continue;
		summary.versesScanned += 1;

		const markers = extractFootnoteMarkers(verseData.text);
		if (markers.length === 0) continue;
		summary.versesWithFootnotes += 1;

		for (const marker of markers) {
			summary.markers += 1;
			const is2Plus = marker.displayNumber >= 2;
			if (is2Plus) summary.markers2Plus += 1;

			const resolved = resolveFootnote(verseData.footnotes, marker.footnoteId, marker.displayNumber);
			const legacy = resolveLegacyFootnote(verseData.footnotes, marker.footnoteId);

			if (resolved?.content) {
				summary.resolved += 1;
				if (is2Plus) summary.resolved2Plus += 1;
				if (!legacy) {
					summary.recoveredFromLegacyFailure += 1;
					if (is2Plus) summary.recovered2PlusFromLegacyFailure += 1;
				}
				continue;
			}

			const status = candidateExistsButEmpty(verseData.footnotes, marker.footnoteId, marker.displayNumber) ? 'empty' : 'missing';
			summary[status] += 1;
			if (is2Plus) summary[`${status}2Plus`] += 1;

			problems.push({
				verseKey,
				displayNumber: marker.displayNumber,
				footnoteId: marker.footnoteId,
				status,
				footnotesType: Array.isArray(verseData.footnotes) ? 'array' : typeof verseData.footnotes,
				footnotesCount: Array.isArray(verseData.footnotes) ? verseData.footnotes.length : verseData.footnotes && typeof verseData.footnotes === 'object' ? Object.keys(verseData.footnotes).length : 0
			});
		}
	}

	return { summary, problems };
}
