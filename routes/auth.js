const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const { getDb } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'lumina-jwt-local-dev-secret-2024-z3m8n';

function buildPublicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?')
                   .get(email.toLowerCase().trim(), 'active');

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const publicUser = buildPublicUser(user);
    req.session.user = publicUser;

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    db.prepare('INSERT INTO activity_log (user_id, action, detail) VALUES (?, ?, ?)')
      .run(user.id, 'login', `Login desde ${req.ip}`);

    res.json({ success: true, user: publicUser, token });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// GET /auth/check
router.get('/check', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
