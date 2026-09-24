# Architecture

## The idea in one line
One dark stage with three costumes, each on its own turntable. Visitors turn the costume; the camera belongs to a "director" that makes every move with GSAP.

## Stage
- The three costumes stand in a row on the X axis, about 3 m apart (tune by eye). Each sits in its own `Group` (the turntable pivot), with feet at y = 0 and the front facing +Z.
- A thin plinth disc under each costume turns with it. It makes the turning read clearly.
- Fake contact shadow: a plane with a radial-gradient texture under each costume. No shadow maps.
- Lighting:
  - `RoomEnvironment` via `PMREMGenerator` at low intensity as fill (no HDR download)
  - one `SpotLight` key per costume, positioned front-high and a little off-axis so it rakes across the fabric
  - a costume goes dark by tweening its key light intensity and its materials' `envMapIntensity` to near zero. Collect each costume's materials at load.
  - never toggle a light's `visible`. Three.js recompiles every material when the number of lights changes, which stalls the iPad. Only change intensity.
- Background: a near-black stage colour.
- Tone mapping: AgX or Neutral. Rakesh picks by eye and logs the choice. Output is sRGB.
- Camera: a PerspectiveCamera with a vertical FOV around 30° (roughly a 45 mm full-frame vertical equivalent). Rakesh has the final say on the lens.

## Interaction model: turntable, not orbit
- A horizontal drag rotates the focused costume's turntable (`rotation.y`). Vertical drag is ignored.
- Only the first pointer counts; extra touches are ignored. Use `setPointerCapture`.
- On release, the turntable keeps turning with inertia and damping; clamp the maximum angular velocity.
- Auto-rotate: a slow constant turn when idle. It resumes about 3 s after the last touch, easing up to speed rather than jumping.
- Fast spin: when |angular velocity| passes a threshold, add `.spinning` to the overlay (labels hide). Remove it once the turntable settles.
- Tap vs drag: movement under ~8 px and release under ~300 ms counts as a tap. Hotspots are DOM buttons, so taps on them never reach the canvas.
- No pinch zoom on the model. Close-ups are authored through hotspots, which keeps the costume readable on screen.

## Camera director
- `frameCostume(costume, freeRegion)` returns the camera position and look target that fit the costume's bounding box inside the free screen region:
  - fit height with the vertical FOV
  - fit width with the horizontal FOV, `2·atan(tan(vfov/2)·aspect)`
  - take the larger distance and add a margin
- Lens shift: `camera.setViewOffset` moves the costume into the free region when the story panel is open. The perspective doesn't change. Tween the offset with GSAP.
  - Landscape LTR: the panel sits on the right, so shift the costume left.
  - RTL: mirror that. The panel sits on the left, so shift the costume right.
  - Portrait: the panel is a bottom sheet, so shift up.
- Push-in on a hotspot:
  - Turn the turntable so the hotspot faces the camera. With the hotspot's local yaw `a = atan2(nx, nz)` and the camera's yaw from the costume `c`, the target rotation is `c − a`; wrap the difference to [−π, π] for the shortest turn.
  - At the same time, dolly the camera toward the hotspot's height until `frame` × costume height is visible (`frame` comes from content; 0.5–0.8 is typical).
  - Push-ins stop at a medium shot. The story image is the insert.
- Re-run the framing on every `resize` and orientation change.

## Hotspots
- DOM buttons in an overlay layer above the canvas; the overlay itself is `pointer-events: none`.
- Every frame, for each hotspot of the focused costume:
  1. `world = turntable.localToWorld(localPos)`, then `ndc = world.clone().project(camera)`. The projection already includes the lens shift. If `ndc.z > 1`, hide it.
  2. Position the element with `transform: translate3d(x, y, 0)`.
  3. Facing test: rotate the local normal by the turntable's world quaternion, then take `d = dot(normal, normalize(cameraPos − world))`. Set `opacity = smoothstep(0.05, 0.3, d)`. Below 0.5 opacity, turn off pointer events.
  4. Label side: if the marker is left of the costume's centre on screen, the label goes left; otherwise right. Keep labels clear of the screen edges.
