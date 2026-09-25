/**
 * Core Headless Pack Manager AI Agent
 * Orchestrates Tenancy Isolation, Single-Pass Vision Inference, Order Line Matching,
 * Fail-Open Protocols, and Standard Evidence Record Generation.
 */

const { verifyTenantAccess } = require('./tenancy');
const { matchOrderContents } = require('./matcher');
const { VisionEngine } = require('./vision-engine');
const { formatSkuString } = require('./types');

class PackManagerAgent {
  constructor(options = {}) {
    this.visionEngine = new VisionEngine(options);
    this.timeoutMs = options.timeoutMs || 3000; // Fail open if vision latency > 3s
  }

  /**
   * Processes a single open box unit packing request.
   * 
   * @param {Object} params
   * @param {string} params.requestTenantId - Requesting org (Rule 1)
   * @param {string} params.record_id - Stage record ID (e.g. PCK-0027)
   * @param {string} params.unit_id - Shared tracking unit ID (e.g. UNIT-0027)
   * @param {string} params.org_id - Record owner org ID
   * @param {string} params.order_id - Customer order ID
   * @param {string} params.channel - Sales channel (shopify, amazon_mfn, etc.)
   * @param {string} params.order_lines - Manifest SKU:qty string
   * @param {string[]} params.photo_refs - Photo paths
   * @param {string} [params.operator_id] - Packing bench operator ID
   * @param {Object} [params.fixtureData] - Optional synthetic test data
   * @returns {Promise<Object>} Standard Evidence Record matching contract schema
   */
  async processUnit(params) {
    const {
      requestTenantId,
      record_id,
      unit_id,
      org_id,
      order_id,
      channel,
      order_lines,
      photo_refs = [],
      operator_id = 'OP-SYSTEM',
      fixtureData = null
    } = params;

    // 1. Engineering Rule 1: Tenancy Isolation Guard
    verifyTenantAccess(requestTenantId, org_id);

    const capturedAt = new Date().toISOString();

    // 2. Execute Vision Analysis with Engineering Rule 3 (Fail Open Protocol)
    let visionResult;
    let isTimeoutOrError = false;

    try {
      // Wrap in a race condition for timeout
      const visionPromise = this.visionEngine.analyzeOpenCarton(photo_refs, order_lines, fixtureData);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Vision Engine Timeout (>3s)")), this.timeoutMs)
      );

      visionResult = await Promise.race([visionPromise, timeoutPromise]);
    } catch (err) {
      // Engineering Rule 3: Fail Open. Never block packing bench operator!
      isTimeoutOrError = true;
      visionResult = {
        observedSkuMap: {},
        visualConfidence: 0.0,
        rawAnalysis: `FAIL_OPEN_TRIGGERED: ${err.message}`
      };
    }

    // 3. Evaluate Matcher Logic
    let matchResult;
    let finalVerdict;

    if (isTimeoutOrError) {
      finalVerdict = 'PENDING_REVIEW';
      matchResult = {
        verdict: 'PENDING_REVIEW',
        visualConfidence: 0.0,
        checks: {
          all_items_present: 'UNCERTAIN',
          quantities_correct: 'UNCERTAIN',
          no_extra_items: 'UNCERTAIN'
        },
        discrepancy_types: ['NETWORK_TIMEOUT'],
        breakdown: { missing_items: [], short_quantities: [], wrong_items: [], extra_items: [] },
        formatted_expected: order_lines,
        formatted_observed: ''
      };
    } else {
      matchResult = matchOrderContents(
        order_lines,
        visionResult.observedSkuMap,
        visionResult.visualConfidence
      );
      finalVerdict = matchResult.verdict;
    }

    // 4. Construct Cross-Pod Evidence Record (Compliant with evidence-contract.json)
    const evidenceRecord = {
      record_id,
      unit_id,
      org_id,
      order_id,
      channel,
      captured_at: capturedAt,
      photo_refs: Array.isArray(photo_refs) ? photo_refs : [photo_refs],
      order_lines,
      observed_in_box: matchResult.formatted_observed,
      agent_verdict: finalVerdict,
      confidence_score: matchResult.visualConfidence,
      checks: matchResult.checks,
      discrepancy_types: matchResult.discrepancy_types,
      discrepancy_breakdown: matchResult.breakdown,
      operator_id,
      operator_override: null
    };

    return evidenceRecord;
  }

  /**
   * Logs an operator override without mutating original record history.
   */
  applyOperatorOverride(evidenceRecord, newVerdict, operatorId, overrideReason) {
    if (!evidenceRecord) throw new Error("Invalid evidence record");
    
    return {
      ...evidenceRecord,
      operator_override: {
        original_verdict: evidenceRecord.agent_verdict,
        new_verdict: newVerdict,
        operator_id: operatorId,
        override_reason: overrideReason,
        override_at: new Date().toISOString()
      }
    };
  }
}

module.exports = {
  PackManagerAgent
};
