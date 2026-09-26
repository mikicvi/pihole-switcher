/**
 * Shared live blocking state between the home page (writer) and the layout
 * header pill (reader). Svelte 5 module-level $state: the exported binding
 * must not be reassigned, so the state lives on properties of an exported
 * object and only those are mutated.
 *
 * The pill also shows a countdown ring while paused, so the pause deadline
 * and total travel along with the blocking flag.
 */
const holder = $state<{
	value: boolean | null;
	pauseRemaining: number | null;
	pauseTotal: number | null;
}>({ value: null, pauseRemaining: null, pauseTotal: null });

export const blocking = holder;

export function setBlockingState(value: boolean | null) {
	holder.value = value;
}

export function setPauseState(remaining: number | null, total: number | null) {
	holder.pauseRemaining = remaining;
	holder.pauseTotal = total;
}
