import { DEFAULT_MAX_CHUNK_SECONDS } from "../constants";
import type { ChunkPlan } from "../types";

export function buildChunkPlan(durationSeconds: number, maxChunkSeconds = DEFAULT_MAX_CHUNK_SECONDS): ChunkPlan[] {
  if (durationSeconds <= 0) {
    return [{ index: 0, requestedStartSeconds: 0, requestedEndSeconds: 0 }];
  }

  const plan: ChunkPlan[] = [];
  let start = 0;
  let index = 0;

  while (start < durationSeconds) {
    const end = Math.min(durationSeconds, start + maxChunkSeconds);
    plan.push({
      index,
      requestedStartSeconds: start,
      requestedEndSeconds: end,
    });
    start = end;
    index += 1;
  }

  return plan;
}
