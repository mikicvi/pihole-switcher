<script lang="ts">
	import type { Snippet } from 'svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import StatusPill from './StatusPill.svelte';
	import NavTabs from './NavTabs.svelte';

	interface Props {
		data: { adminUrl: string | null };
		blocking: boolean | null;
		pauseRemaining?: number | null;
		pauseTotal?: number | null;
		/** Desktop two-column dashboard widens the shell to 1100px at ≥1024px. */
		wide?: boolean;
		children: Snippet;
	}

	let {
		data,
		blocking,
		pauseRemaining = null,
		pauseTotal = null,
		wide = false,
		children
	}: Props = $props();

	const widthClass = $derived(
		wide ? 'max-w-[720px] min-[1024px]:max-w-[1100px]' : 'max-w-[720px]'
	);
</script>

<div class="min-h-screen flex flex-col">
	<header
		class="sticky top-0 z-20 border-b backdrop-blur-md"
		style="background: color-mix(in srgb, var(--bg) 80%, transparent); border-color: var(--border);"
	>
		<div class="mx-auto flex {widthClass} items-center gap-3 px-4 py-3">
			<img src="/pihole.png" alt="Pi-hole logo" class="h-8 w-8 shrink-0" />
			<span class="hidden whitespace-nowrap text-base font-semibold tracking-tight min-[540px]:inline">pihole-switcher</span>
			<span class="flex-1"></span>
			<NavTabs />
			<StatusPill
				blocking={blocking}
				adminUrl={data.adminUrl}
				pauseRemaining={pauseRemaining}
				pauseTotal={pauseTotal}
			/>
			<ThemeToggle />
		</div>
	</header>

	<main class="mx-auto w-full {widthClass} flex-1 px-4 pt-6" style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));">
		{@render children()}
	</main>

	<footer
		class="mx-auto w-full {widthClass} px-4 pt-2 text-center text-xs"
		style="color: var(--text-muted); padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));"
	>
		Local/LAN only · FTL API proxied server-side
	</footer>
</div>
