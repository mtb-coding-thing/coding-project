// js/filetree/treeOps.js

function createNewFile(parentPath) {
    const parentEntry = fileStructure[parentPath];
    if (!parentEntry || parentEntry.type !== 'folder') return;
    if (!parentEntry.expanded) toggleFolder(parentPath);
    setTimeout(() => {
        const ul = document.querySelector(`.folder[data-path="${CSS.escape(parentPath)}"] > ul`);
        if (!ul) { renderFileTree(); return; }
        ul.querySelectorAll('li > .label > input.tree-input').forEach(inp => inp.closest('li').remove());

        createTreeInput('file', 'new_file.txt', (name) => {
            if (name) {
                const fullPath = `${parentPath}/${name}`;
                if (fileStructure[fullPath]) { showNotification(`File "${name}" already exists.`, true); }
                else {
                    const template = getFileTemplate(name);
                    createFile(fullPath, template, template.length > 0);
                    renderFileTree(); openFile(fullPath);
                }
            }
            renderFileTree();
        }, () => { renderFileTree(); }, ul);
    }, 0);
}

function createNewFolder(parentPath) {
    const parentEntry = fileStructure[parentPath];
    if (!parentEntry || parentEntry.type !== 'folder') return;
    if (!parentEntry.expanded) toggleFolder(parentPath);
    setTimeout(() => {
        const ul = document.querySelector(`.folder[data-path="${CSS.escape(parentPath)}"] > ul`);
        if (!ul) { renderFileTree(); return; }
        ul.querySelectorAll('li > .label > input.tree-input').forEach(inp => inp.closest('li').remove());

        createTreeInput('folder', 'New Folder', (name) => {
            if (name) {
                const fullPath = `${parentPath}/${name}`;
                if (fileStructure[fullPath]) { showNotification(`Folder "${name}" already exists.`, true); }
                else { createFolder(fullPath); renderFileTree(); }
            }
            renderFileTree();
        }, () => { renderFileTree(); }, ul);
    }, 0);
}

function startRenaming(path) {
    if (path === 'root') { startRenamingRoot(); return; }
    const li = document.querySelector(`li[data-path="${CSS.escape(path)}"]`); if (!li) return;
    const label = li.querySelector('.label'); 
    const nameSpan = label.querySelector('span:not(.icon)'); if (!nameSpan) return;
    
    const currentName = nameSpan.textContent; 
    nameSpan.style.display = 'none';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'tree-input';
    
    label.insertBefore(input, nameSpan.nextSibling);
    
    let isFinishing = false;
    const finishRename = (newName) => {
        if (isFinishing) return;
        isFinishing = true;
        if (input.parentNode) input.remove();
        nameSpan.style.display = '';
        newName = newName.trim();
        if (newName && newName !== currentName) { saveRenaming(path, newName); }
        else { renderFileTree(); }
    };
    
    input.addEventListener('blur', () => finishRename(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finishRename(input.value); }
        else if (e.key === 'Escape') { e.preventDefault(); finishRename(currentName); }
    });
    input.addEventListener('click', (e) => e.stopPropagation());
    
    input.focus(); input.select();
}

