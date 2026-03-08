class BaseProvider {
    domain = '';

    // URL matching
    matches(url) {
        return url.hostname.includes(this.domain);
    }

    // --- To be overridden by subclasses ---
    isExposePage() { return false; }
    getExposeId() { return null; }
    getCardSelector() { return ''; }
    getCardId(card) { return null; }
    extractTitle(element) { return 'Объявление'; }
    extractUrl(element) { return window.location.href; }
    // ----------------------------------------

    async init() {
        console.log(`SeenIt: Initializing ${this.constructor.name} for ${this.domain}`);
        
        if (this.isExposePage()) {
            this.processExposePage();
        } else {
            this.processCards();

            // Observer for dynamically loaded listings
            const observer = new MutationObserver(() => {
                this.processCards();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    async processExposePage() {
        const id = this.getExposeId();
        if (!id) return;
        
        const currentStatus = await StorageManager.getItemStatus(this.domain, id);
        this.createExposeBar(id, currentStatus);
    }

    async createExposeBar(id, status) {
        const existing = document.getElementById('seenit-expose-bar');
        if (existing) existing.remove();

        const bar = document.createElement('div');
        bar.id = 'seenit-expose-bar';
        bar.className = 'seenit-expose-bar';

        const logo = document.createElement('div');
        logo.className = 'seenit-expose-logo';
        logo.innerText = 'SeenIt';
        bar.appendChild(logo);

        const currentStatus = status && typeof status === 'object' ? status.status : status;

        const statusContainer = document.createElement('div');
        statusContainer.className = 'seenit-expose-status';
        if (currentStatus) {
            const badge = UIComponents.createBadge(currentStatus);
            badge.title = 'Нажмите, чтобы снять отметку';
            badge.style.cursor = 'pointer';
            badge.addEventListener('click', async () => {
                await StorageManager.setItemStatus(this.domain, id, null);
                this.createExposeBar(id, null);
            });
            statusContainer.appendChild(badge);
        }
        bar.appendChild(statusContainer);

        const actions = UIComponents.createActionGroup(
            currentStatus,
            async () => {
                await this.saveWithDetails(id, 'seen', document);
                this.createExposeBar(id, 'seen');
            },
            async () => {
                await this.saveWithDetails(id, 'rejected', document);
                this.createExposeBar(id, 'rejected');
            },
            () => {
                const pickerContainer = document.createElement('div');
                pickerContainer.className = 'seenit-picker-overlay';
                const picker = UIComponents.createPriorityPicker(async (p) => {
                    const statusStr = `fav-${p}`;
                    await this.saveWithDetails(id, statusStr, document);
                    this.createExposeBar(id, statusStr);
                });
                pickerContainer.appendChild(picker);
                
                const originalActions = bar.querySelector('.seenit-action-group');
                originalActions.style.display = 'none';
                
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'seenit-btn';
                cancelBtn.innerHTML = '✕';
                cancelBtn.onclick = () => this.createExposeBar(id, status);
                pickerContainer.appendChild(cancelBtn);
                
                bar.appendChild(pickerContainer);
            }
        );
        bar.appendChild(actions);

        document.body.prepend(bar);
        document.body.style.paddingTop = '60px'; 
    }

    getCardLinkSelector() { return 'a[href*="/expose/"]'; }

    async processCards() {
        const selector = this.getCardSelector();
        if (!selector) return;

        const cards = document.querySelectorAll(`${selector}:not(.seenit-processed)`);
        if (cards.length > 0) {
            console.log(`SeenIt: Found ${cards.length} new cards for ${this.domain}`);
        }
        
        for (const card of cards) {
            const id = this.getCardId(card);
            if (!id) {
                console.warn("SeenIt: Card found but ID extraction failed", card);
                continue;
            }

            card.classList.add('seenit-processed');
            if (window.getComputedStyle(card).position === 'static') {
                card.style.position = 'relative';
            }

            const currentStatus = await StorageManager.getItemStatus(this.domain, id);
            this.updateCardUI(card, id, currentStatus);

            // Add global click listener to the entire card
            // Use capture: true to intercept events before React/other frameworks stop propagation
            const handleInteract = async (e) => {
                // Ignore right-clicks
                if (e.type === 'mousedown' && e.button !== 0 && e.button !== 1) return; 

                // If the click originated from our extension's UI, don't mark as seen here
                if (e.target.closest('.seenit-ui-container')) {
                    return;
                }

                console.log(`SeenIt: Card interaction detected (${e.type}) for ID: ${id}`);

                const status = await StorageManager.getItemStatus(this.domain, id);
                if (!status) {
                    await this.saveWithDetails(id, 'seen', card);
                    this.updateCardUI(card, id, 'seen');
                    console.log(`SeenIt: Marked card ${id} as seen.`);
                }
            };

            card.addEventListener('mousedown', handleInteract, { capture: true });
            card.addEventListener('click', handleInteract, { capture: true });
        }
    }

    async saveWithDetails(id, status, element) {
        const title = this.extractTitle(element) || 'Без названия';
        const url = this.extractUrl(element) || window.location.href;

        const data = await StorageManager.getDomainData(this.domain);
        data[id] = {
            status: status,
            title: title.trim(),
            url: url,
            timestamp: Date.now()
        };
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.domain]: data }, resolve);
        });
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
        container.style.display = 'flex';
        container.style.alignItems = 'flex-start';
        container.style.gap = '8px';

        if (currentStatus) {
            const badgeWrapper = document.createElement('div');
            badgeWrapper.className = 'seenit-badge-wrapper';
            const badge = UIComponents.createBadge(currentStatus);
            badge.style.cursor = 'pointer';
            badge.addEventListener('click', async () => {
                await StorageManager.setItemStatus(this.domain, id, null);
                this.updateCardUI(card, id, null);
            });
            badgeWrapper.appendChild(badge);
            container.appendChild(badgeWrapper);
        }

        const actions = UIComponents.createActionGroup(
            currentStatus,
            async () => {
                await this.saveWithDetails(id, 'seen', card);
                this.updateCardUI(card, id, 'seen');
            },
            async () => {
                await this.saveWithDetails(id, 'rejected', card);
                this.updateCardUI(card, id, 'rejected');
            },
            () => {
                const pickerContainer = document.createElement('div');
                pickerContainer.className = 'seenit-picker-overlay';
                const picker = UIComponents.createPriorityPicker(async (p) => {
                    const statusStr = `fav-${p}`;
                    await this.saveWithDetails(id, statusStr, card);
                    this.updateCardUI(card, id, statusStr);
                });
                pickerContainer.appendChild(picker);
                
                const originalActions = container.querySelector('.seenit-action-group');
                originalActions.style.display = 'none';
                
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'seenit-btn';
                cancelBtn.innerHTML = '✕';
                cancelBtn.onclick = () => this.updateCardUI(card, id, status);
                pickerContainer.appendChild(cancelBtn);
                
                container.appendChild(pickerContainer);
            }
        );
        container.appendChild(actions);

        card.appendChild(container);
    }
}
