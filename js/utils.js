function updateStatusBar() {
    if (!codeEditor) return;
    const cursor = codeEditor.getCursor(); const line = cursor.line + 1; const column = cursor.ch + 1;
    let content = ''; try { content = codeEditor.getValue(); } catch(e) {}
    const lineCount = codeEditor.lineCount();
    const size = new Blob([content]).size;
    const cwdDisplayPath = currentWorkingDirectory === 'root' ? '/' : `/${currentWorkingDirectory.replace(/^root\/?/, '')}`;
    const mode = codeEditor.getOption('mode');
    const modeName = modeNames[mode] || mode;
    let unsavedIndicator = '';
    if (currentFilePath && fileStructure[currentFilePath]?.unsaved) {
        unsavedIndicator = ' (unsaved)';
    } else if (!currentFilePath && content.length > 0) {
        unsavedIndicator = ' (unsaved)';
    }

    // Word count for text/markdown modes
    let wordCountStr = '';
    if (mode === 'markdown' || mode === 'text/plain') {
        const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
        wordCountStr = ` | ${wordCount} word${wordCount !== 1 ? 's' : ''}`;
    }

    // Encoding detection — sniff for non-ASCII to guess UTF-8 vs ASCII
    let encoding = 'UTF-8';
    try {
        const sample = content.slice(0, 4096);
        encoding = /[^\x00-\x7F]/.test(sample) ? 'UTF-8' : 'ASCII';
    } catch (_) {}

    // Line ending detection
    let lineEnding = 'LF';
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const crCount   = (content.match(/\r(?!\n)/g) || []).length;
    if (crlfCount > 0 && crlfCount >= crCount) lineEnding = 'CRLF';
    else if (crCount > crlfCount) lineEnding = 'CR';

    const statusEl = document.getElementById('statusContent');
    statusEl.innerHTML =
        `CWD: ${escapeHtml(cwdDisplayPath)} | Mode: ${escapeHtml(modeName)} | ` +
        `<span id="statusLineCol" class="status-goto" title="Go to Line/Column (Ctrl+G)">Ln ${line}/${lineCount}, Col ${column}</span>` +
        `${wordCountStr} | ${size} B | ${encoding} | ` +
        `<span id="statusLineEnding" class="status-goto" title="Click to convert line endings">${lineEnding}</span>` +
        `${escapeHtml(unsavedIndicator)}`;

    const gotoSpan = document.getElementById('statusLineCol');
    if (gotoSpan) gotoSpan.onclick = () => openGoToLine();

    const leSpan = document.getElementById('statusLineEnding');
    if (leSpan) leSpan.onclick = () => cycleLineEnding();

    // Update breadcrumb bar whenever the status bar updates
    updateBreadcrumb();
}

// Update the breadcrumb bar above the tabs
function updateBreadcrumb() {
    const bar = document.getElementById('breadcrumbBar');
    if (!bar) return;

    bar.innerHTML = '';

    if (!currentFilePath) {
        bar.innerHTML = '<span class="breadcrumb-empty">No file open</span>';
        return;
    }

    if (currentFilePath.startsWith('untitled://')) {
        const span = document.createElement('span');
        span.className = 'breadcrumb-segment breadcrumb-file';
        span.textContent = fileStructure[currentFilePath]?.displayName || 'Untitled';
        bar.appendChild(span);
        return;
    }

    // Build segments from path (strip leading "root/")
    const segments = currentFilePath.replace(/^root\/?/, '').split('/').filter(Boolean);
    const rootLabel = fileStructure['root']?.displayName || 'root';

    // Root segment
    const rootSpan = document.createElement('span');
    rootSpan.className = 'breadcrumb-segment breadcrumb-folder';
    rootSpan.textContent = rootLabel;
    rootSpan.title = '/';
    rootSpan.onclick = () => { currentWorkingDirectory = 'root'; renderFileTree(); };
    bar.appendChild(rootSpan);

    segments.forEach((seg, i) => {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-sep';
        sep.textContent = '›';
        bar.appendChild(sep);

        const isLast = i === segments.length - 1;
        const segPath = 'root/' + segments.slice(0, i + 1).join('/');
        const span = document.createElement('span');
        span.className = isLast ? 'breadcrumb-segment breadcrumb-file' : 'breadcrumb-segment breadcrumb-folder';
        span.textContent = seg;
        span.title = segPath.replace(/^root\/?/, '');
        if (!isLast) {
            span.onclick = () => { if (fileStructure[segPath]) { currentWorkingDirectory = segPath; renderFileTree(); } };
        } else {
            span.title = 'Click to copy path';
            span.onclick = () => {
                const displayPath = currentFilePath.replace(/^root\/?/, '');
                navigator.clipboard.writeText(displayPath).then(() => {
                    showNotification(`Path copied: ${displayPath}`);
                }).catch(() => {
                    showNotification('Could not copy path to clipboard.', true);
                });
            };
        }
        bar.appendChild(span);
    });
}

