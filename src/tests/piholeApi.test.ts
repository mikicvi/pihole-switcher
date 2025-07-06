import axios, { AxiosInstance, AxiosResponse } from 'axios';
import PiholeApi from '../services/piholeApi';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock timers
jest.useFakeTimers();

describe('PiholeApi', () => {
	let mockAxiosInstance: jest.Mocked<AxiosInstance>;
	let piholeApi: PiholeApi;
	let consoleSpy: jest.SpyInstance;

	const mockAuthResponse = {
		data: {
			session: {
				valid: true,
				totp: false,
				sid: 'test-session-id',
				csrf: 'test-csrf-token',
				validity: 1800,
			},
			took: 10,
		},
	};

	const mockBlockingStatusResponse = {
		data: {
			blocking: 'enabled' as const,
			timer: null,
		},
	};

	const mockTopDomainsResponse = {
		data: {
			domains: [
				{ domain: 'example.com', count: 100 },
				{ domain: 'test.com', count: 50 },
			],
			total_queries: 1000,
			blocked_queries: 500,
			took: 5,
		},
	};

	const mockDomainsListResponse = {
		data: {
			domains: [
				{
					domain: 'example.com',
					unicode: 'example.com',
					type: 'allow' as const,
					kind: 'exact' as const,
					comment: 'Test comment',
					groups: [0],
					enabled: true,
					id: 1,
					date_added: 1609459200,
					date_modified: 1609459200,
				},
			],
			processed: null,
			took: 5,
		},
	};

	beforeEach(() => {
		// Reset singleton
		(PiholeApi as any).instance = null;

		// Mock console.error
		consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

		// Create mock axios instance
		mockAxiosInstance = {
			create: jest.fn(),
			get: jest.fn(),
			post: jest.fn(),
			delete: jest.fn(),
			interceptors: {
				request: {
					use: jest.fn().mockReturnValue(1),
					eject: jest.fn(),
				},
				response: {
					use: jest.fn(),
					eject: jest.fn(),
				},
			},
			defaults: {},
		} as any;

		// Mock axios.create to return our mock instance
		mockedAxios.create.mockReturnValue(mockAxiosInstance);

		// Set up environment variables
		process.env.REACT_APP_PIHOLE_PASSWORD = 'test-password';

		// Get PiholeApi instance
		piholeApi = PiholeApi.getInstance('http://localhost/api');
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
		consoleSpy.mockRestore();
	});

	describe('getInstance', () => {
		test('returns singleton instance', () => {
			const instance1 = PiholeApi.getInstance('http://localhost/api');
			const instance2 = PiholeApi.getInstance('http://localhost/api');
			expect(instance1).toBe(instance2);
		});

		test('initializes axios instance with correct config', () => {
			expect(mockedAxios.create).toHaveBeenCalledWith({
				baseURL: 'http://localhost/api',
				headers: {
					'Content-Type': 'application/json',
				},
			});
		});
	});

	describe('authentication', () => {
		test('authenticates successfully with valid credentials', async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);

			const status = await piholeApi.getStatus();

			expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth', {
				password: 'test-password',
			});
			expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
			expect(status).toBe('enabled');
		});

		test('handles authentication failure', async () => {
			const invalidAuthResponse = {
				data: {
					session: {
						valid: false,
						totp: false,
						sid: '',
						csrf: '',
						validity: 0,
					},
					took: 10,
				},
			};

			mockAxiosInstance.post.mockResolvedValueOnce(invalidAuthResponse);

			await expect(piholeApi.getStatus()).rejects.toThrow(
				'Authentication failed: Session invalid'
			);
		});

		test('handles 2FA not supported error', async () => {
			const twoFAResponse = {
				data: {
					session: {
						valid: false,
						totp: true,
						sid: '',
						csrf: '',
						validity: 0,
					},
					took: 10,
				},
			};

			mockAxiosInstance.post.mockResolvedValueOnce(twoFAResponse);

			await expect(piholeApi.getStatus()).rejects.toThrow(
				'2FA is enabled but not supported by this application'
			);
		});

		test('handles rate limiting', async () => {
			const rateLimitError = {
				response: { status: 429 },
			};

			mockAxiosInstance.post.mockRejectedValueOnce(rateLimitError);

			await expect(piholeApi.getStatus()).rejects.toThrow(
				'Rate limited. Please wait before trying again.'
			);
		});

		test('sets up session refresh after authentication', async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);

			await piholeApi.getStatus();

			// Fast-forward to trigger session refresh
			jest.advanceTimersByTime(1500 * 1000);

			expect(mockAxiosInstance.get).toHaveBeenCalledWith(
				'/dns/blocking/status',
				{
					headers: {
						'X-FTL-SID': 'test-session-id',
						'X-FTL-CSRF': 'test-csrf-token',
					},
				}
			);
		});
	});

	describe('getStatus', () => {
		beforeEach(async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);
		});

		test('returns blocking status', async () => {
			const status = await piholeApi.getStatus();
			expect(status).toBe('enabled');
			expect(mockAxiosInstance.get).toHaveBeenCalledWith('/dns/blocking/status');
		});

		test('authenticates before making request', async () => {
			await piholeApi.getStatus();
			expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth', {
				password: 'test-password',
			});
		});
	});

	describe('disable', () => {
		beforeEach(async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.post.mockResolvedValueOnce({ data: {} });
		});

		test('disables blocking with duration', async () => {
			await piholeApi.disable('300');

			expect(mockAxiosInstance.post).toHaveBeenCalledWith(
				'/dns/blocking',
				{
					blocking: false,
					timer: 300,
				},
				{
					headers: {
						'X-FTL-SID': 'test-session-id',
					},
				}
			);
		});
	});

	describe('enable', () => {
		beforeEach(async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.post.mockResolvedValueOnce({ data: {} });
		});

		test('enables blocking', async () => {
			await piholeApi.enable();

			expect(mockAxiosInstance.post).toHaveBeenCalledWith(
				'/dns/blocking',
				{
					blocking: true,
					timer: null,
				},
				{
					headers: {
						'X-FTL-SID': 'test-session-id',
					},
				}
			);
		});
	});

	describe('getAdminUrl', () => {
		test('returns admin URL from API URL', () => {
			const adminUrl = piholeApi.getAdminUrl();
			expect(adminUrl).toBe('http://localhost/admin');
		});

		test('handles API URL with trailing slash', () => {
			const apiWithSlash = PiholeApi.getInstance('http://localhost/api/');
			const adminUrl = apiWithSlash.getAdminUrl();
			expect(adminUrl).toBe('http://localhost/admin');
		});
	});

	describe('getTopItems', () => {
		beforeEach(async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
		});

		test('returns top items data', async () => {
			mockAxiosInstance.get
				.mockResolvedValueOnce(mockTopDomainsResponse) // permitted domains
				.mockResolvedValueOnce(mockTopDomainsResponse); // blocked domains

			const result = await piholeApi.getTopItems();

			expect(result).toEqual({
				top_queries: {
					'example.com': 100,
					'test.com': 50,
				},
				top_ads: {
					'example.com': 100,
					'test.com': 50,
				},
			});

			expect(mockAxiosInstance.get).toHaveBeenCalledWith(
				'/stats/top_domains?blocked=false&count=10'
			);
			expect(mockAxiosInstance.get).toHaveBeenCalledWith(
				'/stats/top_domains?blocked=true&count=10'
			);
		});
	});

	describe('getList', () => {
		beforeEach(async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
		});

		test('gets whitelist', async () => {
			mockAxiosInstance.get.mockResolvedValueOnce(mockDomainsListResponse);

			const result = await piholeApi.getList('whitelist');

			expect(result).toEqual([
				{
					domain: 'example.com',
					date_modified: 1609459200,
					enabled: true,
				},
			]);

			expect(mockAxiosInstance.get).toHaveBeenCalledWith(
				'/domains/allow/exact',
				{
					headers: {
						'X-FTL-SID': 'test-session-id',
						'X-FTL-CSRF': 'test-csrf-token',
					},
				}
			);
		});

		test('gets blacklist', async () => {
			mockAxiosInstance.get.mockResolvedValueOnce(mockDomainsListResponse);

			const result = await piholeApi.getList('blacklist');

			expect(result).toEqual([
				{
					domain: 'example.com',
					date_modified: 1609459200,
					enabled: true,
				},
			]);

			expect(mockAxiosInstance.get).toHaveBeenCalledWith(
				'/domains/deny/exact',
				{
					headers: {
						'X-FTL-SID': 'test-session-id',
						'X-FTL-CSRF': 'test-csrf-token',
					},
				}
			);
		});
	});

	describe('addToList', () => {
		beforeEach(async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
		});

		test('adds domain to whitelist', async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockDomainsListResponse);

			const result = await piholeApi.addToList('whitelist', 'newdomain.com');

			expect(result).toEqual({ alreadyExists: false });

			expect(mockAxiosInstance.post).toHaveBeenCalledWith(
				'/domains/allow/exact',
				{
					domain: 'newdomain.com',
					comment: 'Added by pihole-switcher via API',
					groups: [0],
					enabled: true,
				},
				{
					headers: {
						'X-FTL-SID': 'test-session-id',
						'X-FTL-CSRF': 'test-csrf-token',
					},
				}
			);
		});

		test('adds domain to blacklist', async () => {
			mockAxiosInstance.post.mockResolvedValueOnce(mockDomainsListResponse);

			const result = await piholeApi.addToList('blacklist', 'baddomain.com');

			expect(result).toEqual({ alreadyExists: false });

			expect(mockAxiosInstance.post).toHaveBeenCalledWith(
				'/domains/deny/exact',
				{
					domain: 'baddomain.com',
					comment: 'Added by pihole-switcher via API',
					groups: [0],
					enabled: true,
				},
				{
					headers: {
						'X-FTL-SID': 'test-session-id',
						'X-FTL-CSRF': 'test-csrf-token',
					},
				}
			);
		});

		test('handles domain already exists', async () => {
			const uniqueConstraintError = {
				response: {
					data: {
						error: 'UNIQUE constraint failed',
					},
				},
			};

			mockAxiosInstance.post.mockRejectedValueOnce(uniqueConstraintError);

			const result = await piholeApi.addToList('whitelist', 'existing.com');

			expect(result).toEqual({ alreadyExists: true });
		});

		test('handles other errors', async () => {
			const otherError = {
				response: {
					data: {
						error: 'Some other error',
					},
				},
			};

			mockAxiosInstance.post.mockRejectedValueOnce(otherError);

			await expect(
				piholeApi.addToList('whitelist', 'error.com')
			).rejects.toThrow('Failed to add domain to list');
		});
	});

	describe('logout', () => {
		test('logs out successfully', async () => {
			// First authenticate
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);
			await piholeApi.getStatus();

			// Then logout
			mockAxiosInstance.delete.mockResolvedValueOnce({ data: {} });
			await piholeApi.logout();

			expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/auth');
			expect(mockAxiosInstance.interceptors.request.eject).toHaveBeenCalledWith(1);
		});

		test('handles logout error gracefully', async () => {
			// First authenticate
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);
			await piholeApi.getStatus();

			// Then fail logout - the finally block should still clean up
			mockAxiosInstance.delete.mockRejectedValueOnce(new Error('Logout failed'));
			
			// The logout method will throw but should still clean up
			await expect(piholeApi.logout()).rejects.toThrow('Logout failed');
			
			// Should still clean up internal state
			expect(mockAxiosInstance.interceptors.request.eject).toHaveBeenCalledWith(1);
		});
	});

	describe('destroy', () => {
		test('cleans up resources', async () => {
			// First authenticate to set up resources
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);
			await piholeApi.getStatus();

			// Mock logout for destroy
			mockAxiosInstance.delete.mockResolvedValueOnce({ data: {} });

			piholeApi.destroy();

			expect(mockAxiosInstance.interceptors.request.eject).toHaveBeenCalledWith(1);
		});
	});

	describe('session management', () => {
		test('session refresh clears session on failure', async () => {
			// First authenticate
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);
			await piholeApi.getStatus();

			// Access private method to test session refresh failure directly
			const refreshSessionMethod = (piholeApi as any).refreshSession.bind(piholeApi);
			
			// Set up failure for session refresh
			mockAxiosInstance.get.mockRejectedValueOnce(new Error('Session refresh failed'));

			// Call refresh session directly
			await refreshSessionMethod();

			// Verify that session state was cleared
			expect((piholeApi as any).sid).toBeNull();
			expect((piholeApi as any).csrf).toBeNull();
		});
	});

	describe('environment variable handling', () => {
		test('uses process.env password when available', async () => {
			// This test verifies the normal case where process.env has the password
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);

			await piholeApi.getStatus();

			expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth', {
				password: 'test-password',  // From our beforeEach setup
			});
		});
	});

	describe('edge cases and error handling', () => {
		test('handles authentication cooldown', async () => {
			// Make first auth fail
			mockAxiosInstance.post.mockRejectedValueOnce(new Error('First auth failed'));
			
			try {
				await piholeApi.getStatus();
			} catch (error) {
				// Expected to fail
			}

			// Immediately try again - should respect cooldown
			const startTime = Date.now();
			
			// Second auth should succeed after cooldown
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);

			jest.advanceTimersByTime(2100); // Advance past cooldown
			
			const status = await piholeApi.getStatus();
			expect(status).toBe('enabled');
		});

		test('handles missing session ID in logout', async () => {
			// Call logout without being authenticated
			await piholeApi.logout();
			
			// Should not call delete endpoint
			expect(mockAxiosInstance.delete).not.toHaveBeenCalled();
		});

		test('handles interceptor cleanup', async () => {
			// First authenticate to create interceptor
			mockAxiosInstance.post.mockResolvedValueOnce(mockAuthResponse);
			mockAxiosInstance.get.mockResolvedValueOnce(mockBlockingStatusResponse);
			await piholeApi.getStatus();

			// Clear all mock calls to track subsequent calls
			jest.clearAllMocks();

			// Call logout which should clean up the interceptor
			await piholeApi.logout();

			// Should have ejected the interceptor
			expect(mockAxiosInstance.interceptors.request.eject).toHaveBeenCalledWith(1);
		});
	});
});
