import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ApiError,
	addExactDomain,
	getBlockingStatus,
	getExactDomains,
	getTopDomains,
	normalizeBlocking,
	setBlocking,
	updateExactDomain
} from '../../src/lib/api.js';

/** fetch stub that captures the last call and returns the given response. */
function stubFetch(status: number, body: unknown) {
	const fn = vi.fn(async () => new Response(body == null ? '' : JSON.stringify(body), { status }));
	vi.stubGlobal('fetch', fn);
	return fn;
}

describe('normalizeBlocking', () => {
	it('maps FTL v6 string shapes', () => {
		expect(normalizeBlocking('enabled')).toBe(true);
		expect(normalizeBlocking('disabled')).toBe(false);
	});

	it('passes booleans through unchanged', () => {
		expect(normalizeBlocking(true)).toBe(true);
		expect(normalizeBlocking(false)).toBe(false);
	});

	it('treats anything else as disabled', () => {
		expect(normalizeBlocking('true')).toBe(true);
		expect(normalizeBlocking('off')).toBe(false);
		expect(normalizeBlocking(undefined)).toBe(false);
		expect(normalizeBlocking(1)).toBe(false);
	});
});

describe('getBlockingStatus', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('normalizes the real FTL v6 response ({blocking:"disabled", timer:300})', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				new Response(JSON.stringify({ blocking: 'disabled', timer: 300 }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
		);
		const status = await getBlockingStatus();
		expect(status).toEqual({ blocking: false, timer: 300 });
	});

	it('normalizes enabled + null timer, and fills missing timer with null', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				new Response(JSON.stringify({ blocking: 'enabled' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
		);
		const status = await getBlockingStatus();
		expect(status).toEqual({ blocking: true, timer: null });
	});
});

describe('request error handling', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('throws ApiError with the body error field as message', async () => {
		stubFetch(403, { error: 'auth_failed' });
		await expect(getBlockingStatus()).rejects.toThrow(ApiError);
		try {
			await getBlockingStatus();
		} catch (err) {
			expect(err).toBeInstanceOf(ApiError);
			expect((err as ApiError).status).toBe(403);
			expect((err as ApiError).message).toBe('auth_failed');
		}
	});

	it('falls back to a generic message when the body is not JSON with an error field', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream exploded', { status: 502 })));
		await expect(getBlockingStatus()).rejects.toThrow('API error 502');
	});

	it('resolves null for an empty 200 body', async () => {
		stubFetch(200, null);
		await expect(getExactDomains('allow')).resolves.toBeNull();
	});
});

describe('setBlocking', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('posts { blocking } with a timer when one is given', async () => {
		const fetchMock = stubFetch(200, {});
		await setBlocking(false, 5);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/dns/blocking');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body as string)).toEqual({ blocking: false, timer: 5 });
	});

	it('omits the timer field when there is none', async () => {
		const fetchMock = stubFetch(200, {});
		await setBlocking(true, null);
		const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(JSON.parse(init.body as string)).toEqual({ blocking: true });
	});
});

describe('getTopDomains', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('encodes the blocked flag and count as query params', async () => {
		const fetchMock = stubFetch(200, { domains: [{ domain: 'a.example', count: 3 }] });
		const res = await getTopDomains(false, 15);
		const [url] = fetchMock.mock.calls[0] as unknown as [string];
		expect(url).toBe('/api/stats/top_domains?blocked=false&count=15');
		expect(res).toEqual({ domains: [{ domain: 'a.example', count: 3 }] });
	});

	it('defaults the count to 10', async () => {
		const fetchMock = stubFetch(200, { domains: [] });
		await getTopDomains(true);
		const [url] = fetchMock.mock.calls[0] as unknown as [string];
		expect(url).toBe('/api/stats/top_domains?blocked=true&count=10');
	});
});

describe('getExactDomains', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('targets the allow or deny exact collection', async () => {
		const fetchMock = stubFetch(200, { domains: [] });
		await getExactDomains('deny');
		expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('/api/domains/deny/exact');
		await getExactDomains('allow');
		expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toBe('/api/domains/allow/exact');
	});
});

describe('updateExactDomain', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('PUTs the full replacement body (enabled + comment + groups) and URL-encodes the domain', async () => {
		const fetchMock = stubFetch(200, { ok: true });
		await updateExactDomain('allow', 'my domain.example', { enabled: false, comment: null, groups: [0] });
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/domains/allow/exact/my%20domain.example');
		expect(init.method).toBe('PUT');
		expect(JSON.parse(init.body as string)).toEqual({ enabled: false, comment: null, groups: [0] });
	});
});

describe('addExactDomain', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('reports a successful add', async () => {
		const fetchMock = stubFetch(201, {});
		await expect(addExactDomain('allow', 'new.example')).resolves.toEqual({ added: true, alreadyExists: false });
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/domains/allow/exact');
		expect(JSON.parse(init.body as string)).toEqual({
			domain: 'new.example',
			comment: 'Added by pihole-switcher via API',
			groups: [0],
			enabled: true
		});
	});

	it('maps a UNIQUE constraint failure to alreadyExists', async () => {
		stubFetch(500, { error: 'UNIQUE constraint failed: exact_domain.domain' });
		await expect(addExactDomain('deny', 'dup.example')).resolves.toEqual({ added: false, alreadyExists: true });
	});

	it('rethrows unrelated API errors', async () => {
		stubFetch(403, { error: 'auth_failed' });
		await expect(addExactDomain('allow', 'x.example')).rejects.toThrow(ApiError);
	});
});
