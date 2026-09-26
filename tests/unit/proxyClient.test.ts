// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('proxyClient.getClient', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it('memoizes the client across calls and resets on demand', async () => {
		vi.stubEnv('PIHOLE_API_PASSWORD', 'secret');
		const { getClient, _resetClientForTests } = await import('../../src/lib/proxyClient.js');
		const first = await getClient();
		const second = await getClient();
		expect(second).toBe(first);

		_resetClientForTests();
		const third = await getClient();
		expect(third).not.toBe(first);
	});
});
