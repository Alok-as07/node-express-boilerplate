const crypto = require('crypto');
const httpStatus = require('http-status');
const Idempotency = require('../models/idempotency.model');
const ApiError = require('../utils/ApiError');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForCompletion = async (key, attempts = 100) => {
  if (attempts === 0) return null;
  await sleep(50);
  const record = await Idempotency.findOne({ key });
  if (!record || record.status === 'complete') return record;
  return waitForCompletion(key, attempts - 1);
};

const idempotency = async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (req.method !== 'POST' || !key) return next();
  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(req.body || {}))
    .digest('hex');
  let record;
  try {
    record = await Idempotency.create({ key, requestHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  } catch (error) {
    if (error.code !== 11000) return next(error);
    record = await Idempotency.findOne({ key });
    if (!record) return next(new ApiError(httpStatus.CONFLICT, 'Idempotency request is already processing'));
    if (record.requestHash !== requestHash)
      return next(new ApiError(httpStatus.CONFLICT, 'Idempotency key was used with a different request'));
    if (record.status !== 'complete') record = await waitForCompletion(key);
    if (!record || record.status !== 'complete')
      return next(new ApiError(httpStatus.CONFLICT, 'Idempotency request is still processing'));
    return res.status(record.responseStatus).send(record.responseBody);
  }

  const originalSend = res.send.bind(res);
  res.send = (body) => {
    const responseBody =
      typeof body === 'string'
        ? (() => {
            try {
              return JSON.parse(body);
            } catch (error) {
              return body;
            }
          })()
        : body;
    return Idempotency.updateOne(
      { _id: record._id },
      { $set: { status: 'complete', responseStatus: res.statusCode, responseBody } }
    )
      .then(() => originalSend(body))
      .catch(next);
  };
  next();
};

module.exports = idempotency;
