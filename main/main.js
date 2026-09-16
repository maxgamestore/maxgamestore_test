// ============================================================
//  CONFIG
// ============================================================
const SERVER_URL = "https://trimmer-chrome-landfall.ngrok-free.dev";
const API = SERVER_URL + "/api";

// ============================================================
//  STARE
// ============================================================
let currentUser = null;

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    handleLoginArrival();
    checkSession();
    initMenuLinks();
    initLogout();
});

// ============================================================
//  SOSIRE DIN ANIMAȚIA DE LOGIN
// ============================================================
// Dacă tocmai am venit din secvența animată de login (login.js lasă
// datele în sessionStorage chiar înainte de navigare), afișăm imediat
// username/luna — fără să așteptăm fetch-ul din checkSession, ca să nu
// clipească "Player"/100 preț de o clipă — și declanșăm un mic puls
// electric pe bară + o etichetă "MAXGAMESTORE" care continuă firul
// textului din animație. La un refresh normal, nimic din toate astea
// nu se întâmplă (flag-ul nu mai există după prima citire).
function handleLoginArrival() {
    let arrival = null;
    try {
        const raw = sessionStorage.getItem('wof_arrival');
        if (raw) {
            arrival = JSON.parse(raw);
            sessionStorage.removeItem('wof_arrival');
        }
    } catch (e) {}

    if (!arrival) return;

    if (arrival.username) {
        document.getElementById('main-username').textContent = arrival.username;
    }
    if (arrival.luna !== undefined) {
        document.getElementById('main-luna').textContent = arrival.luna;
    }

    const bar = document.querySelector('.main-bar');
    const welcome = document.querySelector('.welcome-section');

    if (bar) bar.classList.add('arrival-flash');

    if (welcome) {
        welcome.classList.add('arrival-flash');
        const label = document.createElement('div');
        label.className = 'arrival-label';
        label.textContent = 'MAXGAMESTORE';
        welcome.insertBefore(label, welcome.firstChild);
    }
}

// ============================================================
//  VERIFICĂ SESIUNE
// ============================================================
async function checkSession() {
    const saved = localStorage.getItem('wof_session');
    
    if (!saved) {
        // Fără sesiune → redirect la login
        window.location.href = '../login/login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(saved);
        
        // Verifică cu serverul
        const res = await fetch(API + '/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser.username,
                token: currentUser.token,
                sessionId: currentUser.sessionId
            })
        });
        const data = await res.json();
        
        if (!data.valid) {
            // Sesiune invalidă → logout
            localStorage.removeItem('wof_session');
            window.location.href = '../login/login.html';
            return;
        }
        
        // Afișează user
        document.getElementById('main-username').textContent = currentUser.username;
        
        // Ia Luna de la server
        await loadLuna();
        
    } catch (err) {
        console.error('Session check failed:', err);
        // Server down → continuă offline cu datele locale
        if (currentUser) {
            document.getElementById('main-username').textContent = currentUser.username;
            document.getElementById('main-luna').textContent = currentUser.luna || 100;
        }
    }
}

// ============================================================
//  LOAD LUNA
// ============================================================
async function loadLuna() {
    try {
        const res = await fetch(API + '/luna/' + currentUser.username);
        const data = await res.json();
        
        if (data.luna !== undefined) {
            document.getElementById('main-luna').textContent = data.luna;
            
            // Update în localStorage
            currentUser.luna = data.luna;
            localStorage.setItem('wof_session', JSON.stringify(currentUser));
        }
    } catch (err) {
        console.error('Failed to load Luna:', err);
        // Fallback la valoarea locală
        document.getElementById('main-luna').textContent = currentUser.luna || 100;
    }
}

// ============================================================
//  MENU LINKS
// ============================================================
function initMenuLinks() {
    document.querySelectorAll('.menu-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const menu = link.dataset.menu;
            
            if (menu) {
                e.preventDefault();
                // Momentan - alert
                alert('📌 ' + menu.toUpperCase() + ' va fi disponibil în curând!');
            }
        });
    });
}

// ============================================================
//  LOGOUT
// ============================================================
function initLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;
    
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const confirmed = confirm('Sigur vrei să te deconectezi?');
        if (!confirmed) return;
        
        // Trimite logout la server
        if (currentUser) {
            try {
                await fetch(API + '/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUser.username,
                        token: currentUser.token,
                        sessionId: currentUser.sessionId
                    })
                });
            } catch (err) {
                console.warn('Logout server error:', err);
            }
        }
        
        // Șterge sesiunea locală
        localStorage.removeItem('wof_session');
        
        // Redirect la login
        window.location.href = '../login/login.html';
    });
}

// ============================================================
//  AUTO-REFRESH LUNA (la 30 secunde)
// ============================================================
setInterval(() => {
    if (currentUser && currentUser.username) {
        loadLuna();
    }
}, 30000);
