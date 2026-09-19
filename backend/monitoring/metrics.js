const client = require('prom-client');
const { version } = require('../package.json');

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const metricOptions = { registers: [registry] };
const requestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Completed HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  ...metricOptions,
});
const requestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ...metricOptions,
});
const requestsInFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'HTTP requests currently being processed',
  ...metricOptions,
});
const backendInfo = new client.Gauge({
  name: 'recruitment_backend_info',
  help: 'Backend service and package version information',
  labelNames: ['service', 'version'],
  ...metricOptions,
});
backendInfo.set({ service: 'recruitment-backend', version }, 1);

// Only known, static router mounts are used. Express route patterns retain :params.
const knownMounts = new Set([
  '', '/api', '/api/users', '/api/interviews', '/api/jobs',
  '/api/applications', '/api/notifications', '/api/google',
]);
const knownMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

function normalizeRoute(req) {
  const mount = req.baseUrl || '';
  const route = req.route && req.route.path;
  if (!knownMounts.has(mount) || typeof route !== 'string' ||
      !/^\/[A-Za-z0-9_:/.-]*$/.test(route)) {
    return 'unmatched';
  }
  return `${mount}${route}`.replace(/\/$/, '') || '/';
}

function metricsMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  requestsInFlight.inc();
  let finished = false;

  res.once('finish', () => {
    if (finished) return;
    finished = true;
    requestsInFlight.dec();
    const labels = {
      method: knownMethods.has(req.method) ? req.method : 'OTHER',
      route: normalizeRoute(req),
      status_code: String(res.statusCode),
    };
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    requestCounter.inc(labels);
    requestDuration.observe(labels, seconds);
  });
  res.once('close', () => {
    if (!finished) {
      finished = true;
      requestsInFlight.dec();
    }
  });
  next();
}

module.exports = {
  registry,
  requestCounter,
  requestDuration,
  requestsInFlight,
  backendInfo,
  normalizeRoute,
  metricsMiddleware,
};
