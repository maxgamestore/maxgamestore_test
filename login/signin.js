// ============================================================
//  CONFIG
// ============================================================
const SERVER_URL = "https://trimmer-chrome-landfall.ngrok-free.dev";
const API = SERVER_URL + "/api";

// ============================================================
//  STATE
// ============================================================
let currentDeviceId = generateDeviceId();
let currentUsername = "";
let currentEmail = "";

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
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
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
document.addEventListener('DOMContentLoaded', () => {
    initSigninForm();
    initOTPInputs();
    initOTPButtons();
});

// ============================================================
//  SIGNIN FORM
// ============================================================
function initSigninForm() {
    const form = document.getElementById('signin-form');
    if (!form) return;

    // Password strength
    const passwordInput = document.getElementById('signin-password');
    if (passwordInput) {
        passwordInput.addEventListener('input', updatePasswordStrength);
    }

    // Confirm password
    const confirmInput = document.getElementById('signin-confirm');
    if (confirmInput) {
        confirmInput.addEventListener('input', () => {
            const hint = document.getElementById('confirm-hint');
            const password = document.getElementById('signin-password').value;
            const confirm = confirmInput.value;

            if (!confirm) {
                hint.textContent = '';
                hint.className = 'form-hint';
                return;
            }

            if (password === confirm) {
                hint.textContent = '✓ Passwords match';
                hint.className = 'form-hint success';
            } else {
                hint.textContent = "✗ Passwords don't match";
                hint.className = 'form-hint error';
            }
        });
    }

    // Username
    const usernameInput = document.getElementById('signin-username');
    if (usernameInput) {
        usernameInput.addEventListener('input', () => {
            const hint = document.getElementById('username-hint');
            const val = usernameInput.value.trim();

            if (!val) {
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
                hint.textContent = '✓ Valid username';
                hint.className = 'form-hint success';
            }
        });
    }

    // Email
    const emailInput = document.getElementById('signin-email');
    if (emailInput) {
        emailInput.addEventListener('input', () => {
            const hint = document.getElementById('email-hint');
            const val = emailInput.value.trim();

            if (!val) {
                hint.textContent = '';
                hint.className = 'form-hint';
                return;
            }

            if (!val.includes('@') || !val.includes('.')) {
                hint.textContent = 'Invalid email';
                hint.className = 'form-hint error';
            } else {
                hint.textContent = '✓ Valid email';
                hint.className = 'form-hint success';
            }
        });
    }

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('signin-username').value.trim();
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;
        const confirm = document.getElementById('signin-confirm').value;
        const errorEl = document.getElementById('signin-error');
        const btn = document.getElementById('signin-btn');

        errorEl.textContent = '';

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
                currentUsername = username;
                currentEmail = email;
                showOtpView(email);
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
//  OTP VIEW
// ============================================================
function showOtpView(email) {
    document.getElementById('signup-view').classList.add('hidden');
    document.getElementById('otp-view').classList.remove('hidden');
    document.getElementById('otp-email').textContent = email;
    document.querySelector('.otp-digit')?.focus();
}

// ============================================================
//  OTP INPUTS
// ============================================================
function initOTPInputs() {
    const inputs = document.querySelectorAll('.otp-digit');

    inputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;

            if (!/^\d*$/.test(val)) {
                e.target.value = '';
                return;
            }

            if (val.length === 1) {
                input.classList.add('filled');
                if (idx < inputs.length - 1) {
                    inputs[idx + 1].focus();
                }
            } else {
                input.classList.remove('filled');
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                inputs[idx - 1].focus();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            const digits = paste.replace(/\D/g, '').slice(0, 6);

            digits.split('').forEach((digit, i) => {
                if (inputs[i]) {
                    inputs[i].value = digit;
                    inputs[i].classList.add('filled');
                }
            });

            if (digits.length > 0) {
                inputs[Math.min(digits.length, 5)].focus();
            }
        });
    });
}

// ============================================================
//  OTP BUTTONS
// ============================================================
function initOTPButtons() {
    const verifyBtn = document.getElementById('otp-verify-btn');
    const resendLink = document.getElementById('otp-resend');
    const errorEl = document.getElementById('otp-error');

    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const inputs = document.querySelectorAll('.otp-digit');
            const code = Array.from(inputs).map(i => i.value).join('');

            if (code.length !== 6) {
                errorEl.textContent = 'Enter the complete 6-digit code!';
                return;
            }

            errorEl.textContent = '';
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'VERIFYING...';

            try {
                const res = await fetchWithTimeout(API + '/verify-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUsername,
                        code: code
                    })
                });
                const data = await res.json();

                if (data.success) {
                    // Cod corect → afișează verified view
                    showVerifiedView(currentUsername);
                    // Auto-login + redirect la main
                    setTimeout(() => autoLoginAndRedirect(), 2000);
                } else {
                    errorEl.textContent = data.error || 'Invalid code!';
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'VERIFY';

                    // Shake OTP card
                    const card = document.querySelector('.otp-card');
                    card.classList.add('shake');
                    setTimeout(() => card.classList.remove('shake'), 500);

                    // Clear inputs
                    inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
                    inputs[0].focus();
                }
            } catch (err) {
                console.error(err);
                errorEl.textContent = 'Server error. Try again.';
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'VERIFY';
            }
        });
    }

    if (resendLink) {
        resendLink.addEventListener('click', async (e) => {
            e.preventDefault();

            try {
                const res = await fetchWithTimeout(API + '/resend-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUsername })
                });
                const data = await res.json();

                if (data.success) {
                    alert('✅ New code sent to your email!');
                } else {
                    alert('❌ Error: ' + (data.error || 'Unknown'));
                }
            } catch (err) {
                alert('❌ Server error');
            }
        });
    }
}

// ============================================================
//  VERIFIED VIEW
// ============================================================
function showVerifiedView(username) {
    document.getElementById('otp-view').classList.add('hidden');
    document.getElementById('verified-view').classList.remove('hidden');
    document.getElementById('verified-username').textContent = username;
}

// ============================================================
//  AUTO LOGIN + REDIRECT
// ============================================================
async function autoLoginAndRedirect() {
    try {
        const res = await fetchWithTimeout(API + '/auto-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUsername,
                deviceId: currentDeviceId
            })
        });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem('wof_session', JSON.stringify({
                username: data.username,
                token: data.token,
                sessionId: data.sessionId,
                rank: data.rank,
                email: data.email,
                luna: data.luna,
                lits: data.lits
            }));

            window.location.href = '../main/main.html';
        } else {
            window.location.href = 'login.html';
        }
    } catch (err) {
        console.error('Auto-login failed:', err);
        window.location.href = 'login.html';
    }
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
