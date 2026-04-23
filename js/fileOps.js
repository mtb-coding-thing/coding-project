const SKIP_DIRS = new Set([
    '.git', 'node_modules', '__pycache__', '.venv', 'venv', '.env',
    'dist', 'build', '.next', '.nuxt', 'out', 'coverage', '.cache',
    '.parcel-cache', '.turbo', 'vendor'
]);

// Extensions that must be read as a base64 data URL rather than text.
// Images are displayed in the preview pane; xlsx/xls are parsed by the XLSX library from base64.
// SVG is intentionally excluded — it is valid XML and opens as editable text in the editor.
const DATAURL_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif',
    'xlsx', 'xls',
]);

// Known binary extensions that cannot be meaningfully opened as text.
// Everything NOT in this set and NOT in DATAURL_EXTENSIONS is read as text.
// Using a denylist means unknown/new text-based formats work automatically.
const BINARY_EXTENSIONS = new Set([
    // Archives
    'zip', 'rar', 'gz', 'tar', 'bz2', 'xz', '7z', 'zst', 'lz4',
    // Compiled / object code
    'exe', 'dll', 'so', 'dylib', 'lib', 'a', 'o', 'obj', 'wasm',
    'class', 'jar', 'war', 'ear', 'pyc', 'pyd', 'pyo',
    // Documents (binary formats)
    'pdf', 'doc', 'docx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
    // Fonts
    'ttf', 'otf', 'woff', 'woff2', 'eot',
    // Audio
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'opus', 'm4a', 'wma', 'aiff',
    // Video
    'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v', 'mpeg', 'mpg',
    // Images (also in DATAURL_EXTENSIONS; listed here so BINARY_EXTENSIONS is self-contained)
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif',
    // Spreadsheets (binary; also in DATAURL_EXTENSIONS for the XLSX parser)
    'xlsx', 'xls',
    // Databases
    'sqlite', 'sqlite3', 'db',
]);

/**
 * Returns how a file should be read given its name.
 * @returns {'dataurl' | 'binary' | 'text'}
 */
function getFileReadMode(fileName) {
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    if (DATAURL_EXTENSIONS.has(ext)) return 'dataurl';
    if (BINARY_EXTENSIONS.has(ext)) return 'binary';
    return 'text';
}

async function newProject() {
    const hasUnsavedChanges = Array.from(openTabs.values()).some(tabData => tabData.unsaved) || (!currentFilePath && codeEditor.getValue().length > 0);
    if (openTabs.size > 0 || hasUnsavedChanges) {
        const confirmed = await showConfirmDialog("New Project", "Start new project? Unsaved changes will be lost.", "Proceed", "Cancel", true);
        if (!confirmed) return;
    }

    if (isDiffEnabled) toggleDiff();

    const tabsContainer = document.getElementById('tabs');
    while (tabsContainer.firstChild) { tabsContainer.removeChild(tabsContainer.firstChild); }

    openTabs.clear(); fileStructure = { 'root': { type: 'folder', children: [], expanded: true, displayName: 'root' } };
    currentFilePath = null; currentWorkingDirectory = 'root'; untitledTabCounter = 1;

    document.getElementById('editorPane').style.display = 'block';

    codeEditor.setValue(''); codeEditor.setOption('readOnly', false); codeEditor.setOption('mode', 'text/plain'); codeEditor.clearHistory(); codeEditor.refresh();
    renderFileTree(); updateTabs(); updateStatusBar(); showNotification('New project created.');

    if (settings.autoSaveSession) saveSession(); else await localforage.removeItem(SESSION_STORAGE_KEY);
}

