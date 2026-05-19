// ==================== //
// AUTH CONFIGURATION — LOCAL DEMO MODE
// Auth0 SDK se intenta inicializar; si falla (sin internet / sin config)
// se usa autenticación local que llama al backend Express.
// ==================== //

const AUTH0_CONFIG = {
    domain: 'dev-t817winxdvcgqv2e.us.auth0.com',
    clientId: 'zMmhbQWa6CGsTiW4zDen7clOLcMdEhYN',
    redirectUri: window.location.origin + '/html/callback.html',
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
    scope: 'openid profile email'
};

// Credenciales de prueba para demo local (mismo password que routes/auth.js)
const TEST_CREDENTIALS = {
    'admin@gmail.com':      'Temporal#123',
    'profesor@gmail.com':   'Temporal#123',
    'estudiante@gmail.com': 'Temporal#123'
};

let auth0 = null;

// ==================== //
// BACKEND SESSION LOGIN
// Llama a /auth/login para crear sesión Express (requerida por app.js y /api/*)
// ==================== //

async function loginWithBackend(email, password) {
    const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Credenciales inválidas');
    }

    return response.json(); // { success, user, token }
}

// ==================== //
// LOCAL AUTHENTICATION
// ==================== //

async function loginWithPasswordLocal(username, password) {
    console.log('Login local con:', username);

    if (!TEST_CREDENTIALS[username] || TEST_CREDENTIALS[username] !== password) {
        throw new Error('Credenciales inválidas');
    }

    // Establecer sesión en el servidor Express
    const data = await loginWithBackend(username, password);

    const user = data.user;
    const token = data.token;

    // Persistir en localStorage para uso inmediato en UI
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('authToken', token);

    console.log('Autenticado:', user);
    return user;
}

function getRoleFromEmail(email) {
    if (email === 'admin@gmail.com')      return 'admin';
    if (email === 'profesor@gmail.com')   return 'teacher';
    if (email === 'estudiante@gmail.com') return 'student';
    return 'student';
}

// ==================== //
// AUTH0 INITIALIZATION
// ==================== //

async function initializeAuth0() {
    try {
        if (typeof createAuth0Client !== 'undefined') {
            auth0 = await createAuth0Client(AUTH0_CONFIG);
            console.log('Auth0 inicializado');
        } else {
            console.log('Auth0 SDK no disponible — modo local activo');
        }
    } catch (error) {
        console.warn('Auth0 no disponible, usando autenticación local:', error.message);
        auth0 = null;
    }
    return auth0;
}

// ==================== //
// AUTHENTICATION FUNCTIONS
// ==================== //

async function loginWithPassword(username, password) {
    // Auth0 primero (si está disponible)
    if (auth0) {
        try {
            return await auth0.loginWithPassword({
                username,
                password,
                realm: 'Username-Password-Authentication'
            });
        } catch (auth0Error) {
            console.warn('Auth0 falló, intentando local:', auth0Error.message);
        }
    }
    return loginWithPasswordLocal(username, password);
}

async function loginWithSocial(connection) {
    if (auth0) {
        try {
            return await auth0.loginWithRedirect({
                connection,
                redirect_uri: AUTH0_CONFIG.redirectUri
            });
        } catch (error) {
            console.warn('Login social Auth0 falló:', error.message);
        }
    }
    throw new Error('Login social no disponible en modo demo local');
}

async function signup() {
    if (auth0) {
        try {
            return await auth0.loginWithRedirect({
                screen_hint: 'signup',
                redirect_uri: AUTH0_CONFIG.redirectUri
            });
        } catch (error) {
            console.warn('Signup Auth0 falló:', error.message);
        }
    }
    throw new Error('Registro no disponible en modo demo local');
}

async function logout() {
    // Limpiar localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');

    // Destruir sesión en el servidor
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (_) { /* silencioso */ }

    if (auth0) {
        try {
            await auth0.logout({
                logoutParams: { returnTo: window.location.origin + '/html/login.html' }
            });
            return;
        } catch (error) {
            console.warn('Logout Auth0 falló:', error.message);
        }
    }

    window.location.href = '/html/login.html';
}

async function isAuthenticated() {
    if (auth0) {
        try {
            return await auth0.isAuthenticated();
        } catch (_) { /* fallthrough */ }
    }
    const user  = getStoredUser();
    const token = getStoredToken();
    return !!(user && token);
}

async function getUser() {
    if (auth0) {
        try {
            return await auth0.getUser();
        } catch (_) { /* fallthrough */ }
    }
    return getStoredUser();
}

async function getToken() {
    if (auth0) {
        try {
            return await auth0.getTokenSilently();
        } catch (_) { /* fallthrough */ }
    }
    return getStoredToken();
}

// ==================== //
// SESSION HELPERS
// ==================== //

function getStoredUser()  {
    try {
        const s = localStorage.getItem('user');
        return s ? JSON.parse(s) : null;
    } catch (_) { return null; }
}

function getStoredToken() { return localStorage.getItem('authToken'); }

function isRememberMeEnabled() { return localStorage.getItem('rememberMe') === 'true'; }

// ==================== //
// NAVIGATION HELPERS
// ==================== //

function redirectToLogin()    { window.location.href = '/html/login.html'; }

function redirectToDashboard() {
    const user = getStoredUser();
    if (!user) { window.location.href = '/index.html'; return; }

    const role = user.role || getRoleFromEmail(user.email);
    switch (role) {
        case 'admin':   window.location.href = '/html/monitoreo.html'; break;
        case 'teacher': window.location.href = '/html/docente.html';   break;
        default:        window.location.href = '/index.html';           break;
    }
}

// ==================== //
// EXPORT
// ==================== //

window.Auth0Service = {
    initialize: initializeAuth0,
    loginWithPassword,
    loginWithSocial,
    signup,
    logout,
    isAuthenticated,
    getUser,
    getToken,
    getStoredUser,
    getStoredToken,
    isRememberMeEnabled,
    redirectToLogin,
    redirectToDashboard
};
