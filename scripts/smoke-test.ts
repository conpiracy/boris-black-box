export {};

const baseUrl = process.env.BORIS_BASE_URL;
const apiToken = process.env.BORIS_API_TOKEN;
const openAiApiKey = process.env.OPENAI_API_KEY;
const runs = Number.parseInt(process.env.SMOKE_RUNS ?? "3", 10);
const sampleUrl = process.env.SMOKE_SAMPLE_URL ?? "https://samplelib.com/lib/preview/mp4/sample-5s.mp4";

type SubmittedJob = {
  id: string;
};

type PolledJob = {
  status: "queued" | "processing" | "succeeded" | "failed";
};

if (!baseUrl || !apiToken || !openAiApiKey) {
  throw new Error("BORIS_BASE_URL, BORIS_API_TOKEN, and OPENAI_API_KEY are required.");
}

async function waitForJob(jobId: string): Promise<PolledJob> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/transcriptions/${jobId}`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });
    const job = (await response.json()) as PolledJob;
    if (job.status === "succeeded" || job.status === "failed") {
      return job;
    }
    await Bun.sleep(1000);
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

for (let run = 0; run < runs; run += 1) {
  const response = await fetch(`${baseUrl}/v1/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      transcriptionProvider: "openai",
      transcriptionApiKey: openAiApiKey,
      target: {
        type: "url",
        url: sampleUrl,
      },
      options: {
        language: "en",
        chunking: {
          mode: "mediabunny_segment",
          maxChunkSeconds: 2,
          silenceAware: false,
        },
        parallelism: 3,
        returnFormat: "segments+srt+json",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Submit failed: ${response.status} ${await response.text()}`);
  }

  const submitted = (await response.json()) as SubmittedJob;
  const job = await waitForJob(submitted.id);
  if (job.status !== "succeeded") {
    throw new Error(`Smoke run ${run + 1} failed: ${JSON.stringify(job)}`);
  }

  const artifact = await fetch(
    `${baseUrl}/v1/transcriptions/${submitted.id}/artifacts/transcript.txt`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    },
  );
  if (!artifact.ok) {
    throw new Error(`Artifact fetch failed for run ${run + 1}`);
  }

  console.log(
    JSON.stringify({
      run: run + 1,
      jobId: submitted.id,
      status: job.status,
      transcriptPreview: (await artifact.text()).slice(0, 120),
    }),
  );
}
