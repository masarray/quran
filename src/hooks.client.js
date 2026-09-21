/* eslint-disable no-prototype-builtins */
import '$utils/indonesianUX';
import { defaultSettings } from '$data/defaultSettings';
import { loadUserSettings } from '$utils/settingsStorage';
import { installRuntimeDiagnostics, recordRuntimeDiagnostic } from '$utils/runtimeDiagnostics';

export { defaultSettings };

// Repair missing or malformed settings before any route/store consumes them.
// This is intentionally synchronous because localStorage is synchronous and
// application stores are initialized immediately after the client hook loads.
setUserSettings(defaultSettings);
installRuntimeDiagnostics();

export function setUserSettings(defaults = defaultSettings) {
	return loadUserSettings(defaults, { persist: true });
}

export function handleError({ error, event, status, message }) {
	recordRuntimeDiagnostic({
		type: 'sveltekit-error',
		error: error || message,
		status,
		path: event?.url?.pathname || location.pathname
	});

	return {
		message: 'Terjadi kendala saat memuat aplikasi. Data diagnostik disimpan secara lokal untuk membantu pemulihan.'
	};
}
