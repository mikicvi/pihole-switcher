import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

// Node 22+ exposes an experimental `localStorage` global that is undefined
// unless --localstorage-file is provided, and this jsdom build defers to it.
// Tests only need basic persistence semantics, so install a deterministic
// in-memory Storage polyfill regardless of environment.
class MemoryStorage {
	private map = new Map<string, string>();
	get length(): number {
		return this.map.size;
	}
	clear(): void {
		this.map.clear();
	}
	getItem(key: string): string | null {
		return this.map.has(key) ? (this.map.get(key) as string) : null;
	}
	key(index: number): string | null {
		return [...this.map.keys()][index] ?? null;
	}
	setItem(key: string, value: string): void {
		this.map.set(key, String(value));
	}
	removeItem(key: string): void {
		this.map.delete(key);
	}
}
Object.defineProperty(globalThis, 'localStorage', {
	value: new MemoryStorage(),
	configurable: true,
	writable: true
});

// jsdom has no matchMedia; svelte/motion's spring() consults
// prefers-reduced-motion at import time, so the stub must exist before any
// component is imported.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
	window.matchMedia = (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false
	}) as MediaQueryList;
}

// jsdom has no Web Animations API; Svelte transitions (crossfade fallback,
// fades) call element.animate. A no-op Animation keeps them functional —
// onfinish never fires, which is fine for assertions against rendered DOM.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
	Element.prototype.animate = function (
		this: Element
	): Animation {
		const animation = {
			onfinish: null as null | (() => void),
			play: () => {},
			pause: () => {},
			cancel: () => {},
			finish: () => {},
			reverse: () => {},
			currentTime: 0,
			playbackRate: 1,
			finished: Promise.resolve(null)
		} as unknown as Animation;
		return animation;
	};
}

afterEach(() => {
	cleanup();
});
