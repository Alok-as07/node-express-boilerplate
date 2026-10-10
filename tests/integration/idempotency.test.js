const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const { emailService } = require('../../src/services');
const setupTestDB = require('../utils/setupTestDB');
const { Idempotency } = require('../../src/models');
const { userOne, userTwo, insertUsers } = require('../fixtures/user.fixture');

setupTestDB();

describe('Idempotency-Key', () => {
  test('replays the saved response for a duplicate request', async () => {
    await insertUsers([userOne]);
    const sendEmail = jest.spyOn(emailService, 'sendResetPasswordEmail').mockResolvedValue();
    const body = { email: userOne.email };
    const first = await request(app)
      .post('/v1/auth/forgot-password')
      .set('Idempotency-Key', 'register-1')
      .send(body)
      .expect(httpStatus.NO_CONTENT);
    const replay = await request(app)
      .post('/v1/auth/forgot-password')
      .set('Idempotency-Key', 'register-1')
      .send(body)
      .expect(httpStatus.NO_CONTENT);
    expect(replay.text).toBe(first.text);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const record = await Idempotency.findOne({ key: 'register-1' });
    expect(record.responseBody).toBeUndefined();
  });

  test('rejects a reused key with a different request body', async () => {
    await insertUsers([userOne, userTwo]);
    jest.spyOn(emailService, 'sendResetPasswordEmail').mockResolvedValue();
    await request(app)
      .post('/v1/auth/forgot-password')
      .set('Idempotency-Key', 'register-2')
      .send({ email: userOne.email })
      .expect(httpStatus.NO_CONTENT);
    await request(app)
      .post('/v1/auth/forgot-password')
      .set('Idempotency-Key', 'register-2')
      .send({ email: userTwo.email })
      .expect(httpStatus.CONFLICT);
  });

  test('serializes simultaneous requests with the same key', async () => {
    await insertUsers([userOne]);
    const sendEmail = jest.spyOn(emailService, 'sendResetPasswordEmail').mockResolvedValue();
    const body = { email: userOne.email };
    const responses = await Promise.all([
      request(app).post('/v1/auth/forgot-password').set('Idempotency-Key', 'register-3').send(body),
      request(app).post('/v1/auth/forgot-password').set('Idempotency-Key', 'register-3').send(body),
    ]);
    expect(responses.map((response) => response.status)).toEqual([httpStatus.NO_CONTENT, httpStatus.NO_CONTENT]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await Idempotency.countDocuments({ key: 'register-3', status: 'complete' })).toBe(1);
  });
});
