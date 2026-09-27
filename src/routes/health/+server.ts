import { json } from '@sveltejs/kit';

/**
 * Liveness probe for Docker HEALTHCHECK / reverse proxies / homelab
 * monitoring. Intentionally cheap and dependency-free: it proves the Node
 * process is serving, nothing more (FTL reachability is surfaced in the UI).
 * It reveals no configuration and requires no authentication.
 */
export function GET() {
	return json({ ok: true, service: 'pihole-switcher' });
}
