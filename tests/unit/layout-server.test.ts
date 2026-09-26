// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { load } from '../../src/routes/+layout.server.js';

describe('+layout.server load (client-safe config only)', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('returns a derived admin URL when the config is complete', () => {
		vi.stubEnv('PIHOLE_API_PASSWORD', 'secret');
		vi.stubEnv('PIHOLE_PROXY_TARGET', '192.168.1.12');
		vi.stubEnv('PIHOLE_FTL_PORT', '1010');
		expect(load()).toEqual({ adminUrl: 'http://192.168.1.12:1010/admin' });
	});

	it('honors a PUBLIC_PIHOLE_ADMIN override', () => {
		vi.stubEnv('PIHOLE_API_PASSWORD', 'secret');
		vi.stubEnv('PUBLIC_PIHOLE_ADMIN', 'http://pi.local/admin');
		expect(load()).toEqual({ adminUrl: 'http://pi.local/admin' });
	});

	it('returns null (never a password) when the config is incomplete', () => {
		vi.stubEnv('PIHOLE_API_PASSWORD', '');
		expect(load()).toEqual({ adminUrl: null });
	});
});
