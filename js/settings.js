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

// Safe getElementById — never throws if element isn't mounted yet
function _el(id) { return document.getElementById(id); }

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

    if (diffView) {
        diffView.editor().setOption('theme', settings.theme);
        diffView.editor().setOption('lineWrapping', settings.wordWrap);
        diffView.leftOriginal().setOption('theme', settings.theme);
        diffView.leftOriginal().setOption('lineWrapping', settings.wordWrap);
    }

    // Guard every getElementById so a missing element can never abort
    // execution before applyThemeChrome() runs at the bottom.
    if (_el('autoCloseTags'))     _el('autoCloseTags').checked     = settings.autoCloseTags;
    if (_el('matchBrackets'))     _el('matchBrackets').checked     = settings.matchBrackets;
    if (_el('autoCloseBrackets')) _el('autoCloseBrackets').checked = settings.autoCloseBrackets;
    if (_el('themeSelect'))       _el('themeSelect').value         = settings.theme;
    if (_el('wordWrap'))          _el('wordWrap').checked          = settings.wordWrap;
    if (_el('autoSaveSession'))   _el('autoSaveSession').checked   = settings.autoSaveSession;
    if (_el('autoSaveOnBlur'))    _el('autoSaveOnBlur').checked    = settings.autoSaveOnBlur;
    if (_el('fileTemplates'))     _el('fileTemplates').checked     = settings.fileTemplates ?? true;
    if (_el('tabWidthSelect'))    _el('tabWidthSelect').value      = String(settings.tabWidth || 4);

    const bracketColorizationEl = _el('bracketColorization');
    if (bracketColorizationEl) bracketColorizationEl.checked = settings.bracketColorization ?? true;
    applyBracketColorization();

    const autoSaveIntervalEl    = _el('autoSaveInterval');
    const autoSaveIntervalMsEl  = _el('autoSaveIntervalMs');
    const autoSaveIntervalMsRow = _el('autoSaveIntervalMsRow');
    if (autoSaveIntervalEl)    autoSaveIntervalEl.checked   = settings.autoSaveInterval ?? false;
    if (autoSaveIntervalMsEl)  autoSaveIntervalMsEl.value  = String((settings.autoSaveIntervalMs || 30000) / 1000);
    if (autoSaveIntervalMsRow) autoSaveIntervalMsRow.style.display = settings.autoSaveInterval ? 'flex' : 'none';

    if (_el('sidebar'))     _el('sidebar').style.width         = settings.sidebarWidth;
    if (_el('editorPane'))  _el('editorPane').style.flexBasis  = settings.editorPaneFlexBasis;
    if (_el('previewPane')) _el('previewPane').style.flexBasis = settings.previewPaneFlexBasis;

    if (currentFilePath && !currentFilePath.startsWith('untitled://')) setLanguage(currentFilePath);
    else if (codeEditor) codeEditor.setOption('mode', 'text/plain');

    updateStatusBar();
    applyAutoSaveInterval();
    if (typeof syncWordWrapMenuItem === 'function') syncWordWrapMenuItem();

    // Always last — must not be blocked by any element lookup failure above
    applyThemeChrome(settings.theme);
}

/**
 * Sets CSS custom properties on :root that drive all chrome colours.
 * Each theme has a distinct visual identity with clear shading steps:
 *   sidebar (darkest) → toolbar/bar → inactive tab → active tab (= editor bg)
 *
 * --selected-text ensures readable contrast on the selection highlight,
 * critical for light themes where white text on a cream bg is invisible.
 */
