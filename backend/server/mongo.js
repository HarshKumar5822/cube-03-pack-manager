'use strict';

const mongoose = require('mongoose');

let isConnected = false;

async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('[Database] MONGODB_URI not set. Operating in local file-store mode.');
    return false;
  }

  if (isConnected) return true;

  try {
    console.log('[Database] Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('[Database] ✅ Connected to MongoDB Atlas successfully.');
    return true;
  } catch (err) {
    console.warn('[Database] ⚠️ Could not connect to MongoDB Atlas:', err.message);
    console.warn('[Database] Falling back to local file-store mode.');
    return false;
  }
}

// Mongoose Schemas for Pack Manager
const RecordSchema = new mongoose.Schema({
  record_id: { type: String, required: true, unique: true },
  unit_id: { type: String, required: true },
  org_id: { type: String, required: true },
  order_id: { type: String, required: true },
  channel: String,
  order_lines: String,
  observed_in_box: String,
  agent_verdict: String,
  confidence_score: Number,
  checks: Object,
  discrepancy_types: Array,
  findings: Array,
  line_items: Array,
  photo_refs: Array,
  operator_id: String,
  operator_override: Object,
  captured_at: { type: Date, default: Date.now },
  _meta: Object,
}, { timestamps: true });

const OrderSchema = new mongoose.Schema({
  order_id: { type: String, required: true },
  unit_id: { type: String, required: true },
  org_id: { type: String, required: true },
  channel: String,
  order_lines: String,
  status: String,
  record_id: String,
  created_at: { type: Date, default: Date.now },
}, { timestamps: true });

const RecordModel = mongoose.models.Record || mongoose.model('Record', RecordSchema);
const OrderModel = mongoose.models.Order || mongoose.model('Order', OrderSchema);

module.exports = {
  connectMongoDB,
  RecordModel,
  OrderModel,
  getIsConnected: () => isConnected,
};
