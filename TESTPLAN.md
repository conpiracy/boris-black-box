# Test Plan

## Automated Checks

`npm run typecheck`

- TypeScript compile safety across runtime code, scripts, and tests.

`npm run test:node`

- request schema validation
- manifest generation
- secret redaction
- transcript merge ordering
- media metadata probing with real local samples
- MediaBunny chunk generation with real local samples
- retry behavior
- artifact retrieval through the current HTTP route
- end-to-end happy path with a real sample asset stored in an in-memory object-storage mock

`npm run test:compat`

- explicit compatibility script for the real sample MP4 and MP3 files
- exact MediaBunny packet-copy path exercised against the production sample assets

## Sample Assets

- MP4: `https://samplelib.com/lib/preview/mp4/sample-5s.mp4`
- MP3: `https://samplelib.com/lib/preview/mp3/sample-3s.mp3`

Local copies are stored under [samples](/home/corp/dev/blackbox/samples).

## Live Smoke Procedure

1. Deploy the runtime surface for the target platform.
   The current handoff target is Vercel.
2. Provide `BORIS_BASE_URL`, `BORIS_API_TOKEN`, and `OPENAI_API_KEY`.
3. Run `npm run smoke`.
4. Verify three successful runs against the public sample MP4.
5. Verify `transcript.txt` retrieval on every run.

## Acceptance Criteria

- The API contract is reachable and returns public job state only.
- The internal chunking mode is `mediabunny_segment`.
- Background processing is asynchronous and parallelized.
- Artifacts are persisted in the target object store and retrievable through the public route.
- Provider keys are encrypted at rest and redacted in logs.
- The proven codec matrix is documented and reflected in the manifest/research docs.
- Deployment is performed through the Vercel CLI.
- The Vercel finish path preserves the same contract and proves the sample asset three times online.
