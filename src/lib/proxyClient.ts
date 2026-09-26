/**
 * Proxy plumbing for the /api/[...path] server route: the FTL path allowlist
 * and the memoized pihole client. Kept out of +server.ts because SvelteKit
 * forbids arbitrary named exports from server routes.
 */

import { createPiholeClient } from './piholeClient.js';

/**
 * Allowed FTL paths (relative to /api). Value = the HTTP methods the UI uses.
 * Kept deliberately narrow: exactly the endpoints pihole-switcher performs.
 */
export const allowedPaths: Record<string, string[]> = {
	'dns/blocking/status': ['GET'],
	'dns/blocking': ['GET', 'POST'],
	'stats/top_domains': ['GET'],
	'domains/allow/exact': ['GET', 'POST'],
	'domains/deny/exact': ['GET', 'POST']
};

/**
 * Pattern-based entries for paths with a variable segment (the domain name),
 * checked after the exact allowlist. Same narrowness rule as allowedPaths:
 * only the FTL calls the UI performs.
 */
export const patternPaths: { pattern: RegExp; methods: string[] }[] = [
	{ pattern: /^domains\/(allow|deny)\/exact\/[^/]+$/, methods: ['PUT'] }
];

let clientPromise: ReturnType<typeof createPiholeClient> | null = null;

/**
 * Lazily create (and memoize) the client so tests can reset it. A missing or
 * invalid config throws here; the route maps it to 503 config_error, and in
 * production the server refuses to boot at all (see hooks.server.ts).
 */
export function getClient() {
	if (!clientPromise) {
		clientPromise = createPiholeClient();
	}
	return clientPromise;
}

/** Test hook: drop the memoized client. */
export function _resetClientForTests() {
	clientPromise = null;
}
