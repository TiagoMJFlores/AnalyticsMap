export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your .env file or export it in your shell.`
    );
  }
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}
