# Research Summary

This POC was scoped against official or primary documentation first, then narrowed by runtime tests.

## Official Findings

- MediaBunny describes itself as a pure TypeScript media library with reading, writing, and conversion APIs; its conversion guide explicitly lists transmuxing, transcoding, trimming, and track removal as supported features.
  Sources:
  - https://mediabunny.dev/guide/converting-media-files
  - https://mediabunny.dev/guide/reading-media-files

- MediaBunny input sources cover URL, file path, generic stream, and append-only readable stream sources.
  Sources:
  - https://mediabunny.dev/guide/reading-media-files

- MediaBunny codec support depends on runtime capabilities in some paths, especially where decoding or encoding is required. That makes packet-copy paths safer than decode/re-encode paths for a Cloudflare POC.
  Source:
  - https://mediabunny.dev/guide/supported-formats-and-codecs

- Cloudflare Workers support Wasm, and Cloudflare documents Node.js compatibility through the `nodejs_compat` compatibility flag.
  Sources:
  - https://developers.cloudflare.com/workers/runtime-apis/webassembly/
  - https://developers.cloudflare.com/workers/runtime-apis/nodejs/

- Cloudflare Queues consumers have 15 minutes wall time, and consumer CPU time defaults to 30 seconds but can be increased to 5 minutes with `limits.cpu_ms`.
  Source:
  - https://developers.cloudflare.com/queues/platform/limits/

- Cloudflare R2 supports presigned URLs for direct client uploads, including worker-generated presigned PUT URLs.
  Source:
  - https://developers.cloudflare.com/r2/objects/upload-objects/

- Cloudflare API token creation via API requires an initial dashboard-created bootstrap token using the special “Create additional tokens” template; Cloudflare explicitly recommends not adding unrelated permissions and recommends IP or TTL restrictions.
  Source:
  - https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/

- Alchemy supports Cloudflare Worker, Queue, R2 bucket, Durable Object, bindings, secrets, and workers.dev URL provisioning.
  Sources:
  - https://alchemy.run/providers/cloudflare/worker
  - https://alchemy.run/providers/cloudflare/bucket-object/
  - https://alchemy.run/guides/cloudflare/

## Design Consequences

- MediaBunny remains the first implementation path, but not via the generic conversion abstraction.
- The production chunker should use MediaBunny packet sinks and packet sources for the proven codec matrix.
- `nodejs_compat` is enabled for the POC to keep the Cloudflare runtime conservative and reduce package/runtime mismatch risk.
- Containers remain a fallback only if runtime evidence forces them.
