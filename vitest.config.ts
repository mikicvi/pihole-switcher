import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// The SvelteKit plugin (not the bare svelte plugin) is what makes component
// tests work: it resolves Svelte under the `browser` condition (client build,
// so testing-library's mount() exists) and provides the real $app modules.
export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		// SSR resolution drops the `browser` condition, which would make
		// `import ... from 'svelte'` resolve to the server build (no mount()).
		// Component tests need the client build.
		conditions: ['browser']
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts'],
		coverage: {
			provider: 'v8',
			// Cover the whole app (components included) so Sonar sees per-file data.
			include: ['src/**/*.{ts,svelte}'],
			// Ambient type declarations have no runtime code.
			exclude: ['src/app.d.ts', 'src/vite-env.d.ts'],
			// lcov is consumed by Sonar (sonar.javascript.lcov.reportPaths).
			reporter: ['text', 'html', 'json', 'clover', 'lcov'],
			thresholds: {
				lines: 90,
				branches: 85,
				functions: 90
			}
		}
	}
});
