const mongoose = require('mongoose');

const idempotencySchema = mongoose.Schema({
  key: { type: String, required: true },
  scope: { type: String, required: true },
  requestHash: { type: String, required: true },
  status: { type: String, enum: ['pending', 'complete'], default: 'pending' },
  responseStatus: Number,
  responseBody: mongoose.Schema.Types.Mixed,
  leaseExpiresAt: Date,
  expiresAt: { type: Date, required: true, expires: 0 },
});

idempotencySchema.index({ scope: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Idempotency', idempotencySchema);
