class StorageManager {
    static SETTINGS_KEY = '__seenit_settings__';
    static SESSION_ACTIVE_LIST_KEY = '__seenit_active_favorite_list__';
    static LOCAL_ACTIVE_LIST_KEY = '__seenit_active_favorite_list_local__';
    static FAVORITE_KEY_PREFIX = '__seenit_favorites__::';

    static getDefaultLists() {
        return [{ id: 'main', name: 'Main' }];
    }

    static makeFavoriteKey(domain, listId) {
        return `${this.FAVORITE_KEY_PREFIX}${domain}::${listId}`;
    }

    static parseFavoriteKey(key) {
        if (!key.startsWith(this.FAVORITE_KEY_PREFIX)) return null;
        const parts = key.slice(this.FAVORITE_KEY_PREFIX.length).split('::');
        if (parts.length !== 2) return null;
        return { domain: parts[0], listId: parts[1] };
    }

    static async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.SETTINGS_KEY], (result) => {
                const stored = result[this.SETTINGS_KEY] || {};
                const favoriteLists = Array.isArray(stored.favoriteLists) && stored.favoriteLists.length > 0
                    ? stored.favoriteLists
                    : this.getDefaultLists();
                resolve({
                    ...stored,
                    favoriteLists
                });
            });
        });
    }

    static async saveSettings(settings) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.SETTINGS_KEY]: settings }, resolve);
        });
    }

    static async getFavoriteLists() {
        const settings = await this.getSettings();
        return settings.favoriteLists;
    }

    static async addFavoriteList(name) {
        const trimmed = (name || '').trim();
        if (!trimmed) return null;

        const settings = await this.getSettings();
        const normalizedName = trimmed.slice(0, 30);
        const existing = settings.favoriteLists.find((list) => list.name.toLowerCase() === normalizedName.toLowerCase());
        if (existing) {
            return existing;
        }

        const id = `list-${Date.now().toString(36)}`;
        const newList = { id, name: normalizedName };
        settings.favoriteLists = [...settings.favoriteLists, newList];
        await this.saveSettings(settings);
        return newList;
    }

    static async getActiveFavoriteListId() {
        const sessionId = await new Promise((resolve) => {
            if (!chrome.storage.session) {
                resolve(null);
                return;
            }
            chrome.storage.session.get([this.SESSION_ACTIVE_LIST_KEY], (result) => {
                resolve(result[this.SESSION_ACTIVE_LIST_KEY] || null);
            });
        });

        const lists = await this.getFavoriteLists();
        if (sessionId && lists.some((list) => list.id === sessionId)) {
            return sessionId;
        }

        const localId = await new Promise((resolve) => {
            chrome.storage.local.get([this.LOCAL_ACTIVE_LIST_KEY], (result) => {
                resolve(result[this.LOCAL_ACTIVE_LIST_KEY] || null);
            });
        });

        if (localId && lists.some((list) => list.id === localId)) {
            await this.setActiveFavoriteListId(localId);
            return localId;
        }

        const fallback = lists[0]?.id || 'main';
        await this.setActiveFavoriteListId(fallback);
        return fallback;
    }

    static async setActiveFavoriteListId(listId) {
        const lists = await this.getFavoriteLists();
        const exists = lists.some((list) => list.id === listId);
        const safeListId = exists ? listId : (lists[0]?.id || 'main');

        await new Promise((resolve) => {
            chrome.storage.local.set({ [this.LOCAL_ACTIVE_LIST_KEY]: safeListId }, resolve);
        });

        return new Promise((resolve) => {
            if (!chrome.storage.session) {
                resolve();
                return;
            }
            chrome.storage.session.set({ [this.SESSION_ACTIVE_LIST_KEY]: safeListId }, resolve);
        });
    }

    static async getDomainData(domain) {
        return new Promise((resolve) => {
            chrome.storage.local.get([domain], (result) => {
                resolve(result[domain] || {});
            });
        });
    }

    static async getFavoriteDomainData(domain, listId) {
        const key = this.makeFavoriteKey(domain, listId);
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] || {});
            });
        });
    }

    static normalizeItem(item) {
        if (typeof item === 'string') {
            return { status: item };
        }
        return item || null;
    }

    static async getAggregatedDomainData(domain) {
        const [baseData, favoriteLists] = await Promise.all([
            this.getDomainData(domain),
            this.getFavoriteLists()
        ]);

        const result = {};

        for (const id in baseData) {
            const normalized = this.normalizeItem(baseData[id]);
            if (!normalized) continue;

            if (normalized.status && normalized.status.startsWith('fav-')) {
                result[id] = {
                    ...normalized,
                    favoriteListId: normalized.favoriteListId || 'main',
                    favoriteListName: normalized.favoriteListName || 'Main'
                };
                continue;
            }

            result[id] = normalized;
        }

        const favoriteKeys = favoriteLists.map((list) => this.makeFavoriteKey(domain, list.id));
        const favoriteBuckets = await new Promise((resolve) => {
            if (favoriteKeys.length === 0) {
                resolve({});
                return;
            }
            chrome.storage.local.get(favoriteKeys, resolve);
        });

        favoriteLists.forEach((list) => {
            const bucket = favoriteBuckets[this.makeFavoriteKey(domain, list.id)] || {};
            for (const id in bucket) {
                const normalized = this.normalizeItem(bucket[id]);
                if (!normalized) continue;

                result[id] = {
                    ...normalized,
                    favoriteListId: list.id,
                    favoriteListName: list.name
                };
            }
        });

        return result;
    }

    static async setItemStatus(domain, id, status, details = {}) {
        if (status === null) {
            await this.clearItemStatus(domain, id);
            return;
        }

        if (typeof status === 'string' && status.startsWith('fav-')) {
            const activeListId = await this.getActiveFavoriteListId();
            const lists = await this.getFavoriteLists();
            const activeList = lists.find((list) => list.id === activeListId) || lists[0] || { id: 'main', name: 'Main' };
            const favoriteKey = this.makeFavoriteKey(domain, activeList.id);
            const favoriteData = await this.getFavoriteDomainData(domain, activeList.id);
            favoriteData[id] = {
                status,
                ...details,
                title: details.title || 'Без названия',
                url: details.url || window.location.href,
                timestamp: details.timestamp || Date.now(),
                favoriteListId: activeList.id,
                favoriteListName: activeList.name
            };

            await new Promise((resolve) => {
                chrome.storage.local.set({ [favoriteKey]: favoriteData }, resolve);
            });
            return;
        }

        const data = await this.getDomainData(domain);
        data[id] = {
            status,
            ...details,
            title: details.title || 'Без названия',
            url: details.url || window.location.href,
            timestamp: details.timestamp || Date.now()
        };
        return new Promise((resolve) => {
            chrome.storage.local.set({ [domain]: data }, resolve);
        });
    }

    static async clearItemStatus(domain, id) {
        const [baseData, favoriteLists] = await Promise.all([
            this.getDomainData(domain),
            this.getFavoriteLists()
        ]);

        delete baseData[id];
        const updates = { [domain]: baseData };

        for (const list of favoriteLists) {
            const key = this.makeFavoriteKey(domain, list.id);
            const favoriteData = await this.getFavoriteDomainData(domain, list.id);
            if (id in favoriteData) {
                delete favoriteData[id];
                updates[key] = favoriteData;
            }
        }

        return new Promise((resolve) => {
            chrome.storage.local.set(updates, resolve);
        });
    }

    static async getItemStatus(domain, id) {
        const data = await this.getAggregatedDomainData(domain);
        return data[id] || null;
    }
}
