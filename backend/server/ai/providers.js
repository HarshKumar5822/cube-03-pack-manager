'use strict';

/**
 * Thin, dependency-free provider layer. Two providers behind one interface:
 *   vision({system, text, images}) -> { text, model, usage }
 *   chat({system, messages})       -> { text, model, usage }
 * Each walks a model chain (primary, fallback). Any failure is surfaced as an
 * AIError - callers must never turn a failure into made-up output.
 */

class AIError extends Error {
  constructor(message, { status = null, attempts = [] } = {}) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.attempts = attempts;
  }
}

async function timedFetch(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new AIError(`timed out after ${timeoutMs}ms`, { status: 408 });
    throw new AIError(`network error: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function readError(res) {
  const body = await res.text().catch(() => '');
  return `HTTP ${res.status}${body ? `: ${body.slice(0, 240)}` : ''}`;
}

// Qwen 3.x on Groq may emit a reasoning block before the answer.
function stripThinking(t) {
  return String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/* ------------------------------ Groq (OpenAI-compatible) ------------------------------ */

function groqContent(text, images) {
  const parts = [];
  for (const im of images || []) {
    if (im.label) parts.push({ type: 'text', text: im.label });
    parts.push({ type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.b64}` } });
  }
  parts.push({ type: 'text', text });
  return parts;
}

async function groqOnce(cfg, model, { system, messages, images, json, timeoutMs, maxTokens }) {
  const build = (withJson) => ({
    model,
    temperature: 0.1,
    max_tokens: maxTokens,
    ...(withJson ? { response_format: { type: 'json_object' } } : {}),
    messages: [{ role: 'system', content: system }, ...messages],
  });
  const call = async (withJson) =>
    timedFetch(
      `${cfg.groq.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.groq.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(build(withJson)),
      },
      timeoutMs
    );

  let res = await call(json);
  // Some preview models reject JSON mode; retry once without it rather than failing the box.
  if (res.status === 400 && json) res = await call(false);
  if (!res.ok) throw new AIError(await readError(res), { status: res.status });
  const data = await res.json();
  const text = stripThinking(data?.choices?.[0]?.message?.content);
  if (!text) throw new AIError('empty model response');
  return { text, model, usage: data.usage || null };
}

/* ------------------------------ Anthropic Messages API ------------------------------ */

function anthropicContent(text, images) {
  const parts = [];
  for (const im of images || []) {
    if (im.label) parts.push({ type: 'text', text: im.label });
    parts.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.b64 } });
  }
  parts.push({ type: 'text', text });
  return parts;
}

async function anthropicOnce(cfg, model, { system, messages, timeoutMs, maxTokens }) {
  const res = await timedFetch(
    `${cfg.anthropic.baseUrl}/messages`,
    {
      method: 'POST',
      headers: {
        'x-api-key': cfg.anthropic.key,
        'anthropic-version': cfg.anthropic.version,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    },
    timeoutMs
  );
  if (!res.ok) throw new AIError(await readError(res), { status: res.status });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) throw new AIError('empty model response');
  return { text, model, usage: data.usage || null };
}

/* ------------------------------ public API ------------------------------ */

async function run(cfg, { system, userText, images = [], history = [], json = false, timeoutMs, maxTokens }) {
  const provider = cfg.activeProvider;
  if (!provider) throw new AIError('No AI provider configured (set GROQ_API_KEY or ANTHROPIC_API_KEY in backend/.env)');
  if (cfg.forceFailure) throw new AIError('FORCE_VISION_FAILURE is enabled (demo of fail-open behaviour)');

  const models = cfg[provider].models.filter(Boolean);
  const attempts = [];
  for (const model of [...new Set(models)]) {
    try {
      if (provider === 'groq') {
        const messages = [...history.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: groqContent(userText, images) }];
        return { provider, ...(await groqOnce(cfg, model, { system, messages, images, json, timeoutMs, maxTokens })) };
      }
      const messages = [...history.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: anthropicContent(userText, images) }];
      return { provider, ...(await anthropicOnce(cfg, model, { system, messages, timeoutMs, maxTokens })) };
    } catch (e) {
      attempts.push(`${model}: ${e.message}`);
      // auth problems will not be fixed by another model - stop early
      if (e.status === 401 || e.status === 403) break;
    }
  }
  throw new AIError(`All model attempts failed. ${attempts.join(' | ')}`, { attempts });
}

const vision = (cfg, args) => run(cfg, { ...args, json: true, timeoutMs: cfg.visionTimeoutMs, maxTokens: 3000 });
const chat = (cfg, args) => run(cfg, { ...args, json: false, timeoutMs: cfg.textTimeoutMs, maxTokens: 700 });

/** Lists models the configured provider really serves, so the UI can flag retired IDs. */
async function listModels(cfg) {
  const provider = cfg.activeProvider;
  if (!provider) return { provider: null, models: [], error: null };
  try {
    const url = provider === 'groq' ? `${cfg.groq.baseUrl}/models` : `${cfg.anthropic.baseUrl}/models?limit=100`;
    const headers = provider === 'groq'
      ? { Authorization: `Bearer ${cfg.groq.key}` }
      : { 'x-api-key': cfg.anthropic.key, 'anthropic-version': cfg.anthropic.version };
    const res = await timedFetch(url, { headers }, 8000);
    if (!res.ok) return { provider, models: [], error: await readError(res) };
    const data = await res.json();
    return { provider, models: (data.data || []).map((m) => m.id).sort(), error: null };
  } catch (e) {
    return { provider, models: [], error: e.message };
  }
}

module.exports = { vision, chat, listModels, AIError };
