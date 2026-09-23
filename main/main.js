// ============================================================
//  WORLD OF FIGHTS - MAIN LOGIC
// ============================================================

const SERVER_URL = window.location.origin;
const API = SERVER_URL + "/api";
const WS_URL = SERVER_URL.replace('http://', 'ws://').replace('https://', 'wss://') + "/ws";
const GAME_VERSION = "Beta 0.0.1";

let currentUser = null;
let currentSettings = {};
let ws = null;
let lunaInterval = null;
let globalMsgTimeout = null;

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    await loadUserSettings();

    initMenuLinks();
    initWofMenu();
    initWofBackBtn();
    initLogout();
    initProfile();
    initSettings();
    initWebSocket();

    showView('home');
    startLunaRefresh();
});

// ============================================================
//  SESSION
// ============================================================
async function checkSession() {
    const saved = localStorage.getItem('wof_session');
    if (!saved) {
        window.location.href = '../login/login.html';
        return;
    }

    try {
        currentUser = JSON.parse(saved);

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
            try {
                const refreshRes = await fetch(API + '/auto-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUser.username,
                        deviceId: currentUser.deviceId || 'web-default'
                    })
                });
                const refreshData = await refreshRes.json();

                if (refreshData.success) {
                    currentUser.token = refreshData.token;
                    currentUser.sessionId = refreshData.sessionId;
                    currentUser.rank = refreshData.rank;
                    currentUser.luna = refreshData.luna;
                    currentUser.lits = refreshData.lits;
                    localStorage.setItem('wof_session', JSON.stringify(currentUser));
                } else {
                    localStorage.removeItem('wof_session');
                    window.location.href = '../login/login.html';
                    return;
                }
            } catch (err) {
                localStorage.removeItem('wof_session');
                window.location.href = '../login/login.html';
                return;
            }
        }

        updateUI();
        await loadLuna();
        await loadLits();

    } catch (err) {
        console.error('Session check failed:', err);
        if (currentUser) updateUI();
    }
}

// ============================================================
//  UPDATE UI
// ============================================================
function updateUI() {
    if (!currentUser) return;

    document.getElementById('main-username').textContent = currentUser.username || 'Player';
    document.getElementById('main-rank').textContent = (currentUser.rank || 'user').toUpperCase();
    document.getElementById('main-gems').textContent = currentUser.gems || 0;

    document.getElementById('wof-username').textContent = currentUser.username || 'Player';
    document.getElementById('wof-rank').textContent = (currentUser.rank || 'user').toUpperCase();
    document.getElementById('wof-luna').textContent = currentUser.luna || 100;
    document.getElementById('wof-lits').textContent = currentUser.lits || 0;
    document.getElementById('wof-gems').textContent = currentUser.gems || 0;
}

// ============================================================
//  LOAD LUNA / LITS
// ============================================================
async function loadLuna() {
    if (!currentUser) return;
    try {
        const res = await fetch(API + '/luna/' + currentUser.username);
        const data = await res.json();
        if (data.luna !== undefined) {
            currentUser.luna = data.luna;
            document.getElementById('wof-luna').textContent = data.luna;
            localStorage.setItem('wof_session', JSON.stringify(currentUser));
        }
    } catch (err) {}
}

async function loadLits() {
    if (!currentUser) return;
    try {
        const res = await fetch(API + '/lits/' + currentUser.username);
        const data = await res.json();
        if (data.lits !== undefined) {
            currentUser.lits = data.lits;
            document.getElementById('wof-lits').textContent = data.lits;
            localStorage.setItem('wof_session', JSON.stringify(currentUser));
        }
    } catch (err) {}
}

function startLunaRefresh() {
    lunaInterval = setInterval(() => {
        if (currentUser) {
            loadLuna();
            loadLits();
        }
    }, 30000);
}

// ============================================================
//  MENU PLATFORM
// ============================================================
function initMenuLinks() {
    document.querySelectorAll('#top-bar-platform .menu-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showView(link.dataset.menu);
        });
    });

    const nameEl = document.getElementById('main-username');
    if (nameEl) nameEl.addEventListener('click', openProfile);
}

