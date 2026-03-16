function toggleToolbarMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('toolbarOverflowMenu');
    const isOpen = menu.classList.contains('open');
    closeToolbarMenu();
    if (!isOpen) menu.classList.add('open');
}

function closeToolbarMenu() {
    const menu = document.getElementById('toolbarOverflowMenu');
    if (menu) menu.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', async () => {
    initWorkers();

    document.title = `CodeEdit v${VERSION}`;

    codeEditor = CodeMirror(document.getElementById('codeEditor'), {
        lineNumbers: true, tabSize: settings.tabWidth, mode: 'text/plain', theme: settings.theme,
        foldGutter: settings.foldGutter, gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
        matchBrackets: settings.matchBrackets, autoCloseBrackets: settings.autoCloseBrackets, autoCloseTags: settings.autoCloseTags,
        lineWrapping: settings.wordWrap, lint: true, styleActiveLine: settings.activeLineHighlight ?? true,
        extraKeys: { 
            "Ctrl-Q": cm => cm.foldCode(cm.getCursor()), 
            "Ctrl-F": () => openLocalSearch(false), 
            "Cmd-F": () => openLocalSearch(false), 
            "Ctrl-H": () => openLocalSearch(true), 
            "Cmd-Option-F": () => openLocalSearch(true), 
            "Ctrl-G": () => openGoToLine(), "Cmd-L": () => openGoToLine(),
            "Ctrl-Space": "autocomplete", "Cmd-Space": "autocomplete", 
            "Ctrl-S": saveCurrentFile, "Cmd-S": saveCurrentFile, 
            "Ctrl-Shift-F": formatCode, "Cmd-Shift-F": formatCode, 
            "Ctrl-/": "toggleComment", "Cmd-/": "toggleComment",
            "Ctrl-Tab": () => cycleTab(1),
            "Ctrl-Shift-Tab": () => cycleTab(-1),
            "Delete": (cm) => {
                if (lastClickedTreePath && lastClickedTreePath !== 'root' && (Date.now() - lastClickedTreeTime) < (settings.treeDeleteWindowMs ?? 1500)) {
                    deleteEntry(lastClickedTreePath);
                } else {
                    return CodeMirror.Pass; // let CM handle normal deletion
                }
            }
        },
        hintOptions: { completeSingle: false }, indentUnit: settings.tabWidth, indentWithTabs: false, smartIndent: true
    });

    codeEditor.on("inputRead", function(cm, change) { 
        if (!cm.state.completionActive && change.origin !== "paste" && change.text[0]?.match(/[a-zA-Z<]/)) 
            setTimeout(() => cm.showHint({ completeSingle: false }), 50); 
    });

    codeEditor.on('change', (cm, change) => {
        // Denylist the system-only origins that should never mark a file unsaved.
        // 'setValue' fires when openFile loads content programmatically.
        // Everything else ('+input', '+delete', 'paste', 'cut', 'undo', 'redo',
        // 'complete', drag-drop, etc.) is a genuine user edit.
        const systemOrigins = ['setValue'];
        if (!systemOrigins.includes(change.origin)) {
            if (currentFilePath && fileStructure[currentFilePath]) {
                if (!fileStructure[currentFilePath].unsaved) {
                    fileStructure[currentFilePath].unsaved = true;
                    updateTabs();
                }
                fileStructure[currentFilePath].content = cm.getValue();
            }
        }
        updateStatusBar();
        if (codeEditor.getOption('lint')) setTimeout(() => codeEditor.performLint(), 500);
    });

    codeEditor.on('cursorActivity', updateStatusBar);
    codeEditor.on('change', () => {
        if (settings.bracketColorization) requestAnimationFrame(applyBracketColorizationToEditor);
    });

    if (!fileStructure || !fileStructure.root) { fileStructure = { 'root': { type: 'folder', children: [], expanded: true, displayName: 'root' } }; }
    
    loadSettings();
    initSidebarResize();
    initEditorPreviewResize();
    initAutoSaveOnBlur();
    
    await loadSession();

    updatePreviewLayout();

    // Initialise minimap now that the editor and session are ready
    if (typeof initMinimap === 'function') initMinimap();

    // Capture-phase listener for Ctrl+W — Edge intercepts this at browser level
    // before the bubbling keydown fires, so we must use capture to beat it.
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w') {
            e.preventDefault();
        }
        // Intercept Delete before CodeMirror when a tree node was the last thing clicked
        if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const tag = document.activeElement?.tagName;
            if (tag !== 'INPUT' && tag !== 'TEXTAREA' && lastClickedTreePath && lastClickedTreePath !== 'root' && (Date.now() - lastClickedTreeTime) < (settings.treeDeleteWindowMs ?? 1500)) {
                e.preventDefault();
                e.stopPropagation();
                deleteEntry(lastClickedTreePath);
            }
        }
    }, true);

    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') { 
            closeContextMenu();
            closeToolbarMenu();
            const paletteVisible = document.getElementById('commandPalette').style.display !== 'none';
            const settingsVisible = document.getElementById('settingsOverlay').style.display !== 'none';
            hideCommandPalette();
            if (settingsVisible) toggleSettings();
            if (paletteVisible || settingsVisible) {
                setTimeout(() => codeEditor && codeEditor.focus(), 0);
            }
        }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { 
            e.preventDefault(); 
            openLocalSearch(true); 
        }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !e.shiftKey) { 
            e.preventDefault(); 
            openLocalSearch(false); 
        }
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); showCommandPalette(); }
        else if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); newTab(); }
        else if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveCurrentFile(); }
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveAllFiles(); }
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); createNewFile(currentWorkingDirectory || 'root'); }
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); createNewFolder(currentWorkingDirectory || 'root'); }
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') { e.preventDefault(); document.getElementById('searchInput').focus(); document.getElementById('searchInput').select(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
            e.preventDefault();
            if (currentFilePath) { closeTab(currentFilePath); }
            else {
                const content = codeEditor.getValue();
                if (content.length > 0) { 
                    const confirmed = await showConfirmDialog("Close Buffer", "Close buffer? Changes will be lost.", "Discard", "Cancel", true);
                    if (!confirmed) return; 
                }
                if (openTabs.size === 0) { codeEditor.setValue(''); codeEditor.clearHistory(); updateStatusBar(); }
            }
        }

    });

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debouncedPerformSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
    
    document.getElementById('replaceInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') performGlobalReplace(); });

    const dropZone = document.getElementById('fileTree');
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.backgroundColor = '#333'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.backgroundColor = ''; });
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault(); dropZone.style.backgroundColor = '';
        const items = e.dataTransfer.items;
        if (items) {
            showNotification('Processing dropped items...', false, 3000);
            let filesProcessed = 0; const processQueue = [];
            const targetDropElement = e.target.closest('li[data-path]');
            let baseDropPath = currentWorkingDirectory || 'root';
            if (targetDropElement) {
                const potentialDropPath = targetDropElement.dataset.path;
                if (fileStructure[potentialDropPath]) {
                    baseDropPath = fileStructure[potentialDropPath].type === 'folder' ? potentialDropPath : (potentialDropPath.substring(0, potentialDropPath.lastIndexOf('/')) || 'root');
                }
            }

            async function processEntry(entry, currentPathInZip) {
                return new Promise(async (resolveEntry, rejectEntry) => {
                    if (entry.isFile) {
                        entry.file(async (file) => {
                            if (file.size > MAX_FILE_SIZE_BYTES) {
                                createFile(`${baseDropPath}/${currentPathInZip}`, `[File too large: ${file.name}]`, false); filesProcessed++; resolveEntry(); return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const fullPath = `${baseDropPath}/${currentPathInZip}`;
                                if (fileStructure[fullPath] && !fileStructure[fullPath].isUntitled) {
                                    // Notice suppressed, covered by final total
                                } else {
                                    createFile(fullPath, event.target.result, false);
                                }
                                filesProcessed++; resolveEntry();
                            };
                            reader.onerror = () => { filesProcessed++; rejectEntry(); };
                            if (/\.(png|jpe?g|gif|svg)$/i.test(file.name) || /\.(xlsx)$/i.test(file.name)) reader.readAsDataURL(file);
                            else if (file.type.startsWith('text/') || !file.name.includes('.') || /\.(txt|js|css|html|py|json|md|xml|yaml|yml|sh|sql|c|cpp|h|hpp|java|php|rb|go|rs|swift|kt|lua|pl|r|dockerfile|ini|properties|toml|log|csv|bat|ts|jsx|tsx|scss|sass|vue|svelte|tex|bib)$/i.test(file.name)) reader.readAsText(file);
                            else { createFile(`${baseDropPath}/${currentPathInZip}`, `[Binary file]`, false); filesProcessed++; resolveEntry(); }
                        }, (err) => { filesProcessed++; rejectEntry(err); });
                    } else if (entry.isDirectory) {
                        if (SKIP_DIRS.has(entry.name)) { filesProcessed++; resolveEntry(); return; }
                        const dirPathInStructure = `${baseDropPath}/${currentPathInZip}`;
                        if (!fileStructure[dirPathInStructure]) createFolder(dirPathInStructure, true);
                        else fileStructure[dirPathInStructure].expanded = true;
                        const dirReader = entry.createReader(); let allEntries = [];
                        const readEntriesRecursive = async () => new Promise((res, rej) => dirReader.readEntries(async chunks => chunks.length ? allEntries.push(...chunks) && await readEntriesRecursive().then(res).catch(rej) : res(), rej));
                        try {
                            await readEntriesRecursive();
                            for (const subEntry of allEntries) await processEntry(subEntry, `${currentPathInZip}/${subEntry.name}`);
                            filesProcessed++; resolveEntry();
                        } catch (err) { filesProcessed++; rejectEntry(err); }
                    } else { filesProcessed++; resolveEntry(); }
                });
            }
            for (const item of items) if (item.kind === 'file') { const entry = item.webkitGetAsEntry(); if (entry) processQueue.push(processEntry(entry, entry.name)); }
            await Promise.allSettled(processQueue);
            renderFileTree(); updateStatusBar(); if (settings.autoSaveSession) saveSession();
            showNotification(`Done — ${filesProcessed} item(s) dropped.`, false, 4000);
        }
    });
    
    initCommandPalette();

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.toolbar-overflow-wrap')) closeToolbarMenu();
    });
});

