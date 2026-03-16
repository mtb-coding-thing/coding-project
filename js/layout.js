function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const handle = document.getElementById('resizeHandle');
    sidebar.classList.toggle('sidebar-hidden');
    handle.style.display = sidebar.classList.contains('sidebar-hidden') ? 'none' : 'block';
    setTimeout(() => { if (codeEditor) codeEditor.refresh() }, 300);
}

function initSidebarResize() {
    const sidebar = document.getElementById('sidebar');
    const resizeHandle = document.getElementById('resizeHandle');
    const editorContainer = document.getElementById('editorContainer');
    const minSidebarWidth = 150;
    sidebar.style.width = settings.sidebarWidth || defaultSettings.sidebarWidth;
    let isResizing = false, startX, startWidth;

    resizeHandle.addEventListener('pointerdown', (e) => {
        if (sidebar.classList.contains('sidebar-hidden')) return;
        e.preventDefault();
        resizeHandle.setPointerCapture(e.pointerId);
        isResizing = true; startX = e.clientX; startWidth = sidebar.offsetWidth;
        document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    });

    resizeHandle.addEventListener('pointermove', (e) => {
        if (!isResizing) return;
        const maxSidebarWidth = window.innerWidth - editorContainer.offsetWidth + startWidth - 50;
        let newWidth = startWidth + (e.clientX - startX);
        newWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth));
        sidebar.style.width = `${newWidth}px`;
        requestAnimationFrame(() => codeEditor.refresh());
    });

    resizeHandle.addEventListener('pointerup', (e) => {
        if (!isResizing) return;
        isResizing = false;
        resizeHandle.releasePointerCapture(e.pointerId);
        document.body.style.cursor = ''; document.body.style.userSelect = '';
        updateAndSaveSetting('sidebarWidth', sidebar.style.width);
        codeEditor.refresh();
    });

    resizeHandle.style.display = sidebar.classList.contains('sidebar-hidden') ? 'none' : 'block';
}

function initEditorPreviewResize() {
    const editorPane = document.getElementById('editorPane');
    const previewPane = document.getElementById('previewPane');
    const resizeHandle = document.getElementById('editorPreviewResizeHandle');
    const editorSplit = document.getElementById('editorSplit');
    const minPaneWidth = 50;
    editorPane.style.flexBasis = settings.editorPaneFlexBasis || defaultSettings.editorPaneFlexBasis;
    previewPane.style.flexBasis = settings.previewPaneFlexBasis || defaultSettings.previewPaneFlexBasis;
    let isResizing = false, startX, startEditorWidth, startPreviewWidth;

    resizeHandle.addEventListener('pointerdown', (e) => {
        if (previewPane.style.display === 'none') return;
        e.preventDefault();
        resizeHandle.setPointerCapture(e.pointerId);
        isResizing = true; startX = e.clientX;
        startEditorWidth = editorPane.offsetWidth; startPreviewWidth = previewPane.offsetWidth;
        document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    });

    resizeHandle.addEventListener('pointermove', (e) => {
        if (!isResizing) return;
        let delta = e.clientX - startX;
        let newEditorWidth = startEditorWidth + delta;
        let newPreviewWidth = startPreviewWidth - delta;
        const totalWidth = editorSplit.offsetWidth - resizeHandle.offsetWidth;
        if (newEditorWidth < minPaneWidth) { newEditorWidth = minPaneWidth; newPreviewWidth = totalWidth - newEditorWidth; }
        else if (newPreviewWidth < minPaneWidth) { newPreviewWidth = minPaneWidth; newEditorWidth = totalWidth - newPreviewWidth; }
        editorPane.style.flexBasis = `${newEditorWidth}px`; previewPane.style.flexBasis = `${newPreviewWidth}px`;
        requestAnimationFrame(() => codeEditor.refresh());
    });

    resizeHandle.addEventListener('pointerup', (e) => {
        if (!isResizing) return;
        isResizing = false;
        resizeHandle.releasePointerCapture(e.pointerId);
        document.body.style.cursor = ''; document.body.style.userSelect = '';
        const totalWidth = editorSplit.offsetWidth - resizeHandle.offsetWidth;
        if (totalWidth > 0) {
            settings.editorPaneFlexBasis = `${(editorPane.offsetWidth / totalWidth) * 100}%`;
            settings.previewPaneFlexBasis = `${(previewPane.offsetWidth / totalWidth) * 100}%`;
            saveSettings();
        }
        codeEditor.refresh();
    });
}

