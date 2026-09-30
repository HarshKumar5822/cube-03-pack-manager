'use strict';

const express = require('express');
const cors = require('cors');
const { connectMongoDB } = require('../backend/server/mongo');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: '*' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('X-Created-By', 'Harsh Kumar');
  next();
});
app.use(express.json({ limit: '1mb' }));

// Ensure DB is connected asynchronously
connectMongoDB().catch((err) => console.warn('[Vercel DB Warning]:', err.message));

['analyze', 'records', 'stats', 'catalogue', 'orders', 'system', 'labels', 'eval'].forEach((r) => {
  app.use('/api', require(`../backend/server/routes/${r}`));
});

app.use('/api', (req, res) => res.status(404).json({ error: `No such API route: ${req.method} ${req.path}` }));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[Vercel Serverless Error]:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
