// Motion tokens: every choreographed move takes its timing and easing from here, the way the
// layout takes its sizes from tokens.css. One place to tune how the whole piece moves.
//
// The camera moves like a dolly on rails: slow to start, slow to land (power3.inOut).
// Panels arrive fast and settle (…out), and leave by accelerating away (…in).

export const MOTION = {
  camera:   { duration: 1.6, ease: 'power3.inOut' },  // switching costume, back to the lineup
  glide:    { duration: 2.2, ease: 'power2.inOut' },  // attract loop: slower, more ambient
  push:     { duration: 1.4, ease: 'power3.inOut' },  // story in: the camera to a medium shot
  pull:     { duration: 1.1, ease: 'power2.inOut' },  // story out: back to the full costume
  turn:     { duration: 1.3, ease: 'power2.inOut' },  // a turntable turning a detail to the visitor
  light:    { duration: 1.2, ease: 'power2.inOut' },  // a costume lighting up or going dark
  panelIn:  { duration: 0.7, ease: 'power3.out' },
  panelOut: { duration: 0.45, ease: 'power2.in' },
  grow:     { duration: 0.75, ease: 'power3.inOut' }, // the close-up growing out of the ring
  draw:     { duration: 0.55, ease: 'power2.out' },   // the line from the ring to the panel
  retract:  { duration: 0.25, ease: 'power1.in' },
  bloom:    { duration: 1.1, ease: 'power2.out' },    // a back hotspot's first reveal
};
