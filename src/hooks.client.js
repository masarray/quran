/* eslint-disable no-prototype-builtins */
import '$utils/indonesianUX';
import { defaultSettings } from '$data/defaultSettings';
import { loadUserSettings } from '$utils/settingsStorage';

export { defaultSettings };

// Repair missing or malformed settings before any route/store consumes them.
// This is intentionally synchronous because localStorage is synchronous and
// application stores are initialized immediately after the client hook loads.
setUserSettings(defaultSettings);

export function setUserSettings(defaults = defaultSettings) {
	return loadUserSettings(defaults, { persist: true });
}
