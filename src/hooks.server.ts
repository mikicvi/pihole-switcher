import type { Handle } from '@sveltejs/kit';
import { loadConfig } from './lib/config.js';

/**
 * Fail fast at boot in production: an invalid configuration (missing
 * PIHOLE_API_PASSWORD, bad timeout) must never let the container come up
 * "healthy" only to 503 every API call. This module is imported when the
 * adapter-node server starts, before it listens. In dev/test the check is
 * skipped so `npm run dev` can boot without a complete .env.
 */
if (process.env.NODE_ENV === 'production') {
	try {
		loadConfig();
	} catch (err) {
		console.error(`[pihole-switcher] refusing to start — ${(err as Error).message}`);
		process.exit(1);
	}
}

/**
 * Response security headers for every request (UI, API proxy, /health).
 * The app is a standalone page — never embedded — so DENY framing is safe
 * and protects against clickjacking from other LAN pages.
 */
const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin'
};

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}
	return response;
};
