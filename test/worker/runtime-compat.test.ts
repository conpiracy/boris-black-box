import { describe, expect, it } from "vitest";
import { buildChunkPlan } from "../../src/media/chunk-plan";
import { inspectMedia } from "../../src/media/inspect";
import { produceChunk } from "../../src/media/packet-segmenter";

const dummyEnv = {
  BORIS_BUCKET: {} as R2Bucket,
};

describe("workerd MediaBunny compatibility matrix", () => {
  it(
    "supports MediaBunny packet-copy chunking for a remote MP4 sample",
    async () => {
      const target = {
        type: "url" as const,
        url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
      };
      const inspection = await inspectMedia(target, dummyEnv);
      const chunk = await produceChunk(target, buildChunkPlan(inspection.durationSeconds, 2)[0]!, dummyEnv);
      expect(inspection.audioCodec).toBe("aac");
      expect(chunk.mimeType).toBe("audio/mp4");
      expect(chunk.bytes.byteLength).toBeGreaterThan(1024);
    },
    60_000,
  );

  it(
    "supports MediaBunny packet-copy chunking for a remote MP3 sample",
    async () => {
      const target = {
        type: "url" as const,
        url: "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
      };
      const inspection = await inspectMedia(target, dummyEnv);
      const chunk = await produceChunk(target, buildChunkPlan(inspection.durationSeconds, 1)[0]!, dummyEnv);
      expect(inspection.audioCodec).toBe("mp3");
      expect(chunk.mimeType).toBe("audio/mpeg");
      expect(chunk.bytes.byteLength).toBeGreaterThan(1024);
    },
    60_000,
  );
});
