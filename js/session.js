async function saveSession() {
    if (typeof localforage === 'undefined' || !settings.autoSaveSession) return;

    const sessionData = {
        fileStructure: fileStructure,
        openFiles: Array.from(openTabs.keys()),
        activeFilePath: currentFilePath,
        currentWorkingDirectory: currentWorkingDirectory,
        untitledTabCounter: untitledTabCounter,
        recentFiles: recentFiles
    };

    try {
        await localforage.setItem(SESSION_STORAGE_KEY, sessionData);
    } catch (e) { 
        console.error("Error saving session to IndexedDB:", e); 
        showNotification("Could not save project session.", true); 
    }
}

async function loadSession() {
    if (typeof localforage === 'undefined' || !settings.autoSaveSession) {
        _loadFromSessionStorageFallback();
        if (!fileStructure || !fileStructure.root) initEmptySession();
        renderFileTree(); updateTabs(); updateStatusBar();
        return;
    }
    
    try {
        let sessionData = await localforage.getItem(SESSION_STORAGE_KEY);

        if (!sessionData) {
            sessionData = _loadFromSessionStorageFallback();
        }

        if (sessionData && sessionData.fileStructure) {
            fileStructure = sessionData.fileStructure;

            // Migration step for the diff viewer: ensure savedContent exists.
            Object.keys(fileStructure).forEach(key => {
                if (fileStructure[key].type === 'file' && typeof fileStructure[key].savedContent === 'undefined') {
                    fileStructure[key].savedContent = fileStructure[key].content;
                }
            });

            currentWorkingDirectory = sessionData.currentWorkingDirectory || 'root';
            untitledTabCounter = sessionData.untitledTabCounter || 1;

            // Restore recent files, pruning any that no longer exist in the loaded structure
            if (Array.isArray(sessionData.recentFiles)) {
                recentFiles = sessionData.recentFiles.filter(r => fileStructure[r.path]);
            }

            if (sessionData.openFiles?.length) {
                sessionData.openFiles.forEach(path => {
                    const entry = fileStructure[path];
                    if (entry) {
                        const tabName = entry.isUntitled ? entry.displayName : path.split('/').pop();
                        const tab = createTabElement(path, entry.unsaved, tabName);
                        openTabs.set(path, { tabElement: tab, unsaved: entry.unsaved });
                    }
                });
            }

            const pathToOpen = (sessionData.activeFilePath && (fileStructure[sessionData.activeFilePath] || sessionData.activeFilePath.startsWith("untitled://")))
                ? sessionData.activeFilePath
                : (sessionData.openFiles?.length > 0 ? sessionData.openFiles[sessionData.openFiles.length - 1] : null);
            // Use requestAnimationFrame so the synchronous renderFileTree() / updateTabs() calls
            // that follow loadSession() always complete before openFile() runs.
            if (pathToOpen && (fileStructure[pathToOpen] || pathToOpen.startsWith("untitled://"))) {
                requestAnimationFrame(() => openFile(pathToOpen));
            }
        } else {
            initEmptySession();
        }
    } catch (e) { 
        console.error("Failed to load session:", e); 
        await localforage.removeItem(SESSION_STORAGE_KEY);
        initEmptySession();
    }
    
    renderFileTree();
    updateTabs();
    updateStatusBar();
    renderRecentFiles();
}

function initAutoSaveOnBlur() {
    window.addEventListener('blur', () => {
        if (!settings.autoSaveOnBlur) return;
        if (currentFilePath && fileStructure[currentFilePath] && !fileStructure[currentFilePath].isUntitled && fileStructure[currentFilePath].unsaved) {
            saveCurrentFile();
        }
    });
}

function initEmptySession() {
    fileStructure = { 'root': { type: 'folder', children: [], expanded: true, displayName: 'root' } };
    openTabs.clear(); currentFilePath = null; currentWorkingDirectory = 'root'; untitledTabCounter = 1;
    if (codeEditor) { codeEditor.setValue(''); codeEditor.setOption('mode', 'text/plain'); codeEditor.clearHistory(); }
}

const SESSION_FALLBACK_KEY = `${SESSION_STORAGE_KEY}_fallback`;

function _saveSessionFallback() {
    try {
        const sessionData = {
            fileStructure: fileStructure,
            openFiles: Array.from(openTabs.keys()),
            activeFilePath: currentFilePath,
            currentWorkingDirectory: currentWorkingDirectory,
            untitledTabCounter: untitledTabCounter
        };
        const serialized = JSON.stringify(sessionData);
        sessionStorage.setItem(SESSION_FALLBACK_KEY, serialized);
    } catch (e) {
        console.warn("Could not write session fallback to sessionStorage:", e);
    }
}

function _loadFromSessionStorageFallback() {
    try {
        const raw = sessionStorage.getItem(SESSION_FALLBACK_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

window.addEventListener('beforeunload', (e) => {
    if (settings.autoSaveSession) {
        _saveSessionFallback();
        saveSession();
    } else {
        const hasUnsaved = Array.from(openTabs.values()).some(t => t.unsaved);
        if (hasUnsaved) {
            e.preventDefault();
            e.returnValue = ''; 
        }
    }
});