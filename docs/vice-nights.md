# Vice Nights, theme cycling, Show and home lyrics

Vice Nights is an original vector interpretation of a coastal city at sunset, neon night and dawn. It keeps SpotDeck's existing white eyes, mouth, singing and interactions. No official game assets or new external animation dependencies are loaded.

## Theme controls

Settings → Party & Jahreszeiten → Theme now includes Vice Nights. Manual selection stores Sunset Drive, Neon Night or Early Morning. Optional Auto rotates these moods after five visible minutes within Vice Nights. Winter has a separate manual/Auto selection that alternates Christmas lights/baubles with the existing magic/candle variant. It does not change the selected main theme.

Cycles wait for the current scene or preview to finish. When a playing song has between 250 ms and 45 seconds remaining at the boundary, the cycle also waits until its end or a track change. Pausing releases this wait. Unknown durations do not block cycling. Hidden-page time does not count. Manual choices and individual feature switches survive Auto; returning to Manual restores the saved choice. Changing Auto/manual selection restarts that cycle's timer.

## Thirty-four features

Six ambient layers: coastal palms, sun/clouds, lit skyline, water reflections, road traffic and distant birds. Ten scenes: cabrio cruise, pursuit, helicopter search, speedboat, diamond case, race, alligator, club entrance, delivery and mission card. Eight face moments: sunglasses, gold chain, bandana, phone, searchlight dodge, side-eye, loot celebration and coastal drink.

Ten additional stories bring the timed scene count to 28: a cartoon pickpocket and recovered wallet, loading a getaway van, a police checkpoint with reversing car, a diamond vault, a jet-ski jump, parcel drone, skateboard kickflip, paparazzi photo, rooftop parkour and neon street art. These are self-contained vector vignettes with conservative protected stage bounds. The four chase/crime/parkour stories respect the Action master; the others remain available in Calm. Camera glows stay local and occur only twice in their scene.

The original smiley drives with a vehicle around it during cabrio/race/pursuit/boat scenes, sways with the ride and reacts through existing expressions. Car rides use a front-facing windshield and grille without visible side-view wheels; independent passing side-view cars retain their wheels. Scene actors use the existing cover/text/toolbar exclusion geometry and viewport safe areas. Accessories fit inside the screen. Reduced motion uses static scene staging. One existing animation clock drives everything; canvas pixel budgets and TV sampling remain bounded. No growing scene residue is retained.

Ambient scenery extends to every canvas edge, including water, road and the final tint. Safe-area insets still protect foreground actors and controls, rather than creating a frame around the background. At most two smaller, subdued palms frame the outer edges. Their complete wind-swept bounds avoid the full face plus 24 pixels of movement clearance, as well as cover, song text and home captions. Where necessary a palm shrinks or is omitted. During Party/Show expansion both old and new face bounds remain protected until the transition finishes, including rapid reversal.

Every feature has an individual switch and preview. Action and face accessories also have master switches. Calm intensity excludes action scenes and increases surprise gaps; Party keeps the normal gap; More Action shortens gaps to 72% of normal. A shuffled scene bag and four-minute per-scene cooldown avoid repetitive scenes. Explicit previews may show disabled features for inspection.

## Automatic scene delivery

Vice schedules its first automatic scene after 12 visible seconds on entry or after automatic surprises are enabled. Subsequent gaps are 90–130 seconds for Few, 40–65 seconds for Normal and 22–35 seconds for Many, before the intensity multiplier. Existing Winter/Halloween gaps remain unchanged. Every other automatic choice prefers a full story over a small face accessory.

A due Vice scene no longer enters the short-lived lyric reaction queue. Its deadline stays due until it can start, allowing the current lyric scene to finish, with an eight-second maximum handoff wait. Open settings, library or full lyrics dialogs postpone it without losing the deadline. Unrelated preference edits preserve the countdown; hidden-page time pauses the remaining delay instead of resetting a full gap. No unavailable/disabled scene can clear a lyric reaction. The status in Vice settings shows the current scene or next start, and offers an explicit enable button when the saved automatic-surprise master is off. Manual mood selection controls sunset/night/dawn, independently of automatic stories.

## Show mode

Show is separate from Party; enabling one disables the other. Both hide controls after eight seconds with no open dialog. Party still wakes on pointer, touch and keyboard. Show ignores those wake events and leaves only a 44-pixel touch target with a small × in the top-left safe area. Clicking it returns to the normal view. Tab reaches it and native Enter/Space activation stays available. Hidden playback controls and the interactive face are inert; incidental touches cannot trigger playback or face gestures.

## Lyrics under the smiley

The optional home caption displays previous/current/next synchronized lines even when the full lyrics panel is closed. It shares the existing playback clock and lyric index, and the local-file timing offset where applicable. No provider or Spotify playback behavior changes. Plain lyrics cannot provide real synchronization; the caption then says synchronized lyrics are unavailable. Text is assigned through textContent. Mobile landscape reserves a compact three-line area below the face; portrait and desktop use a larger responsive area. Enabling captions reserves their height rather than overlaying playback controls.

Normal line changes scroll a four-row visual column upward by one complete row over 300 ms, within the fixed three-line viewport. The old current line moves into the previous position as the upcoming line moves into the center and becomes emphasized. The column does not fade out/in. Semantic/current text still changes immediately at its existing timestamp, without delaying singing. The visual column is aria-hidden. Repeated frames do not restart movement; rapid seeks cancel it rather than queueing more scrolls. Hiding captions/page clears the column. First available text, backward/large seeks, reduced motion and browsers without Web Animations use immediate updates. Caption height stays fixed.

## Verification

The existing nine suites remain required. `vice-show.test.cjs` covers all new preference controls, catalog, fair selection, mood transitions, scene/song-end deferral, hidden time, Winter variants, Show/Party input behavior, persistence, safe three-line text updates and full-row scrolling. `vice-mobile.test.cjs` exercises every Vice scene, three moods, reduced/normal motion, visible/hidden controls and eight viewport sizes, including phone landscape. `vice-auto.test.cjs` exercises real animation-frame automatic delivery, lyric queue contention, deadlines across seeks/settings/visibility, dialogs, disabled/category controls and the status/enable action. All twelve suites are required. Real device frame rate and logged-in Spotify playback require a separate device session.
