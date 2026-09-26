// ============================================================
//  WOF MENU — router pentru secțiunile WOF
// ============================================================
class WofMenu {
    constructor() {
        this.currentView = 'info';
    }

    // Randează meniul + view-ul curent în container
    render(container) {
        const target = container || document.getElementById('content-area');
        if (!target) {
            console.error('WofMenu: nu găsesc #content-area');
            return;
        }

        // Dacă avem container, desenăm și meniul intern (opțional)
        // Aici doar încărcăm view-ul cerut
        this.switchView(this.currentView, target);
    }

    // Schimbă view-ul WOF
    switchView(view, container) {
        this.currentView = view;
        const target = container || document.getElementById('content-area');

        // Marchează tab-ul activ în bara de sus
        document.querySelectorAll('#top-bar-wof .menu-link').forEach(l => {
            l.classList.toggle('active', l.dataset.wof === view);
        });

        // Randează view-ul cerut
        try {
            if (view === 'shop' && typeof WofShop !== 'undefined') {
                new WofShop().render(target);
            } else if (view === 'market' && typeof WofMarket !== 'undefined') {
                new WofMarket().render(target);
            } else if (view === 'chat' && typeof WofChat !== 'undefined') {
                new WofChat().render(target);
            } else if (view === 'info' && typeof WofInfo !== 'undefined') {
                new WofInfo().render(target);
            } else if (view === 'play') {
                target.innerHTML = '<div class="wof-page"><h1>▶️ Play</h1><p>Coming soon...</p></div>';
            } else {
                target.innerHTML = '<div class="wof-page"><h1>⚠️ View indisponibil</h1><p>' + view + '</p></div>';
            }
        } catch (err) {
            console.error('WofMenu switchView error:', err);
            target.innerHTML = '<div class="wof-page"><h1>Eroare</h1><p>' + err.message + '</p></div>';
        }
    }
}
