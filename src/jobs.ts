import { ulid } from "ulid";
import {
  CAPABILITY_NAME,
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
  MANIFEST_VERSION,
} from "./constants";
import { decryptSecret, encryptSecret } from "./crypto";
import { logError, logInfo } from "./logger";
import { buildManifest } from "./manifest";
import { buildChunkPlan } from "./media/chunk-plan";
import { inspectMedia } from "./media/inspect";
import { produceChunk } from "./media/packet-segmenter";
import { getKeyRecord, getJob, patchJob, putJob, putKeyRecord } from "./state-client";
import { transcriptionRequestSchema } from "./schema";
import { transcribeChunkWithOpenAi } from "./transcription/openai";
import { mergeTranscripts, toArtifactMetadata } from "./transcript-merge";
import type { JobRecord, JobRequest, QueueMessage } from "./types";
import { clampParallelism, nowIso, runWithConcurrency, sleep } from "./util";

type BorisEnv = {
  BORIS_BUCKET: R2Bucket;
  BORIS_CAPABILITY?: string;
  BORIS_STATE: DurableObjectNamespace;
  DEFAULT_OPENAI_TRANSCRIPTION_MODEL?: string;
  KEY_ENCRYPTION_SECRET: string;
  MAX_SOURCE_BYTES?: string;
  TRANSCRIPTION_QUEUE: Queue<QueueMessage>;
};

export async function createStoredProviderKey(
  env: Pick<BorisEnv, "BORIS_STATE" | "KEY_ENCRYPTION_SECRET">,
  apiKey: string,
  label?: string,
): Promise<string> {
  const ref = `key_${ulid().toLowerCase()}`;
  const encrypted = await encryptSecret(apiKey, env.KEY_ENCRYPTION_SECRET);
  await putKeyRecord(env, {
    ref,
    provider: "openai",
    createdAt: nowIso(),
    label,
    ...encrypted,
  });
  return ref;
}

export async function createJobFromRequest(
  env: BorisEnv,
  payload: unknown,
): Promise<JobRecord> {
  const parsed = transcriptionRequestSchema.parse(payload);
  const transcriptionApiKeyRef =
    parsed.transcriptionApiKeyRef ??
    (await createStoredProviderKey(env, parsed.transcriptionApiKey!, "ephemeral-job-key"));

  const jobId = `job_${ulid().toLowerCase()}`;
  const createdAt = nowIso();
  const request: JobRequest = {
    transcriptionProvider: parsed.transcriptionProvider,
    transcriptionApiKeyRef,
    target: parsed.target,
    options: {
      ...parsed.options,
      parallelism: clampParallelism(parsed.options.parallelism),
    },
  };

  const job: JobRecord = {
    id: jobId,
    capability: CAPABILITY_NAME,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    request,
    artifacts: [],
    metrics: {
      workerRuntime: "workerd",
    },
  };

  await putJob(env, job);
  await env.TRANSCRIPTION_QUEUE.send({ jobId });
  return job;
}

async function resolveProviderApiKey(
  env: Pick<BorisEnv, "BORIS_STATE" | "KEY_ENCRYPTION_SECRET">,
  ref: string,
): Promise<string> {
  const record = await getKeyRecord(env, ref);
  return decryptSecret(record.encrypted, record.iv, env.KEY_ENCRYPTION_SECRET);
}

async function transcribeChunkWithRetries(
  job: JobRecord,
  chunkPromise: ReturnType<typeof produceChunk>,
  apiKey: string,
  model: string,
  chunkRetries: { count: number },
): Promise<Awaited<ReturnType<typeof transcribeChunkWithOpenAi>>> {
  const chunk = await chunkPromise;
  let attempt = 0;
  while (true) {
    try {
      return await transcribeChunkWithOpenAi(chunk, {
        apiKey,
        model,
        language: job.request.options.language,
      });
    } catch (error) {
      attempt += 1;
      chunkRetries.count += 1;
      if (attempt >= 3) {
        throw error;
      }
      await sleep(attempt * 300);
    }
  }
}

export async function processJobMessage(
  env: BorisEnv,
  message: QueueMessage,
): Promise<void> {
  const startedAt = Date.now();
  const job = await getJob(env, message.jobId);
  await patchJob(env, job.id, {
    status: "processing",
    updatedAt: nowIso(),
  });

  try {
    const apiKey = await resolveProviderApiKey(env, job.request.transcriptionApiKeyRef);
    const model = env.DEFAULT_OPENAI_TRANSCRIPTION_MODEL ?? DEFAULT_OPENAI_TRANSCRIPTION_MODEL;
    const inspection = await inspectMedia(job.request.target, env);
    const plan = buildChunkPlan(
      inspection.durationSeconds,
      job.request.options.chunking.maxChunkSeconds,
    );
    const chunkResults: Awaited<ReturnType<typeof transcribeChunkWithOpenAi>>[] = [];
    const retryCounter = { count: 0 };

    await runWithConcurrency(plan, job.request.options.parallelism, async (chunkPlan) => {
      const result = await transcribeChunkWithRetries(
        job,
        produceChunk(job.request.target, chunkPlan, env),
        apiKey,
        model,
        retryCounter,
      );
      chunkResults.push(result);
    });

    const artifacts = mergeTranscripts(chunkResults);
    for (const file of artifacts.files) {
      await env.BORIS_BUCKET.put(`jobs/${job.id}/artifacts/${file.name}`, file.bytes, {
        httpMetadata: {
          contentType: file.contentType,
        },
      });
    }

    await patchJob(env, job.id, {
      status: "succeeded",
      updatedAt: nowIso(),
      artifacts: toArtifactMetadata(job.id, artifacts.files),
      metrics: {
        sourceDurationSeconds: inspection.durationSeconds,
        chunkCount: plan.length,
        providerLatencyMs: chunkResults.reduce((sum, chunk) => sum + chunk.latencyMs, 0),
        retries: retryCounter.count,
        elapsedMs: Date.now() - startedAt,
        workerRuntime: "workerd",
      },
      result: {
        text: artifacts.text,
        language: artifacts.language,
      },
    });

    logInfo("Job completed", { jobId: job.id, chunkCount: plan.length });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    logError("Job failed", { jobId: job.id, error: messageText });
    await patchJob(env, job.id, {
      status: "failed",
      updatedAt: nowIso(),
      metrics: {
        ...job.metrics,
        elapsedMs: Date.now() - startedAt,
        workerRuntime: "workerd",
      },
      error: {
        taxonomy: messageText.includes("Codec") ? "runtime_capability_gap" : "unknown",
        message: messageText,
      },
    });
  }
}

export function buildBootstrapManifest() {
  return {
    manifest: buildManifest(),
    capability: CAPABILITY_NAME,
    manifestVersion: MANIFEST_VERSION,
  };
}