async function handleDirectoryUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) { showNotification("No directory selected or browser unsupported.", true); event.target.value = null; return; }
    const hasUnsavedChanges = Array.from(openTabs.values()).some(tabData => tabData.unsaved) || (!currentFilePath && codeEditor.getValue().length > 0);
    if (openTabs.size > 0 || hasUnsavedChanges) { 
        const confirmed = await showConfirmDialog("Open Directory", "Open new directory? Unsaved changes will be lost.", "Open", "Cancel", true);
        if (!confirmed) { event.target.value = null; return; } 
    }

    if (isDiffEnabled) toggleDiff();

    let rootDirName = 'Uploaded Directory'; let commonPrefix = '';
    if (files[0] && files[0].webkitRelativePath) { commonPrefix = files[0].webkitRelativePath.split('/')[0]; rootDirName = commonPrefix; }

    const tabsContainer = document.getElementById('tabs');
    while (tabsContainer.firstChild) { tabsContainer.removeChild(tabsContainer.firstChild); }
    openTabs.clear();

    fileStructure = { 'root': { type: 'folder', children: [], expanded: true, displayName: rootDirName } };
    currentFilePath = null; currentWorkingDirectory = 'root'; untitledTabCounter = 1;

    document.getElementById('editorPane').style.display = 'block';

    codeEditor.setValue(''); codeEditor.setOption('readOnly', false); codeEditor.setOption('mode', 'text/plain'); codeEditor.clearHistory();
    updateTabs(); showNotification(`Reading directory "${rootDirName}"...`, false, 5000);
    
    const fileReadPromises = []; const failedFiles = [];

    for (const file of files) {
        if (file.name.startsWith('.') || file.name === 'Thumbs.db' || file.name === '.DS_Store') continue;

        const relativePath = file.webkitRelativePath.substring(commonPrefix.length).replace(/^\//, '');
        const topSegment = relativePath.split('/')[0];
        if (SKIP_DIRS.has(topSegment)) continue;

        if (file.size > MAX_FILE_SIZE_BYTES) {
            showNotification(`Skipping large file: ${file.name} (exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`, true);
            createFile(`root/${relativePath}`, `[File too large to load: ${file.name}]`, false); continue;
        }

        const internalPath = `root/${relativePath}`;
        fileReadPromises.push(new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result; const parts = internalPath.split('/'); let currentParentPath = 'root';
                    for (let i = 1; i < parts.length - 1; i++) {
                        currentParentPath += `/${parts[i]}`;
                        if (!fileStructure[currentParentPath]) createFolder(currentParentPath);
                        else if (fileStructure[currentParentPath].type !== 'folder') { reject(new Error(`Path conflict for ${currentParentPath}`)); return; }
                    }
                    createFile(internalPath, content, false); resolve();
                } catch (error) { failedFiles.push(file.name); reject(error); }
            };
            reader.onerror = () => { failedFiles.push(file.name); reject(new Error(`Could not read file ${file.name}`)); };
            
            const readMode = getFileReadMode(file.name);
            if (readMode === 'dataurl') {
                reader.readAsDataURL(file);
            } else if (readMode === 'text') {
                reader.readAsText(file);
            } else {
                createFile(internalPath, `[Binary file: ${file.name}]`, false); resolve();
            }
        }));
    }
    try { await Promise.all(fileReadPromises); showNotification(`Directory "${rootDirName}" loaded successfully.`); }
    catch (error) { const errorMsg = failedFiles.length > 0 ? `Error loading directory. Failed files: ${failedFiles.join(', ')}` : `Error loading directory: ${error.message}`; showNotification(errorMsg, true); }
    finally {
        event.target.value = null; renderFileTree(); updateTabs(); updateStatusBar(); codeEditor.refresh();
        if (settings.autoSaveSession) saveSession(); else await localforage.removeItem(SESSION_STORAGE_KEY);
    }
}

