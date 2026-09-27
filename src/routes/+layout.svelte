<script lang="ts">
	import { page } from '$app/state';
	import '../app.css';
	import LayoutShell from '../components/LayoutShell.svelte';
	import { blocking } from '../lib/blockingState.svelte.js';

	/** @type {import('./$types').LayoutData} */
	let { data, children } = $props();

	// The header status pill reads the shared live blocking state written by
	// the home page; it stays null (loading) until the home page has fetched
	// status. The home route also widens the shell for the desktop grid.
</script>

<LayoutShell
	data={data}
	blocking={blocking.value}
	pauseRemaining={blocking.pauseRemaining}
	pauseTotal={blocking.pauseTotal}
	wide={page.url.pathname === '/'}
>
	{@render children()}
</LayoutShell>
