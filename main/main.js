// ============================================================
//  WORLD OF FIGHTS - MAIN LOGIC
//  MaxGameStore Corporation © 2026
// ============================================================

// ============================================================
//  CONFIG
// ============================================================
const SERVER_URL = window.location.origin;
const API = SERVER_URL + "/api";
const WS_URL = SERVER_URL.replace('http://', 'ws://').replace('https://', 'wss://') + "/ws";
const GAME_VERSION = "Beta 0.0.1";

// ============================================================
//  STATE
// ============================================================
let currentUser = null;
let currentSettings = {};
let ws = null;
let lunaInterval = null;
let globalMsgTimeout = null;
let currentPlatformView = 'home';
let currentWofView = 'info';

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    await loadUserSettings();

    initPlatformMenu();
    initWofMenu();
    initWofBackBtn();
    initLogout();
    initProfile();
    initSettings();
    initWebSocket();

    showPlatformView('home');
    startLunaRefresh();
});

// ============================================================
//  SESSION CHECK
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

    const mainUser = document.getElementById('main-username');
    const mainRank = document.getElementById('main-rank');
    const mainGems = document.getElementById('main-gems');

    if (mainUser) mainUser.textContent = currentUser.username || 'Player';
    if (mainRank) mainRank.textContent = (currentUser.rank || 'user').toUpperCase();
    if (mainGems) mainGems.textContent = currentUser.gems || 0;

    const wofUser = document.getElementById('wof-username');
    const wofRank = document.getElementById('wof-rank');
    const wofLuna = document.getElementById('wof-luna');
    const wofLits = document.getElementById('wof-lits');
    const wofGems = document.getElementById('wof-gems');

    if (wofUser) wofUser.textContent = currentUser.username || 'Player';
    if (wofRank) wofRank.textContent = (currentUser.rank || 'user').toUpperCase();
    if (wofLuna) wofLuna.textContent = currentUser.luna || 100;
    if (wofLits) wofLits.textContent = currentUser.lits || 0;
    if (wofGems) wofGems.textContent = currentUser.gems || 0;
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
            const el = document.getElementById('wof-luna');
            if (el) el.textContent = data.luna;
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
            const el = document.getElementById('wof-lits');
            if (el) el.textContent = data.lits;
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
//  PLATFORM MENU
// ============================================================
function initPlatformMenu() {
    document.querySelectorAll('#top-bar-platform .menu-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPlatformView(link.dataset.menu);
        });
    });

    const nameEl = document.getElementById('main-username');
    if (nameEl) nameEl.addEventListener('click', openProfile);
}

// ============================================================
//  SHOW PLATFORM VIEW
// ============================================================
function showPlatformView(view) {
    currentPlatformView = view;

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
                <div class="stat-card">
                    <div class="stat-icon">🎮</div>
                    <div class="stat-value">1</div>
                    <div class="stat-label">Games</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value" id="home-players">0</div>
                    <div class="stat-label">Players Online</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🌍</div>
                    <div class="stat-value" id="home-accounts">0</div>
                    <div class="stat-label">Total Accounts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💵</div>
                    <div class="stat-value">${currentUser.gems || 0}</div>
                    <div class="stat-label">Your Gems</div>
                </div>
            </div>
            <div class="home-featured">
                <h2>⭐ Featured Game</h2>
                <div class="featured-game">
                    <div class="game-banner">
                        <span class="game-logo">⚔️</span>
                    </div>
                    <div class="game-info">
                        <h3>World Of Fights</h3>
                        <p>The ultimate 2D fighting experience. Multiplayer, custom skins, and epic battles.</p>
                        <button class="btn-play-featured" id="btn-featured-play">▶ PLAY NOW</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    loadHomeStats();

    const btn = document.getElementById('btn-featured-play');
    if (btn) btn.addEventListener('click', startWofTransition);
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
                        <button class="btn-enter" id="btn-wof-enter">▶ ENTER</button>
                    </div>
                </div>
                <div class="game-card game-coming-soon">
                    <div class="game-card-banner">
                        <span class="game-card-logo">❓</span>
                    </div>
                    <div class="game-card-info">
                        <h3>Coming Soon</h3>
                        <p>New games in development</p>
                        <button class="btn-enter" disabled>🔒 LOCKED</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const btn = document.getElementById('btn-wof-enter');
    if (btn) btn.addEventListener('click', startWofTransition);
}

