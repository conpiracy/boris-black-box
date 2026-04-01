import { CAPABILITY_NAME, MANIFEST_VERSION, PROVEN_AUDIO_CODECS } from "./constants";
import type { ManifestRecord } from "./types";
import { nowIso } from "./util";

export function buildManifest(): ManifestRecord {
  return {
    refreshedAt: nowIso(),
    manifestVersion: MANIFEST_VERSION,
    capability: CAPABILITY_NAME,
    targetRuntime: "cloudflare-workers",
    chunkingMode: "mediabunny_segment",
    provenCodecs: [...PROVEN_AUDIO_CODECS],
    notes: [
      "MediaBunny packet-level segmenting is the default path for proven codecs.",
      "Packet-copy segmentation is proven for AAC-in-MP4 and MP3 inputs.",
      "MediaBunny Conversion trimming on this runtime discarded undecodable AAC/AVC sources, so it is not used for production chunking.",
      "Fallback compute remains a documented boundary for codecs outside the proven matrix.",
    ],
  };
}
