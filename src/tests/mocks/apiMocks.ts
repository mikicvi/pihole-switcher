// apiMocks.ts
import axios from 'axios';

let mockStatus = 'enabled';

/**
 * Comprehensive mock that handles all axios requests in one place
 * @param status The pihole status to mock ('enabled' or 'disabled')
 */
export const mockPiholeApiComprehensive = (
	status: 'enabled' | 'disabled'
): { getSpy: jest.SpyInstance; postSpy: jest.SpyInstance } => {
	mockStatus = status;

	const getSpy = jest
		.spyOn(axios, 'get')
		.mockImplementation((url: string) => {
			if (url.includes('/dns/blocking/status')) {
				return Promise.resolve({
					data: { blocking: mockStatus },
				});
			} else if (url.includes('top_domains')) {
				if (url.includes('blocked=true')) {
					return Promise.resolve({
						data: {
							domains: [
								{ domain: 'ads.example.com', count: 10 },
								{ domain: 'tracking.example.com', count: 5 },
							],
							total_queries: 15,
							blocked_queries: 15,
							took: 0.1,
						},
					});
				} else {
					return Promise.resolve({
						data: {
							domains: [
								{ domain: 'google.com', count: 20 },
								{ domain: 'example.com', count: 15 },
							],
							total_queries: 35,
							blocked_queries: 0,
							took: 0.1,
						},
					});
				}
			}

			// Default response for other axios get calls
			return Promise.resolve({ data: {} });
		});

	const postSpy = jest
		.spyOn(axios, 'post')
		.mockImplementation((url: string, data: any) => {
			if (url.includes('/auth')) {
				return Promise.resolve({
					data: {
						session: {
							valid: true,
							totp: false,
							sid: 'mock-sid-123',
							csrf: 'mock-csrf-456',
							validity: 1800,
						},
						took: 0.1,
					},
				});
			} else if (url.includes('/dns/blocking')) {
				// Handle enable/disable requests
				const isBlocking = data.blocking;
				mockStatus = isBlocking ? 'enabled' : 'disabled';

				return Promise.resolve({
					data: {
						success: true,
						blocking: mockStatus,
						timer: data.timer,
					},
				});
			}

			// For any other POST request, return a generic success
			return Promise.resolve({ data: { success: true } });
		});

	return { getSpy, postSpy };
};

/**
 * Setup mock for a successful API response
 * @param status The pihole status to mock ('enabled' or 'disabled')
 * @deprecated Use mockPiholeApiComprehensive instead
 */
export const mockPiholeApiStatus = (
	status: 'enabled' | 'disabled'
): jest.SpyInstance => {
	return mockPiholeApiComprehensive(status).getSpy;
};

/**
 * Mock top items API response
 * @deprecated Use mockPiholeApiComprehensive instead
 */
export const mockPiholeTopItems = (): jest.SpyInstance => {
	return mockPiholeApiComprehensive('enabled').getSpy;
};

/**
 * Mock authentication response
 * @deprecated Use mockPiholeApiComprehensive instead
 */
export const mockPiholeAuth = (): jest.SpyInstance => {
	return mockPiholeApiComprehensive('enabled').postSpy;
};
