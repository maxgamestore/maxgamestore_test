
// ============================================================
//  WOF SHOP (Calendar + In-game products)
// ============================================================
class WofShop {
    render(container) {
        container.innerHTML = `
            <div class="wof-page wof-shop-page">
                <h1>🛒 World Of Fights Shop</h1>
                <p>Buy exclusive items and limited event content</p>

                <h2 class="shop-section-title">🎄 Limited Event Calendar</h2>
                <div class="event-calendar">
                    <div class="event-card locked">
                        <div class="event-icon">🎃</div>
                        <div class="event-name">Halloween 2026</div>
                        <div class="event-status">Coming October</div>
                    </div>
                    <div class="event-card locked">
                        <div class="event-icon">🎄</div>
                        <div class="event-name">Christmas 2026</div>
                        <div class="event-status">Coming December</div>
                    </div>
                    <div class="event-card locked">
                        <div class="event-icon">🐰</div>
                        <div class="event-name">Easter 2027</div>
                        <div class="event-status">Coming April</div>
                    </div>
                </div>

                <h2 class="shop-section-title">🎁 In-Game Products</h2>
                <div class="shop-grid">
                    <div class="shop-item">
                        <div class="shop-item-icon">⚔️</div>
                        <div class="shop-item-name">Premium Sword Pack</div>
                        <div class="shop-item-price">💵 500 Gems</div>
                        <button class="shop-item-buy">Buy Now</button>
                    </div>
                    <div class="shop-item">
                        <div class="shop-item-icon">🛡️</div>
                        <div class="shop-item-name">Armor Bundle</div>
                        <div class="shop-item-price">💵 300 Gems</div>
                        <button class="shop-item-buy">Buy Now</button>
                    </div>
                    <div class="shop-item">
                        <div class="shop-item-icon">💎</div>
                        <div class="shop-item-name">1000 Lits</div>
                        <div class="shop-item-price">💵 200 Gems</div>
                        <button class="shop-item-buy">Buy Now</button>
                    </div>
                    <div class="shop-item">
                        <div class="shop-item-icon">🏆</div>
                        <div class="shop-item-name">Battle Pass S1</div>
                        <div class="shop-item-price">💵 1000 Gems</div>
                        <button class="shop-item-buy">Buy Now</button>
                    </div>
                </div>
            </div>
        `;

        container.querySelectorAll('.shop-item-buy').forEach(btn => {
            btn.addEventListener('click', () => showToast('Purchase coming soon!', 'info'));
        });
    }
}