// ============================================================
//  SHOW VIEW
// ============================================================
function showView(view) {
    document.querySelectorAll('#top-bar-platform .menu-link').forEach(link => {
        link.classList.toggle('active', link.dataset.menu === view);
    });

    if (view === 'home') renderHomeView();
    if (view === 'games') renderGamesView();
    if (view === 'shop') renderPlatformShopView();
    if (view === 'info') renderInfoView();
}

// ============================================================
//  VIEW: HOME
// ============================================================
function renderHomeView() {
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="view-home">
            <div class="home-hero">
                <h1>🏢 Welcome to MaxGameStore</h1>
                <p>The ultimate gaming platform. Play multiple games, earn Gems, and compete worldwide.</p>
            </div>
            <div class="home-stats">
                <div class="stat-card"><div class="stat-icon">🎮</div><div class="stat-value">1</div><div class="stat-label">Games</div></div>
                <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value" id="home-players">0</div><div class="stat-label">Players Online</div></div>
                <div class="stat-card"><div class="stat-icon">🌍</div><div class="stat-value" id="home-accounts">0</div><div class="stat-label">Total Accounts</div></div>
                <div class="stat-card"><div class="stat-icon">💵</div><div class="stat-value">${currentUser.gems || 0}</div><div class="stat-label">Your Gems</div></div>
            </div>
            <div class="home-featured">
                <h2>⭐ Featured Game</h2>
                <div class="featured-game">
                    <div class="game-banner"><span class="game-logo">⚔️</span></div>
                    <div class="game-info">
                        <h3>World Of Fights</h3>
                        <p>The ultimate 2D fighting experience. Multiplayer, custom skins, and epic battles.</p>
                        <button class="btn-play-featured">▶ PLAY NOW</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    loadHomeStats();
    content.querySelector('.btn-play-featured').addEventListener('click', startWofTransition);
}

async function loadHomeStats() {
    try {
        const res = await fetch(API + '/health');
        const data = await res.json();
        const pl = document.getElementById('home-players');
        const ac = document.getElementById('home-accounts');
        if (pl) pl.textContent = data.players || 0;
        if (ac) ac.textContent = data.accounts || 0;
    } catch (err) {}
}

// ============================================================
//  VIEW: GAMES
// ============================================================
function renderGamesView() {
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="view-games">
            <div class="games-header">
                <h1>🎮 All Games</h1>
                <p>Choose a game to play</p>
            </div>
            <div class="games-grid">
                <div class="game-card" data-game="wof">
                    <div class="game-card-banner">
                        <span class="game-card-logo">⚔️</span>
                        <span class="game-card-badge">BETA</span>
                    </div>
                    <div class="game-card-info">
                        <h3>World Of Fights</h3>
                        <p>2D Multiplayer Fighting Game</p>
                        <button class="btn-enter">▶ ENTER</button>
                    </div>
                </div>
                <div class="game-card game-coming-soon">
                    <div class="game-card-banner"><span class="game-card-logo">❓</span></div>
                    <div class="game-card-info">
                        <h3>Coming Soon</h3>
                        <p>New games in development</p>
                        <button class="btn-enter" disabled>🔒 LOCKED</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    content.querySelector('.game-card[data-game="wof"] .btn-enter').addEventListener('click', startWofTransition);
}

