// ============================================================
//  CONFIG
// ============================================================
const SERVER_URL = "https://trimmer-chrome-landfall.ngrok-free.dev";
const API = SERVER_URL + "/api";
const WS_URL = "wss://trimmer-chrome-landfall.ngrok-free.dev";

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
let activeTab = 'about';
let globalMsgTimeout = null;

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    await loadFeed();
    await loadChat();
    await loadUserSettings();
    await loadChatPermissions();
    await loadCustomRanks();
    
    initMenuLinks();
    initLogout();
    initProfile();
    initSettings();
    initAdminPanel();
    initBottomTabs();
    initChatInput();
    initNewPost();
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
        await loadRank();

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

    const rankEl = document.getElementById('main-rank');
    if (rankEl) {
        const rank = (currentUser.rank || 'user').toLowerCase();
        rankEl.textContent = rank.toUpperCase();
        rankEl.className = 'user-rank ' + rank;
    }

    const rank = (currentUser.rank || 'user').toLowerCase();
    if (rank === 'admin' || rank === 'owner' || rank === 'developer') {
        document.getElementById('new-post-btn').classList.remove('hidden');
    }
    if (rank === 'admin' || rank === 'owner') {
        document.getElementById('admin-btn').style.display = '';
    }
}

// ============================================================
//  LOAD LUNA / LITS / RANK
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

