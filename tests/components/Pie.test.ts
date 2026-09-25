import { render } from '@testing-library/svelte';
import { fireEvent, waitFor } from '@testing-library/dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Pie from '../../src/components/Pie.svelte';
import type { TopDomain } from '../../src/lib/api.js';

// jsdom has no canvas 2D context — replace chart.js with a recording mock.
const mocks = vi.hoisted(() => {
	interface MockChart {
		canvas: HTMLCanvasElement;
		config: {
			type: string;
			data: { labels: (string | number)[]; datasets: { data: number[] }[] };
			options: Record<string, unknown>;
		};
		hiddenIndexes: number[];
		updates: number;
		destroyed: boolean;
		update(): void;
		destroy(): void;
		hide(i: number): void;
		show(i: number): void;
	}
	const instances: MockChart[] = [];
	class Chart {
		static register(): void {}
		canvas: HTMLCanvasElement;
		config: MockChart['config'];
		hiddenIndexes: number[] = [];
		updates = 0;
		destroyed = false;
		constructor(canvas: HTMLCanvasElement, config: MockChart['config']) {
			this.canvas = canvas;
			this.config = config;
			instances.push(this);
		}
		update(): void {
			this.updates++;
		}
		destroy(): void {
			this.destroyed = true;
		}
		hide(i: number): void {
			if (!this.hiddenIndexes.includes(i)) this.hiddenIndexes.push(i);
		}
		show(i: number): void {
			this.hiddenIndexes = this.hiddenIndexes.filter((x) => x !== i);
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
		await waitFor(() => expect(mocks.instances.length).toBe(1));
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
			expect(c.length).toBe(3);
			return c;
		});
		await waitFor(() => expect(mocks.instances.length).toBe(1));

		await fireEvent.click(chips[1]); // b.net
		expect(mocks.instances[0].hiddenIndexes).toContain(1);
		expect(chips[1].classList.contains('pie-legend-chip-off')).toBe(true);
		expect(chips[1].getAttribute('aria-pressed')).toBe('true');

		// Clicking again re-shows the slice.
		await fireEvent.click(chips[1]);
		expect(mocks.instances[0].hiddenIndexes).not.toContain(1);
		expect(chips[1].classList.contains('pie-legend-chip-off')).toBe(false);
	});

	it('re-creates cleanly and destroys the chart on unmount', async () => {
		const view = render(Pie, { domains });
		await waitFor(() => expect(mocks.instances.length).toBe(1));
		view.unmount();
		expect(mocks.instances[0].destroyed).toBe(true);
	});

	it('renders nothing for an empty domain list', () => {
		const { container } = render(Pie, { domains: [] });
		expect(container.querySelector('canvas')).toBeNull();
	});
});
