// ==========================================
// LUMINA LMS — E2E TESTS: Authentication
// ==========================================
const { test, expect } = require('@playwright/test');

const CREDENTIALS = {
  admin:      { email: 'admin@gmail.com',      password: 'Temporal#123', role: 'admin' },
  profesor:   { email: 'profesor@gmail.com',   password: 'Temporal#123', role: 'teacher' },
  estudiante: { email: 'estudiante@gmail.com', password: 'Temporal#123', role: 'student' }
};

// ---------- helpers ----------
async function loginViaAPI(request, email, password) {
  const res = await request.post('/auth/login', {
    data: { email, password }
  });
  return res;
}

async function fillLoginForm(page, email, password) {
  await page.goto('/html/login.html');
  await page.waitForLoadState('domcontentloaded');
  await page.fill('#username', email);
  await page.fill('#password', password);
  await page.click('#loginBtn');
}

// ==========================================
// API TESTS — /auth/* endpoints
// ==========================================

test.describe('API: /auth/login', () => {
  test('returns 400 when body is empty', async ({ request }) => {
    const res = await request.post('/auth/login', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 401 for unknown email', async ({ request }) => {
    const res = await loginViaAPI(request, 'nobody@test.com', 'Temporal#123');
    expect(res.status()).toBe(401);
  });

  test('returns 401 for wrong password', async ({ request }) => {
    const res = await loginViaAPI(request, 'admin@gmail.com', 'wrongpassword');
    expect(res.status()).toBe(401);
  });

  for (const [name, creds] of Object.entries(CREDENTIALS)) {
    test(`returns 200 + user object for ${name}`, async ({ request }) => {
      const res = await loginViaAPI(request, creds.email, creds.password);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.user.email).toBe(creds.email);
      expect(body.user.role).toBe(creds.role);
      expect(typeof body.token).toBe('string');
      expect(body.user).not.toHaveProperty('passwordHash');
    });
  }
});

test.describe('API: /auth/check', () => {
  test('returns authenticated:false when no session', async ({ request }) => {
    const res = await request.get('/auth/check');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });
});

test.describe('API: /auth/logout', () => {
  test('POST /auth/logout always returns 200', async ({ request }) => {
    const res = await request.post('/auth/logout');
    expect(res.status()).toBe(200);
  });
});

// ==========================================
// API TESTS — /api/* protected endpoints
// ==========================================

test.describe('API: /api/* protection', () => {
  test('/api/dashboard returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/dashboard');
    expect(res.status()).toBe(401);
  });

  test('/api/courses returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/courses');
    expect(res.status()).toBe(401);
  });

  test('/api/calendar returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/calendar');
    expect(res.status()).toBe(401);
  });

  test('/api/schedule returns 401 without session', async ({ request }) => {
    const res = await request.get('/api/schedule');
    expect(res.status()).toBe(401);
  });
});

// ==========================================
// API TESTS — /api/* with valid session
// ==========================================

test.describe('API: /api/* with session', () => {
  // Each test gets its own browser context (cookie jar) so sessions are isolated
  test('/api/dashboard returns notices and stats', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: 'http://localhost:5501' });
    await ctx.request.post('/auth/login', {
      data: { email: 'estudiante@gmail.com', password: 'Temporal#123' }
    });
    const res = await ctx.request.get('/api/dashboard');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.notices)).toBe(true);
    expect(body.stats).toHaveProperty('pendingTasks');
    await ctx.close();
  });

  test('/api/courses returns array', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: 'http://localhost:5501' });
    await ctx.request.post('/auth/login', {
      data: { email: 'estudiante@gmail.com', password: 'Temporal#123' }
    });
    const res = await ctx.request.get('/api/courses');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    await ctx.close();
  });
});

// ==========================================
// UI TESTS — Login page
// ==========================================

test.describe('UI: Login page', () => {
  test('renders login form correctly', async ({ page }) => {
    await page.goto('/html/login.html');
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#loginBtn')).toBeVisible();
  });

  test('shows error for empty form submission', async ({ page }) => {
    await page.goto('/html/login.html');
    await page.click('#loginBtn');
    // HTML5 required validation prevents submission — username field stays focused
    const validity = await page.$eval('#username', el => el.validity.valueMissing);
    expect(validity).toBe(true);
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await fillLoginForm(page, 'bad@bad.com', 'badpass');
    // Wait for error alert
    await expect(page.locator('#errorAlert')).toBeVisible({ timeout: 5000 });
  });

  test('password toggle switches visibility', async ({ page }) => {
    await page.goto('/html/login.html');
    expect(await page.getAttribute('#password', 'type')).toBe('password');
    await page.click('#passwordToggle');
    expect(await page.getAttribute('#password', 'type')).toBe('text');
    await page.click('#passwordToggle');
    expect(await page.getAttribute('#password', 'type')).toBe('password');
  });

  test('Google login button shows demo-mode message', async ({ page }) => {
    await page.goto('/html/login.html');
    await page.click('#googleLogin');
    await expect(page.locator('#errorAlert')).toBeVisible({ timeout: 3000 });
    const text = await page.locator('#errorMessage').textContent();
    expect(text).toContain('demo');
  });

  test('GitHub login button shows demo-mode message', async ({ page }) => {
    await page.goto('/html/login.html');
    await page.click('#githubLogin');
    await expect(page.locator('#errorAlert')).toBeVisible({ timeout: 3000 });
    const text = await page.locator('#errorMessage').textContent();
    expect(text).toContain('demo');
  });
});