function togglePreview() {
    const ext = currentFilePath ? currentFilePath.toLowerCase().split('.').pop() : '';
    const previewable = currentFilePath && !currentFilePath.startsWith("untitled://") && ['html', 'md', 'tex'].includes(ext);
    if (!previewable) {
        showNotification("Preview only available for HTML, Markdown, and LaTeX files.", true);
        if (isPreviewEnabled) {
            isPreviewEnabled = false;
            updatePreviewLayout();
            codeEditor.off('change', updatePreview);
            if (_previewScrollHandler) { codeEditor.off('scroll', _previewScrollHandler); _previewScrollHandler = null; }
        }
        return;
    }
    isPreviewEnabled = !isPreviewEnabled;
    updatePreviewLayout();
    if (isPreviewEnabled) {
        updatePreview();
        codeEditor.on('change', updatePreview);
        _previewScrollHandler = () => {
            const si = codeEditor.getScrollInfo();
            const ratio = si.height <= si.clientHeight ? 0 : si.top / (si.height - si.clientHeight);
            const iframe = document.getElementById('previewFrame');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'scrollSync', ratio }, '*');
            }
        };
        codeEditor.on('scroll', _previewScrollHandler);
    } else {
        codeEditor.off('change', updatePreview);
        if (_previewScrollHandler) {
            codeEditor.off('scroll', _previewScrollHandler);
            _previewScrollHandler = null;
        }
    }
    setTimeout(() => codeEditor.refresh(), 100);
}

function updatePreviewLayout() {
    if (!codeEditor) return;
    const editorPane = document.getElementById('editorPane');
    const previewPane = document.getElementById('previewPane');
    const resizeHandle = document.getElementById('editorPreviewResizeHandle');
    const previewBtn = document.getElementById('previewBtn');
    const ext = currentFilePath ? currentFilePath.toLowerCase().split('.').pop() : '';
    const canPreview = currentFilePath && !currentFilePath.startsWith("untitled://") && ['html', 'md', 'tex'].includes(ext);

    if (isPreviewEnabled && canPreview) {
        editorPane.style.flexBasis = settings.editorPaneFlexBasis || defaultSettings.editorPaneFlexBasis;
        previewPane.style.flexBasis = settings.previewPaneFlexBasis || defaultSettings.previewPaneFlexBasis;
        previewPane.style.display = 'block';
        resizeHandle.style.display = 'block';
        if (previewBtn) previewBtn.classList.add('active');
    } else {
        editorPane.style.flexBasis = '100%';
        previewPane.style.display = 'none';
        resizeHandle.style.display = 'none';
        if (previewBtn) previewBtn.classList.remove('active');
        if(isPreviewEnabled && !canPreview) { isPreviewEnabled = false; codeEditor.off('change', updatePreview); }
    }
    codeEditor.refresh();
}

function updatePreview() {
    if (!currentFilePath || currentFilePath.startsWith("untitled://")) return;
    const content = codeEditor.getValue(); 
    const iframe = document.getElementById('previewFrame');
    const ext = currentFilePath.toLowerCase().split('.').pop();

    // Injected into every srcdoc so the iframe can receive scroll ratio messages
    const scrollSyncScript = '<script>' +
        'window.addEventListener(\'message\',function(e){' +
        'if(e.data&&e.data.type===\'scrollSync\'){' +
        'var el=document.scrollingElement||document.documentElement;' +
        'el.scrollTop=e.data.ratio*(el.scrollHeight-el.clientHeight);}});' +
        '</' + 'script>';
    
    if (ext === 'md') {
        const md = getMarkdownInstance();
        if (!md) { showNotification("Markdown library not loaded.", true); return; }
        
        const htmlContent = md.render(content);
        
        const styledHtml = `
        <style> 
            body { 
                font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif); 
                color: #d0d0d0; 
                background: #2a2a2e; 
                padding: 15px; 
                line-height: 1.6;
            } 
            hr { border-color: #555; } 
            .table-wrapper { width: 100%; overflow-x: auto; margin-bottom: 1.5em; }
            table { border-collapse: collapse; width: 100%; } 
            table, th, td { border: 1px solid #555; } 
            th, td { padding: 8px 12px; text-align: left; } 
            thead th { background-color: #3c3c3c; font-weight: 600; } 
            tr:nth-child(even) { background-color: #333; }
            blockquote { 
                border-left: 4px solid #007acc; padding-left: 15px; margin-left: 0; 
                color: #b0b0b0; font-style: italic; background: rgba(0, 122, 204, 0.1);
                padding: 10px 15px; border-radius: 0 4px 4px 0;
            } 
            pre { background: #1e1e1e; padding: 12px; border-radius: 6px; overflow-x: auto; } 
            code { font-family: 'Fira Code', 'Consolas', monospace; background: #1e1e1e; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; } 
            pre > code { padding: 0; background: none; font-size: 0.9em; } 
            a { color: #61afef; text-decoration: none; } 
            a:hover { color: #82c9ff; text-decoration: underline; } 
            img { max-width: 100%; height: auto; border-radius: 4px; } 
        </style> 
        ${htmlContent}
        <script>
            document.querySelectorAll('table').forEach(table => {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-wrapper';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            });
        </' + 'script>
        `;
        
        iframe.srcdoc = styledHtml + scrollSyncScript;
    } else if (ext === 'html') {
        iframe.srcdoc = content + scrollSyncScript;
    } else if (ext === 'tex') {
        iframe.srcdoc = renderLatexToHtml(content) + scrollSyncScript;
    }
}

