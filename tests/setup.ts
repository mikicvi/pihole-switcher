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

afterEach(() => {
	cleanup();
});
