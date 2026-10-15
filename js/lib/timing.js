// Shared timing rules (dev/SPEC.md section 4).
// Responses are timed with event.timeStamp from pointerdown or keydown, which
// is on the same clock as performance.now() and requestAnimationFrame.

// A response less than this long after the stimulus counts as a guess.
export const GUESS_MS = 100;

// Changes the screen inside an animation frame, then reports the next frame's
// timestamp as the onset. That is the closest a web page can get to the moment
// the change reached the screen. Returns a function that cancels it.
export function showOnNextFrame(change, onOnset) {
  let id = requestAnimationFrame(() => {
    change();
    id = requestAnimationFrame(onOnset);
  });
  return () => cancelAnimationFrame(id);
}
