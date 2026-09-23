/**
 * Browser-side API client. Calls ONLY the local /api proxy route (same origin),
 * which forwards to Pi-hole FTL with the server-held session. The browser never
 * holds or sends the FTL password.
 */

export interface BlockingStatus {
	blocking: boolean;
	timer?: number;
}

export interface TopDomain {
	domain: string;
	count: number;
}

export interface ListDomain {
	domain: string;
	date_modified: number;
	enabled: boolean;
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
	return request<BlockingStatus>('/dns/blocking/status');
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
 * POST /api/domains/{allow|deny}/exact.
 * FTL signals "already exists" via a UNIQUE constraint error; normalize it.
 */
export async function addExactDomain(type: 'allow' | 'deny', domain: string): Promise<AddDomainResult> {
	try {
		const res = await request<{ error?: string }>(`/domains/${type}/exact`, {
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
