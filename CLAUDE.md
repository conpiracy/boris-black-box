# CLAUDE.md

Finish Boris Black Box on Vercel.

Read:

- [AGENT.md](/home/corp/dev/blackbox/AGENT.md)
- [docs/VERCEL_HANDOFF.md](/home/corp/dev/blackbox/docs/VERCEL_HANDOFF.md)
- [docs/COMPATIBILITY_FINDINGS.md](/home/corp/dev/blackbox/docs/COMPATIBILITY_FINDINGS.md)
- [TESTPLAN.md](/home/corp/dev/blackbox/TESTPLAN.md)

Rules:

- keep the public API contract unchanged
- keep `mediabunny_segment` as the public chunking mode
- keep MediaBunny packet-copy as the first implementation path
- do not expose private orchestration details
- do not commit secrets
- prefer porting shared logic instead of rewriting from scratch

Recommended runtime target:

- Vercel Node.js Functions
- Vercel Blob private store for media and artifacts
- Postgres for jobs, manifest, and stored provider key refs
- internal processing route plus cron recovery for background work

Minimum finish criteria:

1. Deploy with Vercel CLI.
2. Verify the public sample MP4 works online.
3. Run the smoke test three times.
4. Confirm artifact retrieval works.
5. Update the README with the final live URL and any changed operator steps.

Treat the Cloudflare code as the reference model, not the final hosting surface.
