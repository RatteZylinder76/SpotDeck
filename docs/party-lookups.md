# Party layout, free tempo metadata and lyric search

## Party interaction and sizing

The existing `data-party` and `data-controls-hidden` states now hide the exit action as well as the dock, progress track, connection action and top actions. Their groups become inert immediately. Keyboard wake consumes the first key and its held-key repeats; pointer/touch reveal the controls normally. Escape exits Party when Settings, Library and Lyrics are closed. With a dialog open, Escape retains the existing dialog behavior.

The latest [TV performance revision](tv-performance.md) switches the 0–1 grid scalar once per hide/wake and animates the face panel with an inverse transform for 650 ms. The inner face still owns dance transforms. Cover/metadata reach the destination layout immediately. Reverse input samples the current visible size. Reduced motion is respected; explicit Normal/Lively overrides the system. ResizeObserver updates movement amplitude on size changes. No second application RAF is introduced. Browser measurements below concern the previous revision; current validation limits are recorded in the TV document.

## Provider decision: no registration or paid infrastructure

The user preferred a free, keyless service. The implementation uses the documented MusicBrainz recording search, followed by AcousticBrainz's partial low-level bulk API. Both public endpoints returned CORS `*` in live checks. No account, server, API key or paid service was created.

| Provider | Finding | Use in this revision |
| --- | --- | --- |
| MusicBrainz | Public recording identity metadata, including ISRC search, artists, durations and disambiguation. Requests must be rate limited. | Identify candidate recordings. |
| AcousticBrainz | Public CC0 acoustic metadata, including BPM; data collection ended in 2022. | Free BPM metadata when a suitable archived recording exists. |
| GetSongBPM | Free with registration/key and mandatory backlink; documented limit 3,000 requests/hour. Search by song/artist. The published schema does not promise recording ISRC/duration or beat timestamps. | Evaluated but not enabled, because no account/key/proxy exists. A private key would require an independently configured backend, never public HTML. |
| LRCLIB | Public, no-key lyrics API with exact/search endpoints and line/word timing fields. | Primary lyrics source. |
| Musixmatch | Official licensed catalog/API requiring an account, applicable access rights and a secret key. | Evaluated; not enabled and no plan purchased. |

