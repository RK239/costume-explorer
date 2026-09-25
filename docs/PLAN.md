# Build plan

About 13 focused hours in three phases: make it work, make it beautiful, make it solid. Tick items as they're done. Commit at the end of every 2–3 steps (marked **Commit** below).

## How the phases fit together
Phase 1 looks plain but is built on the final structure, so Phase 2 is tuning, not rebuilding:
- Every change of mode already runs as a GSAP timeline through `director.play()`, even if it's only a simple ease for now.
- All copy comes from `content.json`, with `en` and `ar` slots from the start.
- CSS uses logical properties (`inline-start` / `inline-end`), never `left` / `right`, so RTL is a switch later.
- Colours, sizes and spacing live in `tokens.css`.
- The touch lock is in from step 1.

**Halfway rule:** the attract state and the transitions carry the most weight in the brief, and they're in Phase 2. If Phase 1 isn't done by about the 6.5-hour mark, move on to Phase 2 with what works and log what's missing. Phase 1 gives way, not Phase 2.

If time runs short in Phase 2 or 3, cut in this order:
1. image polish
2. the connecting-line flourish
3. the portrait attract camera move (use a static wide shot instead)
4. the tour shrinks to the current costume's hotspots. It is never removed, because it's the creative extra.

Never cut the attract state, the RTL design work, the iPad testing or the README.

## 0. Models (Rakesh, checked by Claude)
- [ ] Send the source link for each candidate before any Blender work. Claude checks:
  - licence: CC-BY or CC0 only (no NC/ND, no "non-commercial use" terms)
  - author and source URL, noted for the credits
- [ ] Pick 3 costumes that differ in material and silhouette. Each model needs:
  - the back fully modelled, no scan holes
  - under ~150k triangles
  - PBR textures, with real normal-map detail so the key light rakes across the fabric
  - a garment on a form, not a posed character
- [ ] Blender pass on each model:
  - real-world scale in metres, feet at the origin
  - the costume's front visible in Blender's Front view (numpad 1), which becomes +Z after glTF export
  - all transforms applied (Ctrl+A → All Transforms)
  - floors, lights, cameras and unneeded meshes removed
  - original full-size textures kept; `npm run models` does the compression
  - exported as glTF Binary (`.glb`), +Y Up, into `models-src/`
- [ ] Claude checks each GLB: triangle count, textures, file size, height and origin (`gltf-transform inspect`), then spins it in a viewer to check the back, the orientation and how the fabric takes the light. Pass/fail list back to Rakesh.
- [ ] RTL language: Arabic by default. The copy for it comes in Phase 2.

---

# Phase 1: make it work (~6 h)
Goal: attract → costume → turn → hotspot → story → switch → idle back to attract, usable end to end on the iPad, with a plain look.

## 1. Skeleton, deploy, touch lock (~45 min)
- [x] Vite vanilla project with `three` and `gsap`.
- [x] Full-screen canvas plus an overlay layer, using `100dvh`.
- [x] Renderer: pixel ratio capped at 2, tone mapping, sRGB output, resize handling.
- [x] Apply every touch constraint from CLAUDE.md.
- [x] `tokens.css` for colours, sizes and spacing; logical properties only.
- [x] `content.json` loaded at boot, with `en` and `ar` slots.
- [x] Push to GitHub (the steps 1–3 commit).
- [x] Rakesh: connect Vercel to the repo, and confirm the live URL opens on the iPad. Live: https://costume-explorer.vercel.app (auto-deploys on push to `main`).
- [x] `?dev=1` shows the stats panel.
- [x] Rakesh: touch-lock test on the real iPad. All passed; 42 fps on the older test iPad.

