import { updateSettings } from '$utils/updateSettings';

const longPressDelay = 500;
const touchMoveTolerance = 10;
const interactiveSelector = 'button, a, [role="button"], input, textarea, select, [data-ignore-reading-anchor]';

export function readingAnchor(node, meta) {
	let verseMeta = meta;
	let pointerStart = { x: 0, y: 0 };
	let pointerMoved = false;
	let timer = null;

	function clearTimer() {
		if (!timer) return;
		clearTimeout(timer);
		timer = null;
	}

	function shouldIgnore(event) {
		return event.target?.closest?.(interactiveSelector);
	}

	function pointerDown(event) {
		if (!verseMeta || shouldIgnore(event)) return;

		pointerStart = { x: event.clientX, y: event.clientY };
		pointerMoved = false;
		clearTimer();

		timer = setTimeout(() => {
			if (pointerMoved) return;
			updateSettings({
				type: 'lastRead',
				value: verseMeta,
				source: 'manual'
			});
		}, longPressDelay);
	}

	function pointerMove(event) {
		const distanceX = Math.abs(event.clientX - pointerStart.x);
		const distanceY = Math.abs(event.clientY - pointerStart.y);
		if (distanceX > touchMoveTolerance || distanceY > touchMoveTolerance) {
			pointerMoved = true;
			clearTimer();
		}
	}

	node.addEventListener('pointerdown', pointerDown);
	node.addEventListener('pointermove', pointerMove);
	node.addEventListener('pointerup', clearTimer);
	node.addEventListener('pointercancel', clearTimer);
	node.addEventListener('pointerleave', clearTimer);

	return {
		update(nextMeta) {
			verseMeta = nextMeta;
		},
		destroy() {
			clearTimer();
			node.removeEventListener('pointerdown', pointerDown);
			node.removeEventListener('pointermove', pointerMove);
			node.removeEventListener('pointerup', clearTimer);
			node.removeEventListener('pointercancel', clearTimer);
			node.removeEventListener('pointerleave', clearTimer);
		}
	};
}
