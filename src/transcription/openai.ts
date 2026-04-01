import type { ChunkTranscript, ProducedChunk, TranscriptSegment } from "../types";
import { randomHex } from "../util";

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

type OpenAiVerboseResponse = {
  text?: string;
  language?: string;
  segments?: Array<{
    id?: number;
    start?: number;
    end?: number;
    text?: string;
  }>;
};

type OpenAiProviderOptions = {
  apiKey: string;
  model: string;
  language?: string;
};

export async function transcribeChunkWithOpenAi(
  chunk: ProducedChunk,
  options: OpenAiProviderOptions,
): Promise<ChunkTranscript> {
  const form = new FormData();
  form.set("model", options.model);
  form.set("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (options.language) {
    form.set("language", options.language);
  }
  form.set(
    "file",
    new File([arrayBufferFromBytes(chunk.bytes)], chunk.fileName, {
      type: chunk.mimeType,
    }),
  );

  const startedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "X-Client-Request-Id": `boris-${randomHex(8)}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI transcription failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as OpenAiVerboseResponse;
  const baseSegments = payload.segments ?? [];
  const segments: TranscriptSegment[] = baseSegments
    .filter((segment) => typeof segment.text === "string")
    .map((segment, index) => ({
      id: `${chunk.index}-${segment.id ?? index}`,
      start: chunk.actualStartSeconds + (segment.start ?? 0),
      end: chunk.actualStartSeconds + (segment.end ?? segment.start ?? 0),
      text: (segment.text ?? "").trim(),
      chunkIndex: chunk.index,
    }))
    .filter(
      (segment) =>
        segment.end > chunk.requestedStartSeconds &&
        segment.start < chunk.requestedEndSeconds &&
        segment.text.length > 0,
    )
    .map((segment) => ({
      ...segment,
      start: Math.max(segment.start, chunk.requestedStartSeconds),
      end: Math.min(segment.end, chunk.requestedEndSeconds),
    }));

  return {
    chunk,
    text: payload.text?.trim() ?? segments.map((segment) => segment.text).join(" ").trim(),
    segments,
    language: payload.language,
    latencyMs: Date.now() - startedAt,
  };
}
