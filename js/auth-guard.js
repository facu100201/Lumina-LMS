// ==================== //
// AUTH GUARD - PROTECCIÓN DE RUTAS
// ==================== //

// Configuración de roles y permisos
const ROLE_CONFIG = {
    'admin@gmail.com': 'admin',
    'profesor@gmail.com': 'teacher', 
    'estudiante@gmail.com': 'student'
};

// Permisos por página
const PAGE_PERMISSIONS = {
    // Admin exclusivo
    'monitoreo.html': ['admin'],
    'admin.html':     ['admin'],
    'usuarios.html':  ['admin'],
    'reportes.html':  ['admin'],
    // Docente exclusivo
    'docente.html':   ['teacher'],
    // Todos los roles autenticados
    'index.html':          ['admin', 'teacher', 'student'],
    'profile.html':        ['admin', 'teacher', 'student'],
    'settings.html':       ['admin', 'teacher', 'student'],
    'courses.html':        ['admin', 'teacher', 'student'],
    'student-courses.html':['admin', 'teacher', 'student'],
    'calendar.html':       ['admin', 'teacher', 'student'],
    'schedule.html':       ['admin', 'teacher', 'student'],
    'blog.html':           ['admin', 'teacher', 'student'],
    'contact.html':        ['admin', 'teacher', 'student'],
    'cursos-venta.html':   ['admin', 'teacher', 'student'],
    'checkout.html':       ['admin', 'teacher', 'student'],
    'login.html':          ['admin', 'teacher', 'student'],
    'callback.html':       ['admin', 'teacher', 'student']
};

// ==================== //
// FUNCIONES DE AUTENTICACIÓN
// ==================== //

// Obtener rol del usuario basado en email
function getUserRole(user) {
    if (!user || !user.email) return 'student';
    return ROLE_CONFIG[user.email] || 'student';
}

// Verificar si el usuario tiene acceso a una página específica
function checkPageAccess(pageName) {
    const user = Auth0Service.getStoredUser();
    if (!user) {
        console.log('Usuario no autenticado');
        return false;
    }

    const userRole = getUserRole(user);
    const allowedRoles = PAGE_PERMISSIONS[pageName] || ['admin'];
    
    const hasAccess = allowedRoles.includes(userRole);
    
    console.log(`Verificando acceso a ${pageName}:`, {
        user: user.email,
        role: userRole,
        allowedRoles: allowedRoles,
        hasAccess: hasAccess
    });
    
    return hasAccess;
}

// Redirigir si no tiene acceso
function redirectIfNoAccess(pageName) {
    if (!checkPageAccess(pageName)) {
        const user = Auth0Service.getStoredUser();
        const userRole = getUserRole(user);
        
        console.log(`Acceso denegado a ${pageName} para rol ${userRole}`);
        
        // Redirigir según el rol
        switch (userRole) {
            case 'admin':
                window.location.href = '/html/monitoreo.html';
                break;
            case 'teacher':
                window.location.href = '/html/docente.html';
                break;
            case 'student':
                window.location.href = '/index.html';
                break;
            default:
                window.location.href = '/html/login.html';
        }
        
        return false;
    }
    return true;
}

// Verificar acceso en la carga de página
function checkCurrentPageAccess() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Páginas públicas que no requieren verificación
    const publicPages = ['login.html', 'callback.html'];
    if (publicPages.includes(currentPage)) {
        return true;
    }
    
    return redirectIfNoAccess(currentPage);
}

// ==================== //
// GESTIÓN DE NAVEGACIÓN
// ==================== //

// Ocultar/mostrar elementos de navegación según rol
function updateNavigationByRole() {
    const user = Auth0Service.getStoredUser();
    if (!user) return;
    
    const userRole = getUserRole(user);
    
    // Ocultar enlaces según rol
    const adminOnlyLinks = document.querySelectorAll('[data-role="admin"]');
    const teacherOnlyLinks = document.querySelectorAll('[data-role="teacher"]');
    const studentOnlyLinks = document.querySelectorAll('[data-role="student"]');
    
    // Admin links
    adminOnlyLinks.forEach(link => {
        link.style.display = userRole === 'admin' ? 'block' : 'none';
    });
    
    // Teacher links
    teacherOnlyLinks.forEach(link => {
        link.style.display = userRole === 'teacher' ? 'block' : 'none';
    });
    
    // Student links
    studentOnlyLinks.forEach(link => {
        link.style.display = userRole === 'student' ? 'block' : 'none';
    });
    
    // Actualizar texto de navegación
    updateNavigationText(userRole);
}

// Actualizar texto de navegación según rol
function updateNavigationText(userRole) {
    const navItems = document.querySelectorAll('.nav-link');
    
    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href) {
            // Personalizar texto según rol y página
            if (href.includes('admin') && userRole !== 'admin') {
                item.style.display = 'none';
            } else if (href.includes('docente') && userRole !== 'teacher') {
                item.style.display = 'none';
            }
        }
    });
}

// ==================== //
// DASHBOARD ESPECÍFICO POR ROL
// ==================== //

