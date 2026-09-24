const params = new URLSearchParams(location.search);

// URL flags for testing:
//   ?dev=1    dev tools (stats panel, tap-to-log hotspot positions)
//   ?idle=5   shortens the idle timer to 5 s
//   ?dpr=1    overrides the pixel ratio, to measure what sharpness costs on a device
//   ?focus=2  which costume to open first (0, 1 or 2) until the selector exists
export const flags = {
  dev: params.get('dev') === '1',
  idleSeconds: Number(params.get('idle')) || 45,
  dpr: Number(params.get('dpr')) || null,
  focus: Number(params.get('focus')) || 0,
};

export const state = {
  mode: 'attract', // attract | explore | story | tour | transition
  focus: 0,        // index of the costume being explored
  lang: 'en',
};
