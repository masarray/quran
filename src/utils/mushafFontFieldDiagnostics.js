export const MUSHAF_FIELD_DIAGNOSTICS_KEY = 'quranRecovery:mushafFontFieldDiagnostics:v1';
export const MUSHAF_NETWORK_PROFILE_KEY = 'quranRecovery:mushafFontNetworkProfile:v1';
export const MUSHAF_FIELD_SCHEMA_VERSION = 1;
export const MAX_MUSHAF_FIELD_EVENTS = 80;
export const MUSHAF_FIELD_EVENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MUSHAF_NETWORK_PROFILE_TTL_MS = 12 * 60 * 60 * 1000;

const RECENT_OUTCOME_LIMIT = 12;
const EWMA_ALPHA = 0.3;
const allowedEventTypes = new Set([
	'network-success',
	'network-failure',
	'network-signal',
	'network-health',
	'adaptive-mode',
	'prefetch-suspended',
	'recovery-probe',
	'cache-promotion',
	'storage-fallback'
]);
const allowedPriorities = new Set(['critical', 'prefetch', 'none']);
const allowedSources = new Set([
	'network',
	'network-uncached',
	'smart-cache',
	'offline-cache',
	'memory',
	'unknown'
]);
const allowedModes = new Set(['recovery', 'cautious', 'balanced', 'fast']);

function finiteOrNull(value) {
	return Number.isFinite(value) ? Number(value) : null;
}

function clampLatency(value) {
	const numeric = finiteOrNull(value);
	if (numeric === null) return null;
	return Math.max(0, Math.min(120000, Math.round(numeric)));
}

function cleanToken(value, fallback = 'unknown') {
	if (typeof value !== 'string' || !value) return fallback;
	return value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48) || fallback;
}

function normalizePriority(value) {
	const token = cleanToken(value, 'none');
	return allowedPriorities.has(token) ? token : 'none';
}

function normalizeSource(value) {
	const token = cleanToken(value, 'unknown');
	if (token.includes('mushaf-font-smart')) return 'smart-cache';
	if (token.includes('mushaf-data')) return 'offline-cache';
	if (token.startsWith('network-uncached')) return 'network-uncached';
	if (token.startsWith('network')) return 'network';
	if (token === 'memory') return 'memory';
	return allowedSources.has(token) ? token : 'unknown';
}

function normalizeMode(value) {
	return allowedModes.has(value) ? value : 'balanced';
}

function normalizeEffectiveType(value) {
	const token = cleanToken(value, 'unknown');
	return ['slow-2g', '2g', '3g', '4g'].includes(token) ? token : 'unknown';
}

export function createMushafNetworkProfile({ at = Date.now() } = {}) {
	return {
		version: MUSHAF_FIELD_SCHEMA_VERSION,
		updatedAt: at,
		sampleCount: 0,
		successCount: 0,
		failureCount: 0,
		ewmaLatencyMs: null,
		recentOutcomes: [],
		lastFailureAt: null,
		lastSuccessAt: null,
		adaptiveMode: 'balanced'
	};
}

export function deriveAdaptiveMushafMode(profile, { at = Date.now() } = {}) {
	if (!profile || profile.version !== MUSHAF_FIELD_SCHEMA_VERSION) return 'balanced';
	if (!Number.isFinite(profile.updatedAt) || at - profile.updatedAt > MUSHAF_NETWORK_PROFILE_TTL_MS) return 'balanced';

	const recent = Array.isArray(profile.recentOutcomes) ? profile.recentOutcomes.slice(-RECENT_OUTCOME_LIMIT) : [];
	if (!recent.length) return 'balanced';

	const successes = recent.filter((value) => value === 1).length;
	const successRatio = successes / recent.length;
	const recentFailures = recent.length - successes;
	const latency = finiteOrNull(profile.ewmaLatencyMs);
	const shortWindow = recent.slice(-4);
	const shortFailures = shortWindow.filter((value) => value === 0).length;

	if ((shortWindow.length >= 2 && shortFailures >= 2) || (recent.length >= 4 && successRatio < 0.6)) return 'recovery';
	if ((recent.length >= 3 && successRatio < 0.85) || (latency !== null && latency >= 5000)) return 'cautious';
	if (recent.length >= 5 && successRatio >= 0.9 && latency !== null && latency <= 1800) return 'fast';
	return 'balanced';
}

export function updateMushafNetworkProfile(profile, { ok, latencyMs = null, at = Date.now() } = {}) {
	const fresh =
		profile?.version === MUSHAF_FIELD_SCHEMA_VERSION &&
		Number.isFinite(profile.updatedAt) &&
		at - profile.updatedAt <= MUSHAF_NETWORK_PROFILE_TTL_MS;
	const base = fresh ? profile : createMushafNetworkProfile({ at });
	const latency = clampLatency(latencyMs);
	const previousLatency = finiteOrNull(base.ewmaLatencyMs);
	const nextLatency =
		latency === null
			? previousLatency
			: previousLatency === null
				? latency
				: Math.round(previousLatency * (1 - EWMA_ALPHA) + latency * EWMA_ALPHA);
	const recentOutcomes = [...(Array.isArray(base.recentOutcomes) ? base.recentOutcomes : []), ok ? 1 : 0].slice(-RECENT_OUTCOME_LIMIT);

	const next = {
		version: MUSHAF_FIELD_SCHEMA_VERSION,
		updatedAt: at,
		sampleCount: Math.min(1000, (base.sampleCount || 0) + 1),
		successCount: Math.min(1000, (base.successCount || 0) + (ok ? 1 : 0)),
		failureCount: Math.min(1000, (base.failureCount || 0) + (ok ? 0 : 1)),
		ewmaLatencyMs: nextLatency,
		recentOutcomes,
		lastFailureAt: ok ? base.lastFailureAt ?? null : at,
		lastSuccessAt: ok ? at : base.lastSuccessAt ?? null,
		adaptiveMode: 'balanced'
	};
	next.adaptiveMode = deriveAdaptiveMushafMode(next, { at });
	return next;
}

