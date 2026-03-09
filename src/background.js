// Background service worker for SeenIt
const ACTIVE_LIST_FALLBACK_KEY = '__seenit_active_favorite_list_local__';

chrome.runtime.onInstalled.addListener(() => {
    console.log("SeenIt extension installed.");
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.remove(ACTIVE_LIST_FALLBACK_KEY);
});
