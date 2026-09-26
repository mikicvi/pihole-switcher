import { render } from '@testing-library/svelte';
import { fireEvent, waitFor } from '@testing-library/dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Pie from '../../src/components/Pie.svelte';
import type { TopDomain } from '../../src/lib/api.js';

// jsdom has no canvas 2D context — replace chart.js with a recording mock.
const mocks = vi.hoisted(() => {
	type ChartData = { labels: (string | number)[]; datasets: { data: number[] }[] };
	type ChartOptions = {
		plugins?: { legend?: { display: boolean }; tooltip?: Record<string, any> };
		[key: string]: any;
	};
	interface MockChart {
		canvas: HTMLCanvasElement;
		config: { type: string; data: ChartData; options: ChartOptions };
		/** chart.js exposes config.data/config.options as instance properties. */
		data: ChartData;
		options: ChartOptions;
		hiddenIndexes: number[];
		updates: number;
		updateModes: Array<string | undefined>;
		destroyed: boolean;
		update(mode?: string): void;
		destroy(): void;
		/** chart.js signature: hide(datasetIndex, dataIndex?) — records the arc (data) index. */
		hide(datasetIndex: number, i?: number): void;
		show(datasetIndex: number, i?: number): void;
		hideCalls: [number, number?][];
		showCalls: [number, number?][];
	}
	const instances: MockChart[] = [];
	class Chart {
		static register(): void {}
		canvas: HTMLCanvasElement;
		config: MockChart['config'];
		data: ChartData;
		options: ChartOptions;
		hiddenIndexes: number[] = [];
		updates = 0;
		updateModes: Array<string | undefined> = [];
		destroyed = false;
		hideCalls: [number, number?][] = [];
		showCalls: [number, number?][] = [];
		constructor(canvas: HTMLCanvasElement, config: MockChart['config']) {
			this.canvas = canvas;
			this.config = config;
			this.data = config.data;
			this.options = config.options;
			instances.push(this);
		}
		update(mode?: string): void {
			this.updates++;
			this.updateModes.push(mode);
		}
		destroy(): void {
			this.destroyed = true;
		}
		hide(datasetIndex: number, i?: number): void {
			this.hideCalls.push([datasetIndex, i]);
			if (i !== undefined && !this.hiddenIndexes.includes(i)) this.hiddenIndexes.push(i);
		}
		show(datasetIndex: number, i?: number): void {
			this.showCalls.push([datasetIndex, i]);
			if (i !== undefined) this.hiddenIndexes = this.hiddenIndexes.filter((x) => x !== i);
		}
	}
	return { Chart, instances };
});

vi.mock('chart.js', () => ({
	Chart: mocks.Chart,
	ArcElement: {},
	PieController: {},
	Tooltip: {}
}));

const domains: TopDomain[] = [
	{ domain: 'a.com', count: 50 },
	{ domain: 'b.net', count: 30 },
	{ domain: 'c.org', count: 20 }
];

