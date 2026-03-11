function copyEditorContent() {
    if (!codeEditor) return;
    const content = codeEditor.getValue();
    if (!content.length) { showNotification("Nothing to copy.", true); return; }
    navigator.clipboard.writeText(content).then(() => {
        showNotification("Copied to clipboard.");
    }).catch(() => {
        showNotification("Copy failed — clipboard access denied.", true);
    });
}

function formatCode() {
    if (!currentFilePath && codeEditor.getValue().trim() === '') { showNotification("Nothing to format."); return; }
    const currentContent = codeEditor.getValue();
    const currentMode = codeEditor.getOption('mode');

    // LaTeX: native formatter (no Prettier parser exists for LaTeX)
    if (currentMode === 'text/x-stex') {
        const formatted = formatLatex(currentContent);
        if (formatted !== currentContent) {
            const cursor = codeEditor.getCursor();
            codeEditor.setValue(formatted);
            codeEditor.setCursor(cursor);
            showNotification("LaTeX formatted.");
            if (currentFilePath && fileStructure[currentFilePath] && !fileStructure[currentFilePath].unsaved) {
                fileStructure[currentFilePath].unsaved = true; updateTabs(); updateStatusBar();
            }
        } else { showNotification("LaTeX is already formatted."); }
        return;
    }

    if (typeof prettier === 'undefined' || typeof prettierPlugins === 'undefined') { showNotification("Formatting library not loaded.", true); return; }

    let parser = null; let plugins = [];
    switch (currentMode) {
        case 'javascript':
        case 'application/json':       parser = 'babel';      plugins = [prettierPlugins.babel]; break;
        case 'text/jsx':               parser = 'babel';      plugins = [prettierPlugins.babel]; break;
        case 'text/typescript':        parser = 'typescript'; plugins = [prettierPlugins.typescript]; break;
        case 'text/typescript-jsx':    parser = 'typescript'; plugins = [prettierPlugins.typescript]; break;
        case 'css':
        case 'text/x-scss':
        case 'text/x-less':            parser = 'css';        plugins = [prettierPlugins.postcss]; break;
        case 'htmlmixed':
        case 'xml':                    parser = 'html';       plugins = [prettierPlugins.html]; break;
        case 'markdown':               parser = 'markdown';   plugins = [prettierPlugins.markdown]; break;
        case 'text/x-yaml':            parser = 'yaml';       plugins = [prettierPlugins.yaml]; break;
        case 'graphql':                parser = 'graphql';    plugins = [prettierPlugins.graphql]; break;
        default: showNotification(`Formatting not supported for: ${modeNames[currentMode] || currentMode}`, false); return;
    }
    try {
        const formatOptions = { parser, plugins, tabWidth: settings.tabWidth || 4, semi: true, singleQuote: false };
        const formattedContent = prettier.format(currentContent, formatOptions);
        if (formattedContent !== currentContent) {
            const cursor = codeEditor.getCursor();
            codeEditor.setValue(formattedContent);
            codeEditor.setCursor(cursor);
            showNotification("Code formatted.");
            if (currentFilePath && fileStructure[currentFilePath] && !fileStructure[currentFilePath].unsaved) {
                fileStructure[currentFilePath].unsaved = true; updateTabs(); updateStatusBar();
            }
        } else { showNotification("Code is already formatted."); }
    } catch (error) { showNotification(`Formatting error: ${error.message}`, true); }
}

// Global Search Case Toggle
function toggleGlobalSearchCase() {
    globalSearchCaseSensitive = !globalSearchCaseSensitive;
    const btn = document.getElementById('globalSearchCaseBtn');
    if (btn) {
        btn.classList.toggle('active', globalSearchCaseSensitive);
        btn.title = globalSearchCaseSensitive ? 'Case Sensitive: ON' : 'Match Case';
    }
    if (document.getElementById('searchInput').value.trim()) performSearch();
}

// Global Search Debounced
const debouncedPerformSearch = debounce(function() {
    performSearch();
}, 400);

