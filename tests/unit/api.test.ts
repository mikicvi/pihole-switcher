import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBlockingStatus, normalizeBlocking } from '../../src/lib/api.js';

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
