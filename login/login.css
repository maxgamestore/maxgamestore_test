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
//  ACCESIBILITATE — prefers-reduced-motion
// ============================================================
// Fulgerul (flicker rapid pe canvas) poate fi un trigger real pentru
// persoane cu epilepsie fotosensibilă. Dacă utilizatorul a cerut la
// nivel de OS/browser "reduce motion", oprim complet particulele/
// fulgerele de pe canvas și scurtăm animațiile la simple treceri de stare.
const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// ============================================================
//  FETCH CU TIMEOUT + RETRY — robustețe la rețea instabilă
// ============================================================
// Un fetch care rămâne agățat (server ngrok picat, wifi instabil etc.)
// nu mai lasă userul blocat pe "SE CONECTEAZĂ..." la nesfârșit.
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

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

// ============================================================
//  FX RUNTIME — un singur "motor" per canvas care rulează particule,
//  fulgere și flash-uri de ecran ÎN ACEEAȘI buclă requestAnimationFrame.
//
//  De ce nu 3 bucle separate? Pentru că fiecare buclă independentă
//  făcea propriul ctx.clearRect() — rulând simultan, se șterg una
//  pe alta la desenare (o cursă/"race" între ele). Cu un singur
//  loop care curăță o dată pe cadru și desenează totul în ordine,
//  dispare acel bug, iar bolțurile de fulger pot acum să pălească
//  natural în timp, nu doar să dispară brusc la următorul cadru.
// ============================================================
function createFxRuntime(canvas, ctx) {
    return {
        canvas, ctx,
        particles: [],
        bolts: [],
        flashes: [],
        lightnings: [],   // array de surse simultane (înainte: un singur "lightning")
        lastT: null,
        stopAt: 0,
        running: false
    };
}

// Fulger procedural (midpoint-displacement): construiește DOAR geometria
// (segmente de linie), fără să deseneze — desenarea (cu fade) se face
// în bucla unificată, ca să poată controla opacitatea în timp.
function buildLightningSegments(segs, x1, y1, x2, y2, displace, depth = 0) {
    if (displace < 6 || depth > 6) {
        segs.push({ x1, y1, x2, y2, width: Math.max(3 - depth * 0.4, 0.6) });

        // ramură ocazională
        if (Math.random() < 0.18 && depth < 4) {
            const bx = x2 + (Math.random() - 0.5) * 60;
            const by = y2 + (Math.random() - 0.5) * 60;
            buildLightningSegments(segs, x2, y2, bx, by, displace * 0.5, depth + 2);
        }
        return;
    }
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * displace;
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * displace;
    buildLightningSegments(segs, x1, y1, mx, my, displace / 2, depth + 1);
    buildLightningSegments(segs, mx, my, x2, y2, displace / 2, depth + 1);
}

