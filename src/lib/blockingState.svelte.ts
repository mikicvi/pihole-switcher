/**
 * Shared live blocking state between the home page (writer) and the layout
 * header pill (reader). Svelte 5 module-level $state: the exported binding
 * must not be reassigned, so the state lives on a property of an exported
 * object and only that property is mutated.
 */
const holder = $state<{ value: boolean | null }>({ value: null });

export const blocking = holder;

export function setBlockingState(value: boolean | null) {
	holder.value = value;
}
