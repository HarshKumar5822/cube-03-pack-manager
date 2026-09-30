'use strict';

/**
 * Two honest evaluations:
 *  - runSimulated(): hand-labelled scenarios with the perception step SKIPPED. Tests only the
 *    matcher's arithmetic/uncertainty rules. It says nothing about whether the AI can see.
 *  - runVision(): real photos + labels.csv through the real AI pipeline. This is the only number
 *    that supports a claim like "the agent identifies products correctly".
 * The headline safety metric is unsafeSeals: boxes that should have been held but got SEAL.
 */

const fs = require('fs');
const path = require('path');
const { getConfig } = require('../server/config');
const { evaluatePacking } = require('../server/matcher');
const { getCatalogue } = require('../server/catalogue');
const { perceiveBox } = require('../server/ai/perception');
const { sniffImage } = require('../server/images');

const EVAL_SET = () => path.join(getConfig().dataDir, 'eval_set.json');
const FIX_DIR = path.join(__dirname, '..', 'fixtures', 'eval');
const LABELS = path.join(FIX_DIR, 'labels.csv');
const REPORT = path.join(__dirname, 'eval-report.md');
const CHECKS = ['all_items_present', 'quantities_correct', 'no_extra_items'];
const CLASSES = ['PASS', 'FAIL', 'UNCERTAIN'];

const blank = () => Object.fromEntries(CLASSES.map((a) => [a, Object.fromEntries(CLASSES.map((b) => [b, 0]))]));

function scoreRun(cases, getActual, label) {
  const confusion = Object.fromEntries(CHECKS.map((c) => [c, blank()]));
  const disagreements = [];
  let verdictOk = 0;
  let n = 0;
  let unsafeSeals = 0;
  let falseStops = 0;
  let actualUncertain = 0;

  cases.forEach((c) => {
    const a = getActual(c);
    if (!a) return;
    n++;
    CHECKS.forEach((k) => { confusion[k][c.expected_checks[k]][a.checks[k]]++; });
    if (a.verdict === c.expected_verdict) verdictOk++;
    if (c.expected_verdict !== 'SEAL' && a.verdict === 'SEAL') unsafeSeals++;
    if (c.expected_verdict === 'SEAL' && a.verdict === 'STOP_AND_FIX') falseStops++;
    if (a.verdict === 'UNCERTAIN') actualUncertain++;
    const checkDiff = CHECKS.filter((k) => c.expected_checks[k] !== a.checks[k]);
    if (a.verdict !== c.expected_verdict || checkDiff.length) {
      disagreements.push({ unit_id: c.unit_id, scenario: c.scenario, expected_verdict: c.expected_verdict, actual_verdict: a.verdict, checkDiff, expected_checks: c.expected_checks, actual_checks: a.checks, issues: a.issues });
    }
  });

  return {
    label, total: n,
    verdictAccuracy: n ? Math.round((verdictOk / n) * 1000) / 10 : null,
    unsafeSeals, falseStops, actualUncertain,
    uncertainRate: n ? Math.round((actualUncertain / n) * 100) : null,
    perCheckConfusion: confusion, disagreements,
  };
}

function failPR(m) {
  const tp = m.FAIL.FAIL;
  const fp = m.PASS.FAIL + m.UNCERTAIN.FAIL;
  const fn = m.FAIL.PASS + m.FAIL.UNCERTAIN;
  const pct = (x) => Math.round(x * 1000) / 10;
  return { tp, fp, fn, precision: tp + fp ? pct(tp / (tp + fp)) : null, recall: tp + fn ? pct(tp / (tp + fn)) : null };
}

function runSimulated() {
  const cfg = getConfig();
  const cases = JSON.parse(fs.readFileSync(EVAL_SET(), 'utf8'));
  const catalogue = getCatalogue();
  return scoreRun(cases, (c) => evaluatePacking(c.order_lines, c.detected_items, c.image_quality_flags, { confidenceThreshold: cfg.confidenceThreshold, catalogue }), 'Logic only (perception skipped)');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((c) => c !== '')) rows.push(row); row = []; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

