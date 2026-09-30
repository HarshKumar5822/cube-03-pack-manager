'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cat = require('../catalogue');
const { sniffImage } = require('../images');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 10 } }).array('photo', 10);
const SKU_RE = /^[A-Z0-9][A-Z0-9-]{1,40}$/;

router.get('/catalogue', (req, res) => res.json({ catalogue: cat.getCatalogue().map(cat.publicItem) }));

router.post('/catalogue', (req, res) => {
  const b = req.body || {};
  const sku = String(b.sku || '').trim().toUpperCase();
  if (!SKU_RE.test(sku)) return res.status(400).json({ error: 'SKU must be 2-41 characters: A-Z, 0-9 and dashes.' });
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Name is required.' });
  const item = cat.upsert({
    sku,
    name: String(b.name).trim().slice(0, 100),
    category: String(b.category || 'general').trim().slice(0, 40),
    appearance: String(b.appearance || '').slice(0, 400),
    details: String(b.details || '').slice(0, 600),
    distinguish_from: Array.isArray(b.distinguish_from) ? b.distinguish_from.map(String).slice(0, 10) : [],
  });
  res.json({ item: cat.publicItem(item) });
});

router.delete('/catalogue/:sku', (req, res) => (cat.remove(req.params.sku) ? res.json({ ok: true }) : res.status(404).json({ error: 'Unknown SKU' })));

router.post('/catalogue/:sku/photos', (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'A photo is larger than 8 MB.' : err.message });
    if (!cat.findBySku(req.params.sku)) return res.status(404).json({ error: 'Unknown SKU' });
    if (!(req.files || []).length) return res.status(400).json({ error: 'Attach one or more photos in the "photo" field.' });
    let item = null;
    for (const f of req.files) {
      const kind = sniffImage(f.buffer);
      if (!kind) return res.status(400).json({ error: `"${f.originalname}" is not a JPEG, PNG or WebP image.` });
      item = cat.addPhoto(req.params.sku, f.buffer, kind.ext);
    }
    res.json({ item: cat.publicItem(item) });
  });
});

router.delete('/catalogue/:sku/photos/:name', (req, res) => {
  const item = cat.removePhoto(req.params.sku, path.basename(req.params.name));
  return item ? res.json({ item: cat.publicItem(item) }) : res.status(404).json({ error: 'Photo not found' });
});

router.get('/products/:file', (req, res) => {
  const full = path.join(cat.photoDir(), path.basename(req.params.file));
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Not found' });
  res.set('Cache-Control', 'public, max-age=300');
  res.sendFile(full);
});

module.exports = router;
