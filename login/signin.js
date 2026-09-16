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
let verificationCheckInterval = null;

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
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await initLanguage();
    startImageSlideshow();
    
    // Verifică dacă vine din link de verificare
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');
    const user = params.get('user');
    
    if (verified === 'true' && user) {
        // User a verificat contul — auto-login
        await handleVerifiedArrival(user);
    } else {
        // Afișează form-ul normal
        initSigninForm();
    }
});

// ============================================================
//  HANDLE VERIFIED ARRIVAL
// ============================================================
async function handleVerifiedArrival(username) {
    // Ascunde form-ul, arată verified view
    document.getElementById('signup-view').classList.add('hidden');
    document.getElementById('verified-view').classList.remove('hidden');
    document.getElementById('verified-username').textContent = username;
    
    // Așteaptă 2 secunde (pentru efect vizual), apoi auto-login
    setTimeout(async () => {
        try {
            // Cere token de la server pentru user-ul verificat
            const res = await fetchWithTimeout(API + '/auto-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, deviceId: currentDeviceId })
            });
            const data = await res.json();
            
            if (data.success) {
                // Salvează sesiunea
                localStorage.setItem('wof_session', JSON.stringify({
                    username: data.username,
                    token: data.token,
                    sessionId: data.sessionId,
                    rank: data.rank,
                    email: data.email,
                    luna: data.luna,
                    lits: data.lits
                }));
                
                // Redirect la main
                window.location.href = '../main/main.html';
            } else {
                // Fallback: redirect la login
                window.location.href = 'login.html';
            }
        } catch (err) {
            console.error('Auto-login failed:', err);
            window.location.href = 'login.html';
        }
    }, 2000);
}

// ============================================================
//  SIGNIN FORM
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
            errorEl.textContent = 'Username: 3-24 characters';
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            errorEl.textContent = 'Username: only letters, numbers, _';
            return;
        }
        if (!email || !email.includes('@')) {
            errorEl.textContent = 'Email is required';
            return;
        }
        if (!isValidPassword(password)) {
            errorEl.textContent = 'Password: min 8 chars, 1 uppercase, 1 number, 1 symbol';
            return;
        }
        if (password !== confirm) {
            errorEl.textContent = "Passwords don't match";
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
                // Afișează email-sent view
                showEmailSentView(email, username);
                
                // Pornește verificarea periodică
                startVerificationCheck(username);
                
            } else {
                btn.disabled = false;
                btn.textContent = 'CREATE ACCOUNT';
                errorEl.textContent = data.error || 'Registration failed';
                form.classList.add('shake');
                setTimeout(() => form.classList.remove('shake'), 500);
            }
        } catch (err) {
            console.error(err);
            errorEl.textContent = err.name === 'AbortError'
                ? 'Server not responding'
                : 'Server connection error';
            btn.disabled = false;
            btn.textContent = 'CREATE ACCOUNT';
        }
    });
}

// ============================================================
//  EMAIL SENT VIEW
// ============================================================
function showEmailSentView(email, username) {
    document.getElementById('signup-view').classList.add('hidden');
    document.getElementById('email-sent-view').classList.remove('hidden');
    document.getElementById('sent-email').textContent = email;
    
    // Salvează username pentru verificare
    sessionStorage.setItem('wof_pending_user', username);
}

// ============================================================
//  VERIFICATION CHECK (verifică periodic dacă contul e verificat)
// ============================================================
function startVerificationCheck(username) {
    if (verificationCheckInterval) clearInterval(verificationCheckInterval);
    
    verificationCheckInterval = setInterval(async () => {
        try {
            const res = await fetch(API + '/check-verified/' + username);
            const data = await res.json();
            
            if (data.verified) {
                clearInterval(verificationCheckInterval);
                
                // Cont verificat! Afișează verified view
                document.getElementById('email-sent-view').classList.add('hidden');
                document.getElementById('verified-view').classList.remove('hidden');
                document.getElementById('verified-username').textContent = username;
                
                // Auto-login
                setTimeout(async () => {
                    try {
                        const loginRes = await fetchWithTimeout(API + '/auto-login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: username, deviceId: currentDeviceId })
                        });
                        const loginData = await loginRes.json();
                        
                        if (loginData.success) {
                            localStorage.setItem('wof_session', JSON.stringify({
                                username: loginData.username,
                                token: loginData.token,
                                sessionId: loginData.sessionId,
                                rank: loginData.rank,
                                email: loginData.email,
                                luna: loginData.luna,
                                lits: loginData.lits
                            }));
                            
                            window.location.href = '../main/main.html';
                        } else {
                            window.location.href = 'login.html';
                        }
                    } catch (err) {
                        console.error('Auto-login failed:', err);
                        window.location.href = 'login.html';
                    }
                }, 2000);
            }
        } catch (err) {
            // Ignoră erorile de rețea
        }
    }, 3000); // Verifică la fiecare 3 secunde
}

// ============================================================
//  PASSWORD VALIDATION
// ============================================================
function isValidPassword(password) {
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
        console.error('Failed to load language:', err);
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const value = getNestedValue(translations, key);
        if (value) el.textContent = value;
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
        dropdown.classList.toggle('hidden');
        btn.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.language-selector')) closeLanguageDropdown();
    });
}

function closeLanguageDropdown() {
    document.getElementById('lang-dropdown')?.classList.add('hidden');
    document.getElementById('lang-btn')?.classList.remove('open');
}

function updateLanguageButton() {
    const lang = supportedLanguages.find(l => l.code === currentLang);
    if (!lang) return;
    document.getElementById('lang-flag').textContent = lang.flag;
    document.getElementById('lang-code').textContent = lang.code.toUpperCase();
}

// ============================================================
//  CLEANUP
// ============================================================
window.addEventListener('beforeunload', () => {
    if (imageInterval) clearInterval(imageInterval);
    if (verificationCheckInterval) clearInterval(verificationCheckInterval);
});
