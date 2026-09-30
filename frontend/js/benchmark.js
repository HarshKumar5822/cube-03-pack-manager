/* Benchmark: honest evaluation + a logic lab where you type what the AI "saw" and watch the matcher decide. */
import { h, clear, icon, toast, verdictChip, VERDICT, authorBadge } from './ui.js';
import { checksRow, ledger, findingsList } from './recordView.js';
import { agreementDoughnut, destroyCharts } from './charts.js';

const parse = (s) => String(s || '').split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const [sku, q] = x.split(':'); return { sku, qty: parseInt(q, 10) || 0 }; });

export async function render(root, { state, api, getCatalogue }) {
  const cat = await getCatalogue();
  const { scenarios } = await api.scenarios();
  const out = h('div', { class: 'stack' });
  const run = h('button', { class: 'btn btn-tape', onclick: () => go(false) }, icon('flask'), 'Run logic benchmark');
  const runV = h('button', { class: 'btn', onclick: () => go(true) }, icon('sparkle'), 'Run with real photos (needs AI + labels)');

  async function go(vision) {
    run.disabled = runV.disabled = true; destroyCharts();
    clear(out).append(h('div', { class: 'skeleton', style: { height: '140px' } }));
    try { paint(await api.runEval(vision)); } catch (e) { clear(out).append(h('div', { class: 'banner bad' }, icon('alert'), e.message)); }
    run.disabled = runV.disabled = false;
  }
  function metrics(m) {
    return h('div', { class: 'kpis', style: { marginBottom: 0 } },
      h('div', { class: 'kpi' }, h('div', { class: 'v' }, m.verdictAccuracy == null ? '\u2014' : `${m.verdictAccuracy}%`), h('div', { class: 'l' }, 'Verdict agreement'), h('div', { class: 'n' }, `${m.total} cases`)),
      h('div', { class: 'kpi' }, h('div', { class: 'v', style: { color: m.unsafeSeals ? 'var(--stop)' : 'var(--seal)' } }, m.unsafeSeals), h('div', { class: 'l' }, 'Unsafe seals'), h('div', { class: 'n' }, 'should have been held, got SEAL')),
      h('div', { class: 'kpi' }, h('div', { class: 'v' }, m.falseStops), h('div', { class: 'l' }, 'False stops'), h('div', { class: 'n' }, 'good box held')),
      h('div', { class: 'kpi' }, h('div', { class: 'v' }, `${m.uncertainRate ?? 0}%`), h('div', { class: 'l' }, 'Uncertain rate'), h('div', { class: 'n' }, `${m.actualUncertain} cases`)));
  }
  function paint(r) {
    clear(out);
    const s = r.simulated;
    const ok = Math.round((s.verdictAccuracy / 100) * s.total);
    const c = h('canvas', { role: 'img', 'aria-label': 'Agreement with labels' });
    out.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, s.label)), h('div', { class: 'panel-body stack' }, metrics(s),
      h('div', { class: 'lab' }, h('div', { class: 'chart-box' }, c),
        h('div', { class: 'stack' }, h('h3', null, 'Where agent and label differ'), s.disagreements.length ? s.disagreements.map((d) => h('ul', { class: 'findings' }, h('li', { class: 'unsure' }, h('b', { class: 'mono' }, d.unit_id || d.id || ''), ` (${d.scenario}) label ${d.expected_verdict} vs agent ${d.actual_verdict}`))) : h('p', { class: 'muted' }, 'No disagreements.'))),
      h('p', { class: 'faint', style: { fontSize: '.82rem' } }, 'This run skips the AI vision step. It only tests the counting and uncertainty rules against labels written by the authors. It says nothing about whether the AI can see products.'))));
    agreementDoughnut(c, ok, s.total);
    const v = r.vision;
    out.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Real photos through the AI')), h('div', { class: 'panel-body stack' },
      v && v.skipped ? h('div', { class: 'banner' }, icon('alert'), h('div', null, h('b', null, 'Not run. '), v.reason)) : v && v.total != null ? [metrics(v), h('p', { class: 'faint' }, 'This is the number that supports claims about seeing.')] : h('p', { class: 'muted' }, 'Not requested.'))));
  }

  /* Logic lab */
  const lab = { order: 'SKU-TSHIRT-BLK:2;SKU-CAP-BLU:1', seen: { 'SKU-TSHIRT-BLK': [2, 0.95], 'SKU-CAP-RED': [1, 0.9] }, flags: new Set() };
  const labOut = h('div', { class: 'stack' });
  const dets = h('div');
  async function sim() {
    const detected = Object.entries(lab.seen).filter(([, [q]]) => q > 0).map(([sku, [quantity, confidence]]) => ({ sku, quantity, confidence }));
    try {
      const r = await api.simulate({ order_lines: lab.order, detected_items: detected, image_quality_flags: [...lab.flags] });
      clear(labOut).append(h('div', { class: 'panel' }, h('div', { class: 'verdict-head' }, h('div', { class: 'row' }, verdictChip(r.verdict), h('span', { class: 'muted' }, (VERDICT[r.verdict] || {}).sentence)), checksRow({ checks: r.checks })),
        h('div', { class: 'panel-body stack' }, findingsList({ agent_verdict: r.verdict, _meta: { findings: r.findings, issues: r.issues } }), ledger({ agent_verdict: r.verdict, _meta: { line_items: r.lineItems, unmapped_detections: [] } }, cat))));
    } catch (e) { clear(labOut).append(h('div', { class: 'banner bad' }, e.message)); }
  }
  function paintLab() {
    clear(dets);
    const skus = [...new Set([...parse(lab.order).map((l) => l.sku), ...Object.keys(lab.seen)])].filter((s) => cat.some((c) => c.sku === s));
    skus.forEach((sku) => {
      const [q, cf] = lab.seen[sku] || [0, 0.9];
      const c = cat.find((x) => x.sku === sku);
      const qty = h('input', { class: 'input', type: 'number', min: 0, max: 20, value: q, style: { width: '64px' }, 'aria-label': `Seen ${c.name}`, oninput: (e) => { lab.seen[sku] = [Math.max(0, +e.target.value || 0), (lab.seen[sku] || [0, cf])[1]]; sim(); } });
      const conf = h('input', { type: 'range', min: 10, max: 100, value: Math.round(cf * 100), 'aria-label': `Confidence ${c.name}`, oninput: (e) => { lab.seen[sku] = [(lab.seen[sku] || [q, cf])[0], e.target.value / 100]; sim(); } });
      dets.append(h('div', { class: 'det' }, h('div', null, h('b', null, c.name), h('div', { class: 'mono faint' }, sku)), qty, conf));
    });
  }
  const orderIn = h('input', { class: 'input mono', value: lab.order, 'aria-label': 'Order lines', oninput: (e) => { lab.order = e.target.value; paintLab(); sim(); } });
  const flagBox = ['blurry', 'poor_lighting', 'partial_occlusion', 'box_partially_out_of_frame'].map((f) => h('label', { class: 'row', style: { gap: '6px' } }, h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? lab.flags.add(f) : lab.flags.delete(f); sim(); } }), f.replace(/_/g, ' ')));

  root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Benchmark'), h('p', null, 'How well does the decision logic hold up, and where does it say Uncertain? Numbers here are labelled with what they do and do not measure.')), h('div', { class: 'page-tools' }, authorBadge(), run, runV)), out,
    h('div', { class: 'panel', style: { marginTop: '16px' } }, h('div', { class: 'panel-head' }, h('h2', null, 'Logic lab'), h('span', { class: 'meta' }, 'Type what the AI saw; nothing is saved')),
      h('div', { class: 'panel-body lab' }, h('div', { class: 'stack' }, h('label', { class: 'field' }, 'Order (SKU:qty;SKU:qty)', orderIn), h('div', null, h('div', { class: 'det', style: { fontWeight: 700 } }, h('span', null, 'Product'), h('span', null, 'Seen'), h('span', null, 'AI sure')), dets),
        h('div', { class: 'stack' }, h('b', null, 'Photo problems'), h('div', { class: 'row' }, flagBox)), h('div', { class: 'row' }, h('label', { class: 'field' }, 'Try a scenario', h('select', { onchange: (e) => { const sc = scenarios[+e.target.value]; if (!sc) return; lab.order = sc.order_lines; lab.seen = Object.fromEntries(sc.detected_items.map((d) => [d.sku, [d.quantity, d.confidence]])); lab.flags = new Set(sc.image_quality_flags || []); orderIn.value = lab.order; paintLab(); sim(); } }, h('option', { value: '' }, 'Choose\u2026'), scenarios.map((s, i) => h('option', { value: i }, `${s.unit_id} ${s.scenario}`)))))), labOut)));
  paintLab(); await sim();
  return () => destroyCharts();
}
