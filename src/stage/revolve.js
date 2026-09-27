import { setLight } from './costumes.js';

// The revolving stage. The three costumes stand on one revolve, a slot each: the costume at the
// front is the one being explored, the other two stand upstage behind it, dimly lit, so a visitor
// always sees there are more. Switching turns the revolve, and a swipe on the empty stage turns it
// under the finger. The camera stays at the front; the stage brings the costumes to it.
//
// The slots lie on an ellipse whose front point is the origin, so the costume in front always
// stands exactly where the director frames it. In Unity terms, each costume's `station` is a
// parent transform the revolve moves; its turntable (the visitor's) turns inside it.
//
// Light follows position: a costume's level is mixed from `light.back` to `light.front` by how
// near the front it is, every frame. So while the revolve turns, by GSAP or by a finger, the
// arriving costume comes up as it comes forward and the leaving one dims as it goes back.

const BACK = 0.07; // light level of the costumes upstage while exploring: there, but quiet
// Metres. `across`: how far to the sides the ellipse reaches (the upstage pair stands at 0.87 of
// it); `DEEP`: half the revolve's depth, so the upstage pair stands 1.5 × DEEP behind the front.
// Exploring, the stage is spread out around the costume; in the attract loop it closes up, so the
// whole group fits beside the headline. Portrait is narrower, so the upstage pair stays inside
// the frame instead of being cut by its edges.
const ACROSS = {
  landscape: { explore: 1.85, attract: 1.25 },
  portrait: { explore: 1.25, attract: 1.1 },
};
const DEEP = 2.7;

export function createRevolve({ rigs }) {
  const count = rigs.length;
  const slot = (Math.PI * 2) / count; // one costume's turn
  const middle = (count - 1) / 2;     // at angle 0 the middle costume stands in front (the order reads left to right)
  const turn = { angle: 0 };          // tweened by the director, or set by the finger
  const light = { front: 1, back: BACK };
  const layout = { attract: 0 };      // 0: spread out for exploring, 1: closed up for the attract loop (tweened)

  const isPortrait = () => matchMedia('(orientation: portrait)').matches;
  function across(attract = layout.attract) {
    const widths = isPortrait() ? ACROSS.portrait : ACROSS.landscape;
    return widths.explore + (widths.attract - widths.explore) * attract;
  }

  // A costume's place on the ellipse: 0 is the front, ±slot the upstage pair.
  const slotAngle = (index, angle = turn.angle) => angle + (index - middle) * slot;

  // `attract` picks the layout (0 spread out, 1 closed up): the director frames the attract shots
  // for where the stage will be, not where it is mid-move.
  function positionAt(index, angle = turn.angle, attract = layout.attract) {
    const theta = slotAngle(index, angle);
    return { x: across(attract) * Math.sin(theta), z: DEEP * (Math.cos(theta) - 1) };
  }

  // 1 in front, easing to 0 one slot away.
  function closeness(index) {
    const k = Math.max(0, 1 - Math.abs(wrapAngle(slotAngle(index))) / slot);
    return k * k * (3 - 2 * k);
  }

  // The costume standing in front at `angle`.
  function frontAt(angle = turn.angle) {
    let best = 0;
    rigs.forEach((rig, i) => {
      if (Math.abs(wrapAngle(slotAngle(i, angle))) < Math.abs(wrapAngle(slotAngle(best, angle)))) best = i;
    });
    return best;
  }

  // The revolve angle that brings `index` to the front, from `from`: the shortest way, or turning
  // only in `direction` (−1 or +1), as the attract loop does to keep turning one way.
  function angleFor(index, { from = turn.angle, direction = 0 } = {}) {
    let delta = wrapAngle(-(index - middle) * slot - from);
    if (direction < 0 && delta > 1e-6) delta -= Math.PI * 2;
    if (direction > 0 && delta < -1e-6) delta += Math.PI * 2;
    return from + delta;
  }

  // Called every frame: every costume to its place and its light. A costume at level 0 isn't drawn
  // at all (it has dissolved into the stage by then); its light stays, only at zero, since
  // changing the number of lights recompiles every material.
  function update() {
    rigs.forEach((rig, i) => {
      const { x, z } = positionAt(i);
      rig.station.position.set(x, 0, z);
      const level = light.back + (light.front - light.back) * closeness(i);
      setLight(rig, level);
      rig.turntable.visible = rig.air.visible = level > 0.001;
    });
  }

  return {
    turn, light, layout, back: BACK, slot, middle, positionAt, frontAt, angleFor, update,
    get across() { return across(); }, // metres the front costume travels per radian, near the front
  };
}

// Wrap an angle to [−π, π].
function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
