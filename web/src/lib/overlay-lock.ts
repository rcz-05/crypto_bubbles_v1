/**
 * Reference-counted "a blocking overlay is open" flag.
 *
 * While count > 0, <body> gets the `overlay-open` class. CSS uses it to:
 *   - lock background scroll (overflow:hidden), and
 *   - hide the bottom dock + install banner so only one blocking layer
 *     is interactive at a time (no tap-stealing, no visual collision).
 *
 * Ref-counted so a modal opened from a page that also has onboarding logic
 * can't leave the lock stuck on.
 */
let count = 0;

export function pushOverlay(): void {
  if (typeof document === "undefined") return;
  count += 1;
  document.body.classList.add("overlay-open");
}

export function popOverlay(): void {
  if (typeof document === "undefined") return;
  count = Math.max(0, count - 1);
  if (count === 0) document.body.classList.remove("overlay-open");
}
