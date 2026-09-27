<script lang="ts">
	import { getBlockingStatus, getStatsSummary, getTopDomains, setBlocking, type TopDomain } from '../lib/api.js';
	import {
		setBlockingState as publishBlocking,
		setPauseState as publishPause
	} from '../lib/blockingState.svelte.js';
	import SegmentedControl from '../components/SegmentedControl.svelte';
	import Pie from '../components/Pie.svelte';

	type ChartTab = 'ads' | 'queries';
	// Theme-aware pie palette (Catppuccin accents) — defined as CSS variables
	// in app.css, shared with the legend chips below.
	const DURATIONS = [
		{ value: 300, label: '5m' },
		{ value: 900, label: '15m' },
		{ value: 3600, label: '1h' },
		{ value: 86400, label: '24h' }
	] as const;

	// Pause→countdown morph: a crossfade where the LEAVING block is pulled out
	// of the layout flow (position:absolute) while it fades. With plain
	// crossfade both blocks occupy vertical space simultaneously for the
	// duration of the transition, so the card grew taller and then snapped
	// back when the leaving node was removed (the "jumps" the user reported).
	const reduceMotion =
		typeof window !== 'undefined' && typeof window.matchMedia === 'function'
			? window.matchMedia('(prefers-reduced-motion: reduce)').matches
			: false;
	const MORPH_MS = reduceMotion ? 0 : 180;
	function morphIn(_node: Element) {
		return { duration: MORPH_MS, css: (t: number) => `opacity: ${t};` };
	}
	function morphOut(node: Element) {
		const el = node as HTMLElement;
		el.style.position = 'absolute';
		el.style.top = '0';
		el.style.left = '0';
		el.style.right = '0';
		return { duration: MORPH_MS, css: (t: number) => `opacity: ${t};` };
	}

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
	let error = $state<string | null>(null);

	// Query counters for the active-state subtitle ("X% of N queries blocked").
	let stats = $state<{ total: number; blocked: number; pct: number } | null>(null);

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

	/** Publish the countdown to the header pill (ring + word). */
	$effect(() => {
		publishPause(remaining, pauseTotal);
	});

	function fmtHero(s: number): string {
		// 14:36 · 01:04:36 — always shows seconds while paused.
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		const mm = String(m).padStart(2, '0');
		const ss = String(sec).padStart(2, '0');
		return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
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

	async function refreshStats() {
		try {
			stats = await getStatsSummary();
		} catch {
			// Non-fatal: the subtitle simply stays quiet.
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
		} catch {
			// Non-fatal: top lists are secondary info.
		} finally {
			topLoading = false;
		}
	}

	function vibrate() {
		// A 10ms tick on state change; unsupported browsers no-op.
		try {
			navigator.vibrate?.(10);
		} catch {
			/* not supported */
		}
	}

	async function pause() {
		acting = true;
		try {
			await setBlocking(false, duration);
			pauseTotal = duration;
			pauseUntil = Date.now() + duration * 1000;
			updateBlocking(false);
			vibrate();
			await refreshStatus();
		} catch {
			/* keep the current state; the next poll re-syncs */
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
			vibrate();
			await refreshStatus();
		} catch {
			/* keep the current state; the next poll re-syncs */
		} finally {
			acting = false;
		}
	}

	// Pull-to-refresh (touch only, dashboard root).
	let pullY = $state(0);
	let refreshing = $state(false);
	let touchAnchor: number | null = null;
	let pullActive = false;

	function onTouchStart(e: TouchEvent) {
		if (window.scrollY <= 0 && e.touches[0]) touchAnchor = e.touches[0].clientY;
	}
	function onTouchMove(e: TouchEvent) {
		if (touchAnchor === null || !e.touches[0]) return;
		const dy = e.touches[0].clientY - touchAnchor;
		if (dy > 0 && window.scrollY <= 0) {
			// No preventDefault: iOS registers document touch listeners as
			// passive; overscroll-behavior (app.css) keeps the pull local.
			pullActive = true;
			pullY = Math.min(72, dy * 0.5);
		}
	}
	function onTouchEnd() {
		if (pullActive && pullY >= 56) {
			refreshing = true;
			refreshStatus();
			refreshStats();
			refreshTop();
			setTimeout(() => (refreshing = false), 900);
		}
		pullActive = false;
		touchAnchor = null;
		pullY = 0;
	}

	/**
	 * Pull-to-refresh listeners attached as a `use:` action rather than inline
	 * ontouch* markup: the Svelte a11y rule only accepts touch handlers on a
	 * plain (non-interactive) element via JavaScript, not as attributes — and
	 * the action gives us proper cleanup on destroy.
	 */
	function pullRefresh(node: HTMLElement) {
		node.addEventListener('touchstart', onTouchStart);
		node.addEventListener('touchmove', onTouchMove);
		node.addEventListener('touchend', onTouchEnd);
		return {
			destroy() {
				node.removeEventListener('touchstart', onTouchStart);
				node.removeEventListener('touchmove', onTouchMove);
				node.removeEventListener('touchend', onTouchEnd);
			}
		};
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
		refreshStats();
		refreshTop();
		const a = setInterval(refreshStatus, statusMs);
		const b = setInterval(refreshTop, topMs);
		const c = setInterval(refreshStats, 60_000);
		return () => {
			clearInterval(a);
			clearInterval(b);
			clearInterval(c);
		};
	});
