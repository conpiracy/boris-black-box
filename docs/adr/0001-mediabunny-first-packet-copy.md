# ADR 0001: MediaBunny-First Chunking Uses Packet Copy

## Status

Accepted

## Context

The product direction requires MediaBunny first and Cloudflare first. A naive implementation would use MediaBunny’s generic conversion API for trimming, but local runtime probing showed trimmed AAC/AVC inputs becoming invalid due to undecodable source codecs.

## Decision

The v1 chunker uses MediaBunny’s encoded packet APIs:

- inspect input with `Input`
- read packets with `EncodedPacketSink`
- write audio-only segments with `EncodedAudioPacketSource`

## Consequences

- The POC remains MediaBunny-first.
- The implementation avoids decode/encode requirements for the proven codec matrix.
- Codec coverage is narrower and must be documented explicitly.
- Containers remain a fallback, not the default.
