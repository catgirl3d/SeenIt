let currentFavorites = [];
const BACKUP_FORMAT_VERSION = 1;

document.addEventListener('DOMContentLoaded', async () => {
    await setupFavoriteListControls();
    await updateStats();

    chrome.storage.onChanged.addListener(async () => {
        await setupFavoriteListControls();
        await updateStats();
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all seen listings history?')) {
            chrome.storage.local.clear(() => {
                updateStats();
            });
        }
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        const format = document.getElementById('export-format').value;
        if (format === 'markdown') {
            exportToMarkdown();
        } else {
            exportToCSV();
        }
    });

    document.getElementById('btn-export-backup').addEventListener('click', exportBackup);

    const backupFileInput = document.getElementById('backup-file-input');
    document.getElementById('btn-import-backup').addEventListener('click', () => {
        backupFileInput.click();
    });

    backupFileInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        await importBackup(file);
        event.target.value = '';
    });
});

async function setupFavoriteListControls() {
    const select = document.getElementById('favorite-list-select');
    const lists = await StorageManager.getFavoriteLists();
    const activeListId = await StorageManager.getActiveFavoriteListId();
    const activeList = lists.find((list) => list.id === activeListId) || lists[0];

    select.innerHTML = lists.map((list) => `<option value="${list.id}">${list.name}</option>`).join('');
    select.value = activeList?.id || 'main';

    const title = document.getElementById('favorites-title');
    title.textContent = `⭐ Favorites: ${activeList?.name || 'Main'}`;

    select.onchange = async (e) => {
        await StorageManager.setActiveFavoriteListId(e.target.value);
        await setupFavoriteListControls();
        await updateStats();
    };

    const addBtn = document.getElementById('btn-add-list');
    addBtn.onclick = async () => {
        const name = prompt('New list name (max 30 chars):');
        if (!name) return;

        const newList = await StorageManager.addFavoriteList(name);
        if (!newList) return;

        await StorageManager.setActiveFavoriteListId(newList.id);
        await setupFavoriteListControls();
        await updateStats();
    };
}

async function updateStats() {
    const activeListId = await StorageManager.getActiveFavoriteListId();
    const lists = await StorageManager.getFavoriteLists();
    const listById = Object.fromEntries(lists.map((list) => [list.id, list.name]));

    chrome.storage.local.get(null, (items) => {
        let seen = 0;
        let rejected = 0;
        const allFavorites = [];

        for (const key in items) {
            if (
                key === StorageManager.SETTINGS_KEY ||
                key === StorageManager.LOCAL_ACTIVE_LIST_KEY ||
                key.startsWith(StorageManager.FAVORITE_KEY_PREFIX)
            ) {
                continue;
            }

            const domainData = items[key];
            if (!domainData || typeof domainData !== 'object' || Array.isArray(domainData)) continue;

            for (const id in domainData) {
                const rawItem = domainData[id];
                const item = typeof rawItem === 'string' ? { status: rawItem } : rawItem;
                if (!item || !item.status) continue;

                if (item.status === 'seen') seen++;
                else if (item.status === 'rejected') rejected++;
                else if (item.status.startsWith('fav-')) {
                    allFavorites.push({
                        id,
                        domain: key,
                        title: item.title || 'Untitled',
                        url: item.url || '',
                        timestamp: item.timestamp || 0,
                        status: item.status,
                        priority: item.status.split('-')[1].toUpperCase(),
                        favoriteListId: item.favoriteListId || 'main',
                        favoriteListName: item.favoriteListName || 'Main'
                    });
                }
            }
        }

        for (const key in items) {
            const parsed = StorageManager.parseFavoriteKey(key);
            if (!parsed) continue;

            const bucket = items[key] || {};
            for (const id in bucket) {
                const rawItem = bucket[id];
                const item = typeof rawItem === 'string' ? { status: rawItem } : rawItem;
                if (!item || !item.status || !item.status.startsWith('fav-')) continue;

                allFavorites.push({
                    id,
                    domain: parsed.domain,
                    title: item.title || 'Untitled',
                    url: item.url || '',
                    timestamp: item.timestamp || 0,
                    status: item.status,
                    priority: item.status.split('-')[1].toUpperCase(),
                    favoriteListId: parsed.listId,
                    favoriteListName: listById[parsed.listId] || item.favoriteListName || parsed.listId
                });
            }
        }

        const selectedFavorites = allFavorites.filter((fav) => fav.favoriteListId === activeListId);

        currentFavorites = selectedFavorites;

        document.getElementById('stats-seen').textContent = seen;
        document.getElementById('stats-rejected').textContent = rejected;
        document.getElementById('stats-favorites').textContent = allFavorites.length;

        renderFavorites(selectedFavorites);
    });
}

