'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getConfig } = require('./config');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/] }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Created-By', 'Harsh Kumar');
  next();
});
app.use(express.json({ limit: '1mb' }));

['analyze', 'records', 'stats', 'catalogue', 'orders', 'system', 'labels', 'eval'].forEach((r) => app.use('/api', require(`./routes/${r}`)));
app.use('/api', (req, res) => res.status(404).json({ error: `No such API route: ${req.method} ${req.path}` }));

const frontend = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontend, { extensions: ['html'] }));
// SPA fallback only for page navigations - a missing .jpg/.js must 404, not return index.html.
app.get('*', (req, res) => (path.extname(req.path) ? res.status(404).end() : res.sendFile(path.join(frontend, 'index.html'))));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

function start(port) {
  const cfg = getConfig();
  const { connectMongoDB } = require('./mongo');
  connectMongoDB().catch((err) => console.warn('[Database] Async connection warning:', err.message));
  return app.listen(port ?? cfg.port, () => {
    console.log(`\n Pack Manager (Created By Harsh Kumar)  http://localhost:${port ?? cfg.port}`);
    console.log(` AI provider   ${cfg.activeProvider ? `${cfg.activeProvider} (${cfg[cfg.activeProvider].models[0]})` : 'NOT CONFIGURED - boxes will be held as PENDING_REVIEW'}\n`);
  });
}



if (require.main === module) start();
module.exports = { app, start };