## 2. Stage and models (~1 h)
- [x] `npm run models`: optimise `models-src/*.glb` into `public/models/` and print the file sizes.
- [ ] content.json: shape from ARCHITECTURE.md, three costumes, credits filled in, placeholder hotspots. (Shape done; credits wait for the real models.)
- [x] Load all three GLBs with GLTFLoader + MeshoptDecoder into turntable groups laid out in a row. Stand-in models until the real ones pass the check.
- [x] Stage elements:
  - RoomEnvironment fill
  - one spot key per costume
  - plinth discs
  - blob shadows
- [x] Light-up / go-dark function per costume: key light intensity plus `envMapIntensity`. Never toggle a light's `visible`.
- [x] Dev: tap the model to log local position and normal.
- [x] `?dpr=` flag to measure what sharpness costs; pixel ratio capped at 1.5 for now.
- [x] Rakesh: test on the iPad 5th gen. `?dpr=1` and `1.5`: 60 fps. `?dpr=2`: 30 fps.

**Model 1: Vintage Asian Dress Belt** (Paradoox, TurboSquid 2382634). Checked 2026-09-25. Passes on triangles (53k), size after compression (56 MB → 2.26 MB), back coverage, orientation and normal-map detail.
- [x] Exported in centimetres (148 units tall). Rescaled to metres with a headless Blender script into `models-src/`; Rakesh's original files are untouched.
- [ ] **Licence blocks deployment.** TurboSquid Standard allows WebGL only through Unity, Unreal and Lumberyard exports and forbids open formats that can be opened in public frameworks. A GLB served to three.js is exactly that. Used for local development only (git-ignored); the deployed site shows the stand-in. Needs a CC-BY or CC0 replacement.

**Model 2: Glafira, "Wolves and Sheep"** (CC BY 4.0). Checked 2026-09-25, then rejected by Rakesh (feels low quality) and taken off the stage. The notes below stay as the record of the pipeline test.
- [x] Licence, scale (metres), orientation (+Z front), back coverage (1870s bustle).
- [x] Simplified 630k → ~126k triangles through `scripts/models.config.json`.
- [x] 3.8 MB against the 3 MB budget. Fixed with per-slot texture sizes and dropped tangents: 2.98 MB, ~101 MB GPU.

