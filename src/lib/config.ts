/**
 * Server-side runtime configuration.
 *
 * The FTL API password lives ONLY here, in the server process environment.
 * Nothing in this module (or its dependents) is ever shipped to the browser.
 */

export interface Config {
	/** Base URL of the Pi-hole FTL REST API (no trailing slash). */
	ftlBaseUrl: string;
	/** Plain FTL API password (FTL v6 only accepts the plain password at /api/auth). */
	apiPassword: string;
	/**
	 * Public URL of the Pi-hole admin interface, shown/linked in the UI.
	 * Defaults to the FTL host/port + `/admin`; override with PUBLIC_PIHOLE_ADMIN
	 * (e.g. when PIHOLE_PROXY_TARGET is a Docker-internal address the browser
	 * cannot reach). May only be null if config is incomplete.
	 */
	adminUrl: string | null;
	/** Per-request timeout for FTL calls, in milliseconds. */
	ftlTimeoutMs: number;
	/** How long to wait after a failed login before attempting to log in again. */
	authCooldownMs: number;
}

/**
 * Read configuration from process env, failing fast if required vars are missing.
 * Exported as a function so tests can exercise validation without env mutation.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
	const host = env.PIHOLE_PROXY_TARGET ?? '192.168.1.1';
	const port = env.PIHOLE_FTL_PORT ?? '1010';

	const password = env.PIHOLE_API_PASSWORD;
	if (!password) {
		throw new Error(
			'Missing required environment variable PIHOLE_API_PASSWORD ' +
				'(the plain Pi-hole FTL API password). The server cannot proxy API calls without it.'
		);
	}

	const ftlTimeoutMs = Number(env.PIHOLE_FTL_TIMEOUT_MS ?? 5000);
	if (!Number.isFinite(ftlTimeoutMs) || ftlTimeoutMs <= 0) {
		throw new Error(`PIHOLE_FTL_TIMEOUT_MS must be a positive number, got: ${env.PIHOLE_FTL_TIMEOUT_MS}`);
	}

	const authCooldownMs = Number(env.PIHOLE_AUTH_COOLDOWN_MS ?? 10_000);
	if (!Number.isFinite(authCooldownMs) || authCooldownMs <= 0) {
		throw new Error(
			`PIHOLE_AUTH_COOLDOWN_MS must be a positive number, got: ${env.PIHOLE_AUTH_COOLDOWN_MS}`
		);
	}

	// The FTL admin UI is served from the same host/port as the API, so the
	// header link works out of the box; PUBLIC_PIHOLE_ADMIN overrides it.
	const adminUrl = env.PUBLIC_PIHOLE_ADMIN || `http://${host}:${port}/admin`;

	return {
		ftlBaseUrl: `http://${host}:${port}/api`,
		apiPassword: password,
		adminUrl,
		ftlTimeoutMs,
		authCooldownMs
	};
}
