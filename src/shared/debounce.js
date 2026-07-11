/* ============================================================================
 * AI Prompt - Security Guard — debounce
 * ----------------------------------------------------------------------------
 * The inline badge (A1, Phase 3) scans on input but must NEVER scan on every
 * keystroke. Wrap the scan in debounce(fn, 300) so it runs at most once per
 * 300ms of quiet typing (the design's responsiveness target).
 * ========================================================================== */

export function debounce(fn, wait = 300) {
  let timer = null;
  function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
