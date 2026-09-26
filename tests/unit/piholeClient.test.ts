import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockFtl } from '../helpers/mockFtl.js';
import { PiholeClient, FtlAuthError, FtlConnectionError } from '../../src/lib/piholeClient.js';
import type { Config } from '../../src/lib/config.js';

function makeConfig(over: Partial<Config> = {}): Config {
	return {
		ftlBaseUrl: 'http://127.0.0.1:1/api',
		apiPassword: 'correct-horse',
		adminUrl: null,
		ftlTimeoutMs: 2000,
		authCooldownMs: 1000,
		...over
	};
}

describe('PiholeClient', () => {
	let ftl: MockFtl;
	let clock: { now: number; nowFn: () => number };

	beforeEach(async () => {
		ftl = await new MockFtl().start();
		clock = { now: 1_000_000, nowFn: () => clock.now };
	});

	afterEach(async () => {
		await ftl.close();
	});

	function client(over: Partial<Config> = {}) {
		return new PiholeClient({
			config: makeConfig({ ftlBaseUrl: `${ftl.url}/api`, ...over }),
			now: clock.nowFn
		});
	}

	it('logs in lazily on the first request and injects sid+csrf headers', async () => {
		const c = client();
		expect(ftl.authCalls).toBe(0);

		const res = await c.getStatus();

		expect(res.ok).toBe(true);
		// Real FTL v6 shape: blocking is the string "enabled" | "disabled".
		expect(res.data).toEqual({ blocking: 'enabled', timer: null });
		expect(ftl.authCalls).toBe(1);
		const auth = ftl.requests[0];
		expect(auth.method).toBe('POST');
		expect(auth.url).toBe('/api/auth');
		expect(JSON.parse(auth.body)).toEqual({ password: 'correct-horse' });

		const status = ftl.requests.find((r) => r.url === '/api/dns/blocking/status');
		expect(status).toBeDefined();
		expect(status?.headers['x-ftl-sid']).toBe('sid-1');
		expect(status?.headers['x-ftl-csrf']).toBe('csrf-1');
	});

	it('does not re-login while the cached session is still valid', async () => {
		const c = client();
		await c.getStatus();
		await c.getStatus();
		await c.getTopDomains(false, 5);
		expect(ftl.authCalls).toBe(1);
	});

	it('re-logs in once the session expires (validity-based)', async () => {
		const c = client();
		await c.getStatus();
		// validity is 1800s; move the clock past expiry
		clock.now += 1801 * 1000;
		await c.getStatus();
		expect(ftl.authCalls).toBe(2);
	});

	it('preserves method, query and body for every endpoint', async () => {
		const c = client();

		await c.setBlocking(false, 300);
		const blocking = ftl.requests.find((r) => r.url === '/api/dns/blocking');
		expect(blocking?.method).toBe('POST');
		expect(JSON.parse(blocking?.body ?? '{}')).toEqual({ blocking: false, timer: 300 });
		expect(blocking?.headers['content-type']).toBe('application/json');

		await c.setBlocking(true, null);
		const enabled = ftl.requests.filter((r) => r.url === '/api/dns/blocking');
		expect(JSON.parse(enabled[enabled.length - 1].body)).toEqual({ blocking: true });

		const top = await c.getTopDomains(true, 5);
		expect(ftl.requests.find((r) => r.url === '/api/stats/top_domains?blocked=true&count=5')).toBeDefined();
		expect(top.data.domains).toHaveLength(2);

		const deny = await c.getExactDomains('deny');
		expect(ftl.requests.find((r) => r.url === '/api/domains/deny/exact')).toBeDefined();
		expect(deny.data.domains).toHaveLength(2);

		const allow = await c.getExactDomains('allow');
		expect(ftl.requests.find((r) => r.url === '/api/domains/allow/exact')).toBeDefined();
		expect(allow.data.domains).toHaveLength(2);

		await c.addExactDomain('deny', 'example.com');
		const added = ftl.requests.filter((r) => r.url === '/api/domains/deny/exact' && r.method === 'POST').at(-1);
		expect(JSON.parse(added?.body ?? '{}')).toEqual({
			domain: 'example.com',
			comment: 'Added by pihole-switcher via API',
			groups: [0],
			enabled: true
		});
	});

	it('on 401: re-logs in exactly once and retries the original request', async () => {
		const c = client();
		ftl.rejectOnce.push('/api/dns/blocking/status');

		const res = await c.getStatus();

		expect(res.ok).toBe(true);
		expect(ftl.authCalls).toBe(2);
		const statusCalls = ftl.requests.filter((r) => r.url === '/api/dns/blocking/status');
		expect(statusCalls).toHaveLength(2);
		// the retry must carry the (new) session headers
		expect(statusCalls[1].headers['x-ftl-sid']).toBe('sid-1');
	});

	it('does not retry a request more than once on repeated 401', async () => {
		// Every non-auth request 401s, but the session stays "valid" (mock never
		// invalidates the sid), so the client must give up after a single retry.
		ftl.rejectOnce.push('/api/dns/blocking/status', '/api/dns/blocking/status');
		const c = client();
		const res = await c.getStatus();
		expect(res.ok).toBe(false);
		expect(res.status).toBe(401);
		expect(ftl.authCalls).toBe(2);
		const statusCalls = ftl.requests.filter((r) => r.url === '/api/dns/blocking/status');
		expect(statusCalls).toHaveLength(2);
	});

	it('throws FtlAuthError when login is rejected and honors the cooldown', async () => {
		const c = client({ authCooldownMs: 1000 });
		ftl.authOk = false;

		await expect(c.getStatus()).rejects.toBeInstanceOf(FtlAuthError);
		expect(ftl.authCalls).toBe(1);

		// Within cooldown: no second /auth hit.
		clock.now += 400;
		await expect(c.getStatus()).rejects.toBeInstanceOf(FtlAuthError);
		expect(ftl.authCalls).toBe(1);

		// After cooldown: retry succeeds.
		ftl.authOk = true;
		clock.now += 700;
		const res = await c.getStatus();
		expect(res.ok).toBe(true);
		expect(ftl.authCalls).toBe(2);
	});

	it('throws FtlAuthError when the login response has an invalid session', async () => {
		ftl.session = { sid: '', csrf: '', validity: 0 };
		const c = client();
		await expect(c.getStatus()).rejects.toBeInstanceOf(FtlAuthError);
	});

	it('shares one in-flight login across concurrent requests (single-flight)', async () => {
		const c = client();
		await Promise.all([
			c.getStatus(),
			c.getStatus(),
			c.getTopDomains(true, 3),
			c.getTopDomains(false, 3),
			c.getExactDomains('allow')
		]);
		expect(ftl.authCalls).toBe(1);
	});

	it('maps connection failure to FtlConnectionError', async () => {
		// A port with nothing listening.
		const c = new PiholeClient({
			config: makeConfig({ ftlBaseUrl: 'http://127.0.0.1:1/api', ftlTimeoutMs: 500 }),
			now: clock.nowFn
		});
		await expect(c.getStatus()).rejects.toBeInstanceOf(FtlConnectionError);
	});

	it('connection failure does NOT set the auth cooldown (FTL back is retried)', async () => {
		// Regression: lastLoginFailureAt used to be set on every login failure,
		// so a transient FTL outage masked 502s as 503 auth_failed for 5 minutes.
		const c = new PiholeClient({
			config: makeConfig({ ftlBaseUrl: 'http://127.0.0.1:1/api', ftlTimeoutMs: 500 }),
			now: clock.nowFn
		});
		await expect(c.getStatus()).rejects.toBeInstanceOf(FtlConnectionError);
		// Within the cooldown window, the next attempt must still be a real
		// retry (FtlConnectionError), not a cooldown rejection (FtlAuthError).
		await expect(c.getStatus()).rejects.toBeInstanceOf(FtlConnectionError);
	});

	it('setExactDomain PUTs the domain, preserving comment and groups', async () => {
		const c = client();
		const res = await c.setExactDomain('allow', 'allowed.example.com', {
			enabled: false,
			comment: null,
			groups: [0]
		});
		expect(res.ok).toBe(true);
		const put = ftl.requests.find((r) => r.url === '/api/domains/allow/exact/allowed.example.com');
		expect(put?.method).toBe('PUT');
		expect(JSON.parse(put?.body ?? '{}')).toEqual({ comment: null, groups: [0], enabled: false });
		// The mock is stateful: the next list reflects the change.
		const list = await c.getExactDomains('allow');
		const item = (list.data.domains as Array<{ domain: string; enabled: boolean }>).find(
			(d) => d.domain === 'allowed.example.com'
		);
		expect(item?.enabled).toBe(false);
	});

	it('times out a dead FTL and maps it to FtlConnectionError', async () => {
		// A server that accepts the connection but never answers.
		const { createServer } = await import('node:http');
		const silent = createServer(() => {
			/* never respond */
		});
		await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
		const port = (silent.address() as { port: number }).port;
		try {
			const c = new PiholeClient({
				config: makeConfig({ ftlBaseUrl: `http://127.0.0.1:${port}/api`, ftlTimeoutMs: 200 }),
				now: clock.nowFn
			});
			await expect(c.getStatus()).rejects.toBeInstanceOf(FtlConnectionError);
		} finally {
			silent.close();
		}
	});

	it('parses non-JSON bodies into a { raw } payload', async () => {
		const c = client();
		const res = await c.request<{ raw: string }>('GET', '/plain-text');
		expect(res.data.raw).toBe('not json');
	});

	it('createPiholeClient builds a working client from env values', async () => {
		const { createPiholeClient } = await import('../../src/lib/piholeClient.js');
		const hostPort = new URL(ftl.url);
		const c = createPiholeClient({
			PIHOLE_PROXY_TARGET: hostPort.hostname,
			PIHOLE_FTL_PORT: hostPort.port,
			PIHOLE_API_PASSWORD: 'correct-horse'
		});
		expect(c.getConfig().ftlBaseUrl).toBe(`${ftl.url}/api`);
		expect(c.getConfig().apiPassword).toBe('correct-horse');

		const res = await c.getStatus();
		expect(res.ok).toBe(true);
		expect(ftl.authCalls).toBe(1);
	});

	it('_resetForTests clears session state so the next request logs in again', async () => {
		const c = client();
		await c.getStatus();
		expect(ftl.authCalls).toBe(1);

		c._resetForTests();
		await c.getStatus();
		expect(ftl.authCalls).toBe(2);
	});
});
