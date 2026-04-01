const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9._-]{10,}/gi,
] as const;

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_PATTERNS.reduce<string>(
      (current, pattern) => current.replace(pattern, "[REDACTED]"),
      value,
    );
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        key.toLowerCase().includes("key") || key.toLowerCase().includes("authorization")
          ? "[REDACTED]"
          : redactSecrets(entry),
      ]),
    );
  }
  return value;
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  console.log(message, context ? redactSecrets(context) : "");
}

export function logError(message: string, context?: Record<string, unknown>): void {
  console.error(message, context ? redactSecrets(context) : "");
}
