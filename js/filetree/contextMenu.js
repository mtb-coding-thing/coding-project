// js/filetree/contextMenu.js

function showContextMenu(path, x, y) {
    closeContextMenu(); const menu = document.createElement('div'); menu.className = 'context-menu'; 
    const entry = fileStructure[path]; if (!entry) return;
    const newFileDiv = document.createElement('div'); newFileDiv.textContent = 'New File'; newFileDiv.onclick = () => { createNewFile(entry.type === 'folder' ? path : path.substring(0, path.lastIndexOf('/'))); closeContextMenu(); }; menu.appendChild(newFileDiv);
    const newFolderDiv = document.createElement('div'); newFolderDiv.textContent = 'New Folder'; newFolderDiv.onclick = () => { createNewFolder(entry.type === 'folder' ? path : path.substring(0, path.lastIndexOf('/'))); closeContextMenu(); }; menu.appendChild(newFolderDiv);
    if (entry.type === 'folder') {
        const expandAllDiv = document.createElement('div'); expandAllDiv.textContent = 'Expand All'; expandAllDiv.onclick = () => { expandAll(); closeContextMenu(); }; menu.appendChild(expandAllDiv);
        const collapseAllDiv = document.createElement('div'); collapseAllDiv.textContent = 'Collapse All'; collapseAllDiv.onclick = () => { collapseAll(); closeContextMenu(); }; menu.appendChild(collapseAllDiv);
        const sortExtDiv = document.createElement('div'); sortExtDiv.textContent = 'Sort by Extension'; sortExtDiv.onclick = () => { sortFolderByExtension(path); closeContextMenu(); }; menu.appendChild(sortExtDiv);
        const downloadFolderDiv = document.createElement('div'); downloadFolderDiv.textContent = 'Download Folder'; downloadFolderDiv.onclick = () => { downloadFolder(path); closeContextMenu(); }; menu.appendChild(downloadFolderDiv);
        if (path === 'root') {
            const sep = document.createElement('div'); sep.className = 'context-menu-sep'; menu.appendChild(sep);
            const renameRootDiv = document.createElement('div'); renameRootDiv.textContent = 'Rename Project'; renameRootDiv.onclick = () => { startRenamingRoot(); closeContextMenu(); }; menu.appendChild(renameRootDiv);
        }
    }
    if (path !== 'root' && !path.startsWith("untitled://")) {
        const copyPathDiv = document.createElement('div');
        copyPathDiv.textContent = 'Copy Path';
        copyPathDiv.onclick = () => {
            const displayPath = path.replace(/^root\/?/, '');
            navigator.clipboard.writeText(displayPath).then(() => showNotification(`Copied: ${displayPath}`), () => showNotification('Failed to copy path.', true));
            closeContextMenu();
        };
        menu.appendChild(copyPathDiv);

        if (entry.type === 'file') {
            const duplicateDiv = document.createElement('div'); duplicateDiv.textContent = 'Duplicate'; duplicateDiv.onclick = () => { duplicateEntry(path); closeContextMenu(); }; menu.appendChild(duplicateDiv);
            const openPinDiv = document.createElement('div');
            openPinDiv.textContent = pinnedTabs.has(path) ? 'Open (already pinned)' : 'Open and Pin';
            openPinDiv.onclick = () => {
                openFile(path);
                pinnedTabs.add(path);
                const tabData = openTabs.get(path);
                if (tabData) tabData.tabElement = null; // force recreate with pin icon
                updateTabs();
                if (settings.autoSaveSession) saveSession();
                closeContextMenu();
            };
            menu.appendChild(openPinDiv);
        }

        const renameDiv = document.createElement('div'); renameDiv.textContent = 'Rename'; renameDiv.onclick = () => { startRenaming(path); closeContextMenu(); }; menu.appendChild(renameDiv);
        const deleteDiv = document.createElement('div'); deleteDiv.textContent = 'Delete'; deleteDiv.onclick = () => { deleteEntry(path); closeContextMenu(); }; menu.appendChild(deleteDiv);
    }
    
    adjustMenuPosition(menu, x, y);
    activeContextMenu = menu;
    document.addEventListener('click', handleClickOutsideContextMenu, true); document.addEventListener('contextmenu', handleClickOutsideContextMenu, true);
}

function closeContextMenu() {
    if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; document.removeEventListener('click', handleClickOutsideContextMenu, true); document.removeEventListener('contextmenu', handleClickOutsideContextMenu, true); }
}

function handleClickOutsideContextMenu(event) {
    if (activeContextMenu && !activeContextMenu.contains(event.target)) closeContextMenu();
}

function showTreeBackgroundMenu(x, y) {
    const menu = document.createElement('div'); menu.className = 'context-menu';

    const newFileDiv = document.createElement('div'); newFileDiv.textContent = 'New File';
    newFileDiv.onclick = () => { createNewFile(currentWorkingDirectory || 'root'); closeContextMenu(); };
    menu.appendChild(newFileDiv);

    const newFolderDiv = document.createElement('div'); newFolderDiv.textContent = 'New Folder';
    newFolderDiv.onclick = () => { createNewFolder(currentWorkingDirectory || 'root'); closeContextMenu(); };
    menu.appendChild(newFolderDiv);

    const sep = document.createElement('div'); sep.className = 'context-menu-sep'; menu.appendChild(sep);

    const expandAllDiv = document.createElement('div'); expandAllDiv.textContent = 'Expand All';
    expandAllDiv.onclick = () => { expandAll(); closeContextMenu(); };
    menu.appendChild(expandAllDiv);

    const collapseAllDiv = document.createElement('div'); collapseAllDiv.textContent = 'Collapse All';
    collapseAllDiv.onclick = () => { collapseAll(); closeContextMenu(); };
    menu.appendChild(collapseAllDiv);

    const sortExtDiv = document.createElement('div'); sortExtDiv.textContent = 'Sort by Extension';
    sortExtDiv.onclick = () => { sortFolderByExtension('root'); closeContextMenu(); };
    menu.appendChild(sortExtDiv);

    adjustMenuPosition(menu, x, y);
    activeContextMenu = menu;
    document.addEventListener('click', handleClickOutsideContextMenu, true);
    document.addEventListener('contextmenu', handleClickOutsideContextMenu, true);
}