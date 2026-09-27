// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GET } from '../../src/routes/health/+server.js';

describe('GET /health', () => {
	it('returns 200 with a JSON ok payload', async () => {
		const res = GET();
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('application/json');
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(body.service).toBe('pihole-switcher');
	});
});