function promptForFilenameAndSaveUntitled(untitledPathToSave) {
    return new Promise((resolve) => {
        const parentPath = currentWorkingDirectory || 'root';
        const parentEntry = fileStructure[parentPath];
        if (!parentEntry || parentEntry.type !== 'folder') {
            showNotification("Cannot save: Invalid current working directory.", true);
            resolve(false);
            return;
        }
        if (!parentEntry.expanded) toggleFolder(parentPath);

        setTimeout(() => {
            const ul = document.querySelector(`.folder[data-path="${CSS.escape(parentPath)}"] > ul`);
            if (!ul) { renderFileTree(); resolve(false); return; }
            ul.querySelectorAll('li > .label > input.tree-input').forEach(inp => inp.closest('li').remove());

            const untitledEntry = fileStructure[untitledPathToSave];
            const currentContent = untitledEntry ? untitledEntry.content : codeEditor.getValue();

            createTreeInput('file', 'new_untitled_file.txt', (fileName) => {
                if (fileName) {
                    const trimmedName = fileName.trim();
                    if (!trimmedName) { showNotification("Filename cannot be empty.", true); renderFileTree(); resolve(false); return; }
                    if (/[\\/:*?"<>|]/.test(trimmedName)) { showNotification("Filename invalid.", true); renderFileTree(); resolve(false); return; }

                    const newPath = `${parentPath}/${trimmedName}`;
                    if (fileStructure[newPath] && newPath !== untitledPathToSave) { showNotification(`File "${trimmedName}" already exists.`, true); renderFileTree(); resolve(false); return; }

                    createFile(newPath, currentContent, false);

                    const tabData = openTabs.get(untitledPathToSave);
                    if (tabData) {
                        openTabs.delete(untitledPathToSave); tabData.tabElement.dataset.filePath = newPath;
                        const textSpan = tabData.tabElement.querySelector('.tab-text');
                        if (textSpan) {
                            textSpan.childNodes[0].nodeValue = trimmedName;
                            const indicator = textSpan.querySelector('.unsaved-indicator'); if (indicator) indicator.remove();
                        }
                        tabData.tabElement.title = newPath.replace(/^root\/?/, ''); tabData.unsaved = false; openTabs.set(newPath, tabData);
                    }

                    delete fileStructure[untitledPathToSave]; currentFilePath = newPath;
                    if (isDiffEnabled) toggleDiff();
                    showNotification(`File "${trimmedName}" saved.`);
                    renderFileTree(); updateTabs(); updateStatusBar(); setLanguage(newPath);
                    if (settings.autoSaveSession) saveSession();
                    resolve(true);
                } else {
                    renderFileTree();
                    resolve(false);
                }
            }, () => { renderFileTree(); resolve(false); }, ul);
        }, 0);
    });
}

function saveCurrentFile() {
    const editorContent = codeEditor.getValue();
    if (currentFilePath && fileStructure[currentFilePath] && fileStructure[currentFilePath].isUntitled) {
        promptForFilenameAndSaveUntitled(currentFilePath);
    } else if (currentFilePath && fileStructure[currentFilePath]) {
        fileStructure[currentFilePath].content = editorContent; 
        fileStructure[currentFilePath].savedContent = editorContent; 
        fileStructure[currentFilePath].unsaved = false;
        
        if (isDiffEnabled) toggleDiff(); 

        showNotification(`File "${currentFilePath.split('/').pop()}" saved.`); updateTabs(); updateStatusBar(); if (settings.autoSaveSession) saveSession();
    } else if (!currentFilePath && editorContent.length > 0) {
        const tempUntitledId = `untitled://tempsave-${Date.now()}`; currentFilePath = tempUntitledId;
        fileStructure[tempUntitledId] = { type: 'file', content: editorContent, savedContent: '', unsaved: true, isUntitled: true };
        const tabDisplayName = `Untitled ${untitledTabCounter}`;
        const tempTab = createTabElement(tempUntitledId, true, tabDisplayName); openTabs.set(tempUntitledId, { tabElement: tempTab, unsaved: true });
        updateTabs(); promptForFilenameAndSaveUntitled(tempUntitledId);
    } else if (!currentFilePath && editorContent.length === 0) {
        showNotification("Nothing to save.");
    } else {
        showNotification("Save failed: Inconsistent editor state.", true);
    }
}

function downloadCurrentFile() {
    if (!currentFilePath) { showNotification("No active file to download.", true); return; }
    
    let content = codeEditor.getValue();
    let fileName = fileStructure[currentFilePath]?.isUntitled 
        ? fileStructure[currentFilePath].displayName 
        : currentFilePath.split('/').pop();
        
    if (DATAURL_EXTENSIONS.has(fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '') && content.startsWith('data:')) {
        const link = document.createElement("a");
        link.href = content;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification(`Downloaded ${fileName}`);
        return;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, fileName);
    showNotification(`Downloaded ${fileName}`);
}

async function openFile(filePath) {
    if (isDiffEnabled) toggleDiff();

    // Save scroll + cursor position for the file we're leaving
    if (currentFilePath && currentFilePath !== filePath && openTabs.has(currentFilePath) && codeEditor) {
        const tabData = openTabs.get(currentFilePath);
        tabData.scrollInfo = codeEditor.getScrollInfo();
        tabData.cursorPos = codeEditor.getCursor();
    }

    if (!fileStructure[filePath] || fileStructure[filePath].type !== 'file') {
        if (filePath.startsWith("untitled://")) {
            if (openTabs.size > 0) { const lastTabPath = Array.from(openTabs.keys()).pop(); if (lastTabPath) openFile(lastTabPath); return; }
            else { currentFilePath = null; codeEditor.setValue(''); updateTabs(); updateStatusBar(); return; }
        }
        showNotification(`Cannot open "${filePath.split('/').pop()}": Not a file or not found.`, true); return;
    }

    const fileEntry = fileStructure[filePath]; let content = fileEntry.content; const originalUnsavedState = fileEntry.unsaved;
    let isReadOnly = false; let isLargeFile = false;

    if (content === null || typeof content === 'undefined') { content = ""; fileEntry.content = ""; }
    const estimatedSize = new Blob([content]).size;
    const fileExt = filePath.includes('.') ? filePath.split('.').pop().toLowerCase() : '';
    if (estimatedSize > LARGE_FILE_THRESHOLD_BYTES && !DATAURL_EXTENSIONS.has(fileExt) && !filePath.startsWith("untitled://")) { isLargeFile = true; showNotification(`Large file mode active for "${filePath.split('/').pop()}".`, false, 4000); }

    if (DATAURL_EXTENSIONS.has(fileExt) && !['xlsx','xls'].includes(fileExt) && content.startsWith('data:image')) {
        const previewPane = document.getElementById('previewPane');
        const iframe = document.getElementById('previewFrame');
        document.getElementById('editorPane').style.display = 'none';
        // Hide the minimap — it's a flex sibling and shifts left when the editor pane is hidden
        const minimapWrap = document.getElementById('minimapWrap');
        if (minimapWrap) minimapWrap.style.display = 'none';
        previewPane.style.display = 'block';
        previewPane.style.flexBasis = '100%';
        iframe.srcdoc = `
            <style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1e1e1e;}img{max-width:90%;max-height:90%;box-shadow:0 0 10px rgba(0,0,0,0.5);}</style>
            <img src="${content}" alt="${filePath}">
        `;

        currentFilePath = filePath;
        if (!openTabs.has(filePath)) {
            const tab = createTabElement(filePath, false, filePath.split('/').pop());
            openTabs.set(filePath, { tabElement: tab, unsaved: false });
        }
        updateTabs(); updateStatusBar(); if (settings.autoSaveSession) saveSession();
        return;
    }

    document.getElementById('editorPane').style.display = 'block';
    // Restore the minimap whenever we're back to a normal (non-image) file
    const minimapWrap = document.getElementById('minimapWrap');
    if (minimapWrap) minimapWrap.style.display = '';
    if (!isPreviewEnabled) {
        const previewPane = document.getElementById('previewPane');
        // If we're leaving image-view mode (preview pane was showing an image at full width),
        // clear srcdoc so the next image open always triggers a fresh render — browsers
        // won't re-render an iframe when srcdoc is reassigned the same string.
        if (previewPane.style.flexBasis === '100%') {
            document.getElementById('previewFrame').srcdoc = '';
        }
        previewPane.style.display = 'none';
    }

    if (filePath.startsWith("untitled://")) { isReadOnly = false; }
    else if (typeof content === 'string' && content.startsWith('[Binary') && !DATAURL_EXTENSIONS.has(fileExt)) { isReadOnly = true; }
    else if (['xlsx', 'xls'].includes(fileExt)) {
        if (typeof XLSX === 'undefined') { showNotification("XLSX library not loaded.", true); return; }
        try { let base64Content = content; if (typeof content === 'string' && content.startsWith('data:')) { base64Content = content.substring(content.indexOf(',') + 1); } content = loadFileData(filePath.split('/').pop(), base64Content); isReadOnly = true; showNotification("XLSX opened as read-only CSV. Use Preview for table view.", false, 4000); }
        catch (e) { content = `Error opening XLSX: ${e.message}`; isReadOnly = true; }
    }

    const tabExistedBeforeOpen = openTabs.has(filePath); currentFilePath = filePath;

    // Update CWD to the file's parent folder so "New File" creates in the right place
    if (!filePath.startsWith('untitled://')) {
        const parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
        if (parentPath && fileStructure[parentPath]) currentWorkingDirectory = parentPath;
    }

    if (!tabExistedBeforeOpen) {
        const tabName = filePath.startsWith("untitled://") ? fileEntry.displayName : filePath.split('/').pop();
        const tab = createTabElement(filePath, fileEntry.unsaved, tabName); openTabs.set(filePath, { tabElement: tab, unsaved: fileEntry.unsaved });
    } else { openTabs.get(filePath).unsaved = fileEntry.unsaved; }

    if (filePath.startsWith("untitled://")) codeEditor.setOption('mode', 'text/plain'); else setLanguage(filePath);

    codeEditor.setOption('readOnly', isReadOnly);
    if (isLargeFile) { codeEditor.setOption('lint', false); codeEditor.setOption('foldGutter', false); codeEditor.setOption('gutters', ["CodeMirror-linenumbers"]); }
    else {
        const mode = codeEditor.getOption('mode'); const gutters = ["CodeMirror-linenumbers"]; if (settings.foldGutter) gutters.push("CodeMirror-foldgutter");
        const isLintable = mode === 'javascript' || mode === 'css' || mode === 'application/json'; if (isLintable) gutters.push("CodeMirror-lint-markers");
        const cssLintOpts = { options: { 'known-properties': false, 'vendor-prefix': false, 'compatible-vendor-prefixes': false } };
        codeEditor.setOption('gutters', gutters); codeEditor.setOption('lint', isLintable ? (mode === 'javascript' ? { options: jsHintOptions } : mode === 'css' ? cssLintOpts : true) : false);
    }

    codeEditor.setValue(content); if (fileStructure[filePath]) fileStructure[filePath].unsaved = originalUnsavedState;
    if (!tabExistedBeforeOpen) codeEditor.clearHistory(); codeEditor.refresh();

    // Restore previous scroll position and cursor when switching back to an existing tab
    if (tabExistedBeforeOpen) {
        const savedTab = openTabs.get(filePath);
        if (savedTab?.cursorPos) {
            codeEditor.setCursor(savedTab.cursorPos);
        }
        if (savedTab?.scrollInfo) {
            codeEditor.scrollTo(savedTab.scrollInfo.left, savedTab.scrollInfo.top);
        }
    }

    const isPreviewable = !filePath.startsWith("untitled://") && /\.(html?|md|markdown|tex|latex|ltx|csv|xlsx|svg)$/i.test(filePath);
    if (isPreviewEnabled && !isPreviewable) { isPreviewEnabled = false; updatePreviewLayout(); codeEditor.off('change', updatePreview); }
    else if (isPreviewEnabled && isPreviewable) { updatePreviewLayout(); updatePreview(); }

    updateTabs(); updateStatusBar(); codeEditor.focus(); if (settings.autoSaveSession) saveSession();
    addRecentFile(filePath);
    if (typeof refreshMinimap === 'function') refreshMinimap();
}

async function downloadProject() {
    const downloadButton = document.getElementById('downloadBtn'); 
    const originalButtonText = downloadButton.textContent;
    downloadButton.textContent = 'Zipping...'; 
    downloadButton.disabled = true;
    
    if (!zipWorker) initWorkers();

    const topLevelFolderName = fileStructure.root.displayName || 'root';
    
    zipWorker.onmessage = function(e) {
        if (e.data.error) {
            console.error('Error in ZIP Worker:', e.data.error);
            showNotification('Download failed: ' + e.data.error, true);
        } else if (e.data.blob) {
            saveAs(e.data.blob, `${topLevelFolderName}.zip`); 
            showNotification('Downloaded. If Windows blocks extraction, right-click the ZIP → Properties → Unblock.', false, 7000);
        }
        downloadButton.textContent = originalButtonText; 
        downloadButton.disabled = false; 
    };
    
    zipWorker.postMessage({ fileStructure, rootName: topLevelFolderName });
}

async function downloadFolder(folderPath) {
    if (!fileStructure[folderPath] || fileStructure[folderPath].type !== 'folder') return;

    const folderName = folderPath === 'root'
        ? (fileStructure.root.displayName || 'root')
        : folderPath.split('/').pop();

    showNotification(`Zipping "${folderName}"...`, false, 10000);
    if (!folderZipWorker) initWorkers();

    const subStructure = {};

    function collect(originalPath, remappedPath) {
        const entry = fileStructure[originalPath];
        if (!entry) return;
        if (entry.type === 'folder') {
            subStructure[remappedPath] = {
                type: 'folder',
                children: [...entry.children],
                expanded: true,
                displayName: entry.displayName || originalPath.split('/').pop()
            };
            entry.children.forEach(childName => {
                collect(`${originalPath}/${childName}`, `${remappedPath}/${childName}`);
            });
        } else {
            subStructure[remappedPath] = {
                type: 'file', content: entry.content, savedContent: entry.savedContent, unsaved: false, isUntitled: false
            };
        }
    }

    collect(folderPath, 'root');

    folderZipWorker.onmessage = function(e) {
        if (e.data.error) {
            console.error('Error zipping folder:', e.data.error);
            showNotification(`Zip failed: ${e.data.error}`, true);
        } else if (e.data.blob) {
            saveAs(e.data.blob, `${folderName}.zip`);
            showNotification(`"${folderName}" downloaded. If Windows blocks extraction, right-click → Properties → Unblock.`, false, 7000);
        }
    };

    folderZipWorker.postMessage({ fileStructure: subStructure, rootName: folderName });
}

function getModeForFile(filePath) {
    if (filePath.startsWith("untitled://")) return 'text/plain';
    const ext = filePath.split('.').pop().toLowerCase();
    const modeMap = { 'html': 'htmlmixed', 'htm': 'htmlmixed', 'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript', 'ts': 'text/typescript', 'jsx': 'text/jsx', 'tsx': 'text/typescript-jsx', 'py': 'python', 'css': 'css', 'scss': 'text/x-scss', 'less': 'text/x-less', 'json': 'application/json', 'jsonc': 'application/json', 'md': 'markdown', 'markdown': 'markdown', 'xml': 'xml', 'xhtml': 'xml', 'svg': 'xml', 'yaml': 'text/x-yaml', 'yml': 'text/x-yaml', 'sh': 'text/x-sh', 'bash': 'text/x-sh', 'zsh': 'text/x-sh', 'fish': 'text/x-sh', 'sql': 'text/x-sql', 'java': 'text/x-java', 'c': 'text/x-csrc', 'h': 'text/x-csrc', 'cpp': 'text/x-c++src', 'hpp': 'text/x-c++src', 'cc': 'text/x-c++src', 'hh': 'text/x-c++src', 'cxx': 'text/x-c++src', 'cs': 'text/x-csharp', 'php': 'application/x-httpd-php', 'rb': 'text/x-ruby', 'go': 'go', 'rs': 'rust', 'swift': 'text/x-swift', 'kt': 'text/x-kotlin', 'kts': 'text/x-kotlin', 'lua': 'text/x-lua', 'pl': 'text/x-perl', 'pm': 'text/x-perl', 'r': 'text/x-rsrc', 'dockerfile': 'text/x-dockerfile', 'ini': 'text/x-properties', 'properties': 'text/x-properties', 'toml': 'text/x-toml', 'csv': 'text/plain', 'tsv': 'text/plain', 'log': 'text/plain', 'txt': 'text/plain', 'bat': 'text/plain', 'cmd': 'text/plain', 'lock': 'text/plain', 'sass': 'text/x-sass', 'vue': 'text/x-vue', 'svelte': 'text/x-svelte', 'tex': 'text/x-stex', 'latex': 'text/x-stex', 'ltx': 'text/x-stex', 'bib': 'text/x-stex', 'graphql': 'graphql', 'gql': 'graphql' };
    return modeMap[ext] || 'text/plain';
}

function setLanguage(filePath) {
    const mode = getModeForFile(filePath); codeEditor.setOption('mode', mode);
    codeEditor.setOption('autoCloseTags', settings.autoCloseTags && (mode === 'htmlmixed' || mode === 'xml')); codeEditor.setOption('matchBrackets', settings.matchBrackets); codeEditor.setOption('autoCloseBrackets', settings.autoCloseBrackets);
    const hintOptions = { completeSingle: false };
    if (mode === 'javascript') hintOptions.hint = CodeMirror.hint.javascript; else if (mode === 'css') hintOptions.hint = CodeMirror.hint.css; else if (mode === 'htmlmixed') hintOptions.hint = CodeMirror.hint.html; else if (mode === 'sql') hintOptions.hint = CodeMirror.hint.sql; else hintOptions.hint = null;
    codeEditor.setOption('hintOptions', hintOptions);

    let enableLint = false; let lintOptions = true;
    if (mode === 'javascript') { lintOptions = { options: jsHintOptions }; enableLint = true; } else if (mode === 'css' || mode === 'application/json') { lintOptions = mode === 'css' ? { options: { 'known-properties': false, 'vendor-prefix': false, 'compatible-vendor-prefixes': false } } : true; enableLint = true; } else { enableLint = false; }
    codeEditor.setOption('lint', enableLint ? lintOptions : false);

    const gutters = ["CodeMirror-linenumbers"]; if (settings.foldGutter) gutters.push("CodeMirror-foldgutter"); if (enableLint) gutters.push("CodeMirror-lint-markers");
    codeEditor.setOption('gutters', gutters);
    if (enableLint) setTimeout(() => codeEditor.performLint(), 200); updateStatusBar();
}

function loadFileData(filename, base64Data) {
    if (!base64Data) { return `Error: No data for ${filename}`; }
    if (typeof XLSX === 'undefined') { return "Error: XLSX library not available."; }
    try {
        var workbook = XLSX.read(base64Data, { type: 'base64' }); if (!workbook.SheetNames?.length) return "Error: No sheets found in the file.";
        var firstSheetName = workbook.SheetNames[0], worksheet = workbook.Sheets[firstSheetName]; if (!worksheet) return `Error: Unable to read sheet "${firstSheetName}".`;
        var jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: true, defval: null });
        var filteredData = jsonData.filter(row => Array.isArray(row) && row.some(filledCell)); if (filteredData.length === 0) return "(Sheet is empty)";
        var headerRowIndex = 0, maxHeaderSearchDepth = Math.min(filteredData.length - 1, 25);
        for (let i = 0; i < maxHeaderSearchDepth; i++) { const currentRowLength = filteredData[i].filter(filledCell).length, nextRowLength = (i + 1 < filteredData.length) ? filteredData[i + 1].filter(filledCell).length : 0; if (currentRowLength >= nextRowLength || i === maxHeaderSearchDepth - 1) { if (currentRowLength > 0) { headerRowIndex = i; break; } } }
        var dataToConvert = filteredData.slice(headerRowIndex).map(row => row.map(cell => cell ?? ''));
        var csvSheet = XLSX.utils.aoa_to_sheet(dataToConvert); var csv = XLSX.utils.sheet_to_csv(csvSheet); return csv;
    } catch (e) { return `Error processing XLSX: ${e.message}.`; }
}

