# Halloween and timing architecture

The newer [Party and metadata update](party-lookups.md) supersedes the original presentation controls and tempo-settings layout described below. The Party exit now hides too, and the idle face grows dynamically.

## Findings in the previous version

`loadVibeAudio()` requested Spotify audio features and silently used 620 ms when that failed. This corresponds to about 96.8 BPM; it was a preset, not detected tempo. The 320–900 ms clamp also collapsed very slow and fast tempi into unrelated limits. `updateVibeMotion()` divided track position by that interval, implicitly putting the first beat at position zero. There was no downbeat/phase measurement. A valid BPM alone cannot identify a song's first beat or tempo changes. Incoming playback polls reset the position anchor, so polling latency could shift the movement phase.

Spotify's private app access status cannot be inferred from its public client ID. Audio Features/Audio Analysis have restricted availability for newer/development applications; the implementation therefore no longer depends on those endpoints. It does not capture, decrypt, route or analyse Spotify audio. The existing PKCE flow, Web Playback SDK, controller, transfer, library and transport remain in place.

Spotify prohibits synchronization of its recordings with other visual media and lyrics. Consequently, Spotify uses autonomous dance, moods and Halloween scenes, and its lyrics remain readable without timed face cues or automatic line highlighting. Word-timed singing, beat tracking and offset controls are exercised with the separate local test source after the user confirms the necessary rights. Selecting a file does not play or analyse it. Starting it first pauses Spotify; a failed pause blocks the test. The two sources are not intentionally mixed, and SDK/polled playback changes stop the test if Spotify resumes. No file is uploaded, recorded or retained in browser storage.

