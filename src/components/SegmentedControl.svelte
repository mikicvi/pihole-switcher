<script lang="ts">
	interface Option {
		value: string | number;
		label: string;
	}

	interface Props {
		options: Option[];
		value: string | number;
		'aria-label'?: string;
		'class'?: string;
		/** Fill the container and make all segments equal width. */
		stretch?: boolean;
		onchange: (value: string | number) => void;
	}

	let { options, value, 'aria-label': ariaLabel = '', class: cls = '', stretch = false, onchange }:
		Props = $props();

	/** Selected index drives the sliding thumb — a plain lookup, no branching. */
	const selectedIndex = $derived(options.findIndex((o) => o.value === value));
</script>

<div
	role="tablist"
	aria-label={ariaLabel}
	class="seg {stretch ? 'flex w-full' : 'inline-flex'} rounded-lg border p-0.5 {cls}"
	class:seg-stretch={stretch}
	style="border-color: var(--border); background: var(--surface-2);"
	style:--n={options.length}
	style:--i={selectedIndex}
>
	{#each options as option (option.value)}
		<button
			type="button"
			role="tab"
			aria-selected={option.value === value}
			data-testid="segment-{String(option.value)}"
			onclick={() => onchange(option.value)}
			class="seg-btn rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] {stretch ? 'flex-1 justify-center' : ''}"
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	/*
	 * Sliding thumb (stretch only): one plate on the tablist, translated by the
	 * selected index (`--i`) across a width of 1/var(--n) — a single spring
	 * translateX, no JS animation and no measuring. The custom properties live
	 * on the tablist because a button's own custom property is not visible to
	 * the container's ::before. Insets match the 1px border + 2px padding so the
	 * plate lands exactly on the segment it stands behind.
	 *
	 * Selected/unselected coloring is styled from [aria-selected] rather than an
	 * inline style ternary: same result, and it costs the coverage gate no new
	 * branches.
	 */
	.seg {
		position: relative;
	}
	.seg-stretch::before {
		content: '';
		position: absolute;
		top: 2px;
		bottom: 2px;
		left: 2px;
		width: calc((100% - 4px) / var(--n));
		border-radius: var(--r-sm);
		background: var(--surface);
		box-shadow: var(--shadow-1), var(--hairline);
		transform: translateX(calc(var(--i) * 100%));
		transition: transform 0.32s var(--spring);
	}
	.seg-btn {
		position: relative;
		z-index: 1;
		color: var(--text-muted);
		background: transparent;
		transition: color 0.15s ease;
	}
	.seg-btn[aria-selected='true'] {
		color: var(--text);
	}
	/* Without a plate, the selected button IS the pill. */
	.seg:not(.seg-stretch) .seg-btn[aria-selected='true'] {
		background: var(--surface);
		box-shadow: var(--shadow-1), var(--hairline);
	}
	@media (hover: hover) {
		.seg-btn:not([aria-selected='true']):hover {
			color: var(--text);
		}
	}
</style>
