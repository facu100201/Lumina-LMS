const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const chatbotRoutes = require('./routes/chatbot');

const app = express();
const PORT = process.env.PORT || 5501;

// Security headers — CSP allows Bootstrap/FontAwesome CDN + Google Fonts used by the UI
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://cdn.auth0.com"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}));

// CORS — restrict to localhost only for local-only pre-deployment
const allowedOrigins = [
  'http://localhost:5501',
  'http://127.0.0.1:5501'
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin fetch, curl, Playwright)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origin not allowed'));
    }
  },
  credentials: true
}));

// Auth routes: stricter rate limit (20 attempts / 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos. Intenta en 15 minutos.' }
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions — deterministic strong secret for local demo (no external env var needed)
app.use(session({
  secret: process.env.SESSION_SECRET || 'lumina-lms-local-dev-secret-2024-x7k9p',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Static files — serve assets from their canonical locations
app.use('/js',         express.static(path.join(__dirname, 'js')));
app.use('/styles',     express.static(path.join(__dirname, 'styles')));
app.use('/components', express.static(path.join(__dirname, 'components')));
app.use('/img',        express.static(path.join(__dirname, 'img')));
app.use('/html',       express.static(path.join(__dirname, 'html')));
// Backward-compat: also keep public/ in case anything references it
app.use(express.static(path.join(__dirname, 'public')));

// Auth guard for HTML pages that require a server session
const requireAuth = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/html/login.html');
};

// API routes
app.use('/auth', authLimiter, authRoutes);
app.use('/api',  apiLimiter,  apiRoutes);
app.use('/chatbot', apiLimiter, chatbotRoutes);

// Root dashboard — protected
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Redirect /login → canonical login page
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.redirect('/html/login.html');
});

// Alias /index.html → same as /
app.get('/index.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Lumina LMS corriendo en http://localhost:${PORT}`);
});
