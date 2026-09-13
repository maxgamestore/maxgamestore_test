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
//  FX ENGINE — particule + fulgere procedurale pe <canvas>
//  (canvas-ul e creat dinamic din JS, nu există în HTML)
// ============================================================

// Creează un <canvas> full-size peste containerul dat
function createFxCanvas(container) {
    const canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    container.appendChild(canvas);

    const resize = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    canvas._resize = resize;

    return canvas;
}

function destroyFxCanvas(canvas) {
    if (!canvas) return;
    window.removeEventListener('resize', canvas._resize);
    canvas.remove();
}

// Adaugă particule noi într-o listă existentă (array simplu de obiecte)
function spawnParticles(list, x, y, count, opts = {}) {
    const {
        colors = ['#ffd700', '#ffffff'],
        speed = [2, 6],
        life = [500, 900],
        size = [1.5, 3.5],
        gravity = 0.05,
        spread = Math.PI * 2,
        angleOffset = 0
    } = opts;

    for (let i = 0; i < count; i++) {
        const angle = angleOffset + (Math.random() - 0.5) * spread;
        const spd = speed[0] + Math.random() * (speed[1] - speed[0]);
        list.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: life[0] + Math.random() * (life[1] - life[0]),
            age: 0,
            size: size[0] + Math.random() * (size[1] - size[0]),
            color: colors[Math.floor(Math.random() * colors.length)],
            gravity
        });
    }
}

