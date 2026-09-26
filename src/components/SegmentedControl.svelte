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
		onchange: (value: string | number) => void;
	}

	let { options, value, 'aria-label': ariaLabel = '', class: cls = '', onchange }: Props = $props();
</script>

<div role="tablist" aria-label={ariaLabel} class="inline-flex rounded-lg border p-0.5 {cls}" style="border-color: var(--border); background: var(--surface-2);">
	{#each options as option (option.value)}
		<button
			type="button"
			role="tab"
			aria-selected={option.value === value}
			data-testid="segment-{String(option.value)}"
			onclick={() => onchange(option.value)}
			class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
			style={
				option.value === value
					? 'background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(0,0,0,.25);'
					: 'color: var(--text-muted); background: transparent;'
			}
		>
			{option.label}
		</button>
	{/each}
</div>
