import { JOB_ARTIFACT_NAMES } from "./constants";
import type { ChunkTranscript, JobArtifact, TranscriptSegment } from "./types";
import { formatSrtTimestamp, stableSortByStart } from "./util";

export type TranscriptArtifacts = {
  text: string;
  language?: string;
  segments: TranscriptSegment[];
  files: Array<{
    name: string;
    contentType: string;
    bytes: Uint8Array;
  }>;
};

function toUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function mergeTranscripts(chunks: ChunkTranscript[]): TranscriptArtifacts {
  const ordered = [...chunks].sort((left, right) => left.chunk.index - right.chunk.index);
  const segments = stableSortByStart(ordered.flatMap((chunk) => chunk.segments));
  const text = segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim();
  const language = ordered.find((chunk) => chunk.language)?.language;
  const srt = segments
    .map(
      (segment, index) =>
        `${index + 1}\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}\n${segment.text}\n`,
    )
    .join("\n");
  const files = [
    {
      name: JOB_ARTIFACT_NAMES.transcriptJson,
      contentType: "application/json; charset=utf-8",
      bytes: toUtf8(JSON.stringify({ text, language, segments }, null, 2)),
    },
    {
      name: JOB_ARTIFACT_NAMES.segmentsJson,
      contentType: "application/json; charset=utf-8",
      bytes: toUtf8(JSON.stringify(segments, null, 2)),
    },
    {
      name: JOB_ARTIFACT_NAMES.transcriptSrt,
      contentType: "application/x-subrip; charset=utf-8",
      bytes: toUtf8(srt),
    },
    {
      name: JOB_ARTIFACT_NAMES.transcriptTxt,
      contentType: "text/plain; charset=utf-8",
      bytes: toUtf8(text),
    },
  ];

  return {
    text,
    language,
    segments,
    files,
  };
}

export function toArtifactMetadata(jobId: string, files: TranscriptArtifacts["files"]): JobArtifact[] {
  return files.map((file) => ({
    name: file.name,
    contentType: file.contentType,
    key: `jobs/${jobId}/artifacts/${file.name}`,
    size: file.bytes.byteLength,
  }));
}