References: [Spotify policy](https://developer.spotify.com/policy), [compliance guidance](https://developer.spotify.com/compliance-tips), [endpoint availability change](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api).

## Beat clock and movement

`BeatEngine` owns raw BPM, source, confidence, dance multiplier, offset, transport anchor and phase. Its clock uses `performance.now()` between permitted audio-position samples; small drift is corrected gradually, while explicit seeks and large discontinuities reconstruct the anchor. Pauses freeze it, resumes reanchor it, and a new source clears onset history. Without tempo, movement is explicitly free-running rather than presented as detection.

Manual and tap inputs preserve raw 70, 140 and 280 BPM as distinct values. The default dance cadence folds them into the 80–160 BPM range, with explicit half/double multipliers. Manual BPM is identified as manual. Tap tempo uses a median after at least four taps and anchors the beat to the tap. The local Web Audio path uses an AnalyserNode, positive spectral flux, an adaptive threshold, a refractory interval and a bounded onset history. Automatic interval voting selects a canonical 80–160 BPM estimate; octave ambiguity remains. A small phase correction follows observed onsets. This is a lightweight estimate, not a claim of accurate beat/genre/downbeat detection. Manual tempo and offset remain useful for tracks with syncopation or tempo changes. No additional BPM library, worker or animation loop is required.

The existing transform variables still own the face's transform. A larger jump arc, damped landing, squash/stretch, alternating tilt and subtle eye response share the existing smoothing and scale with figure size. RMS-derived intensity is only used for the permitted source; Spotify's free dance varies on its own. Bounce, sway, shuffle and a slowly varying combination are selectable. Reduced motion continues to suppress large movement.

## Word timing and reactions

LRCLIB documents `hasWordSync` and YAML `lyricsfile` records. A pinned, embedded js-yaml 4.1.1 parser reads the Lyricsfile 1.0 draft using its JSON schema; the full MIT notice is included in index.html and THIRD_PARTY_NOTICES.md. Size/count limits, duplicate-key rejection, timestamp validation and anchor/alias rejection keep imports bounded. Invalid word files fall back to available LRC/plain text. The draft's unresolved metadata offset is rejected with a helpful message; SpotDeck's explicit offset is used instead. Explicit overlapping line/word ends are retained. The single face follows the current line; it does not claim to render simultaneous singers independently.

Actual word starts are marked `timing: word`. Missing word ends use the next word, explicit line end or a short bounded estimate. Line-only lyrics remain `timing: estimated`: syllable groups, held vowels, punctuation pauses and realistic line-length limits replace simple character weights. The mouth retains one continuously morphed contour. Estimated object cues are delayed conservatively; ambiguous Halloween words are skipped without word timing. This reduces premature guesses but cannot make line-only timing exact. Positive lyrics offsets delay both displayed highlighting and face cues. Identical repeated lines can produce a restrained chorus reaction; this is exact text repetition, not structural music analysis.

Theme recognition handles additional German/English variants. Love, fear, sadness, fire, water, sleep, joy and magic have multiple facial reactions. A maximum-eight-item priority queue discards expired cues and respects cooldowns. Higher-priority moods resist lower-priority replacements; explicit taps and Overdrive take precedence. Singing, head movement and props still combine through the same frame loop.

References: [LRCLIB API](https://lrclib.net/docs), [Lyricsfile specification](https://github.com/tranxuanthang/lyricsfile/blob/main/SPECIFICATION.md), [AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode).

## Halloween and presentation

Halloween and Party default off and persist locally. Ambient decoration, automatic surprises, scene frequency and dance pattern have separate preferences. A single elapsed-time scene manager drives ghost/startle, bat/duck, slipping pumpkin hat, cute vampire, failed spell, skeleton companion, cover ghost, spider, shadow and flying pumpkin. Scenes use existing moods plus new startled, duck and vampire poses. Only one major scene runs; its DOM is removed on expiry, mode-off or tab hiding. The normal presets leave 75–90, 45–75 or 30–45 seconds after a scene. The Halloween Overdrive substitutes pumpkin/ghost confetti. There is no strobe effect or continuous canvas loop.

Party mode keeps metadata and cover visible, enlarges the face on wide screens, and hides player controls after eight seconds of inactivity. Hidden controls are inert. Pointer/touch or any key reveals them; the first key wakes without activating a hidden action. Arrow keys navigate visible player actions spatially, leaving native fields and dialogs alone. The initial edition kept the exit visible; the newer update hides it too and adds dialog-aware Escape. Open dialogs prevent hiding. Fullscreen and Screen Wake Lock retain their existing implementation. Neither mode auto-enables fullscreen, and browser DRM capabilities are unchanged.

## Verification (2026-10-30)

- Existing `node tests/spotdeck.test.cjs` passes unchanged scenarios for SDK/controller functionality, motion, taps, one RAF, persistence and seeking.
- `node tests/halloween.test.cjs` covers ten scene lifecycles, exclusive scenes, cleanup, bounded queue/timers, emotion priority, 70/140/280 BPM, tap/onset estimates, clock jitter, pause/resume/seek/offset, YAML validation/fallback, word gaps, rights gating, source controls, failed Spotify pause, no deprecated tempo calls, Party wake/exit and hidden-tab cleanup.
- The actual Chromium-based in-app browser loaded the generated 28-second, 120-BPM WAV and a locally generated word-timed Lyricsfile. Live diagnostics estimated about 120.5 BPM, labelled as estimated, and recognized the word timestamps. This synthetic result is not an accuracy guarantee for real music or an audible-hardware certification.
- Party layouts were measured at 390 × 844, 844 × 390, 1024 × 768, 1920 × 1080 and 3840 × 2160. No horizontal overflow or exit/top-action overlap occurred; main controls stayed within the viewport. Face sizes were approximately 249, 155, 368, 566 and 880 px respectively. Inactivity hiding and the pumpkin-hat scene were visually checked.
- Safari, independent Firefox/Edge, physical mobile/TV browsers, TV remote hardware and real Spotify Premium/DRM playback were not available for a new end-to-end certification. Existing simulated SDK/DRM fallback checks still pass. The code retains vendor-prefixed glass effects, opaque fallbacks, reduced transparency and reduced-motion behavior.
