/**
 * Server-only Pi-hole FTL (v6) REST client.
 *
 * This module holds the API password and the FTL session (SID/CSRF) in server
 * process memory only. It is imported by the `/api/[...path]` server route,
 * never by anything that ships to the browser.
 *
 * Auth model (verified live against FTL v6):
 *   - POST {base}/auth with {"password": "<plain>"} returns
 *     {"session": {"valid": true, "sid", "csrf", "validity"}}.
 *   - Every subsequent request must carry X-FTL-SID and X-FTL-CSRF headers.
 *   - A 401 from any endpoint means the session is dead: re-login once and
 *     retry the original request.
 *   - Only the PLAIN API password is accepted at /api/auth — a hashed/"app"
 *     password returns 401.
 */

import { loadConfig, type Config } from './config.js';

export interface Session {
	sid: string;
	csrf: string;
	/** Epoch ms until which the session is expected to be valid. */
	expiresAt: number;
}

export interface AuthResult {
	session: {
		valid: boolean;
		sid: string;
		csrf: string;
		/** Session lifetime in seconds, as reported by FTL. */
		validity: number;
	};
}

export interface FtlResponse<T> {
	ok: boolean;
	status: number;
	data: T;
}

/** Thrown when the FTL instance is unreachable (maps to HTTP 502 at the route). */
export class FtlConnectionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FtlConnectionError';
	}
}

/** Thrown when login is failing/cooldown (maps to HTTP 503 at the route). */
export class FtlAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FtlAuthError';
	}
}

export interface PiholeClientOptions {
	config: Config;
	/** Injectable for tests; defaults to global fetch. */
	fetchImpl?: typeof fetch;
	/** Injectable clock for tests; defaults to Date.now. */
	now?: () => number;
}

/**
 * Minimal generic request handle returned by the escape-hatch `request()` and
 * used by the catch-all proxy route.
 */
export class PiholeClient {
	private readonly config: Config;
	private readonly fetchImpl: typeof fetch;
	private readonly now: () => number;

	private session: Session | null = null;
	/** In-flight login promise; concurrent callers share it (single-flight). */
	private loginPromise: Promise<Session> | null = null;
	/** Epoch ms of the last failed login attempt (cooldown anchor). */
	private lastLoginFailureAt = 0;
	/** Epoch ms of the last successful login attempt. */
	private lastLoginAttemptAt = 0;

	constructor(options: PiholeClientOptions) {
		this.config = options.config;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.now = options.now ?? Date.now;
	}

	/**
	 * Log in (or reuse a cached/valid session). Single-flight: concurrent calls
	 * share one in-flight login. Respects a cooldown window after a failed
	 * login so a wrong password does not hammer FTL.
	 */
	async ensureSession(): Promise<Session> {
		const cached = this.session;
		if (cached && this.now() < cached.expiresAt) {
			return cached;
		}

		if (this.loginPromise) {
			return this.loginPromise;
		}

		// Cooldown: if we just failed, don't retry immediately.
		const sinceFailure = this.now() - this.lastLoginFailureAt;
		if (this.lastLoginFailureAt > 0 && sinceFailure < this.config.authCooldownMs) {
			throw new FtlAuthError(
				`login in cooldown for ${this.config.authCooldownMs - sinceFailure}ms more`
			);
		}

		this.loginPromise = this.login()
			.then((session) => {
				this.session = session;
				return session;
			})
			.catch((err) => {
				// Only *auth* failures set the cooldown anchor. A connection
				// failure (FTL unreachable) must not mask later 502s with a
				// 503 auth_failed during the cooldown window.
				if (err instanceof FtlAuthError) {
					this.lastLoginFailureAt = this.now();
				}
				throw err;
			})
			.finally(() => {
				this.loginPromise = null;
			});

		return this.loginPromise;
	}