async function handleFileUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > MAX_FILE_SIZE_BYTES) { showNotification(`File "${file.name}" is too large. Upload aborted.`, true); event.target.value = null; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result; const fileName = file.name;
        const parentPath = currentWorkingDirectory || 'root'; const fullPath = `${parentPath}/${fileName}`;
        if (fileStructure[fullPath] && !fileStructure[fullPath].isUntitled) { showNotification(`File "${fileName}" already exists.`, true); return; }
        createFile(fullPath, content, false); renderFileTree(); openFile(fullPath);
        showNotification(`File "${fileName}" uploaded.`); if (settings.autoSaveSession) saveSession();
    };
    reader.onerror = () => { showNotification(`Error reading file "${file.name}".`, true); };
    
    const readMode = getFileReadMode(file.name);
    if (readMode === 'dataurl') reader.readAsDataURL(file);
    else if (readMode === 'text') reader.readAsText(file);
    else { createFile(`${currentWorkingDirectory || 'root'}/${file.name}`, `[Binary file: ${file.name}]`, false); renderFileTree(); showNotification(`File "${file.name}" uploaded as placeholder.`); if (settings.autoSaveSession) saveSession(); }
    event.target.value = null;
}

function createFolder(fullPath, expanded = false) {
    if (fileStructure[fullPath]) return;
    const parts = fullPath.split('/'); const name = parts.pop(); const parentPath = parts.join('/') || 'root';
    if (!fileStructure[parentPath] || fileStructure[parentPath].type !== 'folder') return;
    fileStructure[fullPath] = { type: 'folder', children: [], expanded: expanded, isUntitled: false };
    fileStructure[parentPath].children.push(name);
    fileStructure[parentPath].children.sort((a, b) => { const pathA = `${parentPath}/${a}`, pathB = `${parentPath}/${b}`, typeA = fileStructure[pathA]?.type || 'f', typeB = fileStructure[pathB]?.type || 'f'; if (typeA[0] == 'f' && typeB[0] != 'f') return 1; if (typeA[0] != 'f' && typeB[0] == 'f') return -1; return a.localeCompare(b); });
}

