// ============================================================
//  WORLD OF FIGHTS - MAIN
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
let chatPermissions = {};
let customRanks = [];
let ws = null;
let lunaInterval = null;
let pendingAttachments = [];
let globalMsgTimeout = null;
let currentMarketFilter = 'all';
let pendingPurchase = null;

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    await loadChat();
    await loadUserSettings();
    await loadChatPermissions();
    await loadCustomRanks();

    initMenuLinks();
    initLogout();
    initProfile();
    initSettings();
    initBottomTabs();
    initChatInput();
    initMarketFilters();
    initPurchaseModal();
    initWebSocket();

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

    document.getElementById('main-username').textContent = currentUser.username || 'Player';
    document.getElementById('main-luna').textContent = currentUser.luna || 100;
    document.getElementById('main-lits').textContent = currentUser.lits || 0;
    document.getElementById('main-gems').textContent = currentUser.gems || 0;
    document.getElementById('market-luna').textContent = currentUser.luna || 100;

    const rankEl = document.getElementById('main-rank');
    if (rankEl) {
        const rank = (currentUser.rank || 'user').toLowerCase();
        rankEl.textContent = rank.toUpperCase();
        rankEl.className = 'user-rank ' + rank;
    }

    const rank = (currentUser.rank || 'user').toLowerCase();
    if (rank === 'admin' || rank === 'owner') {
        document.getElementById('admin-btn').style.display = '';
    }
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
            document.getElementById('main-luna').textContent = data.luna;
            document.getElementById('market-luna').textContent = data.luna;
            currentUser.luna = data.luna;
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
            document.getElementById('main-lits').textContent = data.lits;
            currentUser.lits = data.lits;
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
//  BOTTOM TABS
// ============================================================
function initBottomTabs() {
    document.querySelectorAll('.bottom-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById('tab-' + target).classList.add('active');

            if (target === 'info') loadInfo();
            if (target === 'shop') loadShop();
            if (target === 'market') loadMarket();
            if (target === 'chat') loadChat();
        });
    });
}

// ============================================================
//  LOAD INFO
// ============================================================
async function loadInfo() {
    try {
        const healthRes = await fetch(API + '/health');
        const health = await healthRes.json();
        document.getElementById('info-status').textContent = health.status === 'online' ? '🟢 Online' : '🔴 Offline';

        try {
            const statsRes = await fetch(API + '/global/stats');
            const stats = await statsRes.json();
            document.getElementById('info-accounts').textContent = stats.totalAccounts || 0;
            document.getElementById('info-players').textContent = stats.onlinePlayers || 0;
            document.getElementById('info-chat').textContent = stats.totalChatPosts || 0;
        } catch (e) {}

        document.getElementById('info-version').textContent = GAME_VERSION;

        const uptime = Math.floor(health.uptime || 0);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        document.getElementById('info-uptime').textContent = hours + 'h ' + minutes + 'm';

        try {
            const updateRes = await fetch(API + '/update/timer');
            const update = await updateRes.json();
            if (update.active && update.timeRemaining > 0) {
                const mins = Math.floor(update.timeRemaining / 60000);
                document.getElementById('info-update').textContent = mins + ' min';
            } else {
                document.getElementById('info-update').textContent = 'None';
            }
        } catch (e) {
            document.getElementById('info-update').textContent = 'None';
        }

    } catch (err) {
        console.error('Load info error:', err);
    }
}

// ============================================================
//  LOAD SHOP (BANI REALI)
// ============================================================
function loadShop() {
    const gemsData = [
        { icon: '💎', name: '100 Gems', price: '$0.99' },
        { icon: '💎', name: '500 Gems', price: '$3.99' },
        { icon: '💎', name: '1000 Gems', price: '$6.99' },
        { icon: '💎', name: '5000 Gems', price: '$29.99' }
    ];

    const gemsGrid = document.getElementById('shop-gems');
    gemsGrid.innerHTML = '';
    gemsData.forEach(item => {
        gemsGrid.appendChild(createShopItem(item, 'gems'));
    });

    const premiumData = [
        { icon: '⚔️', name: 'Excalibur Sword', price: '$4.99' },
        { icon: '🛡️', name: 'Dragon Armor', price: '$7.99' },
        { icon: '👑', name: 'Royal Crown', price: '$9.99' },
        { icon: '🔥', name: 'Fire Cape', price: '$5.99' }
    ];

    const premiumGrid = document.getElementById('shop-premium');
    premiumGrid.innerHTML = '';
    premiumData.forEach(item => {
        premiumGrid.appendChild(createShopItem(item, 'premium'));
    });

    const bpData = [
        { icon: '🏆', name: 'Season 1 Pass', price: '$9.99' },
        { icon: '🎖️', name: 'Premium Pass', price: '$19.99' },
        { icon: '⭐', name: 'Ultimate Pass', price: '$29.99' }
    ];

    const bpGrid = document.getElementById('shop-battlepass');
    bpGrid.innerHTML = '';
    bpData.forEach(item => {
        bpGrid.appendChild(createShopItem(item, 'battlepass'));
    });
}