async function loadRank() {
    if (!currentUser) return;
    try {
        const res = await fetch(API + '/get-rank/' + currentUser.username);
        const data = await res.json();
        if (data.rank) {
            currentUser.rank = data.rank;
            localStorage.setItem('wof_session', JSON.stringify(currentUser));
            updateUI();
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
//  FEED
// ============================================================
async function loadFeed() {
    const feedList = document.getElementById('feed-list');
    if (!feedList) return;

    try {
        const res = await fetch(API + '/posts');
        const data = await res.json();
        feedList.innerHTML = '';

        if (!data.posts || data.posts.length === 0) {
            feedList.innerHTML = '<div class="feed-empty"><p>No posts yet. Check back later!</p></div>';
            return;
        }

        data.posts.forEach(post => {
            feedList.appendChild(createPostCard(post));
        });
    } catch (err) {
        feedList.innerHTML = '<div class="feed-empty"><p>Failed to load feed.</p></div>';
    }
}

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
        const res = await fetch(API + '/chat/posts?' + params);
        const data = await res.json();

        if (data.error) {
            chatPosts.innerHTML = `<div class="chat-empty"><p>${data.error}</p></div>`;
            return;
        }

        chatPosts.innerHTML = '';
        if (!data.posts || data.posts.length === 0) {
            chatPosts.innerHTML = '<div class="chat-empty"><p>No messages yet.</p></div>';
        } else {
            data.posts.forEach(post => {
                chatPosts.appendChild(createChatPost(post));
            });
        }

        // Arată/ascunde input
        const inputSection = document.getElementById('chat-input-section');
        const noPerm = document.getElementById('chat-no-permission');
        if (data.canPost) {
            inputSection.classList.remove('hidden');
            noPerm.classList.add('hidden');
        } else {
            inputSection.classList.add('hidden');
            noPerm.classList.remove('hidden');
        }
    } catch (err) {
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

    // Bubble color
    const bubbleColor = currentSettings.bubbleColor || rankInfo.color || '#16161e';
    const borderColor = rankInfo.color || '#ffd700';

    // Header
    const header = document.createElement('div');
    header.className = 'chat-post-header';
    header.innerHTML = `
        <span class="chat-post-avatar">${avatar}</span>
        <span class="chat-post-username" style="color: ${borderColor};">${escapeHtml(post.username)}</span>
        <span class="chat-post-rank-badge" style="color: ${borderColor}; border: 1px solid ${borderColor}; background: ${hexToRgba(borderColor, 0.15)};">${rankInfo.name || rank.toUpperCase()}</span>
        <span class="chat-post-time">${timeAgo}</span>
    `;
    wrapper.appendChild(header);

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'chat-post-bubble';
    bubble.style.background = bubbleColor;
    bubble.style.borderColor = borderColor;

    // Text
    if (post.content && post.type === 'text') {
        const textEl = document.createElement('div');
        textEl.className = 'chat-post-text';
        textEl.textContent = post.content;
        bubble.appendChild(textEl);
    }

    // Code
    if (post.code) {
        const codeWrapper = document.createElement('div');
        codeWrapper.className = 'chat-post-code-wrapper';
        codeWrapper.innerHTML = `
            <div class="chat-post-code-header">
                <span>${post.codeLanguage || 'code'}</span>
                <button class="chat-post-code-copy">Copy</button>
            </div>
            <pre class="chat-post-code"><code class="language-${post.codeLanguage || 'plaintext'}">${escapeHtml(post.code)}</code></pre>
        `;
        bubble.appendChild(codeWrapper);
        // Highlight
        setTimeout(() => {
            const codeEl = codeWrapper.querySelector('code');
            if (window.hljs) hljs.highlightElement(codeEl);
            codeWrapper.querySelector('.chat-post-code-copy').addEventListener('click', () => {
                navigator.clipboard.writeText(post.code);
                showToast('Copied to clipboard', 'success');
            });
        }, 50);
    }

    // Image
    if (post.image) {
        const img = document.createElement('img');
        img.className = 'chat-post-image';
        img.src = post.image;
        img.alt = 'image';
        img.addEventListener('click', () => window.open(post.image, '_blank'));
        bubble.appendChild(img);
    }

    // Link
    if (post.link) {
        const link = document.createElement('a');
        link.className = 'chat-post-link';
        link.href = post.link;
        link.target = '_blank';
        link.textContent = post.link;
        bubble.appendChild(link);
    }

    // File
    if (post.file) {
        const fileLink = document.createElement('a');
        fileLink.className = 'chat-post-file';
        fileLink.href = post.file.url || post.file;
        fileLink.target = '_blank';
        fileLink.innerHTML = `<span class="chat-post-file-icon">FILE</span><span class="chat-post-file-name">${escapeHtml(post.file.name || 'file')}</span>`;
        bubble.appendChild(fileLink);
    }

    wrapper.appendChild(bubble);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'chat-post-actions';

    const likeCount = (post.likes || []).length;
    const liked = (post.likes || []).includes(currentUser.username);

    const likeBtn = document.createElement('span');
    likeBtn.className = 'chat-post-action' + (liked ? ' liked' : '');
    likeBtn.innerHTML = `❤️ ${likeCount}`;
    likeBtn.addEventListener('click', () => likeChatPost(post.id));
    actions.appendChild(likeBtn);

    // Delete (autor sau staff)
    const canDelete = post.username === currentUser.username ||
        ['owner', 'admin', 'developer'].includes(currentUser.rank);
    if (canDelete) {
        const delBtn = document.createElement('span');
        delBtn.className = 'chat-post-action delete';
        delBtn.innerHTML = '🗑️ Delete';
        delBtn.addEventListener('click', () => deleteChatPost(post.id));
        actions.appendChild(delBtn);
    }

    wrapper.appendChild(actions);
    return wrapper;
}

// ============================================================
//  CHAT - SEND
// ============================================================
function initChatInput() {
    const sendBtn = document.getElementById('send-btn');
    const input = document.getElementById('chat-input');
    const toolImage = document.getElementById('tool-image');
    const toolLink = document.getElementById('tool-link');
    const toolCode = document.getElementById('tool-code');
    const toolFile = document.getElementById('tool-file');

    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    if (toolImage) toolImage.addEventListener('click', () => pickFile('image'));
    if (toolFile) toolFile.addEventListener('click', () => pickFile('file'));
    if (toolLink) toolLink.addEventListener('click', addLink);
    if (toolCode) toolCode.addEventListener('click', addCode);
}

function pickFile(type) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*' : '*/*';
    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];
            try {
                const res = await fetch(API + '/chat/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUser.username,
                        token: currentUser.token,
                        fileData: base64,
                        fileName: file.name,
                        fileType: file.type
                    })
                });
                const data = await res.json();
                if (data.success) {
                    pendingAttachments.push({
                        type: data.type,
                        url: data.url,
                        name: data.fileName
                    });
                    renderAttachments();
                } else {
                    showToast(data.error || 'Upload failed', 'error');
                }
            } catch (err) {
                showToast('Upload failed', 'error');
            }
        };
        reader.readAsDataURL(file);
    });
    input.click();
}

function addLink() {
    const link = prompt('Enter URL:');
    if (link && link.startsWith('http')) {
        pendingAttachments.push({ type: 'link', url: link });
        renderAttachments();
    }
}

function addCode() {
    const lang = prompt('Language (python, cpp, java, javascript, etc.):', 'python') || 'plaintext';
    const code = prompt('Paste your code:');
    if (code) {
        pendingAttachments.push({ type: 'code', code, language: lang });
        renderAttachments();
    }
}

function renderAttachments() {
    const container = document.getElementById('chat-attachments');
    if (!container) return;
    container.innerHTML = '';
    pendingAttachments.forEach((att, i) => {
        const el = document.createElement('div');
        el.className = 'attachment-preview';
        let label = '';
        if (att.type === 'image') label = 'Image: ' + (att.name || 'image');
        else if (att.type === 'file') label = 'File: ' + (att.name || 'file');
        else if (att.type === 'link') label = 'Link: ' + att.url;
        else if (att.type === 'code') label = 'Code: ' + att.language;
        el.innerHTML = `<span>${escapeHtml(label)}</span><span class="remove-attachment">×</span>`;
        el.querySelector('.remove-attachment').addEventListener('click', () => {
            pendingAttachments.splice(i, 1);
            renderAttachments();
        });
        container.appendChild(el);
    });
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (!text && pendingAttachments.length === 0) return;

    const payload = {
        username: currentUser.username,
        token: currentUser.token,
        type: 'text',
        content: text || ''
    };

    // Adaugă atașamentele
    pendingAttachments.forEach(att => {
        if (att.type === 'image') {
            payload.image = att.url;
            payload.type = 'image';
        } else if (att.type === 'file') {
            payload.file = { url: att.url, name: att.name };
            payload.type = 'file';
        } else if (att.type === 'link') {
            payload.link = att.url;
            payload.type = 'link';
        } else if (att.type === 'code') {
            payload.code = att.code;
            payload.codeLanguage = att.language;
            payload.type = 'code';
        }
    });

    try {
        const res = await fetch(API + '/chat/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            input.value = '';
            pendingAttachments = [];
            renderAttachments();
            // Postarea va veni prin WebSocket
        } else {
            showToast(data.error || 'Failed to send', 'error');
        }
    } catch (err) {
        showToast('Server error', 'error');
    }
}

async function likeChatPost(postId) {
    try {
        await fetch(API + '/chat/like/' + postId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser.username,
                token: currentUser.token
            })
        });
    } catch (err) {}
}

async function deleteChatPost(postId) {
    if (!confirm('Delete this post?')) return;
    try {
        const params = new URLSearchParams({
            username: currentUser.username,
            token: currentUser.token
        });
        const res = await fetch(API + '/chat/posts/' + postId + '?' + params, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            showToast('Deleted', 'success');
        }
    } catch (err) {}
}

// ============================================================
//  BOTTOM TABS
// ============================================================
function initBottomTabs() {
    document.querySelectorAll('.bottom-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            activeTab = target;

            document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById('tab-' + target).classList.add('active');
        });
    });
}

// ============================================================
//  WEBSOCKET
// ============================================================
function initWebSocket() {
    if (!currentUser) return;

    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            const authMsg = `AUTH:${currentUser.token}:${currentUser.username}:${currentUser.sessionId}:Beta 0.0.1`;
            ws.send(authMsg);
        };

        ws.onmessage = (event) => {
            const msg = event.data;

            // CHAT_POST (JSON)
            try {
                const data = JSON.parse(msg);
                if (data.type === 'CHAT_POST') {
                    addChatPostRealtime(data.post);
                } else if (data.type === 'CHAT_DELETE') {
                    removeChatPostRealtime(data.postId);
                } else if (data.type === 'CHAT_LIKE') {
                    updateChatLikes(data.postId, data.likes);
                } else if (data.type === 'GLOBAL_MESSAGE') {
                    showGlobalMessage(data.from, data.message);
                } else if (data.type === 'CHAT_PERMISSIONS_UPDATE') {
                    chatPermissions = data.permissions;
                    loadChat();
                }
            } catch (e) {}

            // String events
            if (msg.startsWith('AUTH_SUCCESS')) {
                console.log('WS authenticated');
                ws.send('REGISTER_NAME:' + currentUser.username);
            } else if (msg.startsWith('LUNA_UPDATE:')) {
                const luna = parseInt(msg.substring(12));
                document.getElementById('main-luna').textContent = luna;
                currentUser.luna = luna;
                localStorage.setItem('wof_session', JSON.stringify(currentUser));
            } else if (msg.startsWith('LITS_UPDATE:')) {
                const lits = parseInt(msg.substring(12));
                document.getElementById('main-lits').textContent = lits;
                currentUser.lits = lits;
                localStorage.setItem('wof_session', JSON.stringify(currentUser));
            } else if (msg.startsWith('GIFT_RECEIVED:')) {
                const parts = msg.substring(14).split(':');
                showToast(`Received gift: ${parts[0]} Luna, ${parts[1]} Lits from ${parts[2]}`, 'success');
                loadLuna();
                loadLits();
            } else if (msg.startsWith('RANK_UPDATE:')) {
                const rank = msg.substring(12);
                currentUser.rank = rank;
                localStorage.setItem('wof_session', JSON.stringify(currentUser));
                updateUI();
                showToast('Your rank was updated to ' + rank, 'info');
            } else if (msg.startsWith('BANNED:')) {
                alert('You have been banned: ' + msg.substring(7));
                localStorage.removeItem('wof_session');
                window.location.href = '../login/login.html';
            }
        };

        ws.onclose = () => {
            console.log('WS disconnected. Reconnecting in 5s...');
            setTimeout(initWebSocket, 5000);
        };

        ws.onerror = (err) => console.error('WS error:', err);
    } catch (err) {
        console.error('WS init failed:', err);
    }
}

function addChatPostRealtime(post) {
    const chatPosts = document.getElementById('chat-posts');
    if (!chatPosts) return;
    // Elimină "empty" dacă există
    const empty = chatPosts.querySelector('.chat-empty');
    if (empty) empty.remove();
    chatPosts.insertBefore(createChatPost(post), chatPosts.firstChild);
}

function removeChatPostRealtime(postId) {
    const el = document.querySelector(`.chat-post[data-id="${postId}"]`);
    if (el) el.remove();
}

function updateChatLikes(postId, likes) {
    const el = document.querySelector(`.chat-post[data-id="${postId}"]`);
    if (!el) return;
    const likeBtn = el.querySelector('.chat-post-action');
    if (likeBtn) {
        const liked = likes.includes(currentUser.username);
        likeBtn.className = 'chat-post-action' + (liked ? ' liked' : '');
        likeBtn.innerHTML = `❤️ ${likes.length}`;
    }
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
    overlay.classList.remove('hidden', 'fade-out');

    if (globalMsgTimeout) clearTimeout(globalMsgTimeout);
    globalMsgTimeout = setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.classList.add('hidden'), 500);
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
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ============================================================
//  LOAD PERMISSIONS / RANKS / SETTINGS
// ============================================================
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

async function loadUserSettings() {
    if (!currentUser) return;
    try {
        const res = await fetch(API + '/user/settings/' + currentUser.username);
        currentSettings = await res.json();
    } catch (err) {
        currentSettings = {};
    }
}

function getRankInfo(rankId) {
    const defaults = {
        owner: { name: 'OWNER', color: '#ffd700', icon: '👑' },
        admin: { name: 'ADMIN', color: '#ff0044', icon: '⚙️' },
        developer: { name: 'DEVELOPER', color: '#33aaff', icon: '💻' },
        user: { name: 'USER', color: '#b0b0b8', icon: '👤' }
    };
    if (defaults[rankId]) return defaults[rankId];
    const custom = customRanks.find(r => r.rankId === rankId);
    if (custom) return { name: custom.name, color: custom.color, icon: custom.icon };
    return { name: rankId.toUpperCase(), color: '#b0b0b8', icon: '👤' };
}

// ============================================================
//  MENU / LOGOUT / PROFILE
// ============================================================
function initMenuLinks() {
    document.querySelectorAll('.menu-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const menu = link.dataset.menu;
            if (menu) {
                e.preventDefault();
                showToast(menu.toUpperCase() + ' coming soon', 'info');
            }
        });
    });

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
    document.getElementById('p-username').textContent = currentUser.username || '-';
    document.getElementById('p-rank').textContent = (currentUser.rank || 'user').toUpperCase();
    document.getElementById('p-email').textContent = currentUser.email || '-';
    document.getElementById('p-luna').textContent = currentUser.luna || 100;
    document.getElementById('p-lits').textContent = currentUser.lits || 0;
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
        // Populate
        document.getElementById('setting-bubble-color').value = currentSettings.bubbleColor || '#16161e';
        document.getElementById('setting-theme').value = currentSettings.theme || 'dark';
        document.getElementById('setting-font-size').value = currentSettings.fontSize || 'medium';
        document.getElementById('setting-notifications').checked = currentSettings.notifications !== false;

        modal.classList.remove('hidden');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const settings = {
            bubbleColor: document.getElementById('setting-bubble-color').value,
            theme: document.getElementById('setting-theme').value,
            fontSize: document.getElementById('setting-font-size').value,
            notifications: document.getElementById('setting-notifications').checked
        };

        try {
            const res = await fetch(API + '/user/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    token: currentUser.token,
                    settings
                })
            });
            const data = await res.json();
            if (data.success) {
                currentSettings = data.settings;
                modal.classList.add('hidden');
                showToast('Settings saved', 'success');
                loadChat();
            }
        } catch (err) {
            showToast('Failed to save', 'error');
        }
    });
}

// ============================================================
//  ADMIN PANEL
// ============================================================
function initAdminPanel() {
    const btn = document.getElementById('admin-btn');
    const modal = document.getElementById('admin-modal');

    if (!btn || !modal) return;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
        renderCustomRanksList();
    });

    // Tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.adminTab;
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('admin-' + target).classList.add('active');
        });
    });

    // Global message
    document.getElementById('send-global-btn').addEventListener('click', async () => {
        const message = document.getElementById('global-message-input').value.trim();
        if (!message) return;

        try {
            const res = await fetch(API + '/admin/global-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    token: currentUser.token,
                    message
                })
            });
            const data = await res.json();
            if (data.success) {
                document.getElementById('global-message-input').value = '';
                showToast('Global message sent', 'success');
            } else {
                showToast(data.error || 'Failed', 'error');
            }
        } catch (err) {
            showToast('Server error', 'error');
        }
    });

    // Gift
    document.getElementById('send-gift-btn').addEventListener('click', async () => {
        const targetUser = document.getElementById('gift-username').value.trim();
        const lunaAmount = parseInt(document.getElementById('gift-luna').value) || 0;
        const litsAmount = parseInt(document.getElementById('gift-lits').value) || 0;

        if (!targetUser) return showToast('Enter username', 'error');

        try {
            const res = await fetch(API + '/admin/gift', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    token: currentUser.token,
                    targetUser,
                    lunaAmount,
                    litsAmount
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Gift sent', 'success');
            } else {
                showToast(data.error || 'Failed', 'error');
            }
        } catch (err) {}
    });

    // Set rank
    document.getElementById('set-rank-btn').addEventListener('click', async () => {
        const targetUser = document.getElementById('rank-username').value.trim();
        const newRank = document.getElementById('rank-select').value;
        if (!targetUser) return showToast('Enter username', 'error');

        try {
            const res = await fetch(API + '/admin/set-rank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    token: currentUser.token,
                    targetUser,
                    newRank
                })
            });
            const data = await res.json();
            if (data.success) showToast('Rank updated', 'success');
            else showToast(data.error || 'Failed', 'error');
        } catch (err) {}
    });

    // Ban
    document.getElementById('ban-user-btn').addEventListener('click', async () => {
        const targetUser = document.getElementById('ban-username').value.trim();
        const reason = document.getElementById('ban-reason').value.trim();
        const duration = parseInt(document.getElementById('ban-duration').value) || null;
        if (!targetUser) return showToast('Enter username', 'error');

        try {
            const res = await fetch(API + '/admin/ban', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    token: currentUser.token,
                    targetUser,
                    reason,
                    duration
                })
            });
            const data = await res.json();
            if (data.success) showToast('User banned', 'success');
            else showToast(data.error || 'Failed', 'error');
        } catch (err) {}
    });

    // Create custom rank
    document.getElementById('create-rank-btn').addEventListener('click', async () => {
        const rankId = document.getElementById('custom-rank-id').value.trim();
        const name = document.getElementById('custom-rank-name').value.trim();
        const color = document.getElementById('custom-rank-color').value;
        const icon = document.getElementById('custom-rank-icon').value.trim() || '⭐';

        if (!rankId || !name) return showToast('Fill rankId and name', 'error');

        const permissions = {};
        document.querySelectorAll('.permissions-list input[type="checkbox"]').forEach(cb => {
            permissions[cb.dataset.perm] = cb.checked;
        });

        try {
            const res = await fetch(API + '/ranks/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    token: currentUser.token,
                    rankId,
                    name,
                    color,
                    icon,
                    permissions
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Custom rank created', 'success');
                await loadCustomRanks();
                renderCustomRanksList();
                // Update rank select
                updateRankSelect();
            } else {
                showToast(data.error || 'Failed', 'error');
            }
        } catch (err) {}
    });
}

function renderCustomRanksList() {
    const list = document.getElementById('custom-ranks-list');
    if (!list) return;
    list.innerHTML = '';

    if (customRanks.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted); font-size:12px;">No custom ranks yet.</p>';
        return;
    }

    customRanks.forEach(rank => {
        const el = document.createElement('div');
        el.className = 'custom-rank-item';
        el.innerHTML = `
            <span class="custom-rank-icon">${rank.icon}</span>
            <span class="custom-rank-name" style="color: ${rank.color};">${escapeHtml(rank.name)}</span>
            <span class="custom-rank-id">${rank.rankId}</span>
            <button class="custom-rank-delete" data-id="${rank.rankId}">DELETE</button>
        `;
        el.querySelector('.custom-rank-delete').addEventListener('click', () => deleteCustomRank(rank.rankId));
        list.appendChild(el);
    });
}

async function deleteCustomRank(rankId) {
    if (!confirm('Delete rank ' + rankId + '?')) return;
    try {
        const params = new URLSearchParams({
            username: currentUser.username,
            token: currentUser.token
        });
        const res = await fetch(API + '/ranks/custom/' + rankId + '?' + params, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            showToast('Rank deleted', 'success');
            await loadCustomRanks();
            renderCustomRanksList();
            updateRankSelect();
        }
    } catch (err) {}
}

function updateRankSelect() {
    const select = document.getElementById('rank-select');
    if (!select) return;
    // Păstrează opțiunile de bază
    select.innerHTML = `
        <option value="user">User</option>
        <option value="developer">Developer</option>
        <option value="admin">Admin</option>
        <option value="owner">Owner</option>
    `;
    customRanks.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.rankId;
        opt.textContent = r.name + ' (' + r.rankId + ')';
        select.appendChild(opt);
    });
}

// ============================================================
//  NEW POST (feed)
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

    textarea.addEventListener('input', () => {
        charCount.textContent = textarea.value.length;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = textarea.value.trim();
        if (!message) return;

        const submitBtn = form.querySelector('.btn-primary');
        submitBtn.disabled = true;

        try {
            const res = await fetch(API + '/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    token: currentUser.token,
                    message
                })
            });
            const data = await res.json();

            if (data.success) {
                modal.classList.add('hidden');
                form.reset();
                charCount.textContent = '0';
                await loadFeed();
            } else {
                showToast(data.error || 'Failed', 'error');
            }
        } catch (err) {
            showToast('Server error', 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });
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

function hexToRgba(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return `rgba(255, 215, 0, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================
//  CLEANUP
// ============================================================
window.addEventListener('beforeunload', () => {
    if (lunaInterval) clearInterval(lunaInterval);
    if (ws) ws.close();
});
