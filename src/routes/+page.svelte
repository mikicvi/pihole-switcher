<script lang="ts">
	import { getBlockingStatus, getTopDomains, setBlocking, type TopDomain } from '../lib/api.js';
	import { setBlockingState as publishBlocking } from '../lib/blockingState.svelte.js';
	import Switch from '../components/Switch.svelte';
	import SegmentedControl from '../components/SegmentedControl.svelte';
	import Pie from '../components/Pie.svelte';

	type ChartTab = 'ads' | 'queries';
	const PIE_PALETTE = ['#ff6384', '#ff9f40', '#ffcd56', '#4bc0c0', '#36a2ea', '#9966ff'];

	const DURATIONS = [
		{ value: 300, label: '5m' },
		{ value: 900, label: '15m' },
		{ value: 3600, label: '1h' },
		{ value: 86400, label: '24h' }
	] as const;

	let blocking = $state<boolean | null>(null);
	let pauseUntil = $state<number | null>(null);
	let pauseTotal = $state<number | null>(null);
	let now = $state(Date.now());
	let duration = $state<number>(300);

	let topAds = $state<TopDomain[]>([]);
	let topQueries = $state<TopDomain[]>([]);
	let chartTab = $state<ChartTab>('ads');
	const activeDomains = $derived(chartTab === 'ads' ? topAds : topQueries);
	let topLoading = $state(true);
	let topLoadedAt = $state<number | null>(null);
	let error = $state<string | null>(null);

	let acting = $state(false);

	const remaining = $derived(
		pauseUntil && pauseTotal
			? Math.max(0, Math.ceil((pauseUntil - now) / 1000))
			: null
	);
	const paused = $derived(blocking === false && remaining !== null && remaining > 0);
	const progress = $derived(
		pauseTotal && pauseUntil && pauseUntil > 0
			? Math.min(1, Math.max(0, 1 - (pauseUntil - now) / (pauseTotal * 1000)))
			: 0
	);

	function updateBlocking(v: boolean | null) {
		blocking = v;
		publishBlocking(v);
	}

	function fmtRemaining(s: number | null): string {
		if (s === null) return '';
		if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
		return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
	}

	function fmtAgo(ts: number | null): string | null {
		if (!ts) return null;
		const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
		if (s < 5) return 'just now';
		if (s < 60) return `${s}s ago`;
		return `${Math.floor(s / 60)}m ago`;
	}

	async function refreshStatus() {
		try {
			const status = await getBlockingStatus();
			updateBlocking(status.blocking);
			if (status.blocking) {
				pauseUntil = null;
				pauseTotal = null;
			} else if (status.timer && status.timer > 0 && pauseUntil === null) {
				pauseTotal = status.timer;
				pauseUntil = Date.now() + status.timer * 1000;
			}
			error = null;
		} catch {
			error = 'Could not reach Pi-hole';
		}
	}

	async function refreshTop() {
		try {
			const [ads, queries] = await Promise.all([
				getTopDomains(true, 10),
				getTopDomains(false, 10)
			]);
			topAds = ads.domains ?? [];
			topQueries = queries.domains ?? [];
			topLoadedAt = Date.now();
		} catch {
			// Non-fatal: top lists are secondary info.
		} finally {
			topLoading = false;
		}
	}

	async function pause() {
		acting = true;
		try {
			await setBlocking(false, duration);
			pauseTotal = duration;
			pauseUntil = Date.now() + duration * 1000;
			updateBlocking(false);
			await refreshStatus();
		} catch {
			error = 'Failed to pause blocking';
		} finally {
			acting = false;
		}
	}

	async function resume() {
		acting = true;
		try {
			await setBlocking(true, null);
			pauseUntil = null;
			pauseTotal = null;
			updateBlocking(true);
			await refreshStatus();
		} catch {
			error = 'Failed to resume blocking';
		} finally {
			acting = false;
		}
	}

	async function onSwitchChange(checked: boolean) {
		if (checked) await resume();
		else await pause();
	}

	// Clock tick for the countdown.
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	// Polling: 10s while paused (countdown freshness), 60s otherwise; top lists
	// every 60s.
	$effect(() => {
		const statusMs = paused ? 10_000 : 60_000;
		const topMs = 60_000;
		refreshStatus();
		refreshTop();
		const a = setInterval(refreshStatus, statusMs);
		const b = setInterval(refreshTop, topMs);
		return () => {
			clearInterval(a);
			clearInterval(b);
		};
	});
</script>

<svelte:head>
	<title>pihole-switcher</title>
</svelte:head>

