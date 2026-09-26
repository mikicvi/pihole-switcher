<script lang="ts">
	/**
	 * Theme resolution, in priority order:
	 * 1. explicit user choice (toggle click, persisted under KEY)
	 * 2. the OS light/dark preference (prefers-color-scheme), followed LIVE —
	 *    so macOS/iOS "Auto" appearance flips the app through the day
	 * 3. dark fallback when matchMedia is unavailable
	 * An explicit choice stops OS tracking; it persists across reloads.
	 */
	const KEY = 'pihole-switcher-theme';

	function stored(): 'light' | 'dark' | null {
		try {
			const v = localStorage.getItem(KEY);
			return v === 'light' || v === 'dark' ? v : null;
		} catch {
			return null;
		}
	}

	function osTheme(): 'light' | 'dark' {
		try {
			if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
				return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			}
		} catch {
			// fall through to the default below
		}
		return 'dark';
	}

	function applyTheme(theme: 'light' | 'dark') {
		document.documentElement.classList.toggle('dark', theme === 'dark');
	}

	// Initialize before first render so the first paint is in the right mode.
	const initial: 'light' | 'dark' =
		(typeof document !== 'undefined' ? stored() : null) ??
		(typeof window !== 'undefined' ? osTheme() : 'dark');
	if (typeof document !== 'undefined') {
		applyTheme(initial);
	}

	let isDark = $state(initial === 'dark');

	// Track OS scheme changes while in auto mode (no explicit choice stored).
	$effect(() => {
		const mq =
			typeof window !== 'undefined' && typeof window.matchMedia === 'function'
				? window.matchMedia('(prefers-color-scheme: dark)')
				: null;
		if (!mq) return;
		const onChange = (e: MediaQueryListEvent) => {
			if (stored() !== null) return; // explicit user choice wins
			isDark = e.matches;
			applyTheme(e.matches ? 'dark' : 'light');
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	function toggle() {
		isDark = !isDark;
		applyTheme(isDark ? 'dark' : 'light');
		localStorage.setItem(KEY, isDark ? 'dark' : 'light');
	}
</script>

<button
	data-testid="theme-toggle"
	type="button"
	onclick={toggle}
	aria-label="Switch theme"
	class="rounded-md border p-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
	style="background: var(--surface); border-color: var(--border); color: var(--text);"
>
	{#if isDark}🌙{:else}☀️{/if}
</button>
