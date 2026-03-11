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
        if (isPreviewEnabled) { isPreviewEnabled = false; updatePreviewLayout(); codeEditor.off('change', updatePreview); }
        return;
    }
    isPreviewEnabled = !isPreviewEnabled;
    updatePreviewLayout();
    if (isPreviewEnabled) { updatePreview(); codeEditor.on('change', updatePreview); }
    else { codeEditor.off('change', updatePreview); }
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
        <\/script>
        `;
        
        iframe.srcdoc = styledHtml;
    } else if (ext === 'html') {
        iframe.srcdoc = content;
    } else if (ext === 'tex') {
        // Extract title/author/date from \title{}, \author{}, \date{} commands
        const titleMatch  = content.match(/\\title\{([^}]*)\}/);
        const authorMatch = content.match(/\\author\{([^}]*)\}/);
        const dateMatch   = content.match(/\\date\{([^}]*)\}/);

        // Extract body between \begin{document} and \end{document}
        const bodyMatch = content.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
        let body = bodyMatch ? bodyMatch[1] : content;

        // Strip \maketitle — we render it manually
        body = body.replace(/\\maketitle\s*/g, '');

        const escapedContent = JSON.stringify(content);

        const latexHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"><\/script>
<style>
  body { background:#2a2a2e; color:#d0d0d0; font-family:'Computer Modern',Georgia,serif; padding:20px 30px; line-height:1.7; font-size:15px; }
  .tex-title { text-align:center; margin-bottom:0.2em; font-size:1.6em; font-weight:bold; }
  .tex-author { text-align:center; font-size:1.05em; margin-bottom:0.1em; }
  .tex-date { text-align:center; font-size:0.95em; color:#aaa; margin-bottom:1.5em; }
  .tex-abstract { margin:1em 3em; padding:0.8em 1em; border-left:3px solid #555; background:#333; border-radius:0 4px 4px 0; font-size:0.95em; }
  h1,h2,h3,h4 { color:#c9d1d9; }
  .section { font-size:1.25em; font-weight:bold; margin-top:1.5em; margin-bottom:0.3em; border-bottom:1px solid #444; padding-bottom:0.2em; }
  .subsection { font-size:1.1em; font-weight:bold; margin-top:1.1em; margin-bottom:0.2em; }
  .subsubsection { font-size:1em; font-weight:bold; font-style:italic; margin-top:0.9em; margin-bottom:0.2em; }
  .tex-bold { font-weight:bold; }
  .tex-italic { font-style:italic; }
  .tex-underline { text-decoration:underline; }
  .tex-code { font-family:monospace; background:#1e1e1e; padding:0.1em 0.3em; border-radius:3px; font-size:0.9em; }
  .tex-verbatim { font-family:monospace; background:#1e1e1e; padding:10px; border-radius:5px; overflow-x:auto; white-space:pre; display:block; margin:0.8em 0; font-size:0.9em; }
  .tex-itemize, .tex-enumerate { padding-left:1.8em; margin:0.5em 0; }
  .tex-itemize li, .tex-enumerate li { margin:0.2em 0; }
  .tex-equation { margin:0.8em 0; text-align:center; overflow-x:auto; }
  .tex-href a { color:#61afef; }
  .tex-comment { display:none; }
  .tex-rule { border:none; border-top:1px solid #555; margin:1em 0; }
  .tex-footnote { font-size:0.8em; color:#aaa; border-top:1px solid #444; margin-top:2em; padding-top:0.5em; }
  .footnote-mark { color:#61afef; font-size:0.75em; vertical-align:super; cursor:default; }
  .katex-display { overflow-x:auto; overflow-y:hidden; }
  .tex-warn { color:#e5a550; font-style:italic; font-size:0.85em; }
  .tex-table { border-collapse:collapse; margin:1em auto; }
  .tex-table td, .tex-table th { border:1px solid #555; padding:5px 10px; }
  .tex-table th { background:#3c3c3c; }
  p { margin:0.5em 0; }
</style>
</head>
<body>
<div id="output"></div>
<div id="footnotes-area"></div>
<script>
(function() {
  const raw = ${escapedContent};
  let footnoteCounter = 0;
  const footnotes = [];

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Strip comments
  function stripComments(s) {
    return s.replace(/(?<!\\)%[^\\n]*/g, '');
  }

  // Parse \begin{env}...\end{env} blocks, return [before, content, after] or null
  function extractEnv(s, env) {
    const re = new RegExp('\\\\\\\\begin\\\\{' + env + '\\\\}([\\\\s\\\\S]*?)\\\\\\\\end\\\\{' + env + '\\\\}');
    // We'll use indexOf approach for reliability
    const startTag = '\\\\begin{' + env + '}';
    const endTag   = '\\\\end{' + env + '}';
    const si = s.indexOf('\\begin{' + env + '}');
    if (si === -1) return null;
    const ei = s.indexOf('\\end{' + env + '}', si);
    if (ei === -1) return null;
    return [s.slice(0, si), s.slice(si + ('\\begin{' + env + '}').length, ei), s.slice(ei + ('\\end{' + env + '}').length)];
  }

  function renderInline(s) {
    // Bold, italic, underline, texttt
    s = s.replace(/\\\\textbf\{([^}]*)\}/g, '<span class="tex-bold">$1</span>');
    s = s.replace(/\\\\textit\{([^}]*)\}/g, '<span class="tex-italic">$1</span>');
    s = s.replace(/\\\\emph\{([^}]*)\}/g, '<span class="tex-italic">$1</span>');
    s = s.replace(/\\\\underline\{([^}]*)\}/g, '<span class="tex-underline">$1</span>');
    s = s.replace(/\\\\texttt\{([^}]*)\}/g, '<span class="tex-code">$1</span>');
    s = s.replace(/\\\\textrm\{([^}]*)\}/g, '$1');
    s = s.replace(/\\\\textsf\{([^}]*)\}/g, '$1');
    // href
    s = s.replace(/\\\\href\{([^}]*)\}\{([^}]*)\}/g, '<span class="tex-href"><a href="$1">$2</a></span>');
    s = s.replace(/\\\\url\{([^}]*)\}/g, '<span class="tex-href"><a href="$1">$1</a></span>');
    // footnote
    s = s.replace(/\\\\footnote\{([^}]*)\}/g, (_, fn) => {
      footnoteCounter++;
      footnotes.push({ n: footnoteCounter, text: fn });
      return \`<sup class="footnote-mark" title="\${esc(fn)}">\${footnoteCounter}</sup>\`;
    });
    // Special chars
    s = s.replace(/\\\\&/g, '&amp;');
    s = s.replace(/\\\\%/g, '%');
    s = s.replace(/\\\\\\$/g, '$');
    s = s.replace(/\\\\#/g, '#');
    s = s.replace(/\\\\_/g, '_');
    s = s.replace(/\\\\\\{/g, '{');
    s = s.replace(/\\\\\\}/g, '}');
    s = s.replace(/\\\\~/g, '&nbsp;');
    s = s.replace(/---/g, '&mdash;');
    s = s.replace(/--/g, '&ndash;');
    s = s.replace(/``/g, '&ldquo;');
    s = s.replace(/''/g, '&rdquo;');
    s = s.replace(/\`/g, '&lsquo;');
    s = s.replace(/\\\\newline|\\\\\\\\(?![a-zA-Z])/g, '<br>');
    s = s.replace(/\\\\noindent\s*/g, '');
    s = s.replace(/\\\\medskip|\\\\bigskip|\\\\smallskip/g, '<br>');
    s = s.replace(/\\\\vspace\{[^}]*\}/g, '<br>');
    s = s.replace(/\\\\hspace\{[^}]*\}/g, '&nbsp;');
    s = s.replace(/\\\\label\{[^}]*\}/g, '');
    s = s.replace(/\\\\ref\{([^}]*)\}/g, '[ref:$1]');
    s = s.replace(/\\\\cite\{([^}]*)\}/g, '<span class="tex-code">[$1]</span>');
    return s;
  }

  function renderBlock(s) {
    // Section headers
    s = s.replace(/\\\\section\*?\{([^}]*)\}/g, '<div class="section">$1</div>');
    s = s.replace(/\\\\subsection\*?\{([^}]*)\}/g, '<div class="subsection">$1</div>');
    s = s.replace(/\\\\subsubsection\*?\{([^}]*)\}/g, '<div class="subsubsection">$1</div>');
    // Verbatim (before inline substitutions to protect code)
    s = s.replace(/\\\\begin\{verbatim\}([\\s\\S]*?)\\\\end\{verbatim\}/g, (_, c) => '<code class="tex-verbatim">' + esc(c) + '</code>');
    // Display math: \\[...\\] and equation env
    s = s.replace(/\\\\\\\[([\\s\\S]*?)\\\\\\\]/g, '<div class="tex-equation">\\\\[$1\\\\]</div>');
    s = s.replace(/\\\\begin\{equation\*?\}([\\s\\S]*?)\\\\end\{equation\*?\}/g, '<div class="tex-equation">\\\\[$1\\\\]</div>');
    s = s.replace(/\\\\begin\{align\*?\}([\\s\\S]*?)\\\\end\{align\*?\}/g, '<div class="tex-equation">\\\\[\\\\begin{aligned}$1\\\\end{aligned}\\\\]</div>');
    s = s.replace(/\\\\begin\{gather\*?\}([\\s\\S]*?)\\\\end\{gather\*?\}/g, '<div class="tex-equation">\\\\[$1\\\\]</div>');
    s = s.replace(/\\\\begin\{multline\*?\}([\\s\\S]*?)\\\\end\{multline\*?\}/g, '<div class="tex-equation">\\\\[$1\\\\]</div>');
    // Abstract
    s = s.replace(/\\\\begin\{abstract\}([\\s\\S]*?)\\\\end\{abstract\}/g, '<div class="tex-abstract">$1</div>');
    // Itemize
    s = s.replace(/\\\\begin\{itemize\}([\\s\\S]*?)\\\\end\{itemize\}/g, (_, items) => {
      const lis = items.split(/\\\\item/).filter(i => i.trim()).map(i => '<li>' + renderInline(i.trim()) + '</li>').join('');
      return '<ul class="tex-itemize">' + lis + '</ul>';
    });
    // Enumerate
    s = s.replace(/\\\\begin\{enumerate\}([\\s\\S]*?)\\\\end\{enumerate\}/g, (_, items) => {
      const lis = items.split(/\\\\item/).filter(i => i.trim()).map(i => '<li>' + renderInline(i.trim()) + '</li>').join('');
      return '<ol class="tex-enumerate">' + lis + '</ol>';
    });
    // Description
    s = s.replace(/\\\\begin\{description\}([\\s\\S]*?)\\\\end\{description\}/g, (_, items) => {
      const lis = items.split(/\\\\item/).filter(i => i.trim()).map(i => {
        const lm = i.match(/^\\[([^\\]]*?)\\](.*)$/s);
        return lm ? '<li><strong>' + esc(lm[1]) + '</strong> ' + renderInline(lm[2].trim()) + '</li>' : '<li>' + renderInline(i.trim()) + '</li>';
      }).join('');
      return '<ul class="tex-itemize">' + lis + '</ul>';
    });
    // Simple tabular (best-effort)
    s = s.replace(/\\\\begin\{tabular\}\{[^}]*\}([\\s\\S]*?)\\\\end\{tabular\}/g, (_, body) => {
      const rows = body.split(/\\\\\\\\/).filter(r => r.trim() && !r.includes('\\hline'));
      const htmlRows = rows.map(r => {
        const cols = r.split('&').map(c => '<td>' + renderInline(c.trim()) + '</td>').join('');
        return '<tr>' + cols + '</tr>';
      }).join('');
      return '<table class="tex-table">' + htmlRows + '</table>';
    });
    // Horizontal rule
    s = s.replace(/\\\\hline|\\\\rule\{[^}]*\}\{[^}]*\}/g, '<hr class="tex-rule">');
    // Remaining unknown environments — strip tags, keep content
    s = s.replace(/\\\\begin\{[^}]+\}/g, '').replace(/\\\\end\{[^}]+\}/g, '');
    // Paragraph breaks
    s = s.replace(/\n{2,}/g, '</p><p>');
    // Inline
    s = renderInline(s);
    return s;
  }

  let src = stripComments(raw);

  // Extract preamble metadata
  const titleM  = src.match(/\\\\title\{([^}]*)\}/);
  const authorM = src.match(/\\\\author\{([^}]*)\}/);
  const dateM   = src.match(/\\\\date\{([^}]*)\}/);

  // Extract body
  const bodyM = src.match(/\\\\begin\{document\}([\\s\\S]*?)\\\\end\{document\}/);
  let body = bodyM ? bodyM[1] : src;

  // Remove preamble commands that bled into body or standalone usage
  body = body.replace(/\\\\maketitle\\s*/g, '');
  body = body.replace(/\\\\tableofcontents\\s*/g, '<span class="tex-warn">[Table of Contents — not rendered]</span>');

  let html = '';

  if (titleM) html += \`<div class="tex-title">\${renderInline(titleM[1])}</div>\`;
  if (authorM && authorM[1].trim()) html += \`<div class="tex-author">\${renderInline(authorM[1])}</div>\`;
  if (dateM) {
    const dateStr = dateM[1].replace(/\\\\today/, new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'}));
    html += \`<div class="tex-date">\${renderInline(dateStr)}</div>\`;
  }

  html += '<p>' + renderBlock(body) + '</p>';

  document.getElementById('output').innerHTML = html;

  // Render footnotes
  if (footnotes.length > 0) {
    const fa = document.getElementById('footnotes-area');
    fa.innerHTML = '<hr class="tex-rule">' + footnotes.map(f => \`<div class="tex-footnote"><sup>\${f.n}</sup> \${esc(f.text)}</div>\`).join('');
  }

  // KaTeX auto-render
  renderMathInElement(document.body, {
    delimiters: [
      {left:'$$',  right:'$$',  display:true},
      {left:'\\\\[', right:'\\\\]', display:true},
      {left:'$',   right:'$',   display:false},
      {left:'\\\\(', right:'\\\\)', display:false}
    ],
    throwOnError: false
  });
})();
<\/script>
</body>
</html>`;
        iframe.srcdoc = latexHtml;
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
}

