# Decisions log

Each entry records the decision, why, and what was rejected. Add to it as the build goes. Rakesh can override anything here; when that happens, log the change.

## Stack
- **Decision:** Three.js + GSAP, vanilla JS on Vite, hosted on Vercel.
  - **Why:** The brief is judged on design, and the attract state is its most important screen. One lit stage with directed camera moves makes that screen and the transitions real rather than faked.
  - **Rejected:**
    - Google model-viewer (see "Rejected AI suggestions").
    - React Three Fiber: a framework to justify, with no gain at this size. Plain Three.js maps closely to how Unity works.
    - camera-controls / OrbitControls: visitors don't orbit the camera, they turn the costume (see "Interaction model").
    - Needle Engine: its free tier requires Needle branding to stay visible.
    - Babylon.js: heavier download, no gain here.
    - PlayCanvas: projects live in its cloud editor, which fights normal Git history.
    - Unity/Unreal WebGL: too heavy for iPad Safari in under 3 s. Pixel streaming costs money.

## Build order
- **Decision:** make it work first, then make it beautiful, then make it solid (see PLAN.md). Phase 1 looks plain but uses the final structure: every mode change is already a GSAP timeline, all copy comes from content.json with `en` and `ar` slots, and the CSS uses logical properties and tokens.
  - **Why:** a complete, usable app on the iPad early proves the interaction model before time goes into looks. Because the structure is final from the start, polishing means tuning timelines and tokens, not rebuilding.
  - **Risk:** the attract state and the transitions carry the most weight in the brief, and they come second. Covered by the halfway rule in PLAN.md: if Phase 1 runs over, Phase 1 gives way, not Phase 2.
  - **Rejected:** building the attract state straight after the camera step (see "Rejected AI suggestions").

## Stage
- **Decision:** one dark stage. The three costumes stand in a row on plinths, each with its own spot key; a costume that isn't in focus goes dark.
  - **Why:** a costume switch becomes a camera move on one set, so it can't feel like a page swap. Everything loads once, so nothing ever flashes blank.
  - **Rejected:** three separate viewers with a crossfade.

## Interaction model
- **Decision:** a turntable, not an orbit camera. A horizontal drag turns the costume; the camera is only moved by the director.
  - **Why:**
    - It's what the brief describes ("drag rotates it", "turns the dress").
    - The key light stays fixed, so it rakes across the fabric as the costume turns, like a real vitrine turntable.
    - Framing stays stable for someone standing at 1.5 m.
    - The camera stays free for authored moves.
  - **Rejected:** free orbit. It lets visitors lose the costume and makes framing unpredictable.
- **Decision:** no pinch zoom on the model.
  - **Why:** close-ups are authored through hotspots, and the costume stays readable on screen.
- **Decision:** horizontal drag only.
  - **Why:** garments are read by walking around them, not from above.
- **Decision (2026-09-25):** the costume follows the finger. A drag turns the costume by the drag distance divided by the costume's on-screen radius, so the fabric under the finger roughly stays under it at any camera distance (×1.3, because the fabric sits nearer the axis than the costume's outer edge).
  - **Rejected:** a fixed number of degrees per pixel. It feels right at one zoom and slippery or sticky at every other.
- **Decision:** touching a spinning costume stops it, like a hand on a real turntable. Holding the finger still before lifting releases it with no spin.
- **Numbers:** auto-rotate 0.25 rad/s (one turn in ~25 s), back 3 s after the last touch with a 1.5 s ease-in; spin clamped at 10 rad/s; inertia decays at 2.2/s; `.spinning` above 3.5 rad/s, cleared below 1.2 rad/s.
- **Decision:** each plinth has a small index mark at its front edge.
  - **Why:** a plain disc turning looks still. The mark shows the turn, and shows where the front is when the back is facing.
  - The plinth is sized from the costume's base (its widest point in the lowest 10 cm), so a gown's hem never hides it.

## Framing
- **Decision:** a hotspot push-in stops at a medium shot; the extreme close-up is the story image.
  - **Why:** it's two scales of the same detail, like a medium shot plus an insert, and the garment stays readable on screen.
- **Decision:** the story panel makes room through lens shift (`setViewOffset`), not by moving or shrinking the costume.
  - **Why:** the perspective stays the same, so it reads as a camera choice rather than a UI resize.
