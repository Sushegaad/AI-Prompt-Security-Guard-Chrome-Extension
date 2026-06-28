/* ============================================================================
 * AI Safety Guard — tiny hyperscript helper (single shared implementation)
 * ----------------------------------------------------------------------------
 * h('button.asg-btn', { onclick }, 'Label') -> HTMLButtonElement
 * Tag may include .class tokens. Text children are added as text nodes, so user
 * content is NEVER interpreted as HTML (defends against host-page injection).
 *
 * Used by the shadow-DOM UI (badge/modal/redact) and the extension
 * pages (popup/onboarding) — one implementation, no duplication.
 * ========================================================================== */

export function h(tagSpec, attrs = {}, children = []) {
  const [tag, ...classes] = String(tagSpec).split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === 'class') node.className = node.className ? node.className + ' ' + v : v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else if (k === 'checked') node.checked = !!v;
    else if (k === 'value') node.value = v;
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** Map a risk level id to its pill/dot modifier class suffix. */
export function riskClass(level) {
  return ['safe', 'medium', 'high', 'critical'].includes(level) ? level : 'safe';
}
