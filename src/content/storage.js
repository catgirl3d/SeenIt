class StorageManager {
    static async getDomainData(domain) {
        return new Promise((resolve) => {
            chrome.storage.local.get([domain], (result) => {
                resolve(result[domain] || {});
            });
        });
    }

    static async setItemStatus(domain, id, status) {
        const data = await this.getDomainData(domain);
        if (status === null) {
            delete data[id];
        } else {
            data[id] = status;
        }
        return new Promise((resolve) => {
            chrome.storage.local.set({ [domain]: data }, resolve);
        });
    }

    static async getItemStatus(domain, id) {
        const data = await this.getDomainData(domain);
        return data[id] || null;
    }
}
