/** Narrows a value that the test expects to exist, failing with a clear message otherwise. */
export function must<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`Expected ${label}`);
  return value;
}

/** Reads an environment variable that the test cannot run without. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
