# AGENT.md

This repository is a handoff point. The current code is a validated Cloudflare reference implementation. Your job is to finish the product on Vercel without changing the Boris thesis.

## Mission

Ship a live deployment of `media.transcribe.parallel.v1` on Vercel while preserving:

- the narrow public API contract
- MediaBunny-first chunk generation
- hidden orchestration
- encrypted stored provider key references
- parallel chunk transcription
- canonical transcript artifacts

Do not stop at scaffolding. Finish the deployment, run the smoke test three times against a real sample asset, and leave the repo documented for the next operator.

## Non-Negotiables

- Keep `mediabunny_segment` as the default chunking mode.
- Prefer MediaBunny packet-copy chunking over decode/re-encode paths.
- Do not expose chunk plans, internal retries, or orchestration details in the public API.
- Keep raw provider keys out of logs.
- Do not bind any bootstrap or provisioning credential into runtime request handling.

## Ground Truth

Already proven locally:

- MP4 sample with AAC audio in MP4 works with MediaBunny packet-copy chunking.
- MP3 sample works with MediaBunny packet-copy chunking.
- MediaBunny `Conversion` trim is not the trusted path for the tested AAC/AVC runtime.
- Request validation, merge logic, redaction, and artifact retrieval are implemented and tested.

Read these first:

- [README.md](/home/corp/dev/blackbox/README.md)
- [ARCHITECTURE.md](/home/corp/dev/blackbox/ARCHITECTURE.md)
- [docs/VERCEL_HANDOFF.md](/home/corp/dev/blackbox/docs/VERCEL_HANDOFF.md)
- [docs/COMPATIBILITY_FINDINGS.md](/home/corp/dev/blackbox/docs/COMPATIBILITY_FINDINGS.md)
- [docs/END_USER_GUIDE.md](/home/corp/dev/blackbox/docs/END_USER_GUIDE.md)

## Recommended Vercel Target

Use plain Vercel Node.js Functions instead of introducing a large framework unless there is a clear payoff.

Target shape:

- `api/v1/bootstrap`
- `api/v1/manifest/refresh`
- `api/v1/transcriptions`
- `api/v1/transcriptions/[id]`
- `api/v1/transcriptions/[id]/artifacts/[name]`
- `api/internal/process-job`
- `api/internal/recover-stalled`

Storage and state:

- object storage: Vercel Blob private store by default
- relational state: Postgres through a Vercel Marketplace integration such as Neon
- runtime config and secrets: Vercel project env vars

Background execution:

- `POST /v1/transcriptions` should create the job row and return `202`
- kick processing immediately with `waitUntil(fetch(internal-process-route))`
- keep a durable DB job state so the system can recover from dropped invocations
- add a Vercel cron route to requeue or recover stale `queued` and `processing` jobs
- if Vercel function duration proves insufficient for the real path, then add an external queue, but prove the direct path first

## Porting Rule

Do not rewrite all business logic. Reuse and adapt:

- [src/schema.ts](/home/corp/dev/blackbox/src/schema.ts)
- [src/jobs.ts](/home/corp/dev/blackbox/src/jobs.ts)
- [src/media](/home/corp/dev/blackbox/src/media)
- [src/transcription/openai.ts](/home/corp/dev/blackbox/src/transcription/openai.ts)
- [src/transcript-merge.ts](/home/corp/dev/blackbox/src/transcript-merge.ts)
- [src/logger.ts](/home/corp/dev/blackbox/src/logger.ts)

Replace only the platform adapters:

- Cloudflare bucket access
- Durable Object state client
- queue dispatch
- Cloudflare bootstrap upload logic

## Execution Order

1. Read the docs above.
2. Keep the contract fixed.
3. Add Vercel platform adapters.
4. Port the HTTP routes.
5. Port background job dispatch.
6. Wire Blob and Postgres.
7. Deploy with Vercel CLI.
8. Run `npm run smoke` three times with the sample MP4.
9. Update docs with the final production URL and exact commands used.

## Vercel CLI Baseline

Use current Vercel CLI docs, then execute:

```bash
npm i -g vercel
vercel login
vercel link
vercel env add BORIS_API_TOKEN production
vercel env add BORIS_OPERATOR_TOKEN production
vercel env add KEY_ENCRYPTION_SECRET production
vercel blob create-store boris-black-box --access private --region iad1
vercel deploy --prod
```

If Postgres cannot be provisioned entirely through Vercel CLI in the current environment, provision Neon separately and bind its connection string with `vercel env add`.

## Required End State

Do not stop until all of these are true:

- public deployment URL exists
- sample asset succeeds three times
- transcript artifact retrieval works
- docs contain operator handoff and end-user explanation
- secrets are not committed

## Sources For Current Vercel Assumptions

- Vercel CLI overview: https://vercel.com/docs/cli
- `vercel env`: https://vercel.com/docs/cli/env
- `vercel blob`: https://vercel.com/docs/cli/blob
- Vercel Blob: https://vercel.com/docs/vercel-blob
- Vercel cron jobs: https://vercel.com/docs/cron-jobs
- Vercel functions limits: https://vercel.com/docs/functions/limitations
- `@vercel/functions` and `waitUntil()`: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
- Postgres on Vercel: https://vercel.com/docs/postgres