// Convert line endings of the current file between LF, CRLF, and CR.
// Cycles: LF → CRLF → CR → LF. Marks file unsaved after conversion.
function cycleLineEnding() {
    if (!codeEditor || !currentFilePath) return;
    const content = codeEditor.getValue();

    const crlfCount = (content.match(/\r\n/g) || []).length;
    const crCount   = (content.match(/\r(?!\n)/g) || []).length;
    let current = 'LF';
    if (crlfCount > 0 && crlfCount >= crCount) current = 'CRLF';
    else if (crCount > crlfCount) current = 'CR';

    const next = current === 'LF' ? 'CRLF' : current === 'CRLF' ? 'CR' : 'LF';

    // Normalise to LF first, then convert to target
    let normalised = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let converted;
    if (next === 'CRLF') converted = normalised.replace(/\n/g, '\r\n');
    else if (next === 'CR') converted = normalised.replace(/\n/g, '\r');
    else converted = normalised;

    if (converted === content) return; // nothing changed

    const cursor = codeEditor.getCursor();
    codeEditor.setValue(converted);
    codeEditor.setCursor(cursor);

    if (currentFilePath && fileStructure[currentFilePath]) {
        fileStructure[currentFilePath].content = converted;
        fileStructure[currentFilePath].unsaved  = true;
    }
    updateTabs();
    updateStatusBar();
    showNotification(`Line endings converted to ${next}.`);
}

// Debounced renderFileTree — use for non-critical re-renders (e.g. tab close when not active)
// to avoid excessive full tree rebuilds in rapid sequences. Direct renderFileTree() calls are
// still used wherever an immediate visual update is required.
const debouncedRenderFileTree = debounce(() => renderFileTree(), 80);

function showNotification(message, isError = false, duration = 3000) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification';
    if (isError) notification.classList.add('error');
    notification.classList.add('show');
    if (notification.timeoutId) clearTimeout(notification.timeoutId);
    notification.timeoutId = setTimeout(() => { notification.classList.remove('show'); notification.timeoutId = null; }, duration);
}

