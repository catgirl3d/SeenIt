let currentFavorites = [];

document.addEventListener('DOMContentLoaded', async () => {
    updateStats();

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
});

function updateStats() {
    chrome.storage.local.get(null, (items) => {
        let seen = 0;
        let rejected = 0;
        let favorites = [];

        for (const domain in items) {
            const domainData = items[domain];
            for (const id in domainData) {
                const item = domainData[id];
                const status = typeof item === 'string' ? item : item.status;
                
                if (status === 'seen') seen++;
                else if (status === 'rejected') rejected++;
                else if (status?.startsWith('fav-')) {
                    favorites.push({
                        id,
                        domain,
                        ...item,
                        priority: status.split('-')[1].toUpperCase()
                    });
                }
            }
        }
        
        currentFavorites = favorites;

        document.getElementById('stats-seen').textContent = seen;
        document.getElementById('stats-rejected').textContent = rejected;
        document.getElementById('stats-favorites').textContent = favorites.length;

        renderFavorites(favorites);
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
            <div class="fav-meta">${f.domain}</div>
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
