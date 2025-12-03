// Ensure Hermes exposes helpers expected by dependencies that rely on JSC globals.
const globalObject = globalThis as Record<string, unknown>;

if (typeof globalObject._toString !== "function") {
  globalObject._toString = (value?: unknown) => Object.prototype.toString.call(value);
}
