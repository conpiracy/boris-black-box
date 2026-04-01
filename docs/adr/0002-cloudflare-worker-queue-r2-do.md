# ADR 0002: Single Worker With Queue Consumer, R2, And Durable Object State

## Status

Accepted

## Context

The POC needs a public HTTP contract, hidden orchestration, background processing, artifact persistence, and small operational surface area.

## Decision

Use one Worker entrypoint with:

- `fetch` for the public API
- `queue` for background transcription
- R2 for artifacts and uploaded media references
- a Durable Object for job records, key refs, and manifest state

## Consequences

- Fewer moving parts for the first live proof.
- Public API and queue processor share the same code and bindings.
- State mutations stay serialized through one named Durable Object.
- Scaling beyond the POC may justify splitting the control plane and processor into separate scripts later.
