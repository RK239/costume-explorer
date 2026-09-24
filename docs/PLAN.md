# Build plan

About 12–13 focused hours. Tick items as they're done, and commit at the end of every step.
If time runs short, cut in this order:
1. image polish
2. the tour
3. the portrait attract camera move (use a static wide shot instead)
4. the connecting-line flourish

Never cut the attract state or the iPad testing.

## 0. Before coding (Rakesh)
- [ ] Pick 3 costumes that differ in material and silhouette. Check each model:
  - CC-BY or CC0 only (no NC/ND, no "non-commercial use" terms)
  - back fully modelled, no scan holes
  - under ~150k triangles
  - PBR textures, with real normal-map detail so the key light rakes across the fabric
  - garment on a form, not a posed character
- [ ] Note author, source URL and licence for each model.
- [ ] RTL language: Arabic by default. Switch to Urdu only if a native reader can proofread it.
- [ ] Blender pass on each model:
  - real-world scale in metres, feet at the origin
  - the costume's front visible in Blender's Front view (numpad 1), which becomes +Z after glTF export
  - remove unneeded meshes
  - export GLB into `models-src/`

## 1. Skeleton, deploy, touch lock (~1 h)
- [ ] Vite vanilla project with `three` and `gsap`.
- [ ] Full-screen canvas plus an overlay layer, using `100dvh`.
- [ ] Renderer: pixel ratio capped at 2, tone mapping, sRGB output, resize handling.
- [ ] Apply every touch constraint from CLAUDE.md.
- [ ] Push to GitHub, connect Vercel, and confirm the live URL opens on the iPad.
- [ ] `?dev=1` shows the stats panel.

## 2. Model pipeline and stage (~1.5 h)
- [ ] `npm run models`: optimise `models-src/*.glb` into `public/models/` and print the file sizes.
- [ ] Set up content.json: shape from ARCHITECTURE.md, three costumes, credits filled in, placeholder hotspots.
- [ ] Load all three GLBs with GLTFLoader + MeshoptDecoder into turntable groups laid out in a row.
- [ ] Stage elements:
  - RoomEnvironment fill
  - one spot key per costume
  - plinth discs
  - blob shadows
- [ ] Light-up / go-dark function per costume: key light intensity plus `envMapIntensity`.
- [ ] Dev: tap the model to log local position and normal.

*Rakesh, in parallel from here: render close-ups (long lens, shallow depth of field) and Line Art sketches in Blender; draft the copy.*

## 3. Director and turntable (~1.5 h)
- [ ] State machine with modes and `director.play(tl)` input locking.
- [ ] `frameCostume()` fits the costume to the free region in both orientations. Lens shift via `setViewOffset`.
- [ ] Turntable:
  - drag, inertia with damping, a velocity clamp
  - auto-rotate resuming after ~3 s with an eased ramp
  - `.spinning` class on fast spins
- [ ] Single loop on `gsap.ticker`.
- [ ] Explore one costume end to end on the iPad.

## 4. Hotspots (~1 h)
- [ ] DOM markers projected every frame, with opacity fading on the facing test.
- [ ] Hollow ring marker; the label goes on the outward side on a leader line; labels hide while `.spinning` is set.
- [ ] Real positions placed with the dev tap for every hotspot. Each costume has at least 3 hotspots, with at least 1 on the back.

## 5. Story: push-in and panel (~2 h)
- [ ] Tapping a hotspot runs one timeline:
  1. the turntable turns the detail to the camera
  2. the camera pushes in to the hotspot's `frame`
  3. the lens shift makes room for the panel
  4. the panel opens, with a line drawing from the ring to the panel
- [ ] Panel: three chapters (Material → How it was made → The artistry), tapped through, with no scrolling.
- [ ] Image treatments:
  - `closeup`: scales in from the ring's screen position
  - `sketch`: on paper, tilted 2–3°, with a soft shadow
- [ ] Closing the story reverses the timeline, and auto-rotate resumes after the delay.
- [ ] Seen state:
  - a ring fills once opened
  - the selector shows "n/total found"

## 6. Costume switching (~1 h)
- [ ] Selector: three labelled thumbnails, always visible, one tap each.
- [ ] Switch timeline, about 1.5 s:
  - the current costume goes dark
  - the camera trucks along the row
  - the next costume lights up while arriving mid-turn and settles facing front
  - `--accent` tweens to the new colour
- [ ] Hide unfocused costumes (`visible = false`) once the transition completes.

## 7. Attract state and idle (~1.5 h)
- [ ] Landscape: a wide shot of the lineup.
  - All three costumes turn out of sync.
  - Each key light swells in turn, and the headline takes that costume's accent.
- [ ] Portrait: the camera slowly trucks along the lineup, one costume at a time.
- [ ] Bilingual headline and hook line (draft: "Each costume hides a detail on its back"), plus a pulsing ring that uses the hotspot visual language.
- [ ] Tapping a costume dollies straight into it. Tapping anywhere else enters the costume currently lit.
- [ ] Idle: any `pointerdown` (capture phase) resets a 45 s timer. On timeout:
  - close the story
  - reset seen state and language
  - run the timeline back to the wide shot
- [ ] Capture the attract stills (landscape and portrait) in dev mode and wire up the first-view crossfade.

## 8. Bilingual and RTL (~1 h)
- [ ] Language toggle: one tap, always reachable. It sets `dir="rtl"` and `lang`.
- [ ] Apply the RTL overrides from DECISIONS.md, including mirroring the lens shift direction.
- [ ] Arabic type scale: larger size, more line height, no letter-spacing, no uppercase, no italics.

## 9. Guided tour (~30 min)
- [ ] One timeline that runs the hotspots in `tourOrder` (front → side → back): push-in, chapters, hold, next.
- [ ] A visible progress ring. A touch pauses the tour; a tap on the ring resumes it.

## 10. iPad testing (~1 h)
- [ ] Real iPad, plus Safari Responsive Design Mode at 11" and 13", in both orientations.
- [ ] Try to break it:
  - fast spins
  - rapid costume switching
  - rotating the device mid-story
  - the idle timeout firing during a story and during the tour
  - taps during transitions and before the models finish loading
- [ ] Stand 1.5 m away and check that hotspot labels are readable; note the result for the defence.
- [ ] Throttled load test: the still shows in under 3 s. Watch the frame rate on the stats panel with all three costumes lit.

## 11. README and defence prep (~45 min)
- [ ] The README contains:
  - the 10-line design rationale
  - a screenshot of the attract state, taken on the iPad
  - model credits
  - content disclosure (every hotspot with `invented: true`)
  - the rejected AI idea from DECISIONS.md
- [ ] Answer each of the five "Your call" items in the README.
- [ ] Rehearse 5–6 decisions, each with the alternative that was rejected.