Sources: [MusicBrainz recording model](https://musicbrainz.org/doc/Recording), [rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting), [AcousticBrainz availability and license](https://acousticbrainz.org/), [partial bulk API](https://acousticbrainz.readthedocs.io/api.html), [GetSongBPM API](https://getsongbpm.com/api), [LRCLIB API](https://lrclib.net/docs), [official Musixmatch SDK information](https://github.com/musixmatch/musixmatch-sdk).

The browser uses its native User-Agent and identifies the app via the request's client parameter and origin/referrer. The direct public APIs may restrict or change browser access. No attempt is made to bypass rate limits or access controls; errors leave autonomous animation available.

## Recording matching and tempo provenance

Metadata is remembered across SDK and Web API updates so an available ISRC is not lost when the SDK supplies fewer fields. Lookup keys use the Spotify track ID and an additional ISRC key; a matching title/artist/duration signature is required before reusing either entry. Searches try ISRC first, then the full title and main artist. A failed exact match never licenses an original recording's BPM for a remix.

The shared comparison normalizes Unicode, punctuation and case, while retaining meaningful parenthetical title text. Version qualifiers are handled separately: Remix, Extended, Radio Edit, Live, Acoustic, Remaster and related labels, including the remaining qualifier text. Artist similarity, duration, album and explicit ISRC evidence contribute to ranking. Tempo requires a compatible version and either matching ISRC or close duration, in addition to a high score. AcousticBrainz file tags and measured duration are checked again. Similar candidates with conflicting BPM produce an ambiguous result, not a confident value; supported candidates can be selected explicitly.

Database values are labelled as database metadata. They never set `BeatEngine.bpm` for Spotify. The lightweight local audio estimate, manual input and tap tempo retain their own source labels. No fixed fallback is labelled as detection. The partial database query does not provide a verified beat phase, so no recording-aligned phase is assumed. The existing offset and half/double controls remain available for permitted local audio.

The normal Tempo view shows a short status and refresh action. Local audio, tap/manual alternatives, speed and alignment controls live in a closed, keyboard-focusable details section. Unsupported controls are disabled until the permitted source is active. Automatic recognition remains the default for that source.

## Multi-stage lyrics and caching

Lyrics first use `/api/get` with the full title, artist, album and duration. On a miss, bounded `/api/search` stages try full/cleaned names, the base title and a relevant alternate artist or normalized spelling. Ranking compares the same identity criteria. High-confidence entries are selected automatically; a sole strong original-version text can be displayed with a clear alternative-version warning. Multiple plausible texts require a selection. Wrong artists and unrelated titles are rejected. Instrumental matches are reported explicitly.

Spotify displays text without synchronized highlighting, as in the previous policy-aware revision. Alternate recording timestamps are never transferred to a remix. Local `.txt`, `.lrc` and Lyricsfile YAML can also be opened; plain files remain plain. Permitted local singing and imported word timings retain their existing implementation.

The bounded, locally stored caches retain source and version-match information. Successful tempo results expire after 30 days; successful lyrics after seven days. Missing or ambiguous results expire after 15 minutes. Storage failures fall back to bounded memory. Manual refresh bypasses result caches but honors service backoff, which also survives reload. Requests are spaced at least 1.2 s for MusicBrainz, 1.1 s for AcousticBrainz and 350 ms for LRCLIB, with readable Retry-After/rate headers honored. Timeouts and transient errors are distinguished from missing data. No full database dump, scraping, secret headers or protected stream analysis is used.

New tracks immediately clear old lyric content, abort obsolete requests and reject stale responses by identity/epoch. Lyrics are looked up when their view opens and update automatically if the track changes while that view is open. Closing the view does not cause background lyric polling. Tempo metadata is scheduled once per new track and can be disabled. Logout aborts lookups and removes these local caches.

## Verification

Run all three dependency-free suites:

```sh
node tests/spotdeck.test.cjs
node tests/halloween.test.cjs
node tests/lookups.test.cjs
```

The added suite checks exit inertness, resize/reversal without a second RAF, reduced motion, held-key wake, dialog-aware Escape, recording/version selection, Original-vs-Remix fallback, Live exclusion, ambiguous lyrics, tiered queries, positive/negative caching, refresh/backoff, stale responses and cache bounds. The existing SDK, controller, own-audio and Halloween scenarios remain covered by their original suites.

Live HTTP checks returned MusicBrainz identity data and AcousticBrainz's documented Pink Floyd example (approximately 148.13 BPM, 102.95 seconds) without keys. This validates the public interfaces, not catalog-wide coverage or matching every modern recording. Physical TV/remote hardware and real Spotify Premium audio require their own device/account check.

The Chromium-based in-app browser also exercised the direct live lookup and received provider backoff/rate-limit responses, which were handled without affecting playback. It did not certify an end-to-end successful live match in that browser environment. Offline provider fixtures cover successful and conflicting BPM responses, while the separate HTTP checks verify actual public response shapes.

Both steady Party states were measured in the browser on 2026-10-30:

| Viewport | Controls visible | Controls hidden | Horizontal overflow |
| --- | ---: | ---: | --- |
| 390 × 844 | 249 px | 271 px | None |
| 844 × 390 | 155 px | 233 px | None |
| 768 × 1024 | 376 px | 475 px | None |
| 1366 × 768 | 368 px | 491 px | None |
| 1920 × 1080 | 566 px | 690 px | None |
| 3840 × 2160 | 880 px | 1240 px | None |

The face remained square and inside the viewport. The exit's hidden visibility and explicit inert attribute, keyboard wake, and Escape closing a dialog without exiting Party were checked in the actual browser. All three test suites pass. Safari, independent Firefox/Edge, physical TV/remote hardware and real Premium audio were not newly certified by these checks.
