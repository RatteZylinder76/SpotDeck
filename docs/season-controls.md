# Calm seasonal controls (November 2026)

## Fixed decoration selection

Settings → Party & Jahreszeiten now has a saved “Harry-Potter-Zauber” checkbox, off by default. With it off, the light string and baubles remain selected, and automatic magic stories are excluded. With it on, floating candles take their place and the four magic stories plus wizard glasses join the automatic selection. Existing individual switches remain saved; toggling the master does not overwrite them. Disabling magic cancels an active magic scene. Explicit previews remain available independently of the master and expire normally.

There is no longer a 45-second decoration rotation. The elf's repair scene temporarily gets the light arrangement without candles; the user's selected arrangement returns when it finishes. Turning off candles individually allows the Christmas decorations to stay visible even with magic enabled. Reduced-motion users also get the fixed arrangement.

## Longer gaps and recurring elf

Automatic surprise gaps are 3–4 minutes for Few, 90–150 seconds for Normal, and 60–90 seconds for Many. Active scenes are allowed to finish. The elf becomes due after the first 90 seconds and then receives priority for the next available automatic scene slot every four minutes after its last selection/start. This avoids waiting for an entire bag of 25 possible major scenes. The individual elf switch and automatic-surprise master still apply; this is a scheduling preference, not an exact wall-clock playback promise. Manual previews and hidden-page pauses can delay the next slot.

## Bounded accumulation

The floor's visual height limit is now the smaller of 16 CSS pixels and 2.8% of viewport height. Each cell retains at most two times that height in area-equivalent mass on deposit. Excess new snow melts instead of increasing the pile forever. Snow pushed into an already full cell gradually melts toward capacity with a lightweight exponential decay. Resizing to a shorter screen also lowers the capacity without clearing the scene. The shoveller responds at 55% of the new visual limit, so it still works on the thinner layer. Head accumulation, shaking, snowfall and the snow-free playback area remain available.

`meltedMass` accounts for material that has left the visible simulation; `totalMass()` includes this ledger, carried snow, falling chunks and retained floor/head snow. Existing transfer-conservation checks remain useful. Clear resets this ledger too. This replaces the older unlimited floor-storage behaviour described in the original winter documentation.

## Checks

The decoration suite tests fixed arrangements through one hour of elapsed time, all individual switch combinations, saved opt-in state, cancellation, previews, recurring elf scheduling and longer gaps. Accumulation tests repeatedly fill every cell at phone portrait, phone landscape and desktop sizes, verify the cap/thin visual layer, check melting accounting and ensure the child still appears. The remaining scene, playback, lyrics, beat and mobile-layout suites remain part of verification. Physical phone performance and recognition of live music are separate from these seasonal changes.
