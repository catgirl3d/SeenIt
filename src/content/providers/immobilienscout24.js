class Immobilienscout24Provider extends BaseProvider {
    domain = 'immobilienscout24.de';
    
    isExposePage() {
        return window.location.pathname.includes('/expose/');
    }

    getExposeId() {
        const match = window.location.pathname.match(/\/expose\/(\d+)/);
        return match ? match[1] : null;
    }

    getCardSelector() {
        return '.listing-card';
    }

    getCardId(card) {
        return card.getAttribute('data-obid');
    }

    extractTitle(element) {
        if (this.isExposePage() && element === document) {
            const titleEl = document.querySelector('title, h1');
            return titleEl ? titleEl.innerText : 'Объявление';
        }
        const headlineEl = element.querySelector('[data-testid="headline"]');
        return headlineEl ? headlineEl.innerText : 'Объявление';
    }

    extractUrl(element) {
        if (this.isExposePage() && element === document) {
            return window.location.href;
        }
        const linkEl = element.querySelector('a[href*="/expose/"]');
        return linkEl ? linkEl.href : window.location.href;
    }
}

ProviderRegistry.register(new Immobilienscout24Provider());
