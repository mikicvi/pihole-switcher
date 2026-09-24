// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Pie from '../../src/components/Pie.svelte';

const DOMAINS = [
	{ domain: 'a.com', count: 50 },
	{ domain: 'b.com', count: 25 },
	{ domain: 'c.com', count: 25 }
];

describe('Pie', () => {
	it('renders one arc slice per domain', () => {
		const { container } = render(Pie, { props: { domains: DOMAINS } });
		const arcs = container.querySelectorAll('circle[stroke-dasharray]');
		expect(arcs.length).toBe(3);
	});

	it('recycles the palette beyond six slices', () => {
		const many = DOMAINS.concat(
			Array.from({ length: 6 }, (_, i) => ({ domain: `d${i}.com`, count: 5 }))
		);
		const { container } = render(Pie, { props: { domains: many } });
		const arcs = Array.from(container.querySelectorAll('circle[stroke-dasharray]')) as SVGElement[];
		expect(arcs.length).toBe(9);
		// slice 6 wraps to palette color 0
		expect(arcs[6].getAttribute('stroke')).toBe(arcs[0].getAttribute('stroke'));
	});

	it('renders nothing for empty data', () => {
		const { container } = render(Pie, { props: { domains: [] } });
		expect(container.querySelector('svg')).toBeNull();
	});
});
