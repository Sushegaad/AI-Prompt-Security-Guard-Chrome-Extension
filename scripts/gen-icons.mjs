/* ============================================================================
 * AI Safety Guard — generate toolbar/store icon PNGs from the logo mark
 * Run: npm run gen:icons
 *
 * Writes the single-source SVG (shared/logo.js) to a temp file and rasterizes
 * it to assets/icons/icon{16,48,128}.png via cairosvg (python). The PNGs are
 * committed, so CI does not need to run this — it's a convenience for when the
 * mark changes.
 * ========================================================================== */

import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { logoSvg } from '../src/shared/logo.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'assets/icons');
const SIZES = [16, 48, 128];

const tmp = mkdtempSync(join(tmpdir(), 'asg-logo-'));
const svgPath = join(tmp, 'logo.svg');
writeFileSync(svgPath, logoSvg());

const py = SIZES.map(
  (s) =>
    `cairosvg.svg2png(url=${JSON.stringify(svgPath)}, write_to=${JSON.stringify(
      join(ICONS, `icon${s}.png`)
    )}, output_width=${s}, output_height=${s})`
).join('; ');

execFileSync('python3', ['-c', `import cairosvg; ${py}`], { stdio: 'inherit' });
console.log('icons generated:', SIZES.map((s) => `icon${s}.png`).join(', '));
