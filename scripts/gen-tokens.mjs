/* ============================================================================
 * AI Safety Guard — generate src/shared/tokens.css from constants.js
 * Run: npm run gen:tokens  (also runs automatically on prebuild)
 *
 * constants.js is the SINGLE source of truth for token values. This script
 * emits the :root CSS variables from it and appends the static component
 * helpers (tokens.base.css). tokens.css is therefore a generated artifact —
 * never hand-edit it; edit constants.js (and tokens.base.css for class rules).
 * ========================================================================== */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BRAND, RISK, RADIUS, SPACE, TYPE, ELEVATION, FONTS } from '../src/shared/constants.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function rootVars() {
  const v = {
    '--font-ui': FONTS.ui,
    '--font-data': FONTS.data,
    '--weight-regular': FONTS.weight.regular,
    '--weight-medium': FONTS.weight.medium,
    '--color-trust': BRAND.trust,
    '--color-ink': BRAND.ink,
    '--color-paper': BRAND.paper,
    '--color-muted': BRAND.muted,
    '--color-trust-hover': BRAND.trustHover,
    '--color-trust-soft': BRAND.trustSoft,
    '--color-border': BRAND.border,
    '--color-surface': BRAND.surface,
    '--color-on-trust': BRAND.onTrust,
    '--risk-safe-fg': RISK.safe.fg,
    '--risk-safe-bg': RISK.safe.bg,
    '--risk-medium-fg': RISK.medium.fg,
    '--risk-medium-bg': RISK.medium.bg,
    '--risk-high-fg': RISK.high.fg,
    '--risk-high-bg': RISK.high.bg,
    '--risk-critical-fg': RISK.critical.fg,
    '--risk-critical-bg': RISK.critical.bg,
    '--radius-sm': RADIUS.sm,
    '--radius-md': RADIUS.md,
    '--radius-lg': RADIUS.lg,
    '--radius-pill': RADIUS.pill,
    '--space-1': SPACE.s1,
    '--space-2': SPACE.s2,
    '--space-3': SPACE.s3,
    '--space-4': SPACE.s4,
    '--space-5': SPACE.s5,
    '--shadow-modal': ELEVATION.modal,
    '--shadow-badge': ELEVATION.badge,
    '--text-xs': TYPE.xs,
    '--text-sm': TYPE.sm,
    '--text-md': TYPE.md,
    '--text-lg': TYPE.lg,
    '--text-xl': TYPE.xl,
    '--line-snug': TYPE.lineSnug,
    '--line-normal': TYPE.lineNormal,
  };
  return v;
}

export function generateTokensCss() {
  const vars = rootVars();
  const root =
    ':root {\n' +
    Object.entries(vars)
      .map(([k, val]) => `  ${k}: ${val};`)
      .join('\n') +
    '\n}\n';
  const base = readFileSync(join(ROOT, 'src/shared/tokens.base.css'), 'utf8');
  return (
    '/* ============================================================================\n' +
    ' * AI Safety Guard — Design Tokens (GENERATED from constants.js — do not edit)\n' +
    ' * Regenerate with: npm run gen:tokens\n' +
    ' * ==========================================================================*/\n\n' +
    root +
    '\n' +
    base
  );
}

// Write when run directly.
if (process.argv[1] && process.argv[1].endsWith('gen-tokens.mjs')) {
  writeFileSync(join(ROOT, 'src/shared/tokens.css'), generateTokensCss());
  console.log('tokens.css generated from constants.js');
}
