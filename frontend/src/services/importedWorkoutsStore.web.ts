// Web stub — expo-sqlite is native-only, and health imports (Apple Health /
// Health Connect) don't exist in the browser, so nothing is ever tracked here.
// Keeping this file out of the expo-sqlite import graph is what lets the web
// bundle build without the wa-sqlite wasm worker.

export async function isImported(_source: string, _externalId: string): Promise<boolean> {
  return false;
}

export async function markImported(
  _source: string,
  _externalId: string,
  _backendWorkoutId: string,
): Promise<void> {}

export async function getImportedKeys(_source: string): Promise<Set<string>> {
  return new Set();
}
