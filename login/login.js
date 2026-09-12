
// ============================================================
//  CONFIG
// ============================================================
const SERVER_URL = "https://trimmer-chrome-landfall.ngrok-free.dev";
const API = SERVER_URL + "/api";

// ============================================================
//  STARE GLOBALĂ
// ============================================================
let currentUser = null;
let currentToken = null;
let currentSessionId = null;
let currentDeviceId = generateDeviceId();
let otpEmail = "";
let currentStage = "login";
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
//  AUDIO HELPER
// ============================================================
function playSound(id, volume = 1.0) {
    try {
        const audio = document.getElementById(id);
        if (!audio) return;
        audio.currentTime = 0;
        audio.volume = volume;
        audio.play().catch(e => console.log('Audio error:', e));
    } catch (e) {}
}

function stopSound(id) {
    try {
        const audio = document.getElementById(id);
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    } catch (e) {}
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initLoginForm();
    initSwitchRegister();
    initOTPInputs();
    initOTPButtons();
    startImageSlideshow();
});

// ============================================================
//  STAGE SWITCHING
// ============================================================
function goToStage(stageName) {
    document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));
    const stage = document.getElementById('stage-' + stageName);
    if (stage) stage.classList.add('active');
    currentStage = stageName;
}

// ============================================================
//  IMAGINI SLIDESHOW (STAGE 1)
// ============================================================
function startImageSlideshow() {
    // Încearcă să încarce lista de imagini din images.json
    fetch('images/images.json')
        .then(r => r.json())
        .then(data => {
            imagesList = data.images || [];
            if (imagesList.length === 0) {
                // Fallback: mov
                console.log('Nu sunt imagini, folosesc fundal mov');
                return;
            }
            loadImages();
            startSlideInterval();
        })
        .catch(() => {
            console.log('Nu am găsit images.json - folosesc fundal mov');
        });
}

function loadImages() {
    const container = document.getElementById('login-image-side');
    imagesList.forEach((img, idx) => {
        const div = document.createElement('div');
        div.className = 'bg-image';
        div.style.backgroundImage = `url('images/${img}')`;
        container.insertBefore(div, container.firstChild);
    });
    // Activează prima imagine
    const firstImg = container.querySelector('.bg-image');
    if (firstImg) firstImg.classList.add('active');
}

function startSlideInterval() {
    const container = document.getElementById('login-image-side');
    if (!container) return;
    
    imageInterval = setInterval(() => {
        const imgs = container.querySelectorAll('.bg-image');
        if (imgs.length === 0) return;
        
        imgs[imageIndex].classList.remove('active');
        imageIndex = (imageIndex + 1) % imgs.length;
        imgs[imageIndex].classList.add('active');
    }, 4000); // 4 secunde per imagine
}

// ============================================================
//  LOGIN FORM
// ============================================================
function initLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        const btn = document.getElementById('login-btn');

        errorEl.textContent = '';

        // Validări client
        if (username.length < 3 || username.length > 24) {
            errorEl.textContent = 'Username: 3-24 caractere';
            return;
        }
        if (password.length < 8) {
            errorEl.textContent = 'Parola: minim 8 caractere';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'SE CONECTEAZĂ...';
        playSound('sfx-click');

        try {
            const res = await fetch(API + '/secure-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, deviceId: currentDeviceId })
            });
            const data = await res.json();

            if (data.success) {
                currentUser = data;
                currentToken = data.token;
                currentSessionId = data.sessionId;
                otpEmail = data.email || 'email@example.com';
                
                // Salvează sesiunea
                localStorage.setItem('wof_session', JSON.stringify({
                    username: data.username,
                    token: data.token,
                    sessionId: data.sessionId,
                    rank: data.rank,
                    email: data.email,
                    luna: data.luna
                }));

                // Pornește animația 1
                await playAnimation1(username, password);
                
                // Treci la verify
                goToStage('verify');
                document.getElementById('otp-email').textContent = otpEmail;
                document.querySelector('.otp-digit').focus();
                
                // Reset form
                btn.disabled = false;
                btn.textContent = 'LOGIN';

            } else {
                // Eroare - user sau parolă greșită
                btn.disabled = false;
                btn.textContent = 'LOGIN';
                
                // Mesaj eroare
                errorEl.textContent = data.error || 'Something user or password is wrong';
                playSound('sfx-error', 0.5);
                
                // Shake animation pe form
                form.classList.add('shake');
                setTimeout(() => form.classList.remove('shake'), 500);
            }
        } catch (err) {
            console.error(err);
            errorEl.textContent = 'Eroare conexiune server';
            btn.disabled = false;
            btn.textContent = 'LOGIN';
        }
    });
}