function getFileIcon(fileName) {
    if (!fileName || !fileName.includes('.')) { return '📄'; }
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = { 'js': '☕', 'mjs': '☕', 'cjs': '☕', 'ts': '🟦', 'py': '🐍', 'html': '🌐', 'htm': '🌐', 'xhtml': '🌐', 'css': '🎨', 'scss': '🎨', 'less': '🎨', 'sass': '🎨', 'json': '📦', 'jsonc': '📦', 'md': '📝', 'markdown': '📝', 'txt': '📄', 'log': '📜', 'c': '🇨', 'h': '🇭', 'cpp': '🇨++', 'hpp': '🇭++', 'hh': '🇭++', 'cxx': '🇨++', 'cc': '🇨++', 'java': '♨️', 'php': '🐘', 'sql': '🗃️', 'sh': '💲', 'bash': '💲', 'zsh': '💲', 'fish': '💲', 'bat': '💻', 'cmd': '💻', 'yml': '⚙️', 'yaml': '⚙️', 'xml': '📰', 'svg': '🖌️', 'png': '🖼️', 'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'zip': '📦', 'rar': '📦', 'gz': '📦', 'tar': '📦', '7z': '📦', 'pdf': '📕', 'xlsx': '📊', 'xls': '📊', 'csv': '📈', 'tsv': '📈', 'doc': '📄', 'docx': '📄', 'ppt': '🖥️', 'pptx': '🖥️', 'dockerfile': '🐳', 'rb': '💎', 'go': '🐹', 'rs': '🦀', 'swift': '🐦', 'kt': '💜', 'kts': '💜', 'lua': '🌙', 'pl': '🐪', 'pm': '🐪', 'r': '📊', 'ini': '⚙️', 'properties': '⚙️', 'toml': '⚙️', 'jsx': '⚛️', 'tsx': '⚛️', 'vue': '🟩', 'svelte': '🔴', 'tex': '📐', 'latex': '📐', 'ltx': '📐', 'bib': '📚', 'graphql': '🔷', 'gql': '🔷', 'lock': '🔒', 'env': '🔐' };
    return iconMap[ext] || '❓';
}

function escapeHtml(text) {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filledCell(cell) {
    return cell !== '' && cell != null;
}

// Debounce Utility
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Ensure Menu Fits on Screen
function adjustMenuPosition(menu, x, y) {
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    let newX = x;
    let newY = y;
    if (x + rect.width > window.innerWidth) newX = window.innerWidth - rect.width - 5;
    if (y + rect.height > window.innerHeight) newY = window.innerHeight - rect.height - 5;
    menu.style.left = `${newX}px`;
    menu.style.top = `${newY}px`;
}

// Expand file tree to show path
function expandToPath(path) {
    if (!path || path === 'root') return;
    const parts = path.split('/');
    let currentPath = 'root';
    let needed = false;
    for (let i = 1; i < parts.length - 1; i++) {
        currentPath += '/' + parts[i];
        if (fileStructure[currentPath] && fileStructure[currentPath].type === 'folder' && !fileStructure[currentPath].expanded) {
            fileStructure[currentPath].expanded = true;
            needed = true;
        }
    }
    return needed;
}

// --- Dynamic Modal System ---
// Supports optional `inputs` array: [{ id, placeholder, value }]
// When inputs are present, resolve value is { value: btnValue, inputs: { id: inputValue } }
function createModal({ title, message, buttons, inputs }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const box = document.createElement('div');
        box.className = 'modal-box';
        
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        
        const closeX = document.createElement('span');
        closeX.className = 'modal-close-x';
        closeX.innerHTML = '&times;';
        closeX.title = 'Close';
        
        header.appendChild(titleEl);
        header.appendChild(closeX);
        
        const body = document.createElement('div');
        body.className = 'modal-body';
        
        const messageEl = document.createElement('p');
        messageEl.textContent = message;
        body.appendChild(messageEl);

        const inputElements = {};
        if (inputs && inputs.length) {
            inputs.forEach(inp => {
                const el = document.createElement('input');
                el.type = 'text';
                el.id = inp.id;
                el.placeholder = inp.placeholder || '';
                el.value = inp.value || '';
                el.className = 'modal-text-input';
                body.appendChild(el);
                inputElements[inp.id] = el;
            });
        }
        
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        
        box.appendChild(header);
        box.appendChild(body);
        box.appendChild(footer);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const collectInputs = () => {
            const result = {};
            Object.entries(inputElements).forEach(([id, el]) => { result[id] = el.value; });
            return result;
        };

        const closeModal = (value) => {
            document.removeEventListener('keydown', handleEsc);
            if (overlay.parentNode) overlay.remove();
            if (inputs && inputs.length) resolve({ value, inputs: collectInputs() });
            else resolve(value);
        };

        const handleEsc = (e) => {
            if (e.key === 'Escape') closeModal(null);
            if (e.key === 'Enter') {
                e.preventDefault();
                const primaryBtn = footer.querySelector('.modal-btn-primary') || footer.querySelector('.modal-btn-danger');
                if (primaryBtn) primaryBtn.click();
            }
        };

        closeX.onclick = () => closeModal(null);
        document.addEventListener('keydown', handleEsc);

        buttons.forEach(btn => {
            const b = document.createElement('button');
            b.textContent = btn.text;
            if (btn.className) b.className = btn.className;
            b.onclick = () => closeModal(btn.value);
            footer.appendChild(b);
        });
        
        setTimeout(() => {
            if (inputs && inputs.length) {
                inputElements[inputs[0].id]?.focus();
            } else {
                const primaryBtn = footer.querySelector('.modal-btn-primary') || footer.querySelector('.modal-btn-cancel');
                if (primaryBtn) primaryBtn.focus();
            }
        }, 10);
    });
}

