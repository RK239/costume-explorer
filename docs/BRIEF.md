# Assignment 3: Interactive 3D Costume Explorer
Timebox: 1 day | 20-minute design defence

## Brief
Build a touch-first exhibition web page where visitors explore three very different costumes as rotating 3D models, tap hotspots on the garment, and discover the material, making process and artistry through text and images. The experience should reward curiosity and make visitors want to inspect every side and return for the other costumes.

## Core experience
- [ ] 3 costumes, shown one at a time; each uses a free-licensed GLB/glTF model and is credited in the README.
- [ ] Each costume has a title, one-line wearer/location context and at least 3 hotspots placed on the model.
- [ ] At least 1 hotspot per costume must be on the back and only discoverable by rotating the model.
- [ ] Each hotspot contains Material, How it was made and The artistry (about 2 lines each), plus at least 1 relevant image.
- [ ] Invented but believable content is allowed; disclose invented content in the README.

## Interaction & 3D
- [ ] Costume selection must be obvious, one tap away, and transition deliberately rather than feeling like a page swap.
- [ ] The model slowly auto-rotates when idle; drag rotates it; auto-rotation resumes after interaction stops.
- [ ] Hotspots stay attached to their 3D position and fade or hide when facing away from the viewer.
- [ ] Hotspots must be readable from about 1.5 m away, have at least a 44 px touch target and never cover the detail they point to.
- [ ] Tapping a hotspot opens a connected story transition and reframes/turns the dress so that the selected detail faces the visitor.

## Attract state
- [ ] After 45 seconds with no touch, return to an idle attract state designed to stop a passer-by and invite interaction.
- [ ] The attract state should show or cycle through all 3 costumes and is the most important first-impression screen.

## Story & visual system
- [ ] Images must feel authored: a close-up should feel like leaning in; a sketch should feel like a designer's desk, not a plain gallery.
- [ ] Use one shared typography/layout system across all costumes, with a distinct accent colour taken from each garment.
- [ ] Support 2 languages, including 1 RTL language; the RTL composition must be intentionally designed, not simply mirrored.
- [ ] Portrait and landscape must both work on a 10–13 inch touch screen, with the costume always remaining on screen.

## Touch / performance
- [ ] Touch only: no hover dependency, no text selection, no page pinch zoom, no double-tap page zoom and no pull-to-refresh.
- [ ] No page reloads between states. First view should appear in under 3 seconds on Wi-Fi; preload/compress models so costume switching never flashes blank.

## Creative extra (pick one)
Sound matched to materials; subtle idle motion/light; a before/after or sketch-to-finished comparison; or a guided hotspot tour.
- [ ] Chosen: guided hotspot tour (see DECISIONS.md)

## Your call (explain in README)
- [ ] Hotspot style
- [ ] Long-story behaviour
- [ ] How seen points/costumes are indicated
- [ ] What happens after a very fast spin
- [ ] Whether all 3 costumes are ever shown together

## Submission
- [ ] One Git repository link + one live deployed link that works on a real iPad / Safari responsive mode.
- [ ] README: 10-line design rationale, screenshot of attract state, model credits, content disclosure, and one AI-generated idea you rejected on design grounds and why.
- [ ] Keep normal commit history; do not squash commits.
- [ ] Be ready to defend every major design choice in a 20-minute follow-up call.