function renderFavorites(favs) {
    const list = document.getElementById('favorites-list');
    if (favs.length === 0) {
        list.innerHTML = '<div class="empty-state">Nothing added yet</div>';
        return;
    }

    // Sort: newest first
    favs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    list.innerHTML = favs.map(f => `
        <div class="fav-item">
            <div class="fav-header">
                <a href="${f.url}" target="_blank" class="fav-title">${f.title}</a>
                <span class="fav-p-badge fav-p-${f.priority.toLowerCase()}">${f.priority}</span>
            </div>
            <div class="fav-meta">${f.domain} • ${f.favoriteListName}</div>
        </div>
    `).join('');
}

function exportToCSV() {
    if (currentFavorites.length === 0) {
        showToast('You have no favorites to export.');
        return;
    }

    // CSV Header
    let csvContent = 'Priority,Title,URL,Domain,Date\n';

    currentFavorites.forEach(f => {
        const date = f.timestamp ? new Date(f.timestamp).toLocaleDateString() : 'N/A';
        // Basic escaping: wrap in quotes, escape existing quotes
        const title = `"${f.title.replace(/"/g, '""')}"`;
        const url = `"${f.url.replace(/"/g, '""')}"`;
        csvContent += `${f.priority},${title},${url},${f.domain},${date}\n`;
    });

    // Handle UTF-8 with BOM for Excel to recognize Cyrillic/German characters correctly
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SeenIt_Favorites_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToMarkdown() {
    if (currentFavorites.length === 0) {
        showToast('You have no favorites to export.');
        return;
    }

    let mdContent = '# SeenIt Favorites\n\n';

    // Group by priority
    const grouped = {
        'P1': [],
        'P2': [],
        'P3': []
    };

    currentFavorites.forEach(f => {
        if (grouped[f.priority]) grouped[f.priority].push(f);
    });

    for (const priority of ['P1', 'P2', 'P3']) {
        if (grouped[priority].length > 0) {
            mdContent += `## ${priority} Priority\n\n`;
            grouped[priority].forEach(f => {
                const date = f.timestamp ? new Date(f.timestamp).toLocaleDateString() : 'N/A';
                mdContent += `- [**${f.title}**](${f.url}) - *${f.domain}* (added: ${date})\n`;
            });
            mdContent += '\n';
        }
    }

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SeenIt_Favorites_${new Date().toISOString().split('T')[0]}.md`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportBackup() {
    chrome.storage.local.get(null, (items) => {
        const payload = {
            app: 'SeenIt',
            formatVersion: BACKUP_FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            data: items
        };

        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `SeenIt_Backup_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('Backup exported.');
    });
}

async function importBackup(file) {
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        const backupData = normalizeBackupData(parsed);

        if (!confirm('Import will replace your current SeenIt history and lists. Continue?')) {
            return;
        }

        await new Promise((resolve) => {
            chrome.storage.local.clear(resolve);
        });

        const keys = Object.keys(backupData);
        if (keys.length > 0) {
            await new Promise((resolve) => {
                chrome.storage.local.set(backupData, resolve);
            });
        }

        await setupFavoriteListControls();
        await updateStats();
        showToast('Backup imported successfully.');
    } catch (error) {
        console.error('SeenIt: backup import failed', error);
        showToast('Import failed: invalid backup file.');
    }
}

function normalizeBackupData(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Backup root must be an object');
    }

    if (parsed.app === 'SeenIt') {
        if (parsed.formatVersion !== BACKUP_FORMAT_VERSION) {
            throw new Error('Unsupported backup version');
        }

        if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
            throw new Error('Backup data is invalid');
        }

        return parsed.data;
    }

    return parsed;
}

function showToast(message) {
    let toast = document.querySelector('.seenit-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'seenit-toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.classList.add('visible');
    
    setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}
