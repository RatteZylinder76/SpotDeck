# TV performance and playback diagnostics

Based on main `23782774328ccac796ff6bdad2775eb4d4a6e33a`.

## Findings and changes

- SDK events already rendered synchronously. The old two-second poll separately started getCurrentState and REST, waited for REST first, allowed overlap and could render stale SDK snapshots. Polling is now single-flight, time bounded and guarded by SDK revision/player epoch before and after JSON parsing. SDK events need no REST completion. After ten seconds without an event, a fallback snapshot renders immediately; local REST reconciliation is at most every fifteen seconds. Only one unresolved SDK snapshot request is retained. There is no automatic play/pause, transfer or reconnect loop.
- Artwork loads independently. The first next-track artwork from documented track_window.next_tracks is preloaded once per next-track ID. Metadata memory stays bounded; no audio is downloaded or prefetched. Like checks run in one replaceable deferred task and reject obsolete responses. Tempo preparation schedules the existing delayed, abortable lookup; lyrics remain lazy when their view is closed. Track changes abort obsolete lyric/tempo requests. Device options and unchanged metadata text are not rebuilt.
- Explicit Normal/Lively already correctly overrides OS reduced motion in offline reproduction. No additional Chromium/Firefox transform failure was demonstrated. Idle motion is more visible; settings explain system reduction versus manual selection. Diagnostics show effective motion, computed transform, system preference and figure width. Body motion works without lyrics. Spotify retains autonomous motion; timed singing remains for the permitted local source.
- Reduced confetti really used X as Y. Both variants now use independent face-relative ring coordinates; TV mode uses six particles. Five-click detection, seven-second duration, cooldown and Halloween remain.
- Moving face filters are removed; the orb uses a soft radial gradient. Background blur drops from 55 to 28 px. TV uses 10 px background blur, 8 px glass, static ambient fog and fewer particles. Identical face-variable writes are skipped. TV prioritizes body motion at up to 30 updates/s, auxiliary reactions at 10 Hz and mouth at up to 20 Hz. Quality permits 60 body updates/s; Auto starts at 30. One application RAF remains. ResizeObserver reads size on resize, not each frame.
- Party sets its grid scalar once per hide/wake. A 650 ms Web Animations inverse transform animates the face panel; the child retains body transforms. Reversal samples visible size. There are no grid writes on each RAF or after settling. Reduced motion and browsers without Web Animations switch immediately. Cover/metadata reach the destination layout immediately instead of being relaid out throughout the transition.
- Lyrics source is a short line below the artist. Detailed version information, LRCLIB link and local-file action live in the keyboard-accessible ⋯ disclosure. Only ambiguous results show a selector; hidden selection consumes no height. Text size uses viewport height and width, with compact controls below 600 px height. Plain Spotify text keeps native scrolling.

## Settings and diagnostic interpretation

Settings → Darstellung → Performance offers Automatisch / Hohe Qualität / TV / Performance and stores the choice with existing preferences. Auto simplifies effects after two five-second windows with mean processed-frame intervals above 135% of the intended cadence (about 45 ms normally, 88 ms with intentional reduced motion) or a loop above 40 ms. No user-agent inference is used. Auto fallback lasts for this page session; explicit Quality overrides it. Thresholds are heuristics, not a TV benchmark.

Enable **Diagnose anzeigen · nur lokal** to inspect/download a bounded report. It defaults off and is not persisted. Only the latest 160 events are kept while enabled. Reports include track IDs and timings, but no tokens, account identifiers, raw SDK error messages or artwork URLs. Disabling clears events and disconnects the optional long-task observer. Unsupported observation is omitted.

FPS/frameMs describe processed animation updates over five-second windows, not display refresh. LoopMs and section totals measure JavaScript execution, excluding later style/layout/paint. Low JS cost plus large gaps suggests rendering/other work, but does not establish a GPU or decoder diagnosis. Long tasks are browser main-thread observations without attribution URLs.

Events distinguish sdk-near-end (a received SDK position within 250 ms of duration), first sdk-state for the next track, ui-track, reported-playing, API/SDK durations, token refresh, connection/autoplay/DRM error categories and frame gaps. Times are monotonic milliseconds since navigation. Near-end may be absent because SDK events are not emitted at every position. **Neither near-end nor reported-playing measures the actual audible end/start.** Streaming/DRM/decoder latency needs device listening and profiling. No audio capture is used.

Official API: [Web Playback SDK reference](https://developer.spotify.com/documentation/web-playback-sdk/reference).

## Validation and remaining device work

All three dependency-free suites pass with mocked SDK/network/DOM:

```sh
node tests/spotdeck.test.cjs
node tests/halloween.test.cjs
node tests/lookups.test.cjs
```

Added coverage: OS reduction plus explicit Normal, idle/playing body without lyrics, independent mouth, ring coordinates, saved TV profile, opt-in diagnostics, delayed/stale REST, serialized polls, fifteen simulated automatic changes, stable timers/listeners, sanitized playback errors, one Party layout write per transition, settled grid, TV particle bounds, measured automatic fallback, compact lyrics DOM and low-height CSS. Layout assertions are structural, not pixel measurements.

This revision was **not visually verified** at 1280×720, 1920×1080, 3840×2160 or browser zoom. The local preview server could not start in the tool runtime; browser policy blocked local-file URLs. No workaround was attempted. Physical TV, audible Spotify Premium, independent Chromium/Firefox, paint cost, decoder contention and real transition latency remain unverified. Earlier browser measurements in other documents concern earlier revisions.

For each comparison below, play at least three consecutive songs with diagnosis enabled, then export. Keep viewport, zoom and connection constant. Record audible gaps separately by observation.

| Scenario | Checks |
| --- | --- |
| A: Desktop, no Spotify | Normal idle body, five real clicks, console, persistence after reload. Repeat Systemstandard with OS reduction. |
| B: Desktop, Spotify | Local SDK track/UI changes, autonomous body and polls ≤1. Test timed mouth separately with a permitted local file. |
| C: TV baseline | Reduced motion, Halloween/ambient off; compare SDK/API times and audible gaps. |
| D: TV ordinary face | Normal motion; compare Quality and TV profiles, frame/loop costs against C. |
| E: TV Halloween + Party | Large face, all ten scenes, five taps, wake during resize, automatic songs; compare profiles. |

At all requested TV sizes, also inspect unique/ambiguous/missing lyrics and local files, short viewports and 125–200% zoom. Check disclosure reachability, source truncation and text scrolling. Use browser performance recordings to distinguish style/layout/paint from JS and protected-media decoding if gaps persist.
