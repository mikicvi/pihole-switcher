<script lang="ts">
	/**
	 * Theme mode:
	 * - 'auto' (default): follows the OS light/dark preference (prefers-color-scheme),
	 *   LIVE — so macOS/iOS "Auto" appearance flips the app through the day.
	 * - 'light' | 'dark': explicit pinned mode.
	 * The toggle cycles auto → light → dark → auto, so OS-following is always
	 * one or two clicks away and never requires clearing storage. The current
	 * mode persists under KEY across reloads (old 'light'/'dark' values from
	 * earlier versions are read unchanged).
	 */
	const KEY = 'pihole-switcher-theme';
	type Mode = 'auto' | 'light' | 'dark';

	function stored(): Mode | null {
		try {
			const v = localStorage.getItem(KEY);
			return v === 'auto' || v === 'light' || v === 'dark' ? v : null;
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

	// Compute the initial mode/colour before first render so the first paint
	// is already in the right theme (plain locals — the $state initializers
	// below must not read other state).
	const initialMode: Mode = (typeof document !== 'undefined' ? stored() : null) ?? 'auto';
	const initialDark: boolean =
		initialMode === 'auto'
			? (typeof window !== 'undefined' ? osTheme() === 'dark' : true)
			: initialMode === 'dark';

	let mode = $state<Mode>(initialMode);
	let isDark = $state(initialDark);
	if (typeof document !== 'undefined') {
		applyTheme(initialDark ? 'dark' : 'light');
	}

	// Track OS scheme changes while in auto mode.
	$effect(() => {
		const mq =
			typeof window !== 'undefined' && typeof window.matchMedia === 'function'
				? window.matchMedia('(prefers-color-scheme: dark)')
				: null;
		if (!mq) return;
		const onChange = (e: MediaQueryListEvent) => {
			if (mode !== 'auto') return; // explicit mode wins
			isDark = e.matches;
			applyTheme(e.matches ? 'dark' : 'light');
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	function toggle() {
		// auto → light → dark → auto (auto re-derives from the OS at that moment)
		mode = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
		isDark = mode === 'auto' ? osTheme() === 'dark' : mode === 'dark';
		applyTheme(isDark ? 'dark' : 'light');
		localStorage.setItem(KEY, mode);
	}

	const icon = $derived(mode === 'auto' ? '🌗' : mode === 'light' ? '☀️' : '🌙');
	const label = $derived(mode === 'auto' ? 'Theme: auto (follows system)' : `Theme: ${mode}`);
</script>

<button
	data-testid="theme-toggle"
	type="button"
	onclick={toggle}
	aria-label={label}
	class="rounded-md border p-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
	style="background: var(--surface); border-color: var(--border); color: var(--text);"
>
	{icon}
</button>
