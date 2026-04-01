# Vercel Handoff

## Why This Exists

The codebase already proves the Boris core logic, but the current runtime surface is Cloudflare-specific. Cloudflare deployment on this machine was blocked by account-level R2 enablement. The next operator should finish the product on Vercel instead of spending more time on the blocked Cloudflare path.

## What To Preserve

Do not change these:

- capability name: `media.transcribe.parallel.v1`
- API contract:
  - `POST /v1/bootstrap`
  - `POST /v1/manifest/refresh`
  - `POST /v1/transcriptions`
  - `GET /v1/transcriptions/:id`
  - `GET /v1/transcriptions/:id/artifacts/:name`
- public chunking mode: `mediabunny_segment`
- private orchestration boundary
- encrypted stored provider key refs

## What Can Be Reused Directly

High-value reusable logic already exists:

- schemas: [src/schema.ts](/home/corp/dev/blackbox/src/schema.ts)
- orchestration rules: [src/jobs.ts](/home/corp/dev/blackbox/src/jobs.ts)
- media probing and chunking: [src/media](/home/corp/dev/blackbox/src/media)
- provider adapter: [src/transcription/openai.ts](/home/corp/dev/blackbox/src/transcription/openai.ts)
- transcript merge and artifact generation: [src/transcript-merge.ts](/home/corp/dev/blackbox/src/transcript-merge.ts)
- auth and redaction helpers: [src/auth.ts](/home/corp/dev/blackbox/src/auth.ts), [src/logger.ts](/home/corp/dev/blackbox/src/logger.ts)

Treat the current platform glue as replaceable:

- [src/worker.ts](/home/corp/dev/blackbox/src/worker.ts)
- [src/state-client.ts](/home/corp/dev/blackbox/src/state-client.ts)
- [src/state-do.ts](/home/corp/dev/blackbox/src/state-do.ts)
- [alchemy.run.ts](/home/corp/dev/blackbox/alchemy.run.ts)

## Recommended Vercel Architecture

### Runtime

Use Vercel Node.js Functions, not Edge Functions. The media and multipart work fit Node better, and the current code already assumes richer runtime capabilities.

### Storage

Default:

- input media and transcript artifacts: Vercel Blob private store

Fallback:

- AWS S3 or another S3-compatible bucket if Blob proves to be the wrong fit for file size, streaming, or operator preference

### State

Use Postgres for:

- jobs
- manifest
- stored provider key refs
- chunk attempt records if needed

Current Vercel docs state that new Postgres projects should use a Marketplace integration rather than the retired built-in Vercel Postgres product. In practice, Neon is the default simplest choice.

### Background Processing

Vercel does not give you Cloudflare Queues. Do this instead:

1. `POST /v1/transcriptions` writes a `queued` job row.
2. The handler immediately kicks an internal processing route using `waitUntil()`.
3. The processing route locks the job row, loads the source, probes the media, generates chunks, transcribes in parallel, writes artifacts, and updates the job row.
4. A cron route sweeps for stale `queued` or `processing` jobs and retries them.

Important constraint:

- Vercel’s `waitUntil()` work shares the function timeout. Use it to trigger work, not to pretend the system has a durable queue.
- If real-world tests show duration or reliability problems, add a queue product at that point. Do not do it before the direct path is proven.

## Suggested File Plan

Suggested target layout:

- `api/v1/bootstrap.ts`
- `api/v1/manifest/refresh.ts`
- `api/v1/transcriptions.ts`
- `api/v1/transcriptions/[id].ts`
- `api/v1/transcriptions/[id]/artifacts/[name].ts`
- `api/internal/process-job.ts`
- `api/internal/recover-stalled.ts`
- `src/platform/vercel/blob.ts`
- `src/platform/vercel/db.ts`
- `src/platform/vercel/jobs.ts`

Keep the existing shared logic in `src/` and route into it through adapters.

## Data Model

Minimum tables:

- `jobs`
  - `id`
  - `capability`
  - `status`
  - `request_json`
  - `result_json`
  - `error_json`
  - `metrics_json`
  - `created_at`
  - `updated_at`
  - `lease_owner`
  - `lease_expires_at`
- `provider_keys`
  - `ref`
  - `provider`
  - `label`
  - `encrypted`
  - `iv`
  - `created_at`
- `manifest_snapshots`
  - `manifest_version`
  - `body_json`
  - `created_at`

## Storage Mapping

Use Blob paths equivalent to the current R2 layout:

- `uploads/<random>-<filename>`
- `jobs/<jobId>/artifacts/transcript.txt`
- `jobs/<jobId>/artifacts/transcript.srt`
- `jobs/<jobId>/artifacts/transcript.json`

## Operator Env Vars

Minimum runtime set:

- `BORIS_API_TOKEN`
- `BORIS_OPERATOR_TOKEN`
- `KEY_ENCRYPTION_SECRET`
- `CRON_SECRET`
- Blob token or project-linked Blob store envs
- Postgres connection string envs

Optional:

- default provider model override

## Vercel CLI Sequence

Use the official Vercel CLI docs as the source of truth. The practical sequence should be:

```bash
npm i -g vercel
vercel login
vercel link
vercel env add BORIS_API_TOKEN production
vercel env add BORIS_OPERATOR_TOKEN production
vercel env add KEY_ENCRYPTION_SECRET production
vercel env add CRON_SECRET production
vercel blob create-store boris-black-box --access private --region iad1
vercel deploy --prod
```

If the database integration is created outside the CLI, finish by binding the resulting connection string(s) with `vercel env add`.

## Verification Requirement

Before calling the migration done:

1. Deploy the Vercel build.
2. Set the API and operator tokens.
3. Run the smoke test against `https://samplelib.com/lib/preview/mp4/sample-5s.mp4`.
4. Repeat three times.
5. Retrieve `transcript.txt` each time.
6. Update [README.md](/home/corp/dev/blackbox/README.md) with the public deployment URL.

## Official References

- Vercel CLI overview: https://vercel.com/docs/cli
- `vercel deploy`: https://vercel.com/docs/cli/deploy
- `vercel env`: https://vercel.com/docs/cli/env
- `vercel blob`: https://vercel.com/docs/cli/blob
- Vercel Blob: https://vercel.com/docs/vercel-blob
- `@vercel/functions` and `waitUntil()`: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
- Vercel function limits: https://vercel.com/docs/functions/limitations
- Function duration config: https://vercel.com/docs/functions/configuring-functions/duration
- Vercel cron jobs: https://vercel.com/docs/cron-jobs
- Postgres on Vercel: https://vercel.com/docs/postgres
