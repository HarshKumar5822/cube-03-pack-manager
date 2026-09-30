/* UI toolkit: DOM builder (text is always escaped), icons, verdict metadata, small components. */

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids);
  return el;
}
export function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

const ICONS = {
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17V9M13 17V5M18 17v-6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/>',
  server: '<rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/><path d="M8 7h.01M8 17h.01"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
};
export function icon(name, size) {
  const s = document.createElement('span');
  s.className = 'ico';
  s.setAttribute('aria-hidden', 'true');
  if (size) s.style.fontSize = `${size}px`;
  s.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`; // constant strings only
  return s;
}
export const authorBadge = () => h('div', { class: 'author-badge' }, icon('sparkle', 14), h('span', null, 'Created By Harsh Kumar'));

export const VERDICT = {
  SEAL: { label: 'Seal', stamp: 'Seal', cls: 'seal', sentence: 'Everything on the order is in the box. Safe to seal.' },
  STOP_AND_FIX: { label: 'Stop & fix', stamp: 'Stop & fix', cls: 'stop', sentence: 'Do not seal. Something in the box does not match the order.' },
  UNCERTAIN: { label: 'Uncertain', stamp: 'Uncertain', cls: 'unsure', sentence: 'The photo cannot prove this box right or wrong. Retake it or check by hand.' },
  PENDING_REVIEW: { label: 'Manual check', stamp: 'Hold', cls: 'pending', sentence: 'The AI check did not run. Have someone check this box by hand.' },
};
export const verdictChip = (v) => h('span', { class: `chip ${(VERDICT[v] || VERDICT.PENDING_REVIEW).cls}` }, (VERDICT[v] || { label: v }).label);
export const stamp = (v, small) => h('span', { class: `stamp ${(VERDICT[v] || VERDICT.PENDING_REVIEW).cls}${small ? ' sm' : ''}` }, (VERDICT[v] || { stamp: v }).stamp);

export const CHANNELS = { amazon_mfn: 'Amazon (seller-fulfilled)', shopify: 'Shopify', walmart: 'Walmart', '3pl_client': '3PL client' };
export const DEFECTS = { WRONG_ITEM: 'Wrong item', MISSING_ITEM: 'Missing item', SHORT_QUANTITY: 'Wrong quantity', EXTRA_ITEM: 'Extra item', VISUAL_AMBIGUITY: 'Unclear photo', NETWORK_TIMEOUT: 'AI unavailable' };

export const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const fmtDateTime = (iso) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const pct = (n) => `${Math.round(n * 100)}%`;
export const money = (n) => `$${Math.round(n).toLocaleString()}`;

export function toast(msg, kind = '') {
  const root = document.getElementById('toasts');
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
  root.append(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 7000 : 3800);
}

export function countUp(el, to, { prefix = '', suffix = '', ms = 700 } = {}) {
  const final = `${prefix}${Number(to).toLocaleString()}${suffix}`;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Number.isFinite(to) || to === 0) { el.textContent = final; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = `${prefix}${Math.round(to * (1 - (1 - k) ** 3)).toLocaleString()}${suffix}`;
    if (k < 1) requestAnimationFrame(tick); else el.textContent = final;
  };
  requestAnimationFrame(tick);
}

export function drawer(title, build) {
  const prevFocus = document.activeElement;
  const scrim = h('div', { class: 'scrim' });
  const body = h('div', { class: 'drawer-body' });
  const close = () => { scrim.remove(); panel.remove(); document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
  const closeBtn = h('button', { class: 'btn btn-sm', onclick: close, 'aria-label': 'Close' }, icon('x'), 'Close');
  const panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': typeof title === 'string' ? title : 'Details' }, h('div', { class: 'drawer-head' }, h('h2', null, title), closeBtn), body);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(scrim, panel);
  closeBtn.focus();
  build(body, close);
  return { close, body };
}

/** Product thumbnail: catalogue photo, else a neutral box icon. */
export function thumb(item, cls = '') {
  const url = item && item.photo_urls && item.photo_urls[0];
  return h('div', { class: `thumb ${cls}`, style: url ? { backgroundImage: `url("${url}")` } : null, role: 'img', 'aria-label': item ? item.name : 'Unknown product' }, url ? null : icon('box'));
}

export function dropzone({ label, hint, multiple = true, onFiles, compact }) {
  const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple, class: 'sr', tabindex: '-1' });
  const box = h('div', { class: 'dz', role: 'button', tabindex: '0', 'aria-label': label }, icon('upload', 22), h('b', null, label), hint && !compact ? h('span', { class: 'faint' }, hint) : null);
  const pick = (files) => { const f = [...files].filter((x) => /^image\//.test(x.type)); if (f.length) onFiles(f); };
  box.addEventListener('click', () => input.click());
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { pick(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.remove('drag'); }));
  box.addEventListener('drop', (e) => pick(e.dataTransfer.files));
  return h('div', null, box, input);
}

/** Downscale big phone photos before upload: faster, and within model image limits. */
export async function shrink(file, max = 1600, quality = 0.86) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5 * 1024 * 1024 && file.type === 'image/jpeg') return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
    return blob || file;
  } catch { return file; }
}

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export function download(name, text, type = 'text/csv') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
}
