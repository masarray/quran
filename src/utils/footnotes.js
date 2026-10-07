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

	const boundaryRegex = /(^|[\s.;:!?])(\d{2,5})\)\s+/g;
	const boundaries = [];
	let match;

	while ((match = boundaryRegex.exec(content)) !== null) {
		const separator = match[1] ?? '';
		boundaries.push({
			number: Number(match[2]),
			start: match.index + separator.length,
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
		.map((entry, sourceIndex) => ({ entry, sourceIndex, content: normalizeFootnoteContent(entry) }))
		.filter((candidate) => candidate.content);

	if (populatedEntries.length !== 1) return null;

	const sections = splitCompositeFootnote(populatedEntries[0].content, markerCount);
	if (!sections) return null;

	return {
		sections,
		sourceIndex: populatedEntries[0].sourceIndex,
		strategy: 'composite-sequential-boundaries'
	};
}

function resolveExactEmbeddedId(footnotes, id) {
	if (!Array.isArray(footnotes) || id === '') return null;
	const entry = footnotes.find((candidate) => getEmbeddedFootnoteId(candidate) === id);
	const content = normalizeFootnoteContent(entry);
	return content ? { content, strategy: 'embedded-id', recovered: false } : null;
}

function resolveDirectEntry(footnotes, id, displayNumber) {
	const number = Number(displayNumber);
	const displayIndex = Number.isInteger(number) && number > 0 ? number - 1 : null;

	if (Array.isArray(footnotes)) {
		const candidate = getArrayCandidate(footnotes, displayIndex);
		const content = normalizeFootnoteContent(candidate);
		return content ? { content, strategy: 'display-number', recovered: false } : null;
	}

	if (footnotes && typeof footnotes === 'object') {
		if (id !== '') {
			const byId = normalizeFootnoteContent(footnotes[id]);
			if (byId) return { content: byId, strategy: 'id-map', recovered: false };
		}
		if (Number.isInteger(number) && number > 0) {
			const byDisplayNumber = normalizeFootnoteContent(footnotes[String(number)]);
			if (byDisplayNumber) return { content: byDisplayNumber, strategy: 'display-number-map', recovered: false };
		}
		if (displayIndex !== null) {
			const byDisplayIndex = normalizeFootnoteContent(footnotes[String(displayIndex)]);
			if (byDisplayIndex) return { content: byDisplayIndex, strategy: 'display-index-map', recovered: false };
		}
	}

	return null;
}

export function canonicalizeVerseFootnotes(verseText, footnotes) {
	const markers = extractFootnoteMarkers(verseText);
	const markerCount = markers.length;
	const canonical = [];
	const diagnostics = {
		markerCount,
		populatedSourceEntries: getFootnoteEntries(footnotes).map((entry) => normalizeFootnoteContent(entry)).filter(Boolean).length,
		compositeRecovered: false,
		ambiguousComposite: false
	};

	if (markerCount === 0) return { markers, footnotes: canonical, diagnostics };

	const exactByMarker = markers.map((marker) => resolveExactEmbeddedId(footnotes, marker.footnoteId));
	const hasExactForEveryMarker = exactByMarker.every(Boolean);

	if (hasExactForEveryMarker) {
		for (let index = 0; index < markers.length; index += 1) {
			canonical.push({
				displayNumber: markers[index].displayNumber,
				footnoteId: markers[index].footnoteId,
				content: exactByMarker[index].content,
				strategy: exactByMarker[index].strategy,
				recovered: false
			});
		}
		return { markers, footnotes: canonical, diagnostics };
	}

	const compositeCandidate = markerCount >= 2 && diagnostics.populatedSourceEntries === 1;
	const recoveredComposite = compositeCandidate ? recoverCompositeFootnotes(footnotes, markerCount) : null;

	if (recoveredComposite) {
		diagnostics.compositeRecovered = true;
		for (let index = 0; index < markers.length; index += 1) {
			const exact = exactByMarker[index];
			canonical.push({
				displayNumber: markers[index].displayNumber,
				footnoteId: markers[index].footnoteId,
				content: exact?.content ?? recoveredComposite.sections[index],
				strategy: exact ? exact.strategy : recoveredComposite.strategy,
				recovered: !exact,
				sourceIndex: exact ? undefined : recoveredComposite.sourceIndex
			});
		}
		return { markers, footnotes: canonical, diagnostics };
	}

	if (compositeCandidate) diagnostics.ambiguousComposite = true;

	for (const marker of markers) {
		const exact = resolveExactEmbeddedId(footnotes, marker.footnoteId);
		const direct = exact ?? resolveDirectEntry(footnotes, marker.footnoteId, marker.displayNumber);
		canonical.push({
			displayNumber: marker.displayNumber,
			footnoteId: marker.footnoteId,
			content: direct?.content ?? null,
			strategy: direct?.strategy ?? 'unresolved',
			recovered: false
		});
	}

	return { markers, footnotes: canonical, diagnostics };
}

export function resolveFootnote(footnotes, footnoteId, displayNumber, options = {}) {
	if (!footnotes) return null;

	const id = footnoteId === null || footnoteId === undefined ? '' : String(footnoteId);
	const number = Number(displayNumber);
	const displayIndex = Number.isInteger(number) && number > 0 ? number - 1 : null;
	const numericId = Number(id);
	const legacyIndex = Number.isInteger(numericId) && numericId > 0 ? numericId - 1 : null;

	if (typeof options.verseText === 'string') {
		const canonical = canonicalizeVerseFootnotes(options.verseText, footnotes);
		const match = canonical.footnotes.find(
			(entry) => entry.footnoteId === id || (Number.isInteger(number) && entry.displayNumber === number)
		);
		if (match?.content) {
			return {
				content: match.content,
				strategy: match.strategy,
				recovered: match.recovered === true
			};
		}
	}

	const exact = resolveExactEmbeddedId(footnotes, id);
	if (exact) return exact;

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

	const direct = resolveDirectEntry(footnotes, id, number);
	if (direct) return direct;

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

		const canonical = canonicalizeVerseFootnotes(verseData.text, verseData.footnotes);
		const markers = canonical.markers;
		if (markers.length === 0) continue;
		summary.versesWithFootnotes += 1;
		if (canonical.diagnostics.ambiguousComposite) summary.ambiguousComposite += 1;

		for (const marker of markers) {
			summary.markers += 1;
			const is2Plus = marker.displayNumber >= 2;
			if (is2Plus) summary.markers2Plus += 1;

			const resolved = canonical.footnotes.find(
				(entry) => entry.footnoteId === marker.footnoteId || entry.displayNumber === marker.displayNumber
			);
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
				status: canonical.diagnostics.ambiguousComposite ? 'ambiguous-composite' : status,
				footnotesType: Array.isArray(verseData.footnotes) ? 'array' : typeof verseData.footnotes,
				footnotesCount: Array.isArray(verseData.footnotes) ? verseData.footnotes.length : verseData.footnotes && typeof verseData.footnotes === 'object' ? Object.keys(verseData.footnotes).length : 0
			});
		}
	}

	return { summary, problems };
}