function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) { clearSearch(); return; }
    currentSearchQuery = query;
    
    // Clear stale results immediately so "Searching..." replaces them cleanly (Bug 2)
    const searchResultsDiv = document.getElementById('searchResults');
    searchResultsDiv.innerHTML = 'Searching...';
    searchResultsDiv.style.display = 'block';

    if (!searchWorker) initWorkers();

    searchWorker.onmessage = function(e) {
        displaySearchResults(e.data.results, query);
    };

    searchWorker.postMessage({ query, fileStructure, caseSensitive: globalSearchCaseSensitive });
}

// Global Replace
// Fix #3: Reset regex.lastIndex before each test() and replace() call to prevent
// the 'g' flag's stateful lastIndex from skipping files.
function performGlobalReplace() {
    const query = document.getElementById('searchInput').value.trim();
    const replaceStr = document.getElementById('replaceInput').value;
    if (!query) { showNotification("Enter a search query first.", true); return; }

    const regexStr = escapeRegex(query);
    const flags = globalSearchCaseSensitive ? 'g' : 'gi';
    const regex = new RegExp(regexStr, flags);
    let replaceCount = 0;
    let modifiedFiles = 0;

    function traverse(path) {
        const entry = fileStructure[path];
        if (entry.type === 'file' && typeof entry.content === 'string' && !entry.isUntitled) {
            regex.lastIndex = 0; // reset before test
            if (regex.test(entry.content)) {
                regex.lastIndex = 0; // reset again before replace
                entry.content = entry.content.replace(regex, () => {
                    replaceCount++;
                    return replaceStr;
                });
                entry.unsaved = true;
                modifiedFiles++;
                if (currentFilePath === path) {
                    const cursor = codeEditor.getCursor();
                    codeEditor.setValue(entry.content);
                    codeEditor.setCursor(cursor);
                }
            }
        } else if (entry.type === 'folder') {
            entry.children.forEach(child => traverse(path + '/' + child));
        }
    }
    traverse('root');

    if (replaceCount > 0) {
        updateTabs(); updateStatusBar(); performSearch();
        showNotification(`Replaced ${replaceCount} occurrence(s) in ${modifiedFiles} file(s).`);
    } else {
        showNotification("No matches found to replace.");
    }
}

function displaySearchResults(results, query) { 
    const searchResultsDiv = document.getElementById('searchResults'); searchResultsDiv.innerHTML = ''; 
    const closeBtn = document.createElement('button'); closeBtn.textContent = 'Close'; closeBtn.style.float = 'right'; closeBtn.style.padding = '2px 6px'; closeBtn.style.fontSize = '12px'; closeBtn.onclick = () => { searchResultsDiv.style.display = 'none'; }; searchResultsDiv.appendChild(closeBtn); 
    if (results.length === 0) { 
        const noResults = document.createElement('div'); noResults.textContent = 'No results found.'; searchResultsDiv.appendChild(noResults); 
    } else {
        // Fix #8: Show result count summary at the top (X matches in Y files).
        const fileCount = new Set(results.map(r => r.path)).size;
        const summary = document.createElement('div');
        summary.className = 'search-summary';
        summary.textContent = `${results.length} match${results.length !== 1 ? 'es' : ''} in ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
        searchResultsDiv.appendChild(summary);

        results.forEach(result => { 
            const div = document.createElement('div'); div.className = 'search-result'; 
            const escapedText = escapeHtml(result.text);
            const highlightFlags = globalSearchCaseSensitive ? 'g' : 'gi';
            const highlightedText = escapedText.replace(new RegExp(escapeRegex(query), highlightFlags), match => `<span style="background-color: yellow; color: black;">${match}</span>`); 
            div.innerHTML = `<strong>${result.path.replace(/^root\//, '')}:${result.line}</strong>: ${highlightedText}`; 
            div.onclick = () => { openFile(result.path); setTimeout(() => { codeEditor.setCursor({ line: result.line - 1, ch: 0 }); codeEditor.scrollIntoView({ line: result.line - 1, ch: 0 }, 100); }, 100); }; 
            searchResultsDiv.appendChild(div); 
        }); 
    } 
    searchResultsDiv.style.display = 'block'; 
}

