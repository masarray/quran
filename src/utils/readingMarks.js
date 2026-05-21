export const readingMarkSlots = [
	{ id: 'daily', label: 'Bacaan harian' },
	{ id: 'friday-kahf', label: 'Al Kahfi Jumat', preferredChapter: 18 },
	{ id: 'memorization', label: 'Hafalan' },
	{ id: 'review', label: 'Murajaah' },
	{ id: 'study', label: 'Kajian' }
];

export function getReadingMarkSlot(id) {
	return readingMarkSlots.find((slot) => slot.id === id);
}

export function getReadingMarkLabel(mark) {
	return mark?.label || getReadingMarkSlot(mark?.id)?.label || 'Penanda bacaan';
}

export function normalizeReadingMarks(readingMarks) {
	return Array.isArray(readingMarks) ? readingMarks.filter((mark) => mark?.id && mark?.chapter && mark?.verse) : [];
}

export function upsertReadingMark(readingMarks, slotId, verseMeta) {
	const slot = getReadingMarkSlot(slotId);
	if (!slot || !verseMeta?.chapter || !verseMeta?.verse) return normalizeReadingMarks(readingMarks);

	const nextMark = {
		id: slot.id,
		label: slot.label,
		chapter: verseMeta.chapter,
		verse: verseMeta.verse,
		page: verseMeta.page,
		juz: verseMeta.juz,
		hizb: verseMeta.hizb,
		updatedAt: new Date().toISOString()
	};

	const existingMarks = normalizeReadingMarks(readingMarks);
	const existingIndex = existingMarks.findIndex((mark) => mark.id === slot.id);

	if (existingIndex === -1) {
		return [nextMark, ...existingMarks].slice(0, readingMarkSlots.length);
	}

	return existingMarks.map((mark, index) => (index === existingIndex ? { ...mark, ...nextMark } : mark));
}

export function deleteReadingMark(readingMarks, slotId) {
	return normalizeReadingMarks(readingMarks).filter((mark) => mark.id !== slotId);
}