const commands = [
    { id: 'new-file', label: 'New File', action: () => createNewFile(currentWorkingDirectory || 'root'), shortcut: 'Ctrl+Shift+N' },
    { id: 'new-folder', label: 'New Folder', action: () => createNewFolder(currentWorkingDirectory || 'root'), shortcut: 'Ctrl+Shift+D' },
    { id: 'new-tab', label: 'New Untitled Tab', action: newTab, shortcut: 'Ctrl+N' },
    { id: 'format-code', label: 'Format Code', action: formatCode, shortcut: 'Ctrl+Shift+F' },
    { id: 'save-file', label: 'Save File', action: saveCurrentFile, shortcut: 'Ctrl+S' },
    { id: 'save-all', label: 'Save All Files', action: saveAllFiles, shortcut: 'Ctrl+Shift+S' },
    { id: 'download-file', label: 'Download Current File', action: downloadCurrentFile },
    { id: 'download-project', label: 'Download Project (ZIP)', action: downloadProject },
    { id: 'close-all', label: 'Close All Tabs', action: closeAllTabs },
    { id: 'toggle-preview', label: 'Toggle Preview', action: togglePreview },
    { id: 'toggle-diff', label: 'Toggle Diff (Unsaved Changes)', action: toggleDiff },
    { id: 'toggle-sidebar', label: 'Toggle Sidebar', action: toggleSidebar },
    { id: 'collapse-all', label: 'Collapse All Folders', action: collapseAll },
    { id: 'expand-all', label: 'Expand All Folders', action: expandAll },
    { id: 'sort-by-ext', label: 'Sort Root by Extension', action: () => sortFolderByExtension('root') },
    { id: 'goto-line', label: 'Go to Line / Column', action: openGoToLine, shortcut: 'Ctrl+G' },
    { id: 'global-search', label: 'Focus Global Search', action: () => { document.getElementById('searchInput').focus(); document.getElementById('searchInput').select(); }, shortcut: 'Ctrl+Shift+G' },
    { id: 'find-replace', label: 'Find/Replace in File', action: () => openLocalSearch(true), shortcut: 'Ctrl+H' },
    { id: 'toggle-recent', label: 'Toggle Recent Files Panel', action: toggleRecentFiles },
    { id: 'settings', label: 'Open Settings', action: toggleSettings }
];

