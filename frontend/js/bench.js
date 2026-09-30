/* The Bench: pick an order, add 1-3 photos, run the AI check, get a stamped verdict. */
import { h, clear, icon, toast, stamp, VERDICT, CHANNELS, thumb, shrink, dropzone, fmtDateTime, authorBadge } from './ui.js';
import { verdictHead, ledger, findingsList, confidenceMeter, photoWithBoxes, boxLegend, copilot } from './recordView.js';
import { photoUrl } from './api.js';

const parseLines = (s) => String(s || '').split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const [sku, q] = x.split(':'); return { sku, qty: parseInt(q, 10) || 1 }; });

export async function render(root, { state, api, getCatalogue, refreshHealth, go }) {
  const [cat, { orders }] = await Promise.all([getCatalogue(), api.orders(state.orgId)]);
  const byId = Object.fromEntries(cat.map((c) => [c.sku, c]));
  const health = state.health || await refreshHealth();
  let selected = orders.find((o) => o.status === 'open') || orders[0] || null;
  let shots = []; // {file, url}
  let current = 0;
  let result = null;
  let busy = false;
  let stream = null;

  const queue = h('div', { class: 'queue-list', role: 'listbox', 'aria-label': 'Orders to check' });
  const stage = h('div', { class: 'stack' });
  const resultCol = h('div', { class: 'result-col stack' });
  const orderPanel = h('div', { class: 'panel' });

  const statusChip = (o) => ({ open: h('span', { class: 'chip plain' }, 'To check'), 'sealed-ok': h('span', { class: 'chip seal' }, 'Sealed'), held: h('span', { class: 'chip stop' }, 'Held'), review: h('span', { class: 'chip unsure' }, 'Needs review') }[o.status] || h('span', { class: 'chip plain' }, o.status));

  function paintQueue() {
    clear(queue);
    if (!orders.length) {
      queue.append(h('div', { style: { padding: '16px' } }, h('p', { class: 'muted' }, 'No orders yet.'), h('button', { class: 'btn btn-tape', style: { marginTop: '10px' }, onclick: () => go('orders') }, icon('plus'), 'Create an order')));
      return;
    }
    orders.forEach((o) => queue.append(h('button', { class: 'queue-item', role: 'option', 'aria-selected': selected && selected.order_id === o.order_id ? 'true' : 'false', onclick: () => { selected = o; result = null; resetShots(); paintAll(); } },
      h('span', { class: 'top' }, h('b', { class: 'mono' }, o.unit_id), statusChip(o)),
      h('span', { class: 'faint', style: { fontSize: '.8rem' } }, `${o.order_id} · ${CHANNELS[o.channel] || o.channel}`),
      h('span', { class: 'muted', style: { fontSize: '.84rem' } }, parseLines(o.order_lines).map((l) => `${l.qty}× ${byId[l.sku] ? byId[l.sku].name : l.sku}`).join(', ')))));
  }

  function paintOrder() {
    clear(orderPanel);
    if (!selected) { orderPanel.append(h('div', { class: 'panel-body' }, h('p', { class: 'muted' }, 'Choose an order from the list.'))); return; }
    const lines = parseLines(selected.order_lines);
    const noDesc = lines.filter((l) => byId[l.sku] && !byId[l.sku].appearance && !byId[l.sku].details && !(byId[l.sku].photos || []).length);
    orderPanel.append(h('div', { class: 'panel-head' }, h('h2', null, 'Expected in the box'), h('span', { class: 'meta mono' }, selected.unit_id)),
      h('div', { class: 'panel-body lines' }, lines.map((l) => { const c = byId[l.sku]; return h('div', { class: 'line' }, thumb(c), h('div', null, h('b', null, c ? c.name : l.sku), h('div', { class: 'faint mono' }, l.sku)), h('span', { class: 'qty' }, `× ${l.qty}`)); }),
        noDesc.length ? h('div', { class: 'banner', style: { marginTop: '8px', marginBottom: 0 } }, icon('alert'), h('div', null, h('b', null, 'The AI cannot verify: '), noDesc.map((l) => byId[l.sku].name).join(', '), '. These products have no description or photo, so any count will be UNCERTAIN. Add details in the Library.')) : null));
  }

  function resetShots() { shots.forEach((s) => URL.revokeObjectURL(s.url)); shots = []; current = 0; }
  async function addFiles(files) {
    const room = (health && health.maxPhotos) || 3;
    const free = room - shots.length;
    if (files.length > free) toast(`At most ${room} photos per box. Extra photos were ignored.`);
    for (const f of files.slice(0, Math.max(0, free))) { const small = await shrink(f); shots.push({ file: small, url: URL.createObjectURL(small) }); }
    result = null; current = Math.max(0, shots.length - 1); paintStage(); paintResult();
  }

  async function camera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('No camera available here. Use Upload.', 'bad'); return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch { toast('Camera permission was denied. Use Upload instead.', 'bad'); return; }
    const video = h('video', { autoplay: true, playsinline: true, muted: true }); video.srcObject = stream;
    const stop = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; paintStage(); };
    const snap = h('button', { class: 'btn btn-tape btn-lg', onclick: async () => {
      const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9)); stop(); addFiles([new File([blob], 'camera.jpg', { type: 'image/jpeg' })]);
    } }, icon('camera'), 'Take photo');
    clear(stage).append(h('div', { class: 'panel' }, h('div', { class: 'panel-body stack' }, h('div', { class: 'photo-stage' }, video), h('div', { class: 'row' }, snap, h('button', { class: 'btn', onclick: stop }, 'Cancel')))));
  }

  function paintStage() {
    clear(stage);
    const scanning = busy;
    const box = h('div', { class: `photo-stage${scanning ? ' busy' : ''}` });
    const rec = result && result.record;
    if (!shots.length) {
      const empty = h('div', { class: 'stage-empty', role: 'button', tabindex: '0', 'aria-label': 'Add photos of the open box' }, icon('camera', 38), h('h3', null, 'Photograph the open box'), h('p', null, 'Drop up to 3 photos here, or click to choose. Show all the contents, from above, in good light.'));
      const pick = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, class: 'sr', tabindex: '-1' });
      pick.addEventListener('change', () => { addFiles([...pick.files]); pick.value = ''; });
      empty.addEventListener('click', () => pick.click());
      empty.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick.click(); } });
      ['dragenter', 'dragover'].forEach((ev) => empty.addEventListener(ev, (e) => { e.preventDefault(); empty.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((ev) => empty.addEventListener(ev, (e) => { e.preventDefault(); empty.classList.remove('drag'); }));
      empty.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files].filter((f) => /^image\//.test(f.type))));
      box.append(empty, pick);
    } else {
      const s = shots[current];
      if (rec && rec._meta && rec._meta.detections && rec._meta.detections.some((d) => d.box)) box.append(photoWithBoxes(s.url, rec, current + 1).frame);
      else box.append(h('div', { class: 'photo-frame' }, h('img', { src: s.url, alt: `Box photo ${current + 1}` })));
      if (rec) { const v = VERDICT[rec.agent_verdict] || VERDICT.PENDING_REVIEW; box.append(h('div', { class: `tape-band ${v.cls}` }, rec.agent_verdict === 'STOP_AND_FIX' ? 'STOP & FIX \u2022 STOP & FIX \u2022 STOP & FIX' : v.label.toUpperCase())); }
      box.append(h('div', { class: 'scan' }, h('span', { class: 'scan-label' }, 'AI is looking at the box\u2026')));
    }
    const strip = h('div', { class: 'strip' }, shots.map((s, i) => h('div', { style: { position: 'relative' } }, h('button', { class: 'shot', 'aria-current': i === current ? 'true' : 'false', 'aria-label': `Show photo ${i + 1}`, style: { backgroundImage: `url("${s.url}")` }, onclick: () => { current = i; paintStage(); } }),
      busy ? null : h('button', { class: 'x', 'aria-label': `Remove photo ${i + 1}`, onclick: () => { URL.revokeObjectURL(s.url); shots.splice(i, 1); current = 0; result = null; paintStage(); paintResult(); } }, icon('x')))));
    const can = selected && shots.length && !busy;
    const ai = health && health.configured;
    const run = h('button', { class: 'btn btn-tape btn-lg', disabled: !can, onclick: analyze }, icon('sparkle'), busy ? 'Checking\u2026' : 'Check this box');
    const max = (health && health.maxPhotos) || 3;
    stage.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Open box'), h('span', { class: 'meta' }, `${shots.length}/${max} photos`)),
      h('div', { class: 'panel-body stack' },
        !ai ? h('div', { class: 'banner bad' }, icon('alert'), h('div', null, h('b', null, 'No AI provider is configured. '), 'Checks will be held for manual review and nothing will be guessed. Add a key to ', h('span', { class: 'mono' }, 'backend/.env'), ' and restart.')) : null,
        box, shots.length ? strip : null,
        h('div', { class: 'row' }, run,
          shots.length < max && !busy ? h('button', { class: 'btn', onclick: camera }, icon('camera'), 'Camera') : null,
          shots.length < max && !busy && shots.length ? (() => { const d = dropzone({ label: 'Add photo', multiple: true, compact: true, onFiles: addFiles }); d.style.maxWidth = '160px'; return d; })() : null,
          shots.length && !busy ? h('button', { class: 'btn btn-ghost', onclick: () => { resetShots(); result = null; paintStage(); paintResult(); } }, 'Clear') : null),
        result && result.record && result.record._meta.detections && result.record._meta.detections.some((d) => d.box) ? boxLegend() : null)));
  }

  async function analyze() {
    busy = true; paintStage(); paintResult();
    const fd = new FormData();
    fd.append('org_id', state.orgId); fd.append('unit_id', selected.unit_id); fd.append('order_id', selected.order_id);
    fd.append('channel', selected.channel); fd.append('order_lines', selected.order_lines); fd.append('operator_id', state.operator);
    shots.forEach((s, i) => fd.append('photos', s.file, `photo-${i + 1}.jpg`));
    try {
      result = await api.analyze(fd);
      const r = result.record;
      const o = orders.find((x) => x.order_id === selected.order_id);
      if (o) o.status = r.agent_verdict === 'SEAL' ? 'sealed-ok' : r.agent_verdict === 'STOP_AND_FIX' ? 'held' : 'review';
      if (r.agent_verdict === 'PENDING_REVIEW') toast('The AI check did not run. The photo is saved; check the box by hand.', 'bad');
    } catch (e) { toast(e.message, 'bad'); }
    busy = false; paintAll();
  }

  function paintResult() {
    clear(resultCol);
    if (busy) { resultCol.append(h('div', { class: 'panel' }, h('div', { class: 'panel-body stack' }, h('div', { class: 'row' }, h('span', { class: 'spin' }), h('b', null, 'Reading the photos blind')), h('p', { class: 'muted' }, 'The AI describes what it sees without being shown the order. Then plain code compares that with the order, so the AI cannot talk itself into a SEAL.'), h('div', { class: 'skeleton', style: { height: '90px' } })))); return; }
    if (!result) {
      resultCol.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Verdict')), h('div', { class: 'panel-body stack' }, h('p', { class: 'muted' }, 'Add photos and press Check. You will get one of three answers:'),
        h('div', { class: 'row' }, stamp('SEAL', true), stamp('STOP_AND_FIX', true), stamp('UNCERTAIN', true)),
        h('p', { class: 'faint', style: { fontSize: '.84rem' } }, 'Uncertain is a real answer. If the photo cannot prove the box right or wrong, the agent says so instead of guessing.'))));
      return;
    }
    const r = result.record;
    const m = r._meta || {};
    resultCol.append(h('div', { class: 'panel' }, verdictHead(r),
      h('div', { class: 'panel-body stack' }, confidenceMeter(r), findingsList(r), h('h3', null, 'Ordered vs seen'), ledger(r, cat),
        m.vision_notes ? h('p', { class: 'faint', style: { fontSize: '.82rem' } }, `AI note: ${m.vision_notes}`) : null,
        h('p', { class: 'faint', style: { fontSize: '.76rem' } }, m.model_used ? `Read by ${m.provider} / ${m.model_used} in ${((m.ai_latency_ms || 0) / 1000).toFixed(1)}s` + (m.reference_images ? ` with ${m.reference_images} catalogue reference photos` : '') : 'No AI model produced this result.', ` \u00B7 ${r.record_id}`),
        h('div', { class: 'row' }, h('button', { class: 'btn btn-sm', onclick: () => go('audit') }, icon('list'), 'Open in Audit')))),
      h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Ask the co-pilot'), h('span', { class: 'meta' }, 'Explains only; cannot change the verdict')), h('div', { class: 'panel-body' }, copilot(r, state.orgId))));
  }

  function paintAll() { paintQueue(); paintOrder(); paintStage(); paintResult(); }

  root.append(
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Check the box before you seal it'), h('p', null, 'Pick an order, photograph the open box, and the AI compares what it sees with what was ordered.')),
      h('div', { class: 'page-tools' }, authorBadge(), h('button', { class: 'btn', onclick: () => go('orders') }, icon('plus'), 'New order'))),
    h('div', { class: 'bench' },
      h('div', { class: 'stack' }, h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', null, 'Orders'), h('span', { class: 'meta' }, `${orders.length}`)), queue), orderPanel),
      stage, resultCol));
  paintAll();
  return () => { resetShots(); if (stream) stream.getTracks().forEach((t) => t.stop()); };
}
