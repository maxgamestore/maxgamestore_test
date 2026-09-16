
// ============================================================
//  CONFIG
// ============================================================
const SERVER_URL = "https://trimmer-chrome-landfall.ngrok-free.dev";
const API = SERVER_URL + "/api";
const LANG_PATH = "../assets/languages";

// ============================================================
//  STATE
// ============================================================
let currentDeviceId = generateDeviceId();
let currentLang = "en";
let translations = {};
let supportedLanguages = [];
let imageInterval = null;
let imageIndex = 0;
let imagesList = [];

// ============================================================
//  DEVICE ID
// ============================================================
function generateDeviceId() {
    let id = localStorage.getItem('wof_device_id');
    if (!id) {
        id = 'web-' + Math.random().toString(36).substring(2, 15) +
             Math.random().toString(36).substring(2, 15);
        localStorage.setItem('wof_device_id', id);
    }
    return id;
}

// ============================================================
//  FETCH WITH TIMEOUT
// ============================================================
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ============================================================
//  LANGUAGE SYSTEM
// ============================================================
async function initLanguage() {
    try {
        const res = await fetch(`${LANG_PATH}/languages.json`);
        const data = await res.json();
        supportedLanguages = data.supported;
        
        let lang = localStorage.getItem('wof_language');
        if (!lang) {
            const browserLang = (navigator.language || 'en').split('-')[0].toLowerCase();
            const isSupported = supportedLanguages.some(l => l.code === browserLang);
            lang = isSupported ? browserLang : (data.default || 'en');
        }
        
        await setLanguage(lang);
        populateLanguageDropdown();
        setupLanguageButton();
    } catch (err) {
        console.error('Language init failed:', err);
    }
}

async function setLanguage(code) {
    try {
        currentLang = code;
        localStorage.setItem('wof_language', code);
        
        const res = await fetch(`${LANG_PATH}/${code}.json`);
        translations = await res.json();
        
        applyTranslations();
        updateLanguageButton();
    } catch (err) {
        console.error('Failed to load language:', code, err);
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const value = getNestedValue(translations, key);
        if (value) el.textContent = value;
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const value = getNestedValue(translations, key);
        if (value) el.placeholder = value;
    });
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, key) => acc && acc[key], obj);
}

function populateLanguageDropdown() {
    const dropdown = document.getElementById('lang-dropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '';
    
    supportedLanguages.forEach(lang => {
        const option = document.createElement('div');
        option.className = 'lang-option';
        if (lang.code === currentLang) option.classList.add('active');
        
        option.innerHTML = `
            <span class="lang-option-flag">${lang.flag}</span>
            <span class="lang-option-name">${lang.name}</span>
            <span class="lang-option-code">${lang.code.toUpperCase()}</span>
        `;
        
        option.addEventListener('click', async () => {
            await setLanguage(lang.code);
            populateLanguageDropdown();
            closeLanguageDropdown();
        });
        
        dropdown.appendChild(option);
    });
}

function setupLanguageButton() {
    const btn = document.getElementById('lang-btn');
    const dropdown = document.getElementById('lang-dropdown');
    if (!btn || !dropdown) return;
    
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdown.classList.contains('hidden')) {
            dropdown.classList.remove('hidden');
            btn.classList.add('open');
        } else {
            closeLanguageDropdown();
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.language-selector')) closeLanguageDropdown();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLanguageDropdown();
    });
}

function closeLanguageDropdown() {
    const dropdown = document.getElementById('lang-dropdown');
    const btn = document.getElementById('lang-btn');
    if (dropdown) dropdown.classList.add('hidden');
    if (btn) btn.classList.remove('open');
}

function updateLanguageButton() {
    const lang = supportedLanguages.find(l => l.code === currentLang);
    if (!lang) return;
    
    const flagEl = document.getElementById('lang-flag');
    const codeEl = document.getElementById('lang-code');
    
    if (flagEl) flagEl.textContent = lang.flag;
    if (codeEl) codeEl.textContent = lang.code.toUpperCase();
}

// ============================================================
//  PASSWORD VALIDATION
// ============================================================
function isValidPassword(password) {
    // Minim 8 caractere, 1 majusculă, 1 cifră, 1 simbol
    return password.length >= 8 &&
           /[A-Z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password);
}

function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)) score++;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
}

function updatePasswordStrength() {
    const password = document.getElementById('signin-password').value;
    const bar = document.getElementById('strength-bar');
    const hint = document.getElementById('password-hint');
    
    if (!bar) return;
    
    bar.className = 'strength-bar';
    
    if (password.length === 0) {
        bar.style.width = '0';
        hint.textContent = '';
        hint.className = 'form-hint';
        return;
    }
    
    const strength = getPasswordStrength(password);
    bar.classList.add(strength);
    
    if (isValidPassword(password)) {
        hint.textContent = '✓ Password is strong';
        hint.className = 'form-hint success';
    } else {
        hint.textContent = 'Must have: 8+ chars, 1 uppercase, 1 number, 1 symbol';
        hint.className = 'form-hint error';
    }
}

