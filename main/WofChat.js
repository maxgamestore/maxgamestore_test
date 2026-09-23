
// ============================================================
//  WOF CHAT
// ============================================================
class WofChat {
    render(container) {
        container.innerHTML = `
            <div class="wof-page wof-chat-page">
                <h1>💬 World Of Fights Chat</h1>
                <div class="chat-posts" id="wof-chat-posts">
                    <div class="chat-loading">
                        <div class="spinner"></div>
                        <p>Loading chat...</p>
                    </div>
                </div>
                <div class="chat-input-section">
                    <div class="chat-input-wrapper">
                        <textarea id="wof-chat-input" placeholder="Write a message..." maxlength="500"></textarea>
                        <div class="chat-input-toolbar">
                            <button class="tool-btn send-btn" id="wof-chat-send">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('wof-chat-send').addEventListener('click', () => this.sendMessage());
        document.getElementById('wof-chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.loadMessages();
    }

    async loadMessages() {
        const posts = document.getElementById('wof-chat-posts');
        if (!posts) return;

        try {
            const res = await fetch(API + '/game-chat/messages?limit=50');
            const data = await res.json();
            const messages = data.messages || [];

            posts.innerHTML = '';

            if (messages.length === 0) {
                posts.innerHTML = '<div class="chat-empty"><p>No messages yet. Be the first!</p></div>';
                return;
            }

            messages.forEach(msg => {
                posts.appendChild(this.createPost(msg));
            });
        } catch (err) {
            posts.innerHTML = '<div class="chat-empty"><p>Failed to load chat.</p></div>';
        }
    }

    createPost(post) {
        const div = document.createElement('div');
        div.className = 'chat-post';
        const rank = (post.rank || 'user').toLowerCase();
        const avatar = this.getAvatar(rank);
        const time = this.getTimeAgo(post.timestamp);

        div.innerHTML = `
            <div class="chat-post-header">
                <span class="chat-post-avatar">${avatar}</span>
                <span class="chat-post-username">${this.escape(post.username)}</span>
                <span class="chat-post-rank-badge">${rank.toUpperCase()}</span>
                <span class="chat-post-time">${time}</span>
            </div>
            <div class="chat-post-bubble">
                <div class="chat-post-text">${this.escape(post.content || post.message || '')}</div>
            </div>
        `;
        return div;
    }

    async sendMessage() {
        const input = document.getElementById('wof-chat-input');
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
                this.loadMessages();
            } else {
                showToast(data.error || 'Failed', 'error');
            }
        } catch (err) {
            showToast('Server error', 'error');
        }
    }

    getAvatar(rank) {
        return { owner: '👑', admin: '⚙️', developer: '💻' }[rank] || '👤';
    }

    getTimeAgo(ts) {
        const diff = Date.now() - ts;
        const s = Math.floor(diff / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        if (s < 60) return 'just now';
        if (m < 60) return m + 'm ago';
        if (h < 24) return h + 'h ago';
        return new Date(ts).toLocaleDateString();
    }

    escape(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}
