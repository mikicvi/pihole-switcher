// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { fireEvent, waitFor } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Toast from '../../src/components/Toast.svelte';
import SegmentedControl from '../../src/components/SegmentedControl.svelte';
import StatusPill from '../../src/components/StatusPill.svelte';

describe('Toast', () => {
	it.each([
		['success', '✓'],
		['warning', '!'],
		['error', '✕']
	] as const)('renders the %s icon and message', (kind, icon) => {
		const { getByTestId } = render(Toast, { kind, message: 'hello' });
		// Whitespace between the icon span and the message is part of the text.
		expect(getByTestId('toast')).toHaveTextContent(`${icon} hello`);
	});
});

describe('SegmentedControl', () => {
	const options = [
		{ value: 'top', label: 'Top' },
		{ value: 'blocked', label: 'Blocked' }
	];

	it('renders one tab per option and reports the current value', () => {
		render(SegmentedControl, { options, value: 'top', 'aria-label': 'view', onchange: () => {} });
		expect(screen.getByRole('tab', { name: 'Top' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'Blocked' })).toHaveAttribute('aria-selected', 'false');
	});

	it('calls onchange with the clicked option value', async () => {
		const onchange = vi.fn();
		render(SegmentedControl, { options, value: 'top', 'aria-label': 'view', onchange });
		await fireEvent.click(screen.getByRole('tab', { name: 'Blocked' }));
		expect(onchange).toHaveBeenCalledWith('blocked');
	});

	it('works without the optional aria-label and class props (defaults)', () => {
		const { container } = render(SegmentedControl, { options, value: 'top', onchange: () => {} });
		const list = container.querySelector('[role="tablist"]');
		expect(list).not.toBeNull();
		expect(list!.getAttribute('aria-label')).toBe('');
	});
});

describe('StatusPill', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('opens the admin URL in a new tab when clicked (adminUrl set)', async () => {
		const openSpy = vi.fn();
		vi.stubGlobal('window', { ...window, open: openSpy });
		const { getByTestId } = render(StatusPill, { blocking: true, adminUrl: 'http://pi/admin' });
		const pill = getByTestId('status-pill');
		expect(pill.tagName).toBe('A');
		await fireEvent.click(pill);
		expect(openSpy).toHaveBeenCalledWith('http://pi/admin', '_blank', 'noreferrer');
	});

	it('renders a non-interactive label when no adminUrl is configured', () => {
		const { getByTestId } = render(StatusPill, { blocking: false, adminUrl: null });
		expect(getByTestId('status-pill').tagName).toBe('SPAN');
		expect(getByTestId('status-pill')).toHaveTextContent('⏸ Paused');
	});
});
