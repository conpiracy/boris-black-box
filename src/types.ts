import type { CAPABILITY_NAME } from "./constants";

export type BorisCapability = typeof CAPABILITY_NAME;

export type TargetRef =
  | {
      type: "url";
      url: string;
    }
  | {
      type: "r2";
      key: string;
    };

export type ChunkingOptions = {
  mode: "mediabunny_segment";
  maxChunkSeconds: number;
  silenceAware: boolean;
};

export type TranscriptionOptions = {
  language?: string;
  chunking: ChunkingOptions;
  parallelism: number;
  returnFormat: "segments+srt+json" | "json";
};

export type JobRequest = {
  transcriptionProvider: "openai";
  transcriptionApiKeyRef: string;
  target: TargetRef;
  options: TranscriptionOptions;
};

export type JobStatus = "queued" | "processing" | "succeeded" | "failed";

export type FailureTaxonomy =
  | "validation_error"
  | "ingestion_error"
  | "unsupported_media"
  | "runtime_capability_gap"
  | "provider_error"
  | "storage_error"
  | "unknown";

export type ProviderKeyRecord = {
  ref: string;
  provider: "openai";
  encrypted: string;
  iv: string;
  createdAt: string;
  label?: string;
};

export type JobArtifact = {
  name: string;
  contentType: string;
  key: string;
  size: number;
};

export type JobMetrics = {
  sourceBytes?: number;
  sourceDurationSeconds?: number;
  chunkCount?: number;
  providerLatencyMs?: number;
  retries?: number;
  elapsedMs?: number;
  workerRuntime: "node" | "workerd";
};

export type JobRecord = {
  id: string;
  capability: BorisCapability;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  request: JobRequest;
  artifacts: JobArtifact[];
  metrics: JobMetrics;
  result?: {
    text: string;
    language?: string;
  };
  error?: {
    taxonomy: FailureTaxonomy;
    message: string;
  };
};

export type PublicJobRecord = Omit<JobRecord, "request"> & {
  request: Omit<JobRequest, "transcriptionApiKeyRef">;
};

export type QueueMessage = {
  jobId: string;
};

export type MediaInspection = {
  mimeType: string;
  durationSeconds: number;
  audioCodec: string;
  hasVideo: boolean;
  trackCount: number;
};

export type ChunkPlan = {
  index: number;
  requestedStartSeconds: number;
  requestedEndSeconds: number;
};

export type ProducedChunk = {
  index: number;
  requestedStartSeconds: number;
  requestedEndSeconds: number;
  actualStartSeconds: number;
  actualEndSeconds: number;
  mimeType: string;
  fileName: string;
  bytes: Uint8Array;
};

export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  chunkIndex: number;
};

export type ChunkTranscript = {
  chunk: ProducedChunk;
  text: string;
  segments: TranscriptSegment[];
  language?: string;
  latencyMs: number;
};

export type ManifestRecord = {
  refreshedAt: string;
  manifestVersion: string;
  capability: BorisCapability;
  targetRuntime: "cloudflare-workers";
  chunkingMode: "mediabunny_segment";
  provenCodecs: string[];
  notes: string[];
};
