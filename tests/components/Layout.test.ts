// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import LayoutShell from '../../src/components/LayoutShell.svelte';
import ThemeToggle from '../../src/components/ThemeToggle.svelte';

// The kit plugin provides the real $app/state module, whose default location
// is not '/'; pin it for the tab-highlight assertion.
vi.mock('$app/state', () => ({
	page: { url: { pathname: '/' } }
}));

describe('LayoutShell', () => {
	beforeEach(() => {
		document.documentElement.className = '';
		localStorage.clear();
	});

	it('renders header, nav tabs and content', () => {
		render(LayoutShell, {
			data: { adminUrl: null },
			blocking: true,
			children: createRawSnippet(() => ({ render: () => '<p id="child">content here</p>' }))
		});
		expect(screen.getByRole('banner')).toBeInTheDocument();
		expect(screen.getByRole('tablist')).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Filter list' })).toBeInTheDocument();
		expect(screen.getByText('content here')).toBeInTheDocument();
	});

	it('shows the status pill state from blocking', () => {
		const { rerender } = render(LayoutShell, {
			data: { adminUrl: null },
			blocking: null,
			children: createRawSnippet(() => ({ render: () => '<span data-testid="content"></span>' }))
		});
		expect(screen.getByTestId('status-pill')).toHaveTextContent('…');

		rerender({ data: { adminUrl: null }, blocking: true, children: createRawSnippet(() => ({ render: () => '<span data-testid="content"></span>' })) });
		expect(screen.getByTestId('status-pill')).toHaveTextContent('Active');

		rerender({ data: { adminUrl: null }, blocking: false, children: createRawSnippet(() => ({ render: () => '<span data-testid="content"></span>' })) });
		expect(screen.getByTestId('status-pill')).toHaveTextContent('Paused');
	});

	it('links to the Pi-hole admin page when adminUrl is provided', () => {
		render(LayoutShell, {
			data: { adminUrl: 'http://192.168.1.12:1010/admin/login' },
			blocking: true,
			children: createRawSnippet(() => ({ render: () => '<span data-testid="content"></span>' }))
		});
		// The header renders an explicit Admin link; the status pill itself is
		// also a link when an admin URL exists.
		const link = screen.getByRole('link', { name: 'Admin ↗' });
		expect(link).toHaveAttribute('href', 'http://192.168.1.12:1010/admin/login');
		const pill = screen.getByTestId('status-pill');
		expect(pill.tagName).toBe('A');
		expect(pill).toHaveAttribute('href', 'http://192.168.1.12:1010/admin/login');
	});

	it('shows a plain label when adminUrl is not configured', () => {
		render(LayoutShell, { data: { adminUrl: null }, blocking: true, children: createRawSnippet(() => ({ render: () => '<span data-testid="content"></span>' })) });
		expect(screen.queryByRole('link', { name: 'Admin ↗' })).not.toBeInTheDocument();
		expect(screen.getByTestId('status-pill').tagName).toBe('SPAN');
	});

	it('highlights the tab matching the current route', () => {
		render(LayoutShell, { data: { adminUrl: null }, blocking: true, children: createRawSnippet(() => ({ render: () => '<span data-testid="content"></span>' })) });
		// Stubbed $app/state reports pathname '/'.
		expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'Filter list' })).toHaveAttribute('aria-selected', 'false');
	});
});

describe('ThemeToggle', () => {
	// Controllable prefers-color-scheme stub (jsdom's own matchMedia does not
	// model an OS scheme we can switch).
	let osDark: boolean;
	let osListeners: Array<(e: { matches: boolean }) => void>;

	function setOsDark(v: boolean) {
		osDark = v;
		osListeners.forEach((fn) => fn({ matches: v }));
	}

	beforeEach(() => {
		document.documentElement.className = '';
		localStorage.clear();
		osDark = true;
		osListeners = [];
		vi.stubGlobal(
			'matchMedia',
			(query: string) => ({
				media: query,
				get matches() {
					return osDark;
				},
				addEventListener: (_t: string, fn: (e: { matches: boolean }) => void) => osListeners.push(fn),
				removeEventListener: () => {},
				dispatchEvent: () => true
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('follows the OS preference on first visit (no saved choice)', () => {
		osDark = false;
		render(ThemeToggle);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(screen.getByRole('button', { name: 'Switch theme' })).toHaveTextContent('☀️');
	});

	it('starts dark when the OS prefers dark and there is no saved choice', () => {
		render(ThemeToggle);
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('live-updates when the OS scheme changes in auto mode', () => {
		render(ThemeToggle); // OS dark, nothing saved
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		setOsDark(false);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		setOsDark(true);
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('an explicit choice stops OS tracking and survives a reload', async () => {
		const user = userEvent.setup();
		const { unmount } = render(ThemeToggle); // OS dark, nothing saved → dark
		await user.click(screen.getByRole('button', { name: 'Switch theme' })); // → light, saved
		expect(localStorage.getItem('pihole-switcher-theme')).toBe('light');
		setOsDark(true); // OS flips to dark — must not override the saved light
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		unmount();
		render(ThemeToggle); // fresh "page load"
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('toggles the dark class and persists the choice', async () => {
		const user = userEvent.setup();
		render(ThemeToggle);
		await user.click(screen.getByRole('button', { name: 'Switch theme' }));
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(localStorage.getItem('pihole-switcher-theme')).toBe('light');

		await user.click(screen.getByRole('button', { name: 'Switch theme' }));
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(localStorage.getItem('pihole-switcher-theme')).toBe('dark');
	});

	it('honors a previously saved preference', () => {
		localStorage.setItem('pihole-switcher-theme', 'light');
		render(ThemeToggle);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});
});
