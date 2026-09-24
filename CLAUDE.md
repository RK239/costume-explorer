# Costume Explorer

A touch-first exhibition web page for an iPad kiosk. Three costumes stand on one dark 3D stage. Visitors turn a costume on its turntable and tap hotspots to read about material, making and artistry. This is a job assignment with a 1-day timebox and a 20-minute design defence afterwards.

@docs/BRIEF.md
@docs/ARCHITECTURE.md

Build order: docs/PLAN.md
Decisions log: docs/DECISIONS.md

## How to work with me
- Work through docs/PLAN.md in order, one step at a time. It has three phases: make it work, make it beautiful, make it solid. Phase 1 looks plain but uses the final structure (timelines, content.json, logical properties, tokens), so polish never means a rebuild.
- Show your plan for a step before writing code. Stop after each step so I can test on the iPad.
- After each step, explain what changed and why in 2–3 plain sentences. I have to defend every line in the review.
- I know Unity, Unreal and Blender well. When explaining a Three.js idea, relate it to those if that helps.
- Commit at the end of every 2–3 steps (marked in docs/PLAN.md), with a plain, descriptive message that names the steps it covers. Never squash, rebase or force-push; the reviewers read the commit history.
- When a design decision is made or changed, log it in docs/DECISIONS.md with the alternative we rejected.
- When I reject one of your suggestions, log it under "Rejected AI suggestions".
- Stay inside the brief. Camera try-on is out of scope.
- Allowed dependencies: `three`, `gsap`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-sans-arabic`. Ask before adding anything else.
- Allowed dev-only tools (model pipeline, never shipped): `vite`, `@gltf-transform/cli`, `@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions`, `meshoptimizer`, `sharp`.

## Stack (decided)
- Vite + vanilla JS/HTML/CSS. No framework.
- Three.js for the stage.
- GSAP for every choreographed move: camera, lights, UI, the tour.
- No camera-controls or OrbitControls. Visitors turn the costume on its turntable. Only the director moves the camera.
- All copy (both languages), hotspot data and model credits live in `src/content.json`. No copy hardcoded in JS.
- Hosting: GitHub → Vercel free tier, auto-deploy on push.
- Models:
  - optimised by `npm run models` (`scripts/optimise-models.js`, gltf-transform library): join, weld, optional simplify, drop tangents, WebP textures sized per slot, meshopt compression. Settings and the record of changes per model are in `scripts/models.config.json`.
  - loaded with GLTFLoader + MeshoptDecoder

## Hard constraints (check every change against these)
- Touch only. iOS Safari ignores `user-scalable=no`, so all of these are needed:
  - `touch-action: manipulation` on body and `touch-action: none` on the canvas
  - `preventDefault` on `gesturestart` and `gesturechange`
  - `overscroll-behavior: none`
  - `user-select: none` and `-webkit-touch-callout: none`
  - no `:hover` styles anywhere
- Single page with no reloads. First view appears in under 3 s: an HTML still of the attract shot shows immediately, and the live canvas dissolves in once the models are loaded.
- The costume is always readable on screen in portrait and landscape on 10–13" iPads.
  - The story panel never covers the costume; the camera reframes with lens shift instead.
  - Push-ins stop at a medium shot. Extreme close-ups are the story images.
- Hotspots:
  - 56–64 px markers (44 px is the minimum)
  - labels 32 px or larger on a solid plate
  - labels offset outward, away from the garment
  - opacity fades with the angle to the camera
- After 45 s with no touch, go to the attract state and reset the story, seen state and language. The `?idle=5` flag shortens the timer for testing.
- Every camera, light and UI move is a GSAP timeline with eased curves. Input is locked while a transition runs; the tour is the exception, and a touch pauses it. Nothing snaps.
- RTL is built with CSS logical properties, plus the deliberate overrides listed in docs/DECISIONS.md.
- The target is Safari on iPad. A step isn't done until it works there.

## Budgets
- Each GLB ≤ 3 MB, since all three load at start. Textures ≤ 2K.
- Each costume's textures ≤ ~100 MB of GPU memory (about 300 MB for all three), so Safari stays well inside its memory limit on a 2 GB iPad. `npm run models` prints the estimate.
- Pixel ratio capped at 2.
- No shadow maps (use blob shadows) and no heavy post-processing.
- Story images and attract stills: WebP, ≤ 200 KB each.

## Commands
- `npm run dev -- --host` (dev server reachable from the iPad on the same Wi-Fi)
- `npm run build` / `npm run preview`
- `npm run models` (optimise everything in `models-src/` into `public/models/`)
