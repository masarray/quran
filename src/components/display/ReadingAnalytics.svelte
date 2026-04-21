<script>
	import { __readingAnalytics } from '$utils/stores';

	const cardClasses = 'rounded-2xl border border-theme-accent/15 bg-theme-accent/5 p-5';
	const todayKey = new Date().toISOString().slice(0, 10);

	$: entries = Array.isArray($__readingAnalytics?.entries) ? $__readingAnalytics.entries : [];
	$: todayEntry = entries.find((entry) => entry.day === todayKey);
	$: last7Days = entries.slice(-7);
	$: weeklyPages = last7Days.reduce((total, entry) => total + (entry.pages?.length || 0), 0);
	$: weeklyVerses = last7Days.reduce((total, entry) => total + (entry.verses?.length || 0), 0);
	$: maxPages = Math.max(...last7Days.map((entry) => entry.pages?.length || 0), 1);
</script>

<div class="space-y-4">
	<div class="grid md:grid-cols-3 gap-3">
		<div class={cardClasses}>
			<div class="text-xs opacity-70">Halaman hari ini</div>
			<div class="mt-2 text-2xl font-semibold">{todayEntry?.pages?.length || 0}</div>
		</div>
		<div class={cardClasses}>
			<div class="text-xs opacity-70">Ayat terlacak hari ini</div>
			<div class="mt-2 text-2xl font-semibold">{todayEntry?.verses?.length || 0}</div>
		</div>
		<div class={cardClasses}>
			<div class="text-xs opacity-70">Total 7 hari</div>
			<div class="mt-2 text-2xl font-semibold">{weeklyPages}</div>
			<div class="text-xs opacity-70">halaman, {weeklyVerses} ayat</div>
		</div>
	</div>

	<div class={cardClasses}>
		<div class="flex items-center justify-between gap-4">
			<div>
				<div class="text-sm font-medium">Grafik bacaan 7 hari terakhir</div>
				<div class="text-xs opacity-70">Berdasarkan halaman unik yang terbaca per hari.</div>
			</div>
		</div>

		{#if last7Days.length > 0}
			<div class="mt-5 grid grid-cols-7 gap-2 items-end h-44">
				{#each last7Days as entry}
					{@const pagesRead = entry.pages?.length || 0}
					{@const barHeight = Math.max(16, Math.round((pagesRead / maxPages) * 120))}
					<div class="flex flex-col items-center justify-end h-full">
						<div class="text-[11px] mb-2 opacity-70">{pagesRead}</div>
						<div class="w-full max-w-[42px] rounded-t-2xl bg-theme-accent/80" style={`height:${barHeight}px`} />
						<div class="mt-2 text-[11px] opacity-70">{entry.day.slice(5)}</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="mt-4 text-sm opacity-70">Belum ada rekap bacaan. Mulai baca, lalu statistik akan muncul di sini.</div>
		{/if}
	</div>
</div>
