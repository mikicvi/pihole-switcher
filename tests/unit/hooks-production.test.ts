// @vitest-environment node
//
// The production boot check lives at module scope of hooks.server.ts and only
// runs when NODE_ENV === 'production'. These tests import the module fresh
// under that environment to prove: valid config → boots; invalid config →
// process.exit(1) (the container must never come up half-configured).
import { afterEach, describe, expect, it, vi } from 'vitest';

async function importHooksAsProduction(): Promise<typeof import('../../src/hooks.server.js')> {
	vi.stubEnv('NODE_ENV', 'production');
	await vi.resetModules();
	return await import('../../src/hooks.server.js');
}

describe('hooks.server production fail-fast', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it('boots when the configuration is valid', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
		vi.stubEnv('PIHOLE_API_PASSWORD', 'secret');
		const mod = await importHooksAsProduction();
		expect(mod.handle).toBeTypeOf('function');
		expect(exitSpy).not.toHaveBeenCalled();
	});

	it('exits 1 when PIHOLE_API_PASSWORD is missing', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubEnv('PIHOLE_API_PASSWORD', '');
		await importHooksAsProduction();
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('refusing to start'));
	});

	it('exits 1 when the timeout is not a positive number', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubEnv('PIHOLE_API_PASSWORD', 'secret');
		vi.stubEnv('PIHOLE_FTL_TIMEOUT_MS', 'not-a-number');
		await importHooksAsProduction();
		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});
