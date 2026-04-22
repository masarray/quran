<script>
	import { __readingAnalytics } from '$utils/stores';

	$: entries = Array.isArray($__readingAnalytics?.entries) ? $__readingAnalytics.entries : [];
	$: last7Days = entries.slice(-7);

	$: weeklyPages = last7Days.reduce((total, entry) => total + (entry.pages?.length || 0), 0);
	$: weeklyVerses = last7Days.reduce((total, entry) => total + (entry.verses?.length || 0), 0);
	$: bars = last7Days.map((entry) => entry.pages?.length || 0);
	$: maxBar = Math.max(...bars, 1);

	const dayLabels = ['A', 'S', 'S', 'R', 'K', 'J', 'S'];

	function barHeight(value) {
		if (maxBar <= 0) return 8;
		return Math.max(10, Math.round((value / maxBar) * 28));
	}

	function isHighlighted(value, index) {
		if (!bars.length) return false;
		const max = Math.max(...bars);
		if (max <= 0) return false;

		const lastMaxIndex = bars.lastIndexOf(max);
		return value > 0 && index === lastMaxIndex;
	}
</script>

<div class="analytics-gold-card">
	<div class="gold-wash"></div>
	<div class="gold-sheen"></div>

	<div class="analytics-inner">
		<div class="left-block">
			<div class="mini-cover">
				<div class="mini-cover-core svg-mark" aria-hidden="true">
					<svg
						viewBox="0 0 200 200"
						class="quran-mark"
						xmlns="http://www.w3.org/2000/svg"
					>
						<g>
							<path
								fill="currentColor"
								d="M11.879,83.638l52.538,30.406L31.931,132.84c-0.448,0.26-0.806,0.654-1.019,1.127l-13.527,29.973
								l0.012,0.005c-0.23,0.509-0.299,1.09-0.146,1.66c0.29,1.084,1.273,1.839,2.396,1.839h22.999c0.438,0,0.866-0.116,1.244-0.334
								L100,134.637l56.11,32.474c0.378,0.218,0.807,0.334,1.244,0.334h22.998c1.122,0,2.106-0.755,2.396-1.839
								c0.153-0.569,0.085-1.15-0.146-1.66l0.012-0.005l-13.525-29.973c-0.214-0.473-0.57-0.868-1.02-1.127l-32.487-18.797
								l52.538-30.405c1.185-0.686,1.59-2.204,0.906-3.39l-5.749-9.958c-0.329-0.571-0.871-0.987-1.508-1.157
								c-0.639-0.169-1.314-0.082-1.886,0.25l-2.969,1.719l-6.887-11.926c-0.098-0.166-0.21-0.318-0.34-0.455h0.002l-23.752-25.377
								c-0.784-0.84-2.047-1.03-3.041-0.46c-7.759,4.425-15.644,7.438-21.402,9.638l-1.722,0.659
								c-10.405,4.011-16.352,8.846-19.331,16.839c-2.97-7.93-8.892-12.815-19.332-16.84l-1.71-0.655
								c-5.76-2.201-13.649-5.213-21.412-9.642c-0.997-0.568-2.257-0.379-3.042,0.46L31.194,58.72h0.002
								c-0.13,0.137-0.242,0.289-0.339,0.455l-7.107,12.31l-3.634-2.103c-0.573-0.331-1.249-0.418-1.884-0.25
								c-0.637,0.17-1.181,0.586-1.51,1.157l-5.75,9.958C10.289,81.435,10.694,82.952,11.879,83.638z M35.107,136.737l34.268-19.825
								l14.178,8.206l-58.469,33.83L35.107,136.737z M41.98,162.479H28.894l59.614-34.493l6.536,3.782L41.98,162.479z
								M164.894,136.737l10.022,22.21l-58.469-33.83l14.18-8.207L164.894,136.737z M180.222,74.924l3.267,5.66l-71.999,41.667
								l-6.533-3.78L180.222,74.924z M172.619,73.587l-69.606,40.272c0.619-14.917,5.069-20.828,18.548-26.022l2.571-0.983
								c10.636-4.048,29.91-11.386,43.121-22.56L172.619,73.587z M121.561,47.812l1.707-0.654c5.182-1.979,12.824-4.9,20.374-9.006
								l20.681,22.097c-12.551,10.758-31.524,17.995-41.956,21.967l-2.592,0.99c-8.068,3.11-13.444,6.723-16.85,11.91V77.836
								C102.925,59.905,106.93,53.451,121.561,47.812z M57.246,38.151c7.554,4.109,15.199,7.03,20.384,9.01l1.696,0.65
								c13.999,5.396,18.17,11.512,18.599,27.259c0.015,0.559,0.026,1.128,0.032,1.708h0.023c-0.005,0.358-0.02,0.692-0.02,1.057
								v17.279c-3.403-5.188-8.781-8.8-16.849-11.91l-2.588-0.989c-10.434-3.972-29.409-11.208-41.961-21.968L57.246,38.151z
								M33.633,64.294c13.213,11.176,32.49,18.513,43.125,22.562l2.568,0.981c13.64,5.258,18.041,11.233,18.574,26.55L28.047,73.971
								L33.633,64.294z M19.78,74.924l151.326,87.555h-13.085L16.512,80.583L19.78,74.924z"
							/>
						</g>
					</svg>
				</div>

				<div class="mini-ribbon"></div>
			</div>

			<div class="copy-block">
				<div class="eyebrow">Aktivitas bacaan</div>

				<div class="title">
					Pekan ini kamu telah
					<br />
					membaca
				</div>

				<div class="value-row">
					<div class="value">{weeklyPages}</div>
					<div class="unit">halaman</div>
				</div>

				<div class="subcopy">{weeklyVerses} ayat terlacak dalam 7 hari terakhir</div>
			</div>
		</div>

		<div class="chart-block">
			<div class="chart-value-strip">
				{#each bars as value}
					<div class="value-badge {value > 0 ? 'show' : ''}">
						{#if value > 0}{value}{/if}
					</div>
				{/each}
			</div>

			<div class="bars-wrap">
				{#each bars as value, i}
					<div class="bar-col">
						<div class="bar-track">
							<div
								class="bar-fill"
								class:active={isHighlighted(value, i)}
								style={`height:${barHeight(value)}px`}
							></div>
						</div>
						<div class="bar-day">{dayLabels[i] || ''}</div>
					</div>
				{/each}
			</div>

			<div class="footer-pill">
				<span>Terbaik minggu ini</span>
				<strong>{Math.max(...bars, 0)} halaman</strong>
			</div>
		</div>
	</div>
</div>

<style>
	.analytics-gold-card {
		--accent: rgb(var(--theme-accent-rgb));
		position: relative;
		overflow: hidden;
		border-radius: 24px;
		padding: 0.95rem;
		border: 1px solid rgb(var(--theme-accent-rgb) / 0.14);
		background:
			radial-gradient(circle at 85% 20%, rgb(var(--theme-accent-rgb) / 0.12), transparent 40%),
			radial-gradient(circle at 10% 90%, rgb(var(--theme-accent-rgb) / 0.08), transparent 40%),
			linear-gradient(180deg, rgb(var(--theme-accent-rgb) / 0.045), rgb(var(--theme-accent-rgb) / 0.018)),
			linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.58));
		box-shadow:
			0 10px 24px rgba(0, 0, 0, 0.025),
			inset 0 1px 0 rgba(255, 255, 255, 0.7);
	}

	:global(.dark) .analytics-gold-card {
		background:
			radial-gradient(circle at 85% 20%, rgb(var(--theme-accent-rgb) / 0.15), transparent 42%),
			radial-gradient(circle at 10% 90%, rgb(var(--theme-accent-rgb) / 0.1), transparent 40%),
			linear-gradient(180deg, rgb(var(--theme-accent-rgb) / 0.08), rgb(var(--theme-accent-rgb) / 0.03)),
			linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0.01));
		box-shadow:
			0 10px 24px rgba(0, 0, 0, 0.16),
			inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.gold-wash {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at top right, rgb(var(--theme-accent-rgb) / 0.08), transparent 34%),
			radial-gradient(circle at bottom left, rgb(var(--theme-accent-rgb) / 0.05), transparent 30%);
		pointer-events: none;
	}

	.gold-sheen {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			115deg,
			transparent 0%,
			transparent 38%,
			rgba(255, 255, 255, 0.16) 50%,
			transparent 62%,
			transparent 100%
		);
		opacity: 0.45;
		pointer-events: none;
	}

	.analytics-inner {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(160px, 0.85fr);
		gap: 0.95rem;
		align-items: center;
	}

	.left-block {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
	}

	.mini-cover {
		position: relative;
		width: 69px;
		height: 78px;
		border-radius: 16px;
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		background:
			radial-gradient(circle at 50% 35%, rgb(var(--theme-accent-rgb) / 0.22), transparent 52%),
			linear-gradient(135deg, rgb(var(--theme-accent-rgb) / 0.92), rgb(var(--theme-accent-rgb) / 0.72));
		box-shadow:
			0 8px 18px rgb(var(--theme-accent-rgb) / 0.16),
			inset 0 1px 0 rgba(255, 255, 255, 0.35);
	}

	.mini-cover::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 16px;
		background:
			linear-gradient(
				45deg,
				rgba(255, 255, 255, 0.06) 25%,
				transparent 25%,
				transparent 50%,
				rgba(255, 255, 255, 0.06) 50%,
				rgba(255, 255, 255, 0.06) 75%,
				transparent 75%,
				transparent
			);
		background-size: 14px 14px;
		opacity: 0.5;
	}

	.mini-cover-core {
		position: relative;
		z-index: 1;
		width: 65px;
		height: 65px;
		display: grid;
		place-items: center;
	}

	.mini-cover-core.svg-mark {
		color: #fff7e7;
		filter: drop-shadow(0 1px 3px rgba(88, 55, 0, 0.15));
	}

	.quran-mark {
		width: 100%;
		height: 100%;
		display: block;
	}

	.mini-ribbon {
		position: absolute;
		left: 8px;
		right: 8px;
		bottom: 3px;
		height: 9px;
		border-radius: 999px;
		background: linear-gradient(180deg, #f6efde, #eadfc9);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
	}

	.copy-block {
		min-width: 0;
	}

	.eyebrow {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		opacity: 0.48;
	}

	.title {
		margin-top: 0.2rem;
		font-size: 1rem;
		line-height: 1.22;
		font-weight: 500;
		letter-spacing: -0.01em;
	}

	.value-row {
		margin-top: 0.42rem;
		display: flex;
		align-items: flex-end;
		gap: 0.35rem;
	}

	.value {
		font-size: 2.65rem;
		line-height: 0.92;
		font-weight: 700;
		letter-spacing: -0.04em;
		color: var(--accent);
	}

	.unit {
		font-size: 0.92rem;
		line-height: 1;
		padding-bottom: 0.22rem;
		opacity: 0.72;
	}

	.subcopy {
		margin-top: 0.18rem;
		font-size: 0.72rem;
		opacity: 0.6;
	}

	.chart-block {
		min-width: 0;
		padding-left: 0.25rem;
	}

	.chart-value-strip {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.28rem;
		margin-bottom: 0.18rem;
		min-height: 18px;
	}

	.value-badge {
		text-align: center;
		font-size: 0.75rem;
		font-weight: 600;
		opacity: 0;
		transform: translateY(2px);
		transition: 160ms ease;
		color: rgb(var(--theme-accent-rgb) / 0.86);
	}

	.value-badge.show {
		opacity: 1;
		transform: translateY(0);
	}

	.bars-wrap {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.28rem;
		align-items: end;
	}

	.bar-col {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.bar-track {
		height: 34px;
		display: flex;
		align-items: end;
	}

	.bar-fill {
		width: 100%;
		max-width: 18px;
		min-width: 10px;
		border-radius: 3px 3px 0 0;
		background: linear-gradient(
			180deg,
			rgb(var(--theme-accent-rgb) / 0.28),
			rgb(var(--theme-accent-rgb) / 0.18)
		);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
		opacity: 0.65;
		transition: all 0.25s ease;
	}

	.bar-fill.active {
		background: linear-gradient(
			180deg,
			rgb(var(--theme-accent-rgb)),
			rgb(var(--theme-accent-rgb) / 0.72)
		);
		box-shadow:
			0 6px 14px rgb(var(--theme-accent-rgb) / 0.18),
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
		opacity: 1;
	}

	.bar-day {
		margin-top: 0.28rem;
		font-size: 0.66rem;
		font-weight: 500;
		opacity: 0.52;
	}

	.footer-pill {
		margin-top: 0.6rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.46rem 0.7rem;
		border-radius: 999px;
		border: 1px solid rgb(var(--theme-accent-rgb) / 0.1);
		background: rgb(var(--theme-accent-rgb) / 0.04);
		font-size: 0.72rem;
	}

	.footer-pill span {
		opacity: 0.62;
	}

	.footer-pill strong {
		font-size: 0.76rem;
		color: var(--accent);
	}

	@media (max-width: 640px) {
		.analytics-inner {
			grid-template-columns: 1fr;
			gap: 0.8rem;
		}

		.chart-block {
			padding-left: calc(62px + 0.85rem);
		}

		.title {
			font-size: 0.96rem;
		}

		.value {
			font-size: 2.35rem;
		}
	}
</style>