function toggleDiff() {
    if (!currentFilePath || !fileStructure[currentFilePath] || fileStructure[currentFilePath].type !== 'file') return;
    if (typeof CodeMirror.MergeView === 'undefined') { showNotification("Diff tool library not loaded.", true); return; }

    const diffBtn = document.getElementById('diffBtn');
    const diffContainer = document.getElementById('diffContainer');
    const editorWrapper = codeEditor.getWrapperElement();
    const localSearchWidget = document.getElementById('localSearchWidget');

    if (isDiffEnabled) {
        // TURN OFF DIFF MODE
        isDiffEnabled = false;
        if (diffBtn) diffBtn.classList.remove('active');
        
        diffContainer.style.display = 'none';
        diffContainer.innerHTML = '';
        diffView = null;
        
        editorWrapper.style.display = 'block';
        codeEditor.refresh();
        codeEditor.focus();
    } else {
        // TURN ON DIFF MODE
        isDiffEnabled = true;
        if (diffBtn) diffBtn.classList.add('active');
        
        if (localSearchWidget.style.display !== 'none') closeLocalSearch();

        editorWrapper.style.display = 'none';
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
            revertButtons: true, // Arrows click to revert chunk from saved -> modified
            connect: 'align',
            collapseIdentical: false,
            allowEditingOriginals: false,
            tabSize: settings.tabWidth,
            indentUnit: settings.tabWidth,
            lineWrapping: settings.wordWrap,
            viewportMargin: Infinity
        });

        // Sync edits from the right side of the diff viewer back to the main file state
        diffView.editor().on('change', () => {
            const newVal = diffView.editor().getValue();
            if (codeEditor.getValue() !== newVal) {
                codeEditor.setValue(newVal); 
            }
        });
    }
}