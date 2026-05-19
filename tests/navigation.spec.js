// ==========================================
// LUMINA LMS — E2E TESTS: Navigation & Static Pages
// ==========================================
const { test, expect } = require('@playwright/test');

// ==========================================
// Static pages accessible without auth
// ==========================================
test.describe('Static pages — no auth required', () => {
  const publicPages = [
    { path: '/html/login.html',       title: /Login|Lumina/ },
    { path: '/html/blog.html',        title: /Blog|Lumina/ },
    { path: '/html/contact.html',     title: /Contacto|Contact|Lumina/ },
    { path: '/html/cursos-venta.html',title: /Cursos|Lumina/ },
  ];

  for (const { path, title } of publicPages) {
    test(`${path} loads with 200`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res.status()).toBe(200);
      await expect(page).toHaveTitle(title);
    });
  }
});

// ==========================================
// Root redirect when not authenticated
// ==========================================
test.describe('Protected routes redirect to login', () => {
  test('GET / redirects unauthenticated user to login', async ({ page }) => {
    const res = await page.goto('/');
    // Should end up on login page (direct redirect or chain)
    expect(page.url()).toContain('login');
  });

  test('GET /login redirects to login page', async ({ page }) => {
    await page.goto('/login');
    expect(page.url()).toContain('login');
  });
});

// ==========================================
// CORS headers
// ==========================================
test.describe('Security headers', () => {
  test('Content-Security-Policy header is present', async ({ request }) => {
    const res = await request.get('/html/login.html');
    const csp = res.headers()['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
  });

  test('X-Frame-Options prevents clickjacking', async ({ request }) => {
    const res = await request.get('/html/login.html');
    // Helmet sets either x-frame-options OR frame-ancestors in CSP
    const xfo = res.headers()['x-frame-options'];
    const csp = res.headers()['content-security-policy'] || '';
    expect(xfo === 'SAMEORIGIN' || xfo === 'DENY' || csp.includes('frame-ancestors')).toBeTruthy();
  });

  test('X-Content-Type-Options is set', async ({ request }) => {
    const res = await request.get('/html/login.html');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });
});

// ==========================================
// 404 handler
// ==========================================
test.describe('404 handler', () => {
  test('non-existent route returns 404 JSON', async ({ request }) => {
    const res = await request.get('/this-does-not-exist-xyz');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ==========================================
// Rate limiting (light check — don't flood)
// ==========================================
test.describe('Rate limiting on auth', () => {
  test('rate limiter responds with 429 after threshold', async ({ request }) => {
    // Auth limiter = 20 req / 15 min — fire 22 to trigger it
    let lastStatus = 200;
    for (let i = 0; i < 22; i++) {
      const res = await request.post('/auth/login', {
        data: { email: 'nobody@test.com', password: 'x' }
      });
      lastStatus = res.status();
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
