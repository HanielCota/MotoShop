/** Narrows a value that the script expects to exist, failing with a clear message otherwise. */
export function must<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Expected ${label}`);
  return value;
}