async function saveRenaming(oldPath, newName) {
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/')); const newPath = `${parentPath}/${newName}`;
    if (/[\\/:*?"<>|]/.test(newName)) { showNotification("Invalid characters.", true); renderFileTree(); return; }
    if (newPath === oldPath) { renderFileTree(); return; }
    if (fileStructure[newPath]) { showNotification(`"${newName}" already exists.`, true); renderFileTree(); return; }
    const entryData = fileStructure[oldPath]; delete fileStructure[oldPath]; fileStructure[newPath] = entryData;
    if (entryData.isUntitled) entryData.isUntitled = false;
    const parent = fileStructure[parentPath];
    if (parent?.children) {
        const oldName = oldPath.split('/').pop(), index = parent.children.indexOf(oldName);
        if (index > -1) {
            parent.children[index] = newName;
            parent.children.sort((a, b) => { const pathA = `${parentPath}/${a}`, pathB = `${parentPath}/${b}`, typeA = fileStructure[pathA]?.type || 'f', typeB = fileStructure[pathB]?.type || 'f'; if (typeA[0] == 'f' && typeB[0] != 'f') return 1; if (typeA[0] != 'f' && typeB[0] == 'f') return -1; return a.localeCompare(b); });
        }
    }
    if (openTabs.has(oldPath)) {
        const tabData = openTabs.get(oldPath); openTabs.delete(oldPath); tabData.tabElement.dataset.filePath = newPath;
        const textSpan = tabData.tabElement.querySelector('.tab-text');
        if (textSpan) { const oldIndicator = textSpan.querySelector('.unsaved-indicator'); textSpan.childNodes[0].nodeValue = newName; if (oldIndicator) textSpan.appendChild(oldIndicator); }
        tabData.tabElement.title = newPath.replace(/^root\/?/, ''); openTabs.set(newPath, tabData);
        if (currentFilePath === oldPath) { currentFilePath = newPath; if (!newPath.startsWith("untitled://")) setLanguage(newPath); }
    } else if (entryData.type === 'folder') {
        const openPaths = Array.from(openTabs.keys());
        openPaths.forEach(openPath => {
            if (openPath.startsWith(oldPath + '/')) {
                const relativePart = openPath.substring(oldPath.length), updatedOpenPath = newPath + relativePart, tabData = openTabs.get(openPath);
                openTabs.delete(openPath); tabData.tabElement.dataset.filePath = updatedOpenPath; tabData.tabElement.title = updatedOpenPath.replace(/^root\/?/, ''); openTabs.set(updatedOpenPath, tabData);
                if (currentFilePath === openPath) { currentFilePath = updatedOpenPath; if (!updatedOpenPath.startsWith("untitled://")) setLanguage(updatedOpenPath); }
            }
        });
    }
    if (entryData.type === 'folder' && entryData.children) {
        function updateChildrenPaths(currentOldPath, currentNewPath) {
            const currentEntry = fileStructure[currentNewPath]; if (!currentEntry?.children) return;
            const children = currentEntry.children.slice();
            children.forEach(childName => {
                const oldChildPath = `${currentOldPath}/${childName}`, newChildPath = `${currentNewPath}/${childName}`;
                if (fileStructure[oldChildPath]) {
                    const childData = fileStructure[oldChildPath]; delete fileStructure[oldChildPath]; fileStructure[newChildPath] = childData;
                    if (childData.type === 'folder') updateChildrenPaths(oldChildPath, newChildPath);
                }
            });
        }
        updateChildrenPaths(oldPath, newPath);
    }
    renderFileTree(); updateTabs(); updateStatusBar(); showNotification(`Renamed to "${newName}".`);
    recentFiles = recentFiles.map(r => {
        if (r.path === oldPath) {
            const newDisplayName = newName;
            const newDisplayPath = newPath.replace(/^root\/?/, '');
            return { ...r, path: newPath, displayName: newDisplayName, displayPath: newDisplayPath };
        }
        if (r.path.startsWith(oldPath + '/')) {
            const newRPath = newPath + r.path.slice(oldPath.length);
            return { ...r, path: newRPath, displayPath: newRPath.replace(/^root\/?/, '') };
        }
        return r;
    });
    renderRecentFiles();
    if (settings.autoSaveSession) saveSession();
}

function startRenamingRoot() {
    const li = document.querySelector('li[data-path="root"]'); if (!li) return;
    const label = li.querySelector('.label');
    const nameSpan = label.querySelector('span:not(.icon)'); if (!nameSpan) return;

    const currentName = fileStructure.root.displayName || 'root';
    nameSpan.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'tree-input';
    label.insertBefore(input, nameSpan.nextSibling);

    let isFinishing = false;
    const finishRename = (newName) => {
        if (isFinishing) return;
        isFinishing = true;
        if (input.parentNode) input.remove();
        nameSpan.style.display = '';
        newName = newName.trim();
        if (newName && newName !== currentName) {
            fileStructure.root.displayName = newName;
            showNotification(`Project renamed to "${newName}".`);
            if (settings.autoSaveSession) saveSession();
        }
        renderFileTree();
    };

    input.addEventListener('blur', () => finishRename(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finishRename(input.value); }
        else if (e.key === 'Escape') { e.preventDefault(); finishRename(currentName); }
    });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.focus(); input.select();
}

function duplicateEntry(path) {
    if (path === 'root' || path.startsWith('untitled://')) return;
    const entry = fileStructure[path];
    if (!entry || entry.type !== 'file') { showNotification('Only files can be duplicated.', true); return; }

    const parentPath = path.substring(0, path.lastIndexOf('/'));
    const fileName = path.split('/').pop();
    const dotIdx = fileName.lastIndexOf('.');
    const baseName = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
    const ext = dotIdx > 0 ? fileName.slice(dotIdx) : '';

    let newName = `${baseName}_copy${ext}`;
    let counter = 2;
    while (fileStructure[`${parentPath}/${newName}`]) {
        newName = `${baseName}_copy${counter}${ext}`;
        counter++;
    }
    const newPath = `${parentPath}/${newName}`;
    createFile(newPath, entry.content, false);
    renderFileTree(); openFile(newPath);
    showNotification(`Duplicated as "${newName}".`);
    if (settings.autoSaveSession) saveSession();
}

async function deleteEntry(path) {
    if (path === 'root' || path.startsWith("untitled://")) { showNotification("Cannot delete this item.", true); return; }
    const entry = fileStructure[path]; if (!entry) return;
    const name = path.split('/').pop(); const type = entry.type === 'folder' ? 'folder' : 'file';
    
    const confirmed = await showConfirmDialog("Delete Item", `Delete ${type} "${name}"? This cannot be undone.`, "Delete", "Cancel", true);
    
    if (confirmed) {
        try {
            if (openTabs.has(path)) closeTab(path, true);
            const pathsToDelete = [path];
            if (entry.type === 'folder') {
                const collectPaths = (folderPath) => {
                    const fe = fileStructure[folderPath];
                    if (fe?.children) {
                        fe.children.forEach(cn => {
                            const cp = `${folderPath}/${cn}`; pathsToDelete.push(cp);
                            if (fileStructure[cp]?.type === 'folder') collectPaths(cp);
                        });
                    }
                };
                collectPaths(path);
            }
            pathsToDelete.reverse().forEach(p => { if (openTabs.has(p)) closeTab(p, true); delete fileStructure[p]; });
            const parentPath = path.substring(0, path.lastIndexOf('/')); const parentEntry = fileStructure[parentPath];
            if (parentEntry?.children) parentEntry.children = parentEntry.children.filter(cn => cn !== name);
            if (currentFilePath === path || (currentFilePath && currentFilePath.startsWith(path + '/'))) {
                currentFilePath = null; codeEditor.setValue(''); codeEditor.setOption('readOnly', false); codeEditor.setOption('mode', 'text/plain'); codeEditor.clearHistory();
                document.getElementById('editorPane').style.display = 'block';
            }
            if (currentWorkingDirectory.startsWith(path)) currentWorkingDirectory = parentPath || 'root';
            renderFileTree(); updateTabs(); updateStatusBar(); showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} "${name}" deleted.`);
            recentFiles = recentFiles.filter(r => !r.path.startsWith(path));
            renderRecentFiles();
            if (settings.autoSaveSession) saveSession();
        } catch (err) { console.error("Error deleting:", err); showNotification(`Error deleting item.`, true); }
    }
}

function toggleFolder(path) {
    if (fileStructure[path]?.type === 'folder') { fileStructure[path].expanded = !fileStructure[path].expanded; renderFileTree(); }
}

function expandAll() {
    function expandRecursive(path) {
        const entry = fileStructure[path];
        if (!entry || entry.type !== 'folder') return;
        entry.expanded = true;
        entry.children.forEach(child => expandRecursive(`${path}/${child}`));
    }
    expandRecursive('root');
    renderFileTree();
    if (settings.autoSaveSession) saveSession();
}

function sortFolderByExtension(folderPath) {
    const entry = fileStructure[folderPath];
    if (!entry || entry.type !== 'folder') return;
    entry.children.sort((a, b) => {
        const pathA = `${folderPath}/${a}`, pathB = `${folderPath}/${b}`;
        const typeA = fileStructure[pathA]?.type || 'file';
        const typeB = fileStructure[pathB]?.type || 'file';
        if (typeA === 'folder' && typeB !== 'folder') return -1;
        if (typeA !== 'folder' && typeB === 'folder') return 1;
        if (typeA === 'folder') return a.localeCompare(b);
        const extA = a.includes('.') ? a.split('.').pop().toLowerCase() : '';
        const extB = b.includes('.') ? b.split('.').pop().toLowerCase() : '';
        if (extA !== extB) return extA.localeCompare(extB);
        return a.localeCompare(b);
    });
    renderFileTree();
    if (settings.autoSaveSession) saveSession();
}