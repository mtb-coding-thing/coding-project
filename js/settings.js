function loadSettings() {
    try {
        const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (savedSettings) settings = { ...defaultSettings, ...JSON.parse(savedSettings) };
    } catch (e) {
        console.error('[Settings] Failed to load settings:', e);
        settings = { ...defaultSettings };
    }
    applySettings();
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('[Settings] Failed to save settings:', e);
    }
}

function applySettings() {
    if (codeEditor) {
        codeEditor.setOption('matchBrackets', settings.matchBrackets);
        codeEditor.setOption('autoCloseBrackets', settings.autoCloseBrackets);
        codeEditor.setOption('autoCloseTags', settings.autoCloseTags);
        codeEditor.setOption('theme', settings.theme);
        codeEditor.setOption('lineWrapping', settings.wordWrap);
        codeEditor.setOption('tabSize', settings.tabWidth || 4);
        codeEditor.setOption('indentUnit', settings.tabWidth || 4);
        codeEditor.setOption('foldGutter', settings.foldGutter ?? true);
        codeEditor.refresh();
    }
    
    // Apply word-wrap to diff view both panes
    if (diffView) {
        diffView.editor().setOption('theme', settings.theme);
        diffView.editor().setOption('lineWrapping', settings.wordWrap);
        diffView.leftOriginal().setOption('theme', settings.theme);
        diffView.leftOriginal().setOption('lineWrapping', settings.wordWrap);
    }

    document.getElementById('autoCloseTags').checked = settings.autoCloseTags;
    document.getElementById('matchBrackets').checked = settings.matchBrackets;
    document.getElementById('autoCloseBrackets').checked = settings.autoCloseBrackets;
    document.getElementById('themeSelect').value = settings.theme;
    document.getElementById('wordWrap').checked = settings.wordWrap;
    document.getElementById('autoSaveSession').checked = settings.autoSaveSession;
    document.getElementById('autoSaveOnBlur').checked = settings.autoSaveOnBlur;
    document.getElementById('fileTemplates').checked = settings.fileTemplates ?? true;
    document.getElementById('tabWidthSelect').value = String(settings.tabWidth || 4);

    const bracketColorizationEl = document.getElementById('bracketColorization');
    if (bracketColorizationEl) bracketColorizationEl.checked = settings.bracketColorization ?? true;
    applyBracketColorization();

    // Auto-save interval UI
    const autoSaveIntervalEl = document.getElementById('autoSaveInterval');
    const autoSaveIntervalMsEl = document.getElementById('autoSaveIntervalMs');
    const autoSaveIntervalMsRow = document.getElementById('autoSaveIntervalMsRow');
    if (autoSaveIntervalEl) autoSaveIntervalEl.checked = settings.autoSaveInterval ?? false;
    if (autoSaveIntervalMsEl) autoSaveIntervalMsEl.value = String((settings.autoSaveIntervalMs || 30000) / 1000);
    if (autoSaveIntervalMsRow) autoSaveIntervalMsRow.style.display = settings.autoSaveInterval ? 'flex' : 'none';

    document.getElementById('sidebar').style.width = settings.sidebarWidth;
    document.getElementById('editorPane').style.flexBasis = settings.editorPaneFlexBasis;
    document.getElementById('previewPane').style.flexBasis = settings.previewPaneFlexBasis;

    if (currentFilePath && !currentFilePath.startsWith('untitled://')) setLanguage(currentFilePath);
    else if(codeEditor) codeEditor.setOption('mode', 'text/plain');

    updateStatusBar();
    applyAutoSaveInterval();
    if (typeof syncWordWrapMenuItem === 'function') syncWordWrapMenuItem();
}

function applyAutoSaveInterval() {
    // Clear existing interval
    if (autoSaveIntervalHandle) {
        clearInterval(autoSaveIntervalHandle);
        autoSaveIntervalHandle = null;
    }
    if (settings.autoSaveInterval && settings.autoSaveIntervalMs > 0) {
        autoSaveIntervalHandle = setInterval(() => {
            const hasUnsaved = Array.from(openTabs.keys()).some(p => fileStructure[p]?.unsaved && !fileStructure[p]?.isUntitled);
            if (hasUnsaved) {
                saveAllFiles();
                console.log('[AutoSave] Interval save triggered');
            }
        }, settings.autoSaveIntervalMs);
        console.log(`[AutoSave] Interval set to ${settings.autoSaveIntervalMs / 1000}s`);
    }
}

function updateAndSaveSetting(key, value) {
    settings[key] = value; applySettings(); saveSettings();
}

function applyBracketColorization() {
    const enabled = settings.bracketColorization ?? true;
    let styleEl = document.getElementById('bracketColorizationStyle');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'bracketColorizationStyle';
        document.head.appendChild(styleEl);
    }
    if (enabled) {
        styleEl.textContent = `
            .cm-bracket-depth-0 { color: #ffd700 !important; }
            .cm-bracket-depth-1 { color: #da70d6 !important; }
            .cm-bracket-depth-2 { color: #87ceeb !important; }
            .cm-bracket-depth-3 { color: #ffd700 !important; }
            .cm-bracket-depth-4 { color: #da70d6 !important; }
            .cm-bracket-depth-5 { color: #87ceeb !important; }
        `;
        if (codeEditor) requestAnimationFrame(() => applyBracketColorizationToEditor());
    } else {
        styleEl.textContent = '';
    }
}

