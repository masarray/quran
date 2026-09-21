const DIAGNOSTICS_KEY = 'quranRuntimeDiagnostics';
const MAX_DIAGNOSTICS = 12;
let installed = false;

function normalizeError(error) {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: String(error.message || '').slice(0, 500),
			stack: String(error.stack || '').slice(0, 1600)
		};
	}

	return {
		name: typeof error,
		message: String(error ?? 'Unknown error').slice(0, 500),
		stack: ''
	};
}

export function recordRuntimeDiagnostic({ type = 'runtime', error, status = null, path = null } = {}) {
	try {
		const raw = localStorage.getItem(DIAGNOSTICS_KEY);
		const existing = raw ? JSON.parse(raw) : [];
		const items = Array.isArray(existing) ? existing : [];
		const normalized = normalizeError(error);

		items.push({
			at: new Date().toISOString(),
			type,
			status: Number.isFinite(status) ? status : null,
			path: typeof path === 'string' ? path.slice(0, 300) : location.pathname,
			...normalized
		});

		localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(items.slice(-MAX_DIAGNOSTICS)));
	} catch (diagnosticError) {
		console.warn('[Diagnostics] Unable to persist runtime diagnostic.', diagnosticError);
	}
}

export function installRuntimeDiagnostics() {
	if (installed || typeof window === 'undefined') return;
	installed = true;

	window.addEventListener('error', (event) => {
		recordRuntimeDiagnostic({
			type: 'window-error',
			error: event.error || event.message,
			path: location.pathname
		});
	});

	window.addEventListener('unhandledrejection', (event) => {
		recordRuntimeDiagnostic({
			type: 'unhandled-rejection',
			error: event.reason,
			path: location.pathname
		});
	});
}

export function readRuntimeDiagnostics() {
	try {
		const parsed = JSON.parse(localStorage.getItem(DIAGNOSTICS_KEY) || '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