// ============================================================
//  VIEW: SHOP PLATFORM
// ============================================================
function renderPlatformShopView() {
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="view-shop-platform">
            <h1>🛒 Buy Gems</h1>
            <p>Purchase Gems with real money to use in all games</p>
            <div class="shop-grid">
                <div class="shop-item">
                    <div class="shop-item-icon">💎</div>
                    <div class="shop-item-name">100 Gems</div>
                    <div class="shop-item-price">$0.99</div>
                    <button class="shop-item-buy">Buy Now</button>
                </div>
                <div class="shop-item">
                    <div class="shop-item-icon">💎</div>
                    <div class="shop-item-name">500 Gems</div>
                    <div class="shop-item-price">$3.99</div>
                    <button class="shop-item-buy">Buy Now</button>
                </div>
                <div class="shop-item">
                    <div class="shop-item-icon">💎</div>
                    <div class="shop-item-name">1000 Gems</div>
                    <div class="shop-item-price">$6.99</div>
                    <button class="shop-item-buy">Buy Now</button>
                </div>
                <div class="shop-item">
                    <div class="shop-item-icon">💎</div>
                    <div class="shop-item-name">5000 Gems</div>
                    <div class="shop-item-price">$29.99</div>
                    <button class="shop-item-buy">Buy Now</button>
                </div>
            </div>
        </div>
    `;

    content.querySelectorAll('.shop-item-buy').forEach(btn => {
        btn.addEventListener('click', () => showToast('Payment coming soon!', 'info'));
    });
}

// ============================================================
//  VIEW: INFO
// ============================================================
function renderInfoView() {
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="view-info">
            <h1>ℹ️ About MaxGameStore</h1>
            <p>Independent game development studio creating unique multiplayer experiences.</p>
            <div class="info-grid">
                <div class="info-card"><div class="info-icon">🏢</div><div class="info-label">Company</div><div class="info-value">MaxGameStore</div></div>
                <div class="info-card"><div class="info-icon">📅</div><div class="info-label">Founded</div><div class="info-value">2026</div></div>
                <div class="info-card"><div class="info-icon">🎮</div><div class="info-label">Games</div><div class="info-value">1</div></div>
                <div class="info-card"><div class="info-icon">👥</div><div class="info-label">Players</div><div class="info-value" id="info-players">0</div></div>
            </div>
            <div class="info-section">
                <h2>📖 About Us</h2>
                <p>MaxGameStore Corporation is an independent game development studio founded in 2026. We create unique multiplayer gaming experiences for players worldwide.</p>
                <p>Our first game, <strong>World Of Fights</strong>, is a 2D multiplayer fighting game with custom skins, real-time combat, and a vibrant community.</p>
            </div>
            <div class="info-section">
                <h2>📞 Contact</h2>
                <p><strong>Email:</strong> maxgamestore5@gmail.com</p>
                <p><strong>Discord:</strong> Coming soon</p>
            </div>
        </div>
    `;
}

// ============================================================
//  WOF TRANSITION
// ============================================================
function startWofTransition() {
    const animation = document.getElementById('wof-animation');
    const title = document.getElementById('wof-title');
    const content = document.getElementById('content-area');

    // Hide content during animation
    content.style.opacity = '0';

    animation.classList.remove('hidden');
    title.style.transform = 'translate(-50%, -50%) scale(0.5)';
    title.style.opacity = '0';

    // Step 1: Show title (fade in, small)
    setTimeout(() => {
        title.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        title.style.opacity = '1';
        title.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 100);

    // Step 2: Fade background to sky blue
    setTimeout(() => {
        animation.classList.add('sky-active');
    }, 900);

    // Step 3: Ground comes up
    setTimeout(() => {
        animation.classList.add('ground-active');
    }, 1500);

    // Step 4: Title moves up + shrinks
    setTimeout(() => {
        title.style.transform = 'translate(-50%, -200%) scale(0.5)';
    }, 2200);

    // Step 5: Show WOF
    setTimeout(() => {
        animation.classList.add('fade-out');

        setTimeout(() => {
            animation.classList.add('hidden');
            animation.classList.remove('sky-active', 'ground-active', 'fade-out');
            title.style.transition = 'none';
            title.style.transform = 'translate(-50%, -50%) scale(0.5)';
            title.style.opacity = '0';

            showWofView();
            content.style.opacity = '1';
        }, 600);
    }, 3000);
}

function showWofView() {
    document.getElementById('top-bar-platform').classList.add('hidden');
    document.getElementById('top-bar-wof').classList.remove('hidden');

    const wofMenu = new WofMenu();
    wofMenu.render();

    // Default: show Info
    const content = document.getElementById('content-area');
    new WofInfo().render(content);

    // Set Info as active
    document.querySelectorAll('#top-bar-wof .menu-link').forEach(l => {
        l.classList.toggle('active', l.dataset.wof === 'info');
    });
}

function initWofMenu() {
    document.querySelectorAll('#top-bar-wof .menu-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            if (link.classList.contains('disabled')) {
                showToast('Play coming soon!', 'info');
                return;
            }

            document.querySelectorAll('#top-bar-wof .menu-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            showWofView2(link.dataset.wof);
        });
    });
}

function showWofView2(view) {
    const content = document.getElementById('content-area');

    if (view === 'shop') new WofShop().render(content);
    if (view === 'market') new WofMarket().render(content);
    if (view === 'chat') new WofChat().render(content);
    if (view === 'info') new WofInfo().render(content);
}