async function showConfirmDialog(title, message, confirmText = 'OK', cancelText = 'Cancel', isDestructive = false) {
    const result = await createModal({
        title, message,
        buttons: [
            { text: cancelText, value: false, className: 'modal-btn-cancel' },
            { text: confirmText, value: true, className: isDestructive ? 'modal-btn-danger' : 'modal-btn-primary' }
        ]
    });
    return result === true;
}

async function showSaveDiscardDialog(fileName) {
    const result = await createModal({
        title: 'Unsaved Changes',
        message: `Do you want to save the changes you made to "${fileName}"?`,
        buttons: [
            { text: 'Cancel', value: 'cancel', className: 'modal-btn-cancel' },
            { text: "Don't Save", value: 'discard', className: 'modal-btn-danger' },
            { text: 'Save', value: 'save', className: 'modal-btn-primary' }
        ]
    });
    return result || 'cancel';
}

// --- Recent Files ---
function addRecentFile(filePath) {
    if (!filePath || filePath.startsWith('untitled://')) return;
    const entry = fileStructure[filePath];
    if (!entry || entry.type !== 'file') return;
    const displayName = filePath.split('/').pop();
    const displayPath = filePath.replace(/^root\/?/, '');
    // Remove existing entry for this path if present, then prepend
    recentFiles = recentFiles.filter(r => r.path !== filePath);
    recentFiles.unshift({ path: filePath, displayName, displayPath, timestamp: Date.now() });
    if (recentFiles.length > RECENT_FILES_MAX) recentFiles.length = RECENT_FILES_MAX;
    renderRecentFiles();
}

function renderRecentFiles() {
    const list = document.getElementById('recentFilesList');
    if (!list) return;
    list.innerHTML = '';
    if (recentFiles.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'recent-file-empty';
        empty.textContent = 'No recent files.';
        list.appendChild(empty);
        return;
    }
    recentFiles.forEach(item => {
        const row = document.createElement('div');
        row.className = 'recent-file-item';
        if (item.path === currentFilePath) row.classList.add('active');
        row.title = item.displayPath;

        const icon = document.createElement('span');
        icon.className = 'recent-file-icon';
        icon.textContent = getFileIcon(item.displayName);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'recent-file-name';
        nameSpan.textContent = item.displayName;

        const pathSpan = document.createElement('span');
        pathSpan.className = 'recent-file-path';
        pathSpan.textContent = item.displayPath;

        const removeBtn = document.createElement('span');
        removeBtn.className = 'recent-file-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove from recent';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            recentFiles = recentFiles.filter(r => r.path !== item.path);
            renderRecentFiles();
        };

        row.appendChild(icon);
        row.appendChild(nameSpan);
        row.appendChild(pathSpan);
        row.appendChild(removeBtn);
        row.onclick = () => {
            if (fileStructure[item.path]) {
                openFile(item.path);
            } else {
                showNotification(`File no longer exists: ${item.displayName}`, true);
                recentFiles = recentFiles.filter(r => r.path !== item.path);
                renderRecentFiles();
            }
        };
        list.appendChild(row);
    });
}

function toggleRecentFiles() {
    const body = document.getElementById('recentFilesBody');
    const icon = document.getElementById('recentFilesIcon');
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? 'block' : 'none';
    icon.textContent = collapsed ? '▼' : '▶';
}

function toggleFileExplorer() {
    const body = document.getElementById('fileExplorerBody');
    const icon = document.getElementById('fileExplorerIcon');
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? 'block' : 'none';
    icon.textContent = collapsed ? '▼' : '▶';
}

