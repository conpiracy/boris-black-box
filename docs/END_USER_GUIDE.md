# End User Guide

## What Boris Black Box Does

Boris Black Box gives you a narrow capability endpoint for transcription.

You send:

- a media target
- a transcription provider choice
- either a raw provider API key for one-off use or a stored key reference
- optional language and chunking preferences

Boris does the rest privately:

- inspects the media
- splits it into internal chunks
- transcribes chunks in parallel
- merges the output into ordered transcript artifacts

You get back:

- a job id
- public job status
- approved output artifacts such as plain text, JSON, and SRT

You do not get:

- internal chunk plans
- retry rules
- orchestration graph
- internal prompts or hidden validators

## Why This Exists

The point of Boris is to expose capability, not method.

The caller should be able to ask for a result without inheriting the operational complexity of media preparation, chunking, retries, transcript repair, or artifact normalization.

## Typical Flow

1. An operator stores a provider key or creates an upload target.
2. A caller submits a transcription request.
3. Boris returns a queued job id immediately.
4. The caller polls the job endpoint until it succeeds or fails.
5. The caller fetches transcript artifacts by name.

## Example Request

```json
{
  "transcriptionProvider": "openai",
  "transcriptionApiKey": "sk-...",
  "target": {
    "type": "url",
    "url": "https://example.com/video.mp4"
  },
  "options": {
    "language": "en",
    "chunking": {
      "mode": "mediabunny_segment",
      "maxChunkSeconds": 60,
      "silenceAware": false
    },
    "parallelism": 6,
    "returnFormat": "segments+srt+json"
  }
}
```

## Public Endpoints

- `POST /v1/bootstrap`
- `POST /v1/manifest/refresh`
- `POST /v1/transcriptions`
- `GET /v1/transcriptions/:id`
- `GET /v1/transcriptions/:id/artifacts/:name`

## Security Model

- Provider API keys can be sent directly for one-off POC usage.
- For safer repeated use, operators should store a key once and use a key reference.
- Boris should encrypt stored provider keys at rest.
- Runtime logs should never contain raw provider keys.

## Current Limits

The proven POC codec matrix today is:

- MP4 inputs with AAC audio
- MP3 audio-only inputs

Other codecs may require runtime probing and fallback handling before they should be treated as production-safe.
