/**
 * Catch-all server route: /api/<anything> → Pi-hole FTL API.
 *
 * The browser never holds the FTL password; it calls this route, which is
 * served by the SvelteKit node process and forwards to FTL via piholeClient
 * (server-side session handling: X-FTL-SID / X-FTL-CSRF, 401 re-login).
 *
 * Security model: a small allowlist of known FTL paths rather than blind
 * forwarding — the app is LAN-only, but the proxy should not become a
 * general-purpose tunnel into the Pi-hole.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { FtlAuthError, FtlConnectionError } from '../../../lib/piholeClient.js';
import { allowedPaths, getClient } from '../../../lib/proxyClient.js';

export const GET: RequestHandler = (event) => forward(event, 'GET');
export const POST: RequestHandler = (event) => forward(event, 'POST');

async function forward(event: Parameters<RequestHandler>[0], method: 'GET' | 'POST') {
	const { path = '' } = event.params;

	const allowed = allowedPaths[path];
	if (!allowed || !allowed.includes(method)) {
		return json({ error: 'not_found' }, { status: 404 });
	}

	let query: URLSearchParams | undefined;
	const rawSearch = event.url.search;
	if (rawSearch) {
		query = new URLSearchParams(rawSearch);
	}

	let body: unknown;
	if (method === 'POST') {
		const text = await event.request.text();
		if (text) {
			try {
				body = JSON.parse(text);
			} catch {
				return json({ error: 'invalid_json' }, { status: 400 });
			}
		}
	}

	try {
		const client = getClient();
		const res = await client.request<unknown>(method, `/${path}`, { query, body });
		if (!res.ok) {
			// Pass FTL errors through with their status (401, 404, 500, ...).
			return json(res.data, { status: res.status });
		}
		return json(res.data);
	} catch (err) {
		if (err instanceof FtlAuthError) {
			return json({ error: 'auth_failed' }, { status: 503 });
		}
		if (err instanceof FtlConnectionError) {
			return json({ error: 'ftl_unreachable' }, { status: 502 });
		}
		throw err;
	}
}
