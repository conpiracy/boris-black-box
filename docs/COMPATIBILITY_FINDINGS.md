# Compatibility Findings

## Runtime Matrix

| Path | Input | Runtime | Result | Notes |
| --- | --- | --- | --- | --- |
| MediaBunny `Conversion` trim | Sample MP4 (`avc` + `aac`) | Node 24 | Failed | Trimmed conversion discarded `avc` and `aac` tracks as `undecodable_source_codec` |
| MediaBunny packet-copy chunking | Sample MP4 (`avc` + `aac`) | Node 24 | Passed | Audio-only `audio/mp4` segment produced and re-opened successfully |
| MediaBunny packet-copy chunking | Sample MP3 (`mp3`) | Node 24 | Passed | `audio/mpeg` segment produced and re-opened successfully |
| Alchemy deploy auth + resource creation | Worker + DO + Queue + R2 | Cloudflare account `6d62b10287374d588155f849b788ba00` | Partial | Queue creation succeeded; deploy stopped at R2 with `403 [10042] Please enable R2 through the Cloudflare Dashboard` |
| Local workerd runtime test | Worker runtime | This machine | Blocked | Packaged workerd binary is not runnable on this NixOS environment |

## Local Evidence

### MP4 inspection

- MIME: `video/mp4; codecs="avc1.640028, mp4a.40.2"`
- Duration: ~5.76s
- Tracks: one H.264 video track, one AAC audio track

### Failing `Conversion` trim probe

- `copy_all_no_trim`: valid
- `copy_audio_only_no_trim`: valid
- `copy_all_trim`: invalid
- `copy_audio_only_trim`: invalid

Discard reason:

- `undecodable_source_codec` for `avc`
- `undecodable_source_codec` for `aac`

### Working packet-copy probes

- MP4 -> `audio/mp4` chunk: produced successfully and re-opened with AAC audio track
- MP3 -> `audio/mpeg` chunk: produced successfully and re-opened with MP3 audio track

## POC Rule

Use MediaBunny packet-copy chunking for the proven matrix.

Do not use MediaBunny `Conversion` trimming in the v1 queue path unless the target runtime demonstrates decoder support for the needed codec path.

Fallback compute is reserved for:

- codecs outside the proven matrix
- decode/re-encode requirements
- runtime environments where packet-copy probing fails
