<script lang="ts">
	import type { TopDomain } from '../lib/api.js';

	/**
	 * Pure-SVG donut (no chart library). Shows the top `slices` domains as arcs
	 * and rolls the remainder into "other". Size scales with the `size` prop.
	 */
	interface Props {
		domains: TopDomain[];
		/** Number of explicit slices (default 5). */
		slices?: number;
		/** Pixel diameter (default 72). */
		size?: number;
		/** Center label, e.g. total count. Omitted when empty. */
		center?: string;
		/** Small caption under the center label. */
		sub?: string;
	}

	let { domains, slices = 5, size = 72, center = '', sub = '' }: Props = $props();

	const PALETTE = [
		'var(--bad)',
		'var(--accent)',
		'#4cc38a',
		'#e8a33d',
		'#9d7bf0',
		'#38bdf8',
		'var(--text-muted)'
	];

	const r = 15.915; // circumference = 100 → stroke-dasharray units are %

	interface Segment {
		value: number;
		dashoffset: number;
		color: string;
	}

	const total = $derived(domains.reduce((s, d) => s + d.count, 0));
	const segments = $derived.by(() => {
		if (total === 0) return [];
		const head = domains.slice(0, slices);
		const rest = domains.slice(slices).reduce((s, d) => s + d.count, 0);
		const parts: { value: number; color: string }[] = head.map((d, i) => ({
			value: d.count,
			color: PALETTE[i % PALETTE.length]
		}));
		if (rest > 0) parts.push({ value: rest, color: PALETTE[PALETTE.length - 1] });
		let offset = 25; // start at 12 o'clock (SVG dash starts at 3 o'clock)
		return parts.map((p) => {
			const pct = (p.value / total) * 100;
			const seg: Segment = { value: pct, dashoffset: offset, color: p.color };
			offset -= pct;
			return seg;
		});
	});
</script>

<div class="flex shrink-0 items-center gap-3">
	{#if segments.length > 0}
		<svg
			viewBox="0 0 36 36"
			width={size}
			height={size}
			class="shrink-0"
			role="img"
			aria-label={center ? `${center} ${sub}`.trim() : 'distribution chart'}
		>
			<circle cx="18" cy="18" r={r} fill="none" stroke="var(--surface-2)" stroke-width="4"></circle>
			{#each segments as s (s.dashoffset)}
				<circle
					cx="18"
					cy="18"
					r={r}
					fill="none"
					stroke={s.color}
					stroke-width="4"
					stroke-linecap="butt"
					stroke-dasharray="{s.value} {100 - s.value}"
					stroke-dashoffset={s.dashoffset}
					transform="rotate(0 18 18)"
				></circle>
			{/each}
			{#if center}
				<text
					x="18"
					y={sub ? '17.4' : '18.6'}
					text-anchor="middle"
					dominant-baseline="middle"
					style="font-size: 7px; font-weight: 600; fill: var(--text);"
				>{center}</text>
			{/if}
			{#if sub}
				<text
					x="18"
					y="22.6"
					text-anchor="middle"
					style="font-size: 3.4px; fill: var(--text-muted);"
				>{sub}</text>
			{/if}
		</svg>
	{/if}
</div>