async function runVision() {
  const cfg = getConfig();
  if (!cfg.activeProvider) return { skipped: true, reason: 'No AI provider configured (set GROQ_API_KEY or ANTHROPIC_API_KEY).' };
  if (!fs.existsSync(LABELS)) return { skipped: true, reason: 'No labelled photo set at fixtures/eval/labels.csv. See fixtures/eval/README.md.' };

  const catalogue = getCatalogue();
  const rows = parseCsv(fs.readFileSync(LABELS, 'utf8'));
  const cases = [];
  const errors = [];
  for (const r of rows) {
    const files = String(r.image_file || '').split(';').map((s) => s.trim()).filter(Boolean).slice(0, cfg.maxPhotos);
    const photos = [];
    for (const f of files) {
      const p = path.join(FIX_DIR, path.basename(f));
      if (!fs.existsSync(p)) continue;
      const buffer = fs.readFileSync(p);
      const kind = sniffImage(buffer);
      if (kind) photos.push({ buffer, mime: kind.mime });
    }
    if (!photos.length) { errors.push(`${r.unit_id}: no readable image`); continue; }
    try {
      const p = await perceiveBox({ cfg, photos });
      const ev = evaluatePacking(r.order_lines, p.items.map((i) => ({ sku: i.sku, quantity: i.quantity, confidence: i.confidence })), p.flags, { confidenceThreshold: cfg.confidenceThreshold, catalogue, unmapped: p.unmapped });
      cases.push({ unit_id: r.unit_id, scenario: r.scenario || 'unlabelled', expected_verdict: r.expected_verdict, expected_checks: r.expected_checks ? JSON.parse(r.expected_checks) : { all_items_present: 'PASS', quantities_correct: 'PASS', no_extra_items: 'PASS' }, _actual: ev });
    } catch (e) { errors.push(`${r.unit_id}: ${e.message}`); }
  }
  const out = scoreRun(cases, (c) => c._actual, `Vision in the loop (${cfg.activeProvider}, ${cfg.activeProvider ? cfg[cfg.activeProvider].models[0] : ''})`);
  out.errors = errors;
  return out;
}

function renderMarkdown(sections) {
  let md = `# Pack Manager: evaluation report\n\nGenerated: ${new Date().toISOString()}\n\n`;
  md += `> **Read this first.** The "Logic only" run feeds hand-written detections straight into the matcher, so it measures the decision rules and nothing else. It cannot show that the AI sees a box correctly. Only the "Vision in the loop" run, with real photos and independent labels, supports that claim. The labels in \`data/eval_set.json\` were written by the project author, not by an independent labeller.\n\n`;
  sections.forEach((s) => {
    if (s.skipped) { md += `## ${s.title}\n\n_Skipped: ${s.reason}_\n\n`; return; }
    md += `## ${s.label}\n\n- Units scored: **${s.total}**\n- Verdict agreement with labels: **${s.verdictAccuracy}%**\n- **Unsafe seals** (should hold, got SEAL): **${s.unsafeSeals}**\n- False stops (should seal, got STOP_AND_FIX): ${s.falseStops}\n- UNCERTAIN verdicts: ${s.actualUncertain} (${s.uncertainRate}%)\n\n### Per-check confusion (rows = label, columns = agent)\n\n`;
    CHECKS.forEach((k) => {
      const m = s.perCheckConfusion[k];
      md += `**${k}**\n\n| label \\ agent | PASS | FAIL | UNCERTAIN |\n|---|---|---|---|\n`;
      CLASSES.forEach((t) => { md += `| ${t} | ${m[t].PASS} | ${m[t].FAIL} | ${m[t].UNCERTAIN} |\n`; });
      const pr = failPR(m);
      md += `\nFAIL precision ${pr.precision ?? 'n/a'}${pr.precision !== null ? '%' : ''}, recall ${pr.recall ?? 'n/a'}${pr.recall !== null ? '%' : ''} (tp ${pr.tp}, fp ${pr.fp}, fn ${pr.fn}).\n\n`;
    });
    md += s.disagreements.length ? `### Disagreements with labels (${s.disagreements.length})\n\n` : '### Disagreements with labels\n\nNone.\n\n';
    s.disagreements.forEach((d) => {
      md += `- **${d.unit_id}** (${d.scenario}): label ${d.expected_verdict}, agent ${d.actual_verdict}${d.checkDiff.length ? `; checks differing: ${d.checkDiff.join(', ')}` : ''}. ${d.issues.join(' ')}\n`;
    });
    if (s.errors && s.errors.length) md += `\nUnscored rows:\n${s.errors.map((e) => `- ${e}`).join('\n')}\n`;
    md += '\n';
  });
  return md;
}

async function main() {
  const sections = [runSimulated()];
  if (process.argv.includes('--vision')) {
    const v = await runVision();
    sections.push(v.skipped ? { skipped: true, title: 'Vision in the loop', reason: v.reason } : v);
  } else sections.push({ skipped: true, title: 'Vision in the loop', reason: 'Run `npm run eval:vision` with photos in fixtures/eval to score the real AI pipeline.' });
  const md = renderMarkdown(sections);
  fs.writeFileSync(REPORT, md);
  console.log(md);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { runSimulated, runVision, renderMarkdown, scoreRun, parseCsv };
