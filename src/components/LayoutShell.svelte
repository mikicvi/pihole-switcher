<script lang="ts">
	import type { Snippet } from 'svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import StatusPill from './StatusPill.svelte';
	import NavTabs from './NavTabs.svelte';

	interface Props {
		data: { adminUrl: string | null };
		blocking: boolean | null;
		children: Snippet;
	}

	let { data, blocking, children }: Props = $props();
</script>

<div class="min-h-screen flex flex-col">
	<header
		class="sticky top-0 z-20 border-b backdrop-blur-md"
		style="background: color-mix(in srgb, var(--bg) 80%, transparent); border-color: var(--border);"
	>
		<div class="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-3">
			<img src="/pihole.png" alt="Pi-hole logo" class="h-8 w-8 shrink-0" />
			<span class="hidden whitespace-nowrap text-base font-semibold tracking-tight min-[540px]:inline">pihole-switcher</span>
			<span class="flex-1"></span>
			<NavTabs />
			{#if data.adminUrl}
				<a
					href={data.adminUrl}
					target="_blank"
					rel="noreferrer"
					class="hidden rounded-md px-2 py-1 text-sm sm:inline-block focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
					style="color: var(--text-muted);"
					title="Open Pi-hole admin"
				>
					Admin ↗
				</a>
			{/if}
			<StatusPill blocking={blocking} adminUrl={data.adminUrl} />
			<ThemeToggle />
		</div>
	</header>

	<main class="mx-auto w-full max-w-[720px] flex-1 px-4 py-6">
		{@render children()}
	</main>

	<footer class="mx-auto w-full max-w-[720px] px-4 pb-6 text-center text-xs" style="color: var(--text-muted);">
		Local/LAN only · FTL API proxied server-side
	</footer>
</div>
