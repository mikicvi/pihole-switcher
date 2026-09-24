import type { Handle } from '@sveltejs/kit';

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