- **Decision (2026-09-25):** the camera stands level at eye height (1.4 m) and never tilts or pans. It frames the costume with lens shift, like the shift lens on a view camera. It moves only by trucking, raising or dollying.
  - **Why:** verticals stay vertical, which is how museum costume photography looks. From eye height the visitor looks slightly down onto the plinth, which makes the turntable read. The same lens shift that frames the costume also makes room for the story panel, so there's one mechanism, not two.
  - **Rejected:** a camera that aims at the costume (`lookAt`). Tilting down converges the verticals, so the costume leans back, and the framing would need a second mechanism for the panel.
  - *Rakesh to confirm the eye height by eye.*
- **Decision:** lens around 30° vertical FOV (~45 mm full-frame vertical equivalent). *Rakesh to confirm.*
- **Decision:** tone mapping AgX or Neutral. *Rakesh to choose by eye and log why.*

## First view
- **Decision:** an HTML still of the attract shot shows instantly; the live scene dissolves in once the three models load. The still is captured from the live scene, so the dissolve is invisible.
  - **Rejected:** a loading spinner, which is a dead first impression in the most important screen.

## Choreography
- **Decision:** every camera, light and UI move is a GSAP timeline, and input is locked while one runs.
  - **Why:** camera, light and panel are timed on one timeline, like an edit.
- **Decision:** the tour is a single timeline, so a touch pauses it and a tap resumes it.
- **Decision:** the 45 s idle timer pauses while the tour plays.
  - **Why:** otherwise a visitor who is watching the tour without touching gets sent back to the attract state.

## Hotspots and story (steps 4–5)
- **Decision:** four hotspots on each real costume: two front, one side, one back (tour order front → side → back). The back one (the National Costume's cape, the armour's backplate) only appears and only becomes tappable once the costume is turned round. Checked.
- **Decision:** a hotspot's `normal` is the direction the detail is best seen from, rounded by hand from the measured surface normal.
  - **Why:** scan surfaces are noisy. The breastplate's raw normal points 45° sideways, so opening its story would turn the armour to an odd angle.
  - **Rejected:** raw normals straight from the tap tool.
- **Decision:** positions measured with `dev.probe` (a ray fired at the costume from a chosen side and height) and checked with markers on the model, rather than by hand-tapping.
- **Decision:** in a story, the active hotspot keeps only its ring (its label would collide with the panel, whose title already names it). Other hotspots hide.
- **Decision:** closing a story is its own timeline (panel out, camera back to the full costume), not the opening timeline reversed.
  - **Why:** a literal reverse would also turn the costume back to where it was. Leaving it facing the visitor, then letting auto-rotate ease in after the usual delay, reads calmer.
- **Decision:** a label that changes side as the costume turns fades back in instead of jumping, with a 12 px dead zone at the centre line so it doesn't flicker. ("Nothing snaps.")
- **Decision:** a tap on the stage also closes a story, as well as the × button.
- **Decision:** layout and camera use the same portrait test, `matchMedia('(orientation: portrait)')`.
  - **Why:** found a bug on a square screen. CSS counts a square as portrait, the JavaScript didn't, so the camera framed for a side panel while a bottom sheet opened.
- **Open (Phase 2):** when a label fits on neither side (narrow screens), place it above the ring instead of across the costume.
- **Content:** English copy is a draft from what's visible on the scans and the Royal Armoury's descriptions. Every hotspot is `invented: true` until Rakesh checks it against sources. Images have planned file names; until the renders exist, the panel shows "Image to come".

## Switching, idle and the basic attract state (steps 6–7)
- **Decision:** in the attract state, a tap anywhere enters the costume nearest the touch on screen.
  - **Why:** from 1.5 m, on a small lineup, visitors miss the costume itself. The nearest one is what they meant.
  - **Rejected:** a raycast hit only, where a near-miss does nothing and reads as broken.