<div class="space-y-4">
	<section
		data-testid="blocking-card"
		class="rounded-xl border p-5"
		style="border-color: var(--border); background: var(--surface);"
	>
		<div class="flex items-center justify-between gap-4">
			<div>
				<h1 class="text-lg font-semibold">Ad blocking</h1>
				<p class="text-sm" style="color: var(--text-muted);">
					{#if blocking === null}
						Checking…
					{:else if blocking}
						Blocking is active
					{:else if paused}
						Paused — resumes automatically in {fmtRemaining(remaining)}
					{:else}
						Paused
					{/if}
				</p>
			</div>
			<Switch checked={blocking === true} disabled={acting} label="Ad blocking" onchange={onSwitchChange} />
		</div>

		{#if !blocking && blocking !== null}
			<div class="mt-4">
				<div class="mb-1 h-1 w-full overflow-hidden rounded-full" style="background: var(--surface-2);">
					<div
						class="h-full rounded-full transition-all duration-1000"
						style="width: {progress * 100}%; background: var(--bad);"
					></div>
				</div>
				<div class="mt-2 flex items-baseline justify-between text-sm">
					<span data-testid="countdown" class="tabular-nums" style="color: var(--bad);">
						{#if remaining !== null && remaining > 0}{fmtRemaining(remaining)} left{:else}paused{/if}
					</span>
					<button
						type="button"
						data-testid="resume-btn"
						onclick={resume}
						disabled={acting}
						class="rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
						style="background: var(--good-soft); color: var(--good);"
					>
						Resume now
					</button>
				</div>
			</div>
		{:else if blocking}
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<span class="text-sm" style="color: var(--text-muted);">Pause blocking for</span>
				<SegmentedControl
					aria-label="Pause duration"
					options={[...DURATIONS]}
					value={duration}
					onchange={(v) => (duration = Number(v))}
				/>
				<button
					type="button"
					data-testid="pause-btn"
					onclick={pause}
					disabled={acting}
					class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
					style="background: var(--bad-soft); color: var(--bad);"
				>
					Pause
				</button>
			</div>
		{/if}
	</section>

	{#if error}
		<div data-testid="error-banner" class="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style="background: var(--bad-soft); border-color: var(--bad); color: var(--bad);">
			{error}
			<button type="button" onclick={() => refreshStatus()} class="font-medium underline">Retry</button>
		</div>
	{/if}

	<!-- Chart section: calm, single dominant pie (like the classic UI). -->
	<section data-testid="chart-section" class="pt-2">
		<div class="mb-5 flex items-center justify-center gap-2" role="tablist" aria-label="Chart">
			{#each (['ads', 'queries'] as const) as t (t)}
				<button
					type="button"
					role="tab"
					aria-selected={chartTab === t}
					onclick={() => (chartTab = t)}
					class="chart-tab"
					class:chart-tab-active={chartTab === t}
				>
					{t === 'ads' ? 'Top Ads' : 'Top Queries'}
				</button>
			{/each}
		</div>

		{#if topLoading}
			<div class="flex justify-center" aria-hidden="true">
				<div class="skeleton h-40 w-40 rounded-full"></div>
			</div>
		{:else if activeDomains.length === 0}
			<p class="py-10 text-center text-sm" style="color: var(--text-muted);">Nothing here yet.</p>
		{:else}
			<ul
				class="mx-auto mb-6 flex max-w-[560px] flex-wrap items-center justify-center gap-2"
				aria-label="Legend"
			>
				{#each activeDomains as d, i (d.domain)}
					<li
						class="inline-flex max-w-full items-center gap-1.5 rounded border px-2 py-0.5 text-xs"
						style="border-color: color-mix(in srgb, {PIE_PALETTE[i % PIE_PALETTE.length]} 55%, transparent); color: var(--text-muted);"
					>
						<span
							class="h-2.5 w-2.5 shrink-0 rounded-[3px]"
							style="background: color-mix(in srgb, {PIE_PALETTE[i % PIE_PALETTE.length]} 30%, transparent); border: 1px solid {PIE_PALETTE[i % PIE_PALETTE.length]};"
					></span>
					<span class="max-w-[220px] truncate" title={d.domain}>{d.domain}</span>
				</li>
			{/each}
			</ul>

			<div class="flex justify-center">
				{#key chartTab}
					<Pie domains={activeDomains} palette={PIE_PALETTE} size={420} />
				{/key}
			</div>

			{#if topLoadedAt}
				<p class="mt-4 text-center text-xs" style="color: var(--text-muted);">
					updated {fmtAgo(topLoadedAt)}
				</p>
			{/if}
		{/if}
	</section>
</div>

<style>
	.chart-tab {
		padding: 0.4rem 0.9rem;
		font-size: 0.95rem;
		color: var(--text-muted);
		border-bottom: 2px solid transparent;
		transition: color 0.15s ease, border-color 0.15s ease;
	}
	.chart-tab:hover {
		color: var(--text);
	}
	.chart-tab-active {
		color: var(--text);
		font-weight: 600;
		border-bottom-color: var(--good);
	}
</style>
