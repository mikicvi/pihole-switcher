import axios, { AxiosInstance } from 'axios';

interface AuthResponse {
	session: {
		valid: boolean;
		totp: boolean;
		sid: string;
		csrf: string;
		validity: number;
	};
	took: number;
}

interface BlockingStatus {
	blocking: 'enabled' | 'disabled' | 'failed' | 'unknown';
	timer: number | null;
}

interface TopItems {
	top_queries: { [domain: string]: number };
	top_ads: { [domain: string]: number };
}

interface ListResponse {
	data: Array<{
		domain: string;
		date_modified: number;
		enabled: boolean;
	}>;
}

interface BlockingRequest {
	blocking: boolean;
	timer: number | null;
}

interface TopDomainsResponse {
	domains: Array<{
		domain: string;
		count: number;
	}>;
	total_queries: number;
	blocked_queries: number;
	took: number;
}

interface AddDomainRequest {
	domain: string;
	comment: string | null;
	groups: number[];
	enabled: boolean;
}

interface DomainsListResponse {
	domains: Array<{
		domain: string;
		unicode: string;
		type: 'allow' | 'deny';
		kind: 'exact' | 'regex';
		comment: string | null;
		groups: number[];
		enabled: boolean;
		id: number;
		date_added: number;
		date_modified: number;
	}>;
	processed: {
		success: Array<{ item: string }>;
		errors: Array<{ item: string; error: string }>;
	} | null;
	took: number;
}

class PiholeApi {
	private static instance: PiholeApi | null = null;
	private axiosInstance!: AxiosInstance; // Using definite assignment assertion
	private baseUrl!: string; // Using definite assignment assertion
	private sid: string | null = null;
	private csrf: string | null = null;
	private sessionTimeout: NodeJS.Timeout | null = null;
	private lastAuthAttempt: number = 0;
	private readonly AUTH_COOLDOWN = 2000; // 2 seconds between auth attempts
	private interceptorId: number | null = null;
	private isAuthenticating: boolean = false;
	private sessionRefreshTimer: NodeJS.Timeout | null = null;
	private readonly SESSION_REFRESH_INTERVAL = 1500; // Refresh 5 minutes before expiry (1800 - 300 seconds)

	private constructor(baseUrl: string) {
		this.initialize(baseUrl);
	}

