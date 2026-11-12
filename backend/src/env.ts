/** Reads a required environment variable, failing the boot when it's missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}
