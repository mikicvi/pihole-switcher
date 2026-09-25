// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../src/routes/+page.svelte';

const mocks = {
	getBlockingStatus: vi.fn(),
	getTopDomains: vi.fn(),
	setBlocking: vi.fn()
};

vi.mock('../../src/lib/api.js', () => ({
	getBlockingStatus: (...a: unknown[]) => mocks.getBlockingStatus(...a),
	getTopDomains: (...a: unknown[]) => mocks.getTopDomains(...a),
	setBlocking: (...a: unknown[]) => mocks.setBlocking(...a)
}));

function mockDefaults() {
	mocks.getBlockingStatus.mockResolvedValue({ blocking: true, timer: 0 });
	mocks.getTopDomains.mockImplementation((blocked: boolean) =>
		Promise.resolve({
			domains: blocked
				? [{ domain: 'ads.example.com', count: 7 }]
				: [{ domain: 'news.example.com', count: 3 }]
		})
	);
	mocks.setBlocking.mockResolvedValue({});
}

describe('Home page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDefaults();
	});

	it('shows the active state and pause controls when blocking is on', async () => {
		render(Page);
		expect(await screen.findByText('Blocking is active')).toBeInTheDocument();
		// One action per state: no separate on/off switch duplicating the
		// pause/resume buttons (the status text carries the state).
		expect(screen.queryByRole('switch')).not.toBeInTheDocument();
		expect(screen.getByTestId('pause-btn')).toBeInTheDocument();
	});

	it('shows the paused state with countdown and resume button when blocking is off', async () => {
		mocks.getBlockingStatus.mockResolvedValue({ blocking: false, timer: 300 });
		render(Page);
		expect(await screen.findByTestId('resume-btn')).toBeInTheDocument();
		expect(await screen.findByText(/resumes automatically in/)).toBeInTheDocument();
		expect(screen.queryByRole('switch')).not.toBeInTheDocument();
	});

	// FTL reflects the change: after POST /dns/blocking the status endpoint
	// reports the new state, so the mock must do the same for the page's
	// post-action refresh to behave like production.
	function liveStatus(initial: { blocking: boolean; timer: number }) {
		const box = { value: initial };
		mocks.getBlockingStatus.mockImplementation(() => Promise.resolve(box.value));
		return box;
	}

	it('pauses blocking with the selected duration', async () => {
		const user = userEvent.setup();
		const status = liveStatus({ blocking: true, timer: 0 });
		render(Page);
		await screen.findByText('Blocking is active');
		status.value = { blocking: false, timer: 300 };
		await user.click(screen.getByTestId('pause-btn'));
		await waitFor(() =>
			expect(mocks.setBlocking).toHaveBeenCalledWith(false, 300)
		);
		expect(await screen.findByTestId('resume-btn')).toBeInTheDocument();
	});

	it('pauses with the duration chosen in the segmented control', async () => {
		const user = userEvent.setup();
		const status = liveStatus({ blocking: true, timer: 0 });
		render(Page);
		await screen.findByText('Blocking is active');
		await user.click(screen.getByTestId('segment-900'));
		status.value = { blocking: false, timer: 900 };
		await user.click(screen.getByTestId('pause-btn'));
		await waitFor(() =>
			expect(mocks.setBlocking).toHaveBeenCalledWith(false, 900)
		);
	});

	it('resumes blocking immediately', async () => {
		const user = userEvent.setup();
		const status = liveStatus({ blocking: false, timer: 300 });
		render(Page);
		const resume = await screen.findByTestId('resume-btn');
		status.value = { blocking: true, timer: 0 };
		await user.click(resume);
		await waitFor(() =>
			expect(mocks.setBlocking).toHaveBeenCalledWith(true, null)
		);
	});

	it('renders top ads and top queries in the chart tabs', async () => {
		render(Page);
		// Default tab shows the ads legend.
		expect(await screen.findByText('ads.example.com')).toBeInTheDocument();
		// Switch to Top Queries and the queries legend appears.
		await userEvent.click(await screen.findByRole('tab', { name: 'Top Queries' }));
		expect(await screen.findByText('news.example.com')).toBeInTheDocument();
		await waitFor(() =>
			expect(mocks.getTopDomains).toHaveBeenCalledWith(true, 10)
		);
		await waitFor(() =>
			expect(mocks.getTopDomains).toHaveBeenCalledWith(false, 10)
		);
	});

	it('shows skeletons while the top lists are still loading', async () => {
		// Never-resolving fetch keeps the skeleton state visible.
		mocks.getTopDomains.mockImplementation(() => new Promise(() => {}));
		const { container } = render(Page);
		await screen.findByText('Blocking is active');
		const skeletons = container.querySelectorAll('.skeleton');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it('shows an error banner with retry when the status fetch fails', async () => {
		mocks.getBlockingStatus.mockRejectedValue(new Error('down'));
		render(Page);
		const banner = await screen.findByTestId('error-banner');
		expect(banner).toHaveTextContent('Could not reach Pi-hole');
		const retry = within(banner).getByRole('button', { name: 'Retry' });
		expect(retry).toBeInTheDocument();
	});
});
