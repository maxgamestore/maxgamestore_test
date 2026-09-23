
// ============================================================
//  WOF INFO
// ============================================================
class WofInfo {
    render(container) {
        container.innerHTML = `
            <div class="wof-page wof-info-page">
                <h1>⚔️ World Of Fights</h1>
                <p class="wof-version">Beta 0.0.1</p>

                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-icon">👥</div>
                        <div class="info-label">Players Online</div>
                        <div class="info-value" id="wof-info-players">0</div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon">🌍</div>
                        <div class="info-label">Total Accounts</div>
                        <div class="info-value" id="wof-info-accounts">0</div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon">💬</div>
                        <div class="info-label">Chat Messages</div>
                        <div class="info-value" id="wof-info-chat">0</div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon">⏰</div>
                        <div class="info-label">Next Update</div>
                        <div class="info-value" id="wof-info-update">None</div>
                    </div>
                </div>

                <div class="info-section">
                    <h2>📖 About The Game</h2>
                    <p>World Of Fights is a 2D multiplayer fighting game with real-time combat, custom skins, and multiple worlds to explore.</p>
                </div>

                <div class="info-section">
                    <h2>🎮 Features</h2>
                    <div class="features-list">
                        <div class="feature-item">✅ Real-time PvP Combat</div>
                        <div class="feature-item">✅ Multiple Worlds</div>
                        <div class="feature-item">✅ Custom Skins</div>
                        <div class="feature-item">✅ Trade System</div>
                        <div class="feature-item">✅ Global Chat</div>
                        <div class="feature-item">✅ Rank System</div>
                        <div class="feature-item">✅ Friends System</div>
                        <div class="feature-item">✅ Luna & Lits Currency</div>
                    </div>
                </div>

                <div class="info-section">
                    <h2>📋 Patch Notes - Beta 0.0.1</h2>
                    <ul class="patch-notes">
                        <li>🎉 First beta release!</li>
                        <li>⚔️ Combat system with 5 swords</li>
                        <li>🌍 World exploration</li>
                        <li>💬 Global chat</li>
                        <li>👥 Friends system</li>
                        <li>💰 Luna currency</li>
                    </ul>
                </div>
            </div>
        `;

        this.loadStats();
    }

    async loadStats() {
        try {
            const res = await fetch(API + '/health');
            const data = await res.json();
            const pl = document.getElementById('wof-info-players');
            const ac = document.getElementById('wof-info-accounts');
            if (pl) pl.textContent = data.players || 0;
            if (ac) ac.textContent = data.accounts || 0;
        } catch (err) {}
    }
}