// ============================================================
//  VIEW: SHOP (Platform)
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
//  VIEW: INFO (Platform)
// ============================================================
function renderInfoView() {
    const content = document.getElementById('content-area');
    content.innerHTML = `
        <div class="view-info">
            <h1>ℹ️ About MaxGameStore</h1>
            <p>Independent game development studio creating unique multiplayer experiences.</p>
            <div class="info-grid">
                <div class="info-card">
                    <div class="info-icon">🏢</div>
                    <div class="info-label">Company</div>
                    <div class="info-value">MaxGameStore</div>
                </div>
                <div class="info-card">
                    <div class="info-icon">📅</div>
                    <div class="info-label">Founded</div>
                    <div class="info-value">2026</div>
                </div>
                <div class="info-card">
                    <div class="info-icon">🎮</div>
                    <div class="info-label">Games</div>
                    <div class="info-value">1</div>
                </div>
                <div class="info-card">
                    <div class="info-icon">👥</div>
                    <div class="info-label">Players</div>
                    <div class="info-value" id="info-players">0</div>
                </div>
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
//  WOF TRANSITION (SMOOTH)
// ============================================================
function startWofTransition() {
    const title = document.getElementById('wof-title-flying');
    const content = document.getElementById('content-area');
    const platformBar = document.getElementById('top-bar-platform');
    const wofBar = document.getElementById('top-bar-wof');
    const bgLayer = document.getElementById('background-layer');

    if (!title || !platformBar || !wofBar || !bgLayer) {
        console.error('Missing elements for transition');
        return;
    }

    const wofTitleBar = document.getElementById('wof-title-bar');
    const wofNameBar = document.getElementById('wof-name-bar');

    // PASUL 1: Hide platform bar
    platformBar.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    platformBar.style.opacity = '0';
    platformBar.style.transform = 'translateY(-100%)';

    // PASUL 2: Fade out content
    content.style.transition = 'opacity 0.3s ease';
    content.style.opacity = '0';

    // PASUL 3: Show background + title
    setTimeout(() => {
        bgLayer.classList.remove('hidden');
        title.classList.remove('hidden');
        requestAnimationFrame(() => {
            title.classList.add('visible');
        });
    }, 400);

    // PASUL 4: Title shrink
    setTimeout(() => {
        title.classList.add('shrink');
    }, 1500);

    // PASUL 5: Show WOF bar
    setTimeout(() => {
        platformBar.classList.add('hidden');

        if (wofTitleBar) wofTitleBar.style.opacity = '0';
        if (wofNameBar) wofNameBar.style.opacity = '0';

        wofBar.classList.remove('hidden');
        wofBar.style.opacity = '0';
        wofBar.style.transform = 'translateY(-100%)';

        requestAnimationFrame(() => {
            wofBar.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            wofBar.style.opacity = '1';
            wofBar.style.transform = 'translateY(0)';

            setTimeout(() => {
                if (wofTitleBar) {
                    wofTitleBar.style.transition = 'opacity 0.3s ease';
                    wofTitleBar.style.opacity = '1';
                }
                if (wofNameBar) {
                    wofNameBar.style.transition = 'opacity 0.3s ease';
                    wofNameBar.style.opacity = '1';
                }
            }, 200);
        });

        content.classList.add('wof-active');

        // WOF Info
        if (typeof WofInfo !== 'undefined') {
            new WofInfo().render(content);
        } else {
            content.innerHTML = '<div class="wof-page"><h1>⚔️ World Of Fights</h1></div>';
        }

        document.querySelectorAll('#top-bar-wof .menu-link').forEach(l => {
            l.classList.toggle('active', l.dataset.wof === 'info');
        });

        setTimeout(() => {
            content.style.opacity = '1';
        }, 100);
    }, 2300);

    // PASUL 6: Hide flying title
    setTimeout(() => {
        title.classList.add('hidden');
        title.classList.remove('visible', 'shrink');

        title.style.transition = 'none';
        title.style.top = '50%';
        title.style.left = '50%';
        title.style.transform = 'translate(-50%, -50%) scale(1)';
        title.style.opacity = '0';
        title.style.color = 'var(--accent)';
        title.style.letterSpacing = '8px';
    }, 2900);
}

// ============================================================
//  WOF MENU
// ============================================================
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

            showWofView(link.dataset.wof);
        });
    });
}

function showWofView(view) {
    currentWofView = view;
    const content = document.getElementById('content-area');

    try {
        if (view === 'shop' && typeof WofShop !== 'undefined') new WofShop().render(content);
        else if (view === 'market' && typeof WofMarket !== 'undefined') new WofMarket().render(content);
        else if (view === 'chat' && typeof WofChat !== 'undefined') new WofChat().render(content);
        else if (view === 'info' && typeof WofInfo !== 'undefined') new WofInfo().render(content);
        else content.innerHTML = '<div class="wof-page"><h1>Coming soon</h1></div>';
    } catch (err) {
        console.error('WOF view error:', err);
        content.innerHTML = '<div class="wof-page"><h1>Error loading view</h1></div>';
    }
}

// ============================================================
//  WOF BACK
// ============================================================
function initWofBackBtn() {
    const btn = document.getElementById('wof-back-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const wofBar = document.getElementById('top-bar-wof');
        const platformBar = document.getElementById('top-bar-platform');
        const bgLayer = document.getElementById('background-layer');
        const content = document.getElementById('content-area');

        content.style.opacity = '0';
        wofBar.style.opacity = '0';
        wofBar.style.transform = 'translateY(-100%)';

        setTimeout(() => {
            wofBar.classList.add('hidden');
            bgLayer.classList.add('hidden');
            content.classList.remove('wof-active');

            platformBar.classList.remove('hidden');
            platformBar.style.opacity = '0';
            platformBar.style.transform = 'translateY(-100%)';

            requestAnimationFrame(() => {
                platformBar.style.opacity = '1';
                platformBar.style.transform = 'translateY(0)';
            });

            showPlatformView('games');
            content.style.opacity = '1';
        }, 400);
    });
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

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            showToast('Settings saved!', 'success');
            modal.classList.add('hidden');
        });
    }
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
                currentUser.luna = luna;
                const el = document.getElementById('wof-luna');
                if (el) el.textContent = luna;
                localStorage.setItem('wof_session', JSON.stringify(currentUser));
            } else if (msg.startsWith('LITS_UPDATE:')) {
                const lits = parseInt(msg.substring(12));
                currentUser.lits = lits;
                const el = document.getElementById('wof-lits');
                if (el) el.textContent = lits;
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
    if (!overlay) return;

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
    if (!container) return;

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
