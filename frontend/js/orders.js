/* Order builder: choose products and quantities, then queue the order for the Bench. */
import { h, clear, icon, toast, thumb, CHANNELS, fmtDateTime, authorBadge } from './ui.js';

export async function render(root, { state, api, getCatalogue, go }) {
  const cat = await getCatalogue();
  let lines = {}; let channel = 'shopify'; let search = '';
  const list = h('div', { class: 'stack' });
  const builder = h('div', { class: 'stack' });
  const grid = h('div', { class: 'grid' });
  const summary = h('div', { class: 'lines' });
  const byId = Object.fromEntries(cat.map((c) => [c.sku, c]));
  const undescribed = (c) => !c.appearance && !c.details && !(c.photos || []).length;

  function paintGrid() {
    clear(grid);
    const q = search.toLowerCase();
    const shown = cat.filter((c) => !q || `${c.name} ${c.sku} ${c.category}`.toLowerCase().includes(q));
    if (!shown.length) grid.append(h('p', { class: 'muted' }, 'No products match.'));
    shown.forEach((c) => grid.append(h('button', { class: 'pcard', 'aria-pressed': String(Boolean(lines[c.sku])), onclick: () => { lines[c.sku] = lines[c.sku] ? 0 : 1; if (!lines[c.sku]) delete lines[c.sku]; paintGrid(); paintSummary(); } },
      thumb(c, 'lg'), h('span', { class: 'nm' }, c.name), h('span', { class: 'mono faint' }, c.sku), undescribed(c) ? h('span', { class: 'chip unsure' }, 'No description') : null)));
  }
  function paintSummary() {
    clear(summary);
    const keys = Object.keys(lines);
    if (!keys.length) summary.append(h('p', { class: 'muted' }, 'Tap products to add them.'));
    keys.forEach((k) => {
      const out = h('output', null, lines[k]);
      const set = (n) => { lines[k] = Math.max(1, Math.min(99, n)); out.textContent = lines[k]; };
      summary.append(h('div', { class: 'line' }, thumb(byId[k]), h('div', null, h('b', null, byId[k].name), h('div', { class: 'mono faint' }, k)),
        h('span', { class: 'stepper', style: { marginLeft: 'auto' } }, h('button', { 'aria-label': `Fewer ${byId[k].name}`, onclick: () => set(lines[k] - 1) }, icon('minus')), out, h('button', { 'aria-label': `More ${byId[k].name}`, onclick: () => set(lines[k] + 1) }, icon('plus'))),
        h('button', { class: 'btn btn-sm btn-ghost', 'aria-label': `Remove ${byId[k].name}`, onclick: () => { delete lines[k]; paintGrid(); paintSummary(); } }, icon('x'))));
    });
    const warn = keys.filter((k) => undescribed(byId[k]));
    submit.disabled = !keys.length;
    warnBox.replaceChildren(...(warn.length ? [h('div', { class: 'banner', style: { marginBottom: 0 } }, icon('alert'), h('div', null, h('b', null, 'Heads up: '), warn.map((k) => byId[k].name).join(', '), ' have no description or photo, so the AI will mark them Uncertain. Describe them in the Library first.'))] : []));
  }
  const warnBox = h('div');
  const submit = h('button', { class: 'btn btn-tape btn-lg', onclick: async () => {
    submit.disabled = true;
    try {
      const { order } = await api.createOrder({ org_id: state.orgId, channel, lines: Object.entries(lines).map(([sku, qty]) => ({ sku, qty })) });
      toast(`Order ${order.order_id} queued as ${order.unit_id}.`, 'ok'); lines = {}; paintGrid(); paintSummary(); loadList();
    } catch (e) { toast(e.message, 'bad'); submit.disabled = false; }
  } }, icon('plus'), 'Queue order');

  async function loadList() {
    const { orders } = await api.orders(state.orgId);
    clear(list);
    if (!orders.length) { list.append(h('p', { class: 'muted', style: { padding: '16px' } }, 'No orders yet.')); return; }
    list.append(h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, ['Unit', 'Order', 'Channel', 'Contents', 'Status', 'Created', ''].map((t) => h('th', null, t)))),
      h('tbody', null, orders.map((o) => h('tr', null, h('td', { class: 'mono' }, o.unit_id), h('td', { class: 'mono' }, o.order_id), h('td', null, CHANNELS[o.channel] || o.channel),
        h('td', null, String(o.order_lines).split(';').map((x) => { const [s, q] = x.split(':'); return `${q}× ${byId[s] ? byId[s].name : s}`; }).join(', ')),
        h('td', null, o.status), h('td', { class: 'faint' }, fmtDateTime(o.created_at)),
        h('td', null, o.status === 'open' ? h('button', { class: 'btn btn-sm btn-ghost btn-danger', 'aria-label': `Delete ${o.order_id}`, onclick: async () => { await api.deleteOrder(state.orgId, o.order_id); loadList(); } }, icon('trash')) : null)))))));
  }

  const search$ = h('input', { class: 'input', type: 'search', placeholder: 'Search products\u2026', 'aria-label': 'Search products', oninput: (e) => { search = e.target.value; paintGrid(); } });
  const chan = h('label', { class: 'field' }, 'Sales channel', h('select', { onchange: (e) => { channel = e.target.value; } }, Object.entries(CHANNELS).map(([k, v]) => h('option', { value: k, selected: k === channel }, v))));
  root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Orders'), h('p', null, 'Build the expected contents of a box. Each order gets a unit ID and appears on the Bench.')), h('div', { class: 'page-tools' }, authorBadge())),
    h('div', { class: 'stack' },
      h('div', { class: 'lab' },
        h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, '1. Pick products'), h('span', { class: 'meta' }, `${cat.length} in catalogue`)), h('div', { class: 'panel-body stack' }, search$, h('div', { style: { maxHeight: '460px', overflowY: 'auto', padding: '4px' } }, grid))),
        h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, '2. Set quantities')), h('div', { class: 'panel-body stack' }, chan, summary, warnBox, h('div', { class: 'row' }, submit, h('button', { class: 'btn', onclick: () => go('bench') }, icon('scan'), 'Go to the Bench'))))),
      h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'All orders')), list)));
  paintGrid(); paintSummary(); await loadList();
}
