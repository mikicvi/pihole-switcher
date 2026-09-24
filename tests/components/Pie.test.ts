// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Pie from '../../src/components/Pie.svelte';

const DOMAINS = [
	{ domain: 'a.com', count: 50 },
	{ domain: 'b.com', count: 25 },
	{ domain: 'c.com', count: 25 }
];

function slicePaths(container: Element): SVGPathElement[] {
	return Array.from(container.querySelectorAll('path[data-slice]')) as SVGPathElement[];
}

describe('Pie', () => {
	it('renders one wedge path per domain plus an outer border circle', async () => {
		const { container } = render(Pie, { props: { domains: DOMAINS } });
		// the reveal animation fills in the wedges over rAF frames
		await waitFor(
			() => expect(slicePaths(container).length).toBe(3),
			{ timeout: 2000 }
		);
		await waitFor(() => {
			const paths = slicePaths(container);
			for (const p of paths) expect(p.getAttribute('d')).toMatch(/^M/);
		}, { timeout: 2000 });
		const borders = slicePaths(container);
		for (const p of borders) {
			// borders are a brighter tint of the slice colour, not black
			expect(p.getAttribute('stroke')).toContain('color-mix');
			expect(p.getAttribute('stroke')).not.toContain('--bg');
		}
		// outer border around the whole pie
		expect(
			Array.from(container.querySelectorAll('circle')).some(
				(c) => (c.getAttribute('stroke') ?? '').includes('color-mix')
			)
		).toBe(true);
	});

	it('recycles the palette beyond ten slices', async () => {
		const many = DOMAINS.concat(
			Array.from({ length: 9 }, (_, i) => ({ domain: `d${i}.com`, count: 5 }))
		);
		const { container } = render(Pie, { props: { domains: many } });
		await waitFor(() => expect(slicePaths(container).length).toBe(12));
		const all = slicePaths(container);
		expect(all[10].getAttribute('fill')).toBe(all[0].getAttribute('fill'));
	});

	it('shows a name + value tooltip when hovering a slice', async () => {
		const { container } = render(Pie, { props: { domains: DOMAINS } });
		await waitFor(() => expect(slicePaths(container).length).toBe(3));
		const first = slicePaths(container)[0];
		fireEvent.mouseMove(first, { clientX: 100, clientY: 100 });
		await waitFor(() => expect(container.querySelector('.pie-tip')).not.toBeNull());
		const tip = container.querySelector('.pie-tip')!;
		expect(tip.textContent).toContain('a.com');
		expect(tip.textContent).toContain('50');
		// leaving hides it again
		fireEvent.mouseLeave(first);
		await waitFor(() => expect(container.querySelector('.pie-tip')).toBeNull());
	});

	it('renders nothing for empty data', () => {
		const { container } = render(Pie, { props: { domains: [] } });
		expect(container.querySelector('svg')).toBeNull();
	});
});
