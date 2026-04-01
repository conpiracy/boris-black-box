import { inspectMedia } from "../src/media/inspect";
import { buildChunkPlan } from "../src/media/chunk-plan";
import { produceChunk } from "../src/media/packet-segmenter";

class LocalR2Object {
  constructor(readonly bytes: Uint8Array, readonly contentType: string) {}

  get size(): number {
    return this.bytes.byteLength;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.bytes.buffer.slice(
      this.bytes.byteOffset,
      this.bytes.byteOffset + this.bytes.byteLength,
    ) as ArrayBuffer;
  }
}

class LocalR2Bucket {
  private readonly objects = new Map<string, LocalR2Object>();

  async put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
    this.objects.set(key, new LocalR2Object(value, options?.httpMetadata?.contentType ?? "application/octet-stream"));
  }

  async head(key: string) {
    return this.objects.get(key) ?? null;
  }

  async get(key: string, options?: { range?: { offset: number; length: number } }) {
    const object = this.objects.get(key);
    if (!object) {
      return null;
    }
    if (!options?.range) {
      return object;
    }
    const { offset, length } = options.range;
    const sliced = object.bytes.slice(offset, offset + length);
    return new LocalR2Object(sliced, object.contentType);
  }
}

const bucket = new LocalR2Bucket();

await bucket.put("samples/video.mp4", new Uint8Array(await Bun.file("./samples/sample-video.mp4").arrayBuffer()), {
  httpMetadata: { contentType: "video/mp4" },
});
await bucket.put("samples/audio.mp3", new Uint8Array(await Bun.file("./samples/sample-audio.mp3").arrayBuffer()), {
  httpMetadata: { contentType: "audio/mpeg" },
});

const env = {
  BORIS_BUCKET: bucket as unknown as R2Bucket,
};

for (const target of [
  { type: "r2" as const, key: "samples/video.mp4" },
  { type: "r2" as const, key: "samples/audio.mp3" },
]) {
  const inspection = await inspectMedia(target, env);
  const chunk = await produceChunk(target, buildChunkPlan(inspection.durationSeconds, 2)[0]!, env);
  console.log(
    JSON.stringify({
      target,
      inspection,
      producedChunk: {
        bytes: chunk.bytes.byteLength,
        mimeType: chunk.mimeType,
        requestedStartSeconds: chunk.requestedStartSeconds,
        requestedEndSeconds: chunk.requestedEndSeconds,
      },
    }),
  );
}
