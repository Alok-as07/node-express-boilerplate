const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { User, Idempotency } = require('../../src/models');

setupTestDB();

describe('Idempotency-Key', () => {
  const payload = () => ({
    name: faker.name.findName(),
    email: faker.internet.email().toLowerCase(),
    password: 'password1',
  });

  test('replays the saved response for a duplicate request', async () => {
    const body = payload();
    const first = await request(app)
      .post('/v1/auth/register')
      .set('Idempotency-Key', 'register-1')
      .send(body)
      .expect(httpStatus.CREATED);
    const replay = await request(app)
      .post('/v1/auth/register')
      .set('Idempotency-Key', 'register-1')
      .send(body)
      .expect(httpStatus.CREATED);
    expect(replay.body).toEqual(first.body);
    expect(await User.countDocuments({ email: body.email })).toBe(1);
  });

  test('rejects a reused key with a different request body', async () => {
    await request(app)
      .post('/v1/auth/register')
      .set('Idempotency-Key', 'register-2')
      .send(payload())
      .expect(httpStatus.CREATED);
    await request(app)
      .post('/v1/auth/register')
      .set('Idempotency-Key', 'register-2')
      .send(payload())
      .expect(httpStatus.CONFLICT);
  });

  test('serializes simultaneous requests with the same key', async () => {
    const body = payload();
    const responses = await Promise.all([
      request(app).post('/v1/auth/register').set('Idempotency-Key', 'register-3').send(body),
      request(app).post('/v1/auth/register').set('Idempotency-Key', 'register-3').send(body),
    ]);
    expect(responses.map((response) => response.status)).toEqual([httpStatus.CREATED, httpStatus.CREATED]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(await User.countDocuments({ email: body.email })).toBe(1);
    expect(await Idempotency.countDocuments({ key: 'register-3', status: 'complete' })).toBe(1);
  });
});
