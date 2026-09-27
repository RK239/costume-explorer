// Motion tokens: every choreographed move takes its timing and easing from here, the way the
// layout takes its sizes from tokens.css. One place to tune how the whole piece moves.
//
// The camera moves like a dolly on rails: slow to start, slow to land (power3.inOut).
// Panels arrive fast and settle (…out), and leave by accelerating away (…in).

export const MOTION = {
  camera:   { duration: 1.6, ease: 'power3.inOut' },  // settling on a costume, back to the lineup
  glide:    { duration: 2.2, ease: 'power2.inOut' },  // attract loop: slower, more ambient
  push:     { duration: 1.4, ease: 'power3.inOut' },  // story in: the camera to a medium shot
  pull:     { duration: 1.1, ease: 'power2.inOut' },  // story out: back to the full costume
  turn:     { duration: 1.3, ease: 'power2.inOut' },  // a turntable turning a detail to the visitor
  arrive:   { ease: 'power2.inOut' },                 // a costume arriving in front turns to face the visitor as the revolve lands
  revolve:  { duration: 1.6, ease: 'power2.inOut' },  // the revolving stage bringing a costume to the front
  swipe:    { ease: 'power2.out' },                   // …and landing after a swipe: already moving, it only slows
  light:    { duration: 1.2, ease: 'power2.inOut' },  // the stage light changing (front and upstage levels)
  panelIn:  { duration: 0.7, ease: 'power3.out' },
  panelOut: { duration: 0.45, ease: 'power2.in' },
  swapOut:  { duration: 0.25, ease: 'power1.in' },   // another hotspot in an open story: the words leave…
  swapIn:   { duration: 0.35, ease: 'power1.out' },  // …and return for the new detail as the camera lands
  grow:     { duration: 0.8, ease: 'power2.inOut' },  // the close-up growing out of the ring, in one move…
  growFade: { duration: 0.2, ease: 'power1.out' },    // …fading in as it leaves the ring
  draw:     { duration: 0.55, ease: 'power2.out' },   // the line from the ring to the panel
  retract:  { duration: 0.25, ease: 'power1.in' },
  bloom:    { duration: 1.1, ease: 'power2.out' },    // a back hotspot's first reveal
  language: { out: { duration: 0.3, ease: 'power1.in' }, back: { duration: 0.5, ease: 'power1.out' } }, // words out, page flips, words back
  home:     { duration: 2.2, ease: 'sine.inOut' },    // every costume turning to face front as the kiosk goes back to the lineup
  reframe:  { duration: 0.9, ease: 'power2.inOut' },  // the camera following a change of layout (a language switch)
  ringIn:   { duration: 0.6, ease: 'power3.out' },    // hotspot rings arriving, one after another
  hairline: { duration: 0.4, ease: 'power2.out' },    // a label's line drawing out from its ring…
  labelIn:  { duration: 0.55, ease: 'power3.out' },   // …and the label settling in after it
  labelOut: { duration: 0.25, ease: 'power2.in' },    // both drawing back as the detail turns away
};
