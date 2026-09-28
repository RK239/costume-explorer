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
- **Decision:** idle reset is one timeline: close the story, clear found state, reset the language, back to the lineup with every costume lit. If a move is already running when the timer fires, it retries a second later (a touch cancels the retry; see "The idle return").
- **Fix:** `director.play()` now keeps a timeline's own `onComplete`. Setting its own callback had silently replaced the one that hides the other costumes after a switch; a scripted run caught it.

## Attract state (step 8)
- **Problem (Rakesh, on the iPad):** on the lineup, each costume got a third of the width, about 5 cm tall on an 11" screen. Too small to stop anyone from a distance.
- **Decision:** a loop like a film sequence, about 36 s: a wide shot (3.5 s; 7.5 s since the revision below), then each costume as a hero shot (~8 s), then back to the wide shot.
  - In the hero shot, the costume fills the height of its side of the screen, about 2.4× larger than on the lineup. Its key light swells while the others fall to 10%. Changing light is what catches the eye from across a room.
  - The wide shot stays, briefly, so visitors see there are three. It's the only place all three are shown together (a "Your call" answer).
  - **Rejected:** the static lineup (too small from a distance); cycling hero shots only (the visitor never learns there are three).
- **Decision:** one headline position for the whole loop, laid out like a poster. Landscape: a column at the inline end, with the costume framed beside it through lens shift. Portrait: headline below, costume above. Only the camera moves; the type never jumps.
  - **Revised (Rakesh, 2026-09-28), portrait only:** the title and subtitle sit at the top, centred under the language button, and "Touch the costume to begin" sits centred under the stage; the costumes stand between them, like a theatre poster. It reads top to bottom (what this is, the show, what to do), matches the centred stage, and puts the invitation next to what it asks you to touch. Centred text needs no mirroring in Arabic. Landscape keeps the column beside the costumes.
  - **Revised again (Rakesh, 2026-09-28, after a live preview):** the heading sits higher, level with the language button (its accent line 28 px from the top), with the title 8% smaller in portrait so it clears the button on every iPad width (20 px at 744 wide, 25 px at 768, 39 px at 834). The invitation ends 80 px from the bottom, off the edge and nearer the stage, and is a size larger (text ×1.25, a 38 px ring) so it reads from a distance.
- **Decision (Rakesh, 2026-09-28):** the attract loop's camera stands at 0.8 m, about the costumes' middle, not at a standing visitor's eye height (1.4 m). From eye height the front costume's base sits far below the two upstage, so the group reads as a lopsided V; from 0.8 m the three line up around one horizontal axis and the floor flattens. The framing is measured from that camera: the three tops and the front edge of each plinth (nearer the camera than its axis), so the stage sits centred between the title and the invitation (at 768×1024: 60/61 px above and below in the wide shot, 38/37 in each hero shot, 61/60 in a hand-over). The camera rises to eye height as a visitor steps in, and comes back down on Home or the idle return. Applies in both orientations.
  - **Rejected:** keeping eye height and only re-centring (the V stays); lowering the camera after framing from eye height (the tall armour upstage left empty headroom).
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
- **Revision (2026-09-25, Rakesh):** the wide shot holds 7.5 s instead of 3.5 s before the first hero shot, and all three costumes turn slowly and together while it holds (0.15 rad/s, about one turn in 40 s; explore turns at 0.25). The loop is now about 40 s.
  - **Why:** the first seconds are the passer-by's first look; they should take in all three, calmly, before the camera picks one.
  - Changes of pace glide (a 1 s time constant), and a costume already turning is never reset to rest. Before, starting the wide shot stopped every turntable with a small jolt and eased it up again, and the last-explored costume waited 3 s before turning at all. On first load the turntables ease up from rest.
  - **Rejected:** a longer wide shot only on the first pass. Every return to the wide shot is a new passer-by's first look.
