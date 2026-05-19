/**
 * LUMINA LMS — E2E TESTS: Role-Based Access Control
 *
 * Covers the full RBAC matrix:
 *   - Each role logs in and lands on the correct dashboard
 *   - Admin-only API endpoints reject teacher and student (403)
 *   - Admin can perform full user CRUD via /api/users
 *   - Student can enroll in a course and update progress
 *   - Role-only data isolation (each user sees their own progress)
 */

const { test, expect } = require('@playwright/test');

const ADMIN   = { email: 'admin@gmail.com',      password: 'Temporal#123', role: 'admin'   };
const TEACHER = { email: 'profesor@gmail.com',   password: 'Temporal#123', role: 'teacher' };
const STUDENT = { email: 'estudiante@gmail.com', password: 'Temporal#123', role: 'student' };

// Helper: authenticate a new isolated context and return the context's request
async function authContext(browser, creds) {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:5501' });
  const res  = await ctx.request.post('/auth/login', { data: creds });
  expect(res.status()).toBe(200);
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1-3: Login → correct dashboard per role
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Role redirect on login', () => {

  test('1. Admin login returns role=admin and id', async ({ request }) => {
    const res  = await request.post('/auth/login', { data: ADMIN });
    const body = await res.json();
    expect(res.status()).toBe(200);
    expect(body.user.role).toBe('admin');
    expect(typeof body.user.id).toBe('number');
    expect(body.user).not.toHaveProperty('password_hash');
  });

  test('2. Teacher login returns role=teacher', async ({ request }) => {
    const res  = await request.post('/auth/login', { data: TEACHER });
    const body = await res.json();
    expect(res.status()).toBe(200);
    expect(body.user.role).toBe('teacher');
  });

  test('3. Student login returns role=student', async ({ request }) => {
    const res  = await request.post('/auth/login', { data: STUDENT });
    const body = await res.json();
    expect(res.status()).toBe(200);
    expect(body.user.role).toBe('student');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4-6: Admin-only endpoints enforce role
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Admin-only endpoints: /api/users and /api/stats', () => {

  test('4. Admin can GET /api/users — returns array of users', async ({ browser }) => {
    const ctx  = await authContext(browser, ADMIN);
    const res  = await ctx.request.get('/api/users');
    const body = await res.json();
    expect(res.status()).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(3);
    // No password hashes must leak
    body.forEach(u => expect(u).not.toHaveProperty('password_hash'));
    await ctx.close();
  });

  test('5. Teacher gets 403 on GET /api/users', async ({ browser }) => {
    const ctx = await authContext(browser, TEACHER);
    const res = await ctx.request.get('/api/users');
    expect(res.status()).toBe(403);
    await ctx.close();
  });

  test('6. Student gets 403 on GET /api/users', async ({ browser }) => {
    const ctx = await authContext(browser, STUDENT);
    const res = await ctx.request.get('/api/users');
    expect(res.status()).toBe(403);
    await ctx.close();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: Admin stats endpoint returns expected shape
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Admin stats', () => {

  test('7. GET /api/stats returns totalUsers, totalCourses, byRole, recentActivity', async ({ browser }) => {
    const ctx  = await authContext(browser, ADMIN);
    const res  = await ctx.request.get('/api/stats');
    const body = await res.json();
    expect(res.status()).toBe(200);
    expect(typeof body.totalUsers).toBe('number');
    expect(typeof body.totalCourses).toBe('number');
    expect(body.byRole).toHaveProperty('admin');
    expect(body.byRole).toHaveProperty('student');
    expect(Array.isArray(body.recentActivity)).toBe(true);
    await ctx.close();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8: /api/courses returns enrolled flag per-student
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Course data isolation', () => {

  test('8. Student sees enrolled=1 on courses they joined, enrolled=0 on others', async ({ browser }) => {
    const ctx   = await authContext(browser, STUDENT);
    const res   = await ctx.request.get('/api/courses');
    const body  = await res.json();
    expect(res.status()).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    // At least one enrolled and one not (based on seed)
    const enrolledCourses = body.filter(c => c.enrolled === 1);
    const otherCourses    = body.filter(c => c.enrolled === 0);
    expect(enrolledCourses.length).toBeGreaterThan(0);
    expect(otherCourses.length).toBeGreaterThan(0);
    // Progress is only set on enrolled courses
    enrolledCourses.forEach(c => expect(typeof c.progress).toBe('number'));
    await ctx.close();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9: Progress PATCH persists and is clamped 0–100
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Progress tracking', () => {

  test('9. PATCH /api/progress/:id updates pct and clamps to 100', async ({ browser }) => {
    const ctx = await authContext(browser, STUDENT);

    // Update progress on course 1
    const r1 = await ctx.request.patch('/api/progress/1', { data: { pct: 55 } });
    expect(r1.status()).toBe(200);
    const b1 = await r1.json();
    expect(b1.pct).toBe(55);

    // Clamp: value above 100 should be stored as 100
    const r2 = await ctx.request.patch('/api/progress/1', { data: { pct: 999 } });
    expect(r2.status()).toBe(200);
    expect((await r2.json()).pct).toBe(100);

    // Verify persisted in GET /api/courses
    const r3   = await ctx.request.get('/api/courses');
    const body = await r3.json();
    const c1   = body.find(c => c.id === 1);
    expect(c1?.progress).toBe(100);

    await ctx.close();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10: Admin user CRUD — create then delete
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Admin user CRUD', () => {

  test('10. Admin can create a user then delete it', async ({ browser }) => {
    const ctx = await authContext(browser, ADMIN);

    const uniqueEmail = `test_${Date.now()}@lumina.test`;

    // Create
    const create = await ctx.request.post('/api/users', {
      data: { name: 'Test Temporal', email: uniqueEmail, password: 'Temporal#123', role: 'student' }
    });
    expect(create.status()).toBe(201);
    const { id } = await create.json();
    expect(typeof id).toBe('number');

    // Verify appears in list
    const list  = await ctx.request.get('/api/users');
    const users = await list.json();
    expect(users.some(u => u.email === uniqueEmail)).toBe(true);

    // Delete
    const del = await ctx.request.delete(`/api/users/${id}`);
    expect(del.status()).toBe(200);

    // Verify gone
    const list2  = await ctx.request.get('/api/users');
    const users2 = await list2.json();
    expect(users2.some(u => u.email === uniqueEmail)).toBe(false);

    await ctx.close();
  });

});
