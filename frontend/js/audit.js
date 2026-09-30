/* Audit trail: every record, filterable, with photos, AI details, operator override and raw JSON. */
import { h, clear, icon, toast, drawer, verdictChip, fmtDateTime, CHANNELS, DEFECTS, debounce, download, pct, authorBadge } from './ui.js';
import { ledger, findingsList, verdictHead, confidenceMeter, photoWithBoxes, boxLegend, copilot } from './recordView.js';
import { photoUrl } from './api.js';

export async function render(root, { state, api, getCatalogue }) {
  const cat = await getCatalogue();
  let scope = 'live'; let verdict = ''; let q = '';
  let records = [];
  const table = h('div');
  const count = h('span', { class: 'meta' });

  async function load() {
    clear(table).append(h('div', { class: 'skeleton', style: { height: '120px', margin: '16px' } }));
    try { records = (await api.records(state.orgId, scope === 'demo' ? 'demo' : undefined)).records; } catch (e) { clear(table).append(h('div', { class: 'banner bad', style: { margin: '16px' } }, e.message)); return; }
    paint();
  }
  function filtered() {
    const s = q.toLowerCase();
    return records.filter((r) => (!verdict || r.agent_verdict === verdict) && (!s || `${r.unit_id} ${r.order_id} ${r.record_id}`.toLowerCase().includes(s))).sort((a, b) => b.captured_at.localeCompare(a.captured_at));
  }
  function paint() {
    const rows = filtered();
    count.textContent = `${rows.length} of ${records.length}`;
    clear(table);
    if (!rows.length) { table.append(h('div', { style: { padding: '16px' } }, h('div', { class: 'empty' }, icon('list', 30), h('h3', null, records.length ? 'No records match these filters' : scope === 'live' ? 'No real checks yet' : 'No demo records'), h('p', null, records.length ? 'Clear a filter to see more.' : scope === 'live' ? 'Checked boxes are listed here with their photos and the AI evidence.' : 'Load demo data from Insights.')))); return; }
    table.append(h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['When', 'Unit', 'Order', 'Channel', 'Verdict', 'Problems', 'AI sure', ''].map((t, i) => h('th', { class: i === 6 ? 'num' : '' }, t)))),
      h('tbody', null, rows.map((r) => h('tr', { class: 'click', tabindex: '0', onclick: () => open(r), onkeydown: (e) => { if (e.key === 'Enter') open(r); } },
        h('td', { class: 'faint' }, fmtDateTime(r.captured_at)), h('td', { class: 'mono' }, r.unit_id), h('td', { class: 'mono' }, r.order_id), h('td', null, CHANNELS[r.channel] || r.channel),
        h('td', null, verdictChip(r.agent_verdict), r.operator_override ? h('span', { class: 'chip plain', style: { marginLeft: '6px' } }, 'changed') : null),
        h('td', null, (r.discrepancy_types || []).map((d) => DEFECTS[d] || d).join(', ') || h('span', { class: 'faint' }, '\u2014')),
        h('td', { class: 'num' }, r.agent_verdict === 'PENDING_REVIEW' ? '\u2014' : pct(r.confidence_score || 0)),
        h('td', null, r._meta && r._meta.synthetic ? h('span', { class: 'chip unsure' }, 'Demo') : null)))))));
  }

  function open(rec) {
    drawer(h('span', null, rec.unit_id, h('span', { class: 'mono faint', style: { fontSize: '.8rem', marginLeft: '8px' } }, rec.record_id)), (body) => {
      const m = rec._meta || {};
      const photos = (rec.photo_refs || []);
      body.append(h('div', { class: 'panel' }, verdictHead(rec), h('div', { class: 'panel-body stack' }, confidenceMeter(rec), findingsList(rec))));
      if (photos.length) {
        const any = (m.detections || []).some((d) => d.box);
        body.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Evidence photos'), h('span', { class: 'meta' }, `${photos.length}`)),
          h('div', { class: 'panel-body stack' }, h('div', { class: 'big-photos' }, photos.map((p, i) => photoWithBoxes(photoUrl(p, state.orgId), rec, i + 1).frame)), any ? boxLegend() : null)));
      } else if (m.synthetic) body.append(h('div', { class: 'banner demo', style: { marginBottom: 0 } }, icon('alert'), 'Demo record: no photo exists for this box.'));
      body.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Ordered vs seen')), h('div', { class: 'panel-body' }, ledger(rec, cat))));
      body.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'How the AI got here')), h('div', { class: 'panel-body' }, h('dl', { class: 'kv' },
        h('dt', null, 'Provider'), h('dd', null, m.provider || 'none'), h('dt', null, 'Model'), h('dd', { class: 'mono' }, m.model_used || 'none'),
        h('dt', null, 'Photos read'), h('dd', null, m.photo_count ?? (photos.length || '\u2014')), h('dt', null, 'Reference photos'), h('dd', null, m.reference_images || 0),
        h('dt', null, 'Photo-quality flags'), h('dd', null, (m.image_quality_flags || []).join(', ') || 'none'),
        h('dt', null, 'AI time'), h('dd', null, m.ai_latency_ms ? `${(m.ai_latency_ms / 1000).toFixed(1)}s` : '\u2014'),
        h('dt', null, 'Operator'), h('dd', null, m.operator_id || '\u2014'), h('dt', null, 'AI note'), h('dd', null, m.vision_notes || '\u2014'),
        m.error ? [h('dt', null, 'Error'), h('dd', null, m.error)] : null))));
      if (rec.operator_override) { const o = rec.operator_override; body.append(h('div', { class: 'banner' }, icon('alert'), h('div', null, h('b', null, `Operator ${o.operator_id} changed the verdict to ${o.new_verdict}. `), o.override_reason))); }
      else body.append(overrideForm(rec));
      body.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Ask the co-pilot')), h('div', { class: 'panel-body' }, copilot(rec, state.orgId))));
      const raw = h('pre', { class: 'json' }, JSON.stringify(rec, null, 2));
      body.append(h('details', { class: 'panel' }, h('summary', { class: 'panel-head', style: { cursor: 'pointer' } }, h('h2', null, 'Raw record (JSON)')), h('div', { class: 'panel-body' }, raw)));
    });
  }

  function overrideForm(rec) {
    const sel = h('select', null, [['STOP_AND_FIX', 'Stop & fix'], ['SEAL', 'Seal'], ['UNCERTAIN', 'Uncertain']].map(([v, l]) => h('option', { value: v, selected: v !== rec.agent_verdict && v === 'STOP_AND_FIX' }, l)));
    const why = h('textarea', { placeholder: 'Why? (at least 8 characters, kept in the audit trail)' });
    const btn = h('button', { class: 'btn', onclick: async () => {
      btn.disabled = true;
      try { await api.override(rec.record_id, { org_id: state.orgId, operator_id: state.operator, new_verdict: sel.value, override_reason: why.value }); toast('Override saved to the audit trail.', 'ok'); document.querySelector('.drawer .btn[aria-label="Close"]').click(); load(); }
      catch (e) { toast(e.message, 'bad'); btn.disabled = false; }
    } }, 'Save override');
    return h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Disagree? Change the verdict'), h('span', { class: 'meta' }, 'AI original is kept')), h('div', { class: 'panel-body stack' }, h('label', { class: 'field' }, 'New verdict', sel), h('label', { class: 'field' }, 'Reason', why), h('div', null, btn)));
  }

  function csv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['record_id', 'unit_id', 'order_id', 'channel', 'captured_at', 'order_lines', 'observed_in_box', 'agent_verdict', 'discrepancy_types', 'confidence', 'operator_override']];
    filtered().forEach((r) => rows.push([r.record_id, r.unit_id, r.order_id, r.channel, r.captured_at, r.order_lines, r.observed_in_box, r.agent_verdict, (r.discrepancy_types || []).join('|'), r.confidence_score, r.operator_override ? r.operator_override.new_verdict : '']));
    download('pack-audit.csv', rows.map((r) => r.map(esc).join(',')).join('\n'));
  }

  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Records' });
  const paintSeg = () => { clear(seg); [['live', 'Live'], ['demo', 'Demo data']].forEach(([k, l]) => seg.append(h('button', { 'aria-pressed': String(scope === k), onclick: () => { scope = k; paintSeg(); load(); } }, l))); };
  paintSeg();
  root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Audit trail'), h('p', null, 'Every box checked, with its photos, what the AI saw, and any human override.')),
    h('div', { class: 'page-tools' }, authorBadge(), seg, h('button', { class: 'btn', onclick: csv }, icon('download'), 'Export CSV'))),
    h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('div', { class: 'row' },
      h('select', { class: 'input', style: { width: 'auto' }, 'aria-label': 'Filter by verdict', onchange: (e) => { verdict = e.target.value; paint(); } }, [['', 'All verdicts'], ['SEAL', 'Seal'], ['STOP_AND_FIX', 'Stop & fix'], ['UNCERTAIN', 'Uncertain'], ['PENDING_REVIEW', 'Manual check']].map(([v, l]) => h('option', { value: v }, l))),
      h('input', { class: 'input', style: { width: '220px' }, type: 'search', placeholder: 'Search unit or order\u2026', 'aria-label': 'Search', oninput: debounce((e) => { q = e.target.value; paint(); }, 150) })), count), table));
  await load();
}
