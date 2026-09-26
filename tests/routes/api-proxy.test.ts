import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the FTL client module before the route imports it.
const requestMock = vi.fn();
let createImpl: () => unknown = () => ({ request: requestMock });
vi.mock('../../src/lib/piholeClient.js', () => ({
	createPiholeClient: () => createImpl(),
	FtlAuthError: class FtlAuthError extends Error {},
	FtlConnectionError: class FtlConnectionError extends Error {}
}));

import { GET, POST, PUT } from '../../src/routes/api/[...path]/+server.js';
import { allowedPaths, patternPaths, _resetClientForTests } from '../../src/lib/proxyClient.js';
import { FtlAuthError, FtlConnectionError } from '../../src/lib/piholeClient.js';

function makeEvent(method: 'GET' | 'POST' | 'PUT', path: string, search = '', body?: string) {
	const url = new URL(`http://localhost/api/${path}${search}`);
	const init: RequestInit = { method };
	if (body !== undefined) {
		init.body = body;
		init.headers = { 'content-type': 'application/json' };
	}
	return {
		params: { path },
		url,
		request: new Request(url, init)
	} as unknown as Parameters<typeof GET>[0];
}

describe('/api/[...path] proxy route', () => {
	beforeEach(() => {
		requestMock.mockReset();
		createImpl = () => ({ request: requestMock });
		_resetClientForTests();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('exposes a narrow allowlist of FTL paths', () => {
		expect(Object.keys(allowedPaths).sort()).toEqual(
			[
				'dns/blocking',
				'dns/blocking/status',
				'domains/allow/exact',
				'domains/deny/exact',
				'stats/top_domains'
			].sort()
		);
	});

	it('exposes pattern paths only for the domain-PUT toggle', () => {
		expect(patternPaths.map((p) => [p.pattern.source, p.methods])).toEqual([
			['^domains\\/(allow|deny)\\/exact\\/[^/]+$', ['PUT']]
		]);
	});

	it('forwards GET with query string preserved', async () => {
		requestMock.mockResolvedValue({ ok: true, status: 200, data: { blocking: true, timer: 0 } });
		const res = await GET(makeEvent('GET', 'dns/blocking/status'));
		expect(requestMock).toHaveBeenCalledWith('GET', '/dns/blocking/status', {
			query: undefined,
			body: undefined
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ blocking: true, timer: 0 });
	});

	it('forwards GET /stats/top_domains query params intact', async () => {
		requestMock.mockResolvedValue({ ok: true, status: 200, data: { domains: [] } });
		await GET(makeEvent('GET', 'stats/top_domains', '?blocked=true&count=10'));
		const arg = requestMock.mock.calls[0][2] as { query: URLSearchParams };
		expect(arg.query.toString()).toBe('blocked=true&count=10');
	});

	it('forwards POST with JSON body parsed', async () => {
		requestMock.mockResolvedValue({ ok: true, status: 200, data: { success: true } });
		const res = await POST(
			makeEvent('POST', 'dns/blocking', '', JSON.stringify({ blocking: false, timer: 300 }))
		);
		expect(requestMock).toHaveBeenCalledWith('POST', '/dns/blocking', {
			query: undefined,
			body: { blocking: false, timer: 300 }
		});
		expect(res.status).toBe(200);
	});

	it('forwards POST /domains/deny/exact add-domain body', async () => {
		requestMock.mockResolvedValue({ ok: true, status: 201, data: { added: true } });
		const res = await POST(
			makeEvent('POST', 'domains/deny/exact', '', JSON.stringify({ domain: 'x.com' }))
		);
		const arg = requestMock.mock.calls[0][2] as { body: unknown };
		expect(arg.body).toEqual({ domain: 'x.com' });
		// The proxy normalizes upstream success to 200 (clients check res.ok).
		expect(res.status).toBe(200);
	});

	it('rejects unknown paths with 404 without touching FTL', async () => {
		const res = await GET(makeEvent('GET', 'some/unknown/path'));
		expect(res.status).toBe(404);
		expect(requestMock).not.toHaveBeenCalled();
	});

	it('rejects methods not allowed for a known path', async () => {
		const res = await POST(makeEvent('POST', 'stats/top_domains', '', '{}'));
		expect(res.status).toBe(404);
		expect(requestMock).not.toHaveBeenCalled();
	});

	it('forwards PUT /domains/allow/exact/<domain> (enable toggle)', async () => {
		requestMock.mockResolvedValue({ ok: true, status: 200, data: { domains: [] } });
		const res = await PUT(
			makeEvent(
				'PUT',
				'domains/allow/exact/abc.com',
				'',
				JSON.stringify({ enabled: false, comment: null, groups: [0] })
			)
		);
		expect(requestMock).toHaveBeenCalledWith('PUT', '/domains/allow/exact/abc.com', {
			query: undefined,
			body: { enabled: false, comment: null, groups: [0] }
		});
		expect(res.status).toBe(200);
	});

	it('rejects non-PUT methods on pattern paths without touching FTL', async () => {
		expect((await GET(makeEvent('GET', 'domains/allow/exact/abc.com'))).status).toBe(404);
		expect((await POST(makeEvent('POST', 'domains/deny/exact/abc.com', '', '{}'))).status).toBe(404);
		expect(requestMock).not.toHaveBeenCalled();
	});

	it('rejects deeper path segments that only prefix-match the pattern', async () => {
		const res = await PUT(makeEvent('PUT', 'domains/allow/exact/abc.com/extra', '', '{}'));
		expect(res.status).toBe(404);
		expect(requestMock).not.toHaveBeenCalled();
	});

	it('maps a client-creation (config) failure to 503 config_error', async () => {
		createImpl = () => {
			throw new Error('Missing required environment variable PIHOLE_API_PASSWORD');
		};
		const res = await GET(makeEvent('GET', 'dns/blocking/status'));
		expect(res.status).toBe(503);
		expect(await res.json()).toMatchObject({ error: 'config_error' });
		expect(requestMock).not.toHaveBeenCalled();
	});

	it('rejects invalid JSON POST bodies with 400', async () => {
		const res = await POST(makeEvent('POST', 'dns/blocking', '', '{not json'));
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'invalid_json' });
		expect(requestMock).not.toHaveBeenCalled();
	});

	it('maps FtlAuthError to 503 {error: auth_failed}', async () => {
		requestMock.mockRejectedValue(new FtlAuthError('nope'));
		const res = await GET(makeEvent('GET', 'dns/blocking/status'));
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: 'auth_failed' });
	});

	it('maps FtlConnectionError to 502 {error: ftl_unreachable}', async () => {
		requestMock.mockRejectedValue(new FtlConnectionError('refused'));
		const res = await GET(makeEvent('GET', 'dns/blocking/status'));
		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ error: 'ftl_unreachable' });
	});

	it('passes FTL 404 through with its body', async () => {
		requestMock.mockResolvedValue({ ok: false, status: 404, data: { error: 'not_found' } });
		const res = await GET(makeEvent('GET', 'dns/blocking/status'));
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'not_found' });
	});

	it('passes FTL 500 through', async () => {
		requestMock.mockResolvedValue({ ok: false, status: 500, data: { error: 'boom' } });
		const res = await GET(makeEvent('GET', 'dns/blocking/status'));
		expect(res.status).toBe(500);
	});
});