	private initialize(baseUrl: string): void {
		this.baseUrl = baseUrl;
		this.axiosInstance = axios.create({
			baseURL: baseUrl,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	public static getInstance(baseUrl: string): PiholeApi {
		if (!PiholeApi.instance) {
			PiholeApi.instance = new PiholeApi(baseUrl);
		}
		return PiholeApi.instance;
	}

	private setupInterceptor(): void {
		// Remove existing interceptor if any
		if (this.interceptorId !== null) {
			this.axiosInstance.interceptors.request.eject(this.interceptorId);
		}

		// Add new interceptor - but don't add sid to URL anymore - we use headers
		this.interceptorId = this.axiosInstance.interceptors.request.use(
			(config) => {
				if (this.sid) {
					config.headers['sid'] = this.sid;
				}
				if (this.csrf) {
					config.headers['X-FTL-CSRF'] = this.csrf;
				}
				return config;
			}
		);
	}

	private async ensureAuthenticated(): Promise<void> {
		// If we're already authenticated, return
		if (this.sid) {
			return;
		}

		// If authentication is in progress, wait for it
		if (this.isAuthenticating) {
			while (this.isAuthenticating) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			if (this.sid) return;
		}

		try {
			this.isAuthenticating = true;
			// Clear any existing session first
			await this.logout();
			await this.authenticate();
		} finally {
			this.isAuthenticating = false;
		}
	}

	private async refreshSession(): Promise<void> {
		try {
			// Make a lightweight call to keep session alive
			await this.axiosInstance.get('/dns/blocking/status', {
				headers: {
					'X-FTL-SID': this.sid,
					'X-FTL-CSRF': this.csrf,
				},
			});

			// Reset the refresh timer
			this.setupSessionRefresh();
		} catch (error) {
			// If refresh fails, we'll need to re-authenticate
			this.sid = null;
			this.csrf = null;
			if (this.sessionRefreshTimer) {
				clearTimeout(this.sessionRefreshTimer);
				this.sessionRefreshTimer = null;
			}
		}
	}

	private setupSessionRefresh(): void {
		if (this.sessionRefreshTimer) {
			clearTimeout(this.sessionRefreshTimer);
		}

		this.sessionRefreshTimer = setInterval(
			() => this.refreshSession(),
			this.SESSION_REFRESH_INTERVAL * 1000
		);
	}

	private async authenticate(): Promise<void> {
		// Add cooldown check
		const now = Date.now();
		if (now - this.lastAuthAttempt < this.AUTH_COOLDOWN) {
			const waitTime = this.AUTH_COOLDOWN - (now - this.lastAuthAttempt);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
		}

		this.lastAuthAttempt = Date.now();
		const password =
			process.env.REACT_APP_PIHOLE_PASSWORD ??
			(window as any)._env_.REACT_APP_PIHOLE_PASSWORD;

		try {
			const response = await this.axiosInstance.post<AuthResponse>(
				'/auth',
				{ password }
			);

			if (response.data.session?.valid) {
				this.sid = response.data.session.sid;
				this.csrf = response.data.session.csrf;

				this.setupInterceptor();
				this.setupSessionRefresh(); // Set up session refresh

				// Remove the session timeout as we're now using refresh
				if (this.sessionTimeout) {
					clearTimeout(this.sessionTimeout);
					this.sessionTimeout = null;
				}
			} else if (response.data.session?.totp) {
				throw new Error(
					'2FA is enabled but not supported by this application'
				);
			} else {
				throw new Error('Authentication failed: Session invalid');
			}
		} catch (error: any) {
			if (error?.response?.status === 429) {
				// If rate limited, wait longer before next attempt
				this.lastAuthAttempt = Date.now() + 5000; // Add 5 seconds penalty
				throw new Error(
					'Rate limited. Please wait before trying again.'
				);
			}
			throw error;
		}
	}

	async logout(): Promise<void> {
		if (this.sid) {
			try {
				await this.axiosInstance.delete('/auth');
			} finally {
				this.sid = null;
				this.csrf = null;
				if (this.sessionRefreshTimer) {
					clearInterval(this.sessionRefreshTimer);
					this.sessionRefreshTimer = null;
				}
				if (this.interceptorId !== null) {
					this.axiosInstance.interceptors.request.eject(
						this.interceptorId
					);
					this.interceptorId = null;
				}
			}
		}
	}

	async getStatus(): Promise<string> {
		await this.ensureAuthenticated();
		const response = await this.axiosInstance.get<BlockingStatus>(
			`/dns/blocking/status`
		);
		return response.data.blocking;
	}

	async disable(duration: string): Promise<void> {
		await this.ensureAuthenticated();
		const request: BlockingRequest = {
			blocking: false,
			timer: parseInt(duration),
		};

		await this.axiosInstance.post('/dns/blocking', request, {
			headers: {
				'X-FTL-SID': this.sid,
			},
		});
	}

	async enable(): Promise<void> {
		await this.ensureAuthenticated();
		const request: BlockingRequest = {
			blocking: true,
			timer: null,
		};

		await this.axiosInstance.post('/dns/blocking', request, {
			headers: {
				'X-FTL-SID': this.sid,
			},
		});
	}

	getAdminUrl(): string {
		return this.baseUrl.replace(/\/api\/?$/, '/admin');
	}

	async getTopItems(): Promise<TopItems> {
		await this.ensureAuthenticated();

		// Get permitted domains
		const permittedResponse =
			await this.axiosInstance.get<TopDomainsResponse>(
				`/stats/top_domains?blocked=false&count=10`
			);

		// Get blocked domains
		const blockedResponse =
			await this.axiosInstance.get<TopDomainsResponse>(
				`/stats/top_domains?blocked=true&count=10`
			);

		return {
			top_queries: Object.fromEntries(
				permittedResponse.data.domains.map((d) => [d.domain, d.count])
			),
			top_ads: Object.fromEntries(
				blockedResponse.data.domains.map((d) => [d.domain, d.count])
			),
		};
	}

	async getList(
		listType: 'whitelist' | 'blacklist'
	): Promise<ListResponse['data']> {
		await this.ensureAuthenticated();
		const type = listType === 'whitelist' ? 'allow' : 'deny';

		// Fix: Use proper URL format and rely on interceptor for auth
		const response = await this.axiosInstance.get<DomainsListResponse>(
			`/domains/${type}/exact`,
			{
				headers: {
					'X-FTL-SID': this.sid,
					'X-FTL-CSRF': this.csrf,
				},
			}
		);

		return response.data.domains.map((domain) => ({
			domain: domain.domain,
			date_modified: domain.date_modified,
			enabled: domain.enabled,
		}));
	}

	async addToList(
		listType: 'whitelist' | 'blacklist',
		domain: string
	): Promise<{ alreadyExists: boolean }> {
		await this.ensureAuthenticated();
		const type = listType === 'whitelist' ? 'allow' : 'deny';
		const request: AddDomainRequest = {
			domain,
			comment: 'Added by pihole-switcher via API',
			groups: [0], // Default group
			enabled: true,
		};

		try {
			// Fix: Use proper URL format and rely on interceptor for auth
			await this.axiosInstance.post<DomainsListResponse>(
				`/domains/${type}/exact`,
				request,
				{
					headers: {
						'X-FTL-SID': this.sid,
						'X-FTL-CSRF': this.csrf,
					},
				}
			);
			return { alreadyExists: false };
		} catch (error: any) {
			if (error?.response?.data?.error === 'UNIQUE constraint failed') {
				return { alreadyExists: true };
			}
			throw new Error('Failed to add domain to list');
		}
	}

	// Add destructor method
	destroy() {
		if (this.sessionRefreshTimer) {
			clearInterval(this.sessionRefreshTimer);
			this.sessionRefreshTimer = null;
		}
		if (this.interceptorId !== null) {
			this.axiosInstance.interceptors.request.eject(this.interceptorId);
			this.interceptorId = null;
		}
		this.logout().catch(console.error);
		// Don't null the instance here - let getInstance handle recreation if needed
	}
}

export default PiholeApi;
