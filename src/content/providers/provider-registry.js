class ProviderRegistry {
    static providers = [];

    static register(provider) {
        this.providers.push(provider);
    }

    static getProviderForUrl(url) {
        return this.providers.find(p => p.matches(url));
    }
}
