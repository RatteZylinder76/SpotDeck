# Matching synchronized lyrics before plain text

Based on main b01f40bf7991c1d958ddbb1b9a5b2c4d8a5aa08d.

## Source limitation and resulting behavior

Spotify confirms that its public API does not expose lyrics: [Spotify developer answer](https://community.spotify.com/forum/en/discussion/5355493/update-endpoint-for-lyrics). The Web Playback SDK supplies playback state, not the Spotify application's lyric feed. Availability of lyrics inside Spotify (for example a particular recording of Smooth Operator) does not establish external availability. No private cookie, undocumented lyric endpoint or third-party proxy is used.

LRCLIB supplies [line timestamps and optional word timings](https://lrclib.net/docs). The previous implementation retained those fields in the cache but always rendered plain text and restricted highlight updates to owned audio. Those display restrictions are removed for verified external lyric matches.

Search now gives priority to timed LRCLIB records for the same recording. An exact result with only plain text no longer ends the search before a matching timed result can be found. Bounded existing search stages and backoff remain. If timestamp search fails after finding plain text, that text remains available; the incomplete search is cached for fifteen minutes rather than seven days. Cache version v3 prevents old plain-only selection decisions from masking newly preferred timed results.

## Recording and position checks

Synchronization requires a found match, matching version, existing high-confidence title/artist checks and a confirmed duration difference of at most two seconds. Alternate recording versions, unknown durations, invalid/out-of-range timestamps and text-only results remain plain. When several plausible results remain, SpotDeck automatically chooses the best compatible candidate, preferring safely synchronized timing, then recording/version confidence and duration. The menu remains available for manual correction. A duration match does not guarantee perfect alignment; community timestamps can contain mistakes.

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

## Memories synchronization and props regression, 2026-10-31

The live public basic metadata lookup for Memories by David Guetta returned a timed record (LRCLIB ID 141520, 209 seconds). A representative Spotify metadata fixture titled Memories (feat. Kid Cudi), duration 210 seconds, was rejected by the old matcher because the featured-artist credit remained in the title identity. The old base-title similarity was 0.4 and no cues were accepted; the corrected match accepts 37 timed lines while preserving the two-second duration and recording-version checks. This fixture is representative, not a direct read of the user device. The exact active user recording is not certified.

Parenthesized feat/ft/featuring credits are now excluded from recording-title comparison and the lookup title. Remix/live/remaster and other recording qualifiers remain significant. Basic documented title/artist lookup is tried first, validated locally, then detailed album/duration lookup and bounded search if required. The basic live request succeeded while detailed lookup and search intermittently returned 503; normal backoff remains in force. No private Spotify lyric API or proxy is used.

Line-only Lyricsfile YAML is now parsed when LRC is absent, even when hasWordSync is false. Earlier cached static/alternative selection decisions are rechecked once under the new matching policy rather than masking available timing for days. An incomplete timing search retries in the background while keeping plain text visible.

Word reaction scenes had a separate local-audio-only guard. They now accept playing Spotify tracks with verified synced rows. Existing cooldowns, bounded queues, pause behavior and the one-RAF architecture remain. Memory/remember/Erinnerung vocabulary adds restrained photo/thought/sparkle scenes; the actual Memories text otherwise mainly matched ambiguous night words, which were deliberately suppressed for estimated word timing.

Validation: all three suites pass. New fixtures test featured metadata, old-cache upgrade, timed line highlighting, positive mouth motion, actual visible scene markup/accessory state, memory vocabulary, line-only YAML, rejection of a different remix, basic-to-detailed search and retry of incomplete timing. A separate local run fed the actual retrieved Memories record through a simulated Spotify clock for the full duration: all 37 lines became active, mouth reactions occurred, memory scenes appeared, and exactly one RAF remained. Actual audible audio alignment, browser pixel rendering and physical TV playback remain unverified. Real song lyrics were not added to repository fixtures.

## Automatic lyric-version selection

Party playback no longer waits for a manual choice when multiple compatible lyric records remain. A safely timed match is preferred, followed by recording/version confidence, match score and duration difference, with stable tie-breaking. Incompatible artists are excluded. Alternate recordings and uncertain timing remain plain text under the existing synchronization safeguards.

The selector stays available whenever multiple usable candidates exist, labels synchronized versus plain text versions and marks the current automatic or manual choice. A manual choice keeps the alternatives and is cached for normal reloads under the existing seven-day expiry. Refresh can request a new search. Existing cached ambiguous results receive an automatic default on display.

Synthetic Like a Prayer fixtures (340 seconds) verify automatic timed selection, manual changes, persistence through a reload without another lookup, timed-versus-plain ranking, alternate-version timing rejection, wrong-artist rejection and the single animation loop. All three regression suites pass. These checks do not certify alignment of the user’s active Madonna recording or audible/TV behavior.

## Smooth mouth and Halloween movement

The earlier scheduler updated vocal targets and Halloween transforms only every 50 ms in quality and 100 ms in TV mode. TV mouth morphing had an additional 50 ms guard, so its visible cadence was lower than body movement. Automatic mode also capped body updates at 30/s even before a measured fallback.

Vocal targets, effect movement and mouth morphing now share each accepted body frame, up to 60/s in quality or initial automatic mode and 30/s in TV mode. Metadata lookup/diagnostic refresh stays throttled. Automatic slow-frame detection now uses the active target cadence; it still reduces quality when sustained frame gaps are measured. The mouth drop-shadow filter is removed. Progress/sway properties are scoped to the Halloween layer and reset before a new scene, and only mounted moving scene elements receive a transform compositing hint. Existing scene lifetimes, cue offsets, single-scene limits, reduced motion and hidden-tab cleanup remain.

A simulated 60 Hz display checks actual mouth-path and Halloween-property writes against body-frame counts in automatic, quality, TV and reduced-motion modes. Vocal targets must also refresh each frame. These regression checks fail against the previous scheduler and pass with the change. All three suites pass, including scene progression, lyric selection and playback safeguards. This is a scheduler/DOM regression check; GPU rendering and perceived smoothness on the user TV have not been measured.

## Independent synchronized-lyrics fallback

On 2026-10-31, the public LRCLIB Pieces search returned 503 while lrc.red returned 200 with CORS support. Its documented API provides independent recording metadata and Lyricsfile/LRC timing. A browser preflight explicitly allowed X-Client-ID. SpotDeck identifies itself with its project URL and the maintainer’s already-public GitHub no-reply contact, omits cookies/tokens and credits/links lrc.red in the lyrics display. Requests disclose recording ISRC or title/artist and the client IP, never audio or Spotify credentials. See [lrc.red API and terms](https://lrc.red/api).

The wrapper keeps a suitable timed LRCLIB result immediately. Otherwise it tries lrc.red automatically, including during persisted LRCLIB backoff. Direct ISRC metadata is preferred; a bounded title/artist search may inspect up to three compatible candidates. Only validated ISRC paths on the fixed host are fetched, not URLs supplied in metadata. Title, artist, version, confirmed duration within two seconds and parsed timestamp ranges must all pass before timing is installed. Lyricsfile word/line timing feeds the existing mouth and emoji system. Plain primary text remains usable if no safe timed secondary match exists.

Independent provider quotas, 350 ms minimum spacing, Retry-After/backoff persistence, aborts and stale-track guards apply. Matching fallback results use the bounded seven-day cache and retain their source on reload. Older untimed/negative cache decisions are rechecked under timing policy 5. No fixed Pieces lyrics are shipped in source or tests. Both sources can still lack a title or fail; the fallback cannot guarantee coverage or exact word-level singing from line timestamps.

Synthetic regression tests cover primary 503/404, search without an ISRC, source credit, mouth/emoji cues, cached reload during outage, wrong artist/version/duration/direct ISRC, invalid lyrics, independent quotas, two-provider backoff and stale cancellation. The actual Pieces by AVAION response (195.03 s) parsed into 20 timed lines; a simulated complete playback activated all 20, produced mouth movement and existing fly/love/sad emoji scenes while LRCLIB was mocked as 503. Only the real public data is used in the local inspection, outside the repository. GPU rendering, audible alignment on the user device and catalog-wide availability are not certified. All three suites pass.
