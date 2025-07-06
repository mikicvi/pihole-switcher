// src/tests/mocks/filterlistMocks.ts
import axios from 'axios';

/**
 * Mock Filterlist API calls while preserving other API mocks
 */
export const mockFilterlistApis = (): jest.SpyInstance[] => {
	const spies: jest.SpyInstance[] = [];

	// Mock GET requests for domain lists
	const getSpy = jest
		.spyOn(axios, 'get')
		.mockImplementation((url: string) => {
			// Handle authentication status
			if (url.includes('/dns/blocking/status')) {
				return Promise.resolve({
					data: { blocking: 'enabled' },
				});
			}

			// Handle authentication token
			if (url.includes('/auth')) {
				return Promise.resolve({
					data: { session: { valid: true, api_token: 'test-token' } },
				});
			}

			// Handle top items
			if (url.includes('/stats/top_items')) {
				return Promise.resolve({
					data: {
						top_queries: { 'google.com': 100 },
						top_ads: { 'ads.example.com': 50 },
					},
				});
			}

			// Handle whitelist/blacklist domain lists
			if (
				url.includes('/domains/allow/exact') ||
				url.includes('/domains/deny/exact')
			) {
				return Promise.resolve({
					data: {
						domains: [
							{
								domain: 'example.com',
								unicode: 'example.com',
								type: url.includes('allow') ? 'allow' : 'deny',
								kind: 'exact',
								comment: null,
								groups: [0],
								enabled: true,
								id: 1,
								date_added: 1234567890,
								date_modified: 1234567890,
							},
							{
								domain: 'test.com',
								unicode: 'test.com',
								type: url.includes('allow') ? 'allow' : 'deny',
								kind: 'exact',
								comment: null,
								groups: [0],
								enabled: false,
								id: 2,
								date_added: 1234567891,
								date_modified: 1234567891,
							},
						],
						processed: null,
						took: 0.1,
					},
				});
			}

			// Default for other endpoints
			return Promise.resolve({ data: {} });
		});
	spies.push(getSpy);

	// Mock POST requests (for adding domains and authentication)
	const postSpy = jest
		.spyOn(axios, 'post')
		.mockImplementation((url: string, data: any) => {
			// Handle authentication
			if (url.includes('/auth')) {
				return Promise.resolve({
					data: { session: { valid: true, api_token: 'test-token' } },
				});
			}

			// Handle domain addition
			if (
				url.includes('/domains/allow/exact') ||
				url.includes('/domains/deny/exact')
			) {
				return Promise.resolve({
					data: {
						domains: [],
						processed: {
							success: [
								{
									item:
										data.domain ||
										data.domains?.[0] ||
										'newdomain.com',
								},
							],
							errors: [],
						},
						took: 0.1,
					},
				});
			}

			return Promise.resolve({ data: { success: true } });
		});
	spies.push(postSpy);

	// Mock DELETE requests (for removing domains)
	const deleteSpy = jest
		.spyOn(axios, 'delete')
		.mockImplementation((url: string) => {
			if (url.includes('/domains/')) {
				return Promise.resolve({
					data: {
						success: true,
					},
				});
			}

			return Promise.resolve({ data: { success: true } });
		});
	spies.push(deleteSpy);

	return spies;
};
