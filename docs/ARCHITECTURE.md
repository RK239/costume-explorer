# Architecture

## The idea in one line
One dark stage with three costumes on a revolving stage, each on its own turntable. Visitors turn the costume, or swipe the stage to bring the next one forward; the camera belongs to a "director" that makes every move with GSAP.

## Stage
- The three costumes stand on a revolving stage (`revolve.js`), one slot each on an ellipse whose front point is the origin. The costume in front is the one being explored; the other two stand upstage behind it (1.5 × `deep` back, ±`across` to the sides; narrower in portrait so they stay in frame).
- Each costume has a `station` (the revolve moves it) holding its turntable (the pivot visitors turn), its shaft of light and its key light. Feet at y = 0, front facing +Z.
- A thin plinth disc under each costume turns with it. It makes the turning read clearly.
- Fake contact shadow: a plane with a radial-gradient texture under each costume. No shadow maps.
- Lighting:
  - `RoomEnvironment` via `PMREMGenerator` at low intensity as fill (no HDR download)
  - one `SpotLight` key per costume, positioned front-high and a little off-axis so it rakes across the fabric
  - light follows position: every frame, each costume's level is mixed from `light.back` to `light.front` by how near the front it is, so the arriving costume brightens as it comes forward and the leaving one dims as it goes upstage. The director tweens only `light.front` / `light.back` (attract wide: both at the glow; exploring: 1 / 0.07; attract hero and story: 1 / 0).
  - a level sets the key light intensity and the materials' `envMapIntensity`. Collect each costume's materials at load, and give them the environment as their own `envMap`: three.js ignores `envMapIntensity` for `scene.environment`.
  - below level 0.1 a costume also dissolves into the stage colour (a uniform mixed in at the end of its shader), so the upstage pair sinks into the dark; at 0 it isn't drawn.
  - never toggle a light's `visible`. Three.js recompiles every material when the number of lights changes, which stalls the iPad. Only change intensity.
- Background: a near-black stage colour.
- Air without lights (`atmosphere.js`): each costume stands in a shaft of light through haze (a cone mesh, only its far half drawn, brightness from the view angle), with a pool on the floor and dust drifting in it; all of it follows the costume's light level. Faint shafts 7–30 m back give depth through parallax. Unlit and additive, so nothing recompiles.
- Tone mapping: Neutral by default (`?tone=agx` to compare); Rakesh confirms by eye. Output is sRGB.
- Camera: a PerspectiveCamera with a vertical FOV around 30° (roughly a 45 mm full-frame vertical equivalent). Rakesh has the final say on the lens.

## Interaction model: turntable, not orbit
- A horizontal drag on the costume rotates its turntable (`rotation.y`), while exploring and during a story. Vertical drag is ignored.
- Exploring, a drag that starts on the empty stage (or on an upstage costume) turns the revolve instead: the costume in front follows the finger (gain 1.4). On release the director lands it on the next costume if the swipe went past 30% of a slot or was flicked that way, otherwise back where it was. A tap on an upstage costume brings it to the front.
- Only the first pointer counts; extra touches are ignored. Use `setPointerCapture`.
- On release, the turntable keeps turning with inertia and damping; clamp the maximum angular velocity.
- Auto-rotate: a slow constant turn when idle. It resumes about 3 s after the last touch, easing up to speed rather than jumping. Changes of pace glide.
- Attract: one continuous take. Every shot frames the whole group (`director.frameGroup`: the hero in front, the pair upstage, the stage closed up to fit beside the headline). Per costume: hand-over (revolve turns, camera eases back, all lit), arrival (camera closes in, hero lit, upstage at 0.2), hero (it turns to show its back, pauses, comes round to its front, while the camera leans in). The revolve always turns one way, the next costume coming from the side away from the headline, and each loop starts with the revolve at its home (the middle costume in front). A costume in the centre always faces the visitor: it turns to its front as the stage brings it round. The wide shot holds with all three still, facing front (7.5 s at start-up and in the loop, 2.5 s after Home or the idle return, whose pull-back has just shown it); all three start turning as the camera moves in (the two upstage at 0.15 rad/s). Every hero turns at one pace and hands back to the slow turn without a jolt. Every reset turns all three turntables to `rig.home` (front): at the start of each loop, and on Home and the idle return as the camera pulls back.
- Fast spin: when |angular velocity| passes a threshold, add `.spinning` to the overlay (labels hide). Remove it once the turntable settles.
- Tap vs drag: movement under ~8 px and release under ~300 ms counts as a tap. Hotspots are DOM buttons, so taps on them never reach the canvas.
- No pinch zoom on the model. Close-ups are authored through hotspots, which keeps the costume readable on screen.

