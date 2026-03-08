class UIComponents {
    static createActionGroup(currentStatus, onSeen, onRejected, onFavoriteClick) {
        const container = document.createElement('div');
        container.className = 'seenit-action-group';

        const btnSeen = this.createBtn('seenit-btn-seen', 'Отметить как просмотренное', `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        `, onSeen);

        const btnFavorite = this.createBtn('seenit-btn-fav', 'В избранное', `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        `, onFavoriteClick);

        const btnRejected = this.createBtn('seenit-btn-reject', 'Отметить как неподходящее', `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        `, onRejected);

        if (currentStatus === 'seen') btnSeen.style.display = 'none';
        if (currentStatus === 'rejected') btnRejected.style.display = 'none';
        if (currentStatus && currentStatus.startsWith('fav-')) btnFavorite.style.display = 'none';

        container.appendChild(btnSeen);
        container.appendChild(btnFavorite);
        container.appendChild(btnRejected);

        return container;
    }


    static createPriorityPicker(onSelect) {
        const container = document.createElement('div');
        container.className = 'seenit-priority-picker';
        
        ['P1', 'P2', 'P3'].forEach(p => {
            const btn = document.createElement('button');
            btn.className = `seenit-p-btn seenit-p-btn-${p.toLowerCase()}`;
            btn.innerText = p;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(p.toLowerCase());
            });
            container.appendChild(btn);
        });

        return container;
    }

    static createBtn(className, title, iconHtml, onClick) {
        const btn = document.createElement('button');
        btn.className = `seenit-btn ${className}`;
        btn.title = title;
        btn.innerHTML = iconHtml;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    static createBadge(status) {
        const badge = document.createElement('div');
        const isFav = status.startsWith('fav-');
        const priority = isFav ? status.split('-')[1].toUpperCase() : '';
        
        badge.className = `seenit-badge seenit-badge-${status}${isFav ? ' seenit-badge-fav' : ''}`;
        
        if (isFav) {
            badge.innerHTML = `<span class="star">⭐</span> Избранное (${priority})`;
        } else {
            badge.innerText = status === 'seen' ? 'Просмотрено' : 'Не подходит';
        }
        return badge;
    }
}
