const crypto = require('crypto');
const httpStatus = require('http-status');
const Idempotency = require('../models/idempotency.model');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const PROCESSING_LEASE_MS = 30 * 1000;
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 50;
const POLL_ATTEMPTS = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

const getScope = (req) => {
  const authorization = req.get('Authorization');
  const caller = authorization ? `authorization:${authorization}` : `ip:${req.ip}`;
  return hash(caller);
};

const parseBody = (body) => {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch (error) {
    return body;
  }
};

const containsCredential = (value) => {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => {
    if (/^(access|refresh|reset|verification)?token$/i.test(key)) return true;
    return containsCredential(child);
  });
};

/* eslint-disable no-await-in-loop */
const waitForCompletion = async (scope, key) => {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const record = await Idempotency.findOne({ scope, key });
    if (!record || record.status === 'complete') return record;

    if (!record.leaseExpiresAt || record.leaseExpiresAt <= new Date()) {
      const reclaimed = await Idempotency.findOneAndUpdate(
        {
          _id: record._id,
          status: 'pending',
          $or: [{ leaseExpiresAt: { $lte: new Date() } }, { leaseExpiresAt: { $exists: false } }],
        },
        { $set: { leaseExpiresAt: new Date(Date.now() + PROCESSING_LEASE_MS) } },
        { new: true }
      );
      if (reclaimed) return { ...reclaimed.toObject(), claimed: true };
    }
  }
  return null;
};
/* eslint-enable no-await-in-loop */

const idempotency = async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (req.method !== 'POST' || !key) return next();
  const scope = getScope(req);
  const requestHash = hash(`${req.method} ${req.originalUrl}\n${JSON.stringify(req.body || {})}`);
  let record;
  try {
    record = await Idempotency.create({
      key,
      scope,
      requestHash,
      leaseExpiresAt: new Date(Date.now() + PROCESSING_LEASE_MS),
      expiresAt: new Date(Date.now() + RECORD_TTL_MS),
    });
  } catch (error) {
    if (error.code !== 11000) return next(error);
    record = await Idempotency.findOne({ scope, key });
    if (!record) return next(new ApiError(httpStatus.CONFLICT, 'Idempotency request is already processing'));
    if (record.requestHash !== requestHash)
      return next(new ApiError(httpStatus.CONFLICT, 'Idempotency key was used with a different request'));
    if (record.status !== 'complete') record = await waitForCompletion(scope, key);
    if (!record || (record.status !== 'complete' && !record.claimed))
      return next(new ApiError(httpStatus.CONFLICT, 'Idempotency request is still processing'));
    if (record.status === 'complete') return res.status(record.responseStatus).send(record.responseBody);
  }

  const originalSend = res.send.bind(res);
  res.send = (body) => {
    const responseBody = parseBody(body);
    const shouldCache = res.statusCode < 400 && !containsCredential(responseBody);
    const persistResponse = shouldCache
      ? Idempotency.updateOne(
          { _id: record._id, status: 'pending' },
          { $set: { status: 'complete', responseStatus: res.statusCode, responseBody }, $unset: { leaseExpiresAt: 1 } }
        )
      : Idempotency.deleteOne({ _id: record._id });

    return persistResponse
      .catch((error) => {
        logger.error('Failed to persist idempotency response: %s', error.message);
        return Idempotency.deleteOne({ _id: record._id }).catch((deleteError) => {
          logger.error('Failed to remove incomplete idempotency record: %s', deleteError.message);
        });
      })
      .then(() => originalSend(body));
  };
  return next();
};

module.exports = idempotency;