// Mostrar contenido específico del dashboard según rol
function displayRoleSpecificDashboard() {
    const user = Auth0Service.getStoredUser();
    if (!user) return;
    
    const userRole = getUserRole(user);
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Solo mostrar dashboard específico en index.html
    if (currentPage === 'index.html') {
        switch (userRole) {
            case 'admin':
                showAdminDashboard();
                break;
            case 'teacher':
                showTeacherDashboard();
                break;
            case 'student':
                showStudentDashboard();
                break;
        }
    }
}

// Dashboard de administrador
function showAdminDashboard() {
    const dashboardContainer = document.querySelector('.dashboard-content');
    if (!dashboardContainer) return;
    
    dashboardContainer.innerHTML = `
        <div class="admin-dashboard">
            <h2>Panel de Administración</h2>
            <div class="admin-stats">
                <div class="stat-card">
                    <i class="fas fa-users"></i>
                    <h3>Usuarios</h3>
                    <p>Gestionar usuarios del sistema</p>
                    <a href="/html/monitoreo.html" class="btn btn-primary">Ir a Monitoreo</a>
                </div>
                <div class="stat-card">
                    <i class="fas fa-chart-line"></i>
                    <h3>Estadísticas</h3>
                    <p>Ver métricas del sistema</p>
                    <a href="/html/monitoreo.html" class="btn btn-primary">Ver Estadísticas</a>
                </div>
            </div>
        </div>
    `;
}

// Dashboard de profesor
function showTeacherDashboard() {
    const dashboardContainer = document.querySelector('.dashboard-content');
    if (!dashboardContainer) return;
    
    dashboardContainer.innerHTML = `
        <div class="teacher-dashboard">
            <h2>Panel de Profesor</h2>
            <div class="teacher-actions">
                <div class="action-card">
                    <i class="fas fa-chalkboard-teacher"></i>
                    <h3>Mis Cursos</h3>
                    <p>Gestionar mis cursos</p>
                    <a href="/html/docente.html" class="btn btn-primary">Ir a Docente</a>
                </div>
                <div class="action-card">
                    <i class="fas fa-graduation-cap"></i>
                    <h3>Estudiantes</h3>
                    <p>Ver mis estudiantes</p>
                    <a href="/html/docente.html" class="btn btn-primary">Ver Estudiantes</a>
                </div>
            </div>
        </div>
    `;
}

// Dashboard de estudiante
function showStudentDashboard() {
    const dashboardContainer = document.querySelector('.dashboard-content');
    if (!dashboardContainer) return;
    
    dashboardContainer.innerHTML = `
        <div class="student-dashboard">
            <h2>Panel de Estudiante</h2>
            <div class="student-actions">
                <div class="action-card">
                    <i class="fas fa-book"></i>
                    <h3>Mis Cursos</h3>
                    <p>Ver mis cursos inscritos</p>
                    <a href="/html/student-courses.html" class="btn btn-primary">Ver Cursos</a>
                </div>
                <div class="action-card">
                    <i class="fas fa-shopping-cart"></i>
                    <h3>Comprar Cursos</h3>
                    <p>Explorar nuevos cursos</p>
                    <a href="/html/cursos-venta.html" class="btn btn-primary">Ver Cursos</a>
                </div>
            </div>
        </div>
    `;
}

// ==================== //
// INICIALIZACIÓN
// ==================== //

// Inicializar protección de rutas
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Inicializar Auth0 si no está inicializado
        if (!window.Auth0Service) {
            await Auth0Service.initialize();
        }
        
        // Verificar autenticación
        const isAuthenticated = await Auth0Service.isAuthenticated();
        
        if (!isAuthenticated) {
            // Si no está autenticado, redirigir a login
            window.location.href = '/html/login.html';
            return;
        }
        
        // Verificar acceso a la página actual
        if (!checkCurrentPageAccess()) {
            return; // Ya se hizo la redirección
        }
        
        // Actualizar navegación según rol
        updateNavigationByRole();
        
        // Mostrar dashboard específico
        displayRoleSpecificDashboard();
        
        // Mostrar información del usuario
        displayUserInfo();
        
    } catch (error) {
        console.error('Error en auth guard:', error);
        window.location.href = '/html/login.html';
    }
});

// ==================== //
// FUNCIONES DE UTILIDAD
// ==================== //

// Mostrar información del usuario
function displayUserInfo() {
    const user = Auth0Service.getStoredUser();
    if (!user) return;
    
    const userRole = getUserRole(user);
    const roleNames = {
        'admin': 'Administrador',
        'teacher': 'Profesor',
        'student': 'Estudiante'
    };
    
    // Actualizar elementos de UI con información del usuario
    const userInfoElements = document.querySelectorAll('.user-info');
    userInfoElements.forEach(element => {
        element.innerHTML = `
            <span class="user-name">${user.name || user.email}</span>
            <span class="user-role">${roleNames[userRole]}</span>
        `;
    });
}

// Función para logout
async function handleLogout() {
    try {
        await Auth0Service.logout();
    } catch (error) {
        console.error('Error en logout:', error);
        // Fallback
        localStorage.clear();
        window.location.href = '/html/login.html';
    }
}

// Exportar funciones para uso global
window.AuthGuard = {
    checkPageAccess,
    redirectIfNoAccess,
    getUserRole,
    updateNavigationByRole,
    displayRoleSpecificDashboard,
    handleLogout
}; 