// Adaugă particule noi în runtime-ul FX
function fxSpawnParticles(fx, x, y, count, opts = {}) {
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
        fx.particles.push({
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

// Pornește o "sursă" de fulgere care se acumulează progresiv: intensitatea
// (nr. de descărcări, lungimea lor, cât de des apar) CREȘTE spre finalul
// duratei — se simte ca o acumulare de energie, nu un flicker constant.
// Se pot rula mai multe surse simultan (ex: 3 bile de electricitate).
//
// opts.radius  — cât de "mari" sunt descărcările (implicit 150px)
// opts.followEl — dacă e dat, sursa își ia poziția din acest element DOM
//                 la fiecare cadru (util când bila se mișcă, ex: la merge)
// Returnează obiectul-sursă, ca să-i poți schimba direct .color/.glow
// (pentru flicker) sau .originX/.originY mai târziu.
function fxAddLightning(fx, originX, originY, duration, color, glow, opts = {}) {
    const now = performance.now();
    const source = {
        originX, originY,
        followEl: opts.followEl || null,
        radius: opts.radius || 150,
        color, glow,
        startTime: now,
        endTime: now + duration,
        nextStrike: 0
    };
    fx.lightnings.push(source);
    return source;
}

// Scoate o sursă anume (dacă e dată) sau toate sursele de fulger
function fxRemoveLightning(fx, source) {
    if (!source) {
        fx.lightnings.length = 0;
        return;
    }
    const i = fx.lightnings.indexOf(source);
    if (i !== -1) fx.lightnings.splice(i, 1);
}

// Flash de ecran întreg — folosit pentru "scânteia mare" care dezvăluie
// rezultatul (verde/roșu) după faza de acumulare albastră
function fxFlash(fx, color, life = 350) {
    fx.flashes.push({ color, born: performance.now(), life });
}

// Pornește (sau prelungește) bucla unificată. Poate fi apelată de mai
// multe ori în timpul aceleiași animații — extinde doar durata minimă.
function fxEnsureRunning(fx, minDuration) {
    fx.stopAt = Math.max(fx.stopAt, performance.now() + minDuration);
    if (fx.running) return;

    fx.running = true;
    fx.lastT = performance.now();

    function frame(t) {
        const dt = t - fx.lastT;
        fx.lastT = t;
        const { ctx, canvas } = fx;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- programarea descărcărilor de fulger (pentru fiecare sursă activă) ---
        for (let li = fx.lightnings.length - 1; li >= 0; li--) {
            const L = fx.lightnings[li];
            if (t >= L.endTime) {
                fx.lightnings.splice(li, 1);
                continue;
            }
            if (t < L.nextStrike) continue;

            let originX = L.originX;
            let originY = L.originY;
            if (L.followEl) {
                const r = L.followEl.getBoundingClientRect();
                const cr = canvas.getBoundingClientRect();
                originX = r.left - cr.left + r.width / 2;
                originY = r.top - cr.top + r.height / 2;
            }

            const progress = (t - L.startTime) / (L.endTime - L.startTime);
            const strikeCount = 1 + Math.floor(progress * 3 + Math.random() * 2);

            for (let i = 0; i < strikeCount; i++) {
                const ox = originX + (Math.random() - 0.5) * L.radius * 0.3;
                const oy = originY + (Math.random() - 0.5) * L.radius * 0.3;
                const angle = Math.random() * Math.PI * 2;
                const len = L.radius * (0.5 + Math.random() * 0.6 + progress * 0.3);
                const ex = ox + Math.cos(angle) * len;
                const ey = oy + Math.sin(angle) * len;

                const segments = [];
                buildLightningSegments(segments, ox, oy, ex, ey, Math.max(L.radius * 0.28, 18));
                fx.bolts.push({
                    segments,
                    color: L.color,
                    glow: L.glow,
                    born: t,
                    life: 90 + Math.random() * 70
                });

                if (Math.random() < 0.55) {
                    fxSpawnParticles(fx, ex, ey, 2, {
                        colors: [L.color, '#ffffff'],
                        speed: [0.5, 2.2],
                        life: [150, 300],
                        size: [1, 2],
                        gravity: 0.02
                    });
                }
            }

            const gap = 135 - progress * 90;
            L.nextStrike = t + gap + Math.random() * gap * 0.6;
        }

        // --- desenează bolțurile de fulger, cu fade natural pe durata vieții ---
        for (let i = fx.bolts.length - 1; i >= 0; i--) {
            const b = fx.bolts[i];
            const age = t - b.born;
            if (age >= b.life) {
                fx.bolts.splice(i, 1);
                continue;
            }
            const alpha = 1 - age / b.life;

            ctx.globalAlpha = alpha;
            ctx.shadowBlur = 14;
            ctx.shadowColor = b.glow;
            ctx.strokeStyle = b.color;
            for (const s of b.segments) {
                ctx.lineWidth = s.width;
                ctx.beginPath();
                ctx.moveTo(s.x1, s.y1);
                ctx.lineTo(s.x2, s.y2);
                ctx.stroke();
            }

            // miez alb fierbinte, suprapus
            ctx.globalAlpha = alpha * 0.55;
            ctx.shadowColor = '#ffffff';
            ctx.strokeStyle = '#ffffff';
            for (const s of b.segments) {
                ctx.lineWidth = Math.max(s.width * 0.5, 0.6);
                ctx.beginPath();
                ctx.moveTo(s.x1, s.y1);
                ctx.lineTo(s.x2, s.y2);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // --- particule ---
        for (let i = fx.particles.length - 1; i >= 0; i--) {
            const p = fx.particles[i];
            p.age += dt;
            if (p.age >= p.life) {
                fx.particles.splice(i, 1);
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

        // --- flash-uri pe tot ecranul (scânteia mare) ---
        for (let i = fx.flashes.length - 1; i >= 0; i--) {
            const f = fx.flashes[i];
            const age = t - f.born;
            if (age >= f.life) {
                fx.flashes.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = Math.pow(1 - age / f.life, 2); // fade rapid la final
            ctx.fillStyle = f.color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.globalAlpha = 1;

        const stillActive = fx.bolts.length || fx.particles.length || fx.flashes.length || fx.lightnings.length;
        if (t < fx.stopAt || stillActive) {
            requestAnimationFrame(frame);
        } else {
            fx.running = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
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

// Promisiune care se rezolvă după `ms` milisecunde — folosită ca să scriem
// secvențe lungi (ca cea de mai jos, cu multe faze) drept cod liniar
// async/await, în loc de setTimeout-uri imbricate greu de urmărit.
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Alege `count` poziții (în %) distribuite în jurul centrului ecranului,
// cu suficientă distanță între ele — pentru cele 3 bile de electricitate
function randomOrbPositions(count) {
    const positions = [];
    const baseAngle = Math.random() * 360;
    for (let i = 0; i < count; i++) {
        const angle = (baseAngle + (360 / count) * i + (Math.random() - 0.5) * 40) * (Math.PI / 180);
        const radius = 22 + Math.random() * 14; // % față de centru
        positions.push({
            x: 50 + Math.cos(angle) * radius,
            y: 50 + Math.sin(angle) * radius
        });
    }
    return positions;
}

// Sparge un text în <span>-uri individuale (pentru formarea literă cu literă)
function buildLetterSpans(h1, text) {
    h1.innerHTML = '';
    const spans = [];
    for (const ch of text) {
        const span = document.createElement('span');
        span.className = 'mgs-letter';
        span.textContent = ch;
        h1.appendChild(span);
        spans.push(span);
    }
    return spans;
}

// Predă ștafeta paginii REALE de main (fișier separat: main/main.html),
// nu unui stage intern din login.html. Salvează username/luna într-un
// loc pe care main.js îl poate citi imediat la încărcare (fără să aștepte
// propriul fetch), plus un fade scurt, ca navigarea să nu simtă ca un
// reload brusc.
function goToRealMain() {
    try {
        sessionStorage.setItem('wof_arrival', JSON.stringify({
            username: (currentUser && currentUser.username) || '',
            luna: (currentUser && currentUser.luna) || 100
        }));
    } catch (e) {}

    document.body.style.transition = 'opacity 0.4s ease';
    document.body.style.opacity = '0';

    return sleep(420).then(() => {
        window.location.href = '../main/main.html';
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

        // originea cercului — implicit centrul ecranului, dar poate fi
        // suprascrisă (ex: punctul unde a "zburat" un element înainte)
        toStage.style.setProperty('--reveal-x', opts.originX || '50%');
        toStage.style.setProperty('--reveal-y', opts.originY || '50%');

        const targetContainer =
            toStage.querySelector('.verify-container, .intro-container, .main-container, .login-container') ||
            toStage;

        // masca neagră — fundalul stage-ului "se aprinde" din negru, nu apare brusc.
        // Durata fade-ului e sincronizată EXACT cu durata reveal-ului, altfel
        // masca era ștearsă din DOM înainte să termine tranziția (apărea brusc).
        const mask = document.createElement('div');
        mask.className = 'reveal-fade-mask';
        mask.style.transitionDuration = duration + 'ms';
        targetContainer.appendChild(mask);

        // elementul de pop (ex: cardul OTP) pornește pregătit pentru animația CSS
        let popEl = null;
        if (popSelector) {
            popEl = toStage.querySelector(popSelector);
            if (popEl) popEl.classList.remove('card-pop');
        }

        toStage.classList.add('reveal-start');
        // forțăm reflow ca tranziția clip-path (și restart-ul card-pop) să
        // pornească efectiv de la 0%
        // eslint-disable-next-line no-unused-expressions
        toStage.offsetHeight;

        // Ambele fade-uri (mască + card) pornesc CHIAR ACUM, de la începutul
        // reveal-ului — nu la jumătatea drumului. Altfel cardul era deja
        // vizibil (opac) când cercul ajungea peste el, iar abia apoi
        // animația de pop îl reseta brusc la invizibil și-l readucea
        // (exact "apare, dispare, apare din nou").
        mask.style.opacity = '0';
        if (popEl) popEl.classList.add('card-pop');

        requestAnimationFrame(() => {
            toStage.classList.add('reveal-grow');
        });

        setTimeout(() => {
            mask.remove();

            // finalizăm switch-ul de stage în mod normal
            toStage.classList.remove('reveal-start', 'reveal-grow');
            toStage.style.removeProperty('--reveal-x');
            toStage.style.removeProperty('--reveal-y');
            document.querySelectorAll('.stage').forEach(s => s.classList.remove('active'));
            toStage.classList.add('active');
            currentStage = toStageName;

            resolve();
        }, duration + 60);
    });
}

// Feedback tactil la click — un cerc care se extinde din punctul apăsat
function createRipple(e, btn) {
    if (REDUCE_MOTION) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.4;
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
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
    initAccessibility();
    initButtonRipples();
});

// Anunțuri pentru cititoare de ecran — erorile/confirmările se anunță
// automat, fără să fie nevoie ca userul să navigheze manual la ele
function initAccessibility() {
    const loginError = document.getElementById('login-error');
    if (loginError) loginError.setAttribute('role', 'alert');

    const otpError = document.getElementById('otp-error');
    if (otpError) otpError.setAttribute('role', 'alert');

    const otpEmailEl = document.getElementById('otp-email');
    if (otpEmailEl) otpEmailEl.closest('.otp-message')?.setAttribute('aria-live', 'polite');
}

// Ripple pe orice buton .btn-primary prezent la momentul inițializării
function initButtonRipples() {
    document.querySelectorAll('.btn-primary').forEach(btn => {
        btn.addEventListener('click', (e) => createRipple(e, btn));
    });
}

// Flash roșu + shake pe cardul OTP la cod greșit
function flashOtpCard() {
    const card = document.querySelector('.otp-card');
    if (!card) return;

    if (!REDUCE_MOTION) {
        card.classList.remove('shake');
        // eslint-disable-next-line no-unused-expressions
        card.offsetWidth;
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);
    }

    const flash = document.createElement('div');
    flash.className = 'otp-card-flash flash-active';
    card.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
}

// Contorul de "luna" numără de la 0 până la valoarea reală, în loc să
// apară brusc — un mic detaliu care face ecranul principal să pară viu
function setLunaCount(target) {
    const el = document.getElementById('main-luna');
    if (!el) return;
    target = parseInt(target, 10) || 0;

    if (REDUCE_MOTION) {
        el.textContent = target;
    } else {
        const duration = 800;
        const start = performance.now();
        function frame(t) {
            const progress = Math.min((t - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            el.textContent = Math.round(eased * target);
            if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    const badge = el.closest('.user-luna');
    if (badge) {
        badge.classList.remove('luna-pulse');
        // eslint-disable-next-line no-unused-expressions
        badge.offsetWidth;
        badge.classList.add('luna-pulse');
    }
}

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
            const res = await fetchWithTimeout(API + '/secure-login', {
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
            errorEl.textContent = err.name === 'AbortError'
                ? 'Serverul nu răspunde. Încearcă din nou.'
                : 'Eroare conexiune server';
            btn.disabled = false;
            btn.textContent = 'LOGIN';
        }
    });
}

// Constante de timing pentru animația 1 — ajustează liber aici dacă vrei
// să tragi mai mult sau mai puțin de vreo fază.
const ANIM1_TIMING = {
    sweepStart: 50,            // când pornesc bara + panoul de login să fie "duse"
    fadeToBlackStart: 700,     // ecranul începe fade-ul la negru (se suprapune ușor cu finalul măturării)
    fadeToBlackDuration: 500,
    sparkAt: 1350,             // o mică scânteie chiar înainte de reveal, pe fondul deja negru
    revealStart: 1500,         // când începe tranziția (iris reveal) spre verify
    revealDuration: 1150       // durata reveal-ului propriu-zis
};

// Variantă scurtată pentru prefers-reduced-motion — aceleași faze logice,
// dar aproape instant, fără particule/shake
const ANIM1_TIMING_REDUCED = {
    sweepStart: 0,
    fadeToBlackStart: 120,
    fadeToBlackDuration: 150,
    sparkAt: 280,
    revealStart: 300,
    revealDuration: 350
};

// ============================================================
//  ANIMAȚIA 1 — bara reală "prinde" panoul de login și îl duce,
//  apoi ecranul face fade la negru, apoi reveal continuu spre verify
// ============================================================
//
// Spre deosebire de o variantă cu text abstract care zboară spre centru,
// aici sunt animate elementele REALE din pagină: bara oblică (.divider)
// și dreptunghiul cu formularul (.login-form-wrapper, cu username/parola
// vizibile în el) sunt "duse" împreună spre dreapta, ca și cum bara le-ar
// prinde și le-ar căra cu ea. Abia DUPĂ ce ies din ecran, totul face fade
// la negru — nu instant — și apoi verify apare printr-un iris reveal.
function playAnimation1(username, password) {
    return new Promise(async (resolve) => {
        const T = REDUCE_MOTION ? ANIM1_TIMING_REDUCED : ANIM1_TIMING;
        const anim1 = document.getElementById('anim1');
        const uiBurst = document.getElementById('anim1-ui-burst');
        const divider = document.querySelector('.divider');
        const formWrapper = document.querySelector('.login-form-wrapper');

        // elementele vechi (bară/text clonate) din #anim1 nu mai sunt
        // folosite în noul design — le neutralizăm ca să nu rămână vizibile
        // peste ecranul negru
        const oldBar = document.getElementById('anim1-bar');
        const oldUser = document.getElementById('anim1-user');
        const oldPass = document.getElementById('anim1-pass');
        if (oldBar) oldBar.style.display = 'none';
        if (oldUser) oldUser.style.display = 'none';
        if (oldPass) oldPass.style.display = 'none';

        uiBurst.classList.remove('active');
        anim1.classList.remove('visible');
        anim1.classList.add('hidden'); // rămâne ascuns până la fade-to-black

        // FX: runtime unificat de particule, folosit pentru scânteia de la final
        let canvas = null;
        let ctx = null;
        let fxRuntime = null;
        if (!REDUCE_MOTION) {
            canvas = createFxCanvas(anim1);
            ctx = canvas.getContext('2d');
            fxRuntime = createFxRuntime(canvas, ctx);
        }

        // Faza 1: bara + panoul de login sunt "duse" spre dreapta, împreună
        setTimeout(() => {
            if (divider) divider.classList.add('sweep-out');
            if (formWrapper) formWrapper.classList.add('swept-away');
            playSound('sfx-whoosh', 0.5);
        }, T.sweepStart);

        // Faza 2: ecranul face fade la negru (nu instant) — se suprapune
        // ușor cu finalul măturării, pentru o tranziție lină
        setTimeout(() => {
            anim1.classList.remove('hidden');
            anim1.classList.remove('visible');
            // eslint-disable-next-line no-unused-expressions
            anim1.offsetHeight; // forțăm reflow ca tranziția să pornească de la opacity 0
            requestAnimationFrame(() => anim1.classList.add('visible'));
        }, T.fadeToBlackStart);

        // Faza 3: o mică scânteie pe fondul deja negru, chiar înainte de reveal
        setTimeout(() => {
            uiBurst.classList.add('active');
            playSound('sfx-whoosh', 0.6);
            if (fxRuntime) {
                fxRuntime.canvas.width = anim1.clientWidth;
                fxRuntime.canvas.height = anim1.clientHeight;
                fxSpawnParticles(fxRuntime, fxRuntime.canvas.width / 2, fxRuntime.canvas.height / 2, 35, {
                    colors: ['#ffd700', '#ffffff', '#ff8c00'],
                    speed: [2, 8],
                    life: [400, 750],
                    size: [1.5, 3.5]
                });
                fxEnsureRunning(fxRuntime, 800);
            }
        }, T.sparkAt);

        // Faza 4: reveal continuu spre verify (bug-fixat: fade de fundal +
        // card-pop pornesc corect, fără flicker dublu)
        setTimeout(async () => {
            await revealStageFromCenter('verify', {
                duration: T.revealDuration,
                popSelector: '.otp-card'
            });

            // curățăm și resetăm totul în liniște, pentru un eventual login ulterior
            anim1.classList.add('hidden');
            anim1.classList.remove('visible');
            uiBurst.classList.remove('active');
            if (divider) divider.classList.remove('sweep-out');
            if (formWrapper) formWrapper.classList.remove('swept-away');
            if (oldBar) oldBar.style.display = '';
            if (oldUser) oldUser.style.display = '';
            if (oldPass) oldPass.style.display = '';
            if (canvas) destroyFxCanvas(canvas);
            resolve();
        }, T.revealStart);
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
                if (!REDUCE_MOTION) {
                    input.classList.remove('pop');
                    // eslint-disable-next-line no-unused-expressions
                    input.offsetWidth;
                    input.classList.add('pop');
                }
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
                const res = await fetchWithTimeout(API + '/verify-account', {
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
                    await revealStageFromCenter('intro', { duration: 900 });
                    await playAnimation2(true); // ajunge singură până în stage-ul "main"

                } else {
                    flashOtpCard();
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
                errorEl.textContent = err.name === 'AbortError'
                    ? 'Serverul nu răspunde. Încearcă din nou.'
                    : 'Eroare conexiune server';
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
                    body: JSON.stringify({ username: currentUser.username })
                });
                const data = await res.json();

                if (data.success) {
                    alert('Cod nou trimis pe email!');
                } else {
                    alert('Eroare: ' + (data.error || 'Unknown'));
                }
            } catch (err) {
                alert(err.name === 'AbortError' ? 'Serverul nu răspunde. Încearcă din nou.' : 'Eroare conexiune server');
            }
        });
    }
}

// ============================================================
//  ANIMAȚIA 2 (REDUCED-MOTION) — fără canvas, fără fulgere, fără
//  rotirea ecranului (rotirea completă e un trigger clasic pentru
//  disconfort vestibular). Doar o tranziție de stare, scurtă și clară.
// ============================================================
function playAnimation2Reduced(isSuccess) {
    return new Promise((resolve) => {
        const container = document.querySelector('.intro-container');
        const electricity = document.getElementById('intro-electricity');
        const explosion = document.getElementById('intro-explosion');
        const vortex = document.getElementById('intro-vortex');
        const text = document.getElementById('intro-text');

        container.classList.remove('rotating', 'fade-out-bg');
        electricity.classList.remove('active', 'red', 'intensify');
        explosion.classList.remove('active', 'red');
        vortex.classList.remove('active');
        text.classList.remove('show', 'fly-out', 'glitching');

        if (isSuccess) {
            playSound('sfx-explosion', 0.6);
            explosion.classList.add('active');

            setTimeout(() => {
                explosion.classList.remove('active');
                text.classList.add('show');
                playSound('sfx-whoosh', 0.4);
            }, 300);

            setTimeout(() => {
                text.classList.remove('show');
                goToRealMain().then(resolve);
            }, 1400);
        } else {
            playSound('sfx-error', 0.6);
            explosion.classList.add('active', 'red');

            setTimeout(() => {
                explosion.classList.remove('active', 'red');
                resolve();
            }, 500);
        }
    });
}

// ============================================================
//  ANIMAȚIA 2 — electricitate ALBASTRĂ (verificare) → scânteie mare
//  care dezvăluie rezultatul (verde/roșu) → explozie + vortex/rotire
//  (succes) sau explozie + eroare (eșec)
// ============================================================
// Fazele sunt scrise ca durate RELATIVE (nu offset-uri absolute) — mult
// mai ușor de citit/ajustat pentru o secvență cu atât de multe etape.
const ANIM2_TIMING = {
    fadeStart: 100,
    orbsAppear: 350,          // după fade, cele 3 bile de electricitate apar
    flickerDuration: 2200,    // ezitare verde/roșu, per bilă, independent
    settleGap: 350,           // pauză după ce toate se fixează pe rezultatul real
    success: {
        mergeDuration: 700,       // bilele migrează spre centru
        growDuration: 900,        // bila unică devine uriașă (~75% ecran)
        zoomDuration: 700,        // zoom in, se stinge în alb
        postZoomGap: 250,
        orangeSparkGap: 200,      // după scânteia portocalie, înainte de prima literă
        letterStagger: 110,       // decalaj între apariția literelor
        letterSettle: 400,        // timp de așezare după ultima literă
        holdAfterText: 3000,      // așteptare cerută explicit, după ce tot textul s-a format
        flyDuration: 900          // zboară micșorat spre colțul din stânga-sus
    },
    fail: {
        fizzleDuration: 550,      // bilele roșii pur și simplu se sting
        endGap: 900
    }
};

// ============================================================
//  ANIMAȚIA 2 — 3 bile de electricitate apar random, ezită între
//  verde/roșu, apoi (la succes) se contopesc într-o singură bilă care
//  devine uriașă, zoom in, scânteie portocalie, literele "MAXGAMESTORE"
//  se formează una câte una din scântei, așteptare, apoi zboară
//  micșorat spre bara principală din ecranul "main".
//  (la eșec, bilele roșii pur și simplu se sting)
// ============================================================
async function playAnimation2(isSuccess) {
    if (REDUCE_MOTION) return playAnimation2Reduced(isSuccess);

    const container = document.querySelector('.intro-container');
    const text = document.getElementById('intro-text');
    const h1 = text.querySelector('h1');
    const T = ANIM2_TIMING;

    // Reset
    container.classList.remove('rotating', 'fade-out-bg');
    container.style.transform = '';
    document.querySelectorAll('.electric-orb').forEach((o) => o.remove());
    text.classList.remove('show', 'fly-out', 'glitching');
    text.style.removeProperty('--fly-x');
    text.style.removeProperty('--fly-y');

    const canvas = createFxCanvas(container);
    const ctx = canvas.getContext('2d');
    const fx = createFxRuntime(canvas, ctx);

    // Faza 1: fade out background
    container.classList.add('fade-out-bg');
    await sleep(T.orbsAppear - T.fadeStart);

    // Faza 2: 3 bile de electricitate apar în puncte random ale ecranului
    const positions = randomOrbPositions(3);
    const orbs = positions.map((pos) => {
        const el = document.createElement('div');
        el.className = 'electric-orb';
        el.style.left = pos.x + '%';
        el.style.top = pos.y + '%';
        container.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));

        const px = (pos.x / 100) * canvas.width;
        const py = (pos.y / 100) * canvas.height;
        const source = fxAddLightning(fx, px, py, T.flickerDuration + 6000, '#33aaff', '#33aaff', {
            radius: 65,
            followEl: el
        });
        return { el, source };
    });
    playSound('sfx-electric', 0.7);
    fxEnsureRunning(fx, T.flickerDuration + 4500);

    // Faza 3: fiecare bilă "ezită" independent între verde și roșu
    const flickerTimers = orbs.map((o) => setInterval(() => {
        const green = Math.random() < 0.5;
        o.el.classList.toggle('green', green);
        o.el.classList.toggle('red', !green);
        o.source.color = green ? '#00ff88' : '#ff0044';
        o.source.glow = o.source.color;
    }, 130 + Math.random() * 90));

    await sleep(T.flickerDuration);
    flickerTimers.forEach(clearInterval);

    // Faza 4: se fixează pe rezultatul REAL — toate deodată
    const resultColor = isSuccess ? '#00ff88' : '#ff0044';
    orbs.forEach((o) => {
        o.el.classList.toggle('green', isSuccess);
        o.el.classList.toggle('red', !isSuccess);
        o.source.color = resultColor;
        o.source.glow = resultColor;
    });
    playSound('sfx-whoosh', 0.5);
    await sleep(T.settleGap);

    if (isSuccess) {
        const S = T.success;

        // Faza 5: bilele migrează spre centru — se contopesc
        screenShake(container, 300);
        orbs.forEach((o) => {
            o.el.style.left = '50%';
            o.el.style.top = '50%';
        });
        await sleep(S.mergeDuration);

        // păstrăm o singură bilă (bila-nucleu), scoatem celelalte două
        const core = orbs[0].el;
        const coreSource = orbs[0].source;
        for (let i = 1; i < orbs.length; i++) {
            fxRemoveLightning(fx, orbs[i].source);
            orbs[i].el.remove();
        }
        coreSource.followEl = null;
        coreSource.originX = canvas.width / 2;
        coreSource.originY = canvas.height / 2;

        // Faza 6: bila devine uriașă (~75% din ecran)
        core.classList.add('giant');
        coreSource.radius = Math.min(canvas.width, canvas.height) * 0.34;
        playSound('sfx-explosion', 0.8);
        screenShake(container, 400);
        fxSpawnParticles(fx, canvas.width / 2, canvas.height / 2, 60, {
            colors: ['#ffffff', '#00ff88', '#7dffc0'],
            speed: [3, 10],
            life: [500, 950],
            size: [1.5, 4]
        });
        await sleep(S.growDuration);

        // Faza 7: zoom in — bila crește peste ecran și se stinge în alb
        fxRemoveLightning(fx, coreSource);
        core.classList.add('zoom-in');
        playSound('sfx-vortex', 0.8);
        await sleep(S.zoomDuration);
        core.remove();
        await sleep(S.postZoomGap);

        // Faza 8: scânteia portocalie
        fxFlash(fx, '#ff8c00', 320);
        fxEnsureRunning(fx, 400);
        playSound('sfx-whoosh', 0.6);
        await sleep(S.orangeSparkGap);

        // Faza 9: fiecare literă a "MAXGAMESTORE" se formează din scântei
        const letters = buildLetterSpans(h1, 'MAXGAMESTORE');
        text.classList.add('show');
        const canvasRect = canvas.getBoundingClientRect();
        for (const letter of letters) {
            const r = letter.getBoundingClientRect();
            fxSpawnParticles(fx, r.left - canvasRect.left + r.width / 2, r.top - canvasRect.top + r.height / 2, 6, {
                colors: ['#ffd700', '#ffffff'],
                speed: [1, 4],
                life: [250, 500],
                size: [1, 2.5]
            });
            fxEnsureRunning(fx, 500);
            letter.classList.add('formed');
            await sleep(T.success.letterStagger);
        }
        await sleep(S.letterSettle);

        // Faza 10: textul "trăiește" (glitch/energie) cât timp așteptăm
        text.classList.add('glitching');
        playSound('sfx-electric-long', 0.5);
        await sleep(S.holdAfterText);

        // Faza 11: micșorează și zboară spre colțul din stânga-sus — acolo
        // unde va fi bara reală, pe pagina de main (nu mai depindem de
        // stage-ul intern embedded, oricum abandonat la pasul următor)
        text.classList.remove('glitching');
        const targetX = window.innerWidth * 0.18;
        const targetY = window.innerHeight * 0.09;
        text.style.setProperty('--fly-x', (targetX - window.innerWidth / 2) + 'px');
        text.style.setProperty('--fly-y', (targetY - window.innerHeight / 2) + 'px');
        playSound('sfx-whoosh', 0.5);
        text.classList.add('fly-out');
        await sleep(S.flyDuration);

        // Faza 12: predăm ștafeta paginii REALE de main (fișier separat,
        // navigare propriu-zisă) — nu doar un stage intern din login.html
        stopSound('sfx-electric-long');
        destroyFxCanvas(canvas);
        await goToRealMain();

    } else {
        const F = T.fail;

        // Bilele roșii pur și simplu se sting — fără contopire
        playSound('sfx-error', 0.7);
        screenShake(container, 350);
        orbs.forEach((o) => {
            const px = (parseFloat(o.el.style.left) / 100) * canvas.width;
            const py = (parseFloat(o.el.style.top) / 100) * canvas.height;
            fxSpawnParticles(fx, px, py, 18, {
                colors: ['#ff0044', '#ffffff', '#ff5577'],
                speed: [2, 7],
                life: [350, 650],
                size: [1.5, 3.5]
            });
            o.el.classList.add('fizzle');
        });
        fxEnsureRunning(fx, F.fizzleDuration + 300);
        await sleep(F.fizzleDuration);

        orbs.forEach((o) => {
            fxRemoveLightning(fx, o.source);
            o.el.remove();
        });
        container.classList.remove('fade-out-bg');
        await sleep(F.endGap);
        destroyFxCanvas(canvas);
    }
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
