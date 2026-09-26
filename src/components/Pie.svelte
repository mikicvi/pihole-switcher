<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, ArcElement, PieController, Tooltip } from 'chart.js';
	import type { TopDomain } from '../lib/api.js';

	Chart.register(ArcElement, PieController, Tooltip);

	/**
	 * The classic pie, back to its roots: chart.js on a canvas.
	 *
	 * - Entrance: chart.js's default rotate sweep (the "gorgeous" animation).
	 * - Tooltip: chart.js built-in — follows the cursor on desktop, shows on
	 *   tap on mobile, and never overflows the page.
	 * - Legend: real DOM chips above the chart. Clicking one hides/shows the
	 *   slice with chart.js's animated re-layout and strikes the chip through,
	 *   exactly like the original app.
	 *
	 * Colors are theme-aware: the Catppuccin palette is read from CSS
	 * variables and refreshed when the `dark` class flips on <html>.
	 * Re-key the component (Svelte {#key}) to replay the entrance.
	 */
	interface Props {
		domains: TopDomain[];
		/** Maximum pixel size (default 420); shrinks to fit via --pie-max. */
		size?: number;
		/** Entrance animation duration in ms (default 900). */
		duration?: number;
	}

	let { domains, size = 420, duration = 900 }: Props = $props();

	let canvas: HTMLCanvasElement | undefined;
	let chart: Chart<'pie'> | null = null;
	/** Domain names hidden via the legend, in index order of `domains`. */
	let hidden = $state<string[]>([]);

	const isHex = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);

	/** Mix a hex colour toward white (or black) by amt. Non-hex passes through. */
	function mixToward(hex: string, target: number, amt: number): string {
		if (!isHex(hex)) return hex;
		let h = hex.slice(1);
		if (h.length === 3) h = h.split('').map((c) => c + c).join('');
		const out = [0, 2, 4].map((i) => {
			const c = parseInt(h.slice(i, i + 2), 16);
			return Math.round(c + (target - c) * amt)
				.toString(16)
				.padStart(2, '0');
		});
		return `#${out.join('')}`;
	}

	/** Catppuccin palette + neutrals resolved to concrete values (canvas can't use var()). */
	function themeVars() {
		const cs = getComputedStyle(document.documentElement);
		const v = (name: string, fallback: string) => {
			const val = cs.getPropertyValue(name).trim();
			return val || fallback;
		};
		return {
			palette: Array.from({ length: 10 }, (_, i) =>
				v(`--pie-${i + 1}`, '#8b93a7')
			),
			text: v('--text', '#ececf4'),
			muted: v('--text-muted', '#9aa0b4'),
			border: v('--border', '#3a3f55'),
			surface2: v('--surface-2', '#1e1e2e')
		};
	}

	/** Palette colours in current `domains` order (index-stable per position). */
	const paletteFor = (list: TopDomain[]) =>
		list.map((_, i) => themeVars().palette[i % 10]);

	/** Chart.js colours for the current data: fill, hover fill, slice border. */
	function chartColors(list: TopDomain[]) {
		const c = paletteFor(list);
		return {
			background: c,
			hover: c.map((x) => mixToward(x, 255, 0.12)),
			border: c.map((x) => mixToward(x, 255, 0.5))
		};
	}

	$effect(() => {
		// Data refresh (60s poll): update the chart in place with animation.
		// The reactive reads MUST happen before the `chart` guard: the first run
		// occurs before onMount has created the chart, and Svelte 5 only tracks
		// values actually read — guarding first would leave the effect with no
		// dependencies, so the poll would refresh the legend chips but never the pie.
		const labels = domains.map((d) => d.domain);
		const data = domains.map((d) => d.count);
		if (!chart) return;
		const curLabels = chart.data.labels ?? [];
		const cur = chart.data.datasets[0].data as number[];
		if (curLabels.join('\n') === labels.join('\n') && data.every((v, i) => cur[i] === v)) {
			return;
		}
		chart.data.labels = labels;
		chart.data.datasets[0].data = data;
		// Reconcile hidden state by name (indices may have shifted).
		// Single-dataset pie: hide/show take (datasetIndex, dataIndex).
		labels.forEach((label, i) => {
			if (hidden.includes(label)) chart!.hide(0, i);
			else chart!.show(0, i);
		});
		chart.update();
	});

	onMount(() => {
		if (!canvas) return; // empty domain list: nothing to draw
		const t = themeVars();
		const cc = chartColors(domains);
		chart = new Chart(canvas, {
			type: 'pie',
			data: {
				labels: domains.map((d) => d.domain),
				datasets: [
					{
						data: domains.map((d) => d.count),
						backgroundColor: cc.background,
						hoverBackgroundColor: cc.hover,
						borderColor: cc.border,
						borderWidth: 1,
						hoverOffset: 6
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: { duration, easing: 'easeOutCubic' },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: t.surface2,
						titleColor: t.text,
						bodyColor: t.muted,
						borderColor: t.border,
						borderWidth: 1,
						cornerRadius: 8,
						padding: 8,
						displayColors: false,
						callbacks: {
							label: (ctx) => {
								const data = ctx.dataset.data as number[];
								const total = data.reduce((a, b) => a + Number(b), 0);
								const value = Number(ctx.parsed);
								const pct = total
									? Math.round((value / total) * 100)
									: 0;
								return ` ${value.toLocaleString()} · ${pct}%`;
							}
						}
					}
				}
			}
		});

		// Theme flips (dark class on <html>): re-read CSS vars, restyle in place.
		const mo = new MutationObserver(() => {
			if (!chart) return;
			const t2 = themeVars();
			const c2 = chartColors(domains);
			const ds = chart.data.datasets[0];
			ds.backgroundColor = c2.background;
			ds.hoverBackgroundColor = c2.hover;
			ds.borderColor = c2.border;
			const tip = chart.options.plugins?.tooltip;
			if (tip) {
				tip.backgroundColor = t2.surface2;
				tip.titleColor = t2.text;
				tip.bodyColor = t2.muted;
				tip.borderColor = t2.border;
			}
			chart.update('none');
		});
		mo.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});

		return () => {
			mo.disconnect();
			chart?.destroy();
			chart = null;
		};
	});

	/** Legend chip click: hide/show the slice with chart.js's animated re-layout. */
	function toggle(domainName: string, index: number) {
		if (!chart) return;
		if (hidden.includes(domainName)) {
			hidden = hidden.filter((d) => d !== domainName);
			chart.show(0, index);
		} else {
			hidden = [...hidden, domainName];
			chart.hide(0, index);
		}
	}
