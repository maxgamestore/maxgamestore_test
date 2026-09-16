// ============================================================
//  CONFIG
// ============================================================
const SERVER_URL = "https://trimmer-chrome-landfall.ngrok-free.dev";
const API = SERVER_URL + "/api";
const LANG_PATH = "../assets/languages";

// ============================================================
//  STATE
// ============================================================
let currentUser = null;
let currentLang = "en";
let translations = {};
let supportedLanguages = [];
let lunaInterval = null;

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await initLanguage();
    await checkSession();
    await loadFeed();
    initMenuLinks();
    initLogout();
    initProfile();
    initNewPost();
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
            // Încearcă auto-login (refresh token)
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

        // Update UI
        updateUI();
        await loadLuna();
        await loadLits();
        await loadRank();

    } catch (err) {
        console.error('Session check failed:', err);
        if (currentUser) {
            updateUI();
        }
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

    // Rank
    const rankEl = document.getElementById('main-rank');
    if (rankEl) {
        const rank = (currentUser.rank || 'user').toLowerCase();
        rankEl.textContent = rank.toUpperCase();
        rankEl.className = 'user-rank ' + rank;
    }

    // Ascunde butonul "New Post" dacă nu e admin/owner/dev
    const rank = (currentUser.rank || 'user').toLowerCase();
    if (rank === 'admin' || rank === 'owner' || rank === 'developer') {
        document.getElementById('new-post-btn').classList.remove('hidden');
    }
}

// ============================================================
//  LOAD LUNA
// ============================================================
async function loadLuna() {
    if (!currentUser) return;
    try {
        const res = await fetch(API + '/luna/' + currentUser.username);
        const data = await res.json();

        if (data.luna !== undefined) {
            document.getElementById('main-luna').textContent = data.luna;
            currentUser.luna = data.luna;
            localStorage.setItem('wof_session', JSON.stringify(currentUser));
        }
    } catch (err) {
        console.error('Failed to load Luna:', err);
    }
}

// ============================================================
//  LOAD LITS
// ============================================================
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
    } catch (err) {
        console.error('Failed to load Lits:', err);
    }
}

// ============================================================
//  LOAD RANK
// ============================================================
async function loadRank() {
    if (!currentUser) return;
    try {
        const res = await fetch(API + '/get-rank/' + currentUser.username);
        const data = await res.json();

        if (data.rank) {
            currentUser.rank = data.rank;
            localStorage.setItem('wof_session', JSON.stringify(currentUser));

            const rankEl = document.getElementById('main-rank');
            if (rankEl) {
                const rank = data.rank.toLowerCase();
                rankEl.textContent = rank.toUpperCase();
                rankEl.className = 'user-rank ' + rank;
            }

            if (rank === 'admin' || rank === 'owner' || rank === 'developer') {
                document.getElementById('new-post-btn').classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error('Failed to load rank:', err);
    }
}

// ============================================================
//  AUTO-REFRESH LUNA
// ============================================================
function startLunaRefresh() {
    lunaInterval = setInterval(() => {
        if (currentUser) {
            loadLuna();
            loadLits();
        }
    }, 30000);
}

// ============================================================
//  LOAD FEED (POSTS)
// ============================================================
async function loadFeed() {
    const feedList = document.getElementById('feed-list');
    if (!feedList) return;

    try {
        const res = await fetch(API + '/posts');
        const data = await res.json();

        feedList.innerHTML = '';

        if (!data.posts || data.posts.length === 0) {
            feedList.innerHTML = `
                <div class="feed-empty">
                    <p>No posts yet. Check back later!</p>
                </div>
            `;
            return;
        }

        data.posts.forEach(post => {
            feedList.appendChild(createPostCard(post));
        });

    } catch (err) {
        console.error('Failed to load feed:', err);
        feedList.innerHTML = `
            <div class="feed-empty">
                <p>Failed to load feed.</p>
            </div>
        `;
    }
}

// ============================================================
//  CREATE POST CARD
// ============================================================
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';

    const rank = (post.rank || 'user').toLowerCase();
    const avatar = getAvatar(rank);
    const timeAgo = getTimeAgo(post.timestamp);

    card.innerHTML = `
        <div class="post-header">
            <div class="post-author">
                <span class="post-avatar">${avatar}</span>
                <span class="post-username">${escapeHtml(post.username)}</span>
                <span class="post-rank-badge ${rank}">${rank.toUpperCase()}</span>
            </div>
            <span class="post-time">${timeAgo}</span>
        </div>
        <div class="post-message">${escapeHtml(post.message)}</div>
        <div class="post-footer">
            <span class="post-action">❤️ ${post.likes || 0}</span>
            <span class="post-action">💬 ${post.comments || 0}</span>
            <span class="post-action">🔄 Share</span>
        </div>
    `;

    return card;
}

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
//  MENU LINKS
// ============================================================
function initMenuLinks() {
    document.querySelectorAll('.menu-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const menu = link.dataset.menu;
            if (menu) {
                e.preventDefault();
                alert('📌 ' + menu.toUpperCase() + ' coming soon!');
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

        const confirmed = confirm('Are you sure you want to logout?');
        if (!confirmed) return;

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

        localStorage.removeItem('wof_session');
        window.location.href = '../login/login.html';
    });
}

// ============================================================
//  PROFILE
// ============================================================
function initProfile() {
    const usernameEl = document.getElementById('main-username');
    if (usernameEl) {
        usernameEl.style.cursor = 'pointer';
        usernameEl.addEventListener('click', openProfile);
    }
}

function openProfile() {
    if (!currentUser) return;

    document.getElementById('p-username').textContent = currentUser.username || '-';
    document.getElementById('p-rank').textContent = (currentUser.rank || 'user').toUpperCase();
    document.getElementById('p-email').textContent = currentUser.email || '-';
    document.getElementById('p-luna').textContent = currentUser.luna || 100;
    document.getElementById('p-lits').textContent = currentUser.lits || 0;

    document.getElementById('profile-modal').classList.remove('hidden');
}

// ============================================================
//  NEW POST
// ============================================================
function initNewPost() {
    const btn = document.getElementById('new-post-btn');
    const modal = document.getElementById('new-post-modal');
    const form = document.getElementById('new-post-form');
    const textarea = document.getElementById('post-message');
    const charCount = document.getElementById('post-char-count');

    if (!btn || !modal || !form) return;

    btn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        textarea.focus();
    });

    // Close modal
    modal.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', () => {
            modal.classList.add('hidden');
            form.reset();
            charCount.textContent = '0';
        });
    });

    // Char count
    textarea.addEventListener('input', () => {
        charCount.textContent = textarea.value.length;
    });

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const message = textarea.value.trim();
        if (!message) return;

        const submitBtn = form.querySelector('.btn-primary');
        submitBtn.disabled = true;
        submitBtn.textContent = '...';

        try {
            const res = await fetch(API + '/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    token: currentUser.token,
                    message: message
                })
            });
            const data = await res.json();

            if (data.success) {
                modal.classList.add('hidden');
                form.reset();
                charCount.textContent = '0';
                await loadFeed();
            } else {
                alert('Error: ' + (data.error || 'Failed'));
            }
        } catch (err) {
            alert('Server error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'POST';
        }
    });
}

// ============================================================
//  LANGUAGE
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLanguageDropdown();
    });
}

function closeLanguageDropdown() {
    document.getElementById('lang-dropdown')?.classList.add('hidden');
    document.getElementById('lang-btn')?.classList.remove('open');
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
//  CLEANUP
// ============================================================
window.addEventListener('beforeunload', () => {
    if (lunaInterval) clearInterval(lunaInterval);
});
