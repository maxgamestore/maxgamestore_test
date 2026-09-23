
// ============================================================
//  WOF MENU
// ============================================================
class WofMenu {
    constructor() {
        this.currentView = 'info';
    }

    render() {
        // Bară WOF e deja în main.html
        // Aici doar setăm active tab
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('#top-bar-wof .menu-link').forEach(l => {
            l.classList.toggle('active', l.dataset.wof === view);
        });
    }
}
