class Immobilienscout24Provider {
    domain = 'immobilienscout24.de';
    
    matches(url) {
        return url.hostname.includes('immobilienscout24.de');
    }

    async init() {
        console.log("SeenIt: Initializing Immobilienscout24Provider");
        this.processCards();

        // Observer for dynamically loaded listings (infinite scroll)
        const observer = new MutationObserver(() => {
            this.processCards();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async processCards() {
        const cards = document.querySelectorAll('.listing-card:not(.seenit-processed)');
        
        for (const card of cards) {
            const obid = card.getAttribute('data-obid');
            if (!obid) continue;

            card.classList.add('seenit-processed');
            if (window.getComputedStyle(card).position === 'static') {
                card.style.position = 'relative';
            }

            const currentStatus = await StorageManager.getItemStatus(this.domain, obid);
            this.updateCardUI(card, obid, currentStatus);

            const links = card.querySelectorAll('a[href*="/expose/"]');
            links.forEach(link => {
                link.addEventListener('mousedown', async (e) => {
                   if (e.button !== 0 && e.button !== 1) return; 

                   const status = await StorageManager.getItemStatus(this.domain, obid);
                   if (!status) {
                       await this.saveWithDetails(obid, 'seen', card);
                       this.updateCardUI(card, obid, 'seen');
                   }
                });
            });
        }
    }

    async saveWithDetails(id, status, card) {
        const headlineEl = card.querySelector('[data-testid="headline"]');
        const title = headlineEl ? headlineEl.innerText : 'Без названия';
        const linkEl = card.querySelector('a[href*="/expose/"]');
        const url = linkEl ? linkEl.href : window.location.href;

        const data = await StorageManager.getDomainData(this.domain);
        data[id] = {
            status: status,
            title: title,
            url: url,
            timestamp: Date.now()
        };
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.domain]: data }, resolve);
        });
    }

    // Override StorageManager.getItemStatus to handle object structure
    async getStatus(id) {
        const data = await StorageManager.getDomainData(this.domain);
        const item = data[id];
        return item ? (typeof item === 'string' ? item : item.status) : null;
    }

    async updateCardUI(card, id, status) {
        card.querySelectorAll('.seenit-ui-container').forEach(el => el.remove());
        
        const currentStatus = status && typeof status === 'object' ? status.status : status;
        
        card.classList.remove('seenit-state-seen', 'seenit-state-rejected', 'seenit-state-fav');
        if (currentStatus) {
            const stateClass = currentStatus.startsWith('fav-') ? 'fav' : currentStatus;
            card.classList.add(`seenit-state-${stateClass}`);
        }

        const container = document.createElement('div');
        container.className = 'seenit-ui-container';

        if (currentStatus) {
            const badgeWrapper = document.createElement('div');
            badgeWrapper.className = 'seenit-badge-wrapper';
            const badge = UIComponents.createBadge(currentStatus);
            badge.style.cursor = 'pointer';
            badge.addEventListener('click', async (e) => {
                await StorageManager.setItemStatus(this.domain, id, null);
                this.updateCardUI(card, id, null);
            });
            badgeWrapper.appendChild(badge);
            container.appendChild(badgeWrapper);
        } else {
            const actions = UIComponents.createActionGroup(
                async () => {
                    await this.saveWithDetails(id, 'seen', card);
                    this.updateCardUI(card, id, 'seen');
                },
                async () => {
                    await this.saveWithDetails(id, 'rejected', card);
                    this.updateCardUI(card, id, 'rejected');
                },
                () => {
                    // Show priority picker
                    container.innerHTML = '';
                    const picker = UIComponents.createPriorityPicker(async (p) => {
                        const statusStr = `fav-${p}`;
                        await this.saveWithDetails(id, statusStr, card);
                        this.updateCardUI(card, id, statusStr);
                    });
                    container.appendChild(picker);
                }
            );
            container.appendChild(actions);
        }
        card.appendChild(container);
    }
}

// Register provider
ProviderRegistry.register(new Immobilienscout24Provider());
