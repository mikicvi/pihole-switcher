<script lang="ts">
	let { blocking, adminUrl = null }: { blocking: boolean | null; adminUrl?: string | null } = $props();

	const label = $derived(blocking === null ? '…' : blocking ? '● Active' : '⏸ Paused');
	const color = $derived(
		blocking === null ? 'var(--text-muted)' : blocking ? 'var(--good)' : 'var(--bad)'
	);
	const bg = $derived(
		blocking === null ? 'var(--surface-2)' : blocking ? 'var(--good-soft)' : 'var(--bad-soft)'
	);

	function openAdmin(e: MouseEvent) {
		if (adminUrl) {
			e.preventDefault();
			window.open(adminUrl, '_blank', 'noreferrer');
		}
	}
</script>

{#if adminUrl}
	<a
		href={adminUrl}
		target="_blank"
		rel="noreferrer"
		onclick={openAdmin}
		data-testid="status-pill"
		class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
		style="background: {bg}; color: {color};"
		title="Open Pi-hole admin"
	>
		{label}
	</a>
{:else}
	<span
		data-testid="status-pill"
		class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
		style="background: {bg}; color: {color};"
	>
		{label}
	</span>
{/if}