// ============================================================
//  IMAGE SLIDESHOW
// ============================================================
function startImageSlideshow() {
    fetch('images/images.json')
        .then(r => r.json())
        .then(data => {
            imagesList = data.images || [];
            if (imagesList.length === 0) return;
            loadImages();
            startSlideInterval();
        })
        .catch(() => {
            console.log('No images, using purple background');
        });
}

function loadImages() {
    const container = document.getElementById('signin-image-side');
    if (!container) return;
    
    imagesList.forEach((img) => {
        const div = document.createElement('div');
        div.className = 'bg-image';
        div.style.backgroundImage = `url('images/${img}')`;
        container.insertBefore(div, container.firstChild);
    });
    const firstImg = container.querySelector('.bg-image');
    if (firstImg) firstImg.classList.add('active');
}

function startSlideInterval() {
    const container = document.getElementById('signin-image-side');
    if (!container) return;

    imageInterval = setInterval(() => {
        const imgs = container.querySelectorAll('.bg-image');
        if (imgs.length === 0) return;

        imgs[imageIndex].classList.remove('active');
        imageIndex = (imageIndex + 1) % imgs.length;
        imgs[imageIndex].classList.add('active');
    }, 4000);
}

// ============================================================
//  FORM SUBMIT
// ============================================================
function initSigninForm() {
    const form = document.getElementById('signin-form');
    if (!form) return;

    // Live password strength
    const passwordInput = document.getElementById('signin-password');
    if (passwordInput) {
        passwordInput.addEventListener('input', updatePasswordStrength);
    }

    // Live username check
    const usernameInput = document.getElementById('signin-username');
    if (usernameInput) {
        usernameInput.addEventListener('input', () => {
            const hint = document.getElementById('username-hint');
            const val = usernameInput.value.trim();
            
            if (val.length === 0) {
                hint.textContent = '';
                hint.className = 'form-hint';
                return;
            }
            
            if (val.length < 3) {
                hint.textContent = 'Too short (min 3)';
                hint.className = 'form-hint error';
            } else if (val.length > 24) {
                hint.textContent = 'Too long (max 24)';
                hint.className = 'form-hint error';
            } else if (!/^[a-zA-Z0-9_]+$/.test(val)) {
                hint.textContent = 'Only letters, numbers, _';
                hint.className = 'form-hint error';
            } else {
                hint.textContent = '✓ Available';
                hint.className = 'form-hint success';
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('signin-username').value.trim();
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;
        const confirm = document.getElementById('signin-confirm').value;
        const errorEl = document.getElementById('signin-error');
        const btn = document.getElementById('signin-btn');

        errorEl.textContent = '';

        // Validări
        if (username.length < 3 || username.length > 24) {
            errorEl.textContent = getNestedValue(translations, 'signin.error_username') || 'Username: 3-24 characters';
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            errorEl.textContent = 'Username: only letters, numbers, _';
            return;
        }
        if (!email || !email.includes('@')) {
            errorEl.textContent = getNestedValue(translations, 'signin.error_email') || 'Email is required';
            return;
        }
        if (!isValidPassword(password)) {
            errorEl.textContent = getNestedValue(translations, 'signin.error_password') || 'Password: minimum 8 characters, 1 uppercase, 1 number, 1 symbol';
            return;
        }
        if (password !== confirm) {
            errorEl.textContent = getNestedValue(translations, 'signin.error_confirm') || "Passwords don't match";
            return;
        }

        btn.disabled = true;
        btn.textContent = '...';

        try {
            const res = await fetchWithTimeout(API + '/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email, deviceId: currentDeviceId })
            });
            const data = await res.json();

            if (data.success) {
                // Salvează username + email pentru verify
                sessionStorage.setItem('wof_pending_user', JSON.stringify({
                    username: username,
                    email: email
                }));

                // Redirect la login (care are verify inline)
                alert('Account created! Check your email for verification code.');
                window.location.href = 'login.html';

            } else {
                btn.disabled = false;
                btn.textContent = getNestedValue(translations, 'signin.signin_btn') || 'CREATE ACCOUNT';
                errorEl.textContent = data.error || 'Registration failed';

                form.classList.add('shake');
                setTimeout(() => form.classList.remove('shake'), 500);
            }
        } catch (err) {
            console.error(err);
            errorEl.textContent = err.name === 'AbortError'
                ? 'Server not responding'
                : (getNestedValue(translations, 'signin.error_server') || 'Server connection error');
            btn.disabled = false;
            btn.textContent = getNestedValue(translations, 'signin.signin_btn') || 'CREATE ACCOUNT';
        }
    });
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await initLanguage();
    initSigninForm();
    startImageSlideshow();
});

// ============================================================
//  CLEANUP
// ============================================================
window.addEventListener('beforeunload', () => {
    if (imageInterval) clearInterval(imageInterval);
});
