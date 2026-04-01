import { describe, expect, it } from "vitest";
import { bootstrapRequestSchema, transcriptionRequestSchema } from "../../src/schema";

describe("schemas", () => {
  it("accepts raw key transcription requests", () => {
    const parsed = transcriptionRequestSchema.parse({
      transcriptionProvider: "openai",
      transcriptionApiKey: "sk-test-1234567890",
      target: {
        type: "url",
        url: "https://example.com/video.mp4",
      },
      options: {
        chunking: {
          mode: "mediabunny_segment",
          maxChunkSeconds: 60,
          silenceAware: false,
        },
        parallelism: 4,
        returnFormat: "segments+srt+json",
      },
    });
    expect(parsed.options.chunking.mode).toBe("mediabunny_segment");
  });

  it("rejects missing key material", () => {
    expect(() =>
      transcriptionRequestSchema.parse({
        transcriptionProvider: "openai",
        target: {
          type: "url",
          url: "https://example.com/video.mp4",
        },
      }),
    ).toThrow(/transcriptionApiKey/);
  });

  it("validates bootstrap upload requests", () => {
    const parsed = bootstrapRequestSchema.parse({
      action: "create_upload",
      fileName: "sample.mp4",
      contentType: "video/mp4",
    });
    expect(parsed.action).toBe("create_upload");
  });
});