// ============================================================
//  ANIMAȚIA 1
// ============================================================
function playAnimation1(username, password) {
    return new Promise((resolve) => {
        // Ascunde form-ul
        const formSide = document.querySelector('.login-form-side');
        const imageSide = document.querySelector('.login-image-side');
        const divider = document.querySelector('.divider');
        
        // Set text pentru animație
        const anim1 = document.getElementById('anim1');
        const bar = document.getElementById('anim1-bar');
        const userEl = document.getElementById('anim1-user');
        const passEl = document.getElementById('anim1-pass');
        
        // Set text
        userEl.textContent = username;
        passEl.textContent = '••••••••';
        
        // Afișează animația
        anim1.classList.remove('hidden');
        
        // Faza 1: bara se mișcă spre dreapta
        setTimeout(() => {
            bar.classList.add('move-right');
            playSound('sfx-whoosh', 0.4);
        }, 50);
        
        // Faza 2: user + parola se rotesc
        setTimeout(() => {
            userEl.classList.add('spinning');
            passEl.classList.add('spinning');
        }, 400);
        
        // Faza 3: fade out + rezolvă
        setTimeout(() => {
            anim1.style.transition = 'opacity 0.4s';
            anim1.style.opacity = '0';
            setTimeout(() => {
                anim1.classList.add('hidden');
                anim1.style.opacity = '1';
                bar.classList.remove('move-right');
                userEl.classList.remove('spinning');
                passEl.classList.remove('spinning');
                resolve();
            }, 400);
        }, 1900);
    });
}

// ============================================================
//  SWITCH REGISTER
// ============================================================
function initSwitchRegister() {
    const link = document.getElementById('switch-register');
    if (!link) return;
    
    link.addEventListener('click', (e) => {
        e.preventDefault();
        // Momentan - alert
        alert('Register va fi disponibil în curând!');
        // SAU poți implementa register aici
    });
}

// ============================================================
//  OTP INPUTS
// ============================================================
function initOTPInputs() {
    const inputs = document.querySelectorAll('.otp-digit');
    
    inputs.forEach((input, idx) => {
        // Când tastezi
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            
            // Doar cifre
            if (!/^\d*$/.test(val)) {
                e.target.value = '';
                return;
            }
            
            if (val.length === 1) {
                input.classList.add('filled');
                // Auto-focus la următorul
                if (idx < inputs.length - 1) {
                    inputs[idx + 1].focus();
                }
            } else {
                input.classList.remove('filled');
            }
        });
        
        // Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                inputs[idx - 1].focus();
            }
        });
        
        // Paste
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
                const nextIdx = Math.min(digits.length, 5);
                inputs[nextIdx].focus();
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
    
    if (verifyBtn) {
        verifyBtn.addEventListener('click', async () => {
            const inputs = document.querySelectorAll('.otp-digit');
            const code = Array.from(inputs).map(i => i.value).join('');
            const errorEl = document.getElementById('otp-error');
            
            if (code.length !== 6) {
                errorEl.textContent = 'Introdu codul complet de 6 cifre!';
                return;
            }
            
            errorEl.textContent = '';
            verifyBtn.disabled = true;
            verifyBtn.textContent = 'SE VERIFICĂ...';
            
            try {
                const res = await fetch(API + '/verify-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUser.username,
                        code: code
                    })
                });
                const data = await res.json();
                
                if (data.success) {
                    // COD CORECT - animația 2 VERDE
                    verifyBtn.textContent = 'SUCCESS!';
                    goToStage('intro');
                    await playAnimation2(true);
                    
                    // Afișează main după animație
                    document.getElementById('main-username').textContent = currentUser.username;
                    goToStage('main');
                    
                } else {
                    // COD GREȘIT - animația 2 ROȘIE
                    errorEl.textContent = data.error || 'Cod invalid!';
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'VERIFY';
                    
                    // Animație roșie
                    goToStage('intro');
                    await playAnimation2(false);
                    
                    // Înapoi la verify
                    inputs.forEach(i => {
                        i.value = '';
                        i.classList.remove('filled');
                    });
                    goToStage('verify');
                    inputs[0].focus();
                }
            } catch (err) {
                console.error(err);
                errorEl.textContent = 'Eroare conexiune server';
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'VERIFY';
            }
        });
    }
    
    if (resendLink) {
        resendLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                const res = await fetch(API + '/resend-verification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser.username })
                });
                const data = await res.json();
                
                if (data.success) {
                    alert('Cod nou trimis pe email!');
                } else {
                    alert('Eroare: ' + (data.error || 'Unknown'));
                }
            } catch (err) {
                alert('Eroare conexiune server');
            }
        });
    }
}

