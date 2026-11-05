# Winter and Christmas season

The later [snow-shovelling child and optional local live-beat detector](live-beat.md) add automatic pile clearing and opt-in audio analysis. The original seasonal behaviour below remains available.

## Scope and original face

The November revision adds a season selector (Winter & Christmas, Halloween, Off). Winter is the new default and replaces a legacy Halloween-only preference on the first update. An explicit season selection persists normally. Party, transparency, motion, sound and tempo preferences are preserved. The original face, eye positioning, white eye/mouth colors, mouth contour and base movement remain; seasonal clothes and scenery are separate decorative layers. No lyric lookup or direct SDK playback behavior is changed by this revision.

The user reported that lyrics sometimes fail when SpotDeck itself is the Spotify output, while a separate Spotify browser player works. This is recorded as an unverified live-operation observation, outside this seasonal change.

## Snow behavior

The existing single RAF drives a bounded canvas snow simulation. Flakes settle on an approximate head collision surface and on a 128-cell floor. A separate 16-cell snow cap follows the original face. A heavy cap can start a shake when automatic surprises are enabled and the major-scene slot is free. Released cap mass becomes visible falling portions, which land in the floor rather than disappearing.

Pointer movement near the floor redistributes the pile and lifts some snow into falling portions. Pointer events pass through the decorative canvas; playback controls retain their normal interaction. Touch pointer movement uses the same behavior without a new capture/scroll handler. Window/face resize updates the collision geometry and preserves collected snow mass. Snow piles are in-memory scenery, not persisted across reloads.

Floor display height compresses gradually to a maximum of 50 CSS pixels (or 6.5% of a short viewport), keeping the player readable during long use. Stored mass remains in fixed-size arrays. Overflow falling portions merge into existing portions instead of growing the collection or deleting deposited mass. The explicit Snow clear action and disabling winter/ambient snow reset the scenery.

Budgets are 110 airborne flakes on desktop quality, 68 on narrow mobile quality and 44 in TV mode, with at most 64 falling portions. Canvas backing pixels are capped at approximately 2.1 million. Measured automatic TV fallback also reduces snow density. There is no additional application animation loop, per-flake timer, audio analysis or per-frame layout measurement. Hidden tabs pause the simulation without catch-up. Reduced motion stops snowfall and shivering; existing snow stays static. Ambient can turn snow off independently of winter scenes.

## Scenes and controls

Six bounded major scenes share the existing one-scene queue: sleigh (with following gaze), Santa hat, scarf, ice/shivering/breath, snowman and shaking off snow. Existing tap reactions retain gaze priority. Scene frequency and automatic surprises reuse the existing controls. Christmas/snow words can request seasonal scenes; ordinary lyric-driven reactions still use the existing mouth and emoji system. Easter-egg confetti uses winter decorations in winter mode. Halloween remains explicitly selectable.

Settings offers a scene preview action and Snow clear. The default frequency remains spaced apart rather than constantly replacing the face. Scene preview is explicit and works even with automatic surprises disabled.

## Verification

Run the four dependency-free suites:

```sh
node tests/spotdeck.test.cjs
node tests/halloween.test.cjs
node tests/lookups.test.cjs
node tests/winter.test.cjs
```

Winter tests cover migration, preserved preferences, six scene lifecycles, gaze/shivering, head collision, autonomous shaking, mass transfer through falling portions to the floor, pointer/resize mass conservation, TV/mobile/retina limits, hidden tabs, reduced motion, clearing and persistence. Bounded simulations exercise minute-long operation. Original face CSS blocks and mouth markup were compared to the previous working source and are unchanged. The interactive in-chat preview uses the existing white face appearance and seasonal graphics; it is a focused development preview, not a logged-in Spotify session.

Physical phone/TV performance, hour-long rendering and audio playback still depend on the user's device. The model uses an approximate head surface and lightweight snow mass transfer, not full rigid-body simulation.