// --- Initialize Web Workers ---
function initWorkers() {
    // ---- Search Worker ----
    const searchWorkerSource = [
        'self.onmessage = function(e) {',
        '    var query = e.data.query;',
        '    var fileStructure = e.data.fileStructure;',
        '    var caseSensitive = e.data.caseSensitive || false;',
        '    var results = [];',
        '    var regexStr = query.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");',
        '    var flags = caseSensitive ? "g" : "gi";',
        '    var regex = new RegExp(regexStr, flags);',
        '    function traverse(path) {',
        '        var entry = fileStructure[path];',
        '        if (!entry) return;',
        '        if (entry.type === "file" && typeof entry.content === "string" && !entry.isUntitled) {',
        '            var lines = entry.content.split("\\n");',
        '            lines.forEach(function(line, index) {',
        '                regex.lastIndex = 0;',
        '                if (regex.test(line)) {',
        '                    results.push({ path: path, line: index + 1, text: line.trim() });',
        '                }',
        '            });',
        '        } else if (entry.type === "folder") {',
        '            entry.children.forEach(function(child) { traverse(path + "/" + child); });',
        '        }',
        '    }',
        '    traverse("root");',
        '    self.postMessage({ results: results });',
        '};'
    ].join('\n');

    const searchBlob = new Blob([searchWorkerSource], { type: 'application/javascript' });
    searchWorker = new Worker(URL.createObjectURL(searchBlob));

    // ---- Zip Worker source (shared between project and folder workers) ----
    const zipWorkerSource = [
        'importScripts("https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js");',
        'self.onmessage = function(e) {',
        '    try {',
        '        var fileStructure = e.data.fileStructure;',
        '        var rootName = e.data.rootName;',
        '        var zippable = {};',
        '        function collect(currentPath, zipPrefix) {',
        '            var entry = fileStructure[currentPath];',
        '            if (!entry || entry.isUntitled) return;',
        '            if (entry.type === "folder") {',
        '                var folderName = currentPath === "root" ? "" : currentPath.split("/").pop();',
        '                var nextPrefix = zipPrefix ? (folderName ? zipPrefix + folderName + "/" : zipPrefix) : (folderName + "/");',
        '                if (nextPrefix) zippable[nextPrefix] = [new Uint8Array(0), { level: 0 }];',
        '                for (var i = 0; i < entry.children.length; i++) {',
        '                    collect(currentPath + "/" + entry.children[i], nextPrefix);',
        '                }',
        '            } else {',
        '                var fileName = currentPath.split("/").pop();',
        '                var fullZipPath = zipPrefix + fileName;',
        '                var fileContent = entry.content;',
        '                var u8;',
        '                if (typeof fileContent === "string" && fileContent.startsWith("data:")) {',
        '                    var b64 = fileContent.substring(fileContent.indexOf(",") + 1);',
        '                    var binary = atob(b64);',
        '                    u8 = new Uint8Array(binary.length);',
        '                    for (var j = 0; j < binary.length; j++) u8[j] = binary.charCodeAt(j);',
        '                    zippable[fullZipPath] = [u8, { level: 0, os: 3 }];',
        '                } else if (typeof fileContent === "string") {',
        '                    u8 = fflate.strToU8(fileContent);',
        '                    zippable[fullZipPath] = [u8, { level: 6, os: 3 }];',
        '                } else {',
        '                    zippable[fullZipPath] = [fflate.strToU8("[Content not available]"), { level: 0, os: 3 }];',
        '                }',
        '            }',
        '        }',
        '        collect("root", rootName + "/");',
        '        var result = fflate.zipSync(zippable);',
        '        var blob = new Blob([result], { type: "application/zip" });',
        '        self.postMessage({ blob: blob });',
        '    } catch (err) {',
        '        self.postMessage({ error: err.message });',
        '    }',
        '};'
    ].join('\n');

    const zipBlob = new Blob([zipWorkerSource], { type: 'application/javascript' });
    // Fix #3: Two independent worker instances from the same source so project-zip
    // and folder-zip operations never share an onmessage handler.
    zipWorker = new Worker(URL.createObjectURL(zipBlob));
    folderZipWorker = new Worker(URL.createObjectURL(zipBlob));
}