## Camera director
- The camera stands level and never rotates: at eye height (1.4 m) while exploring, and at 0.8 m (about the costumes' middle) in the attract loop, so the three line up around one axis; it rises as a visitor steps in. A `shot` object `{ x, y, z, shiftX, shiftY }` holds its position and lens shift, and every camera move is a GSAP tween on it. `update()` applies it each frame.
- The camera stays at the front of the revolve and only pushes in, pulls back and shifts; the revolve brings each costume to it. Switching is one timeline: the revolve turns (shortest way), the stage light follows, the camera settles and the arriving costume turns its front to the visitor.
- The free region is the screen minus the UI bands in `tokens.css` (`--frame-top`, `--frame-bottom`, `--frame-inline`), so layout and camera share one source.
- `frameCostume(costume, freeRegion)` returns the shot that fits the costume inside the free screen region:
  - the subject is the costume's height from the plinth's underside to its top, and its reach from the turntable axis at any angle (`rig.radius`)
  - fit height with the vertical FOV and width with the horizontal FOV, `2·atan(tan(vfov/2)·aspect)`, each scaled to the region's share of the screen
  - take the larger distance and add a margin
  - lens shift moves the costume's centre from where a level camera sees it to the region's centre
- Lens shift: `camera.setViewOffset` does all the framing, including making room when the story panel is open. The perspective doesn't change. `shiftX/shiftY` are in NDC units, so a tween survives a resize.
  - Landscape LTR: the panel sits on the right, so shift the costume left.
  - RTL: mirror that. The panel sits on the left, so shift the costume right.
  - Portrait: the panel is a bottom sheet, so shift up.
- Push-in on a hotspot:
  - Turn the turntable so the hotspot faces the camera. With the hotspot's local yaw `a = atan2(nx, nz)` and the camera's yaw from the costume `c`, the target rotation is `c − a`; wrap the difference to [−π, π] for the shortest turn.
  - At the same time, dolly the camera toward the hotspot's height until `frame` × costume height is visible (`frame` comes from content; 0.5–0.8 is typical).
  - Push-ins stop at a medium shot. The story image is the insert.
- In a story, the first drag pulls the camera back to the whole costume beside the panel (`storyOverview`). Tapping another ring swaps the story in place and pushes in on the new detail; the panel stays open.
- Re-run the framing on every `resize` and orientation change. Mid-transition, it re-frames once the move lands. The attract loop frames live instead: each camera move blends two framings worked out from the current layout every frame, so a rotation re-frames the same moment and a language switch eases across.
- Exploring, the free region starts below the costume's own title card (label.js measures each costume's card once per layout), and the plinth's front edge is counted in the framing.

## Hotspots
- DOM buttons in an overlay layer above the canvas; the overlay itself is `pointer-events: none`.
- Every frame, for each hotspot of the focused costume:
  1. `world = turntable.localToWorld(localPos)`, then `ndc = world.clone().project(camera)`. The projection already includes the lens shift. If `ndc.z > 1`, hide it.
  2. Position the element with `transform: translate3d(x, y, 0)`.
  3. Facing test: rotate the local normal by the turntable's world quaternion, then take `d = dot(normal, normalize(cameraPos − world))`. Set `opacity = smoothstep(0.05, 0.3, d)`. Below 0.5 opacity, turn off pointer events.
  4. Label side: if the marker is left of the costume's centre on screen, the label goes left; otherwise right. Keep labels clear of the screen edges and, in a story, of the panel. If a label fits on neither side, the ring shows alone.