- **Confirmed (2026-09-26, Rakesh, revolving stage):** every loop starts with all three costumes facing front, and so do Home and the idle return. (For a moment it was only on Home and idle; Rakesh: every reset should face front.) See "how the costumes turn in the attract loop" below.
- **Revision (2026-09-25, Rakesh):** every attract loop starts from the same place. Whenever the camera travels back to the wide shot (at the end of each loop, and on the idle return after a visitor), every costume turns back to its first position (`yawOffset`, the angle it loads at), the shortest way, over the same 2.2 s, then stands still until all three set off turning together.
  - **Why:** the loop is the exhibition's opening sequence; like a film, it should play the same every time and never carry on from where the last visitor left a costume.
  - The turn back is eased (sine) and at most half a turn. The costumes hidden during explore keep turning while hidden, so they need it as much as the one the visitor turned.
  - **Considered:** snapping the hidden costumes back to their first positions out of sight instead of turning them. Kept the turn for all three, so the reset reads as one movement as they come back into view. (Switching no longer depends on where a hidden costume stands: it's set out of sight on arrival; see Transitions.)

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
  - **Revision (2026-09-25, Rakesh: "the rotation of the selected costume only works sometimes"):** measured over eight switches, the arrival turn ranged from 0.97 to 5.51 rad in the same 1.6 s (from barely moving to a near-full whirl), because a hidden costume's angle was wherever it had drifted. Then it stood dead still for 3 s every time, since arriving counted as a touch.
    - Now a costume arriving from a switch (it was hidden) is set out of sight to exactly 60° (1.05 rad) before its front and turns forward onto it: the same gentle arrival every time. From the attract state it's already in view, so it takes the shorter way to its front instead.
    - It goes straight into its slow turn when it lands, no 3 s pause: the arrival was a move, not a touch.
    - A drag that starts while the camera is still moving used to be ignored for its whole length. It still does nothing during the move (input stays locked), but if the finger is still dragging when the move lands, the turntable takes it from there. It never counts as a tap.
    - **Rejected:** keeping the next-front rule and just shortening long turns (still a different arrival every time).
  - **Revision (2026-09-25, Rakesh: "the model suddenly appears and the camera moves"):** frame by frame, the arriving costume switched on in the first frame at its "dark" level, already visible at the frame edge (a neighbour's edge sits inside the explore framing), and lit to full while the camera had barely moved; the costume left behind was switched off at the end while its edge was still in frame.
    - **Cause (a bug since step 2):** "going dark" only ever dimmed the key light. three.js ignores a material's `envMapIntensity` when the light comes from `scene.environment`, so the room fill never dimmed. Fixed by giving each costume's materials the environment as their own `envMap` (measured: the same pixel as before when lit, black at 0).
    - **Now a light cross-fade:** the costume the camera leaves fades out as it goes (1.1 s); the next one comes up as the camera lands (from 0.4 s, 1.2 s). Below light level 0.1 a costume's fill goes out and it dissolves into the stage colour (a small mix added at the end of its shader, a uniform, no recompile), so at 0 every pixel is exactly the stage colour: measured (11, 11, 12) on the arriving dress at the start of a switch. Showing and hiding happen at 0, so neither is ever seen.
    - Levels of 0.1 and above look exactly as before, so the attract state's dimmed neighbours (0.1) still read as a gallery. The idle return now brings the hidden costumes up out of the dark too.
    - **Rejected:** keeping all three costumes visible in explore so nothing ever needs showing (the neighbour at the frame edge would be drawn in full every frame; the armour alone is 450k triangles on the iPad 5); fading with material opacity (switching `transparent` recompiles shaders, and a see-through scan shows its own inside).
- **Decision:** first-reveal bloom. The first time a back hotspot turns into view during a visit, its ring swells and fades twice in the accent colour. Never again for that visitor; the idle reset clears it.
  - **Why:** "reward curiosity". Turning the costume round is the behaviour the brief wants to encourage, so it gets a moment the first time it pays off.

## Visual system (step 10)
- **Decision:** IBM Plex Sans (400, 500, 600), with IBM Plex Sans Arabic from the same family in step 11. One type scale in `tokens.css`, set for reading distance (1 CSS px ≈ 0.19 mm on these iPads).
  - **Hierarchy by size, weight and colour only; never capitals or letter-spacing.** Arabic has neither, so the same hierarchy carries over to RTL unchanged. (The story eyebrow was uppercase and tracked in Phase 1; now it's a small semibold line in the accent.)
  - **Rejected:** a separate display face. It would need its own Arabic partner, which breaks "one shared system".
- **Decision:** accent colours sampled from the garments, not picked. `npm run accents` reads each model's colour textures, groups the coloured pixels into hue families, averages each, and lightens it (same hue) until it reads at WCAG 4.5:1 on the stage. The accent is used for small text and thin lines.
  - National Costume: **#AD675D**, the rose of its silk embroidery (hue ~5°). Not the silk ground (~25°, 97% of the texture), which reads as tan on screen.
  - Parade Armour: **#8A7963**, its gilding (hue ~35°). Not the leather straps (~15°), which would be nearly the same brown as the National Costume. Re-sampled from the 4K texture: #8A7B69, the same gold within a shade, so the accent stays.
  - Calligraphy Dress: **#5D74DA**, the royal blue of its print (hue ~225°, 5.6% of the texture, 4.7:1). Not its dominant orange (~25°, 46%) or red (~5°): with the rose and the gilding, that would be three warm accents, and the brief asks for distinct ones. The blue is a real colour of the garment and the only cool accent of the three. (`npm run accents -- 7` lists the print's minor colours.)
- **Decision:** hotspot style. A hollow ring (2.5 px, off-white, with a dark outline so it reads on light silk and on polished steel), a 21 px leader line, and the label on a solid plate. A seen ring fills with the costume's accent.
- **Decision:** story panel. The image sits on top as the insert shot, then a small accent eyebrow (the costume), the title, the chapters as text tabs with an accent marker (stacked in a narrow panel), then the text.
  - The image has a guaranteed share: 40% of the panel, up to 340 px, and it yields, down to 120 px, only when a long chapter needs the room. Text is never cut and never scrolls.
  - **Measured**, for every hotspot's every chapter at 10.2" (1024 × 768 / 768 × 1024), 11" and 13" in both orientations: all fit. The tightest case (the iPad 5 in landscape, a 5-line chapter) shrinks the image from 210 to 182 px.
  - On short screens (under 800 px tall) the UI bands tighten (title card 116 px, selector 124 px) to give the panel room.
- **Decision:** image treatments. A close-up is full-bleed with a vignette and keeps pushing in, very slowly, after it lands (1.00 → 1.08 over 14 s), continuing the camera's move ("feel like leaning in"). A sketch is a sheet of paper taped to the desk at −2.2° (RTL mirrors it), with a soft shadow, the drawing multiplied into the paper rather than laid on top ("a designer's desk, not a plain gallery"). The close-up's flight from the ring lands on the sheet at the same tilt.
  - **Revised (Rakesh, 2026-09-27):** every story image is a full-bleed close-up, the back hotspots' too. The sketch treatment (paper taped to the desk) read as an odd sticker on the panel. It stays available in the code (`image.kind: "sketch"`) but no story uses it.
- **Decision:** selector thumbnails rendered from the costumes at load (a three-quarter view, lit, cropped to 3:4), not image files. They can't drift out of step with the models. Rendering each costume once at load also uploads its textures to the GPU, which was a planned step 13 item (the first switch never stalls).
- **Decision:** when every hotspot on the current costume is found, the next unfinished costume's button pulses gently in its own accent. "Make visitors want to return for the other costumes."
- **Decision:** stage light without extra lights. A warm glow on a backdrop behind each costume separates dark silk and steel from the black (a rim light's job), and a pool of light on the floor around each plinth grounds it. Both are unlit gradients, added on top, and they follow the costume's light level (dark costumes lose their glow).
  - **Rejected:** a rim spot light per costume. Every pixel would pay for three more lights; the iPad 5 is the worst case.
- **Decision (Rakesh to confirm by eye):** tone mapping **Neutral** (Khronos PBR Neutral) instead of AgX. Neutral keeps base colours close to the scan and only compresses the brightest highlights. AgX desaturated the rose silk. `?tone=agx` switches for comparison.
- **Open:** hotspot labels are 34 px semibold on a solid plate. Rakesh to test at 1.5 m with a tape measure. *(Superseded: 28 px medium on the image, no plate. See "Visual changes after step 10".)*
- **Open (copy):** several chapters run 4–5 lines at iPad widths; the brief says "about 2 lines each". Trim in the copy pass, which also gives the image back its full share.

## Visual changes after step 10 (Rakesh's review, 2026-09-25)
- **Decision:** depth instead of a backdrop (`stage/atmosphere.js`). Each costume stands in a shaft of light falling through haze, with dust drifting in it, and seven faint shafts stand 7–30 m back in the dark, fainter with distance.
  - **Why:** the glow panel behind each costume read as a lit wall; in the wide shot the three joined into a band standing on a floor. Now nothing behind the costumes is a surface. The far shafts drift slower than the costumes when the camera moves (parallax), which is what reads as depth.
  - Only the far half of each shaft is drawn, so the haze sits behind the costume and never veils it; it still lifts dark silk and steel off the black (the job of the old glow, and of a rim light).
  - Dust close to the camera draws larger and fainter, like dust out of focus near a lens, so a push-in never fills the frame with bright specks.
  - Unlit and additive, no real lights (no shader recompiles), about 7 + 3 cone meshes and 270 points.
  - **Revision (2026-09-25, Rakesh: "some spot light is falling on the backdrop, too distracting"):** the haze was brightest from 0.5 to 1.2 m, right behind the costume's body, so it read as a spotlight on a wall. Now the shaft is narrower (0.75 m at the floor, was 0.95), about 25% fainter, and its haze starts above the costume (from ~0.9 m, full by ~2.2 m), so the space directly behind the garment stays dark and the costume stands in front of depth. The floor pool stays, to ground it; the distant shafts are 30% fainter.
  - **Rejected:** pools of light on the floor under the distant shafts. From 10–30 m a floor pool is seen almost edge-on and flattens into a horizontal streak that reads as a shelf, the wall problem again. **Rejected:** real volumetric fog (ray-marched), too heavy for the iPad 5.
- **Decision:** cinematic hotspot labels. Type on the image like a film title, no plate: 28 px medium with a soft dark halo, joined to the ring by a 1 px hairline. The ring is finer (24 px, 2 px stroke, a point at its centre); the touch target stays 60 px.
  - **Why:** Rakesh found the 34 px semibold labels on solid plates too big and distracting; they competed with the costume they were meant to point at.
  - **Choreographed, not always on:** arriving at a costume, the rings come in one after another, then each hairline draws out and its label slides in from the ring. A label draws out only once its detail faces the visitor (facing above 0.6) and draws back as it turns away (below 0.45; the gap stops flicker), while the ring stays as the invitation. So only what can be seen is named, and turning the costume keeps revealing names.
  - **Legibility trade-off:** 28 px capitals are about 3.7 mm, about 8.5 arcminutes at 1.5 m (32 px was about 10). Medium weight and the halo keep the edges crisp on silk. The 1.5 m tape-measure test is still Rakesh's to do; raise `--text-label` if it fails.
  - **Rejected:** keeping the plates at a smaller size (still boxes on the costume); hiding labels until a ring is tapped (the brief wants labels readable at 1.5 m, and the name is what invites the tap).

## Third costume: the Calligraphy Dress (2026-09-25)
- **Decision (Rakesh):** the third costume is the Calligraphy Dress, a scanned contemporary cotton dress with a printed patchwork of letter shapes. Title "The Calligraphy Dress"; context "A gift from a Turkish friend, worn at home for prayer in summer", from the uploader's own note.
- **Placement fixes in the pipeline** (`scripts/models.config.json`, both new options in `placeOnStage`):
  - `tilt`: the scan leaned about 6° back and 2.5° sideways, so the top would have traced a 12 cm circle on the turntable. Measured from cross-sections (the chest's centre against the hem's) and corrected to within 1 cm.
  - `centreOn`: the axis is centred on the skirt, not the whole bounds. The forward-bent forearms had pulled the bounds' centre 10 cm forward, so the dress orbited instead of turning in place.
- **Hotspots:** four, like the other two (two front, one side, one back): the neckline's cord embroidery, the lettering, the corded cuffs, and the patchwork on the back (the sketch). All placed with `dev.probe` and checked on the model; each story turns its detail to face the visitor (facing 0.99–1.00) and every chapter fits the panel.
  - **The lettering** says plainly that the letters are shapes from Arabic script that spell nothing (the uploader's own words), and gives them no meaning.
  - The copy is shorter than the other two costumes' (79–125 characters per chapter), closer to the brief's "about 2 lines".
  - Material, making and artistry are invented but believable (`invented: true`), apart from the facts the uploader gave (cotton, the gift, prayer at home in summer, decorative lettering). It's a placeholder draft: Rakesh writes the copy for all three costumes in one pass later.
- **Open (Rakesh):** re-pose the forearms in Blender so they hang down. They're bent forward from the scan and read, from the side, as arms held out. `centreOn` keeps the other hotspots valid through the change; only the cuff hotspot needs placing again.
  - **Rejected:** keeping the pose as it is (on an empty dress it reads as a mistake, not a gesture).

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
  - **Revision (2026-09-26, Rakesh: "fix the hole in the national costume in Blender"): patched.** The hole (~10 x 25 cm, in the cream striped lining low on the cape's front edge) showed the brown breeches through it, or black from other angles.
    - **Why Fill Holes couldn't work:** the scan builds the thin lining as a closed shell (a ray through intact lining crosses its front and back 3 mm apart), so the hole is a tunnel through it, with no open edge to fill. Measured: the gap's rim lies on the scan's surface, but the nearest open edge is 8–13 cm away. A first attempt that filled the nearest closed loop filled a different hole, hidden under the embroidered border.
    - **The patch:** a new piece of lining laid over the hole, as you would by hand (`scripts/blender/patch-national-lining.py`, headless, reproducible). Seen from a camera facing the hole, a grid is set on a smooth surface fitted to the lining around it (1.49 mm residual), 1.5 mm in front. It has its own small texture (256 x 512, 15 KB): the lining's stripes measured (tilt 6.5°) and continued straight across from the real lining on either side, so they meet it in step. 2,328 triangles; bounds unchanged, so placement and hotspots stay valid. The original scan is kept in `models-src/originals/`.
    - The torn outer edge of the lining keeps a few small gaps below the patch: that's the cape's real edge, outside it.
    - **Rejected:** texturing the patch from intact lining above the hole (the left side landed on brown silk and embroidery); a flat cream colour (reads as a painted-over patch among the stripes); stretching the scan's own atlas across the gap (it maps into other islands of the texture sheet).
  - **Resolved:** the garment ends at the knee, so it floats 40 cm above the plinth. It stays floating, like an invisible mannequin (Rakesh rejected the mount rod).
- **2026-09-25: The Parade Armour of King Erik XIV: on stage as costume 3.** Chosen by Rakesh with the National Costume. Replaces the King in slot 3.
  - A complete suit, helmet to sabatons, already in metres (1.67 m), feet at the bottom, front facing +X. The pipeline turns it −90°. No lift or mount needed. The back plate is decorated: the back-only hotspot.
  - **Geometry:** the relief (repoussé lions, scrollwork, rivets) lives in the mesh, not the texture. Simplifying to 150k turned it into faceted "foil"; 300k still lost it; **450k keeps most of it (4.53 MB, over the 3 MB budget).** Cloth survives heavy simplification because its detail is in the textures; embossed metal doesn't.
  - **Planned fix:** bake a normal map from the 1M original onto a ~150k mesh in Blender. That keeps the relief at a third of the triangles, and it's the standard game-art route. Until then, 450k.
  - **Texture:** Rakesh downloaded Sketchfab's 1K option, too soft for a full-body scan. Re-download at 4K; the pipeline already allows 4K for this model.
  - **2026-09-25: the 4K texture is in.** Compared in the breastplate push-in at iPad pixel density: at 4K the etched scrollwork and the figures in the medallions are crisp; at 1K they're soft. Kept at 4K (~89 MB GPU; the three costumes together ~267 MB, inside ~300).
  - **Over the file budget: 6.55 MB against 3 MB** (1K: 4.53, 2K: 5.02). The texture isn't the lever: the 450k-triangle geometry is ~4.3 MB of it. Accepted for now, since the first view is the HTML still (step 13) and the models load behind it (~11.4 MB for all three). **The fix (Rakesh, Blender):** bake a normal map from the 1M original onto a ~150k mesh; that cuts the geometry to ~1.5 MB and keeps the relief in the light.
  - **Rejected:** dropping to 2K to save 1.5 MB. Still over budget, and the push-ins lose the etching that the armour's hotspots are about.
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
- **2026-09-25: Arabic Calligraphy Dress (Taylor / thoulihan, CC BY 4.0).** **Chosen as the third costume** (Rakesh). The GLB passed: one opaque material, one 4K texture, 23 MB → 1.98 MB and 116k triangles after `npm run models`. Its forearms are bent forward from the scan (see "Third costume").
  - A real garment, scanned with an Artec Leo (tagged `noai`). The uploader's note: her sister's cotton dress, a gift from a Turkish friend, worn at home for prayer in warm summer months. The calligraphy is decorative; the letters don't spell anything.
  - Different from the other two in every way the brief could mean: contemporary rather than 1562 or 1778, a woman's rather than a king's, printed cotton rather than silk or steel, everyday and devotional rather than ceremonial. The patchwork of orange, blue, green and red is the most colourful thing on the stage.
  - It gives the Arabic version a reason to exist: the one costume that carries Arabic lettering, in an exhibition that speaks Arabic.
  - **Care in the copy:** say plainly that the lettering is ornament, not text, and never give it a meaning; keep the prayer use to what the uploader said.
  - **Tech:** 463k triangles (needs simplifying to ~120k; plain cotton folds should survive better than the armour's relief), 1 material, 1 texture (size unknown). To check in the GLB: texture resolution, scale, scan holes at the neck and hem, and what's on the back for the back hotspot.
- **2026-09-25: "dress", red with ruffles (novadea, CC BY 4.0).** Licence fine, not recommended. A dramatic silhouette, but a CG garment (likely CLO or Marvelous Designer; the uploader's six garments are all 1.2–3.3M triangles, posted over five weeks, with no descriptions), so there's no maker, wearer or history to tell. 1.46M triangles, almost all in the ruffles, whose thin edges would break long before the ~150k we need. And its red accent would sit next to the National Costume's rose. The Calligraphy Dress stays the pick, even with its sleeves to re-pose.
- **2026-09-25: Gold and White Dress with Layered Skirt (MrRohanGupta404, CC BY-NC 4.0).** Not usable: NonCommercial (see the rule above), and its skirt print comes from FreeVector.com under a licence of its own. Also a Marvelous Designer fashion piece with no maker, wearer or history, next to two museum scans. 305k triangles, 2 materials, 5 textures.
  - **Transparency, for any sheer garment we consider:** alpha *cutout* (glTF MASK) is safe. Alpha *blend* needs work: three.js sorts see-through meshes per object, not per triangle, so layers merged into one mesh draw in file order and pop over each other as the turntable turns. It would need `join` skipped for that model, each layer kept as its own mesh with a `renderOrder` from inner to outer (correct from every angle on a turntable), the atmosphere's shaft drawn before it, and a check of the overdraw on the iPad 5.
  - **Rejected:** adjusting sharpness continuously (dynamic resolution). The costume would visibly soften and sharpen, which reads badly on an exhibition screen.

## Legibility
- **Open:** hotspot label size. On an iPad, 1 CSS px is about 0.19 mm, so a 32 px label has capitals about 4.3 mm tall. At 1.5 m that's about 10 arcminutes, the 20/40 line on an eye chart: readable, but only just. Test 36–40 px semibold at 1.5 m with a tape measure and log the result here.
- **Changed (2026-09-25):** labels are now 28 px medium on the image (capitals about 3.7 mm, about 8.5 arcminutes at 1.5 m), because the larger plated labels distracted from the costume. The tape-measure test still decides the final size.

## Creative extra
- **Decision:** guided hotspot tour, ordered front → side → back so it ends on the hidden detail.
  - **Why:** it reuses the push-in and story timelines, and it works like a shot list. It also serves the visitor who won't explore alone.
  - **Never cut:** it's the only creative extra, so if time runs short it shrinks to the current costume's hotspots rather than going.
  - **Alternative still open:** a raking-light idle, the brief's "subtle idle motion/light" option. Textile conservators use low-angle light to reveal weave and embroidery. Switch to it if the models have strong normal detail.
  - **Rejected:**
    - Sound: questionable in a shared exhibition space, and iOS needs a tap before audio can play.
    - Sketch-to-finished comparison: extra assets per hotspot.

## Your call
- **Hotspot style:** a hollow ring, so the detail stays visible through it. The label sits on the outward side, away from the garment, on a hairline leader, as type on the image with no plate. Opacity fades with the angle to the camera, and a label draws out only while its detail faces the visitor.
  - **Rejected:** solid pins, which cover the detail; binary show/hide, which pops.
- **Long-story behaviour:** three short chapters tapped through, with no scrolling.
  - **Rejected:** a scrolling panel. Scrolling fights the touch lock and reads badly at 1.5 m.
- **Seen state:** a ring fills once opened; the selector shows "n/total found" per costume. Everything resets on attract, because attract means a new visitor.
- **Very fast spin:** the turntable's speed is clamped, labels hide above a threshold and return once it settles, and auto-rotate eases back in after the delay.
  - **Rejected:** snapping to the nearest side. It takes control away from the visitor.
- **All three together:** always. In the attract wide shot all three are lit as a group; while exploring, the two not in front stand dimly upstage behind it, which also shows the visitor there's more (Revolving stage).

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

Built in step 11 (2026-09-26):
- **Decision:** a language button, one tap, always on screen in the top corner at the inline end (right in English, left in Arabic): above the headline in the attract state, above the story panel in a story. It names the other language in that language ("العربية" / "English"), so a visitor finds their own. Centred titles keep clear of that corner.
- **Decision:** switching is a move, not a jump: the words fade out, the page flips direction while they're hidden, the camera glides to the mirrored framing (the costume moves to the right of the panel or headline), and the words come back. An open story keeps its chapter. In the attract state the loop carries on and re-frames its current shot. The idle reset switches back to English at once (nobody is looking).
- **Decision (numerals):** Eastern Arabic digits (٠١٢٣…) in Arabic: dates in the copy and the "found" counts (`num()` in i18n.js). They read as the exhibition's own voice in Arabic; Western digits would be the practical choice for a Maghreb audience.
- **Decision:** Arabic type is IBM Plex Sans Arabic, the same family as the Latin. Sizes step up about 10% and lines open up (body 1.75, display 1.25) for the letters' dots and marks. The Latin display type's slight negative letter-spacing is a token that is 0 in Arabic: spacing breaks Arabic's joined letters.
- **Decision:** the Calligraphy Dress's Arabic title is «فستان الحروف», "the dress of letters", not "calligraphy dress". An Arabic reader sees at once that the letters spell nothing; calling it calligraphy would claim what the dress doesn't have.
- **Decision (Rakesh):** the attract loop speaks the kiosk's language, all of it: an English loop in English, an Arabic loop in Arabic, laid out right to left (headline on the left, the costume on the right). Choosing Arabic in the attract state re-frames the shot on screen for the flipped layout and the loop carries on in Arabic. Home keeps the visitor's language, so a visitor who explored in Arabic returns to an Arabic loop; the idle reset returns the kiosk to English.
- **Decision (Rakesh):** a Home button under the language button, in the same corner container, so the two move together when the language flips the page. It closes any story, pulls the camera back to the wide shot and hands over to the attract loop, which carries on as usual.
  - Unlike the idle reset, Home keeps the visitor's language, so the loop carries on in that language.
  - **Revised (Rakesh, 2026-09-27):** Home also clears the found counts, like every return to the first positions. It clears them once the move back has landed, so the counts don't drop to zero while the buttons fade out. (It used to keep them, since the visitor is still standing there.)
  - Shown while exploring and in a story; hidden in the attract state, where you're already home. A house and the word, in the language on screen.
  - The story panel on that side starts below the two buttons (`--corner-stack`); its image yields the height, and every chapter still fits at 10.2".
- **Kept on purpose:** the hotspot labels stay on the garment's outer side in both languages (they point at the garment, not into the text), and the stage, turntables and camera moves don't mirror.
- **Done (Rakesh, 2026-09-28):** the hotspot chapters and image descriptions are in Arabic too, so the Arabic version has no English left. Translated from the current English draft, in the register of the existing Arabic (the same terms for each detail, Eastern Arabic digits, names in Arabic script). Every chapter still fits the panel in Arabic at 1024×768 and 768×1024.
  - **Open:** if Rakesh's copy pass changes the English, the Arabic follows it. The Arabic was drafted by Claude; unless a native reader checks it, the README says so.
  - **Rejected:** machine-mirroring the whole page (the brief asks for an RTL composition designed on purpose); translating the draft chapters now (they're about to be rewritten).

## Reading while turning (2026-09-26)
- **Decision (Rakesh):** the costume stays in the visitor's hands during a story. They can turn it while they read, and tap the next ring without closing the panel.
  - **Why:** to go from one detail to the next, a visitor had to close the story, find the ring and open it again. That was a lot of friction for the thing the brief wants most ("inspect every side").
- **How it works:**
  - The first drag in a story pulls the camera back to the whole costume beside the panel (`director.storyOverview`), so turning shows the garment, not a close crop. The story stays open.
  - The other rings and their labels show as the costume turns. The detail being read keeps only its ring: the panel's title already names it.
  - Tapping another ring swaps the story in place: the text and image fade out, the turntable turns the new detail to the camera and the camera pushes in on it, and the new story fades in with its line and close-up.
  - Tapping the ring being read, after turning, pushes in on it again.
  - The slow auto-turn winds down while a story is open, so the detail being read doesn't drift away.
  - Labels keep clear of the panel as well as the screen edges. Where a label fits on neither side of its ring, the ring shows alone (the ring stays tappable). This happens mostly in portrait, where the gap beside the panel is narrow. The label draws out once the costume turns it into the clear.
- **Kept (Claude's defaults, 2026-09-26):** a tap on the empty stage still closes the story, and a hotspot still pushes in. The camera only pulls back once the visitor starts turning.
  - **Rejected:** closing the story to switch hotspots (the friction this removes); dropping the push-in so the costume is always whole (it loses "leaning in", and the brief asks for a reframe on the selected detail); the other rings hidden until the story closes (nothing to find while reading).

## Revolving stage (experiment, branch `revolving-stage`, 2026-09-26)
- **Why:** first-time visitors found it hard to switch costumes: nothing on screen said there were two more, and the buttons at the bottom read as status.
- **Decision (Rakesh's idea):** the other two costumes stand dimly lit in the background, behind the one being explored, on a revolving stage. A swipe on the empty stage turns it and brings the next costume forward. The costumes themselves show that there's more, and the way to it.
  - The camera stays at the front and the stage turns. Light follows position, so the arriving costume comes up as it comes forward.
  - One revolve for everything, attract included. Upstage costumes go dark in a story, so nothing competes with the reading.
- **Decision (Rakesh):** the attract loop is one continuous take on the revolve, and every shot holds the whole group: slightly wide, the hero in front and the other two visible upstage, because a passer-by who sees several costumes is more likely to come closer. (A first version went tight on each hero with the others dark: the revolve itself was never seen, and turns read as slides.)
  - Beats per costume: hand-over (the stage brings the next one round, the camera eases back, all three lit), arrival (the camera closes in, the hero's light swells, the other two sink to a dim 0.2), hero (it turns to show its back while the camera leans in very slowly). After the third, the hand-over widens into the establishing shot, which holds still for 7.5 s while all three turn (Rakesh's earlier call), then the camera moves in once onto the first hero. The stage always turns the same way, so a loop never jumps back.
  - Fixed (Rakesh, 2026-09-26): the first hero (the Calligraphy Dress) got an extra zoom. The establishing shot crept in, stopped, and the dress's arrival pushed in again. Now the wide shot holds still and the arrival is the only move in, as for the other two.
  - Fixed (Rakesh, 2026-09-26): the dress also turned back to its front on arrival (it had drifted about 60° during the wide shot), then turned forward again to show its back. Now the costume in the centre stays facing front, still, through the wide shot (the two upstage keep turning), so there's nothing to correct: it turns like every other hero.
  - Fixed (Rakesh, 2026-09-26): the camera's move in still felt odd on the dress. Every arrival moved in, stopped for about 0.6 s, then crept in again for the lean; around the other two the turning stage hid the pause, but the dress's move starts from a still wide shot onto a still stage. Now each arrival and its lean are one move that never stops (the lean runs underneath the arrival, one ease), and the dress's approach is a little longer and gentler (3 s).
  - In the attract loop the stage closes up (the upstage pair stands nearer the hero), so the whole group fits beside the headline; it opens out when a visitor steps in.
  - The next costume comes round from the side away from the headline (from the left in English, from the right in Arabic).
  - A hand-over is framed for the stage halfway round, its widest point, so the whole turn stays clear of the headline and the frame edges. In portrait the framing starts below the language button, and counts how tall an upstage costume appears (a tall one upstage can reach above the hero).
  - A language switch or a rotation replays the current beat for the new layout, the shortest way round.
  - **Rejected:** a tight hero with the others dark (hides the choice); lighting the upstage pair past a tight hero (one stood behind the headline, the other was cut by the frame edge).
- **Decision (Rakesh, 2026-09-26): how the costumes turn in the attract loop.** Measured over a loop, the slow turn was the same for all three (0.15 rad/s), but the dress showed its back four times slower than the others.
  - Whenever a costume stands in the centre, it faces the visitor: a costume the stage brings round turns to its front as it arrives (the shortest way, hidden in the stage's turn), and the costume in the centre stays facing front, still, through the wide shot while the two upstage turn slowly. So the first hero (the dress) needs no correction on arrival.
  - Every hero shows its back and comes round to its front at one pace (half a turn in 3.6 s), turning forwards, and hands back to the slow turn without a jolt (an ease whose end slope matches the slow turn, and the costume is let go already turning).
  - Every reset turns all three to face front: at the start of every loop (while the stage comes round to its first position), and on Home and the idle return (as the camera pulls back).
  - **Decision (Rakesh, 2026-09-26):** the wide shot holds with all three still, facing front; all three start turning together as the camera starts to move in (the two upstage into their slow turn, the one in the centre to show its back). This replaces the earlier call (2026-09-25, for the row) that the costumes turn slowly through the first 7–8 s.
  - **Decision (Rakesh, 2026-09-26):** the wide shot isn't fully still: a fully idle frame for 8 s reads as frozen. The camera creeps in, very slowly, from the moment the wide shot settles, and the creep gathers into the move in on the first hero and its lean: one move that never stops (the creep, the arrival and the lean are eased shares of one tween, so there's no second zoom).
  - **Tried and reverted (same day):** a stricter rule (never turn backwards, no turn to the front on arrival, a slow forward reset during the wide shot). Rakesh: it felt odd; costumes arrived in the centre at any angle, and Home no longer brought them to face front at once.
  - A tap on an upstage costume brings it forward; the buttons still work, the shorter way round.
  - The swipe is direct manipulation (the finger sets the revolve's angle, like the turntable drag); the landing is a GSAP timeline, and input is locked from the first movement to the landing.
- **Rejected:** the row with the camera travelling along it (the neighbours sit just outside the frame, so nothing says there's more); a glimpse of the neighbours at the frame edges with name tags (Rakesh: odd composition; see Rejected AI suggestions); upstage costumes dimly lit in a story (they compete with the text).
- **Cost:** all three costumes are drawn while exploring, instead of one. To measure on the iPad (`?dev=1`); the armour's normal-map bake helps.

## Rotation and language switches (2026-09-28)
- **Why:** Rakesh: portrait looked right, but rotating to landscape and switching language looked odd. Measured in the browser: a language switch in the attract loop left the costumes behind the headline's words for 1–3.5 s and replayed the current costume's turn from its front; rotating mid-loop cut to the wide shot and glided back in, and the costume turned backwards to start its turn again; in a story the panel came back while the costume was still sliding past it; exploring on a 12.9" iPad, the armour's two-line title card covered its helmet (and Arabic cards ran 3–16 px into the costume's space).
- **Decision:** the attract loop's camera frames live. Every move goes from one framing to another, and both ends are worked out from the screen's current layout every frame. Rotating re-frames the same moment: no cut to another shot, no beat played again.
- **Decision:** a language switch hides the words, flips the page, moves the camera to the new layout, and brings the words back only once it has landed, in every mode. In the loop, the camera eases from where it was into the live framing and the loop carries on.
- **Decision:** exploring, each costume is framed below its own title card, measured for every costume once per layout with a hidden copy of the card (a long title wraps; Arabic runs larger), and with the front edge of its plinth counted, so it stays clear of the buttons below.
- **Rejected:** replaying the current beat for the new layout (it restarted the costume's turn and cut the camera first); a larger fixed band for the title card (it would shrink every costume to suit the longest title).

## The idle return (2026-09-28)
- **Why:** Rakesh: sometimes the attract loop didn't seem to start after the idle time. Measured in the browser, the return itself worked every time (from explore, from a story in Arabic, after a swipe), but:
  - after the 2.4 s pull-back, the wide shot held for another 7.6 s with nothing turning, so for about 10 s the screen read as frozen;
  - the timer ran on GSAP's clock, which stops whenever Safari stops drawing (screen asleep, another app in front). With the timer at 5 s and frames stopped for 8 s, the return came at 13 s;
  - mid-move, the timer retried every second, and a new touch didn't cancel the retry: a visitor who touched again was sent back to the lineup 0.8 s later.
- **Decision:** after Home or the idle return, the wide shot holds for 2.5 s instead of 7.5 s: the pull-back has just shown the wide moment. At start-up and within the loop, it still holds 7.5 s.
- **Decision:** the idle timer counts on the wall clock, checked every frame, so a kiosk that wakes after 45 s goes back to the lineup on its first frame. Mid-move it still asks again a second later, but a touch cancels that.
- **Rejected:** no hold after a return (the loop would start moving in the moment the pull-back lands: two moves with no breath between them); a timer on `setTimeout` (Safari throttles it in the background too, and it would sit outside the one loop).

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
  - **Reversed (2026-09-26):** Rakesh asked for the fix. Fill Holes turned out to be the wrong tool (the lining is a closed shell, so there's no open edge); it's patched with a new piece of lining instead (see "Models and licences").
- **2026-09-25: A warm glow on a backdrop behind each costume** (step 10), to separate dark garments from the black without extra lights.
  - **Why rejected:** Rakesh saw it read as a wall behind the costumes. Replaced by shafts of light through haze and distant lights that recede into the dark ("Visual changes after step 10").
- **2026-09-25: Hotspot labels at 34 px semibold on solid plates** (step 10), chosen for reading at 1.5 m over busy silk.
  - **Why rejected, on design grounds:** Rakesh found them too big and distracting: boxes on the costume that competed with the detail they point to. Replaced by cinematic labels, type on the image with a halo, drawn out only while the detail faces the visitor.
- **2026-09-26: An attract loop that alternates English and Arabic shot by shot** (each shot laid out in its own direction), so a passer-by who reads either is invited even though the idle reset returns the kiosk to English. Claude proposed and built it after Rakesh asked for the hero and wide shots in Arabic.
  - **Why rejected:** Rakesh: the loop can't mix languages. It follows the kiosk's language: an English loop in English mode, an Arabic loop in Arabic mode.
- **2026-09-26: A glimpse of the neighbouring costumes at the frame edges, with name tags** ("Calligraphy Dress ›", tap to go there), so a first-time visitor sees there's more to the side. Claude proposed it with the edge swipe, since the next costume already stands just past the frame edge while exploring.
  - **Why rejected, on design grounds:** Rakesh: cropped costumes and tags at the edges would look odd in the composition. Instead, the other two costumes stand dimly lit in the background, behind the one being explored, and a swipe brings the next one forward.
- **2026-09-27: Sketch images on a designer's desk for the back hotspots** (step 10): the image as a sheet of paper, tilted and taped down, with the drawing multiplied into it, from the brief's "a sketch should feel like a designer's desk".
  - **Why rejected, on design grounds:** Rakesh: the paper and tape looked like an odd sticker on the panel, and the renders are close-ups, not drawings. All story images are now full-bleed close-ups.
- *(Log more as they happen: the suggestion, why it was rejected, and the date.)*
