# Architecture

## Summary

Boris Black Box currently exists as a Cloudflare reference implementation with two execution surfaces:

- `fetch`: narrow HTTP API
- `queue`: background transcription processor

State and artifacts are split on purpose:

- Durable Object `BORIS_STATE`: job records, stored provider key refs, manifest
- R2 `BORIS_BUCKET`: uploaded media references and output artifacts
- Queue `TRANSCRIPTION_QUEUE`: async job dispatch

This is the reference build, not the final deployment target. The next operator is expected to preserve the public contract and port the runtime to Vercel. The reusable business logic already lives under [src](/home/corp/dev/blackbox/src); the platform-specific pieces are the bindings, persistence adapters, and background dispatch model.

## Request Flow

1. `POST /v1/transcriptions` validates input and normalizes raw provider keys into encrypted key refs.
2. The Worker stores the queued job record in the Durable Object.
3. The Worker enqueues `{ jobId }` onto Cloudflare Queues.
4. The queue consumer loads the job, resolves the encrypted provider key ref, and probes the source media with MediaBunny.
5. The consumer builds a chunk plan and generates internal audio-only chunks with MediaBunny packet-copy logic.
6. Chunks are transcribed in parallel against OpenAI.
7. Chunk transcripts are merged into canonical JSON, SRT, and plain-text artifacts.
8. Artifacts are written to R2 and the public job record is updated.

## Media Strategy

The important architectural choice is not just “MediaBunny first,” but “MediaBunny packet-copy first.”

Why:

- The higher-level `Conversion` trimming API did not validate for trimmed AAC/AVC sources during local runtime probing.
- The lower-level packet APIs worked for the proven matrix without depending on decoder availability.
- That keeps the POC Cloudflare-shaped and avoids a binary container path until tests prove it is required.

Current proven codec matrix:

- AAC audio in MP4 containers -> chunk output `audio/mp4`
- MP3 audio-only inputs -> chunk output `audio/mpeg`

Current non-proven paths:

- Opus, Vorbis, PCM, WAV, and mixed/less common codecs
- Any path that requires decode/re-encode rather than packet copy

These should remain behind a fallback boundary until runtime tests prove them.

## Public Contract

### `POST /v1/bootstrap`

Operator-only endpoint.

Supports:

- storing a transcription provider key and returning `transcriptionApiKeyRef`
- creating a direct-to-R2 upload URL and returning an `r2` target reference

### `POST /v1/manifest/refresh`

Operator-only manifest refresh. Stores the latest capability manifest in the Durable Object.

### `POST /v1/transcriptions`

Accepts:

- `transcriptionApiKey` for POC submission
- `transcriptionApiKeyRef` for production-safe submission
- target by `url` or `r2`
- `mediabunny_segment` chunking options

Returns:

- job id
- capability name
- queued status

### `GET /v1/transcriptions/:id`

Returns the public job record only. Internal plan, retries, and secret material remain private.

### `GET /v1/transcriptions/:id/artifacts/:name`

Streams approved artifacts from R2.

## Secret Boundary

Provisioning:

- Cloudflare bootstrap token
- only used by Alchemy / token provisioning flows
- never deployed into the runtime Worker

Runtime:

- `BORIS_API_TOKEN`
- `BORIS_OPERATOR_TOKEN`
- `KEY_ENCRYPTION_SECRET`
- optional R2 presign credentials

Provider keys:

- never logged raw
- encrypted at rest before they are persisted in the Durable Object
- referenced by opaque `transcriptionApiKeyRef`

## Observability

Public job metrics include:

- source duration
- chunk count
- provider latency total
- retries
- elapsed time

The logger runs secret redaction before writing structured context.

## Fallback Rule

Containers are not part of v1 by default.

Only introduce them if runtime tests show:

- unsupported codec paths outside the proven matrix
- memory pressure that makes packet-copy chunk generation unreliable
- performance that makes queue-consumer execution non-viable

## Vercel Bridge Target

Recommended target mapping:

- Cloudflare Worker `fetch` -> Vercel Node.js Functions under `api/v1/*`
- Cloudflare Queue consumer -> internal Vercel processing route plus DB-backed job states and recovery cron
- Durable Object state -> Postgres tables
- R2 artifacts -> private Vercel Blob store or S3-compatible object storage

Recommended bias:

- keep shared logic in `src/`
- extract platform-specific storage/state/dispatch adapters behind narrow interfaces
- use `waitUntil()` only to kick off background work, not as a substitute for durable long-running job orchestration
- keep MediaBunny packet-copy chunking as the first implementation path unless tests prove it insufficient on Vercel
