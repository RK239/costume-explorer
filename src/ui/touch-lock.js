// iPad Safari ignores user-scalable=no in the viewport tag, so the browser's own gestures are
// blocked here. The CSS side (touch-action, user-select, touch-callout) is in styles/base.css.
export function lockTouch() {
  const block = (event) => event.preventDefault();

  // Pinch zoom: Safari reports it through its own gesture events.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, block, { passive: false });
  }

  // Page scrolling, rubber-banding and pull-to-refresh. Nothing on the page scrolls by design,
  // and the turntable reads pointer events, which still fire.
  document.addEventListener('touchmove', block, { passive: false });

  // Long-press menu and text selection.
  document.addEventListener('contextmenu', block);
  document.addEventListener('selectstart', block);
}
