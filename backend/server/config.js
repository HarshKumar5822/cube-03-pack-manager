'use strict';

/**
 * Central configuration. Read lazily (getConfig()) so tests can change process.env.
 * .env is loaded from backend/.env by absolute path - the old code used the current
 * working directory, so `npm start` from the repo root never found the key.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DATA_DIR = process.env.PACK_DATA_DIR || (process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data'));


function num(v, d) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
}

function getConfig() {
  const e = process.env;
  const cfg = {
    port: parseInt(e.PORT || '4000', 10),
    dataDir: process.env.PACK_DATA_DIR || DATA_DIR,
    confidenceThreshold: num(e.CONFIDENCE_THRESHOLD, 0.62),
    visionTimeoutMs: num(e.VISION_TIMEOUT_MS, 45000),
    textTimeoutMs: num(e.TEXT_TIMEOUT_MS, 20000),
    maxPhotos: 3, // Groq's Qwen 3.6 accepts 3 images per request; keep one call per box
    maxPhotoBytes: 10 * 1024 * 1024,
    costPerDefect: num(e.COST_PER_WRONG_SHIPMENT, 35),
    referenceImageLimit: parseInt(e.REFERENCE_IMAGE_LIMIT || '8', 10),
    provider: (e.VISION_PROVIDER || 'auto').toLowerCase(),
    forceFailure: String(e.FORCE_VISION_FAILURE).toLowerCase() === 'true',
    groq: {
      key: e.GROQ_API_KEY || '',
      baseUrl: e.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      // Llama 4 Maverick (shut down 2026-03-09) and Scout (2026-07-17) are retired on Groq.
      models: [e.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b', e.GROQ_FALLBACK_MODEL || 'qwen/qwen3.8-27b'],
    },
    anthropic: {
      key: e.ANTHROPIC_API_KEY || '',
      baseUrl: e.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
      version: '2023-06-01',
      models: [e.ANTHROPIC_MODEL || 'claude-sonnet-5-5', e.ANTHROPIC_FALLBACK_MODEL || 'claude-haiku-4-5-20251001'],
    },
  };
  cfg.activeProvider = resolveProvider(cfg);
  return cfg;
}

/** 'anthropic' | 'groq' | null. "auto" prefers whichever key exists (Anthropic first). */
function resolveProvider(cfg) {
  if (cfg.provider === 'groq') return cfg.groq.key ? 'groq' : null;
  if (cfg.provider === 'anthropic') return cfg.anthropic.key ? 'anthropic' : null;
  if (cfg.anthropic.key) return 'anthropic';
  if (cfg.groq.key) return 'groq';
  return null;
}

module.exports = { getConfig, DATA_DIR };