// Walk the editor DOM and assign bracket depth classes to bracket tokens
function applyBracketColorizationToEditor() {
    if (!codeEditor || !(settings.bracketColorization ?? true)) return;
    const OPEN = new Set(['{', '[', '(']);
    const CLOSE = new Set(['}', ']', ')']);
    let depth = 0;
    const totalLines = codeEditor.lineCount();
    // Only colorize visible viewport + small buffer to stay performant
    const scrollInfo = codeEditor.getScrollInfo();
    const startLine = Math.max(0, codeEditor.lineAtHeight(scrollInfo.top, 'local') - 5);
    const endLine = Math.min(totalLines - 1, codeEditor.lineAtHeight(scrollInfo.top + scrollInfo.clientHeight, 'local') + 5);
    // Count depth up to startLine for correct nesting
    for (let l = 0; l < startLine; l++) {
        const tokens = codeEditor.getLineTokens(l);
        for (const t of tokens) {
            if (t.type && t.type.includes('bracket')) {
                if (OPEN.has(t.string)) depth++;
                else if (CLOSE.has(t.string)) depth = Math.max(0, depth - 1);
            }
        }
    }
    for (let l = startLine; l <= endLine; l++) {
        const tokens = codeEditor.getLineTokens(l);
        for (const t of tokens) {
            if (!t.type || !t.type.includes('bracket')) continue;
            if (CLOSE.has(t.string)) depth = Math.max(0, depth - 1);
            const d = depth % 6;
            // Find the span for this token and set class
            const coord = codeEditor.charCoords({ line: l, ch: t.start }, 'local');
            const el = document.elementFromPoint(
                codeEditor.getWrapperElement().getBoundingClientRect().left + coord.left + 1,
                codeEditor.getWrapperElement().getBoundingClientRect().top + coord.top + 1
            );
            if (el && el.classList) {
                // Remove old depth classes
                for (let i = 0; i < 6; i++) el.classList.remove(`cm-bracket-depth-${i}`);
                el.classList.add(`cm-bracket-depth-${d}`);
            }
            if (OPEN.has(t.string)) depth++;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('autoCloseTags').addEventListener('change', (e) => updateAndSaveSetting('autoCloseTags', e.target.checked));
    document.getElementById('matchBrackets').addEventListener('change', (e) => updateAndSaveSetting('matchBrackets', e.target.checked));
    document.getElementById('autoCloseBrackets').addEventListener('change', (e) => updateAndSaveSetting('autoCloseBrackets', e.target.checked));
    document.getElementById('themeSelect').addEventListener('change', (e) => updateAndSaveSetting('theme', e.target.value));
    document.getElementById('wordWrap').addEventListener('change', (e) => updateAndSaveSetting('wordWrap', e.target.checked));
    document.getElementById('tabWidthSelect').addEventListener('change', (e) => {
        updateAndSaveSetting('tabWidth', parseInt(e.target.value, 10));
    });
    document.getElementById('fileTemplates').addEventListener('change', (e) => {
        updateAndSaveSetting('fileTemplates', e.target.checked);
    });
    document.getElementById('autoSaveOnBlur').addEventListener('change', (e) => {
        updateAndSaveSetting('autoSaveOnBlur', e.target.checked);
        showNotification(e.target.checked ? 'Auto-save on focus loss enabled.' : 'Auto-save on focus loss disabled.', false, 3000);
    });
    document.getElementById('autoSaveSession').addEventListener('change', (e) => {
        updateAndSaveSetting('autoSaveSession', e.target.checked);
        if (!e.target.checked) {
            showNotification("Auto-save/load session disabled.", false, 4000);
        } else {
            showNotification("Auto-save/load session enabled.", false, 3000);
            saveSession();
        }
    });

    const bracketColorizationEl = document.getElementById('bracketColorization');
    if (bracketColorizationEl) {
        bracketColorizationEl.addEventListener('change', (e) => {
            updateAndSaveSetting('bracketColorization', e.target.checked);
            showNotification(e.target.checked ? 'Bracket colorization enabled.' : 'Bracket colorization disabled.', false, 2000);
        });
    }

    // Auto-save interval controls
    const autoSaveIntervalEl = document.getElementById('autoSaveInterval');
    const autoSaveIntervalMsEl = document.getElementById('autoSaveIntervalMs');
    const autoSaveIntervalMsRow = document.getElementById('autoSaveIntervalMsRow');
    if (autoSaveIntervalEl) {
        autoSaveIntervalEl.addEventListener('change', (e) => {
            updateAndSaveSetting('autoSaveInterval', e.target.checked);
            if (autoSaveIntervalMsRow) autoSaveIntervalMsRow.style.display = e.target.checked ? 'flex' : 'none';
            showNotification(e.target.checked
                ? `Auto-save every ${(settings.autoSaveIntervalMs || 30000) / 1000}s enabled.`
                : 'Timed auto-save disabled.', false, 3000);
        });
    }
    if (autoSaveIntervalMsEl) {
        autoSaveIntervalMsEl.addEventListener('change', (e) => {
            const secs = Math.max(5, parseInt(e.target.value, 10) || 30);
            e.target.value = secs;
            updateAndSaveSetting('autoSaveIntervalMs', secs * 1000);
            showNotification(`Auto-save interval set to ${secs}s.`, false, 2000);
        });
    }
});

function resetSettings() {
    settings = { ...defaultSettings }; applySettings(); saveSettings(); showNotification('Settings reset to default.');
}

function toggleSettings() {
    const overlay = document.getElementById('settingsOverlay');
    const isOpen = overlay.style.display !== 'none';
    if (isOpen) {
        overlay.style.display = 'none';
        if (codeEditor) setTimeout(() => codeEditor.focus(), 0);
    } else {
        applySettings();
        overlay.style.display = 'flex';
    }
}

function handleSettingsOverlayClick() {
    toggleSettings();
}