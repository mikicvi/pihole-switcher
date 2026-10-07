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
		class="shell-header sticky top-0 z-20 border-b backdrop-blur-md"
		style="background: color-mix(in srgb, var(--bg) 80%, transparent); border-color: var(--border);"
	>
		<!-- Fixed 56px row (+1px border = the 57px --header-h the sticky table
		     head offsets by), so the glass header never changes height when the
		     wordmark appears or the tabs wrap. Tightening steps down in two
		     stages so the row never overflows horizontally: below 540px the
		     wordmark is already hidden and gaps/padding shrink; below 420px the
		     tabs and the row tighten further; below 360px the logo plate goes
		     too — on a 320px screen the tabs, the status pill and the theme dial
		     carry information, the plate does not. -->
		<div
			class="mx-auto flex h-14 {widthClass} items-center gap-3 px-4 max-[540px]:gap-2 max-[540px]:px-3 max-[420px]:gap-1.5 max-[420px]:px-2.5"
		>
			<span
				class="logo-plate grid h-10 w-10 shrink-0 place-items-center rounded-xl max-[360px]:hidden"
				style="background: var(--surface-2);"
			>
				<img src="/pihole.png" alt="Pi-hole logo" class="h-8 w-8" />
			</span>
			<span
				class="wordmark hidden whitespace-nowrap text-base font-semibold tracking-tight min-[540px]:inline"
			>
				<span style="color: var(--text);">pihole</span><span
					style="color: var(--text-muted);"
				>-switcher</span>
			</span>
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
		class="shell-footer mx-auto w-full {widthClass} px-4 pt-3 text-center text-xs"
		style="color: var(--text-muted); padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));"
	>
		Local/LAN only · FTL API proxied server-side
	</footer>
</div>

<style>
	/*
	 * Header depth. The 1px border-b is the static fallback (Safari has no
	 * scroll-linked animations); where `animation-timeline: scroll()` exists,
	 * a hairline gradient + --shadow-1 fade in over the first 24px of scroll.
	 * Opacity-only, so the compositor does the work — no scroll listener, no
	 * rAF, nothing to cost a Raspberry Pi.
	 */
	.shell-header::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--text) 16%, transparent) 22%,
			color-mix(in srgb, var(--text) 16%, transparent) 78%,
			transparent
		);
		box-shadow: var(--shadow-1);
		opacity: 0;
		pointer-events: none;
	}
	@supports (animation-timeline: scroll()) {
		.shell-header::after {
			animation: header-hairline 1ms linear both;
			animation-timeline: scroll(root);
			animation-range: 0 24px;
		}
	}
	@keyframes header-hairline {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Logo plate: the icon sits on a raised tile so it reads as an object,
	   not a sticker on the glass. */
	.logo-plate {
		box-shadow: var(--shadow-1), var(--hairline);
	}

	.wordmark {
		font-variant-numeric: tabular-nums;
	}

	.shell-footer {
		border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
	}
</style>
