/**
 * Data parsing helpers for SKU manifests formatted as "SKU:qty;SKU:qty"
 */

/**
 * Parses SKU string like "SKU-PUZZLE-500:1;SKU-BOTTLE-750:1" into an object map { SKU: quantity }
 * @param {string} skuStr 
 * @returns {Record<string, number>}
 */
function parseSkuString(skuStr) {
  if (!skuStr || typeof skuStr !== 'string') return {};
  const result = {};
  const tokens = skuStr.split(';').map(t => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const parts = token.split(':');
    if (parts.length === 2) {
      const sku = parts[0].trim();
      const qty = parseInt(parts[1].trim(), 10) || 0;
      if (sku) {
        result[sku] = (result[sku] || 0) + qty;
      }
    }
  }
  return result;
}

/**
 * Formats object map { SKU: quantity } into standard string "SKU:qty;SKU:qty"
 * @param {Record<string, number>} skuMap 
 * @returns {string}
 */
function formatSkuString(skuMap) {
  if (!skuMap || typeof skuMap !== 'object') return '';
  return Object.entries(skuMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sku, qty]) => `${sku}:${qty}`)
    .join(';');
}

module.exports = {
  parseSkuString,
  formatSkuString
};
