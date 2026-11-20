'use strict';

/**
 * Vercel Serverless Function: POST /api/gemini
 * Keeps GEMINI_API_KEY strictly on the server via process.env.GEMINI_API_KEY.
 * Enforces schema validation, per-IP rate limiting, 8s timeout, 1 controlled retry on transient 502/503, and zero internal error leaks.
 */

const API_CONFIG = Object.freeze({
  MAX_PROMPT_LENGTH: 280,
  MAX_CITY_LENGTH: 60,
  MAX_PROFILE_LENGTH: 40,
  UPSTREAM_TIMEOUT_MS: 8000,
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX_REQUESTS: 15,
  MAX_RATE_LIMIT_KEYS: 500,
  GEMINI_MODEL: 'gemini-2.5-flash'
});

const rateLimitStore = new Map();

function clampFinite(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function pruneRateLimitStore(now) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (now - value.windowStart > API_CONFIG.RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
  while (rateLimitStore.size >= API_CONFIG.MAX_RATE_LIMIT_KEYS) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimitStore.delete(oldestKey);
  }
}

function isRateLimited(clientKey) {
  const now = Date.now();
  if (rateLimitStore.size >= API_CONFIG.MAX_RATE_LIMIT_KEYS) {
    pruneRateLimitStore(now);
  }
  const entry = rateLimitStore.get(clientKey);
  if (!entry || now - entry.windowStart > API_CONFIG.RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(clientKey, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > API_CONFIG.RATE_LIMIT_MAX_REQUESTS;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const clientIp = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'unknown').split(',')[0].trim();
  if (isRateLimited(clientIp)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Rate limit exceeded. Please retry after 60 seconds.' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid JSON request body. Expected a JSON object.' });
  }

  const rawPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!rawPrompt || rawPrompt.length > API_CONFIG.MAX_PROMPT_LENGTH) {
    return res.status(400).json({
      error: `Invalid prompt. Must be a non-empty string up to ${API_CONFIG.MAX_PROMPT_LENGTH} characters.`
    });
  }

  const city = typeof body.city === 'string' && body.city.trim()
    ? body.city.trim().slice(0, API_CONFIG.MAX_CITY_LENGTH)
    : 'Delhi NCR';
  const aqi = clampFinite(body.aqi, 0, 500, 367);
  const pm25 = clampFinite(body.pm25, 0, 1000, 218);
  const profile = typeof body.profile === 'string' && body.profile.trim()
    ? body.profile.trim().slice(0, API_CONFIG.MAX_PROFILE_LENGTH)
    : 'family';

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY environment variable is not configured on the server.',
      fallbackMode: 'Deterministic CPCB/WHO Rule Engine'
    });
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${API_CONFIG.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const reqOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `You are VayuAI, an Indian Urban Air Quality & Winter Smog Assistant. Never claim a 1-2 pollutant estimate is official 8-pollutant CPCB AQI, and provide general environmental guidance (not medical diagnosis). City: ${city} (Est. AQI ${aqi}, PM2.5 ${pm25} ug/m3). Profile: ${profile}. Question: ${rawPrompt}. Reply concisely in 2 sentences in English followed by 1 sentence in Hinglish.`
        }]
      }]
    })
  };

  try {
    let upstream = await fetchWithTimeout(endpoint, reqOptions, API_CONFIG.UPSTREAM_TIMEOUT_MS);
    if (upstream.status === 502 || upstream.status === 503) {
      upstream = await fetchWithTimeout(endpoint, reqOptions, API_CONFIG.UPSTREAM_TIMEOUT_MS);
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream Gemini API returned HTTP ${upstream.status}` });
    }
    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      return res.status(502).json({ error: 'Empty response from upstream model.' });
    }
    return res.status(200).json({ text, sourceMode: 'Live Gemini 2.5 Flash API (Server Proxy)' });
  } catch (err) {
    return res.status(504).json({ error: 'Upstream request timed out or failed.' });
  }
};