function createShopItem(item, type) {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-price">${item.price}</div>
        <button class="shop-item-buy">Buy Now</button>
    `;

    div.querySelector('.shop-item-buy').addEventListener('click', () => {
        showToast('Payment coming soon!', 'info');
    });

    return div;
}

// ============================================================
//  LOAD MARKET (LUNA)
// ============================================================
async function loadMarket() {
    const marketGrid = document.getElementById('market-grid');
    if (!marketGrid) return;

    marketGrid.innerHTML = '<div class="chat-loading"><div class="spinner"></div><p>Loading market...</p></div>';

    try {
        const res = await fetch(API + '/market/items');
        const data = await res.json();

        const items = data.items || [];

        marketGrid.innerHTML = '';

        if (items.length === 0) {
            marketGrid.innerHTML = `
                <div class="chat-empty">
                    <p>🛒 Market is empty!</p>
                    <p style="margin-top: 10px; font-size: 12px;">Items will appear here soon.</p>
                </div>
            `;
            return;
        }

        items.forEach(item => {
            if (currentMarketFilter !== 'all' && item.category !== currentMarketFilter) return;
            marketGrid.appendChild(createMarketItem(item));
        });

    } catch (err) {
        console.error('Load market error:', err);
        marketGrid.innerHTML = `
            <div class="chat-empty">
                <p>⚠️ Market unavailable</p>
                <p style="margin-top: 10px; font-size: 12px;">Market is coming soon!</p>
            </div>
        `;
    }
}

function createMarketItem(item) {
    const div = document.createElement('div');
    div.className = 'market-item';

    const icon = item.category === 'character' ? '👤' :
                 item.category === 'accessory' ? '🎀' :
                 item.category === 'weapon' ? '⚔️' :
                 item.category === 'potion' ? '🧪' : '📦';

    const price = item.price || 100;
    const canAfford = (currentUser.luna || 100) >= price;

    div.innerHTML = `
        <div class="market-item-icon">${icon}</div>
        <div class="market-item-name">${escapeHtml(item.name || 'Item')}</div>
        <div class="market-item-author">by ${escapeHtml(item.author || 'System')}</div>
        <div class="market-item-price">💰 ${price} Luna</div>
        <button class="market-item-buy" ${canAfford ? '' : 'disabled'}>
            ${canAfford ? 'Buy' : 'Not enough Luna'}
        </button>
    `;

    const buyBtn = div.querySelector('.market-item-buy');
    if (canAfford) {
        buyBtn.addEventListener('click', () => showPurchaseModal(item));
    }

    return div;
}

function initMarketFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMarketFilter = btn.dataset.filter;
            loadMarket();
        });
    });
}

// ============================================================
//  PURCHASE MODAL
// ============================================================
function initPurchaseModal() {
    const confirmBtn = document.getElementById('confirm-purchase-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmPurchase);
    }
}

function showPurchaseModal(item) {
    pendingPurchase = item;

    document.getElementById('purchase-item-name').textContent = item.name || 'Item';
    document.getElementById('purchase-item-price').textContent = (item.price || 100) + ' Luna';
    document.getElementById('purchase-balance').textContent = (currentUser.luna || 100) + ' Luna';

    document.getElementById('purchase-modal').classList.remove('hidden');
}

async function confirmPurchase() {
    if (!pendingPurchase) return;

    const item = pendingPurchase;
    const price = item.price || 100;

    if ((currentUser.luna || 100) < price) {
        showToast('Not enough Luna!', 'error');
        return;
    }

    try {
        showToast('Purchase coming soon!', 'info');
        document.getElementById('purchase-modal').classList.add('hidden');
        pendingPurchase = null;
    } catch (err) {
        showToast('Purchase failed', 'error');
    }
}

// ============================================================
//  CHAT
// ============================================================
async function loadChat() {
    const chatPosts = document.getElementById('chat-posts');
    if (!chatPosts) return;

    try {
        const params = new URLSearchParams({
            username: currentUser?.username || '',
            token: currentUser?.token || ''
        });
        const res = await fetch(API + '/game-chat/messages?' + params);

        if (!res.ok) throw new Error('Server returned ' + res.status);

        const text = await res.text();
        if (!text || text.trim() === '') throw new Error('Empty response');

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            chatPosts.innerHTML = '<div class="chat-empty"><p>Server endpoint missing.</p></div>';
            return;
        }

        if (data.error) {
            chatPosts.innerHTML = `<div class="chat-empty"><p>${data.error}</p></div>`;
            return;
        }

        chatPosts.innerHTML = '';

        const posts = data.messages || data.posts || [];

        if (posts.length === 0) {
            chatPosts.innerHTML = '<div class="chat-empty"><p>No messages yet. Be the first!</p></div>';
        } else {
            posts.forEach(post => {
                chatPosts.appendChild(createChatPost(post));
            });
        }

        const inputSection = document.getElementById('chat-input-section');
        const noPerm = document.getElementById('chat-no-permission');

        if (data.canPost !== false) {
            inputSection.classList.remove('hidden');
            noPerm.classList.add('hidden');
        } else {
            inputSection.classList.add('hidden');
            noPerm.classList.remove('hidden');
        }

    } catch (err) {
        console.error('Load chat error:', err.message || err);
        chatPosts.innerHTML = '<div class="chat-empty"><p>Failed to load chat.</p></div>';
    }
}

function createChatPost(post) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-post';
    wrapper.dataset.id = post.id;

    const rank = (post.rank || 'user').toLowerCase();
    const avatar = getAvatar(rank);
    const rankInfo = getRankInfo(rank);
    const timeAgo = getTimeAgo(post.timestamp);

    const bubbleColor = currentSettings.bubbleColor || '#16161e';
    const borderColor = rankInfo.color || '#ffd700';

    const header = document.createElement('div');
    header.className = 'chat-post-header';
    header.innerHTML = `
        <span class="chat-post-avatar">${avatar}</span>
        <span class="chat-post-username" style="color: ${borderColor};">${escapeHtml(post.username)}</span>
        <span class="chat-post-rank-badge" style="color: ${borderColor}; border: 1px solid ${borderColor};">${rankInfo.name || rank.toUpperCase()}</span>
        <span class="chat-post-time">${timeAgo}</span>
    `;
    wrapper.appendChild(header);

    const bubble = document.createElement('div');
    bubble.className = 'chat-post-bubble';
    bubble.style.background = bubbleColor;
    bubble.style.borderColor = borderColor;

    if (post.content) {
        const textEl = document.createElement('div');
        textEl.className = 'chat-post-text';
        textEl.textContent = post.content;
        bubble.appendChild(textEl);
    }

    wrapper.appendChild(bubble);

    const actions = document.createElement('div');
    actions.className = 'chat-post-actions';

    const likes = post.likes || [];
    const liked = currentUser && likes.includes(currentUser.username);

    const likeBtn = document.createElement('span');
    likeBtn.className = 'chat-post-action' + (liked ? ' liked' : '');
    likeBtn.innerHTML = `❤️ ${likes.length}`;
    actions.appendChild(likeBtn);

    wrapper.appendChild(actions);
    return wrapper;
}

function initChatInput() {
    const sendBtn = document.getElementById('send-btn');
    const input = document.getElementById('chat-input');

    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (!text) return;

    try {
        const res = await fetch(API + '/game-chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser.username,
                token: currentUser.token,
                message: text,
                channel: 'global'
            })
        });
        const data = await res.json();

        if (data.success) {
            input.value = '';
            loadChat();
        } else {
            showToast(data.error || 'Failed to send', 'error');
        }
    } catch (err) {
        showToast('Server error', 'error');
    }
}

// ============================================================
//  MENU / LOGOUT / PROFILE
// ============================================================
function initMenuLinks() {
    const nameEl = document.getElementById('main-username');
    if (nameEl) nameEl.addEventListener('click', openProfile);
}

function initLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm('Are you sure you want to logout?')) return;

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
}

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
    document.getElementById('p-luna').textContent = currentUser.luna || 100;
    document.getElementById('p-lits').textContent = currentUser.lits || 0;
    document.getElementById('p-gems').textContent = currentUser.gems || 0;
    document.getElementById('profile-modal').classList.remove('hidden');
}

// ============================================================
//  SETTINGS
// ============================================================
function initSettings() {
    const btn = document.getElementById('settings-btn');
    const modal = document.getElementById('settings-modal');
    const form = document.getElementById('settings-form');

    if (!btn || !modal) return;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('setting-bubble-color').value = currentSettings.bubbleColor || '#16161e';
        modal.classList.remove('hidden');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showToast('Settings saved!', 'success');
        modal.classList.add('hidden');
    });
}

// ============================================================
//  LOAD SETTINGS
// ============================================================
async function loadUserSettings() {
    if (!currentUser) return;
    try {
        const res = await fetch(API + '/user/settings/' + currentUser.username);
        currentSettings = await res.json();
    } catch (err) {
        currentSettings = {};
    }
}

async function loadChatPermissions() {
    try {
        const res = await fetch(API + '/chat/permissions');
        chatPermissions = await res.json();
    } catch (err) {}
}

async function loadCustomRanks() {
    try {
        const res = await fetch(API + '/ranks/custom');
        const data = await res.json();
        customRanks = data.ranks || [];
    } catch (err) {}
}

function getRankInfo(rankId) {
    const defaults = {
        owner: { name: 'OWNER', color: '#ffd700', icon: '👑' },
        admin: { name: 'ADMIN', color: '#ff0044', icon: '⚙️' },
        developer: { name: 'DEVELOPER', color: '#33aaff', icon: '💻' },
        user: { name: 'USER', color: '#b0b0b8', icon: '👤' }
    };

    if (defaults[rankId]) return defaults[rankId];
    return { name: rankId.toUpperCase(), color: '#b0b0b8', icon: '👤' };
}

// ============================================================
//  WEBSOCKET
// ============================================================
function initWebSocket() {
    if (!currentUser) return;

    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            const authMsg = `AUTH:${currentUser.token}:${currentUser.username}:${currentUser.sessionId}:${GAME_VERSION}`;
            ws.send(authMsg);
        };

        ws.onmessage = (event) => {
            const msg = event.data;

            try {
                const data = JSON.parse(msg);
                if (data.type === 'GLOBAL_MESSAGE') {
                    showGlobalMessage(data.from, data.message);
                }
            } catch (e) {}

            if (msg.startsWith('AUTH_SUCCESS')) {
                console.log('✅ WS authenticated');
            } else if (msg.startsWith('LUNA_UPDATE:')) {
                const luna = parseInt(msg.substring(12));
                document.getElementById('main-luna').textContent = luna;
                document.getElementById('market-luna').textContent = luna;
                currentUser.luna = luna;
                localStorage.setItem('wof_session', JSON.stringify(currentUser));
            }
        };

        ws.onclose = () => {
            setTimeout(initWebSocket, 5000);
        };

    } catch (err) {}
}

// ============================================================
//  GLOBAL MESSAGE
// ============================================================
function showGlobalMessage(from, message) {
    const overlay = document.getElementById('global-message-overlay');
    const fromEl = document.getElementById('global-message-from');
    const textEl = document.getElementById('global-message-text');

    fromEl.textContent = from;
    textEl.textContent = message;
    overlay.classList.remove('hidden');

    if (globalMsgTimeout) clearTimeout(globalMsgTimeout);

    globalMsgTimeout = setTimeout(() => {
        overlay.classList.add('hidden');
    }, 5000);
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

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ============================================================
//  HELPERS
// ============================================================
function getAvatar(rank) {
    switch (rank) {
        case 'owner': return '👑';
        case 'admin': return '⚙️';
        case 'developer': return '💻';
        default: return '👤';
    }
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ============================================================
//  CLEANUP
// ============================================================
window.addEventListener('beforeunload', () => {
    if (lunaInterval) clearInterval(lunaInterval);
    if (ws) ws.close();
});
