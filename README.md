# Boris Black Box

`media.transcribe.parallel.v1` is a black-box media transcription capability. Callers submit a media target plus a provider key or key reference. Boris inspects the media, chunks it internally with MediaBunny, transcribes chunks in parallel, merges the results, and returns only public job state plus approved transcript artifacts.

## Status

This repository currently contains:

- a validated Cloudflare reference implementation
- a live Cloudflare deployment
- a proven MediaBunny-first packet-copy chunking path for the POC codec matrix
- a Vercel migration handoff so another operator or coding agent can finish the production deployment on a different machine

The Cloudflare account-side blockers have been cleared and the reference stack is now deployed at `https://boris-black-box-api-corp.conpiracy.workers.dev`. The remaining live validation blocker on this machine is provider credentials: there is no `OPENAI_API_KEY` available locally, so the health and manifest endpoints are verified online but the full transcription smoke run cannot be completed from this machine yet.

## What Is Already Proven

- MediaBunny metadata probing works for the sample MP4 and MP3 assets.
- MediaBunny `Conversion` trimming is not reliable for the tested AAC/AVC path in this runtime and is intentionally not the production chunking path.
- MediaBunny packet-copy chunking works for:
  - AAC audio in MP4 containers
  - MP3 audio-only inputs
- The narrow API contract, secret redaction, transcript merge, and artifact retrieval logic are implemented and tested locally.

Evidence is in [docs/RESEARCH.md](/home/corp/dev/blackbox/docs/RESEARCH.md), [docs/COMPATIBILITY_FINDINGS.md](/home/corp/dev/blackbox/docs/COMPATIBILITY_FINDINGS.md), and [TESTPLAN.md](/home/corp/dev/blackbox/TESTPLAN.md).

## Live Endpoint

- base URL: `https://boris-black-box-api-corp.conpiracy.workers.dev`
- health: `GET /healthz`
- public API base: `/v1/...`

## Read This First

- [AGENT.md](/home/corp/dev/blackbox/AGENT.md): autonomous finish brief for any coding agent
- [CLAUDE.md](/home/corp/dev/blackbox/CLAUDE.md): concise operator prompt for Claude or another code agent
- [docs/VERCEL_HANDOFF.md](/home/corp/dev/blackbox/docs/VERCEL_HANDOFF.md): exact bridge plan from the Cloudflare reference build to a Vercel deployment
- [docs/END_USER_GUIDE.md](/home/corp/dev/blackbox/docs/END_USER_GUIDE.md): user-facing explanation of how Boris works
- [ARCHITECTURE.md](/home/corp/dev/blackbox/ARCHITECTURE.md): current reference architecture and reusable logic boundaries

## Public API Contract

The public surface stays narrow:

- `POST /v1/bootstrap`
- `POST /v1/manifest/refresh`
- `POST /v1/transcriptions`
- `GET /v1/transcriptions/:id`
- `GET /v1/transcriptions/:id/artifacts/:name`

The private method stays private. Internal chunking heuristics, retry rules, orchestration details, and repair logic are server-side only.

## Repo Layout

- [src/worker.ts](/home/corp/dev/blackbox/src/worker.ts): Cloudflare reference HTTP and queue entrypoint
- [src/jobs.ts](/home/corp/dev/blackbox/src/jobs.ts): orchestration logic worth reusing in the Vercel port
- [src/media/packet-segmenter.ts](/home/corp/dev/blackbox/src/media/packet-segmenter.ts): MediaBunny-first chunk generation
- [src/transcription/openai.ts](/home/corp/dev/blackbox/src/transcription/openai.ts): provider adapter
- [scripts/smoke-test.ts](/home/corp/dev/blackbox/scripts/smoke-test.ts): live smoke runner that should be reused against the Vercel deployment
- [docs/VERCEL_HANDOFF.md](/home/corp/dev/blackbox/docs/VERCEL_HANDOFF.md): migration target and execution order

## Local Validation

```bash
npm run typecheck
npm run test
npm run test:compat
```

## GitHub Transfer

This repo has been prepared to be committed and pushed. On the machine that has GitHub access:

```bash
git init
git add .
git commit -m "Prepare Boris Black Box handoff for Vercel finish"
gh repo create boris-black-box --private --source=. --remote=origin --push
```

If `gh` is not authenticated, create the repo in the GitHub UI first and then:

```bash
git remote add origin git@github.com:<owner>/boris-black-box.git
git push -u origin main
```

## Vercel Finish Path

The recommended finish path is:

1. Keep the public API contract exactly as-is.
2. Keep MediaBunny packet-copy chunking as the default proven path.
3. Port the runtime surface from Cloudflare to Vercel Node.js Functions.
4. Replace R2 with Vercel Blob or S3-compatible object storage.
5. Replace the Durable Object with Postgres-backed state.
6. Replace Queues with a DB-backed job dispatcher plus internal worker route and recovery cron.
7. Deploy with the Vercel CLI.
8. Run the smoke test three times against the public sample MP4.

The detailed version of that plan is in [docs/VERCEL_HANDOFF.md](/home/corp/dev/blackbox/docs/VERCEL_HANDOFF.md).
