'use strict';

const fs = require('fs');
const path = require('path');
const { getConfig } = require('./config');

const dir = () => getConfig().dataDir;
const file = () => path.join(dir(), 'catalogue.json');
const photoDir = () => path.join(dir(), 'products');

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function normalize(i) {
  return {
    sku: String(i.sku),
    name: String(i.name || i.sku),
    category: i.category || 'general',
    appearance: i.appearance || '',
    distinguish_from: Array.isArray(i.distinguish_from) ? i.distinguish_from : [],
    details: i.details || '',
    photos: Array.isArray(i.photos) ? i.photos : [],
  };
}

function getCatalogue() {
  try {
    const f = file();
    if (!fs.existsSync(f)) {
      const seed = path.join(__dirname, '..', 'data', 'catalogue.json');
      if (fs.existsSync(seed)) {
        return JSON.parse(fs.readFileSync(seed, 'utf8')).map(normalize);
      }
    }
    return JSON.parse(fs.readFileSync(f, 'utf8')).map(normalize);
  } catch {
    return [];
  }
}

function save(items) {
  try {
    fs.mkdirSync(dir(), { recursive: true });
    const tmp = `${file()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
    fs.renameSync(tmp, file());
  } catch (err) {
    console.warn('[Catalogue Save Warning]:', err.message);
  }
}


function findBySku(sku) {
  return getCatalogue().find((c) => c.sku === sku) || null;
}

function upsert(item) {
  const items = getCatalogue();
  const i = items.findIndex((c) => c.sku === item.sku);
  const merged = normalize({ ...(i >= 0 ? items[i] : {}), ...item });
  if (i >= 0) items[i] = merged; else items.push(merged);
  save(items);
  return merged;
}

function remove(sku) {
  const items = getCatalogue();
  const item = items.find((c) => c.sku === sku);
  if (!item) return false;
  item.photos.forEach((p) => fs.rmSync(path.join(photoDir(), p), { force: true }));
  save(items.filter((c) => c.sku !== sku));
  return true;
}

function addPhoto(sku, buffer, ext) {
  const item = findBySku(sku);
  if (!item) return null;
  fs.mkdirSync(photoDir(), { recursive: true });
  let n = item.photos.length + 1;
  let name;
  do { name = `${sku}_${n++}.${ext}`; } while (item.photos.includes(name));
  fs.writeFileSync(path.join(photoDir(), name), buffer);
  return upsert({ sku, photos: [...item.photos, name] });
}

function removePhoto(sku, name) {
  const item = findBySku(sku);
  if (!item || !item.photos.includes(name)) return null;
  fs.rmSync(path.join(photoDir(), path.basename(name)), { force: true });
  return upsert({ sku, photos: item.photos.filter((p) => p !== name) });
}

/** Reads a catalogue photo for use as an AI reference image; null if missing. */
function loadPhoto(sku, index = 0) {
  const item = findBySku(sku);
  const name = item && item.photos[index];
  if (!name) return null;
  try {
    const buf = fs.readFileSync(path.join(photoDir(), path.basename(name)));
    const ext = path.extname(name).slice(1).toLowerCase();
    return { mime: MIME[ext] || 'image/jpeg', b64: buf.toString('base64'), bytes: buf.length };
  } catch {
    return null;
  }
}

/** Public shape for the API: adds URLs, drops photos that no longer exist on disk. */
function publicItem(i) {
  const photos = i.photos.filter((p) => fs.existsSync(path.join(photoDir(), path.basename(p))));
  return { ...i, photos, photo_urls: photos.map((p) => `/api/products/${encodeURIComponent(p)}`) };
}

module.exports = { getCatalogue, findBySku, upsert, remove, addPhoto, removePhoto, loadPhoto, publicItem, photoDir, MIME };
