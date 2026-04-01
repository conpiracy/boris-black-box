# ADR 0003: Cloudflare Bootstrap Token Never Enters Runtime

## Status

Accepted

## Context

Cloudflare’s API token creation flow requires an initial bootstrap token created from the special dashboard template that can mint other tokens. That token is powerful and should not live in the runtime Worker.

## Decision

Separate credentials into:

- provisioning-only Cloudflare bootstrap token for Alchemy/token creation
- runtime Worker secrets for API auth, encryption, and optional R2 presigning

Provider API keys are encrypted before they are persisted and are resolved by opaque references only.

## Consequences

- Runtime compromise does not automatically expose the provisioning token.
- Operator docs must be explicit about the boundary.
- Deployment and runtime secret sets are intentionally different.