// ============================================================
//  ANIMAȚIA 2 (ELECTRICITATE)
// ============================================================
function playAnimation2(isSuccess) {
    return new Promise((resolve) => {
        const electricity = document.getElementById('intro-electricity');
        const explosion = document.getElementById('intro-explosion');
        const vortex = document.getElementById('intro-vortex');
        const text = document.getElementById('intro-text');
        const container = document.querySelector('.intro-container');
        
        // Reset
        electricity.classList.remove('active', 'red');
        explosion.classList.remove('active', 'red');
        vortex.classList.remove('active');
        text.classList.remove('active');
        container.classList.remove('rotating');
        
        if (isSuccess) {
            // ===== COD CORECT - VERDE =====
            
            // Faza 1: Electricitate verde
            setTimeout(() => {
                electricity.classList.add('active');
                playSound('sfx-electric', 0.8);
            }, 300);
            
            // Faza 2: Explozie verde
            setTimeout(() => {
                stopSound('sfx-electric');
                explosion.classList.add('active');
                playSound('sfx-explosion', 1.0);
            }, 1800);
            
            // Faza 3: Vortex + rotire ecran
            setTimeout(() => {
                vortex.classList.add('active');
                container.classList.add('rotating');
                playSound('sfx-vortex', 1.0);
            }, 2600);
            
            // Faza 4: Reset + text MAXGAMESTORE
            setTimeout(() => {
                container.classList.remove('rotating');
                container.style.transform = '';
                electricity.classList.remove('active');
                explosion.classList.remove('active');
                vortex.classList.remove('active');
                
                // Text MAXGAMESTORE
                text.classList.add('active');
                playSound('sfx-electric-long', 0.6);
                
            }, 6200);
            
            // Faza 5: Final
            setTimeout(() => {
                text.classList.remove('active');
                stopSound('sfx-electric-long');
                playSound('sfx-whoosh', 0.5);
                resolve();
            }, 13500); // 7 secunde text
            
        } else {
            // ===== COD GREȘIT - ROȘU =====
            
            // Faza 1: Electricitate roșie
            setTimeout(() => {
                electricity.classList.add('active', 'red');
                playSound('sfx-electric', 0.8);
            }, 300);
            
            // Faza 2: Explozie roșie
            setTimeout(() => {
                stopSound('sfx-electric');
                explosion.classList.add('active', 'red');
                playSound('sfx-explosion', 1.0);
            }, 1800);
            
            // Faza 3: Negru + eroare
            setTimeout(() => {
                playSound('sfx-error', 0.7);
            }, 2600);
            
            // Faza 4: Final
            setTimeout(() => {
                electricity.classList.remove('active', 'red');
                explosion.classList.remove('active', 'red');
                playSound('sfx-whoosh', 0.5);
                resolve();
            }, 4200);
        }
    });
}

// ============================================================
//  SHAKE ANIMATION
// ============================================================
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
    .shake {
        animation: shake 0.4s ease-in-out;
    }
`;
document.head.appendChild(style);

// ============================================================
//  CLEANUP
// ============================================================
window.addEventListener('beforeunload', () => {
    if (imageInterval) clearInterval(imageInterval);
});
