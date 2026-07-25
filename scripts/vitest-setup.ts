/**
 * Foldkit UI primitives that address their own DOM nodes (the radio group's
 * roving focus, for example) use `CSS.escape`, which every browser provides but
 * the Node test environment does not. The shim exists only so component code
 * can run unchanged under Vitest; product code never depends on it.
 */
const escapeIdentifier = (value: string): string =>
  String(value).replace(/[^\w-]/gu, (character) => `\\${character}`);

if (typeof globalThis.CSS === 'undefined') {
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: { escape: escapeIdentifier },
  });
} else if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = escapeIdentifier;
}
