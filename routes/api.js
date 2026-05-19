const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/database');

const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES   = ['admin', 'teacher', 'student'];
const VALID_STATUS  = ['active', 'inactive'];

// ── Auth middleware ──────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (req.session.user) return next();
  res.status(401).json({ error: 'Acceso no autorizado' });
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Acceso no autorizado' });
  if (!roles.includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Permiso insuficiente' });
  }
  next();
};

router.use(requireAuth);

// ── Dashboard ────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const user = req.session.user;

  const pendingTasks = db.prepare(`
    SELECT COUNT(*) AS n FROM enrollments e
    JOIN progress p ON p.user_id = e.user_id AND p.course_id = e.course_id
    WHERE e.user_id = ? AND p.pct < 100
  `).get(user.id)?.n ?? 0;

  const enrolledCourses = db.prepare(
    'SELECT COUNT(*) AS n FROM enrollments WHERE user_id = ?'
  ).get(user.id)?.n ?? 0;

  res.json({
    notices: [
      { type: 'warning', title: 'Recordatorio', message: 'Fecha límite para entrega de proyectos finales: 15 de Diciembre' },
      { type: 'info',    title: 'Nuevo',        message: 'Ya está disponible el calendario de exámenes finales' }
    ],
    stats: {
      pendingTasks,
      enrolledCourses,
      newAnnouncements: 6,
      upcomingExams: 2,
      availableResources: 15
    }
  });
});

// ── Courses ──────────────────────────────────────────────────────
router.get('/courses', (req, res) => {
  const db   = getDb();
  const user = req.session.user;

  const rows = db.prepare(`
    SELECT
      c.id, c.title, c.description, c.category, c.level, c.duration_h, c.price,
      u.name AS teacher_name,
      COALESCE(p.pct, 0) AS progress,
      CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END AS enrolled
    FROM courses c
    LEFT JOIN users u        ON u.id = c.teacher_id
    LEFT JOIN enrollments e  ON e.course_id = c.id AND e.user_id = ?
    LEFT JOIN progress p     ON p.course_id = c.id AND p.user_id = ?
    WHERE c.status = 'published'
    ORDER BY c.id
  `).all(user.id, user.id);

  res.json(rows);
});

// ── Single course ─────────────────────────────────────────────────
router.get('/courses/:id', (req, res) => {
  const db  = getDb();
  const row = db.prepare(`
    SELECT c.*, u.name AS teacher_name
    FROM courses c LEFT JOIN users u ON u.id = c.teacher_id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Curso no encontrado' });
  res.json(row);
});

// ── Progress ──────────────────────────────────────────────────────
router.patch('/progress/:courseId', (req, res) => {
  const db   = getDb();
  const user = req.session.user;
  const pct  = Math.min(100, Math.max(0, parseInt(req.body.pct ?? 0)));

  db.prepare(`
    INSERT INTO progress (user_id, course_id, pct, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, course_id) DO UPDATE SET pct = excluded.pct, updated_at = excluded.updated_at
  `).run(user.id, req.params.courseId, pct);

  if (pct === 100) {
    db.prepare('INSERT INTO activity_log (user_id, action, detail) VALUES (?, ?, ?)')
      .run(user.id, 'complete', `Completó curso #${req.params.courseId}`);
  }

  res.json({ success: true, pct });
});

// ── Enroll ────────────────────────────────────────────────────────
router.post('/enroll/:courseId', (req, res) => {
  const db   = getDb();
  const user = req.session.user;
  try {
    db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)').run(user.id, req.params.courseId);
    db.prepare('INSERT INTO activity_log (user_id, action, detail) VALUES (?, ?, ?)')
      .run(user.id, 'enroll', `Inscripción en curso #${req.params.courseId}`);
    res.json({ success: true });
  } catch {
    res.status(409).json({ error: 'Ya estás inscrito en este curso' });
  }
});

// ── Calendar ──────────────────────────────────────────────────────
router.get('/calendar', (_req, res) => {
  res.json([
    { date: '2025-06-15', title: 'Inicio de Clases',      type: 'academic'   },
    { date: '2025-06-20', title: 'Examen Matemáticas',     type: 'exam'       },
    { date: '2025-06-25', title: 'Entrega Proyecto Web',   type: 'assignment' }
  ]);
});

// ── Schedule ──────────────────────────────────────────────────────
router.get('/schedule', (_req, res) => {
  res.json([
    { time: '08:00–09:30', monday: 'Matemáticas',   tuesday: '',             wednesday: 'Matemáticas', thursday: '',             friday: 'Lab Math'     },
    { time: '09:30–11:00', monday: '',              tuesday: 'Programación', wednesday: '',            thursday: 'Programación', friday: 'Programación' }
  ]);
});

// ── Admin: user CRUD ──────────────────────────────────────────────
router.get('/users', requireRole('admin'), (req, res) => {
  const db   = getDb();
  const rows = db.prepare(`
    SELECT id, name, email, role, status, created_at FROM users ORDER BY id
  `).all();
  res.json(rows);
});

router.post('/users', requireRole('admin'), async (req, res) => {
  const { name, email, password, role = 'student' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email y password son requeridos' });
  if (typeof name !== 'string' || name.trim().length < 2) return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Formato de email inválido' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}` });

  const db   = getDb();
  const hash = await require('bcryptjs').hash(password, 10);
  try {
    const info = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(name, email.toLowerCase(), hash, role);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch {
    res.status(409).json({ error: 'El email ya existe' });
  }
});

router.patch('/users/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { name, role, status } = req.body;
  if (role   && !VALID_ROLES.includes(role))     return res.status(400).json({ error: `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}` });
  if (status && !VALID_STATUS.includes(status))  return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${VALID_STATUS.join(', ')}` });
  if (name   && (typeof name !== 'string' || name.trim().length < 2)) return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (name)   db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.params.id);
  if (role)   db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (status) db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);

  res.json({ success: true });
});

router.delete('/users/:id', requireRole('admin'), (req, res) => {
  const db   = getDb();
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ success: true });
});

// ── Admin: stats ──────────────────────────────────────────────────
router.get('/stats', requireRole('admin'), (req, res) => {
  const db = getDb();

  const totalUsers       = db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'active'").get().n;
  const totalCourses     = db.prepare("SELECT COUNT(*) AS n FROM courses WHERE status = 'published'").get().n;
  const totalEnrollments = db.prepare('SELECT COUNT(*) AS n FROM enrollments').get().n;

  const byRole = db.prepare(`
    SELECT role, COUNT(*) AS n FROM users WHERE status = 'active' GROUP BY role
  `).all().reduce((acc, r) => { acc[r.role] = r.n; return acc; }, {});

  const avgProgress = db.prepare('SELECT AVG(pct) AS avg FROM progress').get().avg ?? 0;

  const recentActivity = db.prepare(`
    SELECT a.action, a.detail, a.created_at, u.name AS user_name
    FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT 10
  `).all();

  res.json({
    totalUsers,
    totalCourses,
    totalEnrollments,
    byRole,
    avgProgress: Math.round(avgProgress),
    recentActivity
  });
});

// ── Activity log (admin) ──────────────────────────────────────────
router.get('/activity', requireRole('admin'), (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT a.id, a.action, a.detail, a.created_at, u.name AS user_name, u.role AS user_role
    FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT 50
  `).all();
  res.json(rows);
});

module.exports = router;
