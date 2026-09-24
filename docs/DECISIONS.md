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

## Performance
- **Decision:** keep about 40 fps or better on Rakesh's older test iPad, and 60 fps on a current iPad.
  - **Measured:** 42 fps at step 1 with one stand-in box, pixel ratio 2 and antialiasing on. The costumes, environment light and spot keys will cost more, so the frame rate has to be managed, not just hoped for.
  - **Why the older iPad counts:** it's the worst case. If the experience holds there, it holds on kiosk hardware.
  - **Test device:** iPad 5th gen (2017). The kiosk will use a newer iPad.
- **Decision (2026-09-25):** cap the pixel ratio at 1.5 for now, instead of 2. `?dpr=` overrides it for measuring.
  - **Why:** the iPad 5th gen has a 2× screen, so at 1.5 it draws about 56% of the pixels. Most of its frame time goes on filling pixels, not on geometry.
  - **Next:** a start-up quality check picks the pixel ratio once, while the first screen shows. That gives 2× on a strong iPad and less on a weak one.
  - **Measured (2026-09-25, stand-ins, iPad 5th gen):** pixel ratio 1 and 1.5 both hold 60 fps; 2 drops to 30 fps. This confirms the cost is filling pixels.

## Model pipeline
- **Decision (2026-09-25):** `npm run models` uses the gltf-transform library, not its command line, so each texture type gets its own size. Rakesh approved the dev-only packages.
  - **Texture sizes by slot:** colour and normal maps 2K (they carry the weave), roughness/metalness and occlusion 1K (they read the same at half size). All WebP.
  - **Stored tangents removed:** three.js derives them in the shader when a mesh has none, so they only cost file size and GPU memory. Checked on Glafira at close range: no visible change.
  - **Primitives joined by material before simplifying:** fewer draw calls (Glafira 7 → 2). It also removes the borders Sketchfab adds when it splits meshes at 65k vertices, which simplifying would otherwise have to preserve.
  - **GPU budget:** about 100 MB of textures per costume, so all three stay around 300 MB on a 2 GB iPad. The script prints each model's estimate.
  - **Rejected:** the CLI's single `--texture-size` for every map. Either the roughness maps waste memory, or the colour and normal maps lose the weave.
  - **Result:** Glafira 3.8 MB → 2.98 MB, ~101 MB GPU (from ~134 MB). The dress 2.26 MB → 2.19 MB.

## Models and licences
- **Rule:** CC-BY or CC0 only. The site serves each GLB publicly, so anyone can download it; the licence has to allow that.
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
- *(Log more as they happen: the suggestion, why it was rejected, and the date.)*
