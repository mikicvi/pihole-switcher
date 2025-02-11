import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Graph from '../Graph';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockApiResponse = {
	top_queries: {
		'query1.com': 50,
		'query2.com': 30,
	},
	top_ads: {
		'ads1.com': 40,
		'ads2.com': 20,
	},
};

describe('Graph Component', () => {
	beforeEach(() => {
		mockedAxios.get.mockResolvedValue({ data: mockApiResponse });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	test('renders tabs correctly', async () => {
		render(<Graph />);
		expect(screen.getByText('Top Ads'));
		expect(screen.getByText('Top Queries'));
	});

	test('shows ads pie chart by default', async () => {
		render(<Graph />);
		await waitFor(() => {
			expect(mockedAxios.get).toHaveBeenCalled();
		});
		expect(screen.getByRole('tabpanel', { name: 'Top Ads' }));
	});

	test('switches to queries chart when clicking Queries tab', async () => {
		render(<Graph />);
		await waitFor(() => {
			expect(mockedAxios.get).toHaveBeenCalled();
		});

		fireEvent.click(screen.getByText('Top Queries'));
		expect(screen.getByRole('tabpanel', { name: 'Top Queries' }));
	});

	test('handles API error gracefully', async () => {
		const consoleErrorSpy = jest
			.spyOn(console, 'error')
			.mockImplementation();
		mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

		render(<Graph />);
		await waitFor(() => {
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		consoleErrorSpy.mockRestore();
	});
});
