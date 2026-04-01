import alchemy from "alchemy";
import { DurableObjectNamespace, Queue, R2Bucket, Worker } from "alchemy/cloudflare";

const app = await alchemy("boris-black-box");

const transcriptionQueue = await Queue<{ jobId: string }>("transcriptions", {
  name: "boris-black-box-transcriptions",
});

const borisBucket = await R2Bucket("boris-bucket", {
  name: "boris-black-box",
});

const state = DurableObjectNamespace("boris-state", {
  className: "BorisState",
  sqlite: true,
});

export const worker = await Worker("api", {
  entrypoint: "./src/worker.ts",
  url: true,
  compatibilityDate: "2026-04-01",
  compatibilityFlags: ["nodejs_compat"],
  limits: {
    cpu_ms: 300_000,
  },
  observability: {
    enabled: true,
  },
  eventSources: [transcriptionQueue],
  bindings: {
    BORIS_BUCKET: borisBucket,
    BORIS_BUCKET_NAME: "boris-black-box",
    BORIS_STATE: state,
    TRANSCRIPTION_QUEUE: transcriptionQueue,
    BORIS_CAPABILITY: "media.transcribe.parallel.v1",
    DEFAULT_OPENAI_TRANSCRIPTION_MODEL:
      process.env.DEFAULT_OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe",
    MAX_SOURCE_BYTES: process.env.MAX_SOURCE_BYTES ?? String(200 * 1024 * 1024),
    BORIS_API_TOKEN: alchemy.secret(process.env.BORIS_API_TOKEN ?? "local-api-token"),
    BORIS_OPERATOR_TOKEN: alchemy.secret(
      process.env.BORIS_OPERATOR_TOKEN ?? "local-operator-token",
    ),
    KEY_ENCRYPTION_SECRET: alchemy.secret(
      process.env.KEY_ENCRYPTION_SECRET ?? "local-dev-only-encryption-secret",
    ),
    R2_ACCESS_KEY_ID: alchemy.secret(process.env.R2_ACCESS_KEY_ID ?? ""),
    R2_SECRET_ACCESS_KEY: alchemy.secret(process.env.R2_SECRET_ACCESS_KEY ?? ""),
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  },
});

console.log({ workerUrl: worker.url });
await app.finalize();
