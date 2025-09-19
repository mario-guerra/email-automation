/**
 * Minimal Cloud Run proxy (MVP)
 * - Host-based tenant resolution (in-memory demo map)
 * - Forwards requests to tenant-specific Apps Script /exec URL
 * - Exposes /health and /status endpoints
 *
 * Fill placeholders in env.example before deploying.
 */

const express = require('express');
const fetch = require('node-fetch'); // v2 compatible
const app = express();

app.disable('x-powered-by');
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// Demo tenant map (host -> target Apps Script URL)
// Replace or wire to Firestore/Secret Manager for production
const TENANTS = {
  'dashboard.example.com': process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/REPLACE_WITH_ID/exec'
};

function resolveTenant(host) {
  if (!host) return null;
  return TENANTS[host.split(':')[0].toLowerCase()] || null;
}

app.all('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.all('/status', async (req, res) => {
  const target = resolveTenant(req.headers.host);
  if (!target) return res.status(404).json({ ok: false, error: 'unknown_tenant' });
  try {
    const r = await fetch(target, { method: 'HEAD', redirect: 'manual' });
    return res.json({ ok: true, tenant: req.headers.host, upstream: r.status });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e) });
  }
});

app.all('*', async (req, res) => {
  const targetBase = resolveTenant(req.headers.host);
  if (!targetBase) return res.status(404).send('Unknown tenant');

  // Build target preserving path + query
  const targetUrl = new URL(req.originalUrl, targetBase).toString();

  // Copy headers but ensure Host matches upstream
  const headers = Object.assign({}, req.headers);
  try { headers.host = new URL(targetBase).host; } catch (e) { /* ignore */ }
  // Remove hop-by-hop headers that can interfere
  delete headers['connection'];
  delete headers['keep-alive'];
  delete headers['transfer-encoding'];
  delete headers['content-length'];

  const opts = { method: req.method, headers, redirect: 'manual' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    opts.body = req.body && req.body.length ? req.body : undefined;
  }

  try {
    const upstream = await fetch(targetUrl, opts);
    const body = await upstream.buffer();
    // Copy response headers (safe subset)
    upstream.headers.forEach((v, k) => {
      // avoid overriding some sensitive headers
      if (k.toLowerCase() === 'content-encoding') return;
      res.set(k, v);
    });
    res.status(upstream.status).send(body);
  } catch (err) {
    res.status(502).json({ error: 'upstream_error', detail: String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('Proxy listening on port', PORT);
});
