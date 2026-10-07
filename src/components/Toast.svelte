<script lang="ts">
	interface Props {
		kind: 'success' | 'error' | 'warning';
		message: string;
	}

	let { kind, message }: Props = $props();

	/* fg is the INK member of each state hue: the vivid accent on its own soft
	   wash is 2.6–3.9:1. The rail and border inherit it, so all three stay in
	   the same family. */
	const styles = {
		success: { bg: 'var(--good-soft)', fg: 'var(--good-ink)' },
		warning: { bg: 'var(--warn-soft)', fg: 'var(--warn-ink)' },
		error: { bg: 'var(--bad-soft)', fg: 'var(--bad-ink)' }
	} as const;
</script>

<div
	data-testid="toast"
	role="status"
	aria-live="polite"
	class="toast flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
	style="background: {styles[kind].bg}; color: {styles[kind].fg}; border-color: {styles[kind].fg};"
>
	<span aria-hidden="true">{kind === 'success' ? '✓' : kind === 'warning' ? '!' : '✕'}</span>
	{message}
</div>

<style>
	/*
	 * Entrance: 180ms spring slide-up. The icon span and {message} stay as
	 * adjacent siblings — the whitespace between them is part of the text
	 * content that the tests assert ("✓ hello").
	 */
	.toast {
		position: relative;
		overflow: hidden;
		border-radius: var(--r-md);
		box-shadow: var(--shadow-2), var(--hairline);
		animation: toast-in 180ms var(--spring);
	}
	/* Kind rail on the leading edge, in the same color as the text. */
	.toast::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 3px;
		background: currentColor;
	}
	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
