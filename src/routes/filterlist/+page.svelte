<script lang="ts">
	import { addExactDomain, getExactDomains, updateExactDomain, type ListDomain } from '../../lib/api.js';
	import SegmentedControl from '../../components/SegmentedControl.svelte';
	import Toast from '../../components/Toast.svelte';

	type ListType = 'allow' | 'deny';

	const PER_PAGE = 10;

	let listType = $state<ListType>('allow');
	let domains = $state<ListDomain[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let filter = $state('');
	let page = $state(1);

	let adding = $state(false);
	let toggling = $state<string | null>(null);
	let newDomain = $state('');
	let domainError = $state<string | null>(null);
	let toast = $state<{ kind: 'success' | 'error' | 'warning'; message: string } | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const filtered = $derived(
		filter.trim()
			? domains.filter((d) => d.domain.toLowerCase().includes(filter.trim().toLowerCase()))
			: domains
	);
	const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PER_PAGE)));
	const pageSafe = $derived(Math.min(page, totalPages));
	const pageItems = $derived(filtered.slice((pageSafe - 1) * PER_PAGE, pageSafe * PER_PAGE));

	function showToast(kind: 'success' | 'error' | 'warning', message: string) {
		toast = { kind, message };
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 3000);
	}

	// Generation token: a slow response for the previously selected list must
	// not overwrite state once a newer load is in flight.
	let loadSeq = 0;

	async function load() {
		const seq = ++loadSeq;
		loading = true;
		error = null;
		try {
			const res = await getExactDomains(listType);
			if (seq !== loadSeq) return; // superseded by a newer load
			domains = res.domains ?? [];
			page = 1;
		} catch {
			if (seq !== loadSeq) return;
			error = 'Could not load the filter list';
		} finally {
			if (seq === loadSeq) loading = false;
		}
	}

	function switchType(v: string | number) {
		listType = v as ListType;
		filter = '';
		load();
	}

	async function toggleEnabled(d: ListDomain) {
		if (toggling) return;
		const next = !d.enabled;
		toggling = d.domain;
		try {
			// FTL v6 PUT "replace domain" keeps `comment`/`groups` only if
			// resent — send back what the list gave us.
			await updateExactDomain(listType, d.domain, {
				enabled: next,
				comment: d.comment ?? null,
				groups: d.groups ?? []
			});
			domains = domains.map((x) => (x.domain === d.domain ? { ...x, enabled: next } : x));
		} catch {
			showToast('error', `Could not update ${d.domain}`);
		} finally {
			toggling = null;
		}
	}

	const DOMAIN_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

	async function add() {
		const d = newDomain.trim().toLowerCase();
		domainError = null;
		if (!d) {
			domainError = 'Enter a domain first';
			return;
		}
		if (!DOMAIN_RE.test(d)) {
			domainError = 'That does not look like a valid domain';
			return;
		}
		adding = true;
		try {
			const result = await addExactDomain(listType, d);
			if (result.alreadyExists) {
				showToast('warning', `${d} is already on this list`);
			} else {
				showToast('success', `Added ${d}`);
			}
			newDomain = '';
			await load();
		} catch {
			showToast('error', `Failed to add ${d}`);
		} finally {
			adding = false;
		}
	}

	$effect(() => {
		load();
		return () => clearTimeout(toastTimer);
	});
</script>

<svelte:head>
	<title>Filter list · pihole-switcher</title>
</svelte:head>

