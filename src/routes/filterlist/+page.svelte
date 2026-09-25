<script lang="ts">
	import { addExactDomain, getExactDomains, type ListDomain } from '../../lib/api.js';
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

	async function load() {
		loading = true;
		error = null;
		try {
			const res = await getExactDomains(listType);
			domains = res.domains ?? [];
			page = 1;
		} catch {
			error = 'Could not load the filter list';
		} finally {
			loading = false;
		}
	}

	function switchType(v: string | number) {
		listType = v as ListType;
		filter = '';
		load();
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
	<div class="flex flex-wrap items-center justify-between gap-3">
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

	<form
		class="flex gap-2"
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
			class="flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
			style="background: var(--surface); border-color: var(--border); color: var(--text);"
		/>
		<button
			type="submit"
			disabled={adding}
			class="rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
			style="background: var(--accent); color: white;"
		>
			{adding ? 'Adding…' : 'Add'}
		</button>
	</form>
	{#if domainError}
		<p data-testid="domain-error" class="text-sm" style="color: var(--bad);">{domainError}</p>
	{/if}

	{#if toast}
		<div class="flex justify-end">
			<Toast kind={toast.kind} message={toast.message} />
		</div>
	{/if}

	<div class="overflow-hidden rounded-xl border" style="border-color: var(--border);">
		<div class="flex items-center gap-3 border-b px-3 py-2" style="border-color: var(--border);">
			<input
				type="search"
				bind:value={filter}
				placeholder="Search domains…"
				aria-label="Search domains"
				class="w-full max-w-xs rounded-md border px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
				style="background: var(--surface); border-color: var(--border); color: var(--text);"
			/>
			<span class="ml-auto text-xs tabular-nums" style="color: var(--text-muted);">
				{filtered.length} {filtered.length === 1 ? 'domain' : 'domains'}
			</span>
		</div>

		{#if loading}
			<div class="space-y-1 p-3" aria-hidden="true">
				{#each Array(5) as _, i (i)}
					<div class="skeleton h-6 w-full rounded"></div>
				{/each}
			</div>
		{:else if error}
			<div data-testid="list-error" class="flex items-center justify-between px-3 py-3 text-sm" style="color: var(--bad);">
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
				<thead class="sticky top-0" style="background: var(--surface-2);">
					<tr>
						<th class="px-3 py-2 text-left font-medium" style="color: var(--text-muted);">Domain</th>
						<th class="px-3 py-2 text-left font-medium" style="color: var(--text-muted);">Modified</th>
						<th class="px-3 py-2 text-left font-medium" style="color: var(--text-muted);">Enabled</th>
					</tr>
				</thead>
				<tbody>
					{#each pageItems as d, i (d.domain)}
						<tr
							class="border-t transition-colors hover:brightness-110"
							style="border-color: var(--border); {i % 2 === 1 ? 'background: color-mix(in srgb, var(--surface-2) 40%, transparent);' : ''}"
						>
							<td class="max-w-0 truncate px-3 py-2" title={d.domain}>{d.domain}</td>
							<td class="px-3 py-2 tabular-nums" style="color: var(--text-muted);">
								{new Date(d.date_modified * 1000).toLocaleDateString()}
							</td>
							<td class="px-3 py-2">
								<span
									class="rounded-full px-2 py-0.5 text-xs"
									style="background: {d.enabled ? 'var(--good-soft)' : 'var(--surface-2)'}; color: {d.enabled ? 'var(--good)' : 'var(--text-muted)'};"
								>
									{d.enabled ? 'yes' : 'no'}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if totalPages > 1}
				<div class="flex items-center justify-between border-t px-3 py-2" style="border-color: var(--border);">
					<button
						type="button"
						onclick={() => (page = Math.max(1, pageSafe - 1))}
						disabled={pageSafe <= 1}
						class="rounded-md px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
						style="color: var(--text); background: var(--surface-2);"
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
						class="rounded-md px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-40"
						style="color: var(--text); background: var(--surface-2);"
					>
						Next →
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>
