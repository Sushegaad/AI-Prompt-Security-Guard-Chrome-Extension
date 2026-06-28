/* ============================================================================
 * AI Safety Guard — Detector performance benchmark
 * Run: npm run bench   (node scripts/perf-bench.mjs)
 * Times detect() across 100 / 1,000 / 5,000 / 10,000 char inputs.
 * Target: < 50ms on typical inputs (design shows 18ms). Exits non-zero if the
 * typical-size budget is blown.
 * ========================================================================== */

import { detect } from '../src/content/detector.js';

// A realistic prompt fragment that exercises multiple detectors (PII + secret).
const SAMPLE =
  'Draft a reply to Sarah Chen (sarah.chen@northwind.io), account #88291, ' +
  'phone 555-867-5309, card 4111 1111 1111 1111, whose API key ' +
  'sk-live-9fK2pQ7xR4mZ8vB1 stopped working. Internal note: see 10.2.4.18, ' +
  'invoice revenue EBITDA confidential attorney-client privileged. ';

function makeText(n) {
  let s = '';
  while (s.length < n) s += SAMPLE;
  return s.slice(0, n);
}

function bench(text, iterations) {
  // warmup
  for (let i = 0; i < 5; i++) detect(text);
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    detect(text);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  return {
    min: times[0],
    avg: sum / times.length,
    p95: times[Math.floor(times.length * 0.95)],
    max: times[times.length - 1],
  };
}

const SIZES = [100, 1000, 5000, 10000];
const ITER = 200;

console.log('AI Safety Guard — detector performance');
console.log('iterations per size:', ITER, '\n');
console.log('  chars     min      avg      p95      max     findings');
console.log('  ' + '-'.repeat(56));

let typicalAvg = null;
for (const n of SIZES) {
  const text = makeText(n);
  const r = bench(text, ITER);
  const findings = detect(text).matches.length;
  const fmt = (x) => x.toFixed(2).padStart(6) + 'ms';
  console.log(
    `  ${String(n).padStart(6)}  ${fmt(r.min)} ${fmt(r.avg)} ${fmt(r.p95)} ${fmt(r.max)}   ${findings}`
  );
  if (n === 1000) typicalAvg = r.avg; // ~typical prompt length
}

// Also a short, design-representative prompt (~the A2 example).
const short = SAMPLE.trim();
const sr = bench(short, ITER);
console.log(`\n  typical prompt (${short.length} chars): avg ${sr.avg.toFixed(2)}ms (design target ~18ms)`);

console.log('\nBudget check: typical (1,000 char) avg < 50ms ...', typicalAvg < 50 ? 'PASS' : 'FAIL');
process.exit(typicalAvg < 50 ? 0 : 1);