let selectedCommandIndex = 0;
let filteredCommands = [];

function initCommandPalette() {
    const input = document.getElementById('paletteInput');
    input.addEventListener('input', () => renderCommandPalette(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); selectedCommandIndex = Math.min(selectedCommandIndex + 1, filteredCommands.length - 1); renderCommandList(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); selectedCommandIndex = Math.max(selectedCommandIndex - 1, 0); renderCommandList(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (filteredCommands[selectedCommandIndex]) executeCommand(filteredCommands[selectedCommandIndex]); }
    });
}

function showCommandPalette() {
    const palette = document.getElementById('commandPalette');
    palette.style.display = 'flex';
    document.getElementById('paletteInput').value = '';
    renderCommandPalette('');
    setTimeout(() => document.getElementById('paletteInput').focus(), 10);
}

function hideCommandPalette() {
    const palette = document.getElementById('commandPalette');
    if (palette.style.display === 'none') return;
    palette.style.display = 'none';
    if (codeEditor) setTimeout(() => codeEditor.focus(), 0);
}

function renderCommandPalette(query) {
    const q = query.toLowerCase();
    filteredCommands = commands.filter(c => c.label.toLowerCase().includes(q));
    selectedCommandIndex = 0;
    renderCommandList();
}

function renderCommandList() {
    const ul = document.getElementById('paletteList');
    ul.innerHTML = '';
    filteredCommands.forEach((cmd, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${cmd.label}</span> <span class="shortcut">${cmd.shortcut || ''}</span>`;
        if (idx === selectedCommandIndex) li.classList.add('selected');
        li.addEventListener('click', () => executeCommand(cmd));
        li.addEventListener('mouseover', () => {
            ul.querySelectorAll('li').forEach((el, i) => el.classList.toggle('selected', i === idx));
            selectedCommandIndex = idx;
        });
        ul.appendChild(li);
    });
}

function executeCommand(cmd) {
    hideCommandPalette();
    setTimeout(cmd.action, 10);
}