import Dexie from 'dexie';

export const db = new Dexie('quranwbw');

const cacheSchema = {
	word_data: 'key',
	verse_translation_data: 'key',
	morphology_data: 'key',
	tafsir_data: 'key',
	other_data: 'key'
};

db.version(1).stores(cacheSchema);

// P1 footnote hardening: invalidate only cached Indonesian Ministry translation
// records from pre-recovery builds. The CDN URL/version remains unchanged; users
// refetch resource 33 once while every other cached translation stays intact.
db.version(2)
	.stores(cacheSchema)
	.upgrade(async (transaction) => {
		await transaction.table('verse_translation_data').where('key').startsWith('verse-translations/33.json').delete();
	});

export const cacheTableMap = {
	word: db.word_data,
	translation: db.verse_translation_data,
	morphology: db.morphology_data,
	tafsir: db.tafsir_data,
	other: db.other_data
};

// Clears all records from the specified Dexie table without altering its schema
export async function clearDexieTable(tableName) {
	if (!db.tables.some((t) => t.name === tableName)) {
		console.log(`Table "${tableName}" does not exist`);
		return;
	}

	await db.table(tableName).clear();
	console.log(`Table "${tableName}" cleared successfully`);
}

// Completely deletes the Dexie database
export async function deleteDexieDatabase() {
	try {
		db.close();
		await db.delete();
		console.log(`Dexie database "${db.name}" deleted`);
	} catch (error) {
		console.warn(error);
		throw error;
	}
}
