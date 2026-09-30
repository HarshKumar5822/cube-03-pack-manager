/* Product library: descriptions and reference photos are what the AI uses to recognise products. */
import { h, clear, icon, toast, drawer, thumb, dropzone, debounce, authorBadge } from './ui.js';
import { api as API } from './api.js';

export async function render(root, { state, api, getCatalogue }) {
  let cat = await getCatalogue();
  let q = '';
  const grid = h('div', { class: 'grid' });
  const ready = (c) => Boolean(c.appearance || c.details || (c.photos || []).length);

  function paint() {
    clear(grid);
    const s = q.toLowerCase();
    const shown = cat.filter((c) => !s || `${c.name} ${c.sku} ${c.category}`.toLowerCase().includes(s));
    if (!shown.length) grid.append(h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, icon('tag', 30), h('h3', null, cat.length ? 'No products match' : 'The catalogue is empty'), h('p', null, 'Add a product, or import photos with the command on this page.')));
    shown.forEach((c) => grid.append(h('button', { class: 'pcard', onclick: () => edit(c) }, thumb(c, 'lg'), h('span', { class: 'nm' }, c.name), h('span', { class: 'mono faint' }, c.sku),
      h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: `chip ${ready(c) ? 'seal' : 'unsure'}` }, ready(c) ? 'AI-ready' : 'Needs description'), h('span', { class: 'chip plain' }, `${(c.photos || []).length} photo${(c.photos || []).length === 1 ? '' : 's'}`)))));
  }
  async function reload() { cat = await getCatalogue(true); paint(); }

  function edit(item) {
    const isNew = !item;
    let cur = item ? { ...item } : { sku: '', name: '', category: 'general', appearance: '', details: '', distinguish_from: [], photos: [], photo_urls: [] };
    drawer(isNew ? 'New product' : cur.name, (body, close) => {
      const f = (label, el) => h('label', { class: 'field' }, label, el);
      const sku = h('input', { value: cur.sku, disabled: !isNew, placeholder: 'SKU-EXAMPLE-01', maxlength: 41 });
      const name = h('input', { value: cur.name, maxlength: 100 });
      const category = h('input', { value: cur.category, maxlength: 40 });
      const appearance = h('textarea', { placeholder: 'What it looks like: colour, shape, logo, size, packaging.' }, cur.appearance || '');
      const details = h('textarea', { placeholder: 'Parts that come with it (charger, manual, strap\u2026) and anything else the AI should know.' }, cur.details || '');
      const dist = h('input', { value: (cur.distinguish_from || []).join('; '), placeholder: 'Products it is often confused with, separated by ;' });
      const photos = h('div', { class: 'photos-row' });
      const paintPhotos = () => {
        clear(photos);
        (cur.photo_urls || []).forEach((u, i) => photos.append(h('div', { class: 'ph', style: { backgroundImage: `url("${u}")` } }, h('button', { class: 'btn btn-sm', 'aria-label': 'Remove photo', onclick: async () => { try { const r = await API.deleteProductPhoto(cur.sku, cur.photos[i]); cur = { ...cur, ...r.item }; paintPhotos(); reload(); } catch (e) { toast(e.message, 'bad'); } } }, icon('x')))));
        if (!cur.photo_urls || !cur.photo_urls.length) photos.append(h('p', { class: 'muted' }, 'No reference photos yet.'));
      };
      paintPhotos();
      const save = h('button', { class: 'btn btn-tape', onclick: async () => {
        save.disabled = true;
        try { const r = await api.saveProduct({ sku: sku.value, name: name.value, category: category.value, appearance: appearance.value, details: details.value, distinguish_from: dist.value.split(';').map((x) => x.trim()).filter(Boolean) }); cur = { ...cur, ...r.item }; toast('Product saved.', 'ok'); await reload(); if (isNew) close(); } catch (e) { toast(e.message, 'bad'); }
        save.disabled = false;
      } }, 'Save product');
      body.append(h('div', { class: 'panel' }, h('div', { class: 'panel-body stack' }, f('SKU', sku), f('Name', name), f('Category', category), f('Appearance', appearance), f('Parts and details', details), f('Often confused with', dist), h('div', { class: 'row' }, save,
        !isNew ? h('button', { class: 'btn btn-danger', onclick: async () => { if (!confirm(`Delete ${cur.name}?`)) return; try { await api.deleteProduct(cur.sku); toast('Product deleted.', 'ok'); await reload(); close(); } catch (e) { toast(e.message, 'bad'); } } }, icon('trash'), 'Delete') : null))));
      if (!isNew) body.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Reference photos'), h('span', { class: 'meta' }, 'Shown to the AI when using Claude')), h('div', { class: 'panel-body stack' }, photos,
        dropzone({ label: 'Add product photos', hint: 'JPEG, PNG or WebP', onFiles: async (files) => { try { const r = await api.addProductPhotos(cur.sku, files); cur = { ...cur, ...r.item }; paintPhotos(); reload(); toast('Photos added.', 'ok'); } catch (e) { toast(e.message, 'bad'); } } }))));
    });
  }

  root.append(h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Product library'), h('p', null, 'The AI can only verify products it has a description or photo for. Anything else is reported Uncertain, never guessed.')),
    h('div', { class: 'page-tools' }, authorBadge(), h('input', { class: 'input', style: { width: '220px' }, type: 'search', placeholder: 'Search\u2026', 'aria-label': 'Search products', oninput: debounce((e) => { q = e.target.value; paint(); }, 120) }), h('button', { class: 'btn btn-tape', onclick: () => edit(null) }, icon('plus'), 'New product'))),
    h('div', { class: 'panel', style: { marginBottom: '16px' } }, h('div', { class: 'panel-head' }, h('h2', null, 'Import a folder of product photos')), h('div', { class: 'panel-body stack' },
      h('p', { class: 'muted' }, 'Download the PRODUCT 01\u201350 photo folder from Drive, then run this in the ', h('span', { class: 'mono' }, 'backend'), ' folder. Photos are filed under PRODUCT-01 to PRODUCT-50.'),
      h('pre', { class: 'json' }, 'npm run import:products -- "/path/to/CUBE 2026 - RTN PRODUCT COLLECTION"'),
      h('p', { class: 'faint', style: { fontSize: '.84rem' } }, 'Then give each product a real name and description here so the AI can recognise it.'))),
    grid);
  paint();
}
