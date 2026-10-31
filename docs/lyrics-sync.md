# Matching synchronized lyrics before plain text

Based on main b01f40bf7991c1d958ddbb1b9a5b2c4d8a5aa08d.

## Source limitation and resulting behavior

Spotify confirms that its public API does not expose lyrics: [Spotify developer answer](https://community.spotify.com/forum/en/discussion/5355493/update-endpoint-for-lyrics). The Web Playback SDK supplies playback state, not the Spotify application's lyric feed. Availability of lyrics inside Spotify (for example a particular recording of Smooth Operator) does not establish external availability. No private cookie, undocumented lyric endpoint or third-party proxy is used.

LRCLIB supplies [line timestamps and optional word timings](https://lrclib.net/docs). The previous implementation retained those fields in the cache but always rendered plain text and restricted highlight updates to owned audio. Those display restrictions are removed for verified external lyric matches.

Search now gives priority to timed LRCLIB records for the same recording. An exact result with only plain text no longer ends the search before a matching timed result can be found. Bounded existing search stages and backoff remain. If timestamp search fails after finding plain text, that text remains available; the incomplete search is cached for fifteen minutes rather than seven days. Cache version v3 prevents old plain-only selection decisions from masking newly preferred timed results.

## Recording and position checks

Synchronization requires a found match, matching version, existing high-confidence title/artist checks and a confirmed duration difference of at most two seconds. Alternate recording versions, unknown durations, invalid/out-of-range timestamps and text-only results remain plain. Several distinct plausible results still require a selection. A duration match does not guarantee perfect alignment; community timestamps can contain mistakes.

Rendered lines follow reported Spotify position through the existing central RAF: position progresses while playing, freezes when paused, and a new position/seek changes the highlighted line. Opening mid-song immediately selects the current line. No extra polling, RAF or audio processing is added. Saved local-audio lyric offsets are not applied to Spotify. Reduced motion uses immediate scrolling; normal motion scrolls smoothly.

Vibe Face now also sings from the verified lyric timestamps during Spotify playback, including with the Lyrics view closed. Lyrics load in the existing deferred metadata task and temporary failures retry after the existing backoff through the same central clock. Actual word timestamps are used when present; syllable/vowel positions within line-only lyrics are estimated. The mouth stops its lyric reaction during pause, word gaps, plain-text fallback and track changes. The body keeps its independent dance; no audio capture or analysis is introduced. TV performance profiles, Party transitions and Halloween scenes remain intact.

## Verification

All three suites pass. Added tests cover timed-first search even when exact lookup returns plain text; line highlighting/scrolling from Spotify state; pause/resume and backward position changes; reopening; cache reuse; source labels; plain, alternate, duration-unknown and out-of-range fallbacks; track-change cleanup; independence from local-audio offsets and vocal animation; and retention of plain text during a failed timestamp search.

Fixtures use invented test lines, not song lyrics. No live Spotify session, specific Smooth Operator recording, audible timing or pixel-level browser layout was verified. Existing browser/device limitations from [TV performance](tv-performance.md) still apply. Reload SpotDeck fully after updating; source status shows synchronisiert or nur Text.

## Singing restoration verification

The three suites also verify positive Spotify mouth opening, actual mouth-path morphing in the existing RAF, closed-view background loads, pause and word-gap closure, ignoring local-file offsets, plain fallback restraint and delayed background retry without request storms. No new real-audio or device verification was performed.

## Provider availability, 2026-10-31

A direct public /api/get request returned HTTP 503 with JSON error name ServerOverloaded and Retry-After: 1; CORS allowed the supplied browser origin. This verifies provider overload from the test connection, not the exact network condition on the user device. The provider documents 503 as temporary overload: https://lrclib.net/docs.txt.

The UI now distinguishes overload (503), rate limits (429), timeouts, other HTTP errors and network/browser failures. Automatic retries respect Retry-After and use a growing client delay (10 seconds doubling to a 120-second base, plus 10–30% jitter) instead of repeating a busy endpoint every second. Matching cached text/timestamps remain usable during refresh failures; automatic retry still revalidates them. Successful fetch resets the failure count. Opt-in diagnosis records sanitized error category, HTTP status, attempt and wait. No alternate proxy, credential or account was introduced.

All three offline suites pass, including cached timing retention, repeated failure spacing, provider minimum delay and recovery. External service restoration and the user device connection cannot be guaranteed by application changes.