function createFile(fullPath, content = '', unsaved = false) {
    const parts = fullPath.split('/'); const fileName = parts.pop(); const folderPath = parts.join('/') || 'root';
    if (!fileStructure[folderPath] || fileStructure[folderPath].type !== 'folder') return;
    
    // Maintain savedContent for diff viewer
    fileStructure[fullPath] = { type: 'file', content: content, savedContent: content, unsaved: unsaved, isUntitled: false };
    
    if (!fileStructure[folderPath].children.includes(fileName)) {
        fileStructure[folderPath].children.push(fileName);
        fileStructure[folderPath].children.sort((a, b) => { const pathA = `${folderPath}/${a}`, pathB = `${folderPath}/${b}`, typeA = fileStructure[pathA]?.type || 'f', typeB = fileStructure[pathB]?.type || 'f'; if (typeA[0] == 'f' && typeB[0] != 'f') return 1; if (typeA[0] != 'f' && typeB[0] == 'f') return -1; return a.localeCompare(b); });
    }
}

function getFileTemplate(fileName) {
    if (!settings.fileTemplates) return '';
    const ext = fileName.split('.').pop().toLowerCase();
    const indent = ' '.repeat(settings.tabWidth || 4);
    const templates = {
        'html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n${indent}<meta charset="UTF-8">\n${indent}<meta name="viewport" content="width=device-width, initial-scale=1.0">\n${indent}<title>Document</title>\n</head>\n<body>\n${indent}\n</body>\n</html>`,
        'htm': `<!DOCTYPE html>\n<html lang="en">\n<head>\n${indent}<meta charset="UTF-8">\n${indent}<title>Document</title>\n</head>\n<body>\n${indent}\n</body>\n</html>`,
        'css': `/* Styles */\n`,
        'scss': `// Styles\n`,
        'js': `'use strict';\n`,
        'ts': ``,
        'jsx': `export default function Component() {\n${indent}return (\n${indent}${indent}<div>\n${indent}${indent}${indent}\n${indent}${indent}</div>\n${indent});\n}\n`,
        'tsx': `export default function Component() {\n${indent}return (\n${indent}${indent}<div>\n${indent}${indent}${indent}\n${indent}${indent}</div>\n${indent});\n}\n`,
        'json': `{\n${indent}\n}\n`,
        'md': `# Title\n\n`,
        'py': ``,
        'sh': `#!/usr/bin/env bash\nset -euo pipefail\n\n`,
        'bash': `#!/usr/bin/env bash\nset -euo pipefail\n\n`,
        'dockerfile': `FROM ubuntu:22.04\n\nWORKDIR /app\n\nCOPY . .\n\nCMD ["bash"]\n`,
        'yml': `# Config\n`,
        'yaml': `# Config\n`,
        'toml': `# Config\n`,
        'sql': `-- SQL Script\n`,
        'java': `public class ${fileName.replace(/\.java$/, '')} {\n${indent}public static void main(String[] args) {\n${indent}${indent}\n${indent}}\n}\n`,
        'c': `#include <stdio.h>\n\nint main(void) {\n${indent}\n${indent}return 0;\n}\n`,
        'cpp': `#include <iostream>\n\nint main() {\n${indent}\n${indent}return 0;\n}\n`,
        'rs': `fn main() {\n${indent}\n}\n`,
        'go': `package main\n\nimport "fmt"\n\nfunc main() {\n${indent}fmt.Println("Hello, World!")\n}\n`,
        'rb': `# frozen_string_literal: true\n\n`,
        'php': `<?php\n\n`,
        'vue': `<template>\n${indent}<div>\n${indent}${indent}\n${indent}</div>\n</template>\n\n<script>\nexport default {\n${indent}name: '${fileName.replace(/\.vue$/, '')}',\n};\n</script>\n\n<style scoped>\n</style>\n`,
        'svelte': `<script>\n${indent}\n</script>\n\n<div>\n${indent}\n</div>\n\n<style>\n</style>\n`,
        'tex': `\\documentclass{article}\n\n\\title{${fileName.replace(/\.(tex|latex|ltx)$/, '')}}\n\\author{}\n\\date{\\today}\n\n\\begin{document}\n\n\\maketitle\n\n\\section{Introduction}\n\n\\end{document}\n`,
        'latex': `\\documentclass{article}\n\n\\title{${fileName.replace(/\.(tex|latex|ltx)$/, '')}}\n\\author{}\n\\date{\\today}\n\n\\begin{document}\n\n\\maketitle\n\n\\section{Introduction}\n\n\\end{document}\n`,
        'ltx': `\\documentclass{article}\n\n\\title{${fileName.replace(/\.(tex|latex|ltx)$/, '')}}\n\\author{}\n\\date{\\today}\n\n\\begin{document}\n\n\\maketitle\n\n\\section{Introduction}\n\n\\end{document}\n`,
        'bib': `@article{key,\n${indent}author = {},\n${indent}title  = {},\n${indent}year   = {},\n${indent}journal = {},\n}\n`,
    };
    return templates[ext] ?? '';
}

async function saveAllFiles() {
    const unsavedPaths = Array.from(openTabs.keys()).filter(p => {
        const entry = fileStructure[p];
        return entry && entry.unsaved && !entry.isUntitled;
    });
    if (unsavedPaths.length === 0) { showNotification('All files are already saved.'); return; }

    const prevPath = currentFilePath;
    for (const p of unsavedPaths) {
        fileStructure[p].content = openTabs.get(p) ? fileStructure[p].content : fileStructure[p].content;
        fileStructure[p].savedContent = fileStructure[p].content;
        fileStructure[p].unsaved = false;
    }
    // If current file in editor is one we just saved, keep editor in sync
    if (prevPath && fileStructure[prevPath] && !fileStructure[prevPath].isUntitled) {
        fileStructure[prevPath].content = codeEditor.getValue();
        fileStructure[prevPath].savedContent = codeEditor.getValue();
        fileStructure[prevPath].unsaved = false;
    }
    if (isDiffEnabled) toggleDiff();
    updateTabs(); updateStatusBar();
    if (settings.autoSaveSession) saveSession();
    showNotification(`Saved ${unsavedPaths.length} file${unsavedPaths.length !== 1 ? 's' : ''}.`);
}