- Optional: raycast occlusion every ~6 frames, only if a hotspot visibly shows through an arm or a fold.
- Marker: a hollow ring so the detail stays visible through it, with the label on a short leader line. Once opened, the ring fills (seen state).

## State machine and timelines
- The main modes are `attract`, `explore`, `story` and `tour`. While a timeline runs between them, the app sits in `transition`.
- Every change of mode is a function that returns a GSAP timeline.
- `director.play(tl)` locks input until the timeline completes. The tour is the exception: a touch pauses it with `tl.pause()`.
- The 45 s idle timer pauses while the tour plays, and restarts when the tour is paused or ends.
- One loop: `gsap.ticker.add(update)`. `update` advances the turntables, projects the hotspots and renders, so tweens and frames stay in lockstep.
- Accent colour: tween the `--accent` CSS variable on `:root` with GSAP.

## Loading and first view
- `index.html` shows the attract still (`<picture>`, with a landscape and a portrait version) and the bilingual headline straight away.
- Load all three GLBs in parallel. When all three are ready, render the live scene, then crossfade the canvas in over the still.
- A tap that arrives before the models are ready is queued and handled once they load.
- Upload every texture to the GPU at load (`renderer.initTexture`, or `renderer.compileAsync` on the whole scene). Otherwise the first switch to a costume stalls while its textures upload.
- After the models, preload and `decode()` every story image, so a story never opens on a blank image.
- The attract stills are captured from the live scene in dev mode, so the dissolve is invisible.

## Content schema (`src/content.json`)
```json
{
  "costumes": [{
    "id": "armour",
    "model": "/models/armour.glb",
    "yawOffset": 0,
    "accent": "#B8452E",
    "title":   { "en": "", "ar": "" },
    "context": { "en": "", "ar": "" },
    "credit":  { "name": "", "author": "", "url": "", "licence": "" },
    "hotspots": [{
      "id": "crest",
      "side": "back",
      "tourOrder": 3,
      "position": [0, 1.62, -0.12],
      "normal": [0, 0, -1],
      "frame": 0.6,
      "label":    { "en": "", "ar": "" },
      "material": { "en": "", "ar": "" },
      "made":     { "en": "", "ar": "" },
      "artistry": { "en": "", "ar": "" },
      "image": { "src": "/images/armour-crest.webp", "kind": "closeup", "alt": { "en": "", "ar": "" } },
      "invented": true
    }]
  }]
}
```
Positions and normals are in costume-local space. `image.kind` is `closeup` or `sketch`.

## File layout
```
src/
  main.js            boot, wiring
  state.js           mode, focused costume, language, seen set
  content.json
  stage/
    scene.js         renderer, camera, environment, lights, plinths, shadows
    costumes.js      loading, turntable groups, light up / go dark
    turntable.js     drag, inertia, auto-rotate, fast-spin detection
    director.js      framing, lens shift, push-in, mode timelines
  ui/
    hotspots.js      DOM markers, projection, facing fade, label side
    story.js         panel, chapters, image treatments, connecting line
    selector.js      costume thumbnails, "n/total found"
    attract.js       attract timeline and headline
    idle.js          45 s timer
    tour.js          guided tour timeline
    i18n.js          language switch, dir="rtl"
  styles/
    tokens.css  base.css  rtl.css
public/
  models/  images/  stills/
models-src/          raw GLBs from Blender (not deployed)
```

## Dev tools (`?dev=1`)
- Tapping the model logs the costume-local position and normal of the hit, ready to paste into content.json.
- Stats panel from `three/addons/libs/stats.module.js`.
- A button that saves the current canvas as a still. Capture immediately after a render call.
