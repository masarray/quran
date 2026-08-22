import { defaultSettings } from '$src/hooks.client';
import { showAlert } from '$utils/confirmationAlertHandler';

function mergeWithDefaults(imported, defaults) {
	if (typeof defaults !== 'object' || defaults === null) {
		return typeof imported === typeof defaults ? imported : defaults;
	}

	if (Array.isArray(defaults)) {
		return Array.isArray(imported) ? imported : defaults;
	}

	const result = {};
	for (const key in defaults) {
		if (key in imported) {
			result[key] = mergeWithDefaults(imported[key], defaults[key]);
		} else {
			result[key] = defaults[key];
		}
	}
	return result;
}

function encodeSettings(json) {
	const str = JSON.stringify(json);
	return btoa(str.split('').reverse().join(''));
}

function decodeSettings(encoded) {
	try {
		const reversed = atob(encoded).split('').reverse().join('');
		return JSON.parse(reversed);
	} catch (error) {
		console.warn(error);
		throw new Error('Berkas pengaturan tidak valid');
	}
}

function normalizeFilename(filename) {
	if (filename.endsWith('.qwbw.txt')) {
		return filename.replace(/\.qwbw\.txt$/, '.qwbw');
	}
	if (!filename.endsWith('.qwbw')) {
		return filename + '.qwbw';
	}
	return filename;
}

export function importSettings(file) {
	if (!file || !(file instanceof File)) {
		showAlert('Berkas tidak valid.', 'settings-drawer');
		return;
	}
	if (!file.name.endsWith('.qwbw') && !file.name.endsWith('.qwbw.txt')) {
		showAlert('Jenis berkas tidak valid. Pilih berkas pengaturan Al Quran (.qwbw).', 'settings-drawer');
		return;
	}

	window.umami.track('Import Settings');

	const reader = new FileReader();
	reader.onload = function (e) {
		try {
			const imported = decodeSettings(e.target.result);
			const validated = mergeWithDefaults(imported, defaultSettings);

			localStorage.setItem('userSettings', JSON.stringify(validated));
			location.reload();
		} catch (error) {
			showAlert('Terjadi kesalahan saat memulihkan pengaturan dari berkas.', 'settings-drawer');
			console.warn(error);
		}
	};
	reader.readAsText(file);
}

export function exportSettings() {
	const settings = JSON.parse(localStorage.getItem('userSettings') || '{}');
	if (!settings || Object.keys(settings).length === 0) {
		showAlert('Pengaturan belum tersedia untuk dicadangkan.', 'settings-drawer');
		return;
	}

	const encoded = encodeSettings(settings);

	const now = new Date();
	const pad = (n) => n.toString().padStart(2, '0');
	const date = now.toISOString().split('T')[0];
	const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

	const rawFilename = `al-quran-pengaturan-${date}_${time}.qwbw`;
	const filename = normalizeFilename(rawFilename);

	const blob = new Blob([encoded], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);

	URL.revokeObjectURL(url);

	window.umami.track('Export Settings');
}
