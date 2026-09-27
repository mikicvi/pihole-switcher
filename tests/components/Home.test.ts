// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../src/routes/+page.svelte';

const mocks = {
	getBlockingStatus: vi.fn(),
	getStatsSummary: vi.fn(),
	getTopDomains: vi.fn(),
	setBlocking: vi.fn()
};

vi.mock('../../src/lib/api.js', () => ({
	getBlockingStatus: (...a: unknown[]) => mocks.getBlockingStatus(...a),
	getStatsSummary: (...a: unknown[]) => mocks.getStatsSummary(...a),
	getTopDomains: (...a: unknown[]) => mocks.getTopDomains(...a),
	setBlocking: (...a: unknown[]) => mocks.setBlocking(...a)
}));

function mockDefaults() {
	mocks.getBlockingStatus.mockResolvedValue({ blocking: true, timer: 0 });
	mocks.getStatsSummary.mockResolvedValue({ total: 1000, blocked: 120, pct: 12 });
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

	it('shows the active state with stats subtitle and pause controls', async () => {
		render(Page);
		// The active subtitle carries the query stats, not a duplicated number.
		const subtitle = await screen.findByTestId('status-subtitle');
		expect(subtitle).toHaveTextContent('12.0% of 1,000 queries blocked');
		// One action per state: no separate on/off switch duplicating the
		// pause/resume buttons (the header pill + subtitle carry the state).
		expect(screen.queryByRole('switch')).not.toBeInTheDocument();
		expect(screen.getByTestId('pause-btn')).toBeInTheDocument();
	});

	it('vibrates briefly when pausing and resuming', async () => {
		const user = userEvent.setup();
		const vibrate = vi.fn();
		vi.stubGlobal('navigator', { ...navigator, vibrate });
		const status = liveStatus({ blocking: true, timer: 0 });
		render(Page);
		await screen.findByTestId('pause-btn');
		status.value = { blocking: false, timer: 900 };
		await user.click(screen.getByTestId('pause-btn'));
		expect(vibrate).toHaveBeenCalledWith(10);
		await screen.findByTestId('resume-btn');
		status.value = { blocking: true, timer: 0 };
		await user.click(screen.getByTestId('resume-btn'));
		expect(vibrate).toHaveBeenCalledTimes(2);
		vi.unstubAllGlobals();
	});

	it('pull-to-refresh re-fetches when the pull crosses the threshold', async () => {
		render(Page);
		const statusCallsBefore = mocks.getBlockingStatus.mock.calls.length;
		const root = screen.getByTestId('blocking-card').closest('.dash') as HTMLElement;
		// Start at the top, pull down 200px (×0.5 dampening → 100, capped 72 ≥ 56).
		fireEvent.touchStart(root, { touches: [{ clientY: 100 }] });
		fireEvent.touchMove(root, { touches: [{ clientY: 300 }] });
		await screen.findByTestId('pull-indicator');
		fireEvent.touchEnd(root);
		await waitFor(() =>
			expect(mocks.getBlockingStatus.mock.calls.length).toBeGreaterThan(statusCallsBefore)
		);
	});

	it('shows the paused state with hero countdown and resume button', async () => {
		mocks.getBlockingStatus.mockResolvedValue({ blocking: false, timer: 300 });
		render(Page);
		expect(await screen.findByTestId('resume-btn')).toBeInTheDocument();
		// The card is the only numeric source while paused: one hero countdown
		// plus the static "resumes automatically" microcopy (no other digits).
		// The clock may already have ticked (04:59…), so match the mm:ss shape.
		await waitFor(() =>
			expect(screen.getByTestId('countdown')).toHaveTextContent(/\d{2}:\d{2}/)
		);
		expect(screen.getByText('resumes automatically')).toBeInTheDocument();
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
		await screen.findByTestId('pause-btn');
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
		await screen.findByTestId('pause-btn');
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
		await screen.findByTestId('pause-btn');
		const skeletons = container.querySelectorAll('.skeleton');
		expect(skeletons.length).toBeGreaterThan(0);
	});

	it('shows the empty state when FTL has no top domains', async () => {
		mocks.getTopDomains.mockResolvedValue({ domains: [] });
		render(Page);
		await screen.findByTestId('pause-btn');
		expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
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
