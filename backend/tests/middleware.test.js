const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Test-only value: no dotenv, application startup, or database connection.
const TEST_SECRET = 'middleware-tests-only-not-a-production-secret';
let originalSecret;

before(() => {
  originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_SECRET;
});

after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

function createResponse() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('authMiddleware rejects a missing Authorization token', () => {
  const req = { headers: {} };
  const res = createResponse();

  let nextCalls = 0;
  authMiddleware(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 0);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: 'No token, access denied' });
  assert.equal(req.user, undefined);
});

test('authMiddleware rejects a malformed Authorization header', () => {
  const req = { headers: { authorization: 'Basic invalid-credentials' } };
  const res = createResponse();

  let nextCalls = 0;
  authMiddleware(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 0);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: 'No token, access denied' });
  assert.equal(req.user, undefined);
});

test('authMiddleware rejects an invalid JWT', () => {
  const req = { headers: { authorization: 'Bearer invalid.jwt.token' } };
  const res = createResponse();

  let nextCalls = 0;
  authMiddleware(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 0);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: 'Invalid token' });
  assert.equal(req.user, undefined);
});

test('authMiddleware accepts a valid JWT and exposes the decoded user', () => {
  const token = jwt.sign({ id: 'test-user-id', role: 'recruiter' }, TEST_SECRET, {
    expiresIn: '1m',
  });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  let nextCalls = 0;

  authMiddleware(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 1);
  assert.equal(req.user.id, 'test-user-id');
  assert.equal(req.user.role, 'recruiter');
  assert.equal(res.statusCode, undefined);
  assert.equal(res.body, undefined);
});

test('roleMiddleware allows authorized admin and recruiter roles', () => {
  const middleware = roleMiddleware(['admin', 'recruiter']);
  for (const role of ['admin', 'recruiter']) {
    const res = createResponse();
    let nextCalls = 0;

    middleware({ user: { role } }, res, () => { nextCalls += 1; });

    assert.equal(nextCalls, 1, `${role} should be authorized`);
    assert.equal(res.statusCode, undefined);
    assert.equal(res.body, undefined);
  }
});

test('roleMiddleware rejects an unauthorized candidate role', () => {
  const req = { user: { role: 'candidate' } };
  const res = createResponse();

  roleMiddleware(['admin', 'recruiter'])(req, res, () => assert.fail('next must not be called'));

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: 'Access denied' });
});
