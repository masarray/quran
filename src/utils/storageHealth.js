const MB = 1024 * 1024;

export class StorageCapacityError extends Error {
	constructor({ requiredBytes, availableBytes, reserveBytes }) {
		const requiredMB = Math.ceil(requiredBytes / MB);
		const availableMB = Math.max(0, Math.floor(availableBytes / MB));
		super(`Ruang penyimpanan tidak cukup. Diperlukan sekitar ${requiredMB} MB, sementara ruang aman yang tersedia sekitar ${availableMB} MB.`);
		this.name = 'StorageCapacityError';
		this.requiredBytes = requiredBytes;
		this.availableBytes = availableBytes;
		this.reserveBytes = reserveBytes;
	}
}

export function isQuotaExceededError(error) {
	return error?.name === 'QuotaExceededError' || error?.name === 'StorageCapacityError' || error?.code === 22 || error?.code === 1014;
}

export async function getStorageEstimate() {
	if (!navigator.storage?.estimate) return null;

	try {
		const estimate = await navigator.storage.estimate();
		const usage = Number.isFinite(estimate.usage) ? estimate.usage : 0;
		const quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
		return {
			usage,
			quota,
			available: quota === null ? null : Math.max(0, quota - usage)
		};
	} catch (error) {
		console.warn('[Storage] Unable to estimate storage', error);
		return null;
	}
}

export async function requestPersistentStorage() {
	if (!navigator.storage?.persist) return null;

	try {
		if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
		return await navigator.storage.persist();
	} catch (error) {
		console.warn('[Storage] Persistent storage request failed', error);
		return false;
	}
}

export async function ensureStorageCapacity(requiredMB, { reserveMB = 25, reserveRatio = 0.05 } = {}) {
	const requiredBytes = Math.max(0, requiredMB) * MB;
	const persisted = await requestPersistentStorage();
	const estimate = await getStorageEstimate();

	if (!estimate || estimate.quota === null || estimate.available === null) {
		return { persisted, estimate, sufficient: true };
	}

	const reserveBytes = Math.max(reserveMB * MB, estimate.quota * reserveRatio);
	if (estimate.available < requiredBytes + reserveBytes) {
		throw new StorageCapacityError({
			requiredBytes,
			availableBytes: Math.max(0, estimate.available - reserveBytes),
			reserveBytes
		});
	}

	return {
		persisted,
		estimate,
		sufficient: true,
		requiredBytes,
		reserveBytes
	};
}