- **Decision:** the selector shows while exploring and in a story, and hides in the attract state, which invites touching the costumes themselves. Tapping the current costume from a story closes the story.
- **Decision:** switching from inside a story is one timeline: the panel slides out while the camera travels. Never two moves in a row.
- **Decision:** in portrait, the story sheet sits above the selector's band, so the selector is always reachable. The camera's story region is taken from where the panel actually sits (`offsetLeft/Top`), not from its size alone.
- **Decision:** idle reset is one timeline: close the story, clear found state, reset the language, back to the lineup with every costume lit. If a move is already running when the timer fires, it retries a second later.
- **Fix:** `director.play()` now keeps a timeline's own `onComplete`. Setting its own callback had silently replaced the one that hides the other costumes after a switch; a scripted run caught it.

## Attract state (step 8)
- **Problem (Rakesh, on the iPad):** on the lineup, each costume got a third of the width, about 5 cm tall on an 11" screen. Too small to stop anyone from a distance.
- **Decision:** a loop like a film sequence, about 36 s: a wide shot (3.5 s), then each costume as a hero shot (~8 s), then back to the wide shot.
  - In the hero shot, the costume fills the height of its side of the screen, about 2.4× larger than on the lineup. Its key light swells while the others fall to 10%. Changing light is what catches the eye from across a room.
  - The wide shot stays, briefly, so visitors see there are three. It's the only place all three are shown together (a "Your call" answer).
  - **Rejected:** the static lineup (too small from a distance); cycling hero shots only (the visitor never learns there are three).
