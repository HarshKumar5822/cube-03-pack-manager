/**
 * Order Line Matcher & Discrepancy Classifier Engine
 */

const { parseSkuString, formatSkuString } = require('./types');

/**
 * Compares expected order lines with observed box contents.
 * Evaluates missing items, short quantities, wrong items, extra items, and visual ambiguity.
 * 
 * @param {string|Record<string, number>} expectedInput 
 * @param {string|Record<string, number>} observedInput 
 * @param {number} visualConfidence - Confidence score from vision model (0.0 to 1.0)
 * @param {number} confidenceThreshold - Min threshold for high confidence (default 0.80)
 */
function matchOrderContents(expectedInput, observedInput, visualConfidence = 0.95, confidenceThreshold = 0.80) {
  const expectedMap = typeof expectedInput === 'string' ? parseSkuString(expectedInput) : { ...expectedInput };
  const observedMap = typeof observedInput === 'string' ? parseSkuString(observedInput) : { ...observedInput };

  const discrepancies = [];
  const missingItems = [];
  const shortQuantities = [];
  const extraItems = [];
  const wrongItems = [];

  // Check 1 & 2: Items present and quantities correct per line
  for (const [sku, expectedQty] of Object.entries(expectedMap)) {
    const observedQty = observedMap[sku] || 0;
    if (observedQty === 0) {
      discrepancies.push('MISSING_ITEM');
      missingItems.push({ sku, expectedQty, observedQty: 0 });
    } else if (observedQty < expectedQty) {
      discrepancies.push('SHORT_QUANTITY');
      shortQuantities.push({ sku, expectedQty, observedQty, missing: expectedQty - observedQty });
    } else if (observedQty > expectedQty) {
      // Extra count of an expected item
      extraItems.push({ sku, quantity: observedQty - expectedQty });
      discrepancies.push('EXTRA_ITEM');
    }
  }

  // Check 3: Items in observed box that were not in expected manifest
  for (const [sku, observedQty] of Object.entries(observedMap)) {
    if (!(sku in expectedMap)) {
      // Unmanifested item observed
      extraItems.push({ sku, quantity: observedQty });
      discrepancies.push('EXTRA_ITEM');
    }
  }

  // Pair up missing items and unmanifested extra items as WRONG_ITEM if counts match
  if (missingItems.length > 0 && extraItems.length > 0) {
    for (const missing of missingItems) {
      const extraIdx = extraItems.findIndex(e => e.quantity === missing.expectedQty);
      if (extraIdx !== -1) {
        wrongItems.push({
          expectedSku: missing.sku,
          observedSku: extraItems[extraIdx].sku,
          quantity: missing.expectedQty
        });
        discrepancies.push('WRONG_ITEM');
      }
    }
  }

  // Deduplicate discrepancy tags
  const uniqueDiscrepancies = Array.from(new Set(discrepancies));

  // Determine sub-checks
  let allItemsPresent = missingItems.length === 0 ? 'PASS' : 'FAIL';
  let quantitiesCorrect = (missingItems.length === 0 && shortQuantities.length === 0) ? 'PASS' : 'FAIL';
  let noExtraItems = extraItems.length === 0 ? 'PASS' : 'FAIL';

  // Rule 4: If visual confidence is low, sub-checks and verdict default to UNCERTAIN
  const isAmbiguous = visualConfidence < confidenceThreshold;
  if (isAmbiguous) {
    uniqueDiscrepancies.push('VISUAL_AMBIGUITY');
    allItemsPresent = 'UNCERTAIN';
    quantitiesCorrect = 'UNCERTAIN';
    noExtraItems = 'UNCERTAIN';
  }

  // Determine final operational verdict
  let verdict = 'SEAL';
  if (isAmbiguous) {
    verdict = 'UNCERTAIN';
  } else if (uniqueDiscrepancies.length > 0) {
    verdict = 'STOP_AND_FIX';
  }

  return {
    verdict,
    visualConfidence,
    checks: {
      all_items_present: allItemsPresent,
      quantities_correct: quantitiesCorrect,
      no_extra_items: noExtraItems
    },
    discrepancy_types: uniqueDiscrepancies,
    breakdown: {
      missing_items: missingItems,
      short_quantities: shortQuantities,
      wrong_items: wrongItems,
      extra_items: extraItems
    },
    formatted_expected: formatSkuString(expectedMap),
    formatted_observed: formatSkuString(observedMap)
  };
}

module.exports = {
  matchOrderContents
};
