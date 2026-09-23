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

let clientPromise: ReturnType<typeof createPiholeClient> | null = null;

/**
 * Lazily create (and memoize) the client so missing env fails at first
 * request with a 503 instead of crashing boot — and so tests can reset it.
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
