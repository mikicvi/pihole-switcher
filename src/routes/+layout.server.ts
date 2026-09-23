import { loadConfig } from '../lib/config.js';

/**
 * Expose only the client-safe config (the admin URL) to the page. The FTL
 * password from the same config object is never returned here.
 */
export const load = () => {
	let adminUrl: string | null = null;
	try {
		adminUrl = loadConfig().adminUrl;
	} catch {
		// Config may be incomplete in some environments; the UI degrades gracefully.
		adminUrl = null;
	}
	return { adminUrl };
};
