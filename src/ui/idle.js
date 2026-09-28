import gsap from 'gsap';

// Idle timer: any touch anywhere restarts it; when it runs out, onIdle returns the kiosk to the
// attract state for the next visitor. Listens in the capture phase, so no button or panel can
// swallow a touch before the timer sees it.
// It counts on the wall clock, checked every frame, not on GSAP's clock: Safari stops drawing
// while the screen sleeps or another app is in front, and GSAP's clock stops with it. So a kiosk
// that wakes after the time has run out goes back to the lineup on its first frame.
// onIdle returns false when it can't go yet (a move is running): the timer asks again a second
// later, unless a touch comes first.

const RETRY = 1000; // ms

export function createIdle({ seconds, onIdle }) {
  let due = null;  // Date.now() when it runs out; null once it has (until the next touch)
  let left = null; // ms left, while paused

  function reset() {
    due = Date.now() + seconds * 1000;
    left = null;
  }

  function check() {
    if (due === null || left !== null || Date.now() < due) return;
    due = onIdle() === false ? Date.now() + RETRY : null;
  }

  window.addEventListener('pointerdown', reset, { capture: true });
  gsap.ticker.add(check);
  reset();

  // The tour (step 12) pauses the timer while it plays, so a visitor watching it isn't reset.
  return {
    reset,
    pause: () => { if (due !== null && left === null) left = due - Date.now(); },
    resume: () => { if (left !== null) { due = Date.now() + left; left = null; } },
  };
}
