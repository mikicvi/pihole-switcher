<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/', label: 'Dashboard', testid: 'nav-dashboard' },
		{ href: '/filterlist', label: 'Filter list', testid: 'nav-filterlist' }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<div role="tablist" aria-label="Primary" class="flex items-center gap-1">
	{#each tabs as tab}
		<a
			href={tab.href}
			role="tab"
			aria-selected={isActive(tab.href)}
			data-testid={tab.testid}
			class="nav-link rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
			style={
				isActive(tab.href)
					? 'background: var(--accent-soft); color: var(--accent);'
					: 'color: var(--text-muted); background: transparent;'
			}
		>
				{tab.label}
		</a>
	{/each}
</div>

<style>
	/*
	 * Invisible hit-slop: the tab's hit area grows to a 44px-tall band centred
	 * on the link (WCAG 2.5.8) without any visual size change — the pill and
	 * focus ring keep their current dimensions, the pseudo-element is
	 * transparent.
	 */
	.nav-link {
		position: relative;
	}
	.nav-link::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 44px;
		transform: translateY(-50%);
	}
</style>
