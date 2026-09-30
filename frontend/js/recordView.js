/* Shared pieces that show a verification record: ledger, checks, findings, co-pilot, photo overlay. */
import { h, clear, icon, stamp, VERDICT, thumb, pct } from './ui.js';
import { api } from './api.js';

const STATUS = { MATCH: 'Match', MISSING: 'Missing', EXTRA: 'Extra', SHORT: 'Short', EXCESS: 'Too many', UNKNOWN: 'Unidentified' };
const CHECK_LABEL = { all_items_present: 'Items present', quantities_correct: 'Quantities', no_extra_items: 'No extras' };

export function checksRow(record) {
  return h('div', { class: 'checks', role: 'list' }, Object.entries(record.checks).map(([k, v]) =>
    h('span', { role: 'listitem', class: `chip ${v === 'PASS' ? 'seal' : v === 'FAIL' ? 'stop' : 'unsure'}` }, v === 'PASS' ? icon('check') : v === 'FAIL' ? icon('x') : icon('alert'), `${CHECK_LABEL[k]}: ${v === 'PASS' ? 'OK' : v === 'FAIL' ? 'Problem' : 'Unsure'}`)));
}

export function ledger(record, catalogue) {
  const byId = Object.fromEntries(catalogue.map((c) => [c.sku, c]));
  const items = (record._meta && record._meta.line_items) || [];
  if (!items.length && !(record._meta && (record._meta.unmapped_detections || []).length)) {
    return h('p', { class: 'muted' }, record.agent_verdict === 'PENDING_REVIEW' ? 'Nothing was compared because the AI check did not run.' : 'No line items recorded.');
  }
  const rows = items.map((l) => h('tr', null,
    h('td', null, h('div', { class: 'prodline' }, thumb(byId[l.sku]), h('div', null, h('b', null, l.name), h('span', { class: 'mono faint' }, l.sku)))),
    h('td', { class: 'num' }, l.expectedQty),
    h('td', { class: 'num' }, l.detectedQty),
    h('td', { class: `status-cell s-${l.status}` }, STATUS[l.status] || l.status),
    h('td', { class: 'num faint' }, l.confidence == null ? '' : pct(l.confidence))));
  ((record._meta && record._meta.unmapped_detections) || []).forEach((u) => rows.push(h('tr', null,
    h('td', null, h('div', { class: 'prodline' }, thumb(null), h('div', null, h('b', null, u.name_guess || 'Unknown item'), h('span', { class: 'faint' }, 'not in catalogue')))),
    h('td', { class: 'num' }, 0), h('td', { class: 'num' }, u.quantity || 1), h('td', { class: 's-UNKNOWN status-cell' }, STATUS.UNKNOWN), h('td', { class: 'num faint' }, u.confidence == null ? '' : pct(u.confidence)))));
  return h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, h('th', null, 'Product'), h('th', { class: 'num' }, 'Ordered'), h('th', { class: 'num' }, 'Seen'), h('th', null, 'Result'), h('th', { class: 'num' }, 'AI sure'))),
    h('tbody', null, rows)));
}

export function findingsList(record) {
  const f = (record._meta && record._meta.findings) || [];
  const texts = f.length ? f.map((x) => ({ text: x.text, cls: x.type === 'IMAGE_QUALITY' || !x.confirmed ? 'unsure' : 'stop' })) : ((record._meta && record._meta.issues) || []).map((t) => ({ text: t, cls: record.agent_verdict === 'SEAL' ? 'seal' : record.agent_verdict === 'STOP_AND_FIX' ? 'stop' : 'unsure' }));
  if (!texts.length && record.agent_verdict === 'SEAL') texts.push({ text: 'Every expected item was seen at the right quantity, with nothing extra.', cls: 'seal' });
  return h('ul', { class: 'findings' }, texts.map((t) => h('li', { class: t.cls }, t.text)));
}

