'use strict';
/**
 * Import a folder of product photos (for example the downloaded "PRODUCT 01 ... PRODUCT 50" Drive
 * folder) into the catalogue.
 *
 *   npm run import:products -- "C:\path\to\CUBE 2026 - RTN PRODUCT COLLECTION"
 *   npm run import:products -- ./folder --dry
 *
 * A photo belongs to product N when "PRODUCT N" (any spacing, dash or underscore) appears in its
 * file name or in a parent folder name. New products are created as PRODUCT-NN with a placeholder
 * name - rename them and add a description in the Library so the AI can recognise them.
 */
const fs = require('fs');
const path = require('path');
const cat = require('../server/catalogue');
const { sniffImage } = require('../server/images');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const root = args.find((a) => !a.startsWith('--'));
if (!root || !fs.existsSync(root)) {
  console.error('Usage: npm run import:products -- <folder> [--dry]');
  process.exit(1);
}

const IMG = /\.(jpe?g|png|webp)$/i;
const SKIP = /\.(heic|heif|gif|bmp|tiff?)$/i;
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}
function productNumber(file) {
  const parts = path.relative(root, file).split(path.sep).reverse();
  for (const part of parts) {
    const m = part.match(/product[\s_-]*0*(\d{1,3})(?!\d)/i);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

const groups = {};
const unmatched = [];
const unsupported = [];
for (const f of walk(root)) {
  if (SKIP.test(f)) { unsupported.push(f); continue; }
  if (!IMG.test(f)) continue;
  const n = productNumber(f);
  if (n === null) unmatched.push(f); else (groups[n] = groups[n] || []).push(f);
}

let photos = 0;
let products = 0;
Object.keys(groups).map(Number).sort((a, b) => a - b).forEach((n) => {
  const sku = `PRODUCT-${String(n).padStart(2, '0')}`;
  const files = groups[n].sort();
  console.log(`${sku}: ${files.length} photo(s)`);
  if (dry) return;
  const valid = [];
  files.forEach((f) => {
    const buf = fs.readFileSync(f);
    const kind = sniffImage(buf);
    if (kind) valid.push({ buf, kind }); else console.warn(`  skipped (not a real JPEG/PNG/WebP): ${f}`);
  });
  if (!valid.length) return;
  if (!cat.findBySku(sku)) cat.upsert({ sku, name: `Product ${String(n).padStart(2, '0')}`, category: 'returns-set', appearance: '', details: '' });
  valid.forEach(({ buf, kind }) => { cat.addPhoto(sku, buf, kind.ext); photos++; });
  products++;
});

console.log(`\n${dry ? '[dry run] ' : ''}${dry ? Object.keys(groups).length : products} product(s), ${dry ? Object.values(groups).flat().length : photos} photo(s).`);
if (unmatched.length) console.log(`${unmatched.length} image(s) had no "PRODUCT NN" in their name or folder and were skipped, e.g. ${unmatched[0]}`);
if (unsupported.length) console.log(`${unsupported.length} HEIC/GIF/BMP/TIFF file(s) skipped - convert to JPEG first, e.g. ${unsupported[0]}`);