describe('Pie (chart.js)', () => {
	beforeEach(() => {
		mocks.instances.length = 0;
	});

	it('renders a canvas and creates a pie chart with the domain data', async () => {
		const { container } = render(Pie, { domains });
		const canvas = container.querySelector('canvas');
		expect(canvas).not.toBeNull();
		await waitFor(() => expect(mocks.instances).toHaveLength(1));
		const chart = mocks.instances[0];
		expect(chart.config.type).toBe('pie');
		expect(chart.config.data.labels).toEqual(['a.com', 'b.net', 'c.org']);
		expect(chart.config.data.datasets[0].data).toEqual([50, 30, 20]);
		// Built-in legend is off (we render our own DOM chips); tooltip on.
		expect((chart.config.options.plugins as Record<string, unknown>).legend).toEqual({
			display: false
		});
		expect(
			(Boolean(
				(chart.config.options.plugins as Record<string, unknown>).tooltip
			))
		).toBe(true);
	});

	it('shows a legend chip per domain; clicking hides the slice and strikes the chip', async () => {
		render(Pie, { domains });
		const chips = await waitFor(() => {
			const c = Array.from(
				document.querySelectorAll<HTMLButtonElement>('.pie-legend-chip')
			);
			expect(c).toHaveLength(3);
			return c;
		});
		await waitFor(() => expect(mocks.instances).toHaveLength(1));

		await fireEvent.click(chips[1]); // b.net
		expect(mocks.instances[0].hiddenIndexes).toContain(1);
		// chart.js API is hide(datasetIndex, dataIndex) — single-dataset pie: dataset 0, arc 1.
		// (A one-arg call would treat the arc index as a dataset index and hide the whole pie.)
		expect(mocks.instances[0].hideCalls).toContainEqual([0, 1]);
		expect(chips[1].classList.contains('pie-legend-chip-off')).toBe(true);
		expect(chips[1].getAttribute('aria-pressed')).toBe('true');

		// Clicking again re-shows the slice.
		await fireEvent.click(chips[1]);
		expect(mocks.instances[0].hiddenIndexes).not.toContain(1);
		expect(mocks.instances[0].showCalls).toContainEqual([0, 1]);
		expect(chips[1].classList.contains('pie-legend-chip-off')).toBe(false);
	});

	it('re-creates cleanly and destroys the chart on unmount', async () => {
		const view = render(Pie, { domains });
		await waitFor(() => expect(mocks.instances).toHaveLength(1));
		view.unmount();
		expect(mocks.instances[0].destroyed).toBe(true);
	});

	it('renders nothing for an empty domain list', () => {
		const { container } = render(Pie, { domains: [] });
		expect(container.querySelector('canvas')).toBeNull();
	});

	it('updates the chart in place when the domain data changes (60s poll path)', async () => {
		const { rerender } = render(Pie, { domains });
		await waitFor(() => expect(mocks.instances).toHaveLength(1));
		const chart = mocks.instances[0] as InstanceType<typeof mocks.Chart>;
		const updatesAfterCreate = chart.updates;

		// Same data again → the effect must not touch the chart.
		rerender({ domains });
		await new Promise((r) => setTimeout(r, 0));
		expect(chart.updates).toBe(updatesAfterCreate);

		// Data changes → labels + counts updated, update() called, hidden state
		// reconciled by name (a.com stays hidden across the rename).
		await fireEvent.click(document.querySelector('.pie-legend-chip')!); // hide a.com
		await waitFor(() => expect(chart.hideCalls).toContainEqual([0, 0]));

		rerender({
			domains: [
				{ domain: 'a.com', count: 40 },
				{ domain: 'b.net', count: 60 },
				{ domain: 'd.io', count: 10 }
			]
		});
		await waitFor(() => expect(chart.data.labels).toEqual(['a.com', 'b.net', 'd.io']));
		expect(chart.data.datasets[0].data).toEqual([40, 60, 10]);
		// Reconciliation: a.com hidden (hide 0,0); b.net and d.io shown.
		expect(chart.hideCalls).toContainEqual([0, 0]);
		expect(chart.showCalls).toContainEqual([0, 1]);
		expect(chart.showCalls).toContainEqual([0, 2]);
		expect(chart.updates).toBeGreaterThan(updatesAfterCreate);
	});

	it('formats the tooltip label as "<value> · <pct>%" (and handles an empty total)', async () => {
		render(Pie, { domains });
		await waitFor(() => expect(mocks.instances).toHaveLength(1));
		const chart = mocks.instances[0] as InstanceType<typeof mocks.Chart>;
		const label = chart.options.plugins!.tooltip!.callbacks.label as (ctx: unknown) => string;
		expect(label({ dataset: { data: [50, 30] }, parsed: 30 })).toBe(' 30 · 38%');
		expect(label({ dataset: { data: [0, 0] }, parsed: 0 })).toBe(' 0 · 0%');
	});

	it('restyles the chart in place when the theme flips on <html>', async () => {
		const { unmount } = render(Pie, { domains });
		await waitFor(() => expect(mocks.instances).toHaveLength(1));
		const chart = mocks.instances[0] as InstanceType<typeof mocks.Chart>;
		const updatesBefore = chart.updates;

		// Flip the dark class — jsdom fires MutationObserver callbacks async.
		document.documentElement.classList.add('dark');
		await waitFor(() => expect(chart.updates).toBeGreaterThan(updatesBefore));
		expect(chart.updateModes).toContain('none');
		unmount();
		document.documentElement.classList.remove('dark');
	});

	it('passes non-hex palette values through and expands 3-digit hex', async () => {
		const root = document.documentElement;
		root.style.setProperty('--pie-1', 'rebeccapurple'); // not a hex → passthrough
		root.style.setProperty('--pie-2', '#abc'); // 3-digit → expanded + mixed
		root.style.setProperty('--pie-3', '#123456');
		try {
			render(Pie, { domains });
			await waitFor(() => expect(mocks.instances).toHaveLength(1));
			const chart = mocks.instances[0] as InstanceType<typeof mocks.Chart>;
			const ds = chart.config.data.datasets[0] as {
				backgroundColor?: string[];
				hoverBackgroundColor?: string[];
			};
			// Raw palette: non-hex passes through, 3-digit stays as-is…
			expect(ds.backgroundColor![0]).toBe('rebeccapurple');
			expect(ds.backgroundColor![1]).toBe('#abc');
			// …while mixing expands it to 6 digits toward white.
			expect(ds.hoverBackgroundColor![1]).toMatch(/^#[0-9a-f]{6}$/i);
			expect(ds.hoverBackgroundColor![1]).not.toBe('#aabbcc');
		} finally {
			root.style.removeProperty('--pie-1');
			root.style.removeProperty('--pie-2');
			root.style.removeProperty('--pie-3');
		}
	});
});