export function confidenceMeter(record) {
  const v = Math.round((record.confidence_score || 0) * 100);
  return h('div', null, h('div', { class: 'row', style: { justifyContent: 'space-between', fontSize: '.82rem' } }, h('span', { class: 'muted' }, 'AI confidence in what it saw'), h('b', null, `${v}%`)),
    h('div', { class: 'meter', role: 'meter', 'aria-valuenow': v, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'AI confidence' }, h('i', { style: { width: `${v}%` } })));
}

export function verdictHead(record) {
  const v = VERDICT[record.agent_verdict] || VERDICT.PENDING_REVIEW;
  const o = record.operator_override;
  return h('div', { class: 'verdict-head' },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, stamp(record.agent_verdict), o ? h('span', { class: 'chip plain' }, `Operator changed to ${(VERDICT[o.new_verdict] || {}).label || o.new_verdict}`) : null),
    h('p', { class: 'sentence' }, v.sentence), checksRow(record));
}

/** Photo with AI-reported boxes. Boxes are approximate and only drawn when the model gave a valid one. */
export function photoWithBoxes(url, record, photoIndex) {
  const frame = h('div', { class: 'photo-frame' }, h('img', { src: url, alt: `Open box photo ${photoIndex}` }));
  const det = ((record._meta && record._meta.detections) || []).filter((d) => d.box && (d.photo === photoIndex || (d.photo == null && photoIndex === 1)));
  const status = Object.fromEntries(((record._meta && record._meta.line_items) || []).map((l) => [l.sku, l.status]));
  det.forEach((d) => {
    const [x, y, w, hh] = d.box;
    const s = status[d.sku];
    const cls = d.confidence < 0.62 ? 'weak' : s && s !== 'MATCH' ? 'bad' : '';
    frame.append(h('div', { class: `bbox ${cls}`, style: { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${hh * 100}%` } }, h('span', null, `${d.name_guess} ${pct(d.confidence)}`)));
  });
  return { frame, boxCount: det.length };
}
export const boxLegend = () => h('div', { class: 'legend' }, h('span', null, h('i', { style: { color: 'var(--seal)' } }), 'Matches order'), h('span', null, h('i', { style: { color: 'var(--stop)' } }), 'Not on order'), h('span', null, h('i', { style: { color: 'var(--unsure)', borderStyle: 'dashed' } }), 'AI unsure'), h('span', { class: 'faint' }, 'Boxes are the AI\u2019s approximate positions.'));

/** Co-pilot chat: grounded on the record, cannot change the verdict. */
export function copilot(record, orgId) {
  const chat = h('div', { class: 'chat', 'aria-live': 'polite' });
  const history = [];
  const input = h('input', { class: 'input', placeholder: 'Ask about this box\u2026', 'aria-label': 'Ask the co-pilot about this box', maxlength: 400 });
  const send = h('button', { class: 'btn', type: 'submit' }, icon('send'), 'Ask');
  const ask = async (text) => {
    const question = (text || input.value).trim();
    if (!question) return;
    input.value = '';
    chat.append(h('div', { class: 'msg me' }, question));
    const wait = h('div', { class: 'msg ai' }, h('span', { class: 'spin' }), ' Thinking\u2026');
    chat.append(wait); chat.scrollTop = chat.scrollHeight; send.disabled = true;
    try {
      const r = await api.copilot({ org_id: orgId, record_id: record.record_id, question, history });
      history.push({ role: 'user', content: question }, { role: 'assistant', content: r.answer });
      wait.replaceWith(h('div', { class: 'msg ai' }, r.answer, h('small', null, r.source === 'ai' ? `AI explanation (${r.model}). It cannot change the verdict.` : 'Rule-based explanation. The AI model was not reachable.')));
    } catch (e) { wait.replaceWith(h('div', { class: 'msg ai' }, e.message)); }
    send.disabled = false; chat.scrollTop = chat.scrollHeight;
  };
  const quick = h('div', { class: 'quick' }, ['Why this verdict?', 'What should I do next?', 'How sure is the AI?'].map((t) => h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => ask(t) }, t)));
  return h('div', { class: 'copilot' }, quick, chat, h('form', { class: 'ask', onsubmit: (e) => { e.preventDefault(); ask(); } }, input, send));
}