export function sanitizeMushafFieldEvent(
	type,
	{ at = Date.now(), ok = null, latencyMs = null, priority = 'none', source = 'unknown', reason = 'unknown', mode = null, effectiveType = 'unknown', failureStreak = null } = {}
) {
	const safeType = allowedEventTypes.has(type) ? type : 'network-health';
	return {
		version: MUSHAF_FIELD_SCHEMA_VERSION,
		at: Number.isFinite(at) ? at : Date.now(),
		type: safeType,
		ok: typeof ok === 'boolean' ? ok : null,
		latencyMs: clampLatency(latencyMs),
		priority: normalizePriority(priority),
		source: normalizeSource(source),
		reason: cleanToken(reason),
		mode: mode ? normalizeMode(mode) : null,
		effectiveType: normalizeEffectiveType(effectiveType),
		failureStreak: Number.isFinite(failureStreak) ? Math.max(0, Math.min(99, Math.round(failureStreak))) : null
	};
}

export function pruneMushafFieldEvents(events, { at = Date.now() } = {}) {
	const cutoff = at - MUSHAF_FIELD_EVENT_MAX_AGE_MS;
	return (Array.isArray(events) ? events : [])
		.filter((event) => event && Number.isFinite(event.at) && event.at >= cutoff)
		.slice(-MAX_MUSHAF_FIELD_EVENTS);
}

function safeReadJson(key, fallback) {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const parsed = JSON.parse(localStorage.getItem(key) || 'null');
		return parsed ?? fallback;
	} catch {
		return fallback;
	}
}

function safeWriteJson(key, value) {
	if (typeof localStorage === 'undefined') return false;
	try {
		localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch (error) {
		console.warn('[Fonts] Unable to persist field diagnostic state.', error);
		return false;
	}
}

export function readMushafNetworkProfile({ at = Date.now() } = {}) {
	const raw = safeReadJson(MUSHAF_NETWORK_PROFILE_KEY, null);
	if (!raw || raw.version !== MUSHAF_FIELD_SCHEMA_VERSION) return createMushafNetworkProfile({ at });
	const mode = deriveAdaptiveMushafMode(raw, { at });
	return { ...raw, adaptiveMode: mode };
}

export function recordMushafFieldDiagnostic(type, detail = {}) {
	const event = sanitizeMushafFieldEvent(type, detail);
	const existing = safeReadJson(MUSHAF_FIELD_DIAGNOSTICS_KEY, []);
	const next = pruneMushafFieldEvents([...(Array.isArray(existing) ? existing : []), event], { at: event.at });
	safeWriteJson(MUSHAF_FIELD_DIAGNOSTICS_KEY, next);
	return event;
}

export function recordMushafNetworkOutcome({ ok, latencyMs = null, priority = 'critical', source = 'unknown', reason = 'font-request', effectiveType = 'unknown', at = Date.now() } = {}) {
	const previous = readMushafNetworkProfile({ at });
	const previousMode = previous.adaptiveMode;
	const next = updateMushafNetworkProfile(previous, { ok: Boolean(ok), latencyMs, at });
	safeWriteJson(MUSHAF_NETWORK_PROFILE_KEY, next);

	recordMushafFieldDiagnostic(ok ? 'network-success' : 'network-failure', {
		at,
		ok: Boolean(ok),
		latencyMs,
		priority,
		source,
		reason,
		mode: next.adaptiveMode,
		effectiveType
	});

	if (next.adaptiveMode !== previousMode) {
		recordMushafFieldDiagnostic('adaptive-mode', {
			at,
			ok: Boolean(ok),
			mode: next.adaptiveMode,
			reason: `${previousMode}-to-${next.adaptiveMode}`,
			effectiveType
		});
	}
	return next;
}

export function readMushafFieldDiagnostics({ at = Date.now() } = {}) {
	const events = pruneMushafFieldEvents(safeReadJson(MUSHAF_FIELD_DIAGNOSTICS_KEY, []), { at });
	return {
		schemaVersion: MUSHAF_FIELD_SCHEMA_VERSION,
		generatedAt: new Date(at).toISOString(),
		privacy: 'technical-only:no-reading-content:no-url:no-location:no-ssid:no-ip',
		profile: readMushafNetworkProfile({ at }),
		events
	};
}

export function clearMushafFieldDiagnostics({ at = Date.now() } = {}) {
	try {
		localStorage.removeItem(MUSHAF_FIELD_DIAGNOSTICS_KEY);
		localStorage.removeItem(MUSHAF_NETWORK_PROFILE_KEY);
	} catch {
		// Best-effort local cleanup.
	}
	return createMushafNetworkProfile({ at });
}
