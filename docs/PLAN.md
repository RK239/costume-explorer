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
- [ ] Scan hole in the cape lining (inner right edge): fill in Blender or avoid that angle.
- [ ] Floating at knee height: decide leave / museum mount rod / set down.
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
- [x] Real positions placed for every hotspot (`dev.probe` ray helper, checked with markers on the model). National Costume and Parade Armour have 4 each (front, front, side, back); the costume-2 stand-in has 3 placeholders.
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
- [ ] The selector shows "n/total found" (the selector arrives in step 6).
- [ ] Rakesh: check the English draft copy (all hotspots are `invented: true` until checked against sources).

**Commit** (steps 4–5)

## 6. Costume switching (~30 min)
- [ ] Selector: three labelled buttons, always visible, one tap each from any mode. From a story, the same timeline closes the story first.
- [ ] Switch timeline: the current costume goes dark, the camera trucks along the row, the next costume lights up. `--accent` changes.
- [ ] Hide unfocused costumes (`visible = false`) once the transition completes.

## 7. Idle and a basic attract state (~30 min)
- [ ] Idle: any `pointerdown` (capture phase) resets a 45 s timer. `?idle=5` shortens it. The timer pauses while the tour plays.
- [ ] On timeout:
  - close the story
  - reset seen state and language
  - run the timeline back to the wide shot
- [ ] Basic attract: a wide shot of the lineup, a headline, and a tap enters a costume.
- [ ] Checkpoint: the whole loop works on the iPad.

**Commit** (steps 6–7)

---

# Phase 2: make it beautiful (~5 h)

## 8. Attract state (~1.5 h)
- [ ] Designed to stop someone 2–3 m away: light changing and big type, not fine detail.
- [ ] Landscape: a wide shot of the lineup.
  - All three costumes turn out of sync.
  - Each key light swells in turn, and the headline takes that costume's accent.
- [ ] Portrait: the camera slowly trucks along the lineup, one costume at a time.
- [ ] Bilingual headline and hook line (draft: "Each costume hides a detail on its back"), plus a pulsing ring that uses the hotspot visual language.
- [ ] Tapping a costume dollies straight into it. Tapping anywhere else enters the costume currently lit.

## 9. Transitions (~1 h)
- [ ] Timing and easing pass on every timeline.
- [ ] Connected story: the close-up scales in from the ring's screen position, and a line draws from the ring to the panel.
- [ ] Costume switch: the next costume arrives mid-turn and settles facing front; `--accent` tweens to the new colour.
- [ ] First reveal: the first time a back hotspot turns into view, it blooms once.

**Commit** (steps 8–9)

## 10. Visual system (~1 h)
- [ ] Type scale. Test hotspot labels at 1.5 m with a tape measure (36–40 px semibold is the candidate) and log the result.
- [ ] Accent colours taken from each garment, with a contrast check on the dark stage.
- [ ] Final hotspot style: hollow ring with the label on a short leader line.
- [ ] Panel design.
- [ ] Selector thumbnails captured from the models.
- [ ] Image treatments:
  - `closeup`: feels like leaning in
  - `sketch`: on paper, tilted 2–3°, with a soft shadow
- [ ] When every hotspot on a costume is found, the next costume's thumbnail pulses gently.

## 11. Arabic and RTL (~1 h)
- [ ] Language toggle: one tap, always reachable. It sets `dir="rtl"` and `lang`.
- [ ] Apply the RTL overrides from DECISIONS.md, including mirroring the lens shift direction.
- [ ] Arabic type scale: larger size, more line height, no letter-spacing, no uppercase, no italics.
- [ ] A native reader proofreads the Arabic, or the README says it wasn't.

## 12. Guided tour (~30 min)
- [ ] One timeline that runs the hotspots in `tourOrder` (front → side → back): push-in, chapters, hold, next.
- [ ] A visible progress ring. A touch pauses the tour; a tap on the ring resumes it.
- [ ] The idle timer stays paused while the tour plays.

**Commit** (steps 10–12)

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