	private async login(): Promise<Session> {
		this.lastLoginAttemptAt = this.now();
		const res = await this.rawFetch('/auth', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ password: this.config.apiPassword })
		});

		if (!res.ok) {
			throw new FtlAuthError(`FTL login failed with HTTP ${res.status}`);
		}

		const body = res.data as AuthResult;
		if (!body.session?.valid || !body.session.sid || !body.session.csrf) {
			throw new FtlAuthError('FTL login returned an invalid session');
		}

		const validityMs = (body.session.validity || 1800) * 1000;
		// Refresh slightly before nominal expiry.
		return { sid: body.session.sid, csrf: body.session.csrf, expiresAt: this.now() + validityMs };
	}

	/**
	 * Execute a request against FTL, injecting a valid session. On a 401
	 * (dead session) it forces a fresh login and retries exactly once.
	 */
	async request<T>(method: string, path: string, opts: { query?: URLSearchParams; body?: unknown } = {}): Promise<FtlResponse<T>> {
		const first = await this.executeWithSession<T>(method, path, opts);
		if (first.status === 401) {
			// Session was rejected: drop it, log in fresh, retry once.
			this.session = null;
			this.loginPromise = null;
			this.lastLoginFailureAt = 0;
			const second = await this.executeWithSession<T>(method, path, opts);
			// If the retry still 401s, surface it (route maps to 401/503).
			return second;
		}
		return first;
	}

	private async executeWithSession<T>(
		method: string,
		path: string,
		opts: { query?: URLSearchParams; body?: unknown }
	): Promise<FtlResponse<T>> {
		const session = await this.ensureSession();
		const headers: Record<string, string> = {
			'X-FTL-SID': session.sid,
			'X-FTL-CSRF': session.csrf
		};
		let body: string | undefined;
		if (opts.body !== undefined) {
			body = JSON.stringify(opts.body);
			headers['content-type'] = 'application/json';
		}
		return this.rawFetch(path, { method, headers, body, query: opts.query });
	}

	/**
	 * Low-level fetch with timeout + connection-error mapping. Does NOT handle
	 * 401/retry or session injection — those live in request()/login().
	 */
	private async rawFetch<T>(
		path: string,
		init: {
			method?: string;
			headers?: Record<string, string>;
			body?: string;
			query?: URLSearchParams;
		}
	): Promise<FtlResponse<T>> {
		// Explicit concatenation: new URL(path, base) would drop the /api prefix
		// because a base without a trailing slash resolves against the origin only.
		const url = new URL(`${this.config.ftlBaseUrl}${path}`);
		if (init.query) {
			url.search = init.query.toString();
		}

		let res: Response;
		try {
			res = await this.fetchImpl(url, {
				method: init.method ?? 'GET',
				headers: init.headers,
				body: init.body,
				signal: AbortSignal.timeout(this.config.ftlTimeoutMs)
			});
		} catch (err) {
			// Timeout or connection refused/reset → FTL unreachable.
			throw new FtlConnectionError(`could not reach FTL at ${url}: ${(err as Error).message}`);
		}

		let data: T;
		const text = await res.text();
		try {
			data = (text ? JSON.parse(text) : undefined) as T;
		} catch {
			// Non-JSON body (e.g. HTML error page): expose the text so callers
			// can surface it, but keep the status for mapping.
			data = { raw: text } as T;
		}

		return { ok: res.ok, status: res.status, data };
	}

	// ---- Convenience methods mirroring the old frontend API surface ----

	getStatus(): Promise<FtlResponse<{ blocking: boolean; timer?: number }>> {
		return this.request<{ blocking: boolean; timer?: number }>('GET', '/dns/blocking/status');
	}

	setBlocking(blocking: boolean, timer: number | null): Promise<FtlResponse<unknown>> {
		return this.request<unknown>('POST', '/dns/blocking', {
			body: { blocking, timer: timer ?? undefined }
		});
	}

	getTopDomains(blocked: boolean, count = 10): Promise<FtlResponse<{ domains: { domain: string; count: number }[] }>> {
		const query = new URLSearchParams();
		query.set('blocked', blocked ? 'true' : 'false');
		query.set('count', String(count));
		return this.request<{ domains: { domain: string; count: number }[] }>('GET', '/stats/top_domains', { query });
	}

	getExactDomains(type: 'allow' | 'deny'): Promise<FtlResponse<{ domains: { domain: string; date_modified: number; enabled: boolean }[] }>> {
		return this.request<{ domains: { domain: string; date_modified: number; enabled: boolean }[] }>('GET', `/domains/${type}/exact`);
	}

	addExactDomain(
		type: 'allow' | 'deny',
		domain: string
	): Promise<FtlResponse<{ error?: string } | { added: boolean }>> {
		return this.request<{ error?: string } | { added: boolean }>('POST', `/domains/${type}/exact`, {
			body: { domain, comment: 'Added by pihole-switcher via API', groups: [0], enabled: true }
		});
	}

	/**
	 * PUT /domains/{type}/exact/{domain} — FTL v6 "Replace domain". Per the
	 * FTL v6 API docs, a PUT must resend `comment` and `groups` to retain them;
	 * we only change `enabled` here.
	 */
	setExactDomain(
		type: 'allow' | 'deny',
		domain: string,
		patch: { enabled: boolean; comment: string | null; groups: number[] }
	): Promise<FtlResponse<Record<string, unknown>>> {
		return this.request<Record<string, unknown>>('PUT', `/domains/${type}/exact/${encodeURIComponent(domain)}`, {
			body: { comment: patch.comment, groups: patch.groups, enabled: patch.enabled }
		});
	}

	/** For tests / diagnostics. */
	getConfig(): Config {
		return this.config;
	}

	/** For tests: reset all session state. */
	_resetForTests(): void {
		this.session = null;
		this.loginPromise = null;
		this.lastLoginFailureAt = 0;
		this.lastLoginAttemptAt = 0;
	}
}

/** Convenience factory using real env + global fetch. */
export function createPiholeClient(env: Record<string, string | undefined> = process.env): PiholeClient {
	return new PiholeClient({ config: loadConfig(env) });
}
