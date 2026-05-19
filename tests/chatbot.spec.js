// ==========================================
// LUMINA LMS — E2E TESTS: Chatbot API
// ==========================================
const { test, expect } = require('@playwright/test');

test.describe('API: /chatbot/*', () => {
  test('GET /chatbot/api/test returns status success', async ({ request }) => {
    const res = await request.get('/chatbot/api/test');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
  });

  test('POST /chatbot/chat requires message field', async ({ request }) => {
    const res = await request.post('/chatbot/chat', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  const cases = [
    { msg: 'cursos',    role: 'guest',      expectKey: 'Cursos' },
    { msg: 'cursos',    role: 'estudiante', expectKey: 'Cursos' },
    { msg: 'blog',      role: 'guest',      expectKey: 'Blog' },
    { msg: 'contacto',  role: 'guest',      expectKey: 'Contacto' },
    { msg: 'calendario',role: 'estudiante', expectKey: 'Calendario' },
    { msg: 'pago',      role: 'guest',      expectKey: 'Pago' },
    { msg: 'perfil',    role: 'estudiante', expectKey: 'Perfil' },
    { msg: 'registro',  role: 'guest',      expectKey: 'Crear Cuenta' },
    { msg: 'inicio',    role: 'admin',      expectKey: 'Dashboard' },
  ];

  for (const { msg, role, expectKey } of cases) {
    test(`responds to "${msg}" as ${role} and mentions "${expectKey}"`, async ({ request }) => {
      const res = await request.post('/chatbot/chat', {
        data: { message: msg, currentPage: '/', userRole: role, chatHistory: [] }
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(typeof body.response).toBe('string');
      expect(body.response.length).toBeGreaterThan(20);
      expect(body.response).toContain(expectKey);
    });
  }

  test('returns a generic response for unknown input', async ({ request }) => {
    const res = await request.post('/chatbot/chat', {
      data: {
        message: 'xyzzy gibberish',
        currentPage: '/',
        userRole: 'guest',
        chatHistory: []
      }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.response).toBe('string');
    expect(body.response.length).toBeGreaterThan(10);
  });

  test('GET /chatbot/api/site-info returns site structure', async ({ request }) => {
    const res = await request.get('/chatbot/api/site-info');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('site');
    expect(body).toHaveProperty('pages');
    expect(body).toHaveProperty('navigation');
    expect(body).toHaveProperty('roles');
  });
});
