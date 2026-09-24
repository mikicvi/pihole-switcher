// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Donut from '../../src/components/Donut.svelte';

const DOMAINS = [
	{ domain: 'a.com', count: 50 },
	{ domain: 'b.com', count: 25 },
	{ domain: 'c.com', count: 15 },
	{ domain: 'd.com', count: 8 },
	{ domain: 'e.com', count: 2 }
];

describe('Donut', () => {
	it('renders one arc per top domain and rolls the rest into "other"', () => {
		const { container } = render(Donut, { props: { domains: DOMAINS, slices: 3, center: '100', sub: 'total' } });
		// 3 explicit slices + 1 "other"
		const arcs = container.querySelectorAll('circle[stroke-dasharray]');
		expect(arcs.length).toBe(4);
	});

	it('renders all arcs when there are fewer domains than slices', () => {
		const { container } = render(Donut, { props: { domains: DOMAINS.slice(0, 2) } });
		const arcs = container.querySelectorAll('circle[stroke-dasharray]');
		expect(arcs.length).toBe(2);
	});

	it('renders nothing for empty data', () => {
		const { container } = render(Donut, { props: { domains: [] } });
		expect(container.querySelector('svg')).toBeNull();
	});
});
