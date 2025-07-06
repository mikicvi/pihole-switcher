import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Filterlist from '../Filterlist';
import PiholeApi from '../services/piholeApi';

// Mock the PiholeApi class
jest.mock('../services/piholeApi');

// Mock Fluent UI components that might cause issues
jest.mock('@fluentui/react', () => ({
	...jest.requireActual('@fluentui/react'),
	DetailsList: ({ items, onRenderRow }: any) => {
		return (
			<div data-testid="details-list">
				{items?.map((item: any, index: number) => (
					<div key={index} data-testid={`list-item-${index}`}>
						{onRenderRow
							? onRenderRow({ item, itemIndex: index })
							: JSON.stringify(item)}
					</div>
				))}
			</div>
		);
	},
	CommandBar: ({ items }: any) => (
		<div data-testid="command-bar">
			{items?.map((item: any, index: number) => (
				<button key={index} onClick={item.onClick}>
					{item.text}
				</button>
			))}
		</div>
	),
	Spinner: () => <div data-testid="spinner">Loading...</div>,
	MessageBar: ({ children }: any) => (
		<div data-testid="message-bar">{children}</div>
	),
}));

describe('Filterlist Component', () => {
	let mockPiholeApiInstance: jest.Mocked<PiholeApi>;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});

		// Create a mock instance with all required methods
		mockPiholeApiInstance = {
			getStatus: jest.fn().mockResolvedValue('enabled'),
			disable: jest
				.fn()
				.mockResolvedValue({ data: { status: 'disabled' } }),
			enable: jest
				.fn()
				.mockResolvedValue({ data: { status: 'enabled' } }),
			getTopItems: jest
				.fn()
				.mockResolvedValue({ data: { top_queries: {}, top_ads: {} } }),
			destroy: jest.fn(),
			getAdminUrl: jest.fn().mockReturnValue('http://localhost'),
			// Add filterlist-specific methods
			getList: jest.fn().mockResolvedValue([
				{
					domain: 'example.com',
					date_modified: 1609459200,
					enabled: true,
				},
				{
					domain: 'test.com',
					date_modified: 1609545600,
					enabled: false,
				},
			]),
			addToList: jest.fn().mockResolvedValue({ alreadyExists: false }),
		} as any;

		// Mock getInstance to return our mock instance
		(PiholeApi as any).getInstance = jest
			.fn()
			.mockReturnValue(mockPiholeApiInstance);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('renders without crashing', () => {
		render(<Filterlist />);
		expect(screen.getByTestId('details-list')).toBeInTheDocument();
	});

	test('displays filter list header', () => {
		render(<Filterlist />);
		expect(screen.getByText('Filter List: Whitelist')).toBeInTheDocument();
	});

	test('renders dropdown for list type selection', () => {
		render(<Filterlist />);
		expect(screen.getByLabelText('Select List Type')).toBeInTheDocument();
	});

	test('renders domain input field', () => {
		render(<Filterlist />);
		expect(screen.getByLabelText('Domain')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Enter domain')).toBeInTheDocument();
	});

	test('renders add button', () => {
		render(<Filterlist />);
		expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
	});

	test('renders with basic structure', async () => {
		render(<Filterlist />);

		// Wait for any async operations to complete
		await waitFor(() => {
			expect(screen.getByTestId('details-list')).toBeInTheDocument();
		});

		expect(screen.getByText('Filter List: Whitelist')).toBeInTheDocument();
		expect(screen.getByLabelText('Select List Type')).toBeInTheDocument();
	});
});
