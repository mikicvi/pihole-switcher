<script lang="ts">
	import type { TopDomain } from '../lib/api.js';

	interface Props {
		title: string;
		domains: TopDomain[];
		loading: boolean;
		/** Relative "updated" microcopy, e.g. "12s ago". Null while never loaded. */
		updatedAgo: string | null;
	}

	let { title, domains, loading, updatedAgo }: Props = $props();

	const max = $derived(Math.max(1, ...domains.map((d) => d.count)));
</script>

<section class="rounded-xl border p-4" style="border-color: var(--border); background: var(--surface);">
	<div class="mb-3 flex items-baseline justify-between">
		<h2 class="text-sm font-semibold" style="color: var(--text);">{title}</h2>
		{#if updatedAgo}
			<span class="text-xs" style="color: var(--text-muted);">updated {updatedAgo}</span>
		{/if}
	</div>

	{#if loading}
		<div class="space-y-2" aria-hidden="true">
			{#each Array(5) as _, i (i)}
				<div class="skeleton h-4 w-full rounded"></div>
			{/each}
		</div>
	{:else if domains.length === 0}
		<p class="text-sm" style="color: var(--text-muted);">Nothing here yet.</p>
	{:else}
		<ol class="space-y-2">
			{#each domains as d, i (d.domain)}
				<li class="group">
					<div class="mb-0.5 flex items-baseline justify-between gap-2 text-sm">
						<span class="truncate" title={d.domain} style="color: {i === 0 ? 'var(--text)' : 'var(--text-muted)'};">
							{d.domain}
						</span>
						<span class="shrink-0 tabular-nums" style="color: var(--text-muted);">{d.count}</span>
					</div>
					<div class="h-1.5 w-full overflow-hidden rounded-full" style="background: var(--surface-2);">
						<div
							class="h-full rounded-full transition-all duration-500"
							style="width: {(d.count / max) * 100}%; background: {i === 0 ? 'var(--bad)' : 'var(--accent)'};"
						></div>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</section>