- Optional: raycast occlusion every ~6 frames, only if a hotspot visibly shows through an arm or a fold.
- Marker: a fine hollow ring with a centre point, so the detail stays visible through it, and the label as type on the image (soft halo, no plate) on a hairline leader. Once opened, the ring fills (seen state).
- Labels are choreographed: on arrival the rings come in one after another and the labels follow. A label draws out only while its detail faces the camera (with hysteresis) and draws back as it turns away.

## State machine and timelines
- The main modes are `attract`, `explore`, `story` and `tour`. While a timeline runs between them, the app sits in `transition`.
- Every change of mode is a function that returns a GSAP timeline.
- `director.play(tl)` locks input until the timeline completes. The tour is the exception: a touch pauses it with `tl.pause()`.
- The 45 s idle timer pauses while the tour plays, and restarts when the tour is paused or ends. It counts on the wall clock, checked every frame (GSAP's clock stops while Safari isn't drawing), so a kiosk that wakes after 45 s goes back to the lineup at once. Mid-move it asks again a second later, unless a touch comes first.
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
  "exhibition": { "title": { "en": "", "ar": "" }, "subtitle": { "en": "", "ar": "" } },
  "ui": {
    "chapters": { "material": {}, "made": {}, "artistry": {} },
    "close": {}, "found": { "en": "{n} of {total} found" }, "imagePending": {}, "touchToBegin": {}
  },
  "costumes": [{
    "id": "armour",
    "model": "/models/armour.glb",
    "yawOffset": 0,
    "accent": "#B8452E",
    "shortTitle": { "en": "", "ar": "" },
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
Positions and normals are in costume-local space. `normal` is the direction the detail is best seen from (rounded from the surface normal; see DECISIONS.md). `image.kind` is `closeup` or `sketch`. Every piece of visible copy, including UI words, lives here with `en` and `ar` slots.

## File layout
```
src/
  main.js            boot, wiring
  state.js           mode, focused costume, language, seen set
  content.json
  stage/
    scene.js         renderer, camera, environment, lights, plinths, shadows
    costumes.js      loading, turntable groups, light up / go dark
    stand-in.js      dress-form stand-ins while a costume has no model yet
    atmosphere.js    shafts of light, haze, dust and distant lights (unlit, additive)
    thumbnails.js    selector thumbnails rendered from the costumes at load (also uploads textures)
    revolve.js       the revolving stage: slots, light by position
    turntable.js     drag, inertia, auto-rotate, fast-spin detection, the stage swipe
    director.js      framing, lens shift, push-in, mode timelines
  motion.js          motion tokens: every duration and ease
  dev.js             ?dev=1 tools: stats, load status, probe, tap-to-log hotspot positions
  ui/
    hotspots.js      DOM markers, projection, facing fade, label side
    story.js         panel, chapters, image treatments, connecting line
    selector.js      costume buttons, "n of total found"
    label.js         the costume's title card while exploring
    home.js          the Home button (under the language button): back to the lineup and the attract loop
    attract.js       attract timeline and headline
    idle.js          45 s timer
    tour.js          guided tour timeline
    i18n.js          t(), num(), setLanguage (lang, dir="rtl", re-renders), the language button
    touch-lock.js    blocks Safari's pinch, scroll, long-press and selection
  styles/
    tokens.css  base.css  ui.css  rtl.css
public/
  models/  images/  stills/
models-src/          raw GLBs from Blender (not deployed)
scripts/
  optimise-models.js npm run models (gltf-transform library)
  models.config.json texture sizes per slot, per-model settings, record of changes (CC BY)
  sample-accents.js  npm run accents: accent colours sampled from each garment's textures
  blender/patch-national-lining.py  headless Blender: patches the hole in the National Costume's lining
```

## Dev tools (`?dev=1`)
- Started before the models load. The readout shows each model's load progress (or failure) and any error, since the iPad has no console to read.
- `?skip=<id>,<id>` loads stand-ins instead of those models, to find a model a device can't handle.
- `dev.probe(index, side, y, across)` in the console fires a ray at a costume from a side and returns hotspot position and normal.
- Tapping the model logs the costume-local position and normal of the hit, ready to paste into content.json.
- Stats panel from `three/addons/libs/stats.module.js`.
- A button that saves the current canvas as a still. Capture immediately after a render call.
