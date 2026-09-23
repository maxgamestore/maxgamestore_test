
// ============================================================
//  WOF MARKET (Community items - Luna)
// ============================================================
class WofMarket {
    render(container) {
        container.innerHTML = `
            <div class="wof-page wof-market-page">
                <h1>🌙 Community Market</h1>
                <p>Buy items created by the community using Luna</p>

                <div class="market-balance">
                    <span>💰 Your Luna:</span>
                    <strong id="market-luna">${currentUser.luna || 100}</strong>
                </div>

                <div class="market-filters">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="character">Characters</button>
                    <button class="filter-btn" data-filter="accessory">Accessories</button>
                    <button class="filter-btn" data-filter="weapon">Weapons</button>
                </div>

                <div class="market-grid" id="market-grid">
                    <div class="market-empty">
                        <p>🛒 Market coming soon!</p>
                        <p style="font-size: 12px; margin-top: 10px;">Community items will appear here.</p>
                    </div>
                </div>
            </div>
        `;

        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
}
