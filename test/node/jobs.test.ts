import { afterEach, describe, expect, it, vi } from "vitest";
import workerModule from "../../src/worker";
import { createJobFromRequest, processJobMessage } from "../../src/jobs";
import { getJob } from "../../src/state-client";
import { createTestEnv, seedSample } from "../helpers/in-memory";

const originalFetch = globalThis.fetch;

function mockOpenAiSequence(sequence: Array<Response | Error>) {
  let index = 0;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.includes("/audio/transcriptions")) {
      const next = sequence[index] ?? sequence[sequence.length - 1];
      index += 1;
      if (next instanceof Error) {
        throw next;
      }
      return next;
    }
    return originalFetch(input, init);
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("job orchestration", () => {
  it("retries chunk transcription and stores artifacts", async () => {
    const env = createTestEnv();
    await seedSample(env, "samples/video.mp4", "./samples/sample-video.mp4", "video/mp4");

    mockOpenAiSequence([
      new Error("temporary"),
      new Error("temporary"),
      new Response(
        JSON.stringify({
          text: "hello world",
          language: "en",
          segments: [{ start: 0, end: 1, text: "hello world" }],
        }),
        { status: 200 },
      ),
    ]);

    const job = await createJobFromRequest(env, {
      transcriptionProvider: "openai",
      transcriptionApiKey: "sk-test-1234567890",
      target: {
        type: "r2",
        key: "samples/video.mp4",
      },
      options: {
        language: "en",
        chunking: {
          mode: "mediabunny_segment",
          maxChunkSeconds: 10,
          silenceAware: false,
        },
        parallelism: 1,
        returnFormat: "segments+srt+json",
      },
    });

    await processJobMessage(env, { jobId: job.id });
    const stored = await getJob(env, job.id);
    expect(stored.status).toBe("succeeded");
    expect(stored.metrics.retries).toBe(2);
    expect(stored.artifacts.map((artifact) => artifact.name)).toContain("transcript.txt");
  });

  it("serves artifacts through the worker route for a real sample asset", async () => {
    const env = createTestEnv();
    await seedSample(env, "samples/video.mp4", "./samples/sample-video.mp4", "video/mp4");

    mockOpenAiSequence([
      new Response(
        JSON.stringify({
          text: "real sample transcript",
          language: "en",
          segments: [{ start: 0, end: 1, text: "real sample transcript" }],
        }),
        { status: 200 },
      ),
    ]);

    const job = await createJobFromRequest(env, {
      transcriptionProvider: "openai",
      transcriptionApiKey: "sk-test-1234567890",
      target: {
        type: "r2",
        key: "samples/video.mp4",
      },
      options: {
        language: "en",
        chunking: {
          mode: "mediabunny_segment",
          maxChunkSeconds: 10,
          silenceAware: false,
        },
        parallelism: 1,
        returnFormat: "segments+srt+json",
      },
    });

    await processJobMessage(env, { jobId: job.id });

    const response = await workerModule.fetch(
      new Request(`https://boris.test/v1/transcriptions/${job.id}/artifacts/transcript.txt`, {
        headers: {
          Authorization: "Bearer test-api-token",
        },
      }),
      env as never,
      {
        waitUntil() {},
        passThroughOnException() {},
      } as unknown as ExecutionContext,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("real sample transcript");
  });
});
