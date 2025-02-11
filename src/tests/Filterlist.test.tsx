import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import axios from 'axios';
import Filterlist from '../Filterlist';

// src/Filterlist.test.tsx

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock environment variables
(window as any)._env_ = {
	REACT_APP_PIHOLE_KEY: 'test-key',
	REACT_APP_PIHOLE_BASE: 'http://localhost/',
};

describe('Filterlist Component', () => {
	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks();

		// Mock successful API response
		mockedAxios.get.mockResolvedValue({
			data: {
				data: [
					{
						domain: 'example.com',
						date_modified: 1234567890,
						enabled: true,
					},
					{
						domain: 'test.com',
						date_modified: 1234567891,
						enabled: false,
					},
				],
			},
		});
	});

	test('renders initial component', async () => {
		render(<Filterlist />);

		expect(screen.getByText('Filter List: Whitelist')).toBeInTheDocument();
		expect(screen.getByLabelText('Select List Type')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Enter domain')).toBeInTheDocument();

		await waitFor(() => {
			expect(screen.getByText('example.com')).toBeInTheDocument();
		});
	});

	test('switches between whitelist and blacklist', async () => {
		render(<Filterlist />);

		const dropdown = screen.getByLabelText('Select List Type');
		fireEvent.click(dropdown);

		const blacklistOption = screen.getByText('Blacklist');
		fireEvent.click(blacklistOption);

		expect(screen.getByText('Filter List: Blacklist')).toBeInTheDocument();
		expect(mockedAxios.get).toHaveBeenCalledTimes(2);
	});

	test('adds new domain successfully', async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: { success: true, message: 'Added successfully' },
		});

		render(<Filterlist />);

		const input = screen.getByPlaceholderText('Enter domain');
		const addButton = screen.getByText('Add');

		userEvent.type(input, 'newdomain.com');
		fireEvent.click(addButton);

		await waitFor(() => {
			expect(
				screen.getByText('Domain added successfully')
			).toBeInTheDocument();
		});
	});

	test('handles pagination', async () => {
		// Mock response with more than 5 items
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				data: Array(7)
					.fill(null)
					.map((_, i) => ({
						domain: `domain${i}.com`,
						date_modified: 1234567890 + i,
						enabled: i % 2 === 0,
					})),
			},
		});
		render(<Filterlist />);

		//Wait for the API response to resolve and the data to be rendered
		await waitFor(() => {
			expect(screen.getByText('2')).toBeInTheDocument(); // Pagination button for page 2
		});
	});

	test('handles API errors', async () => {
		mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

		render(<Filterlist />);

		await waitFor(() => {
			const errorMessages = screen.getAllByText('Failed to fetch list');
			expect(errorMessages).toHaveLength(2);
		});
	});
});
// Could not figure out how to test validation for the Filterlist component - looks like FluentUI's components are not that easy to test
// describe('Filterlist Validation', () => {
// 	test('shows an error when adding an empty domain', () => {
// 		render(<Filterlist />);
// 		fireEvent.click(screen.getByText('Add'));
// 		expect(screen.getByText('Domain cannot be empty')).toBeInTheDocument();
// 	});

// 	test('shows an error when adding an invalid domain', () => {
// 		render(<Filterlist />);
// 		fireEvent.change(screen.getByLabelText('Domain'), {
// 			target: { value: 'invalid_domain' },
// 		});
// 		fireEvent.click(screen.getByText('Add'));
// 		expect(
// 			screen.getByText('Please enter a valid domain (e.g., example.com)')
// 		).toBeInTheDocument();
// 	});
// });
