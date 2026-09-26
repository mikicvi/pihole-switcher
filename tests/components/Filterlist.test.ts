// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../src/routes/filterlist/+page.svelte';

const mocks = {
	getExactDomains: vi.fn(),
	addExactDomain: vi.fn(),
	updateExactDomain: vi.fn()
};

vi.mock('../../src/lib/api.js', () => ({
	getExactDomains: (...a: unknown[]) => mocks.getExactDomains(...a),
	addExactDomain: (...a: unknown[]) => mocks.addExactDomain(...a),
	updateExactDomain: (...a: unknown[]) => mocks.updateExactDomain(...a)
}));

const TEN_DENY = Array.from({ length: 12 }, (_, i) => ({
	domain: `deny-${i}.example.com`,
	date_modified: 1700000000 + i,
	enabled: i % 2 === 0
}));

function mockDefaults() {
	// The page opens on the whitelist, so 'allow' serves the 12-item fixture.
	mocks.getExactDomains.mockImplementation((type: string) =>
		Promise.resolve({
			domains: type === 'allow' ? TEN_DENY : [{ domain: 'beta.example.com', date_modified: 1, enabled: true, comment: null, groups: [] }]
		})
	);
	mocks.addExactDomain.mockResolvedValue({ added: true, alreadyExists: false });
	mocks.updateExactDomain.mockResolvedValue({ domains: [] });
}

describe('Filterlist page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDefaults();
	});

	it('loads the whitelist (allow) by default', async () => {
		render(Page);
		await screen.findByText('deny-0.example.com');
		expect(mocks.getExactDomains).toHaveBeenCalledWith('allow');
	});

	it('paginates 10 per page', async () => {
		render(Page);
		await screen.findByText('deny-0.example.com');
		expect(screen.getByText('deny-9.example.com')).toBeInTheDocument();
		expect(screen.queryByText('deny-10.example.com')).not.toBeInTheDocument();
		expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
	});

	it('switching to the blocklist re-fetches the deny list', async () => {
		const user = userEvent.setup();
		render(Page);
		await screen.findByText('deny-0.example.com');
		await user.click(screen.getByTestId('segment-deny'));
		expect(await screen.findByText('beta.example.com')).toBeInTheDocument();
		await waitFor(() =>
			expect(mocks.getExactDomains).toHaveBeenCalledWith('deny')
		);
	});

	it('filters domains with the search box', async () => {
		const user = userEvent.setup();
		render(Page);
		await screen.findByText('deny-0.example.com');
		await user.type(screen.getByLabelText('Search domains'), 'deny-3');
		await waitFor(() =>
			expect(screen.queryByText('deny-0.example.com')).not.toBeInTheDocument()
		);
		expect(screen.getByText('deny-3.example.com')).toBeInTheDocument();
		expect(screen.getByText('1 domain')).toBeInTheDocument();
	});

	it('adds a domain and shows a success toast', async () => {
		const user = userEvent.setup();
		render(Page);
		await screen.findByText('deny-0.example.com');
		await user.type(screen.getByLabelText('Domain to add'), 'example.com');
		await user.click(screen.getByRole('button', { name: 'Add' }));
		await waitFor(() =>
			expect(mocks.addExactDomain).toHaveBeenCalledWith('allow', 'example.com')
		);
		expect(await screen.findByText('Added example.com')).toBeInTheDocument();
	});

	it('shows a warning toast when the domain already exists', async () => {
		const user = userEvent.setup();
		mocks.addExactDomain.mockResolvedValue({ added: false, alreadyExists: true });
		render(Page);
		await screen.findByText('deny-0.example.com');
		await user.type(screen.getByLabelText('Domain to add'), 'dup.com');
		await user.click(screen.getByRole('button', { name: 'Add' }));
		expect(await screen.findByText('dup.com is already on this list')).toBeInTheDocument();
	});

	it('shows an error toast when the add request fails', async () => {
		const user = userEvent.setup();
		mocks.addExactDomain.mockRejectedValue(new Error('boom'));
		render(Page);
		await screen.findByText('deny-0.example.com');
		await user.type(screen.getByLabelText('Domain to add'), 'x.example.com');
		await user.click(screen.getByRole('button', { name: 'Add' }));
		expect(await screen.findByText('Failed to add x.example.com')).toBeInTheDocument();
	});

	it('validates the domain before submitting', async () => {
		const user = userEvent.setup();
		render(Page);
		await screen.findByText('deny-0.example.com');
		await user.type(screen.getByLabelText('Domain to add'), 'not a domain');
		await user.click(screen.getByRole('button', { name: 'Add' }));
		expect(await screen.findByTestId('domain-error')).toHaveTextContent(
			'not look like a valid domain'
		);
		expect(mocks.addExactDomain).not.toHaveBeenCalled();
	});

	it('toggles a domain enabled via PUT and flips the chip', async () => {
		const user = userEvent.setup();
		render(Page);
		await screen.findByText('deny-0.example.com');
		// deny-0 is enabled in the fixture (i % 2 === 0).
		const chip = screen.getByRole('switch', { name: 'Toggle enabled for deny-0.example.com' });
		expect(chip).toHaveAttribute('aria-checked', 'true');
		await user.click(chip);
		await waitFor(() =>
			expect(mocks.updateExactDomain).toHaveBeenCalledWith('allow', 'deny-0.example.com', {
				enabled: false,
				comment: null,
				groups: []
			})
		);
		await waitFor(() =>
			expect(screen.getByRole('switch', { name: 'Toggle enabled for deny-0.example.com' })).toHaveAttribute(
				'aria-checked',
				'false'
			)
		);
	});

	it('shows an error toast when the toggle fails', async () => {
		const user = userEvent.setup();
		mocks.updateExactDomain.mockRejectedValue(new Error('boom'));
		render(Page);
		await screen.findByText('deny-0.example.com');
		await user.click(screen.getByRole('switch', { name: 'Toggle enabled for deny-0.example.com' }));
		expect(await screen.findByText('Could not update deny-0.example.com')).toBeInTheDocument();
	});

	it('shows an empty state when there are no domains', async () => {
		mocks.getExactDomains.mockResolvedValue({ domains: [] });
		render(Page);
		expect(await screen.findByText('No domains yet — add one above.')).toBeInTheDocument();
	});

	it('shows an error state with retry when the list fetch fails', async () => {
		mocks.getExactDomains.mockRejectedValue(new Error('down'));
		render(Page);
		const box = await screen.findByTestId('list-error');
		expect(box).toHaveTextContent('Could not load the filter list');
		expect(within(box).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
	});
});
