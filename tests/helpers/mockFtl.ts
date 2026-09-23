/**
 * A tiny in-process mock of the Pi-hole FTL v6 REST API, backed by a real
 * node:http server on an ephemeral port. Records every request so tests can
 * assert on method/path/headers/body.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
	method: string;
	url: string;
	headers: http.IncomingHttpHeaders;
	body: string;
}

export interface MockFtlSession {
	sid: string;
	csrf: string;
	validity: number;
}

export class MockFtl {
	requests: RecordedRequest[] = [];
	authCalls = 0;
	/** When false, POST /api/auth returns 401. */
	authOk = true;
	/** Paths (with query) that should 401 exactly once, to simulate a dead session. */
	rejectOnce: string[] = [];
	session: MockFtlSession = { sid: 'sid-1', csrf: 'csrf-1', validity: 1800 };

	private server: http.Server;
	url = '';

	constructor() {
		this.server = http.createServer((req, res) => this.handle(req, res));
	}

	async start(): Promise<this> {
		await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
		const { port } = this.server.address() as AddressInfo;
		this.url = `http://127.0.0.1:${port}`;
		return this;
	}

	async close(): Promise<void> {
		await new Promise<void>((resolve, reject) =>
			this.server.close((err) => (err ? reject(err) : resolve()))
		);
	}

	private send(res: http.ServerResponse, status: number, body: unknown): void {
		const text = JSON.stringify(body);
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(text);
	}

	private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
		let body = '';
		req.on('data', (c: Buffer) => {
			body += c.toString('utf8');
		});
		req.on('end', () => {
			const url = req.url ?? '/';
			this.requests.push({
				method: req.method ?? 'GET',
				url,
				headers: req.headers,
				body
			});

			if (url === '/api/auth' || url === '/auth') {
				this.authCalls += 1;
				if (!this.authOk) {
					this.send(res, 401, { error: 'unauthorized' });
					return;
				}
				this.send(res, 200, { session: { valid: true, ...this.session } });
				return;
			}

			// Simulate a dead session on the next request to a listed path.
			const idx = this.rejectOnce.indexOf(url);
			if (idx !== -1) {
				this.rejectOnce.splice(idx, 1);
				this.send(res, 401, { error: 'unauthorized' });
				return;
			}

			// Non-JSON error page support for rawFetch's fallback branch.
			if (url.startsWith('/api/plain-text')) {
				res.writeHead(200, { 'content-type': 'text/plain' });
				res.end('not json');
				return;
			}

			if (url.startsWith('/api/dns/blocking/status')) {
				this.send(res, 200, { blocking: true, timer: 0 });
				return;
			}
			if (url.startsWith('/api/dns/blocking')) {
				this.send(res, 200, { success: true });
				return;
			}
			if (url.startsWith('/api/stats/top_domains')) {
				this.send(res, 200, {
					domains: [
						{ domain: 'ads.example.com', count: 7 },
						{ domain: 'tracker.example.org', count: 2 }
					]
				});
				return;
			}
			if (url.startsWith('/api/domains/allow/exact') || url.startsWith('/api/domains/deny/exact')) {
				if (req.method === 'POST') {
					let domain = '';
					try {
						domain = (JSON.parse(body || '{}') as { domain?: string }).domain ?? '';
					} catch {
						domain = '';
					}
					if (domain === 'dup.com') {
						this.send(res, 400, { error: 'UNIQUE constraint failed: domains.domain' });
						return;
					}
					this.send(res, 201, { added: true });
					return;
				}
				this.send(res, 200, {
					domains: [
						{ domain: 'allowed.example.com', date_modified: 1700000000, enabled: true },
						{ domain: 'denied.example.com', date_modified: 1700000123, enabled: false }
					]
				});
				return;
			}

			this.send(res, 404, { error: 'not_found' });
		});
	}
}
