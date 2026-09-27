// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { handle } from '../../src/hooks.server.js';

function run(resolve: () => Promise<Response>, path = '/') {
	const event = {
		request: new Request(`http://localhost${path}`),
		cookies: { get: () => undefined, set: () => {}, delete: () => {} },
		locals: {},
		clientAddress: '127.0.0.1'
	};
	return handle({ event, resolve } as never);
}

describe('hooks.server handle', () => {
	it('adds security headers to every response', async () => {
		const res = await run(async () => new Response('ok'));
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(res.headers.get('x-frame-options')).toBe('DENY');
		expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
	});

	it('preserves the response body and status', async () => {
		const res = await run(
			async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
			'/health'
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});
