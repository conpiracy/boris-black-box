import { describe, expect, it } from "vitest";
import { mergeTranscripts } from "../../src/transcript-merge";

describe("mergeTranscripts", () => {
  it("preserves ordering and emits SRT/json/text artifacts", () => {
    const artifacts = mergeTranscripts([
      {
        chunk: {
          index: 1,
          requestedStartSeconds: 2,
          requestedEndSeconds: 4,
          actualStartSeconds: 2,
          actualEndSeconds: 4,
          mimeType: "audio/mp4",
          fileName: "chunk-0001.mp4",
          bytes: new Uint8Array([1]),
        },
        text: "world",
        segments: [
          { id: "1", start: 2, end: 3, text: "world", chunkIndex: 1 },
        ],
        latencyMs: 10,
      },
      {
        chunk: {
          index: 0,
          requestedStartSeconds: 0,
          requestedEndSeconds: 2,
          actualStartSeconds: 0,
          actualEndSeconds: 2,
          mimeType: "audio/mp4",
          fileName: "chunk-0000.mp4",
          bytes: new Uint8Array([1]),
        },
        text: "hello",
        segments: [
          { id: "0", start: 0, end: 1, text: "hello", chunkIndex: 0 },
        ],
        latencyMs: 10,
      },
    ]);

    expect(artifacts.text).toBe("hello world");
    expect(artifacts.files.map((file) => file.name)).toEqual([
      "transcript.json",
      "segments.json",
      "transcript.srt",
      "transcript.txt",
    ]);
  });
});