// Rulează bucla de update/desenare pentru o listă de particule.
// Se oprește după `duration` ms SAU când toate particulele au murit.
function runParticleLoop(canvas, ctx, particles, duration) {
    const start = performance.now();
    let lastT = start;

    function frame(t) {
        const dt = t - lastT;
        lastT = t;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.age += dt;
            if (p.age >= p.life) {
                particles.splice(i, 1);
                continue;
            }
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;

            const lifeRatio = 1 - p.age / p.life;
            ctx.globalAlpha = Math.max(lifeRatio, 0);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        if (t - start < duration || particles.length > 0) {
            requestAnimationFrame(frame);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    requestAnimationFrame(frame);
}

// Fulger procedural (midpoint-displacement) — arată jagged & organic,
// cu ramificații ocazionale, spre deosebire de bara CSS dreaptă
function drawLightningSegment(ctx, x1, y1, x2, y2, displace, color, glow, depth = 0) {
    if (displace < 6 || depth > 6) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.shadowColor = glow;
        ctx.shadowBlur = 14;
        ctx.lineWidth = Math.max(3 - depth * 0.4, 0.6);
        ctx.stroke();

        // ramură ocazională
        if (Math.random() < 0.18 && depth < 4) {
            const bx = x2 + (Math.random() - 0.5) * 60;
            const by = y2 + (Math.random() - 0.5) * 60;
            drawLightningSegment(ctx, x2, y2, bx, by, displace * 0.5, color, glow, depth + 2);
        }
        return;
    }
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * displace;
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * displace;
    drawLightningSegment(ctx, x1, y1, mx, my, displace / 2, color, glow, depth + 1);
    drawLightningSegment(ctx, mx, my, x2, y2, displace / 2, color, glow, depth + 1);
}

// Rulează fulgere repetate dintr-o zonă de origine, pentru `duration` ms.
// Intensitatea CREȘTE progresiv spre finalul duratei (mai multe descărcări,
// mai lungi, mai dese) — se simte ca o acumulare de energie, nu un flicker
// constant. Fiecare fulger are și un miez alb suprapus (hot core) și poate
// arunca scântei la capete dacă i se dă un array de particule.
function runLightningLoop(canvas, ctx, originX, originY, duration, color = '#00ff88', glow = '#00ff88', particles = null) {
    const start = performance.now();
    let nextStrike = 0;

    function frame(t) {
        const elapsed = t - start;
        if (elapsed > duration) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        if (t >= nextStrike) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const progress = elapsed / duration; // 0 -> 1, energia crește spre final
            const strikeCount = 2 + Math.floor(progress * 5 + Math.random() * 2);

            for (let i = 0; i < strikeCount; i++) {
                const ox = originX + (Math.random() - 0.5) * 100 * progress;
                const oy = originY + (Math.random() - 0.5) * 100 * progress;
                const angle = Math.random() * Math.PI * 2;
                const len = 110 + Math.random() * (150 + progress * 140);
                const ex = ox + Math.cos(angle) * len;
                const ey = oy + Math.sin(angle) * len;

                drawLightningSegment(ctx, ox, oy, ex, ey, 42, color, glow);

                // miez alb fierbinte, suprapus peste bolțul colorat
                ctx.save();
                ctx.globalAlpha = 0.55;
                drawLightningSegment(ctx, ox, oy, ex, ey, 22, '#ffffff', '#ffffff', 3);
                ctx.restore();

                // scântei la capătul bolțului
                if (particles && Math.random() < 0.6) {
                    spawnParticles(particles, ex, ey, 3, {
                        colors: [color, '#ffffff'],
                        speed: [0.5, 2.5],
                        life: [150, 300],
                        size: [1, 2],
                        gravity: 0.02
                    });
                }
            }

            // pauza dintre descărcări scade pe măsură ce energia crește (0.14s -> 0.04s)
            const gap = 140 - progress * 100;
            nextStrike = t + gap + Math.random() * gap * 0.6;
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// Screen-shake reutilizabil (adaugă/scoate o clasă CSS)
function screenShake(el, duration = 400) {
    el.classList.add('screen-shake-active');
    setTimeout(() => el.classList.remove('screen-shake-active'), duration);
}

// Randomizează rotația/scala fulgerelor CSS statice (prin custom properties,
// ca să nu intre în conflict cu animația CSS de wiggle care le folosește),
// ca să nu arate identic de fiecare dată când rulează animația 2
function randomizeLightningBolts() {
    document.querySelectorAll('.lightning').forEach(el => {
        const rot = (Math.random() * 360 - 180).toFixed(1);
        const scaleY = (0.7 + Math.random() * 0.7).toFixed(2);
        el.style.setProperty('--rot', rot + 'deg');
        el.style.setProperty('--scaleY', scaleY);
        el.style.animationDelay = (Math.random() * 0.3).toFixed(2) + 's, ' + (Math.random() * 0.1).toFixed(2) + 's';
    });
}

// ============================================================
//  IRIS REVEAL — tranziție fluidă dintr-un punct de impact
//  (ex: UI burst-ul din anim1) direct în stage-ul următor.
// ============================================================
//
// Efectul: stage-ul țintă "crește" dintr-un cerc de rază 0 exact din
// centrul ecranului (unde a avut loc burst-ul), acoperind treptat
// ecranul. În paralel, o mască neagră din interiorul containerului
// țintă se stinge (fade), iar un element opțional (ex: cardul OTP)
// apare cu un mic "pop" de tip spring, puțin după ce cercul ajunge la el.
function revealStageFromCenter(toStageName, opts = {}) {
    return new Promise((resolve) => {
        const duration = opts.duration || 1100;
        const popSelector = opts.popSelector || null;
        const toStage = document.getElementById('stage-' + toStageName);
        if (!toStage) { resolve(); return; }

        const targetContainer =
            toStage.querySelector('.verify-container, .intro-container, .main-container, .login-container') ||
            toStage;

        // masca neagră — fundalul stage-ului "se aprinde" din negru, nu apare brusc
        const mask = document.createElement('div');
        mask.className = 'reveal-fade-mask';
        targetContainer.appendChild(mask);

        // elementul de pop (ex: cardul OTP) pornește pregătit pentru animația CSS
        let popEl = null;
        if (popSelector) {
            popEl = toStage.querySelector(popSelector);
            if (popEl) popEl.classList.remove('card-pop');
        }

        toStage.classList.add('reveal-start');
        // forțăm reflow ca tranziția clip-path să pornească efectiv de la 0%
        // eslint-disable-next-line no-unused-expressions
        toStage.offsetHeight;

        requestAnimationFrame(() => {
            toStage.classList.add('reveal-grow');
        });

        // masca se stinge cam la o treime din reveal — fundalul apare "cu fade"
        // chiar în timp ce cercul se extinde
        setTimeout(() => {
            mask.style.opacity = '0';
        }, duration * 0.3);

        // elementul central (cardul) apare cu spring, ușor după ce cercul l-a acoperit
        setTimeout(() => {
            if (popEl) popEl.classList.add('card-pop');
        }, duration * 0.45);

        setTimeout(() => {
            mask.remove();

            // finalizăm switch-ul de stage în mod normal
            toStage.classList.remove('reveal-start', 'reveal-grow');
            document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));
            toStage.classList.add('active');
            currentStage = toStageName;

            resolve();
        }, duration + 60);
    });
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
//  IMAGINI SLIDESHOW
// ============================================================
function startImageSlideshow() {
    fetch('images/images.json')
        .then(r => r.json())
        .then(data => {
            imagesList = data.images || [];
            if (imagesList.length === 0) {
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
    }, 4000);
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

                localStorage.setItem('wof_session', JSON.stringify({
                    username: data.username,
                    token: data.token,
                    sessionId: data.sessionId,
                    rank: data.rank,
                    email: data.email,
                    luna: data.luna
                }));

                // Animația 1 — se termină cu tranziția (iris reveal) direct în verify
                await playAnimation1(username, password);

                document.getElementById('otp-email').textContent = otpEmail;
                document.querySelector('.otp-digit').focus();

                btn.disabled = false;
                btn.textContent = 'LOGIN';

            } else {
                btn.disabled = false;
                btn.textContent = 'LOGIN';

                errorEl.textContent = data.error || 'Something user or password is wrong';
                playSound('sfx-error', 0.5);

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

// Constante de timing pentru animația 1 — ajustează liber aici dacă vrei
// să tragi mai mult sau mai puțin de vreo fază.
const ANIM1_TIMING = {
    barStart: 50,        // când pornește bara spre dreapta
    spinStart: 420,      // când încep user/parola să se rotească spre centru
    burstStart: 1770,    // când apare UI burst-ul din centru
    revealStart: 2050,   // când începe tranziția (iris reveal) spre verify
    revealDuration: 1150 // durata reveal-ului propriu-zis
};

// ============================================================
//  ANIMAȚIA 1 — bară + rotire spre centru + UI burst + reveal continuu
// ============================================================
//
// Spre deosebire de o variantă cu fade-out separat + schimbare bruscă de
// stage, aici UI burst-ul declanșează direct un "iris reveal": stage-ul
// de verify crește dintr-un cerc exact din punctul burst-ului, acoperind
// treptat ecranul, cu propriul fundal apărând cu fade din negru și
// cardul OTP apărând cu un mic spring — totul ca O SINGURĂ tranziție
// continuă, nu două animații lipite.
function playAnimation1(username, password) {
    return new Promise(async (resolve) => {
        const anim1 = document.getElementById('anim1');
        const bar = document.getElementById('anim1-bar');
        const userEl = document.getElementById('anim1-user');
        const passEl = document.getElementById('anim1-pass');
        const uiBurst = document.getElementById('anim1-ui-burst');

        userEl.textContent = username;
        passEl.textContent = '••••••••';

        anim1.classList.remove('hidden');
        anim1.style.opacity = '1';
        uiBurst.classList.remove('active');

        // FX: canvas de particule peste tot anim1-ul
        const canvas = createFxCanvas(anim1);
        const ctx = canvas.getContext('2d');
        const particles = [];
        runParticleLoop(canvas, ctx, particles, ANIM1_TIMING.revealStart + 1200);

        // Faza 1: bara se mișcă COMPLET spre dreapta, cu scântei care se
        // desprind din ea (efect de "friction spark")
        setTimeout(() => {
            bar.classList.add('move-right');
            playSound('sfx-whoosh', 0.4);
            spawnParticles(particles, canvas.width * 0.4, canvas.height * 0.5, 18, {
                colors: ['#ffd700', '#fff2b0'],
                speed: [3, 9],
                life: [300, 600],
                spread: Math.PI * 0.6,
                angleOffset: 0
            });
        }, ANIM1_TIMING.barStart);

        // Faza 2: user + parola se rotesc și merg în centru (spring/overshoot)
        setTimeout(() => {
            userEl.classList.add('spinning');
            passEl.classList.add('spinning');
        }, ANIM1_TIMING.spinStart);

        // Faza 3: UI BURST (explozie din centru) + shake + particule radiale
        setTimeout(() => {
            uiBurst.classList.add('active');
            playSound('sfx-whoosh', 0.6);
            screenShake(anim1, 350);
            spawnParticles(particles, canvas.width / 2, canvas.height / 2, 45, {
                colors: ['#ffd700', '#ffffff', '#ff8c00'],
                speed: [3, 11],
                life: [500, 950],
                size: [1.5, 4]
            });
        }, ANIM1_TIMING.burstStart);

        // Faza 4: burst-ul "crește" direct în verify — o singură tranziție,
        // fără fade-out separat al anim1-ului
        setTimeout(async () => {
            await revealStageFromCenter('verify', {
                duration: ANIM1_TIMING.revealDuration,
                popSelector: '.otp-card'
            });

            // acum verify e complet vizibil deasupra — curățăm anim1 în liniște
            anim1.classList.add('hidden');
            bar.classList.remove('move-right');
            userEl.classList.remove('spinning');
            passEl.classList.remove('spinning');
            uiBurst.classList.remove('active');
            destroyFxCanvas(canvas);
            resolve();
        }, ANIM1_TIMING.revealStart);
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
        alert('Register va fi disponibil în curând!');
    });
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
            playSound('sfx-click');

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
                    verifyBtn.textContent = 'SUCCESS!';
                    goToStage('intro');
                    await playAnimation2(true);

                    document.getElementById('main-username').textContent = currentUser.username;
                    document.getElementById('main-luna').textContent = currentUser.luna || 100;
                    goToStage('main');

                } else {
                    errorEl.textContent = data.error || 'Cod invalid!';
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'VERIFY';

                    goToStage('intro');
                    await playAnimation2(false);

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

// Constante de timing pentru animația 2 — ajustează liber aici dacă vrei
// s-o faci și mai lungă/spectaculoasă. `electricityDuration` controlează
// direct cât ține acumularea de fulgere înainte de explozie.
const ANIM2_TIMING = {
    success: {
        fadeStart: 100,
        electricityStart: 350,
        electricityDuration: 2000,   // cât "se acumulează" energia înainte de explozie
        intensifyOffset: 1050,       // relativ la electricityStart — ultima parte, mai violentă
        explosionOffset: 100,        // relativ la finalul electricității
        vortexOffset: 900,           // relativ la explozie
        vortexDuration: 4000,
        textOffset: 900,             // relativ la finalul vortexului
        textDuration: 7000
    },
    fail: {
        fadeStart: 100,
        electricityStart: 400,
        electricityDuration: 1600,
        explosionOffset: 100,
        errorOffset: 900,            // relativ la explozie
        endOffset: 1500              // relativ la eroare
    }
};

// ============================================================
//  ANIMAȚIA 2 — electricitate + explozie + vortex + rotire + text
// ============================================================
function playAnimation2(isSuccess) {
    return new Promise((resolve) => {
        const container = document.querySelector('.intro-container');
        const electricity = document.getElementById('intro-electricity');
        const explosion = document.getElementById('intro-explosion');
        const vortex = document.getElementById('intro-vortex');
        const text = document.getElementById('intro-text');

        // Reset
        container.classList.remove('rotating', 'fade-out-bg');
        container.style.transform = '';
        electricity.classList.remove('active', 'red', 'intensify');
        explosion.classList.remove('active', 'red');
        vortex.classList.remove('active');
        vortex.style.top = '';
        vortex.style.left = '';
        text.classList.remove('active');

        // FX: canvas de particule + fulgere peste tot intro-container-ul
        const canvas = createFxCanvas(container);
        const ctx = canvas.getContext('2d');
        const particles = [];
        const cx = () => canvas.width / 2;
        const cy = () => canvas.height / 2;

        if (isSuccess) {
            const T = ANIM2_TIMING.success;
            const explosionStart = T.electricityStart + T.electricityDuration + T.explosionOffset;
            const vortexStart = explosionStart + T.vortexOffset;
            const textStart = vortexStart + T.vortexDuration + T.textOffset;
            const endTime = textStart + T.textDuration;

            // ===== COD CORECT - VERDE =====

            // Faza 1: Fade out background
            setTimeout(() => container.classList.add('fade-out-bg'), T.fadeStart);

            // Faza 2: Electricitate — acumulare progresivă (CSS wiggle + fulgere pe canvas)
            setTimeout(() => {
                randomizeLightningBolts();
                electricity.classList.add('active');
                playSound('sfx-electric', 0.9);
                runLightningLoop(canvas, ctx, cx(), cy(), T.electricityDuration, '#00ff88', '#00ff88', particles);
                runParticleLoop(canvas, ctx, particles, T.electricityDuration + 300);
            }, T.electricityStart);

            // ultima parte a electricității devine mult mai violentă
            setTimeout(() => {
                electricity.classList.add('intensify');
            }, T.electricityStart + T.intensifyOffset);

            // Faza 3: Explozie MARE
            setTimeout(() => {
                stopSound('sfx-electric');
                electricity.classList.remove('active', 'intensify');
                explosion.classList.add('active');
                playSound('sfx-explosion', 1.0);
                screenShake(container, 450);
                spawnParticles(particles, cx(), cy(), 80, {
                    colors: ['#ffffff', '#00ff88', '#7dffc0'],
                    speed: [4, 15],
                    life: [600, 1150],
                    size: [1.5, 4.5]
                });
                runParticleLoop(canvas, ctx, particles, 1200);
            }, explosionStart);

            // Faza 4: Vortex într-o ZONĂ ALEATORIE + rotire ecran completă
            setTimeout(() => {
                explosion.classList.remove('active');

                const randomX = 20 + Math.random() * 60;
                const randomY = 20 + Math.random() * 60;

                vortex.style.top = randomY + '%';
                vortex.style.left = randomX + '%';

                vortex.classList.add('active');
                container.classList.add('rotating');
                playSound('sfx-vortex', 1.0);

                // particule aspirate spre punctul vortexului
                const vx = (randomX / 100) * canvas.width;
                const vy = (randomY / 100) * canvas.height;
                const swirlParticles = [];
                spawnParticles(swirlParticles, vx, vy, 55, {
                    colors: ['#00ff88', '#ffffff'],
                    speed: [0.5, 1.5],
                    life: [2600, 3600],
                    size: [1, 3],
                    gravity: 0
                });
                runParticleLoop(canvas, ctx, swirlParticles, T.vortexDuration);
            }, vortexStart);

            // Faza 5: Reset + text MAXGAMESTORE cu scântei ambientale
            setTimeout(() => {
                container.classList.remove('rotating', 'fade-out-bg');
                container.style.transform = '';
                vortex.classList.remove('active');
                vortex.style.top = '';
                vortex.style.left = '';

                text.classList.add('active');
                playSound('sfx-electric-long', 0.7);

                const sparkInterval = setInterval(() => {
                    spawnParticles(particles, cx() + (Math.random() - 0.5) * 400, cy() + (Math.random() - 0.5) * 120, 4, {
                        colors: ['#ffd700', '#ffffff'],
                        speed: [0.5, 2],
                        life: [300, 600],
                        size: [1, 2.5],
                        gravity: 0.02
                    });
                }, 250);
                canvas._sparkInterval = sparkInterval;
                runParticleLoop(canvas, ctx, particles, T.textDuration - 100);
            }, textStart);

            // Faza 6: Final
            setTimeout(() => {
                clearInterval(canvas._sparkInterval);
                text.classList.remove('active');
                stopSound('sfx-electric-long');
                playSound('sfx-whoosh', 0.5);
                destroyFxCanvas(canvas);
                resolve();
            }, endTime);

        } else {
            const T = ANIM2_TIMING.fail;
            const explosionStart = T.electricityStart + T.electricityDuration + T.explosionOffset;
            const errorStart = explosionStart + T.errorOffset;
            const endTime = errorStart + T.endOffset;

            // ===== COD GREȘIT - ROȘU =====

            setTimeout(() => container.classList.add('fade-out-bg'), T.fadeStart);

            setTimeout(() => {
                randomizeLightningBolts();
                electricity.classList.add('active', 'red');
                playSound('sfx-electric', 0.9);
                runLightningLoop(canvas, ctx, cx(), cy(), T.electricityDuration, '#ff0044', '#ff0044', particles);
                runParticleLoop(canvas, ctx, particles, T.electricityDuration + 300);
            }, T.electricityStart);

            setTimeout(() => {
                stopSound('sfx-electric');
                electricity.classList.remove('active', 'red');
                explosion.classList.add('active', 'red');
                playSound('sfx-explosion', 1.0);
                screenShake(container, 400);
                spawnParticles(particles, cx(), cy(), 45, {
                    colors: ['#ff0044', '#ffffff', '#ff5577'],
                    speed: [3, 10],
                    life: [400, 800],
                    size: [1.5, 4]
                });
                runParticleLoop(canvas, ctx, particles, 1000);
            }, explosionStart);

            setTimeout(() => playSound('sfx-error', 0.7), errorStart);

            setTimeout(() => {
                container.classList.remove('fade-out-bg');
                explosion.classList.remove('active', 'red');
                playSound('sfx-whoosh', 0.5);
                destroyFxCanvas(canvas);
                resolve();
            }, endTime);
        }
    });
}

// ============================================================
//  SHAKE ANIMATION (form login)
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