function collapseAll() {
    function collapseRecursive(path) {
        const entry = fileStructure[path];
        if (!entry || entry.type !== 'folder') return;
        if (path !== 'root') entry.expanded = false;
        entry.children.forEach(child => collapseRecursive(`${path}/${child}`));
    }
    collapseRecursive('root');
    renderFileTree();
    // Save session so collapsed state persists
    if (settings.autoSaveSession) saveSession();
}

function toggleWordWrap() {
    updateAndSaveSetting('wordWrap', !settings.wordWrap);
    showNotification(settings.wordWrap ? 'Word wrap enabled.' : 'Word wrap disabled.', false, 2000);
    syncWordWrapMenuItem();
}

function syncWordWrapMenuItem() {
    const item = document.getElementById('wrapToggleMenuItem');
    if (!item) return;
    // Show a checkmark prefix when wrap is on
    const label = item.childNodes[0];
    if (label && label.nodeType === Node.TEXT_NODE) {
        label.nodeValue = (settings.wordWrap ? '✓ ' : '') + 'Word Wrap ';
    }
}

function toggleDiff() {
    if (!currentFilePath || !fileStructure[currentFilePath] || fileStructure[currentFilePath].type !== 'file') return;
    if (typeof CodeMirror.MergeView === 'undefined') { showNotification("Diff tool library not loaded.", true); return; }

    const diffBtn = document.getElementById('diffBtn');
    const diffContainer = document.getElementById('diffContainer');
    const localSearchWidget = document.getElementById('localSearchWidget');

    if (isDiffEnabled) {
        // TURN OFF DIFF MODE
        isDiffEnabled = false;
        if (diffBtn) diffBtn.classList.remove('active');

        diffContainer.style.display = 'none';
        diffContainer.innerHTML = '';
        diffView = null;

        codeEditor.getWrapperElement().style.flex = '';
        codeEditor.getWrapperElement().style.overflow = '';
        codeEditor.getWrapperElement().style.maxHeight = '';
        codeEditor.refresh();
        codeEditor.focus();
    } else {
        // TURN ON DIFF MODE
        isDiffEnabled = true;
        if (diffBtn) diffBtn.classList.add('active');

        if (localSearchWidget.style.display !== 'none') closeLocalSearch();

        codeEditor.getWrapperElement().style.flex = '0';
        codeEditor.getWrapperElement().style.overflow = 'hidden';
        codeEditor.getWrapperElement().style.maxHeight = '0';
        diffContainer.style.display = 'flex';
        
        const entry = fileStructure[currentFilePath];
        const origContent = entry.savedContent !== undefined ? entry.savedContent : '';
        const modifiedContent = codeEditor.getValue();
        const currentMode = codeEditor.getOption('mode');

        diffContainer.innerHTML = `
            <div class="diff-header">
                <div class="diff-title">Original (Saved)</div>
                <div class="diff-title">Current Changes</div>
            </div>
            <div id="mergeViewTarget"></div>
        `;
        
        const target = document.getElementById('mergeViewTarget');

        diffView = CodeMirror.MergeView(target, {
            value: modifiedContent,
            origLeft: origContent,
            lineNumbers: true,
            mode: currentMode,
            theme: settings.theme,
            revertButtons: true,
            connect: 'align',
            collapseIdentical: false,
            allowEditingOriginals: false,
            tabSize: settings.tabWidth,
            indentUnit: settings.tabWidth,
            lineWrapping: settings.wordWrap,   // respect global word-wrap setting
            viewportMargin: Infinity
        });

        // Sync edits from the right side of the diff viewer back to the main file state
        diffView.editor().on('change', () => {
            const newVal = diffView.editor().getValue();
            if (codeEditor.getValue() !== newVal) {
                codeEditor.setValue(newVal); 
            }
        });

        console.log('[Diff] View opened for:', currentFilePath);
    }
}