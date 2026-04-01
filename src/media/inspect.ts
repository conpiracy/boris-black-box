import type { MediaInspection, TargetRef } from "../types";
import { openMediaInput } from "./input";

type EnvWithBucket = {
  BORIS_BUCKET: R2Bucket;
};

export async function inspectMedia(target: TargetRef, env: EnvWithBucket): Promise<MediaInspection> {
  const input = await openMediaInput(target, env);
  try {
    const mimeType = await input.getMimeType();
    const durationSeconds = await input.computeDuration();
    const tracks = await input.getTracks();
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack || !audioTrack.codec) {
      throw new Error("No audio track detected.");
    }
    return {
      mimeType,
      durationSeconds,
      audioCodec: audioTrack.codec,
      hasVideo: (await input.getPrimaryVideoTrack()) !== null,
      trackCount: tracks.length,
    };
  } finally {
    input.dispose();
  }
}
