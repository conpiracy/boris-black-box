import { describe, expect, it } from "vitest";
import { buildManifest } from "../../src/manifest";

describe("manifest", () => {
  it("resolves the Boris capability manifest", () => {
    const manifest = buildManifest();
    expect(manifest.capability).toBe("media.transcribe.parallel.v1");
    expect(manifest.chunkingMode).toBe("mediabunny_segment");
    expect(manifest.provenCodecs).toContain("aac");
  });
});
