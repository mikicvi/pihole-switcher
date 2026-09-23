<script lang="ts">
	import '../app.css';
	import LayoutShell from '../components/LayoutShell.svelte';
	import { blocking } from '../lib/blockingState.svelte.js';

	/** @type {import('./$types').LayoutData} */
	let { data, children } = $props();

	// The header status pill reads the shared live blocking state written by the
	// home page; it stays null (loading) until the home page has fetched status.
</script>

<LayoutShell data={data} blocking={blocking.value}>
	{@render children()}
</LayoutShell>
