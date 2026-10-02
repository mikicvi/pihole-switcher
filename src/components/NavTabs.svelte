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
			class="nav-link whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors max-[540px]:px-2.5 max-[420px]:px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
			class:nav-link-active={isActive(tab.href)}
			style={
				isActive(tab.href)
					? 'background: var(--accent-soft); color: var(--accent-ink);'
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
	 * transparent. (::after is reserved for this; the underline uses ::before.)
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
	/* Spring underline: scaleX with overshoot, anchored at the left edge.
	   The inset mirrors the link's own padding at every breakpoint (a custom
	   property, so the underline is exactly as wide as the text box instead of
	   4px wider than it) and the color is the accent INK so the underline and
	   the word read as one family. */
	.nav-link {
		--nav-inset: 0.75rem; /* px-3 */
	}
	@media (max-width: 540px) {
		.nav-link {
			--nav-inset: 0.625rem; /* max-[540px]:px-2.5 */
		}
	}
	@media (max-width: 420px) {
		.nav-link {
			--nav-inset: 0.5rem; /* max-[420px]:px-2 */
		}
	}
	.nav-link::before {
		content: '';
		position: absolute;
		left: var(--nav-inset);
		right: var(--nav-inset);
		bottom: 3px;
		height: 2px;
		border-radius: 1px;
		background: var(--accent-ink);
		transform: scaleX(0);
		transform-origin: left center;
		transition: transform 0.3s var(--spring);
	}
	.nav-link-active::before {
		transform: scaleX(1);
	}
	.nav-link-active {
		border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
		box-shadow: var(--shadow-1);
	}
	@media (hover: hover) {
		.nav-link:not(.nav-link-active):hover {
			color: var(--text);
			background: color-mix(in srgb, var(--surface-2) 55%, transparent);
		}
	}
</style>
