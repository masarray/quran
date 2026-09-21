export const KRL_NETWORK_BASE_COOLDOWN_MS = 5000;
export const KRL_NETWORK_MAX_COOLDOWN_MS = 120000;
export const KRL_ACTIVE_RETRY_MAX_DELAY_MS = 60000;

export function createMushafFontNetworkHealth({ online = true, at = Date.now() } = {}) {
	return {
		status: online ? 'unknown' : 'offline',
		failureStreak: 0,
		successStreak: 0,
		cooldownUntil: 0,
		lastFailureAt: null,
		lastSuccessAt: null,
		lastSignalAt: at,
		lastReason: online ? 'startup' : 'offline'
	};
}

export function markMushafFontNetworkFailure(state, { at = Date.now(), offline = false, reason = 'font-request-failed' } = {}) {
	const failureStreak = (state?.failureStreak || 0) + 1;
	const cooldownMs = Math.min(
		KRL_NETWORK_MAX_COOLDOWN_MS,
		KRL_NETWORK_BASE_COOLDOWN_MS * 2 ** Math.min(failureStreak - 1, 5)
	);

	return {
		...state,
		status: offline ? 'offline' : 'degraded',
		failureStreak,
		successStreak: 0,
		cooldownUntil: offline ? at + KRL_NETWORK_MAX_COOLDOWN_MS : at + cooldownMs,
		lastFailureAt: at,
		lastSignalAt: at,
		lastReason: reason
	};
}

export function markMushafFontNetworkSignal(state, { online, at = Date.now(), reason = online ? 'online-signal' : 'offline-signal' } = {}) {
	if (!online) return markMushafFontNetworkFailure(state, { at, offline: true, reason });

	return {
		...state,
		status: state?.failureStreak ? 'probing' : state?.status === 'offline' ? 'probing' : state?.status || 'unknown',
		lastSignalAt: at,
		lastReason: reason
	};
}

export function markMushafFontNetworkSuccess(state, { at = Date.now(), reason = 'font-request-success' } = {}) {
	return {
		...state,
		status: 'healthy',
		failureStreak: 0,
		successStreak: (state?.successStreak || 0) + 1,
		cooldownUntil: 0,
		lastSuccessAt: at,
		lastSignalAt: at,
		lastReason: reason
	};
}

export function canPrefetchMushafFonts(state, { online = true, at = Date.now() } = {}) {
	if (!online) return false;
	if (!state) return true;
	if (state.status === 'offline' || state.status === 'degraded') return false;
	if (state.failureStreak > 0) return false;
	return !state.cooldownUntil || state.cooldownUntil <= at;
}

export function getMushafFontActiveRetryDelay({ attempts = 0, networkFailureStreak = 0 } = {}) {
	const exponent = Math.min(Math.max(attempts, networkFailureStreak, 1) - 1, 5);
	return Math.min(KRL_ACTIVE_RETRY_MAX_DELAY_MS, 2000 * 2 ** exponent);
}
