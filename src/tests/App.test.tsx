import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import App from '../App';
import userEvent from '@testing-library/user-event';

jest.mock('axios');
jest.mock('react-chartjs-2', () => ({
	Pie: jest.fn(() => null),
}));

describe('PiholeSwitcher', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterAll(() => {
		(console.error as jest.Mock).mockRestore();
	});

	test('fetches status and sets initial state correctly', async () => {
		const mockResponseData = {
			status: 'enabled',
		};

		jest.spyOn(axios, 'get').mockResolvedValue({
			data: mockResponseData,
		});
		const { getByText } = render(<App />);

		await waitFor(() =>
			expect(getByText('PiHole Enabled ✅')).toBeInTheDocument()
		);
		expect(getByText('Select time')).toBeInTheDocument();
	});

	test('displays correct status when disabled', async () => {
		const mockResponseData = {
			status: 'disabled',
		};

		jest.spyOn(axios, 'get').mockResolvedValue({
			data: mockResponseData,
		});
		const { getByText } = render(<App />);
		await waitFor(() =>
			expect(getByText('PiHole Disabled ❌')).toBeInTheDocument()
		);
	});
	test('handles error when axios.get throws an error', async () => {
		const mockedErrorData = {
			message: 'API Error',
		};

		jest.spyOn(axios, 'get').mockRejectedValueOnce(mockedErrorData);
		const consoleSpy = jest.spyOn(console, 'error');

		render(<App />);
		await waitFor(() => {
			expect(consoleSpy).toHaveBeenCalledWith('Error:', mockedErrorData);
		});

		// Restore console.error to its original function
		consoleSpy.mockRestore();
	});

	test('fetches status every 3 seconds', async () => {
		const mockResponseData = {
			status: 'enabled',
		};

		jest.spyOn(axios, 'get').mockResolvedValueOnce({
			data: mockResponseData,
		});

		render(<App />);
		await waitFor(() => {
			expect(axios.get).toHaveBeenCalledTimes(2);
		});
		jest.useFakeTimers();
		jest.advanceTimersByTime(3000);

		await waitFor(() => {
			expect(axios.get).toHaveBeenCalledTimes(2);
		});
	});

	test('toggles switch and stops ad blocking when selected, on logo press continues', async () => {
		const mockResponseData = {
			status: 'enabled',
		};
		const mockDisabledResponseData = {
			status: 'disabled',
		};

		jest.spyOn(axios, 'get').mockResolvedValue({
			data: mockResponseData,
		});

		const { getByText } = render(<App />);
		await waitFor(() =>
			expect(getByText('PiHole Enabled ✅')).toBeInTheDocument()
		);
		const dropdown = screen.getByRole('combobox');
		userEvent.click(dropdown);
		const option = screen.getByRole('option', { name: '5 minutes' });
		userEvent.click(option);

		const toggleSwitch = screen.getAllByRole('switch');
		fireEvent.click(toggleSwitch[0]);

		jest.spyOn(axios, 'get').mockResolvedValue({
			data: mockDisabledResponseData,
		});
		jest.advanceTimersByTime(10000);
		await waitFor(() =>
			expect(screen.getByText('PiHole Disabled ❌')).toBeInTheDocument()
		);
		await waitFor(() =>
			expect(
				screen.getByText('Time left: 0h 4m 59s seconds')
			).toBeInTheDocument()
		);

		// click the logo
		const logo = screen.getByAltText('PiHole Logo');
		fireEvent.click(logo);
		jest.spyOn(axios, 'get').mockResolvedValue({
			data: mockResponseData,
		});
		jest.advanceTimersByTime(5000);
		await waitFor(() =>
			expect(screen.getByText('PiHole Enabled ✅')).toBeInTheDocument()
		);
	});

	test('mouse over and mouse out on logo', async () => {
		const mockResponseData = {
			status: 'enabled',
		};

		jest.spyOn(axios, 'get').mockResolvedValue({
			data: mockResponseData,
		});
		const { getByText } = render(<App />);
		await waitFor(() =>
			expect(getByText('PiHole Enabled ✅')).toBeInTheDocument()
		);

		const logo = screen.getByAltText('PiHole Logo');
		fireEvent.mouseOver(logo);
		await waitFor(() =>
			expect(
				screen.getByText('Click to start ad blocking again.')
			).toBeInTheDocument()
		);
		fireEvent.mouseMove(logo);
		fireEvent.mouseOut(logo);
		await waitFor(() =>
			expect(screen.getByText('PiHole Enabled ✅')).toBeInTheDocument()
		);
	});

	test('status click opens a new window with the pihole admin page', async () => {
		const mockResponseData = {
			status: 'enabled',
		};

		jest.spyOn(axios, 'get').mockResolvedValue({
			data: mockResponseData,
		});

		// Mock window.open
		const mockWindowOpen = jest.fn();
		global.window.open = mockWindowOpen;

		const { getByText } = render(<App />);
		await waitFor(() =>
			expect(getByText('PiHole Enabled ✅')).toBeInTheDocument()
		);

		const status = screen.getByText('PiHole Enabled ✅');
		fireEvent.click(status);
		await waitFor(() => expect(window.open).toHaveBeenCalledTimes(1));
	});
});
