const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'lumina.db');

let _db = null;

function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL CHECK(role IN ('admin','teacher','student')),
      status        TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT,
      teacher_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      category    TEXT    NOT NULL DEFAULT 'General',
      level       TEXT    NOT NULL DEFAULT 'Principiante',
      duration_h  INTEGER NOT NULL DEFAULT 0,
      price       INTEGER NOT NULL DEFAULT 0,
      status      TEXT    NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      enrolled_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS progress (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      pct         INTEGER NOT NULL DEFAULT 0 CHECK(pct BETWEEN 0 AND 100),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action     TEXT NOT NULL,
      detail     TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seed(db);
}

function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return; // already seeded

  const HASH_ADMIN   = bcrypt.hashSync('Temporal#123', 10);
  const HASH_TEACHER = bcrypt.hashSync('Temporal#123', 10);
  const HASH_STUDENT = bcrypt.hashSync('Temporal#123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
  `);

  const users = db.transaction(() => {
    insertUser.run('Administrador',    'admin@gmail.com',      HASH_ADMIN,   'admin');
    insertUser.run('Dr. Ana García',   'profesor@gmail.com',   HASH_TEACHER, 'teacher');
    insertUser.run('Juan Pérez',       'estudiante@gmail.com', HASH_STUDENT, 'student');
    insertUser.run('Carlos Mendoza',   'carlos@usb.edu',       bcrypt.hashSync('Temporal#123', 10), 'teacher');
    insertUser.run('Sofía Ramírez',    'sofia@usb.edu',        bcrypt.hashSync('Temporal#123', 10), 'student');
    insertUser.run('Miguel López',     'miguel@usb.edu',       bcrypt.hashSync('Temporal#123', 10), 'student');
    insertUser.run('Valentina Cruz',   'val@usb.edu',          bcrypt.hashSync('Temporal#123', 10), 'student');
    insertUser.run('Daniela Ríos',     'daniela@usb.edu',      bcrypt.hashSync('Temporal#123', 10), 'teacher');
  });
  users();

  const teacherId  = db.prepare("SELECT id FROM users WHERE email = 'profesor@gmail.com'").get().id;
  const carlos     = db.prepare("SELECT id FROM users WHERE email = 'carlos@usb.edu'").get().id;
  const daniela    = db.prepare("SELECT id FROM users WHERE email = 'daniela@usb.edu'").get().id;
  const studentId  = db.prepare("SELECT id FROM users WHERE email = 'estudiante@gmail.com'").get().id;
  const sofiaId    = db.prepare("SELECT id FROM users WHERE email = 'sofia@usb.edu'").get().id;
  const miguelId   = db.prepare("SELECT id FROM users WHERE email = 'miguel@usb.edu'").get().id;
  const valId      = db.prepare("SELECT id FROM users WHERE email = 'val@usb.edu'").get().id;

  const insertCourse = db.prepare(`
    INSERT INTO courses (title, description, teacher_id, category, level, duration_h, price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const courses = db.transaction(() => {
    insertCourse.run('Introducción a la Programación',  'Fundamentos de lógica y Python', carlos,    'Tecnología', 'Principiante',   40, 299);
    insertCourse.run('Matemáticas Avanzadas',            'Cálculo, álgebra lineal',        teacherId, 'Ciencias',   'Avanzado',       60, 399);
    insertCourse.run('Diseño UI/UX Fundamentos',         'Principios de diseño digital',   daniela,   'Diseño',     'Principiante',   35, 249);
    insertCourse.run('Marketing Digital',                'SEO, SEM, redes sociales',       teacherId, 'Negocios',   'Intermedio',     30, 349);
    insertCourse.run('Bases de Datos Relacionales',      'SQL, modelado, normalización',   carlos,    'Tecnología', 'Intermedio',     45, 299);
    insertCourse.run('Inglés para Negocios',             'Vocabulario y redacción B2',      daniela,   'Idiomas',    'Intermedio',     50, 199);
  });
  courses();

  const c1 = db.prepare("SELECT id FROM courses WHERE title = 'Introducción a la Programación'").get().id;
  const c2 = db.prepare("SELECT id FROM courses WHERE title = 'Matemáticas Avanzadas'").get().id;
  const c3 = db.prepare("SELECT id FROM courses WHERE title = 'Diseño UI/UX Fundamentos'").get().id;
  const c4 = db.prepare("SELECT id FROM courses WHERE title = 'Marketing Digital'").get().id;

  const insertEnroll   = db.prepare('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)');
  const insertProgress = db.prepare('INSERT OR IGNORE INTO progress (user_id, course_id, pct) VALUES (?, ?, ?)');

  const enroll = db.transaction(() => {
    insertEnroll.run(studentId, c1); insertProgress.run(studentId, c1, 72);
    insertEnroll.run(studentId, c2); insertProgress.run(studentId, c2, 45);
    insertEnroll.run(studentId, c3); insertProgress.run(studentId, c3, 90);
    insertEnroll.run(sofiaId,   c1); insertProgress.run(sofiaId,   c1, 60);
    insertEnroll.run(sofiaId,   c4); insertProgress.run(sofiaId,   c4, 30);
    insertEnroll.run(miguelId,  c2); insertProgress.run(miguelId,  c2, 20);
    insertEnroll.run(valId,     c3); insertProgress.run(valId,     c3, 55);
    insertEnroll.run(valId,     c4); insertProgress.run(valId,     c4, 80);
  });
  enroll();

  const insertLog = db.prepare(`
    INSERT INTO activity_log (user_id, action, detail) VALUES (?, ?, ?)
  `);
  const logs = db.transaction(() => {
    insertLog.run(studentId, 'login',    'Inicio de sesión');
    insertLog.run(studentId, 'enroll',   'Inscripción en Introducción a la Programación');
    insertLog.run(sofiaId,   'progress', 'Completó módulo 3 de Marketing Digital');
    insertLog.run(miguelId,  'login',    'Inicio de sesión');
  });
  logs();

  console.log('[DB] Base de datos inicializada con datos demo.');
}

module.exports = { getDb };