</script>

<svelte:head>
	<title>pihole-switcher</title>
</svelte:head>

<div class="dash space-y-4" use:pullRefresh>
	{#if pullY > 0 || refreshing}
		<div
			data-testid="pull-indicator"
			class="p2r"
			style:opacity={refreshing ? 1 : Math.min(1, pullY / 56)}
			role="status"
			aria-label="Refreshing"
		>
			<span class="p2r-spinner"></span>
		</div>
	{/if}

	<div class="dash-grid">
		<section
			data-testid="blocking-card"
			class="rounded-xl border p-5 text-center"
			style="border-color: var(--border); background: var(--surface);"
		>
			<div>
				<h1 class="text-lg font-semibold">Ad blocking</h1>
				<p
					data-testid="status-subtitle"
					class="text-sm"
					style="color: var(--text-muted);"
				>
					{#if blocking === null}
						Checking…
					{:else if blocking}
						{#if stats}
							{stats.pct.toFixed(1)}% of {stats.total.toLocaleString()} queries
							blocked
						{:else}
							—
						{/if}
					{:else if paused}
						Paused
					{:else}
						Paused
					{/if}
				</p>
			</div>

			<div class="morph-wrap mt-4">
				{#if !blocking && blocking !== null}
					<!-- The card is the ONLY place with numbers while paused: one
					     hero countdown + the existing progress bar. -->
					<div in:morphIn out:morphOut>
						<div class="mb-1 h-1 w-full overflow-hidden rounded-full" style="background: var(--surface-2);">
							<div
								class="h-full rounded-full transition-all duration-1000"
								style="width: {progress * 100}%; background: var(--bad);"
							></div>
						</div>
						<div data-testid="countdown" class="mt-3 text-4xl font-semibold tabular-nums" style="color: var(--bad);">
							{#if remaining !== null && remaining > 0}{fmtHero(remaining)}{:else}paused{/if}
						</div>
						<p class="mt-1 text-xs" style="color: var(--text-muted);">
							resumes automatically
						</p>
						<button
							type="button"
							data-testid="resume-btn"
							onclick={resume}
							disabled={acting}
							class="mt-3 w-full rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
							style="background: var(--good-soft); color: var(--good);"
						>
							Resume now
						</button>
					</div>
				{:else if blocking}
					<div class="text-left" in:morphIn out:morphOut>
						<span class="block text-sm" style="color: var(--text-muted);">Pause blocking for</span>
						<div class="mt-2">
							<SegmentedControl
								aria-label="Pause duration"
								class="w-full"
								stretch
								options={[...DURATIONS]}
								value={duration}
								onchange={(v) => (duration = Number(v))}
							/>
						</div>
						<button
							type="button"
							data-testid="pause-btn"
							onclick={pause}
							disabled={acting}
							class="mt-2 w-full rounded-md px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
							style="background: var(--bad-soft); color: var(--bad);"
						>
							Pause
						</button>
					</div>
				{/if}
			</div>
		</section>

		<!-- Chart section: calm, single dominant pie (like the classic UI). -->
		<section data-testid="chart-section" class="pt-2 text-center">
			<div class="mb-4 flex items-center justify-center gap-2" role="tablist" aria-label="Chart">
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
				{#key chartTab}
					<Pie domains={activeDomains} size={420} />
				{/key}

			{/if}
		</section>
	</div>

	{#if error}
		<div data-testid="error-banner" class="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style="background: var(--bad-soft); border-color: var(--bad); color: var(--bad);">
			{error}
			<button type="button" onclick={() => refreshStatus()} class="font-medium underline">Retry</button>
		</div>
	{/if}
</div>

<style>
	/* Pause↔countdown morph: the wrapper is the positioning context so the
	   leaving block (made absolute by morphOut) overlays the incoming one
	   instead of stacking with it in normal flow. */
	.morph-wrap {
		position: relative;
	}
	/* Desktop (≥1024px): status/pause card left (~2fr), tabs + chart right
	   (~3fr); the chip row stays full-width beneath the tabs inside the
	   chart column. Mobile is a plain stacked block. */
	.dash-grid {
		display: block;
	}
	@media (min-width: 1024px) {
		.dash-grid {
			display: grid;
			grid-template-columns: 2fr 3fr;
			gap: 1rem;
			align-items: start;
		}
	}

	.chart-tab {
		position: relative;
		padding: 0.4rem 0.9rem;
		font-size: 0.95rem;
		color: var(--text-muted);
		transition: color 0.15s ease;
	}
	.chart-tab:hover {
		color: var(--text);
	}
	.chart-tab-active {
		color: var(--text);
		font-weight: 600;
	}
	/* Springy underline: overshoot cubic-bezier instead of a plain fade. */
	.chart-tab::after {
		content: '';
		position: absolute;
		left: 0.4rem;
		right: 0.4rem;
		bottom: 0;
		height: 2px;
		border-radius: 1px;
		background: var(--good);
		transform: scaleX(0);
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.chart-tab-active::after {
		transform: scaleX(1);
	}

	/* Pull-to-refresh indicator. */
	.p2r {
		display: flex;
		justify-content: center;
		margin-top: -1.5rem;
		position: relative;
		z-index: 10;
		pointer-events: none;
	}
	.p2r-spinner {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		animation: p2r-spin 0.8s linear infinite;
	}
	@keyframes p2r-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
