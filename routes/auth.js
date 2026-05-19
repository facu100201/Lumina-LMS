const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Local demo users — credentials match js/auth0-config.js TEST_CREDENTIALS
// Passwords are bcrypt hashes of 'Temporal#123' (cost factor 10)
const USERS = [
  {
    id: 1,
    email: 'admin@gmail.com',
    // hash of 'Temporal#123'
    passwordHash: '$2a$10$mESZShS9uxQihJ/ecbRZ.uQGrLpjBEXPgzbU5KOzRA8hC4biLaX12',
    name: 'Administrador',
    role: 'admin'
  },
  {
    id: 2,
    email: 'profesor@gmail.com',
    passwordHash: '$2a$10$SGAqYWFprqK2YDW2584n/ebgNKVNDKDmaGr77MlHHvYcPyobZKCeu',
    name: 'Dr. Ana García',
    role: 'teacher'
  },
  {
    id: 3,
    email: 'estudiante@gmail.com',
    passwordHash: '$2a$10$KeSB2n/Op1AV5z0jfERykO5.6z5HFBZj8y45g0vZPNPtWiPlO9Rpq',
    name: 'Juan Pérez',
    role: 'student'
  }
];

// Strong deterministic secret for local demo (no external env var needed)
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

    const user = USERS.find(u => u.email === email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const publicUser = buildPublicUser(user);

    // Create server-side session
    req.session.user = publicUser;

    // Issue JWT (used by frontend localStorage flow)
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, user: publicUser, token });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión' });
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Sesión cerrada' });
  });
});

// GET /auth/check — used by app.js on every page load
router.get('/check', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
