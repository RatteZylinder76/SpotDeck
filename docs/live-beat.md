# Live beat detection and snow shoveller

## Operation

Settings → Musik live im Takt erkennen offers an explicit Start/Stop control. The microphone can hear music from speakers, including playback on another device. Desktop browsers may instead offer sharing a music tab with audio. Capture starts only in a button gesture and is never restarted from saved preferences or on reload. Denied permission, unavailable capture and a share without audio leave the face in its existing free dance mode.

Spotify's Web Playback SDK exposes playback state and control, not an application audio analyser. No SDK iframe, protected stream or Spotify credentials are intercepted. The optional analysis receives only the source the user explicitly shares. Display sharing requires a video track: the browser may show a screen-sharing indicator, but SpotDeck reads no video frames. Only audio is analysed, without recording, upload or playback of captured sound. A zero-gain sink keeps the Web Audio analysis graph live without feedback.

The default microphone choice is useful with speakers, not headphones. Tab audio support and protected-content capture depend on the browser and operating system; a silent stream cannot produce a beat. Microphone room noise, weak percussion and syncopation may prevent a stable result. BPM and phase are estimates, not a promise of sample-accurate Spotify synchronization. The user's beat delay, half/double speed, manual BPM and tap correction remain available while a live source is active. Mouth movement remains driven by lyrics, independently of BPM.

## Detector and lifecycle

LivePulseTracker analyses 2048-point spectrum frames and time-domain RMS within the existing single animation loop, at most every 20 ms. Positive spectral flux combines bass (40–190 Hz) and mid frequencies (190–2500 Hz). An adaptive 48-frame threshold and a 210 ms refractory period reject weak/noisy transients. At least eight onsets spanning 3.5 seconds are needed. A bounded search fits 70–180 BPM grids to at most 24 recent weighted onsets and accepts only strong grid agreement. The history retains at most 48 events / 16 seconds. Initial aliases favour the slower compatible pulse; half/double ambiguity is exposed through the existing speed control. No per-analysis network request or separate interval/RAF is created.

The grid tracks phase as well as tempo; updates preserve the current local phase before gently correcting it against observed onsets. Grid origins are rebased in whole two-beat groups to avoid errors from long browser uptimes and preserve left/right sway. Silence, suspended audio, track changes and long frame gaps invalidate the previous estimate. Hidden pages pause analysis and reset the grid, then reacquire when visible. The media grant stays active until Stop (clearly indicated), page exit, disconnect, or starting the owned-audio test source. Stop releases all audio/video tracks, disconnects nodes and closes the context. Epoch guards release late permission grants after cancellation. There is no MediaRecorder, saved audio, automatic grant reuse or external beat service.

## Snow child

When winter snowfall and automatic surprises are enabled, a pile at least 12 CSS pixels high can summon one small child with a hat, scarf and shovel. It walks from the right, scoops part of several neighbouring cells, carries visible snow, and throws it into a side bank. At most three trips run per visit, followed by a 25-second rest. The bank itself is excluded from the working area. Carried snow participates in totalMass; cancellation returns it to the floor. Existing 128-cell and 64-chunk limits remain. The child has no independent timer or animation loop.

The route and shovel stay clear of the cached album-cover bounds. When controls are visible, a snow ledge above them mirrors the stored pile, so the child stays above the buttons. A geometry change that blocks the route ends the visit safely. Reduced motion freezes the scene. Season, snowfall, surprise controls and Snow clear cancel it. “Schneehaufen & Kind zeigen” creates a small demonstration pile and lets the same automatic shovelling logic run. The original face artwork and lyric system are unchanged.

## Validation and limits

Run `node tests/shovel-beat.test.cjs` along with the six existing suites. New tests use synthetic spectral pulses at 72, 80, 97, 120, 142 and 172 BPM; they check phase against the known onset, jitter, a missed beat, silence and irregular transients. Media fakes cover explicit opt-in, zero playback gain, stopping tracks/contexts, late grants, missing audio, denial and page exit. Snow simulations cover autonomous threshold, gradual redistribution, mass conservation including carried payload, cover avoidance, bounded particles and cancellation. No real microphone, account or private audio is accessed by tests.

Actual microphone and tab capture with party music still needs verification on the user's device; synthetic tests establish algorithm behaviour, not recognition accuracy for every recording.

Primary API references: [Spotify SDK reference](https://developer.spotify.com/documentation/web-playback-sdk/reference), [MDN getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [MDN createMediaStreamSource](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource).
