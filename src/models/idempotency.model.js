const mongoose = require('mongoose');

const idempotencySchema = mongoose.Schema({
  key: { type: String, required: true, unique: true },
  requestHash: { type: String, required: true },
  status: { type: String, enum: ['pending', 'complete'], default: 'pending' },
  responseStatus: Number,
  responseBody: mongoose.Schema.Types.Mixed,
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model('Idempotency', idempotencySchema);
