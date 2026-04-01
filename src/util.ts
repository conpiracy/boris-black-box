import { DEFAULT_MAX_SOURCE_BYTES, MAX_PARALLELISM, SUPPORTED_MEDIA_PREFIXES } from "./constants";

export function nowIso(): string {
  return new Date().toISOString();
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

export function assertMediaType(contentType: string): void {
  const normalized = contentType.toLowerCase();
  if (!SUPPORTED_MEDIA_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
}

export function parsePositiveInt(input: string | undefined, fallback: number): number {
  const value = Number.parseInt(input ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function maxSourceBytesFromEnv(raw: string | undefined): number {
  return parsePositiveInt(raw, DEFAULT_MAX_SOURCE_BYTES);
}

export function clampParallelism(value: number): number {
  return Math.max(1, Math.min(MAX_PARALLELISM, Math.trunc(value)));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function fromBase64(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

export function randomHex(bytes = 12): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function runWithConcurrency<T>(
  items: readonly T[],
  parallelism: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const limit = clampParallelism(parallelism);
  let nextIndex = 0;

  async function consume(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      await worker(items[currentIndex]!, currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => consume()));
}

export function formatSrtTimestamp(seconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const ms = totalMilliseconds % 1000;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
}

export function stableSortByStart<T extends { start: number; end: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }
    return left.end - right.end;
  });
}
