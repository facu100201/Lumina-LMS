// ==================== //
// GLASSMORPHISM LOGIN JS WITH AUTH0
// ==================== //

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const buttonLoader = document.getElementById('buttonLoader');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('username');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const loginCard = document.querySelector('.login-card');
    const inputs = document.querySelectorAll('.field-input');
    const googleLoginBtn = document.getElementById('googleLogin');
    const githubLoginBtn = document.getElementById('githubLogin');
    const signupLink = document.getElementById('signupLink');

    // Initialize
    initAuth0();
    initAnimations();
    initEventListeners();

    // ==================== //
    // AUTH0 INITIALIZATION
    // ==================== //

    async function initAuth0() {
        try {
            await Auth0Service.initialize();

            // Check if user is already authenticated
            const isAuthenticated = await Auth0Service.isAuthenticated();
            if (isAuthenticated) {
                const user = await Auth0Service.getUser();
                console.log('Usuario autenticado:', user);
                Auth0Service.redirectToDashboard();
            }

        } catch (error) {
            console.error('Error inicializando Auth0:', error);
            showError('Error al inicializar la autenticación');
        }
    }

    // ==================== //
    // INITIALIZATION
    // ==================== //

    function initAnimations() {
        animateParticles();
    }

    function initEventListeners() {
        // Form submission
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        // Password toggle
        if (passwordToggle) {
            passwordToggle.addEventListener('click', togglePasswordVisibility);
        }

        // Input focus effects
        inputs.forEach(input => {
            input.addEventListener('focus', handleInputFocus);
            input.addEventListener('blur', handleInputBlur);
            input.addEventListener('input', handleInputChange);
        });

        // Social login buttons
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', (e) => handleSocialLogin(e, 'google-oauth2'));
        }

        if (githubLoginBtn) {
            githubLoginBtn.addEventListener('click', (e) => handleSocialLogin(e, 'github'));
        }

        // Remember me checkbox
        if (rememberMeCheckbox) {
            rememberMeCheckbox.addEventListener('change', handleRememberMe);
        }

        // Signup link
        if (signupLink) {
            signupLink.addEventListener('click', handleSignup);
        }
    }

    // ==================== //
    // ANIMATIONS
    // ==================== //

    function animateParticles() {
        const particles = document.querySelectorAll('.login-particle');
        particles.forEach((particle, index) => {
            particle.style.animationDelay = `${index * -2}s`;
            particle.style.animationDuration = `${12 + Math.random() * 8}s`;
        });
    }

    function handleInputFocus() {}
    function handleInputBlur() {}
    function handleInputChange() {}

    // ==================== //
    // PASSWORD TOGGLE
    // ==================== //

    function togglePasswordVisibility() {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        
        const icon = passwordToggle.querySelector('i');
        icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        
        // Add animation
        passwordToggle.style.transform = 'scale(1.2)';
        setTimeout(() => {
            passwordToggle.style.transform = 'scale(1)';
        }, 200);
    }

    // ==================== //
    // LOGIN HANDLING
    // ==================== //

    async function handleLogin(e) {
        e.preventDefault();
        
        setLoading(true);
        hideError();

        const formData = new FormData(loginForm);
        const username = formData.get('username');
        const password = formData.get('password');
        const rememberMe = formData.get('rememberMe') === 'on';

        // Validate inputs
        if (!validateInputs(username, password)) {
            setLoading(false);
            return;
        }

        try {
            // Use Auth0 service
            await Auth0Service.loginWithPassword(username, password);

            // If successful, get user info
            const user = await Auth0Service.getUser();
            console.log('Login exitoso:', user);
            
            // Store user info
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('authToken', await Auth0Service.getToken());
            
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
            }
            
            showSuccess();
            setTimeout(() => {
                Auth0Service.redirectToDashboard();
            }, 1500);
            
        } catch (error) {
            console.error('Login error:', error);
            showError('Credenciales inválidas. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    }

    function validateInputs(username, password) {
        if (!username || username.trim().length < 3) {
            showError('El nombre de usuario debe tener al menos 3 caracteres.');
            shakeElement(usernameInput);
            return false;
        }
        
        if (!password || password.length < 6) {
            showError('La contraseña debe tener al menos 6 caracteres.');
            shakeElement(passwordInput);
            return false;
        }
        
        return true;
    }

    // ==================== //
    // SOCIAL LOGIN
    // ==================== //

    async function handleSocialLogin(e, connection) {
        const btn = e.currentTarget;
        const originalHTML = btn.innerHTML;

        btn.style.transform = 'scale(0.95)';
        setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);

        try {
            btn.innerHTML = '<div class="spinner"></div>';
            btn.disabled = true;
            await Auth0Service.loginWithSocial(connection);
        } catch (error) {
            // En modo demo local el login social no está disponible — mostrar aviso amigable
            showError('Login social no disponible en modo demo. Usa email + contraseña.');
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }

    // ==================== //
    // SIGNUP
    // ==================== //

    async function handleSignup(e) {
        e.preventDefault();
        try {
            await Auth0Service.signup();
        } catch (error) {
            showError('Registro externo no disponible en modo demo. Usa las credenciales de prueba.');
        }
    }

    // ==================== //
    // REMEMBER ME
    // ==================== //

    function handleRememberMe(e) {
        const isChecked = e.target.checked;
        
        // Add animation
        const checkmark = e.target.nextElementSibling;
        if (isChecked) {
            checkmark.style.transform = 'scale(1.2)';
            setTimeout(() => {
                checkmark.style.transform = 'scale(1)';
            }, 200);
        }
        
        // Store preference
        localStorage.setItem('rememberMe', isChecked);
    }

    // ==================== //
    // UTILITY FUNCTIONS
    // ==================== //

    // Utility function removed - using Auth0Service instead

    function setLoading(loading) {
        if (loading) {
            loginBtn.disabled = true;
            if (buttonLoader) buttonLoader.classList.add('show');
        } else {
            loginBtn.disabled = false;
            if (buttonLoader) buttonLoader.classList.remove('show');
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorAlert.classList.add('show');
        shakeElement(loginCard);
        setTimeout(() => { hideError(); }, 5000);
    }

    function showSuccess() {
        // Create success notification
        const successNotification = document.createElement('div');
        successNotification.className = 'success-notification';
        successNotification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>¡Login exitoso! Redirigiendo...</span>
        `;
        
        document.body.appendChild(successNotification);
        
        // Add entrance animation
        setTimeout(() => {
            successNotification.classList.add('show');
        }, 100);
        
        // Remove after animation
        setTimeout(() => {
            successNotification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(successNotification);
            }, 300);
        }, 2000);
    }

    function hideError() {
        errorAlert.classList.remove('show');
    }

    function shakeElement(element) {
        element.style.animation = 'errorShake 0.5s ease-in-out';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }
});

// ==================== //
// ADDITIONAL CSS FOR SUCCESS NOTIFICATION
// ==================== //

const style = document.createElement('style');
style.textContent = `
    .success-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1e3a8a, #3b82f6);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(30, 58, 138, 0.4);
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        z-index: 1000;
    }
    
    .success-notification.show {
        transform: translateX(0);
    }
    
    .success-notification i {
        font-size: 20px;
    }
    
    .input-container.has-content .input-icon {
        color: #3b82f6;
    }
`;
document.head.appendChild(style);