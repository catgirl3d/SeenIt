class ImmoweltProvider extends BaseProvider {
    domain = 'immowelt.de';

    isExposePage() {
        return window.location.pathname.includes('/expose/');
    }

    getExposeId() {
        // e.g. /expose/1cccda7d-09dd-4dfb-9fb1-4712bae2e78c
        const match = window.location.pathname.match(/\/expose\/([a-zA-Z0-9-]+)/);
        if (match) return match[1];

        // Sometimes the ID might be in query parameters or elsewhere, fallback to full path if expose is present
        return window.location.pathname.replace(/^\/expose\//, '').split('?')[0].split('/')[0];
    }

    getCardSelector() {
        return '[data-testid="serp-core-classified-card-testid"]';
    }

    getCardId(card) {
        const link = document.createElement('a');
        const originalHref = this.extractUrl(card);
        link.href = originalHref;

        let detectedId = null;
        // Try extracting from pathname first (e.g., /expose/1cccda7d-...)
        const match = link.pathname.match(/\/expose\/([a-zA-Z0-9-]+)/);
        if (match) {
            detectedId = match[1];
        } else {
            // Fallback: If no match, try returning the last path segment before query params
            const segments = link.pathname.split('/').filter(s => s);
            detectedId = segments.length > 0 ? segments[segments.length - 1] : null;
        }
        
        console.log(`SeenIt: Extracted ID ${detectedId} from href: ${originalHref}`);
        return detectedId;
    }

    getCardLinkSelector() {
        return 'a[data-testid="card-mfe-covering-link-testid"]';
    }

    extractTitle(element) {
        if (this.isExposePage() && element === document) {
            const titleEl = document.querySelector('title, h1');
            return titleEl ? titleEl.innerText : 'Объявление';
        }
        const link = element.querySelector('a[data-testid="card-mfe-covering-link-testid"]');
        if (link && link.title) return link.title;
        return 'Объявление';
    }

    extractUrl(element) {
        if (this.isExposePage() && element === document) {
            return window.location.href;
        }
        const link = element.querySelector('[data-testid="card-mfe-covering-link-testid"]');
        return link ? link.href : window.location.href;
    }
}

ProviderRegistry.register(new ImmoweltProvider());