</script>

{#if domains.length > 0}
<div class="pie-root">
	<ul class="pie-legend" role="list" aria-label="legend — click a domain to hide it from the chart">
		{#each domains as d, i (d.domain)}
			{@const off = hidden.includes(d.domain)}
			<li>
				<button
					type="button"
					class="pie-legend-chip {off ? 'pie-legend-chip-off' : ''}"
					class:dark={off}
					aria-pressed={off}
					title={off ? `Show ${d.domain}` : `Hide ${d.domain} from the chart`}
					onclick={() => toggle(d.domain, i)}
				>
					<span class="pie-legend-dot" style="background: var(--pie-{(i % 10) + 1})"></span>
					<span class="pie-legend-text">{d.domain}</span>
				</button>
			</li>
		{/each}
	</ul>

	<div
		class="pie-box"
		style="width: min(100%, var(--pie-max, {size}px)); aspect-ratio: 1 / 1;"
	>
		<canvas bind:this={canvas} role="img" aria-label="pie chart of {domains.length} domains"></canvas>
	</div>
</div>
{/if}

<style>
	.pie-root {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.pie-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px 10px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.pie-legend-chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		font-size: 12.5px;
		font-family: inherit;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			color 0.15s ease,
			opacity 0.15s ease,
			transform 0.1s ease;
	}
	.pie-legend-chip:hover {
		color: var(--text);
		border-color: var(--accent);
	}
	.pie-legend-chip:active {
		transform: scale(0.97);
	}
	.pie-legend-chip:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.pie-legend-chip-off {
		opacity: 0.45;
	}
	.pie-legend-chip-off .pie-legend-text {
		text-decoration: line-through;
	}
	.pie-legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		flex-shrink: 0;
	}
	.pie-legend-text {
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pie-box {
		margin: 0 auto;
	}
</style>
