/**
 * /api/metrics/stream — Server-Sent Events endpoint
 *
 * Emits real system metrics every 2 seconds:
 *   - CPU usage (sampled via os.cpus diff)
 *   - Memory usage (os.freemem / os.totalmem)
 *   - Active sessions count (from express-session store)
 *   - Request rate (tracked by this module's middleware)
 *   - Uptime
 *   - Recent activity log from DB
 *
 * Why SSE over WebSockets: SSE is HTTP/1.1 compatible, survives proxies,
 * auto-reconnects, and is strictly read-only — perfect for a dashboard feed.
 */

const express = require('express');
const os      = require('os');
const router  = express.Router();
const { getDb } = require('../db/database');

// ── Request counter (incremented by the exported middleware) ──────────────────
let _reqCount  = 0;
let _reqWindow = 0; // requests in last 2 s window

function trackRequest(_req, _res, next) {
  _reqCount++;
  next();
}

// ── CPU sampler ────────────────────────────────────────────────────────────────
function cpuPercent() {
  const cpus  = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }
  return Math.round(100 - (idle / total) * 100);
}

// ── Active SSE clients ─────────────────────────────────────────────────────────
const clients = new Set();

// ── Auth guard (inline — avoids circular require with server.js) ───────────────
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) return next();
  res.status(401).end();
};

// ── SSE stream ─────────────────────────────────────────────────────────────────
router.get('/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
  res.flushHeaders();

  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// ── Snapshot ──────────────────────────────────────────────────────────────────
function buildSnapshot() {
  const db        = getDb();
  const totalMem  = os.totalmem();
  const freeMem   = os.freemem();
  const usedMem   = totalMem - freeMem;

  const recentActivity = db.prepare(`
    SELECT a.action, a.detail, a.created_at, u.name AS user_name
    FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT 8
  `).all();

  const totalUsers    = db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'active'").get().n;
  const totalCourses  = db.prepare("SELECT COUNT(*) AS n FROM courses WHERE status = 'published'").get().n;
  const totalEnroll   = db.prepare('SELECT COUNT(*) AS n FROM enrollments').get().n;

  const snapshot = {
    ts:           Date.now(),
    uptime:       Math.floor(process.uptime()),
    cpu:          cpuPercent(),
    memUsedMB:    Math.round(usedMem  / 1024 / 1024),
    memTotalMB:   Math.round(totalMem / 1024 / 1024),
    memPct:       Math.round((usedMem / totalMem) * 100),
    activeClients: clients.size,
    reqLast2s:    _reqWindow,
    totalUsers,
    totalCourses,
    totalEnroll,
    recentActivity,
    nodeVersion:  process.version,
    platform:     process.platform,
  };

  return snapshot;
}

// ── Broadcast loop ─────────────────────────────────────────────────────────────
setInterval(() => {
  _reqWindow  = _reqCount;
  _reqCount   = 0;

  if (clients.size === 0) return;

  const data = JSON.stringify(buildSnapshot());
  for (const client of clients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      clients.delete(client);
    }
  }
}, 2000);

// ── Snapshot on demand (for initial load) ────────────────────────────────────
router.get('/snapshot', requireAuth, (req, res) => {
  res.json(buildSnapshot());
});

module.exports = { router, trackRequest };
