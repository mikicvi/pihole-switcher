<script lang="ts">
	import type { TopDomain } from '../lib/api.js';

	/**
	 * Big solid SVG pie with a chart.js-style clockwise draw-in animation.
	 * Slices are full-radius arc paths; on mount each slice's arc angle
	 * animates from 0 to its final sweep (staggered), like the old chart.js
	 * pies. Re-key the component (Svelte {#key}) to replay the animation.
	 */
	interface Props {
		domains: TopDomain[];
		/** Colors for the top 6 slices; recycled for the rest. */
		palette?: string[];
		/** Pixel diameter (default 320). */
		size?: number;
		/** Per-slice draw duration in ms (default 650). */
		duration?: number;
		/** Stagger between slices in ms (default 80). */
		stagger?: number;
	}

	let {
		domains,
		palette = ['#ff6384', '#ff9f40', '#ffcd56', '#4bc0c0', '#36a2ea', '#9966ff'],
		size = 320,
		duration = 650,
		stagger = 80
	}: Props = $props();

	const C = 62.8319; // circumference of r=10 circle → dasharray units are % * C / 100

	interface Slice {
		color: string;
		final: string; // final stroke-dasharray
		angle: number; // slice start, degrees (SVG rotate around center)
		delay: number; // ms
	}

	// Solid pie: r=10, stroke-width=20 → fills the radius. Each slice is a
	// circle whose dasharray reveals exactly its angular share; the circle's
	// dash origin sits at 3 o'clock, so each slice is rotated to its start
	// position (12 o'clock + accumulated sweep). Animating dasharray 0→share
	// reproduces the chart.js clockwise draw-in.
	const slices = $derived.by<Slice[]>(() => {
		const total = domains.reduce((s, d) => s + d.count, 0);
		if (total === 0) return [];
		const out: Slice[] = [];
		let start = 0; // percent from 12 o'clock
		for (let i = 0; i < domains.length; i++) {
			const pct = (domains[i].count / total) * 100;
			const len = (pct / 100) * C;
			out.push({
				color: palette[i % palette.length],
				final: `${len} ${C - len}`,
				angle: (start / 100) * 360 - 90,
				delay: i * stagger
			});
			start += pct;
		}
		return out;
	});

	let started = $state(false);
	$effect(() => {
		// Flip on the frame after mount so the transition from 0 actually runs.
		const raf = requestAnimationFrame(() => requestAnimationFrame(() => (started = true)));
		return () => cancelAnimationFrame(raf);
	});

</script>

{#if slices.length > 0}
	<div
		class="pie-appear"
		style="width: {size}px; max-width: 100%; height: {size}px;"
		role="img"
		aria-label="pie chart of {domains.length} domains"
	>
		<svg viewBox="0 0 40 40" width="100%" height="100%" class="block">
			{#each slices as s, i (i)}
				<circle
					cx="20"
					cy="20"
					r="10"
					fill="none"
					stroke={s.color}
					stroke-width="20"
					stroke-dasharray={started ? s.final : `0 ${C}`}
					transform="rotate({s.angle} 20 20)"
					style="transition: stroke-dasharray {duration}ms cubic-bezier(0.33, 0, 0.2, 1) {s.delay}ms;"
				></circle>
			{/each}
		</svg>
	</div>
{/if}

<style>
	.pie-appear {
		animation: pie-in 0.5s cubic-bezier(0.33, 0, 0.2, 1) both;
	}
	@keyframes pie-in {
		from {
			opacity: 0;
			transform: scale(0.94);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
