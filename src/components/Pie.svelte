<script lang="ts">
	import type { TopDomain } from '../lib/api.js';

	/**
	 * Big solid SVG pie (wedge paths) with a Fluent/Chart.js-style entrance:
	 * the whole pie starts as a line at 12 o'clock and sweeps open clockwise
	 * as one continuous reveal. Slices are semi-transparent with a
	 * background-coloured border between them, and the pie itself gets a thin
	 * outer border — like the old app. Hovering a slice brightens it and shows
	 * a fading tooltip with name + value. Re-key the component (Svelte {#key})
	 * to replay the animation.
	 */
	interface Props {
		domains: TopDomain[];
		/** Colors for the top 10 slices; recycled beyond that. */
		palette?: string[];
		/** Pixel diameter (default 320). */
		size?: number;
		/** Full reveal duration in ms (default 900). */
		duration?: number;
	}

	let {
		domains,
		/** 10-hue palette (Open-Color) tuned for the dark theme. */
		palette = [
			'#ff6b8a', // coral pink
			'#ffa94d', // orange
			'#ffd43b', // amber
			'#69db7c', // green
			'#38d9a9', // mint
			'#3bc9db', // cyan
			'#4dabf7', // blue
			'#9775fa', // violet
			'#da77f2', // orchid
			'#f783ac' // rose
		],
		size = 320,
		duration = 900
	}: Props = $props();

	const CX = 21;
	const CY = 21;
	const R = 20; // wedge radius in the 42×42 viewBox (padding keeps borders unclipped)

	interface Slice {
		color: string;
		start: number; // degrees from 12 o'clock, clockwise
		end: number;
		pct: number;
	}

	const slices = $derived.by<Slice[]>(() => {
		const total = domains.reduce((s, d) => s + d.count, 0);
		if (total === 0) return [];
		const out: Slice[] = [];
		let start = 0;
		for (let i = 0; i < domains.length; i++) {
			const pct = (domains[i].count / total) * 100;
			out.push({
				color: palette[i % palette.length],
				start,
				end: start + (pct / 100) * 360,
				pct
			});
			start = out[out.length - 1].end;
		}
		return out;
	});

	// ---- entrance: clockwise reveal, driven per-frame (no masks/dash arrays) ----
	let progress = $state(0);
	$effect(() => {
		let raf = 0;
		const t0 = performance.now();
		const tick = (t: number) => {
			const p = Math.min(1, (t - t0) / duration);
			progress = 1 - Math.pow(1 - p, 3); // easeOutCubic
			if (p < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	// Slice borders: a brighter tint of the slice colour (like the old
	// Fluent chart), not a black gap.
	const sliceBorder = (c: string) => `color-mix(in srgb, ${c} 50%, white)`;

	const num = (v: number) => Number(v.toFixed(3));

	function pt(angle: number, r: number): [number, number] {
		const rad = ((angle - 90) * Math.PI) / 180;
		return [num(CX + r * Math.cos(rad)), num(CY + r * Math.sin(rad))];
	}

	function wedgePath(a0: number, a1: number, r = R): string {
		const sweep = a1 - a0;
		if (sweep >= 359.99) {
			const [x1, y1] = pt(0, r);
			const [x2, y2] = pt(180, r);
			return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2} A ${r} ${r} 0 1 1 ${x1} ${y1} Z`;
		}
		const [x1, y1] = pt(a0, r);
		const [x2, y2] = pt(a1, r);
		const large = sweep > 180 ? 1 : 0;
		return `M ${CX} ${CY} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
	}

	// Wedge geometry at the current reveal progress: the pie grows clockwise as
	// a whole, exactly like the chart.js "start from a line" animation.
	const wedges = $derived.by(() => {
		const reveal = progress * 360;
		return slices.map((s) => {
			const end = Math.min(s.end, reveal);
			return { ...s, d: end - s.start > 0.05 ? wedgePath(s.start, end) : '' };
		});
	});

	// ---- hover tooltip ----
	let wrapEl: HTMLDivElement | undefined = $state();
	interface Hover {
		i: number;
		x: number;
		y: number;
	}
	let hover = $state<Hover | null>(null);

	function onMove(i: number, e: MouseEvent) {
		if (!wrapEl) return;
		const r = wrapEl.getBoundingClientRect();
		hover = { i, x: e.clientX - r.left, y: e.clientY - r.top };
	}
	function onLeave() {
		hover = null;
	}
</script>

{#if slices.length > 0}
	<div
		bind:this={wrapEl}
		class="pie-appear relative"
		style="width: {size}px; max-width: 100%; height: {size}px;"
		role="img"
		aria-label="pie chart of {domains.length} domains"
	>
		<svg viewBox="0 0 42 42" width="100%" height="100%" class="block">
			{#each wedges as w, i (i)}
				<path
					data-slice={i}
					d={w.d}
					fill={w.color}
					stroke={sliceBorder(w.color)}
					stroke-width="0.3"
					stroke-linejoin="round"
					style="fill-opacity: {hover?.i === i ? 1 : 0.78}; transition: fill-opacity 0.18s ease; cursor: pointer;"
					onmousemove={(e) => onMove(i, e)}
					onmouseleave={onLeave}
				></path>
			{/each}
			<!-- border around the whole pie, like the original app -->
			<circle
				cx={CX}
				cy={CY}
				r={R}
				fill="none"
				stroke="color-mix(in srgb, var(--text-muted) 50%, transparent)"
				stroke-width="0.3"
				style="opacity: {progress}; transition: opacity 0.3s ease;"
			></circle>
		</svg>

		{#if hover && hover.i < domains.length}
			<div
				class="pie-tip"
				style="left: {hover.x}px; top: {hover.y}px;"
				role="status"
			>
				<span class="pie-tip-name">{domains[hover.i].domain}</span>
				<span class="pie-tip-value"
					>{domains[hover.i].count.toLocaleString()} · {Math.round(slices[hover.i].pct)}%</span
				>
			</div>
		{/if}
	</div>
{/if}

<style>
	.pie-appear {
		animation: pie-in 0.45s cubic-bezier(0.33, 0, 0.2, 1) both;
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
	.pie-tip {
		position: absolute;
		transform: translate(14px, -50%);
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px 10px;
		border-radius: 8px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.35);
		font-size: 12px;
		line-height: 1.3;
		pointer-events: none;
		white-space: nowrap;
		max-width: 260px;
		overflow: hidden;
		text-overflow: ellipsis;
		animation: tip-in 0.18s ease both;
		z-index: 10;
	}
	@keyframes tip-in {
		from {
			opacity: 0;
			transform: translate(10px, -50%);
		}
		to {
			opacity: 1;
			transform: translate(14px, -50%);
		}
	}
	.pie-tip-name {
		color: var(--text);
		font-weight: 600;
	}
	.pie-tip-value {
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
