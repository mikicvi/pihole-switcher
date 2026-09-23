<script lang="ts">
	function applyTheme(theme: 'light' | 'dark') {
		document.documentElement.classList.toggle('dark', theme === 'dark');
	}

	// Default: dark unless the user previously chose light.
	if (typeof document !== 'undefined') {
		const saved = localStorage.getItem('pihole-switcher-theme');
		applyTheme(saved === 'light' ? 'light' : 'dark');
	}

	let isDark = $state(typeof document !== 'undefined' && localStorage.getItem('pihole-switcher-theme') !== 'light');

	function toggle() {
		isDark = !isDark;
		applyTheme(isDark ? 'dark' : 'light');
		localStorage.setItem('pihole-switcher-theme', isDark ? 'dark' : 'light');
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
