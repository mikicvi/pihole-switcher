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

interface AddToListResponse {
	success: boolean;
	message: string;
}

interface BlockingRequest {
	blocking: boolean;
	timer: number | null;
}

class PiholeApi {
	private axiosInstance: AxiosInstance;
	private sid: string | null = null;
	private csrf: string | null = null;
	private baseUrl: string;
	private sessionTimeout: NodeJS.Timeout | null = null;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
		this.axiosInstance = axios.create({
			baseURL: baseUrl,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	private async ensureAuthenticated(): Promise<void> {
		if (!this.sid) {
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

					// Add sid as URL parameter to all requests
					this.axiosInstance.interceptors.request.use((config) => {
						const separator = config.url?.includes('?') ? '&' : '?';
						config.url = `${
							config.url
						}${separator}sid=${encodeURIComponent(this.sid!)}`;

						// Add CSRF header
						if (this.csrf) {
							config.headers['X-FTL-CSRF'] = this.csrf;
						}
						return config;
					});

					// Handle session expiration
					if (this.sessionTimeout) {
						clearTimeout(this.sessionTimeout);
					}
					// Set timeout to clear session 5 seconds before it expires
					this.sessionTimeout = setTimeout(() => {
						this.sid = null;
						this.csrf = null;
					}, (response.data.session.validity - 5) * 1000);
				} else if (response.data.session?.totp) {
					throw new Error(
						'2FA is enabled but not supported by this application'
					);
				} else {
					throw new Error('Authentication failed: Session invalid');
				}
			} catch (error) {
				console.error('Authentication failed:', error);
				this.sid = null;
				this.csrf = null;
				throw error;
			}
		}
	}

	async logout(): Promise<void> {
		if (this.sid) {
			try {
				await this.axiosInstance.delete('/auth');
			} finally {
				this.sid = null;
				this.csrf = null;
				if (this.sessionTimeout) {
					clearTimeout(this.sessionTimeout);
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
		return this.baseUrl.replace(/\/api\/?$/, '');
	}

	async getTopItems(): Promise<TopItems> {
		await this.ensureAuthenticated();
		const response = await this.axiosInstance.get<TopItems>(
			`/stats/top_items`
		);
		return response.data;
	}

	async getList(
		listType: 'whitelist' | 'blacklist'
	): Promise<ListResponse['data']> {
		await this.ensureAuthenticated();
		const type = listType === 'whitelist' ? 'white' : 'black';
		const response = await this.axiosInstance.get<ListResponse>(
			`/dns/list/${type}`
		);
		return response.data.data;
	}

	async addToList(
		listType: 'whitelist' | 'blacklist',
		domain: string
	): Promise<{ alreadyExists: boolean }> {
		await this.ensureAuthenticated();
		const type = listType === 'whitelist' ? 'white' : 'black';
		try {
			const response = await this.axiosInstance.post<AddToListResponse>(
				`/dns/list/${type}`,
				{
					domain,
					sid: this.sid,
				}
			);
			return {
				alreadyExists: response.data.message.includes(
					'already on the list'
				),
			};
		} catch (error) {
			throw new Error('Failed to add domain to list');
		}
	}

	// Add destructor method
	destroy() {
		if (this.sessionTimeout) {
			clearTimeout(this.sessionTimeout);
		}
		this.logout().catch(console.error);
	}
}

export default PiholeApi;
