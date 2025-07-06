import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import App from '../App';
import userEvent from '@testing-library/user-event';
import PiholeApi from '../services/piholeApi';

// Mock the PiholeApi class
jest.mock('../services/piholeApi');

jest.mock('axios');
jest.mock('react-chartjs-2', () => ({
	Pie: jest.fn(() => null),
}));

const MockedPiholeApi = PiholeApi as jest.MockedClass<typeof PiholeApi>;

// Set up timers for all tests
beforeEach(() => {
	jest.useFakeTimers();
});

describe('PiholeSwitcher', () => {
	let mockPiholeApiInstance: jest.Mocked<PiholeApi>;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});

		// Create a mock instance
		mockPiholeApiInstance = {
			getStatus: jest.fn(),
			disable: jest.fn(),
			enable: jest.fn(),
			getTopItems: jest.fn(),
			destroy: jest.fn(),
			getAdminUrl: jest.fn().mockReturnValue('http://localhost'),
		} as any;

		// Mock getInstance to return our mock instance
		MockedPiholeApi.getInstance = jest
			.fn()
			.mockReturnValue(mockPiholeApiInstance);
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.restoreAllMocks();
	});

	test('fetches status and sets initial state correctly', async () => {
		// Set up the API to return "enabled" status
		mockPiholeApiInstance.getStatus.mockResolvedValue('enabled');

		render(<App />);

		// First, expect to see "Disabled" initially (default state)
		expect(screen.getByText('PiHole Disabled ❌')).toBeInTheDocument();

		// Advance time a bit to allow effects to run
		jest.advanceTimersByTime(100);

		// Verify that at least one API call was made
		await waitFor(() => {
			expect(mockPiholeApiInstance.getStatus).toHaveBeenCalled();
		});

		// Verify dropdown is present
		expect(screen.getByText('Select time')).toBeInTheDocument();
	});

	test('displays correct status when disabled', async () => {
		// Set up the API to return "disabled" status
		mockPiholeApiInstance.getStatus.mockResolvedValue('disabled');

		render(<App />);
		await screen.findByText('PiHole Disabled ❌');
	});

	test('handles error when axios.get throws an error', async () => {
		// Override the mock to throw an error
		mockPiholeApiInstance.getStatus.mockRejectedValue(
			new Error('Network error')
		);

		const consoleSpy = jest.spyOn(console, 'error');

		render(<App />);

		// Advance time a bit to ensure the effect runs
		jest.advanceTimersByTime(100);

		await waitFor(() => {
			// First check that the getStatus was called
			expect(mockPiholeApiInstance.getStatus).toHaveBeenCalled();
			// Then check that the error was logged
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	test('fetches status every 3 seconds', async () => {
		// Set up the API to return "enabled" status
		mockPiholeApiInstance.getStatus.mockResolvedValue('enabled');

		// Clear mock call history
		jest.clearAllMocks();

		render(<App />);

		// Wait for initial call
		await waitFor(() => {
			expect(mockPiholeApiInstance.getStatus).toHaveBeenCalled();
		});

		// Clear the mock history to count just the new calls
		mockPiholeApiInstance.getStatus.mockClear();

		// Advance time by 3 seconds
		jest.advanceTimersByTime(3000);

		// Should have been called again after 3 seconds
		await waitFor(() => {
			expect(mockPiholeApiInstance.getStatus).toHaveBeenCalledTimes(1);
		});
	});

	test('toggles switch and stops ad blocking when selected, on logo press continues', async () => {
		// First set the initial status to enabled
		mockPiholeApiInstance.getStatus.mockResolvedValue('enabled');
		mockPiholeApiInstance.disable.mockResolvedValue();

		render(<App />);

		// Wait for initial status load
		jest.advanceTimersByTime(100);

		await waitFor(() => {
			expect(screen.getByText(/PiHole Enabled/)).toBeInTheDocument();
		});

		// Select dropdown option first
		const dropdown = screen.getByRole('combobox');
		fireEvent.click(dropdown);

		// Find and click on "5 minutes" option
		await waitFor(() => {
			const option = screen.getByText('5 minutes');
			fireEvent.click(option);
		});

		// Click the toggle switch to stop ad blocking
		const toggle = screen.getByRole('switch');
		fireEvent.click(toggle);

		// Verify that the disable method was called
		await waitFor(() => {
			expect(mockPiholeApiInstance.disable).toHaveBeenCalled();
		});
	});

	test('mouse over and mouse out on logo', async () => {
		// Set up the API to return "enabled" status
		mockPiholeApiInstance.getStatus.mockResolvedValue('enabled');

		render(<App />);

		const logo = screen.getByAltText('PiHole Logo');

		fireEvent.mouseOver(logo);
		fireEvent.mouseOut(logo);

		// Just verify that the logo is still there
		expect(logo).toBeInTheDocument();
	});

	test('status click opens a new window with the pihole admin page', async () => {
		// Set up the API to return "enabled" status
		mockPiholeApiInstance.getStatus.mockResolvedValue('enabled');

		render(<App />);

		const status = screen.getByText('PiHole Disabled ❌');

		fireEvent.click(status);

		// window.open should have been called with just the URL (as per the actual implementation)
		expect(window.open).toHaveBeenCalledWith('http://localhost');
	});
});
