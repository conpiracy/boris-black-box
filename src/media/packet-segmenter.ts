import {
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Output,
} from "mediabunny";
import type { ChunkPlan, ProducedChunk, TargetRef } from "../types";
import { getOutputDescriptor } from "./output-format";
import { openMediaInput } from "./input";

type EnvWithBucket = {
  BORIS_BUCKET: R2Bucket;
};

export async function produceChunk(
  target: TargetRef,
  chunk: ChunkPlan,
  env: EnvWithBucket,
): Promise<ProducedChunk> {
  const input = await openMediaInput(target, env);
  try {
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack || !audioTrack.codec) {
      throw new Error("No audio track detected.");
    }

    const descriptor = getOutputDescriptor(audioTrack.codec);
    const sink = new EncodedPacketSink(audioTrack);
    const firstPacket = await sink.getPacket(chunk.requestedStartSeconds, { verifyKeyPackets: false });
    if (!firstPacket) {
      throw new Error("Unable to locate the first audio packet for the requested chunk.");
    }

    const source = new EncodedAudioPacketSource(audioTrack.codec);
    const output = new Output({
      format: descriptor.format,
      target: new BufferTarget(),
    });
    output.addAudioTrack(source);
    await output.start();

    const decoderConfig = await audioTrack.getDecoderConfig();
    let packet: typeof firstPacket | null = firstPacket;
    let first = true;
    let lastEnd = firstPacket.timestamp;

    while (packet && packet.timestamp < chunk.requestedEndSeconds) {
      await source.add(
        packet.clone({
          timestamp: Math.max(0, packet.timestamp - firstPacket.timestamp),
        }),
        first ? { decoderConfig: decoderConfig ?? undefined } : undefined,
      );
      first = false;
      lastEnd = packet.timestamp + packet.duration;
      packet = await sink.getNextPacket(packet, { verifyKeyPackets: false });
    }

    await output.finalize();
    if (!output.target.buffer) {
      throw new Error("MediaBunny output buffer was empty.");
    }

    return {
      index: chunk.index,
      requestedStartSeconds: chunk.requestedStartSeconds,
      requestedEndSeconds: chunk.requestedEndSeconds,
      actualStartSeconds: firstPacket.timestamp,
      actualEndSeconds: lastEnd,
      mimeType: descriptor.contentType,
      fileName: `chunk-${chunk.index.toString().padStart(4, "0")}${descriptor.fileExtension}`,
      bytes: new Uint8Array(output.target.buffer),
    };
  } finally {
    input.dispose();
  }
}
