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
	class="theme-btn rounded-full border p-0 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
>
	{icon}
</button>

<style>
	/*
	 * A 36px dial: glass plate + inner top highlight, glyph centred. Hover
	 * rotates/scales the glyph only (transform — compositor-cheap); the press
	 * scale from app.css still wins because `button:not(:disabled):active`
	 * out-specifies `:hover` here.
	 */
	.theme-btn {
		/* Never let the flex row squash the dial into an oval at narrow
		   widths; the tabs give way instead. */
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		border-color: var(--border);
		background: var(--glass);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		color: var(--text);
		box-shadow: var(--shadow-1), var(--hairline);
		transition:
			transform 160ms var(--spring),
			box-shadow 0.15s ease,
			border-color 0.15s ease;
	}
	@media (hover: hover) {
		.theme-btn:hover {
			transform: rotate(-12deg) scale(1.06);
			border-color: color-mix(in srgb, var(--accent) 45%, transparent);
			box-shadow: var(--shadow-2), var(--hairline);
		}
	}
	.theme-btn:focus-visible {
		box-shadow: var(--ring), var(--hairline);
	}
</style>
