/* Insights: KPIs and charts. Live data by default; Demo data only when asked and always labelled. */
import { h, clear, icon, toast, countUp, money, CHANNELS, DEFECTS, authorBadge } from './ui.js';
import * as ch from './charts.js';

export async function render(root, { state, api }) {
  let mode = 'live';
  const body = h('div');
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Data source' });
  const tools = h('div', { class: 'page-tools' });

  async function load() {
    clear(body).append(h('div', { class: 'skeleton', style: { height: '160px' } }));
    paintSeg();
    let s;
    try { s = await api.stats(state.orgId, mode); } catch (e) { clear(body).append(h('div', { class: 'banner bad' }, icon('alert'), e.message)); return; }
    paint(s);
  }
  function paintSeg() {
    clear(seg);
    [['live', 'Live'], ['demo', 'Demo data']].forEach(([k, l]) => seg.append(h('button', { 'aria-pressed': String(mode === k), onclick: () => { mode = k; destroy(); load(); } }, l)));
  }
  const destroy = () => ch.destroyCharts();

  function paint(s) {
    clear(body);
    if (mode === 'demo') {
      body.append(h('div', { class: 'banner demo' }, icon('alert'), h('div', null, h('b', null, 'Demo data. '), 'These boxes are sample records built from the challenge sample file and the 21 test scenarios. They did not come from real photos.'),
        h('div', { class: 'row', style: { marginLeft: 'auto' } },
          h('button', { class: 'btn btn-sm', onclick: async () => { await api.seedDemo(); toast('Demo data reloaded.', 'ok'); load(); } }, icon('refresh'), 'Reload'),
          h('button', { class: 'btn btn-sm btn-danger', onclick: async () => { const r = await api.clearDemo(); toast(`Removed ${r.removed} demo records.`, 'ok'); load(); } }, icon('trash'), 'Remove'))));
    }
    if (!s.total) {
      body.append(h('div', { class: 'empty' }, icon('chart', 34), h('h3', null, mode === 'live' ? 'No real checks yet' : 'No demo data loaded'),
        h('p', null, mode === 'live' ? 'Charts appear after the first box is checked on the Bench. Nothing here is made up.' : 'Load the sample records to preview the charts.'),
        h('div', { class: 'row' }, mode === 'live' ? h('a', { class: 'btn btn-tape', href: '#/bench' }, icon('scan'), 'Go to the Bench') : null,
          h('button', { class: 'btn', onclick: async () => { await api.seedDemo(); mode = 'demo'; load(); } }, icon('plus'), 'Load demo data'))));
      return;
    }
    const kpi = (label, val, note, opts) => { const v = h('div', { class: 'v' }, '0'); countUp(v, val, opts); return h('div', { class: 'kpi' }, v, h('div', { class: 'l' }, label), note ? h('div', { class: 'n' }, note) : null); };
    const heldish = s.byVerdict.STOP_AND_FIX;
    body.append(h('div', { class: 'kpis' },
      kpi('Boxes checked', s.total),
      kpi('Seal rate', s.sealRate, `${s.byVerdict.SEAL} sealed`, { suffix: '%' }),
      kpi('Stopped & fixed', heldish, 'wrong item, missing, quantity or extra'),
      kpi('Uncertain or held', s.byVerdict.UNCERTAIN + s.byVerdict.PENDING_REVIEW, 'sent to a person'),
      kpi('Avg AI confidence', s.avgConfidence == null ? 0 : Math.round(s.avgConfidence * 100), s.avgLatencyMs ? `avg ${(s.avgLatencyMs / 1000).toFixed(1)}s per box` : null, { suffix: '%' }),
      kpi('Est. cost avoided', s.estimatedSavings, `assumes ${money(s.assumptions.costPerDefect)} per wrong shipment`, { prefix: '$' })));

    const box = (cls, title, meta, canvasClass, cap) => { const c = h('canvas', { role: 'img', 'aria-label': title }); return { el: h('div', { class: `panel ${cls}` }, h('div', { class: 'panel-head' }, h('h2', null, title), meta ? h('span', { class: 'meta' }, meta) : null), h('div', { class: 'panel-body' }, h('div', { class: `chart-box ${canvasClass || ''}` }, c), cap ? h('p', { class: 'chart-cap' }, cap) : null)), c }; };
    const a = box('c4', 'Verdict mix', null, '', `${s.byVerdict.SEAL} seal, ${s.byVerdict.STOP_AND_FIX} stop & fix, ${s.byVerdict.UNCERTAIN + s.byVerdict.PENDING_REVIEW} need a person.`);
    const b = box('c8', 'Boxes per day', 'lines: count · dashed: cumulative seal rate', 'tall');
    const c = box('c5', 'What goes wrong', 'by defect type', '', 'Unclear photos count separately from real defects.');
    const d = box('c7', 'Products that fail most', 'top 6 by mismatches', '');
    const e = box('c6', 'AI confidence', 'how sure the AI was', '', 'Low-confidence boxes are more likely to end as Uncertain.');
    const f = box('c6', 'By sales channel', 'verdicts per channel', '');
    const charts = h('div', { class: 'charts' }, a.el, b.el, c.el, d.el, e.el, f.el);
    body.append(charts);
    ch.verdictDoughnut(a.c, s.byVerdict, s.total);
    if (s.daily.length) ch.dailyLine(b.c, s.daily);
    if (Object.values(s.defects).some((x) => x > 0)) ch.defectBar(c.c, s.defects, DEFECTS); else c.c.replaceWith(h('p', { class: 'muted' }, 'No defects recorded.'));
    if (s.topSkus.length) ch.topSkusBar(d.c, s.topSkus); else d.c.replaceWith(h('p', { class: 'muted' }, 'No product-level mismatches recorded.'));
    ch.confidenceHistogram(e.c, s.confidenceHistogram);
    ch.channelStack(f.c, s.channels, CHANNELS);
    body.append(h('p', { class: 'faint', style: { marginTop: '14px', fontSize: '.8rem' } }, 'Cost avoided is an estimate from an assumed cost per wrong shipment (set COST_PER_WRONG_SHIPMENT). It is not a measured saving.'));
  }

  root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Insights'), h('p', null, 'What the checks are finding. Live shows real boxes only; Demo shows clearly labelled sample records.')), h('div', { class: 'page-tools' }, authorBadge(), seg, tools)), body);
  await load();
  return () => destroy();
}