function initWofBackBtn() {
    const btn = document.getElementById('wof-back-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            document.getElementById('top-bar-wof').classList.add('hidden');
            document.getElementById('top-bar-platform').classList.remove('hidden');
            showView('games');
        });
    }
}

// ============================================================
//  LOGOUT
// ============================================================
function initLogout() {
    [document.getElementById('logout-btn'), document.getElementById('wof-logout-btn')].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!confirm('Logout?')) return;

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
            } catch (err) {}

            if (ws) ws.close();
            localStorage.removeItem('wof_session');
            window.location.href = '../login/login.html';
        });
    });
}

// ============================================================
//  PROFILE
// ============================================================
function initProfile() {
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.close).classList.add('hidden');
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
}

function openProfile() {
    if (!currentUser) return;
    document.getElementById('p-username').textContent = currentUser.username || '-';
    document.getElementById('p-rank').textContent = (currentUser.rank || 'user').toUpperCase();
    document.getElementById('p-email').textContent = currentUser.email || '-';
    document.getElementById('p-gems').textContent = currentUser.gems || 0;
    document.getElementById('p-luna').textContent = currentUser.luna || 100;
    document.getElementById('p-lits').textContent = currentUser.lits || 0;
    document.getElementById('profile-modal').classList.remove('hidden');
}

// ============================================================
//  SETTINGS
// ============================================================
function initSettings() {
    const btn = document.getElementById('settings-btn');
    const btnWof = document.getElementById('wof-settings-btn');
    const modal = document.getElementById('settings-modal');
    const form = document.getElementById('settings-form');

    if (!modal) return;

    const open = (e) => { e.preventDefault(); modal.classList.remove('hidden'); };
    if (btn) btn.addEventListener('click', open);
    if (btnWof) btnWof.addEventListener('click', open);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('Settings saved!', 'success');
        modal.classList.add('hidden');
    });
}

async function loadUserSettings() {
    if (!currentUser) return;
    try {
        const res = await fetch(API + '/user/settings/' + currentUser.username);
        currentSettings = await res.json();
    } catch (err) { currentSettings = {}; }
}

// ============================================================
//  WEBSOCKET
// ============================================================
function initWebSocket() {
    if (!currentUser) return;

    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            ws.send(`AUTH:${currentUser.token}:${currentUser.username}:${currentUser.sessionId}:${GAME_VERSION}`);
        };

        ws.onmessage = (event) => {
            const msg = event.data;

            try {
                const data = JSON.parse(msg);
                if (data.type === 'GLOBAL_MESSAGE') showGlobalMessage(data.from, data.message);
            } catch (e) {}

            if (msg.startsWith('LUNA_UPDATE:')) {
                const luna = parseInt(msg.substring(12));
                document.getElementById('wof-luna').textContent = luna;
                currentUser.luna = luna;
                localStorage.setItem('wof_session', JSON.stringify(currentUser));
            } else if (msg.startsWith('LITS_UPDATE:')) {
                const lits = parseInt(msg.substring(12));
                document.getElementById('wof-lits').textContent = lits;
                currentUser.lits = lits;
                localStorage.setItem('wof_session', JSON.stringify(currentUser));
            } else if (msg.startsWith('BANNED:')) {
                alert('Banned: ' + msg.substring(7));
                localStorage.removeItem('wof_session');
                window.location.href = '../login/login.html';
            }
        };

        ws.onclose = () => setTimeout(initWebSocket, 5000);

    } catch (err) {}
}

// ============================================================
//  GLOBAL MESSAGE
// ============================================================
function showGlobalMessage(from, message) {
    const overlay = document.getElementById('global-message-overlay');
    document.getElementById('global-message-from').textContent = from;
    document.getElementById('global-message-text').textContent = message;
    overlay.classList.remove('hidden');

    if (globalMsgTimeout) clearTimeout(globalMsgTimeout);
    globalMsgTimeout = setTimeout(() => overlay.classList.add('hidden'), 5000);
}

// ============================================================
//  TOAST
// ============================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================================
//  CLEANUP
// ============================================================
window.addEventListener('beforeunload', () => {
    if (lunaInterval) clearInterval(lunaInterval);
    if (ws) ws.close();
});
