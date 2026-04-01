import { describe, expect, it } from "vitest";
import { buildChunkPlan } from "../../src/media/chunk-plan";
import { inspectMedia } from "../../src/media/inspect";
import { produceChunk } from "../../src/media/packet-segmenter";
import { createTestEnv, seedSample } from "../helpers/in-memory";

describe("MediaBunny packet-copy path", () => {
  it("probes metadata and generates chunks for an MP4 input", async () => {
    const env = createTestEnv();
    await seedSample(env, "samples/video.mp4", "./samples/sample-video.mp4", "video/mp4");
    const inspection = await inspectMedia({ type: "r2", key: "samples/video.mp4" }, env);
    const plan = buildChunkPlan(inspection.durationSeconds, 2);
    const chunks = await Promise.all(
      plan.map((chunk) => produceChunk({ type: "r2", key: "samples/video.mp4" }, chunk, env)),
    );

    expect(inspection.audioCodec).toBe("aac");
    expect(chunks[0]?.mimeType).toBe("audio/mp4");
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.actualStartSeconds)).toEqual(
      [...chunks.map((chunk) => chunk.actualStartSeconds)].sort((a, b) => a - b),
    );
  });

  it("probes metadata and generates chunks for an audio-only MP3 input", async () => {
    const env = createTestEnv();
    await seedSample(env, "samples/audio.mp3", "./samples/sample-audio.mp3", "audio/mpeg");
    const inspection = await inspectMedia({ type: "r2", key: "samples/audio.mp3" }, env);
    const chunk = await produceChunk(
      { type: "r2", key: "samples/audio.mp3" },
      buildChunkPlan(inspection.durationSeconds, 1)[0]!,
      env,
    );

    expect(inspection.audioCodec).toBe("mp3");
    expect(chunk.mimeType).toBe("audio/mpeg");
    expect(chunk.bytes.byteLength).toBeGreaterThan(1024);
  });
});
