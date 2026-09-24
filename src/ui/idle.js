import gsap from 'gsap';

// Idle timer: any touch anywhere restarts it; when it runs out, onIdle returns the kiosk to the
// attract state for the next visitor. Listens in the capture phase, so no button or panel can
// swallow a touch before the timer sees it. Runs on GSAP's clock, like everything else.

export function createIdle({ seconds, onIdle }) {
  let timer = null;

  function reset() {
    timer?.kill();
    timer = gsap.delayedCall(seconds, () => {
      timer = null;
      onIdle();
    });
  }

  window.addEventListener('pointerdown', reset, { capture: true });
  reset();

  // The tour (step 12) pauses the timer while it plays, so a visitor watching it isn't reset.
  return {
    reset,
    pause: () => timer?.pause(),
    resume: () => timer?.resume(),
  };
}
