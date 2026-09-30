/* Label desk: a human labels PRODUCT 01-50 independently. The AI is deliberately not involved, and there is
   no restock / refurbish / liquidate / dispose field. */
import { h, clear, icon, toast, download, authorBadge } from './ui.js';

const ids = Array.from({ length: 50 }, (_, i) => `PRODUCT-${String(i + 1).padStart(2, '0')}`);
const Q1 = ['yes', 'no', 'not sure'];
const Q3 = ['like new', 'very good', 'good', 'acceptable', 'not sure'];

export async function render(root, { api, getCatalogue }) {
  const [cat, { labels }] = await Promise.all([getCatalogue(), api.labels()]);
  const byId = Object.fromEntries(cat.map((c) => [c.sku, c]));
  let cur = ids.find((i) => !labels[i]) || ids[0];
  const list = h('div', { class: 'plist' });
  const form = h('div', { class: 'panel' });
  const prog = h('span', { class: 'meta' });
  const done = (i) => labels[i] && labels[i].q1 && labels[i].q2 && labels[i].q3;

  function paintList() {
    clear(list);
    const n = ids.filter(done).length;
    prog.textContent = `${n} of 50 done`;
    ids.forEach((i) => list.append(h('button', { 'aria-current': String(i === cur), onclick: () => { cur = i; paintList(); paintForm(); } }, h('span', null, i.replace('-', ' ')), done(i) ? h('span', { class: 'chip seal' }, icon('check')) : labels[i] ? h('span', { class: 'chip unsure' }, 'partial') : h('span', { class: 'faint' }, '\u2014'))));
  }

  function radios(name, opts, value, onPick) {
    return h('div', { class: 'opts', role: 'radiogroup' }, opts.map((o) => h('label', { class: 'opt' }, h('input', { type: 'radio', name, value: o, checked: value === o, onchange: () => onPick(o) }), h('span', null, o))));
  }

  function paintForm() {
    clear(form);
    const item = byId[cur];
    const saved = labels[cur] || {};
    const ans = { q1: saved.q1 || null, q2: saved.q2 || null, q3: saved.q3 || null };
    const sku = h('input', { value: saved.sku_asin || 'UNKNOWN', 'aria-label': 'SKU or ASIN', maxlength: 40 });
    const photos = (item && item.photo_urls) || [];
    const idx = ids.indexOf(cur);
    const save = async (next) => {
      try {
        const r = await api.saveLabel(cur, { ...ans, sku_asin: sku.value });
        labels[cur] = r.label; toast(`${cur.replace('-', ' ')} saved.`, 'ok');
        if (next && idx < ids.length - 1) cur = ids[idx + 1];
        paintList(); paintForm();
      } catch (e) { toast(e.message, 'bad'); }
    };
    form.append(h('div', { class: 'panel-head' }, h('h2', null, cur.replace('-', ' ')), prog),
      h('div', { class: 'panel-body stack' },
        photos.length ? h('div', { class: 'big-photos' }, photos.map((u, i) => h('a', { href: u, target: '_blank', rel: 'noopener' }, h('img', { src: u, alt: `${cur} photo ${i + 1}`, loading: 'lazy' }))))
          : h('div', { class: 'empty' }, icon('image', 30), h('h3', null, 'No photos for this product yet'), h('p', null, 'Import the Drive folder once it is downloaded:'), h('pre', { class: 'json' }, 'npm run import:products -- "/path/to/CUBE 2026 - RTN PRODUCT COLLECTION"'), h('p', { class: 'faint' }, 'You can also open the Drive folder in another tab and label from there; your answers are still saved here.')),
        item && (item.details || item.appearance) ? h('div', { class: 'findings' }, h('li', null, h('b', null, 'Details: '), item.details || item.appearance)) : h('p', { class: 'faint' }, 'No written details are stored for this product. Use the details that came with the photos.'),
        h('fieldset', { class: 'q', style: { border: 0, padding: '14px 0' } }, h('legend', { class: 'ql' }, '1. Does it look like the product named in the details?'), radios(`q1-${cur}`, Q1, ans.q1, (v) => { ans.q1 = v; })),
        h('fieldset', { class: 'q', style: { border: 0, padding: '14px 0' } }, h('legend', { class: 'ql' }, '2. Are the parts that belong with it visible?'), radios(`q2-${cur}`, Q1, ans.q2, (v) => { ans.q2 = v; })),
        h('fieldset', { class: 'q', style: { border: 0, padding: '14px 0' } }, h('legend', { class: 'ql' }, '3. Visible condition'), radios(`q3-${cur}`, Q3, ans.q3, (v) => { ans.q3 = v; })),
        h('label', { class: 'field' }, 'SKU or ASIN (leave UNKNOWN if you do not know it; do not hunt for a barcode)', sku),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-tape', onclick: () => save(true) }, 'Save & next'), h('button', { class: 'btn', onclick: () => save(false) }, 'Save'),
          h('button', { class: 'btn btn-ghost', disabled: idx === 0, onclick: () => { cur = ids[idx - 1]; paintList(); paintForm(); } }, 'Previous')),
        h('p', { class: 'faint', style: { fontSize: '.8rem' } }, 'Label on your own, before seeing anyone else\u2019s answers. This desk never suggests an answer and has no restock, refurbish, liquidate or dispose option.')));
  }

  const reply = () => ids.filter((i) => labels[i]).map((i) => { const l = labels[i]; return `${i.replace('-', ' ')}\n1. ${l.q1 || '-'}\n2. ${l.q2 || '-'}\n3. ${l.q3 || '-'}\nSKU/ASIN: ${l.sku_asin || 'UNKNOWN'}`; }).join('\n\n');

  root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Label desk'), h('p', null, 'Label real returned products PRODUCT 01 to 50 by eye: does it match, are the parts visible, what condition. Your answers only; the AI stays out of it.')),
    h('div', { class: 'page-tools' }, authorBadge(),
      h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(reply() || 'No labels yet.'); toast('Reply text copied.', 'ok'); } catch { toast('Copy failed. Use Download CSV.', 'bad'); } } }, icon('send'), 'Copy as reply'),
      h('a', { class: 'btn', href: '/api/labels.csv', download: 'product-labels.csv' }, icon('download'), 'Download CSV'))),
    h('div', { class: 'label-layout' }, h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Products')), list), form));
  paintList(); paintForm();
}
