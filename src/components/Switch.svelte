<script lang="ts">
	interface Props {
		checked: boolean;
		disabled?: boolean;
		label?: string;
		onchange: (checked: boolean) => void;
	}

	let { checked, disabled = false, label = '', onchange }: Props = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	disabled={disabled}
	onclick={() => onchange(!checked)}
	class="relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
	style="background: {checked ? 'var(--good)' : 'var(--surface-2)'};"
>
	<span
		class="absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200"
		style="transform: translateX({checked ? '24px' : '0'});"
	></span>
</button>
