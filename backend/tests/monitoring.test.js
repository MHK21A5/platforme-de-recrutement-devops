const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { version } = require('../package.json');
const {
  registry,
  normalizeRoute,
  metricsMiddleware,
} = require('../monitoring/metrics');

test('custom application metrics are registered', () => {
  for (const name of [
    'http_requests_total',
    'http_request_duration_seconds',
    'http_requests_in_flight',
    'recruitment_backend_info',
  ]) {
    assert.ok(registry.getSingleMetric(name), `${name} is registered`);
  }
});

test('registry output is compatible with the metrics endpoint', async () => {
  const output = await registry.metrics();
  for (const name of [
    'http_requests_total',
    'http_request_duration_seconds',
    'http_requests_in_flight',
    'recruitment_backend_info',
  ]) {
    assert.match(output, new RegExp(`# (?:HELP|TYPE) ${name}\\b`));
  }
  assert.ok(output.includes(`recruitment_backend_info{service="recruitment-backend",version="${version}"} 1`));
  assert.match(output, /process_resident_memory_bytes/);
});

test('route labels preserve Express patterns without dynamic identifiers', () => {
  assert.equal(normalizeRoute({ baseUrl: '/api/jobs', route: { path: '/:id' } }), '/api/jobs/:id');
  assert.equal(normalizeRoute({ baseUrl: '', route: { path: '/health' } }), '/health');
  assert.equal(normalizeRoute({ baseUrl: '/api/jobs/68fc123abc456', route: { path: '/:id' } }), 'unmatched');
  assert.equal(normalizeRoute({ originalUrl: '/api/jobs/68fc123abc456?email=private@example.com' }), 'unmatched');
});

test('middleware records one finished request and clears the in-flight gauge', async () => {
  const req = { method: 'GET', baseUrl: '/api/jobs', route: { path: '/:id' } };
  const res = new EventEmitter();
  res.statusCode = 200;
  let nextCalls = 0;

  metricsMiddleware(req, res, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  res.emit('finish');
  res.emit('close');

  const output = await registry.metrics();
  assert.match(output, /http_requests_total\{method="GET",route="\/api\/jobs\/:id",status_code="200"\} 1/);
  assert.match(output, /http_request_duration_seconds_count\{method="GET",route="\/api\/jobs\/:id",status_code="200"\} 1/);
  assert.match(output, /http_requests_in_flight 0/);
});
