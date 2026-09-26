// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import LayoutShell from '../../src/components/LayoutShell.svelte';
import ThemeToggle from '../../src/components/ThemeToggle.svelte';
import RootLayout from '../../src/routes/+layout.svelte';

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
		// The status pill IS the admin link (no separate header link).
		const pill = screen.getByTestId('status-pill');
		expect(pill.tagName).toBe('A');
		expect(pill).toHaveAttribute('href', 'http://192.168.1.12:1010/admin/login');
	});

	it('shows a plain label when adminUrl is not configured', () => {
		render(LayoutShell, { data: { adminUrl: null }, blocking: true, children: createRawSnippet(() => ({ render: () => '<span data-testid="content"></span>' })) });
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
		expect(screen.getByTestId('status-pill').tagName).toBe('SPAN');
	});

	it('highlights the tab matching the current route', () => {
		render(LayoutShell, { data: { adminUrl: null }, blocking: true, children: createRawSnippet(() => ({ render: () => '<span data-testid="content"></span>' })) });
		// Stubbed $app/state reports pathname '/'.
		expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'Filter list' })).toHaveAttribute('aria-selected', 'false');
	});
});

describe('Root layout (+layout.svelte)', () => {
	// ThemeToggle (rendered inside) needs a controllable matchMedia stub.
	beforeEach(() => {
		document.documentElement.className = '';
		localStorage.clear();
		vi.stubGlobal(
			'matchMedia',
			(query: string) => ({
				media: query,
				matches: true,
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => true
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('renders the shell, the status pill and the page content', () => {
		render(RootLayout, {
			data: { adminUrl: null },
			children: createRawSnippet(() => ({ render: () => '<p id="page-content">dashboard body</p>' }))
		});
		expect(screen.getByRole('banner')).toBeInTheDocument();
		expect(screen.getByTestId('status-pill')).toBeInTheDocument();
		expect(screen.getByText('dashboard body')).toBeInTheDocument();
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

	function btn() {
		return screen.getByTestId('theme-toggle');
	}

	it('follows the OS preference on first visit (no saved choice)', () => {
		osDark = false;
		render(ThemeToggle);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		const b = btn();
		expect(b).toHaveTextContent('🌗');
		expect(b).toHaveAttribute('aria-label', 'Theme: auto (follows system)');
	});

	it('starts dark when the OS prefers dark and there is no saved choice', () => {
		render(ThemeToggle);
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(btn()).toHaveTextContent('🌗'); // auto, not a pinned choice
	});

	it('live-updates when the OS scheme changes in auto mode', () => {
		render(ThemeToggle); // OS dark, nothing saved
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		setOsDark(false);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		setOsDark(true);
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('a saved auto mode follows the OS live', () => {
		localStorage.setItem('pihole-switcher-theme', 'auto');
		render(ThemeToggle);
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		setOsDark(false);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(btn()).toHaveTextContent('🌗');
	});

	it('an explicit choice stops OS tracking and survives a reload', async () => {
		const user = userEvent.setup();
		const { unmount } = render(ThemeToggle); // OS dark, auto mode → dark
		await user.click(btn()); // auto → light, saved
		expect(localStorage.getItem('pihole-switcher-theme')).toBe('light');
		setOsDark(false); // OS flips — must not override the pinned light
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		unmount();
		render(ThemeToggle); // fresh "page load"
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(btn()).toHaveTextContent('☀️');
		expect(btn()).toHaveAttribute('aria-label', 'Theme: light');
	});

	it('cycles auto → light → dark → auto, persisting each mode', async () => {
		const user = userEvent.setup();
		osDark = true;
		render(ThemeToggle);
		expect(btn()).toHaveTextContent('🌗');

		await user.click(btn()); // → light
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(localStorage.getItem('pihole-switcher-theme')).toBe('light');
		expect(btn()).toHaveTextContent('☀️');

		await user.click(btn()); // → dark
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(localStorage.getItem('pihole-switcher-theme')).toBe('dark');
		expect(btn()).toHaveTextContent('🌙');

		await user.click(btn()); // → auto (re-derives from OS: dark)
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(localStorage.getItem('pihole-switcher-theme')).toBe('auto');
		expect(btn()).toHaveTextContent('🌗');
	});

	it('live OS tracking resumes once the cycle returns to auto', async () => {
		const user = userEvent.setup();
		osDark = true;
		render(ThemeToggle);
		await user.click(btn()); // → light (OS tracking off)
		setOsDark(false);
		expect(document.documentElement.classList.contains('dark')).toBe(false); // pinned light
		await user.click(btn()); // → dark (still pinned)
		await user.click(btn()); // → auto; OS is now light
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		setOsDark(true); // tracking is alive again
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('honors a previously saved preference', () => {
		localStorage.setItem('pihole-switcher-theme', 'light');
		render(ThemeToggle);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(btn()).toHaveTextContent('☀️');
	});

	it('ignores garbage in storage and falls back to auto', () => {
		localStorage.setItem('pihole-switcher-theme', 'banana');
		osDark = false;
		render(ThemeToggle);
		expect(document.documentElement.classList.contains('dark')).toBe(false);
		expect(btn()).toHaveTextContent('🌗');
	});
});
