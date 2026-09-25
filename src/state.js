const params = new URLSearchParams(location.search);

// URL flags for testing:
//   ?dev=1    dev tools (stats panel, load status, tap-to-log hotspot positions)
//   ?idle=5   shortens the idle timer to 5 s
//   ?dpr=1    overrides the pixel ratio, to measure what sharpness costs on a device
//   ?focus=2  skip the attract state and open costume 2 (0, 1 or 2)
//   ?skip=parade-armour,national-costume  load stand-ins instead, to find a model a device can't handle
//   ?tone=agx  compare AgX tone mapping with the default, Neutral
export const flags = {
  dev: params.get('dev') === '1',
  idleSeconds: Number(params.get('idle')) || 45,
  dpr: Number(params.get('dpr')) || null,
  focus: params.has('focus') ? Number(params.get('focus')) || 0 : null,
  skip: (params.get('skip') ?? '').split(',').filter(Boolean),
  tone: params.get('tone') === 'agx' ? 'agx' : 'neutral',
};

export const state = {
  mode: 'attract', // attract | explore | story | tour | transition
  focus: 0,        // index of the costume being explored
  story: null,     // { rig, hotspot } while a story is open
  seen: new Set(), // "costumeId:hotspotId" for every story opened since the last attract
  lang: 'en',
};
