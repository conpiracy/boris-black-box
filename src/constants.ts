export const CAPABILITY_NAME = "media.transcribe.parallel.v1";
export const MANIFEST_VERSION = "2026-04-01";
export const STATE_OBJECT_NAME = "boris-state";
export const DEFAULT_MAX_SOURCE_BYTES = 200 * 1024 * 1024;
export const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
export const DEFAULT_MAX_CHUNK_SECONDS = 60;
export const DEFAULT_PARALLELISM = 4;
export const MAX_PARALLELISM = 8;
export const DIRECT_UPLOAD_EXPIRY_SECONDS = 3600;
export const SUPPORTED_MEDIA_PREFIXES = ["audio/", "video/"] as const;
export const PROVEN_AUDIO_CODECS = ["aac", "mp3"] as const;
export const JOB_ARTIFACT_NAMES = {
  transcriptJson: "transcript.json",
  segmentsJson: "segments.json",
  transcriptSrt: "transcript.srt",
  transcriptTxt: "transcript.txt",
} as const;
