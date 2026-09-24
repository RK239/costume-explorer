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

## Framing
- **Decision:** a hotspot push-in stops at a medium shot; the extreme close-up is the story image.
  - **Why:** it's two scales of the same detail, like a medium shot plus an insert, and the garment stays readable on screen.
- **Decision:** the story panel makes room through lens shift (`setViewOffset`), not by moving or shrinking the costume.
  - **Why:** the perspective stays the same, so it reads as a camera choice rather than a UI resize.
- **Decision:** lens around 30° vertical FOV (~45 mm full-frame vertical equivalent). *Rakesh to confirm.*
- **Decision:** tone mapping AgX or Neutral. *Rakesh to choose by eye and log why.*

## First view
- **Decision:** an HTML still of the attract shot shows instantly; the live scene dissolves in once the three models load. The still is captured from the live scene, so the dissolve is invisible.
  - **Rejected:** a loading spinner, which is a dead first impression in the most important screen.

## Choreography
- **Decision:** every camera, light and UI move is a GSAP timeline, and input is locked while one runs.
  - **Why:** camera, light and panel are timed on one timeline, like an edit.
- **Decision:** the tour is a single timeline, so a touch pauses it and a tap resumes it.

## Creative extra
- **Decision:** guided hotspot tour, ordered front → side → back so it ends on the hidden detail.
  - **Why:** it reuses the push-in and story timelines, and it works like a shot list.
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
- The story panel moves to the reading-start side, and the lens shift mirrors with it.
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
- *(Log more as they happen: the suggestion, why it was rejected, and the date.)*
