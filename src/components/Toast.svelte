<script lang="ts">
	interface Props {
		kind: 'success' | 'error' | 'warning';
		message: string;
	}

	let { kind, message }: Props = $props();

	const styles = {
		success: { bg: 'var(--good-soft)', fg: 'var(--good)' },
		warning: { bg: 'var(--warn-soft)', fg: 'var(--warn)' },
		error: { bg: 'var(--bad-soft)', fg: 'var(--bad)' }
	} as const;
</script>

<div
	data-testid="toast"
	role="status"
	aria-live="polite"
	class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm"
	style="background: {styles[kind].bg}; color: {styles[kind].fg}; border-color: {styles[kind].fg};"
>
	<span aria-hidden="true">{kind === 'success' ? '✓' : kind === 'warning' ? '!' : '✕'}</span>
	{message}
</div>
