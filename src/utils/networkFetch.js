const DEFAULT_RETRY_STATUSES = new Set([408, 425, 429]);

export function isRetryableHttpStatus(status) {
	return DEFAULT_RETRY_STATUSES.has(status) || (status >= 500 && status <= 599);
}

export function isAudioContentType(contentType) {
	const normalized = String(contentType || '').toLowerCase().split(';', 1)[0].trim();
	return normalized.startsWith('audio/') || normalized === 'application/octet-stream';
}

export function isUsableAudioResponse(response) {
	return Boolean(response?.ok && isAudioContentType(response.headers?.get?.('content-type')));
}

function delay(ms, signal) {
	if (ms <= 0) return Promise.resolve();

	return new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, ms);
		if (!signal) return;

		const onAbort = () => {
			clearTimeout(timer);
			reject(signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'));
		};
		if (signal.aborted) return onAbort();
		signal.addEventListener('abort', onAbort, { once: true });
	});
}

function createAttemptSignal(parentSignal, timeoutMs) {
	const controller = new AbortController();
	let timeoutId = null;
	let parentAbortHandler = null;

	if (parentSignal) {
		parentAbortHandler = () => controller.abort(parentSignal.reason);
		if (parentSignal.aborted) parentAbortHandler();
		else parentSignal.addEventListener('abort', parentAbortHandler, { once: true });
	}

	if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
		timeoutId = setTimeout(() => {
			controller.abort(new DOMException(`Request timed out after ${timeoutMs} ms`, 'TimeoutError'));
		}, timeoutMs);
	}

	return {
		signal: controller.signal,
		cleanup() {
			if (timeoutId !== null) clearTimeout(timeoutId);
			if (parentSignal && parentAbortHandler) parentSignal.removeEventListener('abort', parentAbortHandler);
		}
	};
}

function retryDelay(baseDelayMs, attempt, maxDelayMs) {
	return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
}

export async function fetchWithRetry(
	input,
	init = {},
	{
		attempts = 3,
		baseDelayMs = 350,
		maxDelayMs = 2500,
		timeoutMs = 30000,
		shouldRetryStatus = isRetryableHttpStatus,
		onRetry
	} = {}
) {
	const totalAttempts = Math.max(1, Math.floor(attempts));
	let lastError = null;

	for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
		if (init.signal?.aborted) {
			throw init.signal.reason instanceof Error ? init.signal.reason : new DOMException('Aborted', 'AbortError');
		}

		const attemptSignal = createAttemptSignal(init.signal, timeoutMs);
		try {
			const response = await fetch(input, { ...init, signal: attemptSignal.signal });
			if (!shouldRetryStatus(response.status) || attempt === totalAttempts) return response;

			try {
				await response.body?.cancel();
			} catch {
				// Releasing a retryable response body is best-effort.
			}

			const waitMs = retryDelay(baseDelayMs, attempt, maxDelayMs);
			onRetry?.({ attempt, nextAttempt: attempt + 1, waitMs, status: response.status, error: null });
			await delay(waitMs, init.signal);
		} catch (error) {
			if (init.signal?.aborted) throw error;

			lastError = error;
			if (attempt === totalAttempts) throw error;

			const waitMs = retryDelay(baseDelayMs, attempt, maxDelayMs);
			onRetry?.({ attempt, nextAttempt: attempt + 1, waitMs, status: null, error });
			await delay(waitMs, init.signal);
		} finally {
			attemptSignal.cleanup();
		}
	}

	throw lastError ?? new Error('Network request failed after retries.');
}
