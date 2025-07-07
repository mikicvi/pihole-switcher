import {
	render,
	screen,
	fireEvent,
	waitFor,
	act,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import Graph from '../Graph';
import { ReactNode } from 'react';

interface ChartData {
	labels: string[];
	datasets: Array<{
		data: number[];
		backgroundColor: string[];
		borderColor: string[];
		borderWidth: number;
		padding: number;
	}>;
}

interface PivotProps {
	children: ReactNode;
	onLinkClick?: (item: { props: { itemKey?: string } }) => void;
	selectedKey?: string;
	className?: string;
	'aria-label'?: string;
}

interface PivotItemProps {
	headerText: string;
	itemKey?: string;
	className?: string;
	children?: ReactNode;
	style?: React.CSSProperties;
}

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock PiholeApi explicitly
jest.mock('../services/piholeApi', () => {
	return {
		__esModule: true,
		default: class PiholeApi {
			static getInstance(baseUrl: string) {
				// Store the baseUrl for testing
				(PiholeApi as any).lastBaseUrl = baseUrl;
				return {
					getTopItems: jest.fn().mockResolvedValue({
						top_queries: {
							'query1.com': 50,
							'query2.com': 30,
						},
						top_ads: {
							'ads1.com': 40,
							'ads2.com': 20,
						},
					}),
				};
			}
			static lastBaseUrl: string;
		},
	};
});

// Mock react-chartjs-2 to avoid rendering issues
jest.mock('react-chartjs-2', () => ({
	Pie: ({ data }: { data: ChartData }) => (
		<div data-testid="pie-chart" data-chart-data={JSON.stringify(data)}>
			Mocked Pie Chart
		</div>
	),
}));

// Mock ChartJS registration
jest.mock('chart.js', () => ({
	Chart: {
		register: jest.fn(),
	},
	ArcElement: jest.fn(),
	Tooltip: jest.fn(),
	Legend: jest.fn(),
}));

// Mock Fluent UI components with a simpler implementation
jest.mock('@fluentui/react', () => {
	const React = require('react');

	return {
		useTheme: () => ({
			palette: {
				neutralPrimary: '#000000',
				themePrimary: '#0078d4',
			},
		}),
		Pivot: ({
			children,
			onLinkClick,
			selectedKey,
			className = '',
			'aria-label': ariaLabel,
		}: PivotProps) => {
			// We need to intercept tab clicks to make them work in tests
			const handleClick = (itemKey?: string) => {
				if (onLinkClick) {
					onLinkClick({ props: { itemKey } });
				}
			};

			// Handle custom event to test the case where onLinkClick is called with undefined
			const handleCustomEvent = (e: Event) => {
				if (e.type === 'customEvent' && onLinkClick) {
					// This will call onLinkClick with undefined
					onLinkClick(undefined as any);
				}
			};

			return (
				<div
					className={`pivot ${className}`}
					data-selected-key={selectedKey}
					aria-label={ariaLabel}
					// Add event listener for our custom event
					ref={(node) => {
						if (node) {
							node.addEventListener(
								'customEvent',
								handleCustomEvent
							);
						}
					}}
				>
					{React.Children.map(children, (child: any) => {
						// Clone the child to inject the click handler
						return React.cloneElement(child, {
							onClick: () => handleClick(child.props.itemKey),
							currentSelectedKey: selectedKey, // Pass down the current selected key
						});
					})}
				</div>
			);
		},
		PivotItem: ({
			headerText,
			itemKey,
			className = '',
			children,
			style,
			onClick,
			currentSelectedKey,
		}: PivotItemProps & {
			onClick?: () => void;
			currentSelectedKey?: string;
		}) => (
			<div
				className={`tab ${className} ${
					currentSelectedKey === itemKey ? 'active' : ''
				}`}
				data-key={itemKey}
				style={style}
				onClick={onClick}
			>
				{headerText}
				{children}
			</div>
		),
	};
});

const mockApiResponse = {
	top_queries: {
		'query1.com': 50,
		'query2.com': 30,
		'query3.com': 20,
		'query4.com': 15,
		'query5.com': 10,
	},
	top_ads: {
		'ads1.com': 40,
		'ads2.com': 20,
		'ads3.com': 15,
		'ads4.com': 10,
		'ads5.com': 5,
	},
};

describe('Graph Component', () => {
	beforeEach(() => {
		mockedAxios.get.mockResolvedValue({ data: mockApiResponse });
		// Clear and restore mocks
		jest.clearAllMocks();
		// Mock the window._env_ object used in the component
		window._env_ = { REACT_APP_PIHOLE_BASE: 'http://localhost:8080/api' };
	});

	afterEach(() => {
		jest.clearAllMocks();
		delete window._env_;
	});

	test('renders tabs correctly', async () => {
		render(<Graph />);
		expect(screen.getByText('Top Ads')).toBeInTheDocument();
		expect(screen.getByText('Top Queries')).toBeInTheDocument();
	});

	test('shows ads pie chart by default', async () => {
		// Use a mock that sets the state synchronously for testing
		const piholeApiModule = require('../services/piholeApi').default;
		piholeApiModule.getInstance = jest.fn().mockReturnValue({
			getTopItems: jest.fn().mockImplementation(async () => {
				// Return a promise that resolves immediately
				return Promise.resolve({
					top_queries: { 'query1.com': 50 },
					top_ads: { 'ads1.com': 40 },
				});
			}),
		});

		await act(async () => {
			render(<Graph />);
		});

		// Now we can safely check for the chart
		expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
	});

	test('initializes with the correct state values', async () => {
		render(<Graph />);

		// By default, the 'topAds' tab should be selected
		const pivotElement = screen.getByText('Top Ads').closest('.tab');
		expect(pivotElement).toHaveClass('active');

		// The other tab should not be active
		const queriesTab = screen.getByText('Top Queries').closest('.tab');
		expect(queriesTab).not.toHaveClass('active');
	});

	test('switches to queries chart when clicking Queries tab', async () => {
		// Use a mock that sets the state synchronously for testing
		const piholeApiModule = require('../services/piholeApi').default;
		piholeApiModule.getInstance = jest.fn().mockReturnValue({
			getTopItems: jest.fn().mockImplementation(async () => {
				// Return a promise that resolves immediately
				return Promise.resolve({
					top_queries: { 'query1.com': 50 },
					top_ads: { 'ads1.com': 40 },
				});
			}),
		});

		await act(async () => {
			render(<Graph />);
		});

		// First check that we have the chart
		expect(screen.getByTestId('pie-chart')).toBeInTheDocument();

		// Click on Queries tab
		await act(async () => {
			fireEvent.click(screen.getByText('Top Queries'));
		});

		// Verify state changed - in our mock both tabs share the same testId
		// So we check the active class added to the tab elements
		const queriesTab = screen.getByText('Top Queries').closest('.tab');
		expect(queriesTab).toHaveClass('active');

		// Top Ads tab should no longer be active
		const adsTab = screen.getByText('Top Ads').closest('.tab');
		expect(adsTab).not.toHaveClass('active');
	});

	test('handles onLinkClick when item is undefined', async () => {
		// Use a mock that captures the onLinkClick handler
		let capturedOnLinkClick: ((item?: any) => void) | null = null;

		// Modified Pivot mock for this test only
		const originalPivot = jest.requireMock('@fluentui/react').Pivot;
		jest.requireMock('@fluentui/react').Pivot = ({
			onLinkClick,
			...rest
		}: any) => {
			// Capture the onLinkClick handler
			capturedOnLinkClick = onLinkClick;
			return originalPivot({ onLinkClick, ...rest });
		};

		await act(async () => {
			render(<Graph />);
		});

		// Before the test, tabs should be in initial state
		const adsTab = screen.getByText('Top Ads').closest('.tab');
		expect(adsTab).toHaveClass('active');

		// Now directly call the onLinkClick with undefined
		if (capturedOnLinkClick) {
			await act(async () => {
				// Typecast to avoid TypeScript error
				(capturedOnLinkClick as (item?: any) => void)(undefined);
			});
		}

		// After calling with undefined, the topAds tab should still be active (default behavior)
		expect(adsTab).toHaveClass('active');

		// Restore the original Pivot implementation
		jest.requireMock('@fluentui/react').Pivot = originalPivot;
	});

	test('handles API error gracefully', async () => {
		const consoleErrorSpy = jest
			.spyOn(console, 'error')
			.mockImplementation();

		// Force the PiholeApi.getTopItems to reject
		const piholeApiModule = require('../services/piholeApi').default;
		piholeApiModule.getInstance = jest.fn().mockReturnValue({
			getTopItems: jest.fn().mockRejectedValue(new Error('API Error')),
		});

		render(<Graph />);

		await waitFor(() => {
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'Error:',
				expect.any(Error)
			);
		});

		consoleErrorSpy.mockRestore();
	});

	test('processes API data correctly for top ads chart', async () => {
		// Use a mock that sets the state synchronously for testing
		const piholeApiModule = require('../services/piholeApi').default;
		piholeApiModule.getInstance = jest.fn().mockReturnValue({
			getTopItems: jest.fn().mockImplementation(async () => {
				// Return a promise that resolves immediately
				return Promise.resolve({
					top_queries: { 'query1.com': 50, 'query2.com': 30 },
					top_ads: { 'ads1.com': 40, 'ads2.com': 20 },
				});
			}),
		});

		await act(async () => {
			render(<Graph />);
		});

		// Test that the data is passed to the chart component
		const chartElement = screen.getByTestId('pie-chart');
		const chartData = JSON.parse(
			chartElement.getAttribute('data-chart-data') || '{}'
		);

		// Validate chart data structure
		expect(chartData).toHaveProperty('labels');
		expect(chartData).toHaveProperty('datasets');
		expect(chartData.datasets[0]).toHaveProperty('data');
		expect(chartData.datasets[0]).toHaveProperty('backgroundColor');
		expect(chartData.datasets[0]).toHaveProperty('borderColor');

		// Validate chart data content
		expect(chartData.labels).toContain('ads1.com');
		expect(chartData.labels).toContain('ads2.com');
		expect(chartData.datasets[0].data).toContain(40);
		expect(chartData.datasets[0].data).toContain(20);
	});

	test('processes API data correctly for top queries chart', async () => {
		// Use a mock that sets the state synchronously for testing
		const piholeApiModule = require('../services/piholeApi').default;
		piholeApiModule.getInstance = jest.fn().mockReturnValue({
			getTopItems: jest.fn().mockImplementation(async () => {
				// Return a promise that resolves immediately
				return Promise.resolve({
					top_queries: { 'query1.com': 50, 'query2.com': 30 },
					top_ads: { 'ads1.com': 40, 'ads2.com': 20 },
				});
			}),
		});

		await act(async () => {
			render(<Graph />);
		});

		// Switch to Queries tab
		await act(async () => {
			fireEvent.click(screen.getByText('Top Queries'));
		});

		// Chart should still be rendered with query data
		const chartElement = screen.getByTestId('pie-chart');
		const chartData = JSON.parse(
			chartElement.getAttribute('data-chart-data') || '{}'
		);

		// Validate chart data structure and content
		expect(chartData.labels).toContain('query1.com');
		expect(chartData.labels).toContain('query2.com');
		expect(chartData.datasets[0].data).toContain(50);
		expect(chartData.datasets[0].data).toContain(30);
	});

	test('uses environment variable for API base URL', () => {
		// Override the environment variable
		const originalEnv = process.env.REACT_APP_PIHOLE_BASE;
		process.env.REACT_APP_PIHOLE_BASE = 'http://test-env-url/api';
		delete window._env_;

		// Mock the PiholeApi.getInstance to capture the baseUrl
		const piholeApiModule = require('../services/piholeApi').default;
		const originalGetInstance = piholeApiModule.getInstance;

		let capturedBaseUrl = '';
		piholeApiModule.getInstance = jest.fn((baseUrl) => {
			capturedBaseUrl = baseUrl;
			return {
				getTopItems: jest.fn().mockResolvedValue({
					top_queries: {},
					top_ads: {},
				}),
			};
		});

		render(<Graph />);

		// Verify the correct URL was used
		expect(capturedBaseUrl).toBe('http://test-env-url/api');

		// Restore original getInstance
		piholeApiModule.getInstance = originalGetInstance;

		// Restore original environment
		process.env.REACT_APP_PIHOLE_BASE = originalEnv;
	});

	test('uses window._env_ variable when REACT_APP_PIHOLE_BASE is not set', () => {
		// Clear the environment variable - make sure to store the original value
		const originalEnv = process.env.REACT_APP_PIHOLE_BASE;
		// We need to fully delete the property, not just set it to undefined
		delete process.env.REACT_APP_PIHOLE_BASE;

		// Set the window._env_ value
		window._env_ = { REACT_APP_PIHOLE_BASE: 'http://test-window-env/api' };

		// Mock the PiholeApi.getInstance to capture the baseUrl
		const piholeApiModule = require('../services/piholeApi').default;
		const originalGetInstance = piholeApiModule.getInstance;

		let capturedBaseUrl = '';
		piholeApiModule.getInstance = jest.fn((baseUrl) => {
			capturedBaseUrl = baseUrl;
			return {
				getTopItems: jest.fn().mockResolvedValue({
					top_queries: {},
					top_ads: {},
				}),
			};
		});

		render(<Graph />);

		// Verify the correct URL was used
		expect(capturedBaseUrl).toBe('http://test-window-env/api');

		// Restore original getInstance
		piholeApiModule.getInstance = originalGetInstance;

		// Restore original environment
		process.env.REACT_APP_PIHOLE_BASE = originalEnv;
	});

	test('handles empty or null API response gracefully', async () => {
		// Mock empty response
		const piholeApiModule = require('../services/piholeApi').default;
		piholeApiModule.getInstance = jest.fn().mockReturnValue({
			getTopItems: jest.fn().mockImplementation(async () => {
				return Promise.resolve({
					top_queries: {},
					top_ads: {},
				});
			}),
		});

		await act(async () => {
			render(<Graph />);
		});

		// Component should render without errors
		expect(screen.getByTestId('pie-chart')).toBeInTheDocument();

		// Switch tabs should still work
		await act(async () => {
			fireEvent.click(screen.getByText('Top Queries'));
		});

		expect(screen.getByText('Top Queries').closest('.tab')).toHaveClass(
			'active'
		);
	});

	test('only processes the top 10 items even if more are provided', async () => {
		// Mock response with more than 10 items
		const largeResponse: {
			top_queries: Record<string, number>;
			top_ads: Record<string, number>;
		} = {
			top_queries: {},
			top_ads: {},
		};

		// Create 15 items
		for (let i = 1; i <= 15; i++) {
			largeResponse.top_ads[`ads${i}.com`] = 50 - i;
			largeResponse.top_queries[`query${i}.com`] = 50 - i;
		}

		const piholeApiModule = require('../services/piholeApi').default;
		piholeApiModule.getInstance = jest.fn().mockReturnValue({
			getTopItems: jest.fn().mockImplementation(async () => {
				return Promise.resolve(largeResponse);
			}),
		});

		await act(async () => {
			render(<Graph />);
		});

		// Verify only 10 items in the chart data
		const chartElement = screen.getByTestId('pie-chart');
		const chartData = JSON.parse(
			chartElement.getAttribute('data-chart-data') || '{}'
		);

		expect(chartData.labels.length).toBeLessThanOrEqual(10);
		expect(chartData.datasets[0].data.length).toBeLessThanOrEqual(10);
	});
});
