function normalizeFootnoteContent(value) {
	if (value === null || value === undefined) return null;

	if (typeof value === 'string') {
		return value.trim() === '' ? null : value;
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	if (typeof value === 'object') {
		if (value.status === 404 || value.error === 'Not Found') return null;

		if (value.foot_note && typeof value.foot_note === 'object') {
			const nestedContent = normalizeFootnoteContent(value.foot_note);
			if (nestedContent) return nestedContent;
		}

		for (const key of ['text', 'content', 'body', 'footnote', 'value', 'html']) {
			if (typeof value[key] === 'string' && value[key].trim() !== '') return value[key];
		}
	}

	return null;
}

function getEmbeddedFootnoteId(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

	if (value.foot_note && typeof value.foot_note === 'object') {
		const nestedId = getEmbeddedFootnoteId(value.foot_note);
		if (nestedId !== null) return nestedId;
	}

	for (const key of ['id', 'foot_note', 'footnote_id', 'footNoteId']) {
		if (value[key] !== null && value[key] !== undefined && typeof value[key] !== 'object') return String(value[key]);
	}

	return null;
}

function getArrayCandidate(footnotes, index) {
	if (!Array.isArray(footnotes) || !Number.isInteger(index) || index < 0 || index >= footnotes.length) return undefined;
	return footnotes[index];
}

function getFootnoteEntries(footnotes) {
	if (Array.isArray(footnotes)) return footnotes;
	if (footnotes && typeof footnotes === 'object') return Object.values(footnotes);
	return [];
}

function cleanRecoveredSection(section) {
	return section.replace(/^\s*\*\s*/, '').trim();
}

export function splitCompositeFootnote(content, markerCount) {
	if (typeof content !== 'string' || content.trim() === '') return null;
	if (!Number.isInteger(markerCount) || markerCount < 2 || markerCount > 10) return null;

	// Resource 33 commonly stores later footnotes inside the first footnote using
	// sequential source-note numbers such as "254) ... 255) ...". Recovery is
	// intentionally strict: exactly markerCount - 1 boundaries must exist and
	// every boundary number must be sequential.
	const boundaryRegex = /(?:^|\s)(\d{2,5})\)\s+/g;
	const boundaries = [];
	let match;

	while ((match = boundaryRegex.exec(content)) !== null) {
		boundaries.push({
			number: Number(match[1]),
			start: match.index,
			contentStart: boundaryRegex.lastIndex
		});
	}

	if (boundaries.length !== markerCount - 1) return null;
	if (!boundaries.every((boundary, index) => index === 0 || boundary.number === boundaries[index - 1].number + 1)) return null;

	const firstSection = cleanRecoveredSection(content.slice(0, boundaries[0].start));
	if (firstSection.length < 8) return null;

	const sections = [firstSection];
	for (let index = 0; index < boundaries.length; index += 1) {
		const current = boundaries[index];
		const next = boundaries[index + 1];
		const section = cleanRecoveredSection(content.slice(current.contentStart, next?.start ?? content.length));
		if (section.length < 8) return null;
		sections.push(section);
	}

	return sections.length === markerCount ? sections : null;
}

export function recoverCompositeFootnotes(footnotes, markerCount) {
	if (!Number.isInteger(markerCount) || markerCount < 2) return null;

	const populatedEntries = getFootnoteEntries(footnotes)
		.map((entry) => normalizeFootnoteContent(entry))
		.filter(Boolean);

	// Do not attempt recovery if the source already provides multiple usable
	// entries. In that case normal ID/index resolution remains authoritative.
	if (populatedEntries.length !== 1) return null;

	const sections = splitCompositeFootnote(populatedEntries[0], markerCount);
	if (!sections) return null;

	return {
		sections,
		strategy: 'composite-sequential-boundaries'
	};
}

export function resolveFootnote(footnotes, footnoteId, displayNumber, options = {}) {
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
	} else if (typeof footnotes === 'object') {
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
	}

	if (displayIndex !== null && Number.isInteger(options.markerCount) && options.markerCount >= 2) {
		const recovered = recoverCompositeFootnotes(footnotes, options.markerCount);
		const recoveredContent = recovered?.sections?.[displayIndex];
		if (recoveredContent) {
			return {
				content: recoveredContent,
				strategy: recovered.strategy,
				recovered: true
			};
		}
	}

	// Legacy ID-as-index lookup stays last as a compatibility fallback only.
	if (Array.isArray(footnotes) && legacyIndex !== displayIndex) {
		const byLegacyIndex = getArrayCandidate(footnotes, legacyIndex);
		const legacyContent = normalizeFootnoteContent(byLegacyIndex);
		if (legacyContent) return { content: legacyContent, strategy: 'legacy-id-index' };
	}

	if (footnotes && typeof footnotes === 'object' && !Array.isArray(footnotes) && legacyIndex !== null && legacyIndex !== displayIndex) {
		const directByLegacyIndex = normalizeFootnoteContent(footnotes[String(legacyIndex)]);
		if (directByLegacyIndex) return { content: directByLegacyIndex, strategy: 'legacy-id-index-map' };
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
		compositeRecovered: 0,
		compositeRecovered2Plus: 0,
		recoveredFromLegacyFailure: 0,
		recovered2PlusFromLegacyFailure: 0,
		ambiguousComposite: 0,
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

		const compositeCandidate = markers.length >= 2 && getFootnoteEntries(verseData.footnotes).map((entry) => normalizeFootnoteContent(entry)).filter(Boolean).length === 1;
		const recoveredComposite = compositeCandidate ? recoverCompositeFootnotes(verseData.footnotes, markers.length) : null;
		if (compositeCandidate && !recoveredComposite) summary.ambiguousComposite += 1;

		for (const marker of markers) {
			summary.markers += 1;
			const is2Plus = marker.displayNumber >= 2;
			if (is2Plus) summary.markers2Plus += 1;

			const resolved = resolveFootnote(verseData.footnotes, marker.footnoteId, marker.displayNumber, { markerCount: markers.length });
			const legacy = resolveLegacyFootnote(verseData.footnotes, marker.footnoteId);

			if (resolved?.content) {
				summary.resolved += 1;
				if (is2Plus) summary.resolved2Plus += 1;
				if (resolved.recovered) {
					summary.compositeRecovered += 1;
					if (is2Plus) summary.compositeRecovered2Plus += 1;
				}
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
				status: compositeCandidate && !recoveredComposite ? 'ambiguous-composite' : status,
				footnotesType: Array.isArray(verseData.footnotes) ? 'array' : typeof verseData.footnotes,
				footnotesCount: Array.isArray(verseData.footnotes) ? verseData.footnotes.length : verseData.footnotes && typeof verseData.footnotes === 'object' ? Object.keys(verseData.footnotes).length : 0
			});
		}
	}

	return { summary, problems };
}
