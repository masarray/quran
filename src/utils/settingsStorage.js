const USER_SETTINGS_KEY = 'userSettings';
const CORRUPT_BACKUP_KEY = 'quranRecovery:userSettingsCorrupt';
const RECOVERY_FLAG_KEY = 'quran-settings-recovered';

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
	if (Array.isArray(value)) return value.map(cloneValue);
	if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
	return value;
}

export function mergeSettingsWithDefaults(existing, defaults) {
	if (Array.isArray(defaults)) return Array.isArray(existing) ? existing : cloneValue(defaults);

	if (isPlainObject(defaults)) {
		const source = isPlainObject(existing) ? existing : {};
		const result = { ...source };
		for (const [key, defaultValue] of Object.entries(defaults)) {
			result[key] = mergeSettingsWithDefaults(source[key], defaultValue);
		}
		return result;
	}

	if (defaults === null) return existing === undefined ? null : existing;
	if (existing === undefined || typeof existing !== typeof defaults) return cloneValue(defaults);
	return existing;
}

export function parseJsonSafely(raw, fallback = null) {
	if (typeof raw !== 'string' || raw.length === 0) return fallback;
	try {
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}

function preserveCorruptSettings(raw, error) {
	const backup = JSON.stringify({
		capturedAt: new Date().toISOString(),
		raw
	});

	try {
		localStorage.setItem(CORRUPT_BACKUP_KEY, backup);
	} catch (backupError) {
		console.warn('[Recovery] Unable to persist corrupt settings backup in localStorage.', backupError);
		try {
			sessionStorage.setItem(CORRUPT_BACKUP_KEY, backup);
		} catch (sessionError) {
			console.warn('[Recovery] Unable to preserve corrupt settings backup.', sessionError);
		}
	}

	try {
		sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
	} catch {
		// Session recovery notice is best-effort.
	}

	console.warn('[Recovery] Invalid user settings were isolated so the app can boot.', error);
}

export function loadUserSettings(defaultSettings, { persist = true } = {}) {
	const raw = localStorage.getItem(USER_SETTINGS_KEY);
	let parsed = {};

	if (raw) {
		try {
			parsed = JSON.parse(raw);
			if (!isPlainObject(parsed)) throw new Error('Stored userSettings root is not an object.');
		} catch (error) {
			preserveCorruptSettings(raw, error);
			try {
				localStorage.removeItem(USER_SETTINGS_KEY);
			} catch {
				// Continue with defaults even if storage cleanup is restricted.
			}
			parsed = {};
		}
	}

	const repaired = mergeSettingsWithDefaults(parsed, defaultSettings);

	if (persist) {
		try {
			localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(repaired));
		} catch (error) {
			console.warn('[Recovery] Unable to persist repaired user settings.', error);
		}
	}

	return repaired;
}

export function wasUserSettingsRecoveredThisSession() {
	try {
		return sessionStorage.getItem(RECOVERY_FLAG_KEY) === '1';
	} catch {
		return false;
	}
}

export function clearUserSettingsRecoveryNotice() {
	try {
		sessionStorage.removeItem(RECOVERY_FLAG_KEY);
	} catch {
		// Best-effort only.
	}
}