function clearSearch() { 
    document.getElementById('searchInput').value = ''; 
    document.getElementById('replaceInput').value = ''; 
    document.getElementById('searchResults').style.display = 'none'; 
    currentSearchQuery = ''; 
}

// ==========================================
// --- Custom Local Find & Replace Widget ---
// ==========================================
let localSearchMatches = [];
let localSearchActiveIndex = -1;
let localSearchMarks = [];
let localSearchScrollAnnotation = null;

function openLocalSearch(showReplace = false) {
    if (!codeEditor) return;
    const widget = document.getElementById('localSearchWidget');
    widget.style.display = 'flex';
    if (showReplace) {
        document.getElementById('localReplaceRow').style.display = 'flex';
    }
    
    // Auto-fill selected text
    const selection = codeEditor.getSelection();
    if (selection && !selection.includes('\n')) {
        document.getElementById('localSearchInput').value = selection;
    }
    
    document.getElementById('localSearchInput').focus();
    document.getElementById('localSearchInput').select();
    updateLocalSearch();
}

function toggleLocalReplace() {
    const replaceRow = document.getElementById('localReplaceRow');
    replaceRow.style.display = replaceRow.style.display === 'none' ? 'flex' : 'none';
    if (replaceRow.style.display === 'flex') {
        document.getElementById('localReplaceInput').focus();
    }
}

function toggleLocalSearchCase() {
    localSearchCaseSensitive = !localSearchCaseSensitive;
    const btn = document.getElementById('localSearchCaseBtn');
    btn.classList.toggle('active', localSearchCaseSensitive);
    btn.title = localSearchCaseSensitive ? 'Case Sensitive: ON (Alt+C)' : 'Match Case (Alt+C)';
    updateLocalSearch();
}

function closeLocalSearch() {
    document.getElementById('localSearchWidget').style.display = 'none';
    clearLocalSearch();
    if (codeEditor) codeEditor.focus();
}

function clearLocalSearch() {
    localSearchMarks.forEach(m => m.clear());
    localSearchMarks = [];
    localSearchMatches = [];
    localSearchActiveIndex = -1;
    document.getElementById('localSearchCount').textContent = '0/0';
    if (localSearchScrollAnnotation) {
        localSearchScrollAnnotation.clear();
        localSearchScrollAnnotation = null;
    }
}

function updateLocalSearch() {
    clearLocalSearch();
    const query = document.getElementById('localSearchInput').value;
    if (!query) return;

    const cursor = codeEditor.getSearchCursor(query, { line: 0, ch: 0 }, { caseFold: !localSearchCaseSensitive });
    while (cursor.findNext()) {
        localSearchMatches.push({ from: cursor.from(), to: cursor.to() });
    }

    if (localSearchMatches.length > 0) {
        // Automatically select the instance closest to the user's cursor
        const editorCursor = codeEditor.getCursor();
        localSearchActiveIndex = 0;
        for (let i = 0; i < localSearchMatches.length; i++) {
            if (CodeMirror.cmpPos(localSearchMatches[i].from, editorCursor) >= 0) {
                localSearchActiveIndex = i;
                break;
            }
        }
        highlightLocalMatches();
        annotateScrollbar();
    }
}

// Annotate the scrollbar with all match positions so they're visible
// as small tick marks even when scrolled away — a lightweight "minimap"
// for search results.
function annotateScrollbar() {
    if (localSearchScrollAnnotation) {
        localSearchScrollAnnotation.clear();
        localSearchScrollAnnotation = null;
    }
    if (typeof codeEditor.annotateScrollbar !== 'function') return;
    localSearchScrollAnnotation = codeEditor.annotateScrollbar('cm-search-match-annotation');
    localSearchScrollAnnotation.update(localSearchMatches.map(m => ({ from: m.from, to: m.to })));
}