function applyThemeChrome(theme) {
    const root = document.documentElement;

    const palettes = {
        // ── Monokai ──────────────────────────────────────────────────────────
        // Warm olive-charcoal. Sidebar is visibly darker than the toolbar,
        // which is visibly darker than inactive tabs.
        'monokai': {
            '--bg-color':            '#272822',
            '--text-color':          '#f8f8f2',
            '--accent-color':        '#a6e22e',
            '--button-bg':           '#4a7c1f',
            '--button-hover':        '#5a9626',
            '--selected-bg':         '#75715e',
            '--selected-text':       '#f8f8f2',
            '--cwd-selected-bg':     '#3e3d32',
            '--hover-bg':            '#3e3d32',
            '--error-bg':            '#a33',
            '--chrome-sidebar':      '#16170f',  // deep olive-black
            '--chrome-bar':          '#272822',  // toolbar = editor bg
            '--chrome-tab':          '#403e2f',  // inactive: warm mid-tone
            '--chrome-tab-active':   '#272822',  // active = editor bg
            '--chrome-border':       '#3a3a35',
            '--chrome-input':        '#3e3d32',
            '--chrome-input-border': '#555048',
            '--chrome-status':       '#0e0f0a',  // very deep grounding strip
            '--chrome-hover':        '#4a4839',
            '--chrome-dropdown':     '#2d2e28',
            '--chrome-sep':          '#3a3a35',
            '--chrome-scrolltrack':  '#16170f',
            '--chrome-scrollthumb':  '#4a4839',
        },

        // ── Dracula ───────────────────────────────────────────────────────────
        // Cool blue-purple. Clear navy steps from black sidebar to lighter tabs.
        'dracula': {
            '--bg-color':            '#282a36',
            '--text-color':          '#f8f8f2',
            '--accent-color':        '#bd93f9',
            '--button-bg':           '#6272a4',
            '--button-hover':        '#7282b4',
            '--selected-bg':         '#44475a',
            '--selected-text':       '#f8f8f2',
            '--cwd-selected-bg':     '#383a4a',
            '--hover-bg':            '#383a4a',
            '--error-bg':            '#ff5555',
            '--chrome-sidebar':      '#15161e',  // deep navy-black
            '--chrome-bar':          '#21222c',  // dark blue-gray toolbar
            '--chrome-tab':          '#343746',  // inactive: indigo-tinted
            '--chrome-tab-active':   '#282a36',  // active = editor bg
            '--chrome-border':       '#3d3f4f',
            '--chrome-input':        '#343746',
            '--chrome-input-border': '#555770',
            '--chrome-status':       '#0d0e17',  // very deep navy strip
            '--chrome-hover':        '#44475a',
            '--chrome-dropdown':     '#2c2d3b',
            '--chrome-sep':          '#3d3f4f',
            '--chrome-scrolltrack':  '#15161e',
            '--chrome-scrollthumb':  '#44475a',
        },

        // ── Solarized Dark ────────────────────────────────────────────────────
        // Deep teal ocean. Steps from near-black teal to mid-teal to editor.
        'solarized dark': {
            '--bg-color':            '#002b36',
            '--text-color':          '#93a1a1',
            '--accent-color':        '#2aa198',
            '--button-bg':           '#2aa198',
            '--button-hover':        '#1d8a82',
            '--selected-bg':         '#0d4f5e',
            '--selected-text':       '#93a1a1',
            '--cwd-selected-bg':     '#063340',
            '--hover-bg':            '#063340',
            '--error-bg':            '#dc322f',
            '--chrome-sidebar':      '#001b22',  // near-black teal
            '--chrome-bar':          '#002b36',  // unified with editor bg
            '--chrome-tab':          '#073642',  // inactive: one step lighter
            '--chrome-tab-active':   '#002b36',
            '--chrome-border':       '#0a4555',
            '--chrome-input':        '#073642',
            '--chrome-input-border': '#155566',
            '--chrome-status':       '#00131a',  // darkest strip
            '--chrome-hover':        '#0d4455',
            '--chrome-dropdown':     '#063340',
            '--chrome-sep':          '#0a4555',
            '--chrome-scrolltrack':  '#001b22',
            '--chrome-scrollthumb':  '#0d4455',
        },

        // ── Solarized Light ───────────────────────────────────────────────────
        // Warm parchment. Sidebar is deeper cream, toolbar mid-cream, active lightest.
        // Selected text is dark so it reads on the cream highlight.
        'solarized light': {
            '--bg-color':            '#fdf6e3',
            '--text-color':          '#586e75',
            '--accent-color':        '#2aa198',
            '--button-bg':           '#268bd2',
            '--button-hover':        '#1a6aaa',
            '--selected-bg':         '#d0c9b0',
            '--selected-text':       '#073642',  // dark on cream
            '--cwd-selected-bg':     '#e8e2cf',
            '--hover-bg':            '#ece6d3',
            '--error-bg':            '#dc322f',
            '--chrome-sidebar':      '#ddd5be',  // deeper parchment
            '--chrome-bar':          '#eee8d5',  // mid-cream toolbar
            '--chrome-tab':          '#e5dfc9',  // inactive between sidebar and bar
            '--chrome-tab-active':   '#fdf6e3',  // active = editor (lightest)
            '--chrome-border':       '#c8bfa8',
            '--chrome-input':        '#e8e2cf',
            '--chrome-input-border': '#b8af98',
            '--chrome-status':       '#ccc5ae',  // slightly deeper than sidebar
            '--chrome-hover':        '#d8d1ba',
            '--chrome-dropdown':     '#eee8d5',
            '--chrome-sep':          '#c8bfa8',
            '--chrome-scrolltrack':  '#ddd5be',
            '--chrome-scrollthumb':  '#b8af98',
        },

        // ── Default (Light) ───────────────────────────────────────────────────
        // Clean neutral grays with strong visible shading steps.
        // Selected text dark on light-blue highlight.
        'default': {
            '--bg-color':            '#ffffff',
            '--text-color':          '#1e1e1e',
            '--accent-color':        '#0066cc',
            '--button-bg':           '#0066cc',
            '--button-hover':        '#0052a3',
            '--selected-bg':         '#cce4ff',
            '--selected-text':       '#1e1e1e',  // dark on light blue
            '--cwd-selected-bg':     '#e8f4ff',
            '--hover-bg':            '#e8e8e8',
            '--error-bg':            '#cc3333',
            '--chrome-sidebar':      '#e0e0e0',  // medium gray sidebar
            '--chrome-bar':          '#f0f0f0',  // lighter gray toolbar
            '--chrome-tab':          '#e6e6e6',  // inactive: between sidebar and bar
            '--chrome-tab-active':   '#ffffff',  // active = white editor
            '--chrome-border':       '#c8c8c8',
            '--chrome-input':        '#e8e8e8',
            '--chrome-input-border': '#b8b8b8',
            '--chrome-status':       '#d4d4d4',  // slightly darker than sidebar
            '--chrome-hover':        '#d8d8d8',
            '--chrome-dropdown':     '#f5f5f5',
            '--chrome-sep':          '#c8c8c8',
            '--chrome-scrolltrack':  '#e0e0e0',
            '--chrome-scrollthumb':  '#b8b8b8',
        },
    };

    const p = palettes[theme] || palettes['monokai'];
    for (const [key, val] of Object.entries(p)) {
        root.style.setProperty(key, val);
    }
}