<div class="space-y-4">
	<div class="rise flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-lg font-semibold">Filter list</h1>
		<SegmentedControl
			aria-label="Filter list type"
			options={[
				{ value: 'allow', label: 'Whitelist' },
				{ value: 'deny', label: 'Blacklist' }
			]}
			value={listType}
			onchange={switchType}
		/>
	</div>

	<!-- One connected field group: the input and the Add button share a single
	     rounded silhouette (input rounds the left, button the right) and the
	     group takes the focus ring when the input is focused. -->
	<form
		class="add-form flex"
		onsubmit={(e) => {
			e.preventDefault();
			add();
		}}
	>
		<input
			type="text"
			bind:value={newDomain}
			placeholder="example.com"
			aria-label="Domain to add"
			class="add-input flex-1 px-3 py-2 text-sm"
			style="background: var(--surface); border-color: var(--border); color: var(--text);"
		/>
		<button
			type="submit"
			disabled={adding}
			class="add-btn px-4 py-2 text-sm font-medium disabled:opacity-50"
			style="background: var(--accent); color: var(--on-accent);"
		>
			{adding ? 'Adding…' : 'Add'}
		</button>
	</form>
	{#if domainError}
		<p data-testid="domain-error" class="text-sm" style="color: var(--bad-ink);">{domainError}</p>
	{/if}

	{#if toast}
		<div class="flex justify-end">
			<Toast kind={toast.kind} message={toast.message} />
		</div>
	{/if}

	<!-- `overflow: clip` (see .list-wrap) rounds the corners without making
	     the wrapper a scroll container — `overflow: hidden` here would steal
	     the sticky <thead>'s scrollport and stop it pinning. -->
	<div class="list-wrap rounded-xl border" style="border-color: var(--border);">
		<div class="list-toolbar flex items-center gap-3 border-b px-3 py-2" style="border-color: var(--border);">
			<span class="search-field relative inline-flex w-full max-w-xs items-center">
				<span class="search-glyph" aria-hidden="true">
					<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
						<circle cx="6.8" cy="6.8" r="4.3"></circle>
						<path d="M10.2 10.2 L13.6 13.6"></path>
					</svg>
				</span>
				<input
					type="search"
					bind:value={filter}
					placeholder="Search domains…"
					aria-label="Search domains"
					class="w-full rounded-md border py-1 pr-2 pl-7 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
					style="background: var(--surface); border-color: var(--border); color: var(--text);"
				/>
			</span>
			<span class="ml-auto text-xs tabular-nums" style="color: var(--text-muted);">
				{filtered.length} {filtered.length === 1 ? 'domain' : 'domains'}
			</span>
		</div>

		{#if loading}
			<div class="space-y-1 p-3" aria-hidden="true">
				{#each Array(5) as _, i (i)}
					<!-- Staggered shimmer: each row starts 90ms after the one above. -->
					<div class="skeleton h-6 w-full rounded" style="animation-delay: {i * 90}ms"></div>
				{/each}
			</div>
		{:else if error}
			<div data-testid="list-error" class="flex items-center justify-between px-3 py-3 text-sm" style="color: var(--bad-ink);">
				{error}
				<button type="button" onclick={load} class="font-medium underline">Retry</button>
			</div>
		{:else if pageItems.length === 0}
			<p class="px-3 py-6 text-center text-sm" style="color: var(--text-muted);">
				{filter ? 'No domains match your search.' : 'No domains yet — add one above.'}
			</p>
		{:else}
			<table class="w-full table-fixed text-sm">
				<colgroup>
					<col />
					<col style="width: 104px;" />
					<col style="width: 76px;" />
				</colgroup>
				<thead class="list-head sticky" style="background: var(--surface-2);">
					<tr>
						<th class="px-3 py-2 text-left font-medium" style="color: var(--text-muted);">Domain</th>
						<th class="px-3 py-2 text-left font-medium" style="color: var(--text-muted);">Modified</th>
						<th class="px-3 py-2 text-left font-medium" style="color: var(--text-muted);">Enabled</th>
					</tr>
				</thead>
				<tbody>
					{#each pageItems as d, i (d.domain)}
						<!-- Full-row tap toggles the switch (bigger hit target on
						     phones); the button stops propagation so a tap on the
						     switch itself never double-fires. -->
						<tr
							class="row zebra cursor-pointer border-t"
							class:zebra-odd={i % 2 === 1}
							style="border-color: var(--border);"
							onclick={() => toggleEnabled(d)}
						>
							<td class="max-w-0 truncate px-3 py-2" title={d.domain}>{d.domain}</td>
							<td class="px-3 py-2 tabular-nums" style="color: var(--text-muted);">
								{new Date(d.date_modified * 1000).toLocaleDateString()}
							</td>
							<td class="px-3 py-2">
								<button
									type="button"
									role="switch"
									aria-checked={d.enabled}
									aria-label={`Toggle enabled for ${d.domain}`}
									disabled={toggling !== null}
									onclick={(e) => {
										e.stopPropagation();
										toggleEnabled(d);
									}}
									class="sw rounded-full py-0.5 pl-0.5 pr-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
									class:sw-on={d.enabled}
									style="background: {d.enabled ? 'var(--good-soft)' : 'var(--surface-2)'}; color: {d.enabled ? 'var(--good-ink)' : 'var(--text-muted)'};"
								>
									<span class="sw-knob" aria-hidden="true"></span>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if totalPages > 1}
				<div class="pager flex items-center justify-between border-t px-3 py-2" style="border-color: var(--border);">
					<button
						type="button"
						onclick={() => (page = Math.max(1, pageSafe - 1))}
						disabled={pageSafe <= 1}
						class="page-chip focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
					>
						← Prev
					</button>
					<span class="text-xs tabular-nums" style="color: var(--text-muted);">
						Page {pageSafe} of {totalPages}
					</span>
					<button
						type="button"
						onclick={() => (page = Math.min(totalPages, pageSafe + 1))}
						disabled={pageSafe >= totalPages}
						class="page-chip focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
					>
						Next →
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	/*
	 * Add form: one connected field group. The input carries the left radius,
	 * the Add button the right, and the shared seam is a single border. The
	 * ring is drawn on the GROUP when the input has focus (the input's own
	 * outline is suppressed) so the control reads as one object.
	 */
	.add-form {
		border-radius: var(--r-md);
		box-shadow: var(--shadow-1), var(--hairline);
		transition: box-shadow 0.15s ease;
	}
	.add-form:focus-within {
		box-shadow: var(--ring), var(--shadow-1), var(--hairline);
	}
	.add-input {
		border: 1px solid var(--border);
		border-right-width: 0;
		border-top-left-radius: var(--r-md);
		border-bottom-left-radius: var(--r-md);
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}
	.add-input:focus-visible {
		outline: none;
	}
	.add-btn {
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
		border-top-right-radius: var(--r-md);
		border-bottom-right-radius: var(--r-md);
		font-weight: 600;
		transition:
			filter 0.15s ease,
			box-shadow 0.15s ease;
	}
	@media (hover: hover) {
		.add-btn:not(:disabled):hover {
			filter: brightness(1.06);
			box-shadow: var(--shadow-2);
		}
	}
	.add-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Search field: magnifier sits inside the input's own padding. */
	.search-glyph {
		position: absolute;
		left: 8px;
		display: grid;
		place-items: center;
		color: var(--text-muted);
		pointer-events: none;
	}

	/* List surface: elevation + hairline, with a glass sticky header. */
	.list-wrap {
		background: var(--surface);
		box-shadow: var(--shadow-2), var(--hairline);
		/* `clip`, not `hidden`: both round the corners, but `hidden` also makes
		   the wrapper a scroll container, and the sticky <thead> then sticks to
		   a box that never scrolls — it slid off-screen with the page. `clip`
		   clips without creating a scrollport, so the head pins to the viewport
		   at --header-h. */
		overflow: clip;
	}
	.list-toolbar {
		background: color-mix(in srgb, var(--surface) 70%, transparent);
	}
	.list-head {
		top: var(--header-h);
		z-index: 10;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
	.list-head th {
		font-size: 0.72rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.list-head tr {
		box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--text) 10%, transparent);
	}

	/*
	 * Row hover: an accent wash + a 2px leading rail. `brightness()` washed the
	 * Latte rows out, so this mixes toward the accent instead and only animates
	 * background-color (the row's inline zebra background is overridden here —
	 * hover must win, hence no `:where()`).
	 */
	.row {
		transition: background-color 0.15s ease;
	}
	/* Zebra banding moved from the inline style to a class so the hover wash
	   below (same specificity, later in the sheet) can override it. */
	.zebra-odd {
		background: color-mix(in srgb, var(--surface-2) 40%, transparent);
	}
	@media (hover: hover) {
		.row:hover {
			background: color-mix(in srgb, var(--accent) 7%, transparent);
			box-shadow: inset 2px 0 0 var(--accent);
		}
	}
	/*
	 * Enabled control: a real track + knob. The accessible name comes from
	 * aria-label, so the visible text can become a knob; role="switch" and
	 * aria-checked are unchanged. The knob slides with the spring.
	 */
	.sw {
		position: relative;
		display: inline-block;
		width: 38px;
		height: 22px;
		border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
		box-shadow: var(--hairline);
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease;
	}
	/* Invisible hit slop: the 38×22 track grows to a 44px-wide tap band with no
	   visual change — same trick as .nav-link::after. `inset` resolves against
	   .sw's padding box (36×20 inside the 1px border), so ±4px horizontally and
	   −9/−12 vertically make the band exactly the row box: 44px wide × 41px tall.
	   A 44px-tall band cannot fit a 41px row and stole taps from the neighbour —
	   measured, a tap 3px above the switch toggled the row below. The row itself
	   is also tappable, so this only widens the button's own target. */
	.sw::after {
		content: '';
		position: absolute;
		inset: -9px -4px -12px -4px;
	}
	.sw-on {
		border-color: color-mix(in srgb, var(--good) 45%, transparent);
	}
	.sw-knob {
		position: absolute;
		top: 50%;
		left: 1px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--text-muted);
		box-shadow: var(--shadow-1);
		transform: translateY(-50%);
		transition:
			transform 0.28s var(--spring),
			background-color 0.2s ease;
	}
	.sw-on .sw-knob {
		/* Ink, not the vivid accent: --good on the --good-soft track is 2.6:1,
		   under even the 3:1 bar for a graphic. */
		background: var(--good-ink);
		/* 38px track − 1px padding ×2 − 18px knob = 18px of travel. */
		transform: translateY(-50%) translateX(18px);
	}

	/* Pagination chips: raised surface-2 pills with the inner highlight. */
	.page-chip {
		padding: 6px 12px;
		border-radius: var(--r-sm);
		/* Base color lives here, not inline: an inline `style` attribute would
		   outrank the :hover wash below and silently kill it. */
		color: var(--text);
		background: var(--surface-2);
		box-shadow: var(--shadow-1), var(--hairline);
		transition:
			background-color 0.15s ease,
			box-shadow 0.15s ease;
	}
	@media (hover: hover) {
		.page-chip:not(:disabled):hover {
			background: color-mix(in srgb, var(--accent) 12%, var(--surface-2));
			box-shadow: var(--shadow-2), var(--hairline);
		}
	}
</style>
