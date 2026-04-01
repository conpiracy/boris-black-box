import { describe, expect, it } from "vitest";
import { redactSecrets } from "../../src/logger";

describe("redactSecrets", () => {
  it("redacts provider keys and bearer headers", () => {
    const redacted = redactSecrets({
      authorization: "Bearer sk-secret-token-1234567890",
      nested: {
        transcriptionApiKey: "sk-abc1234567890",
      },
    }) as Record<string, unknown>;
    expect(redacted.authorization).toBe("[REDACTED]");
    expect((redacted.nested as Record<string, unknown>).transcriptionApiKey).toBe("[REDACTED]");
  });
});