function applyAutoSaveInterval() {
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
    let styleEl = _el('bracketColorizationStyle');
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

function applyBracketColorizationToEditor() {
    if (!codeEditor || !(settings.bracketColorization ?? true)) return;
    const OPEN = new Set(['{', '[', '(']);
    const CLOSE = new Set(['}', ']', ')']);
    let depth = 0;
    const totalLines = codeEditor.lineCount();
    const scrollInfo = codeEditor.getScrollInfo();
    const startLine = Math.max(0, codeEditor.lineAtHeight(scrollInfo.top, 'local') - 5);
    const endLine = Math.min(totalLines - 1, codeEditor.lineAtHeight(scrollInfo.top + scrollInfo.clientHeight, 'local') + 5);
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
            const coord = codeEditor.charCoords({ line: l, ch: t.start }, 'local');
            const el = document.elementFromPoint(
                codeEditor.getWrapperElement().getBoundingClientRect().left + coord.left + 1,
                codeEditor.getWrapperElement().getBoundingClientRect().top + coord.top + 1
            );
            if (el && el.classList) {
                for (let i = 0; i < 6; i++) el.classList.remove(`cm-bracket-depth-${i}`);
                el.classList.add(`cm-bracket-depth-${d}`);
            }
            if (OPEN.has(t.string)) depth++;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    _el('autoCloseTags').addEventListener('change', (e) => updateAndSaveSetting('autoCloseTags', e.target.checked));
    _el('matchBrackets').addEventListener('change', (e) => updateAndSaveSetting('matchBrackets', e.target.checked));
    _el('autoCloseBrackets').addEventListener('change', (e) => updateAndSaveSetting('autoCloseBrackets', e.target.checked));
    _el('themeSelect').addEventListener('change', (e) => updateAndSaveSetting('theme', e.target.value));
    _el('wordWrap').addEventListener('change', (e) => updateAndSaveSetting('wordWrap', e.target.checked));
    _el('tabWidthSelect').addEventListener('change', (e) => {
        updateAndSaveSetting('tabWidth', parseInt(e.target.value, 10));
    });
    _el('fileTemplates').addEventListener('change', (e) => {
        updateAndSaveSetting('fileTemplates', e.target.checked);
    });
    _el('autoSaveOnBlur').addEventListener('change', (e) => {
        updateAndSaveSetting('autoSaveOnBlur', e.target.checked);
        showNotification(e.target.checked ? 'Auto-save on focus loss enabled.' : 'Auto-save on focus loss disabled.', false, 3000);
    });
    _el('autoSaveSession').addEventListener('change', (e) => {
        updateAndSaveSetting('autoSaveSession', e.target.checked);
        if (!e.target.checked) {
            showNotification("Auto-save/load session disabled.", false, 4000);
        } else {
            showNotification("Auto-save/load session enabled.", false, 3000);
            saveSession();
        }
    });

    const bracketColorizationEl = _el('bracketColorization');
    if (bracketColorizationEl) {
        bracketColorizationEl.addEventListener('change', (e) => {
            updateAndSaveSetting('bracketColorization', e.target.checked);
            showNotification(e.target.checked ? 'Bracket colorization enabled.' : 'Bracket colorization disabled.', false, 2000);
        });
    }

    const autoSaveIntervalEl    = _el('autoSaveInterval');
    const autoSaveIntervalMsEl  = _el('autoSaveIntervalMs');
    const autoSaveIntervalMsRow = _el('autoSaveIntervalMsRow');
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
    const overlay = _el('settingsOverlay');
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