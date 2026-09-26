<script lang="ts">
	import { spring } from 'svelte/motion';

	let {
		blocking,
		adminUrl = null,
		pauseRemaining = null,
		pauseTotal = null
	}: {
		blocking: boolean | null;
		adminUrl?: string | null;
		/** Seconds left in the pause (null when not paused). */
		pauseRemaining?: number | null;
		/** Total pause duration in seconds (for the ring fraction). */
		pauseTotal?: number | null;
	} = $props();

	const reduceMotion = $state(
		typeof window !== 'undefined' && typeof window.matchMedia === 'function'
			? window.matchMedia('(prefers-reduced-motion: reduce)')
			: { matches: false }
	);

	const paused = $derived(
		blocking === false && pauseRemaining !== null && pauseRemaining > 0
	);
	/** Fraction of the pause still remaining (1 → full ring, 0 → empty). */
	const ringFraction = $derived(
		pauseRemaining !== null &&
			pauseTotal !== null &&
			pauseTotal > 0 &&
			pauseRemaining > 0
			? Math.min(1, Math.max(0, pauseRemaining / pauseTotal))
			: 0
	);

	const word = $derived(blocking === null ? '…' : blocking ? 'Active' : 'Paused');
	const wordColor = $derived(
		blocking === null ? 'var(--text-muted)' : blocking ? 'var(--good)' : 'var(--warn)'
	);

	/**
	 * Spring "pop" when the state flips: the dot briefly scales up and eases
	 * back with overshoot. Driven by svelte/motion's spring (rAF-based) so it
	 * needs no transition helpers; disabled entirely under reduced motion.
	 */
	const pop = spring(0.18);
	let dotScale = $derived(reduceMotion.matches ? 1 : pop);
	$effect(() => {
		const _key = blocking; // read so the effect re-runs whenever the state changes
		if (reduceMotion.matches) return;
		pop.set(1.4);
		const t = setTimeout(() => pop.set(1), 90);
		return () => clearTimeout(t);
	});

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
		class="status-pill"
		title="Open Pi-hole admin"
	>
		{#if paused}
			<span
				class="pill-ring"
				aria-hidden="true"
				style="background: conic-gradient(var(--warn) {ringFraction * 360}deg, transparent 0deg);"
			></span>
		{/if}
		<span
			class="pill-dot"
			class:dot-active={blocking === true}
			class:dot-paused={blocking === false}
			style="transform: scale({dotScale});"
			aria-hidden="true"
		></span>
		<span class="pill-word" style="color: {wordColor};">{word}</span>
	</a>
{:else}
	<span data-testid="status-pill" class="status-pill">
		{#if paused}
			<span
				class="pill-ring"
				aria-hidden="true"
				style="background: conic-gradient(var(--warn) {ringFraction * 360}deg, transparent 0deg);"
			></span>
		{/if}
		<span
			class="pill-dot"
			class:dot-active={blocking === true}
			class:dot-paused={blocking === false}
			style="transform: scale({dotScale});"
			aria-hidden="true"
		></span>
		<span class="pill-word" style="color: {wordColor};">{word}</span>
	</span>
{/if}

<style>
	.status-pill {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 5px 12px 5px 9px;
		border-radius: 999px;
		border: 1px solid var(--border);
		/* Glass: translucent surface + blur so header content ghosts through. */
		background: color-mix(in srgb, var(--surface) 55%, transparent);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		transition: border-color 0.15s ease;
	}
	a.status-pill:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.pill-dot {
		position: absolute;
		left: 9px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-muted);
		transition: background-color 0.2s ease;
	}
	.pill-dot.dot-active {
		background: var(--good);
	}
	.pill-dot.dot-paused {
		background: var(--warn);
	}
	/* Slow breathing halo behind the active dot. */
	.pill-dot.dot-active::after {
		content: '';
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		background: var(--good);
		opacity: 0;
		animation: pill-breathe 3.2s ease-in-out infinite;
	}
	.pill-ring {
		position: absolute;
		left: 6px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		/* Keep only the outer 2px as the visible ring. */
		-webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
		mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
	}
	.pill-word {
		/* Dot ends at 17px (left 9 + 8px wide); 14px of padding leaves a
		   visible gap so the spring pop never crowds the label. */
		padding-left: 14px;
	}
	@keyframes pill-breathe {
		0%,
		100% {
			opacity: 0;
			transform: scale(0.7);
		}
		50% {
			opacity: 0.45;
			transform: scale(1.5);
		}
	}
</style>
