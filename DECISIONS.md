# Architecture Decision Records — Lumina LMS

Five decisions that shaped the system. Each record explains the context,
the options considered, what we chose, and — most importantly — why.

---

## ADR-001 · Session-based auth + JWT side-by-side

**Context**  
The app needs protected routes on the server (Express static files guarded
by `requireAuth`) *and* client-side page guards (JS that checks identity
before rendering a dashboard). Two different enforcement points.

**Options considered**

| Option | Pros | Cons |
|---|---|---|
| Session only | Simple, cookie automatic, no localStorage | Can't verify identity client-side without an extra round-trip |
| JWT only | Stateless, portable | Requires every static-file route to validate the token; logout is hard (can't invalidate a JWT without a blocklist) |
| Both | Session guards server routes; JWT used by client-side JS | Slight duplication |

**Decision**  
Use both: `express-session` creates a server-side cookie on login — this
guards `/` and `/index.html` at the Express layer without any JS parsing.
The same login response issues a JWT stored in `localStorage` — this lets
`auth-guard.js` verify the user's role synchronously on every page without
an extra fetch.

**Why this matters**  
Logout is clean: destroying the session invalidates the server guard
immediately. The JWT has a 24h expiry and is cleared from localStorage
on logout. No blocklist needed for a local-demo lifetime.

---

## ADR-002 · SQLite with better-sqlite3, not Postgres or an ORM

**Context**  
The project constraint is *zero external services* — no Docker, no cloud
database, no environment variables required. It must `git clone → npm install → node server.js` in one step.

**Options considered**

| Option | Why rejected |
|---|---|
| PostgreSQL | Requires a running DB server; not zero-config |
| MongoDB | Same — requires mongod process |
| Sequelize / Prisma ORM | Adds migration tooling, 50 MB+ deps, abstraction that obscures SQL from CV reviewers |
| better-sqlite3 (sync API) | Single file, ships as a native addon, runs in-process |

**Decision**  
`better-sqlite3` with raw SQL, WAL journal mode, and foreign keys ON.
The sync API eliminates promise chains in route handlers and simplifies
error handling — a SQLite write either commits or throws, with no
in-flight async to reason about.

**Trade-off acknowledged**  
SQLite serialises writes — not suitable for > ~100 concurrent writers.
For a production LMS we'd migrate to Postgres. The schema is deliberately
PostgreSQL-compatible (no SQLite-specific types used) so the migration
is a driver swap + minor dialect fixes.

---

## ADR-003 · Custom CSS design system instead of Tailwind or Bootstrap

**Context**  
Early versions used Bootstrap 5.3. The admin panel (`admin.html`,
`monitoreo.html`) needed a design that looks like a professional internal
tool — dark, dense, data-forward — which fights Bootstrap's defaults.

**Options considered**

| Option | Result |
|---|---|
| Bootstrap 5 | Constant overrides; specificity battles; final output is 80% !important |
| Tailwind CSS | Good result but adds a build step (PostCSS) — breaks the zero-build constraint |
| Custom CSS tokens | Full control; no build step; readable source |

**Decision**  
A hand-written design system with CSS custom properties:

```css
--bg: #09090b; --surface: #111113; --card: #18181b;
--border: rgba(255,255,255,.07); --accent: #6366f1;
--sidebar-w: 240px; --top-h: 56px;
```

Shared-border KPI grids use `gap:1px; background:var(--border)` — the
parent's background bleeds through gaps, creating hairline dividers without
a single `border` declaration on child cells. This pattern avoids
double-borders and works at any screen width.

**Why this matters for the CV**  
A reviewer who opens DevTools and sees clean, token-driven CSS with zero
`!important` gets a signal: this developer understands the cascade.

---

## ADR-004 · SSE instead of WebSockets for the live metrics dashboard

**Context**  
`monitoreo.html` needs to display CPU, RAM, and activity feed that updates
every 2 seconds. The data flow is strictly server → browser.

**Options considered**

| Option | Pros | Cons |
|---|---|---|
| Polling (setInterval + fetch) | Simple | Each poll is a full HTTP request; resource usage linear with clients |
| WebSockets | Bidirectional, low latency | Requires protocol upgrade, custom ping/pong, manual reconnect logic |
| Server-Sent Events | HTTP/1.1, auto-reconnect, browser-managed, EventSource API | One-directional only |

**Decision**  
Server-Sent Events via `GET /api/metrics/stream`. The server broadcasts
a JSON snapshot every 2 s to all connected `EventSource` clients using
chunked encoding. No library needed — `res.write('data: ...\n\n')` is the
full protocol.

Auto-reconnect is built into the browser's `EventSource` spec. The client
has three lines of reconnect handling for the status indicator; the rest is
handled by the platform.

**Why this matters**  
SSE survives HTTP/1.1 proxies and load balancers without header negotiation.
For a read-only dashboard it is strictly simpler than WebSockets. Choosing
the *right* tool over the *trendy* tool is a signal interviewers look for.

---

## ADR-005 · Role permissions as a data-driven map, not hardcoded if-chains

**Context**  
The first implementation of `auth-guard.js` used a series of `if (page ===
'admin.html' && role !== 'admin') redirect()` calls — O(n) checks and a
maintenance nightmare every time a page was added.

**Options considered**

- Keep if-chains — fast to write, hard to audit
- Move permissions to the database — correct long-term, overkill for local demo
- Flat map object in `auth-guard.js` — single source of truth, readable, no DB round-trip

**Decision**  
A `PAGE_PERMISSIONS` object maps every HTML filename to the array of roles
allowed to load it:

```js
const PAGE_PERMISSIONS = {
  'admin.html':     ['admin'],
  'usuarios.html':  ['admin'],
  'reportes.html':  ['admin'],
  'docente.html':   ['teacher'],
  'courses.html':   ['admin', 'teacher', 'student'],
  // …
};
```

The guard does a single `PAGE_PERMISSIONS[pageName]` lookup — O(1), auditable
in one scroll, and easy to extend. Adding a new page is one line.

The server mirrors this at the API layer with a `requireRole(...roles)`
middleware factory that reads `req.session.user.role` and compares against
the allowed list — same pattern, enforced server-side where it actually
matters for security.

**Why this matters**  
In a real product, this map would live in a database table so ops can change
permissions without a redeploy. The local-demo version deliberately shows
the *pattern* — a reviewer who asks "how would you scale this?" gets a clear
answer: the map becomes a DB query, the guard stays unchanged.
