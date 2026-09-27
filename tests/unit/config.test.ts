import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';

describe('loadConfig', () => {
	it('throws a clear error when PIHOLE_API_PASSWORD is missing', () => {
		expect(() => loadConfig({})).toThrow(/PIHOLE_API_PASSWORD/);
	});

	it('throws when PIHOLE_API_PASSWORD is empty', () => {
		expect(() => loadConfig({ PIHOLE_API_PASSWORD: '' })).toThrow(/PIHOLE_API_PASSWORD/);
	});

	it('applies defaults for host, port and admin URL', () => {
		const cfg = loadConfig({ PIHOLE_API_PASSWORD: 'secret' });
		expect(cfg.ftlBaseUrl).toBe('http://192.168.1.1:1010/api');
		expect(cfg.apiPassword).toBe('secret');
		// Admin link defaults to the FTL host/port + /admin so it always works
		// without extra configuration.
		expect(cfg.adminUrl).toBe('http://192.168.1.1:1010/admin');
		expect(cfg.ftlTimeoutMs).toBe(5000);
		expect(cfg.authCooldownMs).toBe(10000);
	});

	it('builds the base URL and admin URL from PIHOLE_PROXY_TARGET and PIHOLE_FTL_PORT', () => {
		const cfg = loadConfig({
			PIHOLE_API_PASSWORD: 'secret',
			PIHOLE_PROXY_TARGET: '192.168.1.12',
			PIHOLE_FTL_PORT: '1010'
		});
		expect(cfg.ftlBaseUrl).toBe('http://192.168.1.12:1010/api');
		expect(cfg.adminUrl).toBe('http://192.168.1.12:1010/admin');
	});

	it('lets PUBLIC_PIHOLE_ADMIN override the derived admin URL', () => {
		const cfg = loadConfig({
			PIHOLE_API_PASSWORD: 'secret',
			PUBLIC_PIHOLE_ADMIN: 'http://192.168.1.12:1010/admin/login'
		});
		expect(cfg.adminUrl).toBe('http://192.168.1.12:1010/admin/login');
	});

	it('rejects non-numeric or non-positive PIHOLE_FTL_TIMEOUT_MS', () => {
		expect(() => loadConfig({ PIHOLE_API_PASSWORD: 'x', PIHOLE_FTL_TIMEOUT_MS: 'abc' })).toThrow(
			/PIHOLE_FTL_TIMEOUT_MS/
		);
		expect(() => loadConfig({ PIHOLE_API_PASSWORD: 'x', PIHOLE_FTL_TIMEOUT_MS: '-1' })).toThrow(
			/PIHOLE_FTL_TIMEOUT_MS/
		);
	});

	it('rejects non-numeric or non-positive PIHOLE_AUTH_COOLDOWN_MS', () => {
		expect(() => loadConfig({ PIHOLE_API_PASSWORD: 'x', PIHOLE_AUTH_COOLDOWN_MS: 'nope' })).toThrow(
			/PIHOLE_AUTH_COOLDOWN_MS/
		);
	});
});
