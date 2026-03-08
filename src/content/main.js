console.log("SeenIt content script loaded.");
const provider = ProviderRegistry.getProviderForUrl(window.location);

if (provider) {
    provider.init();
} else {
    console.log("SeenIt: No provider found for this domain.");
}
