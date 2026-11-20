# Vice Nights, theme cycling, Show and home lyrics

Vice Nights is an original vector interpretation of a coastal city at sunset, neon night and dawn. It keeps SpotDeck's existing white eyes, mouth, singing and interactions. No official game assets or new external animation dependencies are loaded.

## Theme controls

Settings → Party & Jahreszeiten → Theme now includes Vice Nights. Manual selection stores Sunset Drive, Neon Night or Early Morning. Optional Auto rotates these moods after five visible minutes within Vice Nights. Winter has a separate manual/Auto selection that alternates Christmas lights/baubles with the existing magic/candle variant. It does not change the selected main theme.

Cycles wait for the current scene or preview to finish. When a playing song has between 250 ms and 45 seconds remaining at the boundary, the cycle also waits until its end or a track change. Pausing releases this wait. Unknown durations do not block cycling. Hidden-page time does not count. Manual choices and individual feature switches survive Auto; returning to Manual restores the saved choice. Changing Auto/manual selection restarts that cycle's timer.

## Twenty-four features

Six ambient layers: coastal palms, sun/clouds, lit skyline, water reflections, road traffic and distant birds. Ten scenes: cabrio cruise, pursuit, helicopter search, speedboat, diamond case, race, alligator, club entrance, delivery and mission card. Eight face moments: sunglasses, gold chain, bandana, phone, searchlight dodge, side-eye, loot celebration and coastal drink.

The original smiley drives with a vehicle around it during cabrio/race/pursuit/boat scenes, sways with the ride and reacts through existing expressions. Scene actors use the existing cover/text/toolbar exclusion geometry and viewport safe areas. Accessories fit inside the screen. Reduced motion uses static scene staging. One existing animation clock drives everything; canvas pixel budgets and TV sampling remain bounded. No growing scene residue is retained.

Every feature has an individual switch and preview. Action and face accessories also have master switches. Calm intensity excludes action scenes and increases surprise gaps; Party keeps the normal gap; More Action shortens gaps to 72% of normal. A shuffled scene bag and four-minute per-scene cooldown avoid repetitive scenes. Explicit previews may show disabled features for inspection.

## Show mode

Show is separate from Party; enabling one disables the other. Both hide controls after eight seconds with no open dialog. Party still wakes on pointer, touch and keyboard. Show ignores those wake events and leaves only a 44-pixel touch target with a small × in the top-left safe area. Clicking it returns to the normal view. Tab reaches it and native Enter/Space activation stays available. Hidden playback controls and the interactive face are inert; incidental touches cannot trigger playback or face gestures.

## Lyrics under the smiley

The optional home caption displays previous/current/next synchronized lines even when the full lyrics panel is closed. It shares the existing playback clock and lyric index, and the local-file timing offset where applicable. No provider or Spotify playback behavior changes. Plain lyrics cannot provide real synchronization; the caption then says synchronized lyrics are unavailable. Text is assigned through textContent. Mobile landscape reserves a compact three-line area below the face; portrait and desktop use a larger responsive area. Enabling captions reserves their height rather than overlaying playback controls.

## Verification

The existing nine suites remain required. `vice-show.test.cjs` covers all new preference controls, catalog, fair selection, mood transitions, scene/song-end deferral, hidden time, Winter variants, Show/Party input behavior, persistence and safe three-line text updates. `vice-mobile.test.cjs` exercises every Vice scene, three moods, reduced/normal motion, visible/hidden controls and eight viewport sizes, including phone landscape. Real device frame rate and logged-in Spotify playback require a separate device session.