function highlightLocalMatches() {
    localSearchMarks.forEach(m => m.clear());
    localSearchMarks = localSearchMatches.map((match, i) => {
        const isCurrent = i === localSearchActiveIndex;
        return codeEditor.markText(match.from, match.to, {
            className: isCurrent ? 'cm-searching-current' : 'cm-searching'
        });
    });
    document.getElementById('localSearchCount').textContent = `${localSearchActiveIndex + 1}/${localSearchMatches.length}`;
    
    if (localSearchMatches.length > 0) {
        const match = localSearchMatches[localSearchActiveIndex];
        codeEditor.scrollIntoView({ from: match.from, to: match.to }, 50);
        codeEditor.setSelection(match.from, match.to);
    }
}

function findNextLocal() {
    if (localSearchMatches.length === 0) return;
    localSearchActiveIndex = (localSearchActiveIndex + 1) % localSearchMatches.length;
    highlightLocalMatches();
}

function findPrevLocal() {
    if (localSearchMatches.length === 0) return;
    localSearchActiveIndex = (localSearchActiveIndex - 1 + localSearchMatches.length) % localSearchMatches.length;
    highlightLocalMatches();
}

function replaceLocal() {
    if (localSearchMatches.length === 0 || localSearchActiveIndex === -1) return;
    const replaceStr = document.getElementById('localReplaceInput').value;
    const match = localSearchMatches[localSearchActiveIndex];
    
    codeEditor.replaceRange(replaceStr, match.from, match.to);
    updateLocalSearch(); // Re-calculate everything since text shifted
}

function replaceAllLocal() {
    if (localSearchMatches.length === 0) return;
    const replaceStr = document.getElementById('localReplaceInput').value;
    
    // Work backwards so replacing text length doesn't offset subsequent array positions
    for (let i = localSearchMatches.length - 1; i >= 0; i--) {
        codeEditor.replaceRange(replaceStr, localSearchMatches[i].from, localSearchMatches[i].to);
    }
    updateLocalSearch();
}

// ==========================================
// --- Go to Line / Column Modal          ---
// ==========================================
function openGoToLine() {
    if (!codeEditor) return;
    const totalLines = codeEditor.lineCount();
    const cur = codeEditor.getCursor();

    createModal({
        title: 'Go to Line / Column',
        message: `Enter a line number (1–${totalLines}), or line:column (e.g. 42:10).`,
        inputs: [{ id: 'gotoInput', placeholder: `Current: ${cur.line + 1}:${cur.ch + 1}` }],
        buttons: [
            { text: 'Cancel', value: null, className: 'modal-btn-cancel' },
            { text: 'Go', value: 'go', className: 'modal-btn-primary' }
        ]
    }).then((result) => {
        if (!result || result.value !== 'go' || !result.inputs) return;
        const raw = (result.inputs['gotoInput'] || '').trim();
        if (!raw) return;

        let line, ch = 0;
        if (raw.includes(':')) {
            const parts = raw.split(':');
            line = parseInt(parts[0], 10) - 1;
            ch   = parseInt(parts[1], 10) - 1;
        } else {
            line = parseInt(raw, 10) - 1;
        }

        if (isNaN(line) || line < 0) { showNotification('Invalid line number.', true); return; }
        line = Math.min(line, totalLines - 1);
        ch   = Math.max(0, isNaN(ch) ? 0 : ch);

        codeEditor.setCursor({ line, ch });
        codeEditor.scrollIntoView({ line, ch }, 80);
        codeEditor.focus();
    });
}

// Bind Inputs
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('localSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', updateLocalSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) findPrevLocal();
                else findNextLocal();
            } else if (e.key === 'Escape') {
                closeLocalSearch();
            } else if (e.altKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                toggleLocalSearchCase();
            }
        });
    }
    
    const replaceInput = document.getElementById('localReplaceInput');
    if (replaceInput) {
        replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                replaceLocal();
            } else if (e.key === 'Escape') {
                closeLocalSearch();
            }
        });
    }
});