# Twenty Christmas additions

All additions retain the existing white face. The previous six winter scenes, accumulating snow, lyric-driven singing and playback remain available. No audio, lyrics provider, Spotify scope or external dependency was added.

| Idea | Identifier | Behavior |
| --- | --- | --- |
| Northern lights | aurora | Three slow translucent sky ribbons; stationary under reduced motion. |
| Light string | lights | Warm perimeter bulbs and a slow light wave; an elf can temporarily darken and repair one. |
| Traveling star | star | A large star and small trailing stars cross the sky; eyes follow it. |
| Falling gifts | gifts | Three parcels fall, settle on the snow floor, remain temporarily and can be nudged. |
| Curious reindeer | reindeer | A reindeer peeks in from the side; the original face looks toward it and recoils gently. |
| Christmas train | train | An engine and three lit gift carriages cross the lower scene; periodic plowing displaces existing snow mass. |
| Repairing elf | elf | An elf climbs a ladder toward a broken light, repairs it and triggers a light wave. |
| Hanging baubles | baubles | Four pendulums respond to pointer movement and settle through spring/damping physics. |
| Frost flowers | frost | Edge frost can be wiped locally and grows back slowly; wipe history is bounded. |
| Gingerbread chase | gingerbread | A gingerbread figure follows a rolling cookie, slips and stands again. |
| Decorating a tree | tree | A tree grows, gains ornaments and a topper, then stays temporarily beside the snow. |
| Chimney mishap | chimney | Santa's boots kick above a chimney before a parcel drops out. |
| Winter forest | forest | Two quiet pine layers have subtle pointer parallax. |
| Awakening village | village | Houses have sequential warm window lights and lightweight chimney smoke. |
| Snow globe | globe | A transparent circular outline and local snowfall surround the unchanged face. |
| Constellations | constellation | Progressive star connections form tree, gift, star and reindeer silhouettes. |
| Snow angel | angel | The face dips and sways, releases its cap snow and leaves a temporary angel impression. |
| Candy dominoes | candy | Six to nine candy canes topple in a staggered chain. |
| Bells | bells | Two hanging bells swing with expanding visual rings; no sound is played. |
| Unwrapping | unwrap | A parcel lid opens, stars emerge and a small decorated tree remains. |

## Controls and scheduling

Settings → Party & Jahreszeiten contains a direct preview selector and twenty-six individual switches inside the collapsed customization section. A preview can inspect a disabled feature without changing its automatic-play preference. Switching a feature off cancels its current scene and removes owned leftover scenery. The ambient master controls the seven background effects; automatic surprises controls the large-scene scheduler. Manual previews remain possible with these masters off. Decorations can be cleared explicitly.

The six background additions run independently of the one-large-scene slot. The nineteen new stories share that slot with the six existing winter scenes. A shuffled bag schedules all twenty-five eligible major scenes before repeating. Automatic head shakes do not restart the long scene gap, preventing them from indefinitely postponing the other stories. Lyrics and explicit face taps retain their existing behavior and gaze priority.

## Rendering and bounds

Two pointer-transparent canvas layers use the existing application RAF: a background and a story/scenery layer. Their backing budgets are at most approximately 1.2 million pixels each in quality and 650,000 each in TV mode. Background repainting is throttled to about 30/s in quality or 10/s in TV mode. There is no per-object timer or additional application animation loop. Decorations sit behind the existing player shell and retain its input handling.

Temporary scenery is capped at eight objects, wipes at sixteen, hanging pendulums at four and the scheduling bag at twenty-five entries. Scenery expires after 100 seconds; frost regrows after wiping. Gift and train interactions reuse the existing snow-displacement model, preserving deposited mass. Geometry is refreshed on resize, not read from layout every frame. Hidden tabs stop rendering and reset frame interpolation before resuming. Reduced motion uses still compositions, gifts at rest and non-swinging baubles.

## Validation

Run the existing four suites plus `node tests/festive.test.cjs`. The new integration suite checks all twenty entries and controls, every new story renderer at multiple phases, finite drawing coordinates, balanced canvas transforms, event cues, gift settling/nudging, bauble impulses, frost wiping, cancellation, saved switches, preview override, fair rotation, cleanup, bounded backing stores, hidden tabs and reduced-motion alternatives. Existing snow, playback and lyric suites remain required. The in-chat preview uses the production drawing routines and original white-face appearance without network or account access.

These checks exercise the model and drawing calls. They do not certify hour-long GPU performance on every phone or TV, real Spotify audio, or pixel-perfect alignment of every scene on every device.

The live browser check led to two placement refinements: the elf repairs a lamp near the free right edge, and ground actors use a snow-profile ledge above the visible dock. When Party hides the dock, they use the lower screen edge instead. The ledge mirrors the existing snow profile without adding or deleting snow mass. This keeps the figures visible rather than hiding behind album art or player controls.

## Six additional wizard-school animations

The original face and all twenty Christmas features remain. Six separately switchable additions extend the catalog to 26 features (seven ambient layers, eighteen new stories plus the six original winter scenes in the rotation). The settings section is now named 26 Winter- und Zauberideen anpassen.

| Identifier | Animation | Behavior |
| --- | --- | --- |
| wand | Zauberstab & Sternenzauber | A wooden wand draws a lavender star trail, finishes with a spell ring and sends a light wave through enabled lamps. |
| levitate | Schwebende Geschenke | Three parcels lift off, drift in small orbits, then return to gravity and settle. Interruption releases them too; reduced motion keeps them at rest. |
| spellbook | Fliegendes Zauberbuch | An opening book floats gently and releases luminous abstract glyphs. |
| broom | Magischer Besenflug | An enchanted broom sweeps over the sky with a star trail; the existing face follows it with its eyes. |
| candles | Schwebende Kerzen | Four candles in TV mode or eight in quality float at the upper edge with slow, non-strobing flames; reduced motion uses a still composition. |

The additions use the same canvas layers, single application clock, preview controls, persisted switches and existing resource bounds. No additional service, audio or external artwork is loaded. Run `node tests/magic.test.cjs` alongside the previous five suites. The dedicated checks cover levitation, interruption and settling, broom gaze, reduced motion, candle drawing, saved switches, manual preview and season cleanup.

A sixth magic scene adds round spectacles and a small golden lightning scar above the right eye as a temporary face-relative accessory. Base eyes, mouth, colors and face geometry are retained.

Album-cover bounds are measured on resize and Party layout changes. Wand/star/broom sky lanes, book/chimney/constellation/gift placements and hanging decorations use cover-aware staging; ground scenery can move sideways where necessary. The magic regression suite checks portrait/landscape cover clearance and accessory cleanup. This avoids placing recognizable actors behind the cover without moving or replacing the album itself.