**Model 3: The National Costume** (Royal Armoury, CC BY-SA 4.0). On stage 2026-09-25 as costume 1: turned, scaled and lifted in the pipeline, 2.91 MB, ~89 MB GPU.
- [x] Scan hole in the cape lining (inner right edge): left as scanned (Rakesh's call).
- [x] Floating at knee height: stays floating (a mount rod was tried and rejected).
- [ ] Confirm the estimated height (1.07 m) and lift (0.40 m) by eye.

**Model 4: The Parade Armour of King Erik XIV** (Royal Armoury, CC BY 4.0). On stage 2026-09-25 as costume 3; the King and the TurboSquid dress are retired.
- [ ] Re-download at 4K texture (the current file is Sketchfab's 1K option).
- [ ] 450k triangles, 4.53 MB: over budget. Bake a normal map from the 1M original onto ~150k in Blender (Phase 3 at the latest).
- [ ] Check the frame rate on the iPad 5 with the armour lit.

**Still to choose: one costume** (slot 2): a woman's or non-European garment. Search Sketchfab filtered to CC BY + CC0 and Downloadable:
https://sketchfab.com/search?features=downloadable&licenses=322a749bcfa841b29dff1e8a1bb74b0b&licenses=7c23a1ba438d4306920229c12afcb5f9&q=costume&type=models

## 3. Turntable and camera (~1.5 h)
- [x] State machine with modes and `director.play(tl)` input locking. Every mode change is a timeline from the start.
- [x] `frameCostume()` fits the costume to the free region in both orientations. Lens shift via `setViewOffset`.
- [x] Turntable:
  - drag, inertia with damping, a velocity clamp
  - auto-rotate resuming after ~3 s with an eased ramp
  - `.spinning` class on fast spins
- [x] Single loop on `gsap.ticker`.
- [x] Plinth sized from the costume's base, with a front index mark so the turning reads.
- [x] Explore one costume end to end on the iPad. Rakesh: drag, flick, catch and rotation all work.
- [x] Production build checked without the dev-only dress: it falls back to the stand-in.

**Commit** (steps 1–3)

## 4. Hotspots (~1 h)
- [x] DOM markers projected every frame, with opacity fading on the facing test.
- [x] Plain ring marker with a 60 px touch target; the label goes on the outward side; labels hide while `.spinning` is set, and fade (not jump) when they change side.
- [x] Real positions placed for every hotspot (`dev.probe` ray helper, checked with markers on the model). National Costume and Parade Armour have 4 each (front, front, side, back); the costume-2 stand-in has 3 placeholders (since replaced by the Calligraphy Dress, 4 hotspots).
- [x] Seen state: a ring fills once opened.
- [x] Checked: the back hotspot only appears (and is only tappable) once the costume is turned round.

*Rakesh, now the hotspot positions are fixed: render the close-ups (long lens, shallow depth of field) and Line Art sketches in Blender from the full-size source models. File names are already in content.json (`/images/national-embroidery.webp` etc.); drop them in `public/images/` and they replace the "Image to come" placeholder.*

## 5. Story (~1 h)
- [x] Tapping a hotspot runs one timeline:
  1. the turntable turns the detail to the camera
  2. the camera pushes in to the hotspot's `frame`
  3. the lens shift makes room for the panel
  4. the panel opens
- [x] Panel: three chapters (Material → How it was made → The artistry), tapped through, with no scrolling. A missing image shows an "Image to come" placeholder.
- [x] Closing (× or a tap on the stage) slides the panel out and pulls the camera back; auto-rotate resumes after the delay.
- [x] Checked in landscape (side panel) and portrait (bottom sheet).
- [x] The selector shows "n of total found" (done in step 6).
- [ ] Rakesh: check the English draft copy (all hotspots are `invented: true` until checked against sources).

**Commit** (steps 4–5) ✓

## 6. Costume switching (~30 min)
- [x] Selector: three labelled buttons with "n of total found", visible while exploring, one tap each from any mode. From a story, the same timeline closes the story.
- [x] Switch timeline: the current costume goes dark, the camera trucks along the row, the next costume lights up. `--accent` tweens to the new colour.
- [x] Hide unfocused costumes (`visible = false`) once the transition completes.

## 7. Idle and a basic attract state (~30 min)
- [x] Idle: any `pointerdown` (capture phase) resets a 45 s timer. `?idle=5` shortens it. `pause()`/`resume()` are ready for the tour.
- [x] On timeout, in one timeline:
  - close the story
  - reset seen state and language
  - run back to the wide shot
- [x] Basic attract: the lineup, a headline, "Touch a costume to begin", and a tap enters the costume nearest the touch. The app now boots here; `?focus=n` skips it for testing.
- [ ] Checkpoint: the whole loop works on the iPad. (Scripted in the browser: attract → costume → switch → story → switch from the story → idle reset. Rakesh to run it on the iPad.)

**Commit** (steps 6–7)

---

# Phase 2: make it beautiful (~5 h)

## 8. Attract state (~1.5 h)
- [x] Designed to stop someone 2–3 m away: light changing and big type, not fine detail. Rakesh: on the old lineup the costumes were too small to see from a distance.
- [x] One loop for both orientations: a wide shot of the lineup (all three turning out of sync, softly lit), then each costume in turn as a hero shot, filling the height beside the headline while its key light swells and the others fall dark. The headline's accent follows.
- [x] The hero turns once, pausing with its back to the visitor; a teaser ring pulses on its back hotspot.
- [x] Headline (Rakesh's wording): "Costume Explorer" / "Every costume has its story" / "Touch the costume to begin", with a breathing ring in the hotspots' visual language. Landscape: a poster column at the inline end. Portrait: below the costume. (Arabic in step 11.)
- [x] A tap enters the costume in the hero shot; in the wide shot, the one nearest the touch.
- [x] Rakesh's review: bigger costumes on the main page. Revised: 1.8 m spacing, hero shots framed on the garment, tighter margins, narrower headline column. (A mount rod was tried and removed at Rakesh's request.)
- [x] Also from the review: the story panel is a side column in portrait too, and a costume title card shows while exploring.
- [ ] Rakesh: check the revision on the iPad from 2–3 m away.

## 9. Transitions (~1 h)
- [x] Timing and easing pass on every timeline: all durations and eases now come from motion tokens in `src/motion.js`.
- [x] Connected story: the close-up grows out of the ring into its place in the panel, and a line draws from the ring to the panel (and follows the ring). Both retract when the story closes, including from a switch or the idle reset.
- [x] Costume switch: the next costume keeps turning the way it was going and settles facing front as the camera lands; `--accent` tweens to the new colour.
- [x] First reveal: the first time a back hotspot turns into view during a visit, it blooms once (checked: not again on later turns; the idle reset clears it for the next visitor).
- [ ] For step 10: give the panel's image a guaranteed share of the panel's height. On short panels the text currently squeezes it.

**Commit** (steps 8–9)

## 10. Visual system (~1 h)
- [x] Type: IBM Plex Sans (400/500/600) and one type scale in `tokens.css`. Hierarchy by size, weight and colour only (no capitals or letter-spacing), so it carries over to Arabic.
- [ ] Rakesh: test hotspot labels (now 34 px semibold on a solid plate) at 1.5 m with a tape measure and log the result.
- [x] Accent colours sampled from each garment's texture (`npm run accents`), lightened to 4.5:1 on the stage: National Costume #AD675D (embroidery rose), Parade Armour #8A7963 (gilding). Re-run after the armour's 4K texture.
- [x] Final hotspot style: hollow ring with a dark outline, a leader line, the label on a solid plate; the seen ring fills with the accent.
- [x] Panel design: image on top as the insert shot (40% of the panel, yielding down to 120 px only for long text), accent eyebrow, title, chapter tabs with an accent marker, text. Measured: every hotspot's longest chapter fits at 10.2", 11" and 13" in both orientations, no scrolling.
- [x] Selector thumbnails rendered from the costumes at load (which also uploads every texture before any switch).
- [x] Image treatments:
  - `closeup`: full-bleed with a vignette; keeps pushing in slowly once it lands (leaning in)
  - `sketch`: a taped sheet of paper, tilted −2.2°, with a soft shadow, the drawing multiplied into the paper
- [x] When every hotspot on a costume is found, the next unfinished costume's button pulses gently in its accent.
- [x] Stage light: a backdrop glow behind each costume and a pool of light around each plinth, both unlit gradients that follow the costume's light level.
- [x] Tone mapping: Neutral by default (`?tone=agx` to compare). Rakesh to confirm by eye.
- [ ] Copy: several chapters run 4–5 lines; the brief says "about 2 lines each". Trim in Rakesh's copy pass.
- [ ] Copy pass for all three costumes at once (Rakesh, later): every hotspot's Material / How it was made / The artistry, plus alt texts. The current text is a placeholder draft. Keep the dress's lettering honest (ornament, not text), and list what's invented for the README.

## Rakesh's changes after step 10
- [x] Depth instead of a backdrop wall: shafts of light through haze, drifting dust, distant shafts receding into the dark (`stage/atmosphere.js`).
- [x] Cinematic hotspot labels: type on the image with a halo, hairline leaders, finer rings; labels draw out when the detail faces the visitor.
- [x] Error pass: every flow run in the browser (attract, enter, all 8 stories and chapters, switching, idle reset), no console errors. Fixed an undefined GLSL `smoothstep` and the dust's pixel ratio.
- [x] Attract: the wide shot holds 7.5 s with all three turning slowly together, then the hero shots; changes of turntable pace glide instead of jolting.
- [x] Attract: every loop starts from the costumes' first positions; they turn back while the camera returns to the wide shot (end of each loop, and the idle return).
- [x] Third costume: the Calligraphy Dress, through the pipeline (stood upright, centred on its skirt), with its accent, title, context, credit and four hotspots with copy.
- [x] Switching: every arrival turns the same gentle 60° onto the costume's front and goes straight into its slow turn (was 0.97–5.51 rad, then a 3 s dead stop); a drag started mid-move takes over when the move lands.
- [x] Switching is a light cross-fade: the costume the camera leaves fades out, the next comes up out of the dark as the camera lands; nothing pops in or out (fixed "going dark" never dimming the room fill).
- [x] Less light behind the costumes: the haze sits above them, narrower and fainter, so the space right behind each garment stays dark.
- [x] Parade Armour at 4K (sharper etching in push-ins). 6.55 MB, over the 3 MB file budget until the normal bake.
- [x] National Costume: the hole in the cape's lining patched in Blender with a new piece of lining (`scripts/blender/patch-national-lining.py`); still under 3 MB (2.98).
- [ ] Rakesh: bake a normal map for the armour (1M original → ~150k mesh) to bring its file down from 6.55 MB (DECISIONS: Models and licences).
- [ ] Rakesh: re-pose the dress's forearms in Blender (see DECISIONS: Third costume). Then `npm run models`, and Claude places the cuff hotspot again.
- [ ] Rakesh: check all of it on the iPad (look, and fps against the ~54 before; three real models now load).
- [ ] More changes from Rakesh.

## 11. Arabic and RTL (~1 h)
- [ ] Language toggle: one tap, always reachable. It sets `dir="rtl"` and `lang`.
- [ ] Apply the RTL overrides from DECISIONS.md, including mirroring the lens shift direction.
- [ ] Arabic type scale: larger size, more line height, no letter-spacing, no uppercase, no italics.
- [ ] A native reader proofreads the Arabic, or the README says it wasn't.

## 12. Guided tour (~30 min)
- [ ] One timeline that runs the hotspots in `tourOrder` (front → side → back): push-in, chapters, hold, next.
- [ ] A visible progress ring. A touch pauses the tour; a tap on the ring resumes it.
- [ ] The idle timer stays paused while the tour plays.

**Commit** (step 10 on its own, as a checkpoint before Rakesh's changes; then steps 11–12)

---

# Phase 3: make it solid (~2.25 h)

## 13. First view and preloading (~30 min)
- [ ] Capture the attract stills (landscape and portrait) in dev mode and wire up the first-view crossfade.
- [ ] Preload and `decode()` every story image after the models load.
- [ ] Upload every texture to the GPU at load so the first switch to a costume doesn't stall.
- [ ] Throttled load test: the still shows in under 3 s. Note the number for the README.

## 14. iPad testing (~1 h)
- [ ] Real iPad, plus Safari Responsive Design Mode at 11" and 13", in both orientations.
- [ ] Try to break it:
  - fast spins
  - rapid costume switching
  - rotating the device mid-story
  - the idle timeout firing during a story and during the tour
  - taps during transitions and before the models finish loading
- [ ] Stand 1.5 m away and check that hotspot labels are readable; note the result for the defence.
- [ ] Soak test: leave the kiosk cycling (attract → idle resets) for a few hours from a fresh Safari, and check the frame rate holds. A kiosk runs for days, so a slow memory leak would matter.
- [ ] Watch the frame rate on the stats panel with all three costumes lit.

## 15. README and defence prep (~45 min)
- [ ] The README contains:
  - the 10-line design rationale
  - a screenshot of the attract state, taken on the iPad
  - model credits
  - content disclosure (every hotspot with `invented: true`)
  - the rejected AI idea from DECISIONS.md
- [ ] Answer each of the five "Your call" items in the README.
- [ ] Record a 60–90 s screen capture on the iPad as a backup for the call.
- [ ] Rehearse 5–6 decisions, each with the alternative that was rejected.

**Commit** (steps 13–15)
