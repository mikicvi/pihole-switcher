/**
 * Browser-side API client. Calls ONLY the local /api proxy route (same origin),
 * which forwards to Pi-hole FTL with the server-held session. The browser never
 * holds or sends the FTL password.
 */

export interface BlockingStatus {
	blocking: boolean;
	timer?: number | null;
}

/**
 * FTL v6 returns the blocking flag as the string "enabled" | "disabled"
 * (not a boolean). Normalize both shapes so callers get a real boolean.
 */
export function normalizeBlocking(raw: unknown): boolean {
	if (typeof raw === 'boolean') return raw;
	return raw === 'enabled' || raw === 'true';
}

export interface TopDomain {
	domain: string;
	count: number;
}

/**
 * An exact-domain entry as returned by FTL v6. `comment` and `groups` are
 * needed to UPDATE the entry: per the FTL v6 API docs a PUT must resend them
 * or they are lost.
 */
export interface ListDomain {
	domain: string;
	date_modified: number;
	enabled: boolean;
	comment: string | null;
	groups?: number[];
}

export interface AddDomainResult {
	added: boolean;
	alreadyExists: boolean;
}

export class ApiError extends Error {
	readonly status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`/api${path}`, {
		...init,
		headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }
	});
	const text = await res.text();
	let body: unknown;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = null;
	}
	if (!res.ok) {
		const msg =
			body && typeof body === 'object' && 'error' in (body as Record<string, unknown>)
				? String((body as Record<string, unknown>).error)
				: `API error ${res.status}`;
		throw new ApiError(res.status, msg);
	}
	return body as T;
}

/** GET /api/dns/blocking/status */
export function getBlockingStatus(): Promise<BlockingStatus> {
	return request<{ blocking?: unknown; timer?: number | null }>('/dns/blocking/status').then(
		(r) => ({ blocking: normalizeBlocking(r.blocking), timer: r.timer ?? null })
	);
}

/** POST /api/dns/blocking with { blocking, timer } */
export function setBlocking(blocking: boolean, timer: number | null): Promise<unknown> {
	return request<unknown>('/dns/blocking', {
		method: 'POST',
		body: JSON.stringify({ blocking, timer: timer ?? undefined })
	});
}

/** GET /api/stats/top_domains?blocked=true|false&count=N */
export function getTopDomains(blocked: boolean, count = 10): Promise<{ domains: TopDomain[] }> {
	const query = new URLSearchParams();
	query.set('blocked', blocked ? 'true' : 'false');
	query.set('count', String(count));
	return request<{ domains: TopDomain[] }>(`/stats/top_domains?${query.toString()}`);
}

/** GET /api/domains/{allow|deny}/exact */
export function getExactDomains(type: 'allow' | 'deny'): Promise<{ domains: ListDomain[] }> {
	return request<{ domains: ListDomain[] }>(`/domains/${type}/exact`);
}

/**
 * PUT /api/domains/{allow|deny}/exact/{domain} — "Replace domain" (FTL v6).
 * Used to toggle `enabled`; `comment` and `groups` are resent so they are
 * retained (required by the FTL v6 API).
 */
export function updateExactDomain(
	type: 'allow' | 'deny',
	domain: string,
	body: { enabled: boolean; comment: string | null; groups: number[] }
): Promise<Record<string, unknown>> {
	return request<Record<string, unknown>>(`/domains/${type}/exact/${encodeURIComponent(domain)}`, {
		method: 'PUT',
		body: JSON.stringify(body)
	});
}

/**
 * POST /api/domains/{allow|deny}/exact.
 * FTL signals "already exists" via a UNIQUE constraint error; normalize it.
 */
export async function addExactDomain(type: 'allow' | 'deny', domain: string): Promise<AddDomainResult> {
	try {
		await request<{ error?: string }>(`/domains/${type}/exact`, {
			method: 'POST',
			body: JSON.stringify({ domain, comment: 'Added by pihole-switcher via API', groups: [0], enabled: true })
		});
		return { added: true, alreadyExists: false };
	} catch (err) {
		if (err instanceof ApiError) {
			const text = `${err.message} ${JSON.stringify((err as unknown) as Record<string, unknown>)}`;
			if (text.includes('UNIQUE constraint failed')) {
				return { added: false, alreadyExists: true };
			}
		}
		throw err;
	}
}