- **Decision:** one headline position for the whole loop, laid out like a poster. Landscape: a column at the inline end, with the costume framed beside it through lens shift. Portrait: headline below, costume above. Only the camera moves; the type never jumps.
- **Decision:** the hero turns once: it settles facing front as the camera arrives, turns to show its back, pauses there for 1.6 s, and turns home. While its back faces the visitor, a ring pulses on the back hotspot. It shows, without words, that there's something to find by turning.
- **Decision:** the headline's accent rule and the invitation's ring take the hero costume's accent colour, so the whole screen changes with the costume.
- **Decision:** a tap enters the costume in the hero shot, wherever the finger lands (the one being shown is the one the visitor means). In the wide shot, the costume nearest the touch.
- **Decision:** the loop is not a locked transition. A touch interrupts it at any moment; the idle reset starts it again from the wide shot.
- **Seen in the hero shots:** the National Costume's cape scan hole and its 40 cm float above the plinth are much more visible at this size. Both are decisions in "Models and licences".
- **Revision (2026-09-25, after Rakesh's iPad review: "make the costumes bigger on the main page"):**
  - Costumes stand 1.8 m apart instead of 3 m. The wide shot is about 1.6× larger, and in a hero shot the dimmed neighbours at the edges read as a gallery around it.
  - Hero shots frame the garment, not the plinth: 6 cm below the garment, a 3% margin, and 24 px from the screen edges. A mounted costume's rod and plinth run out of the bottom of the frame. The National Costume's hero shot is about 1.5× larger.
  - The headline column narrowed from 40% to 35% of the width.
  - Key lights narrowed from 20° to 15° so they don't spill onto the closer neighbours, and each aims at its garment's own middle (it mattered once a costume was mounted).
  - **Kept:** the costume beside a headline column in landscape. For a tall figure it gives the most height; text under the costume would shrink it.
  - **Rejected:** text as a lower third over the costume (it covers the feet, and framing above it makes the costume smaller).
- **Decision (2026-09-25):** the National Costume floats at its real height above the plinth, with no mount (Rakesh's call; see "Rejected AI suggestions"). Hero shots frame the garment, so the gap below it falls out of frame there.

## Explore view (revision to steps 5–6, 2026-09-25)
- **Decision (Rakesh's idea):** the story panel is a column at the inline end in **both** orientations, with the costume beside it.
  - **Why:** a costume is tall and narrow. On an 11" iPad in portrait, the bottom sheet left the costume about 390 px tall; beside a column it keeps about 930 px (2.4×). The panel keeps about 400 px of width.
  - **Rejected:** the portrait bottom sheet. It suits phones, and the brief is 10–13" screens.
  - In a narrow panel (under 420 px wide, a container query) the chapter tabs stack, so no label wraps or clips. The medium shot uses a crop narrower than it is tall, to suit the column.
- **Decision (Rakesh's idea):** the costume's title card (title plus one line of wearer/place context, the brief's museum label) sits centred above the costume while exploring. It arrives once the camera lands and leaves as soon as the camera moves (switching, a story, attract). The top band grew from 96 to 128 px for it, so the costume is about 5% smaller while exploring.
  - **Why:** a visitor who walks up mid-visit has to know what they're looking at. Until now, only the story panel and the selector named the costume.
- **Fix:** label fades now overwrite each other. A side-flip fade-in that was still running could win over the "hide" that starts a story, leaving a label over the panel.
- **Open:** a "Now showing: …" caption on the attract screen (Rakesh to decide).

## Transitions (step 9)
- **Decision:** motion tokens. Every duration and ease comes from `src/motion.js`, the way layout sizes come from `tokens.css`. Camera moves use `power3.inOut` (slow to start, slow to land, like a dolly on rails). Panels arrive fast and settle (`…out`) and leave by accelerating away (`…in`). The attract loop's glide is slower and softer.
  - **Why:** one place to tune how the whole piece moves, and consistent motion is part of "one shared system".
- **Decision:** the story's connected transition. As the panel settles, a hairline in the costume's accent draws from the hotspot ring to the panel's title, and the close-up grows out of the ring into its place in the panel (a copy flies there, then hands over to the real image). The line follows the ring every frame, from the 3D projection rather than a layout read.
  - **Why:** the brief asks for "a connected story transition", and that "a close-up should feel like leaning in". Growing from the exact spot makes the image the insert shot of that detail.
  - **Rejected:** a crossfade or a plain slide-in, which reads as a page swap.
- **Decision:** switching costume, the arriving costume keeps turning the way it was going and settles facing front as the camera lands (never more than one turn). The first view of every costume is its front.
- **Decision:** first-reveal bloom. The first time a back hotspot turns into view during a visit, its ring swells and fades twice in the accent colour. Never again for that visitor; the idle reset clears it.
  - **Why:** "reward curiosity". Turning the costume round is the behaviour the brief wants to encourage, so it gets a moment the first time it pays off.

## Performance
- **Decision:** keep about 40 fps or better on Rakesh's older test iPad, and 60 fps on a current iPad.
  - **Measured:** 42 fps at step 1 with one stand-in box, pixel ratio 2 and antialiasing on. The costumes, environment light and spot keys will cost more, so the frame rate has to be managed, not just hoped for.
  - **Why the older iPad counts:** it's the worst case. If the experience holds there, it holds on kiosk hardware.
  - **Test device:** iPad 5th gen (2017). The kiosk will use a newer iPad.
- **Decision (2026-09-25):** cap the pixel ratio at 1.5 for now, instead of 2. `?dpr=` overrides it for measuring.
  - **Why:** the iPad 5th gen has a 2× screen, so at 1.5 it draws about 56% of the pixels. Most of its frame time goes on filling pixels, not on geometry.
  - **Next:** a start-up quality check picks the pixel ratio once, while the first screen shows. That gives 2× on a strong iPad and less on a weak one.
  - **Measured (2026-09-25, stand-ins, iPad 5th gen):** pixel ratio 1 and 1.5 both hold 60 fps; 2 drops to 30 fps. This confirms the cost is filling pixels.
  - **Measured (2026-09-25, after steps 4–7, real models, iPad 5th gen, pixel ratio 1.5):**
    - 30 fps in a Safari session that had been through many dev reloads; **54 fps after quitting and reopening Safari.** Above the 40 fps floor.
    - The 30 fps was most likely memory left over from earlier page loads (each reload makes a new WebGL context and the old ones aren't always freed at once), so it was the test session, not the app. A kiosk runs for days, though, so step 14 adds a **soak test**: leave it cycling for a few hours and check the frame rate holds, to rule out a real leak.
    - Remaining costs, if we need headroom later: the armour's 450k triangles (normal-map bake → ~150k), antialiasing on a 1.5× canvas, and the three spot lights every pixel pays for. Step 13's start-up quality check stays planned, but it's no longer urgent.
    - The kiosk will be a newer iPad; the iPad 5 stays the worst-case test.

## Model pipeline
- **Decision (2026-09-25):** `npm run models` uses the gltf-transform library, not its command line, so each texture type gets its own size. Rakesh approved the dev-only packages.
  - **Texture sizes by slot:** colour and normal maps 2K (they carry the weave), roughness/metalness and occlusion 1K (they read the same at half size). All WebP.
  - **Stored tangents removed:** three.js derives them in the shader when a mesh has none, so they only cost file size and GPU memory. Checked on Glafira at close range: no visible change.
  - **Primitives joined by material before simplifying:** fewer draw calls (Glafira 7 → 2). It also removes the borders Sketchfab adds when it splits meshes at 65k vertices, which simplifying would otherwise have to preserve.
  - **GPU budget:** about 100 MB of textures per costume, so all three stay around 300 MB on a 2 GB iPad. The script prints each model's estimate.
  - **Rejected:** the CLI's single `--texture-size` for every map. Either the roughness maps waste memory, or the colour and normal maps lose the weave.
  - **Result:** Glafira 3.8 MB → 2.98 MB, ~101 MB GPU (from ~134 MB). The dress 2.26 MB → 2.19 MB.
- **Decision (2026-09-25):** scans and odd exports are fixed in the pipeline, not in the app, so the app can assume ARCHITECTURE.md's convention (feet or hem at the plinth, front +Z, centred on the axis).
  - Node transforms are baked into the vertices. Sketchfab wraps models in rotated, scaled root nodes.
  - `place: { rotateY, height, lift }` per model: turn to face +Z, scale to real height, centre on the axis, lift the lowest point above the plinth.
  - `clampUVs` per model, for single-atlas scans whose edge UVs stray a hair outside 0–1 (that stopped UV quantisation). Never used on tiling UVs.
  - Any texture slot not listed in the size table (e.g. `specularTexture`) is still compressed, at 1K. Found when the King's specular map shipped as a 2K PNG.
  - **Rejected:** fixing orientation with `yawOffset` in content.json. The plinth's front mark and the hotspot maths assume the model's front is +Z in its own space.

## Models and licences
- **Rule:** CC BY, CC BY-SA or CC0. Never NC (non-commercial) or ND (no derivatives), and never marketplace "Standard" or "Royalty Free" licences. The site serves each GLB publicly, so anyone can download it; the licence has to allow that.
  - *Updated 2026-09-25 to allow CC BY-SA.* ShareAlike only means our optimised copy of the model must also be shared under CC BY-SA 4.0, and the README will say so. It doesn't reach our code: the site shows the model, it isn't an adaptation of it.
- **2026-09-25: Candidates from The Royal Armoury (Livrustkammaren), Stockholm.** Real museum objects, photogrammetry-scanned, so the hotspot content can be documented fact.
  - *The National Costume* (CC BY-SA 4.0, scan by Erik Lernestål). The Swedish national dress designed by King Gustav III, this one worn by him on 24 April 1778: rose silk, floral embroidery, gold braid, a cape. 500k triangles, 1 texture.
  - *The Parade Armour of King Erik XIV of Sweden* (CC BY 4.0). Made around 1562 in Arboga, decorated in Antwerp by goldsmith Elisaeus Libaerts: blackened steel with gilt repoussé. 1M triangles, 1 texture. The hard-material contrast the set needs.
  - Both are scans with one texture, so a larger texture (3–4K) fits the GPU budget. Lighting is baked into the colour and there's no normal map, so the spot light will rake less. Back coverage still to check after download.
  - *The King Costume* (Myylo, CC BY 4.0): licence fine, but it's fan art of a film costume and has plainer textures. The National Costume is the stronger menswear choice.
- **2026-09-25: The National Costume: on stage as costume 1.** Rakesh downloaded it.
  - Arrived as a raw scan: arbitrary units, facing −Z, floating off-centre. The pipeline turns it 180°, scales it to an estimated 1.07 m (collar to knee bands) and lifts it 0.40 m, to knee height. *Height and lift are estimates for a ~1.70 m wearer; Rakesh to confirm by eye.*
  - 500k → 125k triangles; one 4K colour texture. 2.91 MB, ~89 MB GPU. Close-ups show the real embroidery, silver-gilt thread, fabric buttons and the weave of the silk.
  - **Flaw, kept (2026-09-25, Rakesh's call):** a scan hole in the cape's white lining, on its inner right edge, visible from a front three-quarter angle and in the attract hero shot. Left as scanned.
  - **Resolved:** the garment ends at the knee, so it floats 40 cm above the plinth. It stays floating, like an invisible mannequin (Rakesh rejected the mount rod).
- **2026-09-25: The Parade Armour of King Erik XIV: on stage as costume 3.** Chosen by Rakesh with the National Costume. Replaces the King in slot 3.
  - A complete suit, helmet to sabatons, already in metres (1.67 m), feet at the bottom, front facing +X. The pipeline turns it −90°. No lift or mount needed. The back plate is decorated: the back-only hotspot.
  - **Geometry:** the relief (repoussé lions, scrollwork, rivets) lives in the mesh, not the texture. Simplifying to 150k turned it into faceted "foil"; 300k still lost it; **450k keeps most of it (4.53 MB, over the 3 MB budget).** Cloth survives heavy simplification because its detail is in the textures; embossed metal doesn't.
  - **Planned fix:** bake a normal map from the 1M original onto a ~150k mesh in Blender. That keeps the relief at a third of the triangles, and it's the standard game-art route. Until then, 450k.
  - **Texture:** Rakesh downloaded Sketchfab's 1K option, too soft for a full-body scan. Re-download at 4K; the pipeline already allows 4K for this model.
  - Material: metallic 1, roughness 0.28, no roughness map. Real polished steel, so it reflects the stage's environment light. Revisit in the lighting pass.
- **2026-09-25: The King Costume: on stage as costume 3 for comparison only.** Recommendation: don't use it. The robe and back are plain black (no back-only detail), the trousers and buttons are untextured, and it's 4.87 MB. Next to the National Costume scan it reads as a game asset. Rakesh to decide.
  - *Why it looked like vinyl:* an export error, not our renderer. The doublet's `roughnessFactor` was 0; glTF multiplies it with the roughness texture, so the fabric rendered mirror-smooth. Sketchfab's own viewer apparently ignores the factor when a texture is present, so it looked matte there. Fixed in the pipeline (`materials` override, 0 → 1); metalness left as authored.
- **Pipeline:** `materials` per model corrects exporter mistakes by material name (roughness and metalness factors), and the fix is recorded next to the model.
- **2026-09-25: Leather Dress (DaaGHrii, CC BY 4.0).** Licence and tech fine (27k triangles, 3 textures), but not recommended on design grounds: a generic modern mini dress with no maker, wearer or history, so every hotspot would be invented; game or pin-up styling that's a tone risk for a public, all-ages kiosk; black on a black stage; and probably a plain back.
- **2026-09-25: Farnos' costume from a traditional engraving (Aleksei Moskvin, CC BY 4.0).** Licence fine; a folk-comic character from the 18th-century lubok print "Farnos i Pigasia", with legs and shoes so it stands on the plinth. Not recommended as the third costume: its silhouette (doublet, cape, knee breeches, lace collar) repeats the National Costume's, so the set would be two men's 18th-century outfits. Also 32 textures across 11 materials (would need hard per-material downsizing) and the same collection whose quality Rakesh rejected with Glafira.
- **2026-09-25: Man's #4 costume from a traditional engraving (Aleksei Moskvin, CC BY-NC-ND 4.0).** Not usable: NoDerivatives forbids the simplifying it needs (380k triangles, 20 textures), and NonCommercial is risky for a kiosk. A sibling, *Man's #3 costume from a historical engraving*, is CC BY on the department's account.
- **2026-09-25: Belotelova (IVSPU, CC BY 4.0).** Removed from the candidates by Rakesh.
- **2026-09-25: Plague Inquisitor – Armored Beak Mask & Blade (Pigcraft, CC BY 4.0).** Not recommended, on design grounds:
  - Very likely AI-generated. The uploader has 75 models on unrelated subjects, often several a day, with round triangle counts (~0.5M/1M/2M) and keyword-stuffed descriptions. An AI-generated centrepiece undercuts an exhibition built on authorship, and whether a CC licence even holds on AI output is unsettled.
  - It's a dark-fantasy game character (hands, boots, faceless mask), not a costume on a form. It would clash with real museum objects.
  - 1.9M triangles.
  - If the plague-doctor idea appeals, look for a historical 17th-century plague doctor costume from a museum or a documented reconstruction instead.
- **2026-09-25: Vintage Asian Dress Belt (Paradoox, TurboSquid, free download, Standard licence).** A strong model, but TurboSquid's Standard licence allows WebGL only through Unity, Unreal and Lumberyard exports. It forbids open formats that a public framework can open, which covers a GLB loaded by three.js.
  - **Decision:** use it for local development only. It's git-ignored, so the deployed site falls back to a stand-in. Find a CC-BY or CC0 replacement.
  - **Rejected:** obfuscating the GLB to count as "proprietary". It breaks the spirit of the licence, and the brief asks for a free-licensed model credited in the README.
- **2026-09-25: Costume: Glafira, "Wolves and Sheep" (Aleksei Moskvin and Mariia Moskvina, Department of Clothes Pattern Design, IVSPU; Sketchfab, CC BY 4.0).** Accepted, then **rejected by Rakesh the same day: it feels low quality.** Taken off the stage; its settings below are kept as the record of the pipeline test.
  - A digital twin of the stage costume for Glafira in Ostrovsky's *Wolves and Sheep* (1875), built from historical block patterns, scanned textiles and actor scans. Documented with DOIs, so most hotspot content can be real rather than invented.
  - Already in metres, front facing +Z. Violet jacquard, black lace front panel, tiered black satin ruffles, pleated waist, bell sleeves. The back carries an 1870s bustle with black satin drapery over a train: the back-only hotspot.
  - 630k triangles → ~126k with meshoptimizer (error 0.01, borders locked). Close-ups show no visible damage to the ruffles.
  - **Budget:** it was 3.8 MB against 3 MB, because it has two full fabric sets (6 textures). Fixed the same day by the per-slot texture sizes in "Model pipeline": now 2.98 MB.
  - CC BY requires credit and a note of changes: the credit is in content.json, and the changes are recorded in `scripts/models.config.json`.
- **2026-09-25: Dwarfess's costume from a historical engraving (same department, CC BY 4.0).** Licence fine, but another full-skirted women's gown from the same collection. Next to Glafira, it would weaken "three very different costumes". Not chosen unless Glafira is dropped.
- **2026-09-25: Dress #3 (La Dame à la licorne) (Mariia Moskvina, CC BY-NC-ND 4.0).** Not usable. NoDerivatives forbids the simplifying we need (366k triangles), and NonCommercial is risky for an exhibition kiosk built for a company.
- **2026-09-25: Fantasy Outfit (zahrahoseinabadi-zh, CGTrader, free, Royalty Free License (no AI)).** Not usable. CGTrader's licence (§21A.3) requires software products to "take all commercially reasonable measures to prevent the end user from gaining access to the Product", and §21A.6 forbids redistribution unless the model can't be extracted without reverse engineering. A GLB sent to the browser fails both.
- **Pattern:** every free marketplace model so far (TurboSquid, Blendkit, CGTrader) forbids exactly what a web viewer does: hand the file to the browser. Only open licences (CC BY, CC0) work. Search Sketchfab with the licence filter set to CC BY + CC0 and "Downloadable".
- **2026-09-25: Full witch costume (Silent Wolf, Blendkit, free, Royalty Free licence).** Not usable. Blendkit's Licensing FAQ allows games and apps only if the models "shouldn't be directly extractable in the distribution"; a GLB served to the browser is. Blendkit's CC0 assets would be fine, but almost none of its garments are CC0.
  - **Rejected:** adjusting sharpness continuously (dynamic resolution). The costume would visibly soften and sharpen, which reads badly on an exhibition screen.

## Legibility
- **Open:** hotspot label size. On an iPad, 1 CSS px is about 0.19 mm, so a 32 px label has capitals about 4.3 mm tall. At 1.5 m that's about 10 arcminutes, the 20/40 line on an eye chart: readable, but only just. Test 36–40 px semibold at 1.5 m with a tape measure and log the result here.

## Creative extra
- **Decision:** guided hotspot tour, ordered front → side → back so it ends on the hidden detail.
  - **Why:** it reuses the push-in and story timelines, and it works like a shot list. It also serves the visitor who won't explore alone.
  - **Never cut:** it's the only creative extra, so if time runs short it shrinks to the current costume's hotspots rather than going.
  - **Alternative still open:** a raking-light idle, the brief's "subtle idle motion/light" option. Textile conservators use low-angle light to reveal weave and embroidery. Switch to it if the models have strong normal detail.
  - **Rejected:**
    - Sound: questionable in a shared exhibition space, and iOS needs a tap before audio can play.
    - Sketch-to-finished comparison: extra assets per hotspot.

## Your call
- **Hotspot style:** a hollow ring, so the detail stays visible through it. The label sits on the outward side, away from the garment, on a short leader line. Opacity fades with the angle to the camera.
  - **Rejected:** solid pins, which cover the detail; binary show/hide, which pops.
- **Long-story behaviour:** three short chapters tapped through, with no scrolling.
  - **Rejected:** a scrolling panel. Scrolling fights the touch lock and reads badly at 1.5 m.
- **Seen state:** a ring fills once opened; the selector shows "n/total found" per costume. Everything resets on attract, because attract means a new visitor.
- **Very fast spin:** the turntable's speed is clamped, labels hide above a threshold and return once it settles, and auto-rotate eases back in after the delay.
  - **Rejected:** snapping to the nearest side. It takes control away from the visitor.
- **All three together:** only in the attract state, as a lineup on the stage. While exploring, the others are dark.

## RTL (Arabic, unless changed to Urdu)
Flips:
- The story panel moves to the left and the costume shifts right, so an Arabic reader, who starts on the right, still meets the costume first and reads about it after. That's the same order as English. The lens shift mirrors with it.
  - *Fixed 2026-09-24:* this line used to say the panel moves to "the reading-start side". In Arabic that's the right, where the panel already sits in English, which contradicted ARCHITECTURE.md.
- Chapter order and progress run right to left.
- The sketch tilt direction.

Stays the same:
- The 3D stage, the turntable direction and the camera moves.
- Photos.
- Label side, which follows the garment rather than the language.

Arabic-specific type:
- Larger size and more line height.
- No letter-spacing, uppercase or italics.
- Numerals: decide Western vs Eastern Arabic and log it here.

## Out of scope
- **Camera try-on.** It's not in the brief's creative-extra list, it takes time the core build needs, and it raises camera-privacy questions in a public space. Pitch it in the defence as a next step (headpiece try-on via face tracking).

## Rejected AI suggestions
- **2026-09-24: Google `<model-viewer>` as the 3D layer.** Claude proposed it in the first plan because it covers hotspots, auto-rotate and camera easing out of the box.
  - **Why rejected, on design grounds:**
    - Each costume would live in its own box with its own camera, so there's no shared stage.
    - Lights can't be moved from code.
    - The camera eases with a single damping value, with no timeline to sync camera, light and panel.
    - The attract state and transitions would have been CSS effects layered around three viewers rather than directed scenes.
  - Switched to Three.js + GSAP.
- **2026-09-24: Build the attract state straight after the camera step, instead of at step 7.** Claude proposed it because the brief calls the attract state the most important screen, and building it late risks rushing it.
  - **Why rejected:** Rakesh chose to get a complete, usable version on the iPad first and polish after. The foundations are built so polish can be added without rework, and the halfway rule in PLAN.md protects the polish time.
- **2026-09-25: Name the exhibition "Backstories"** (hook: "Every costume hides a detail on its back"). Claude proposed it at the start and again for step 8, as a way to turn the brief's back-hotspot rule into the exhibition's idea.
  - **Why rejected:** Rakesh chose a plainer, more direct title and a broader promise: **"Costume Explorer" / "Every costume has its story" / "Touch the costume to begin"**. The back-hotspot idea still shows on screen through the attract teaser (the back ring pulses as the back comes round); it just isn't the headline.
- **2026-09-25: A museum mount rod under the National Costume.** Claude proposed and built a slim dark rod on a floor plate, rising inside the breeches, because the garment ends at the knee and floats 40 cm above its plinth, which read as levitating in the large attract hero shots.
  - **Why rejected:** Rakesh removed it after seeing it on the iPad. The costume floats at its real height, like an invisible mannequin; the hero framing already keeps the gap out of the shot.
- **2026-09-25: Fill the National Costume's cape scan hole in Blender** (Fill Holes), since the attract hero shot shows it clearly.
  - **Why rejected:** Rakesh chose to leave the scan as it is.
- *(Log more as they happen: the suggestion, why it was rejected, and the date.)*
