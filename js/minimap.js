// js/minimap.js — Lightweight editor minimap rendered to a <canvas>
// The canvas represents the entire document at LINE_H px/line.
// The #minimapWrap clips it; on scroll we shift the canvas position inside
// the wrap so the viewport band is always visible — exactly like VS Code.

(function () {
    const CHAR_W  = 1.5;   // px per character column
    const LINE_H  = 2;     // px per line  (full-document scale, no capping)
    const MAX_W   = 80;    // canvas/wrap width in px
    const PADDING = 4;     // horizontal padding inside canvas

    let canvas, ctx, wrap;
    let renderTimeout = null;
    let isDragging = false;

    // Colour palette (monokai-ish dark theme)
    const COLOURS = {
        bg:             '#1e1e1e',
        text:           '#555e6e',
        keyword:        '#e06c75',
        string:         '#98c379',
        comment:        '#4b5263',
        number:         '#d19a66',
        viewport:       'rgba(180,180,255,0.10)',
        viewportBorder: 'rgba(180,180,255,0.25)',
    };

    const TOKEN_MAP = [
        ['comment',   COLOURS.comment],
        ['string',    COLOURS.string],
        ['number',    COLOURS.number],
        ['keyword',   COLOURS.keyword],
        ['def',       '#61afef'],
        ['variable',  '#e5c07b'],
        ['atom',      '#d19a66'],
        ['operator',  '#abb2bf'],
        ['tag',       '#e06c75'],
        ['attribute', '#d19a66'],
    ];

    function tokenColour(tokenType) {
        if (!tokenType) return COLOURS.text;
        for (const [k, c] of TOKEN_MAP) {
            if (tokenType.includes(k)) return c;
        }
        return COLOURS.text;
    }

    // ── canvas offset within wrap so the viewport band stays visible ──────
    function syncCanvasOffset() {
        if (!codeEditor || !canvas || !wrap) return;
        const scrollInfo  = codeEditor.getScrollInfo();
        const docH        = scrollInfo.height;
        if (docH <= 0) return;

        const wrapH       = wrap.offsetHeight;
        const canvasH     = canvas.height;

        // Where is the viewport band on the canvas?
        const bandTop     = (scrollInfo.top / docH) * canvasH;
        const bandH       = Math.max((scrollInfo.clientHeight / docH) * canvasH, 8);

        // Ideal canvas translateY: centre the band in the wrap, clamped so
        // the canvas never scrolls past its own edges.
        const idealOffset = bandTop + bandH / 2 - wrapH / 2;
        const maxOffset   = Math.max(0, canvasH - wrapH);
        const offset      = Math.max(0, Math.min(idealOffset, maxOffset));

        canvas.style.transform = `translateY(${-offset}px)`;
    }

    function render() {
        if (!codeEditor || !canvas || !ctx) return;

        const totalLines = codeEditor.lineCount();
        const canvasH    = Math.max(totalLines * LINE_H, 1);
        const maxChars   = Math.floor((MAX_W - PADDING * 2) / CHAR_W);

        // Resize only when needed
        if (canvas.width !== MAX_W || canvas.height !== canvasH) {
            canvas.width  = MAX_W;
            canvas.height = canvasH;
        }

        ctx.fillStyle = COLOURS.bg;
        ctx.fillRect(0, 0, MAX_W, canvasH);

        for (let i = 0; i < totalLines; i++) {
            const y = i * LINE_H;
            let x = PADDING, charIdx = 0;
            try {
                codeEditor.getLineTokens(i).forEach(tok => {
                    const colour = tokenColour(tok.type);
                    ctx.fillStyle = colour;
                    const text = tok.string.slice(0, maxChars - charIdx);
                    if (!text) return;
                    const w = Math.min(text.length * CHAR_W, MAX_W - x - PADDING);
                    if (w > 0) ctx.fillRect(x, y, w, Math.max(LINE_H - 0.5, 1));
                    x += text.length * CHAR_W;
                    charIdx += text.length;
                });
            } catch (_) {
                const line = codeEditor.getLine(i) || '';
                const w = Math.min(line.length * CHAR_W, MAX_W - PADDING * 2);
                ctx.fillStyle = COLOURS.text;
                if (w > 0) ctx.fillRect(PADDING, y, w, Math.max(LINE_H - 0.5, 1));
            }
        }

        // Draw viewport band
        const scrollInfo = codeEditor.getScrollInfo();
        const docH = scrollInfo.height;
        if (docH > 0) {
            const vTop    = (scrollInfo.top            / docH) * canvasH;
            const vHeight = Math.max((scrollInfo.clientHeight / docH) * canvasH, 8);
            ctx.fillStyle = COLOURS.viewport;
            ctx.fillRect(0, vTop, MAX_W, vHeight);
            ctx.strokeStyle = COLOURS.viewportBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(0.5, vTop + 0.5, MAX_W - 1, Math.max(vHeight - 1, 1));
        }

        syncCanvasOffset();
    }

    // Fast path: on scroll just redraw the viewport band + shift canvas offset
    // without re-tokenising every line (full render is scheduled separately).
    function onScroll() {
        if (!codeEditor || !canvas || !ctx) return;
        const scrollInfo = codeEditor.getScrollInfo();
        const docH       = scrollInfo.height;
        const canvasH    = canvas.height;
        if (docH <= 0) return;

        // Clear only the area that could contain an old band.
        // Re-draw the background strip for the full canvas height then repaint
        // the band — cheaper than a full render on every scroll tick.
        ctx.fillStyle = COLOURS.bg;
        ctx.fillRect(0, 0, MAX_W, canvasH);

        // Re-draw all lines (tokenised data is already cached by CM internals so this is fast)
        const maxChars = Math.floor((MAX_W - PADDING * 2) / CHAR_W);
        const totalLines = codeEditor.lineCount();
        for (let i = 0; i < totalLines; i++) {
            const y = i * LINE_H;
            let x = PADDING, charIdx = 0;
            try {
                codeEditor.getLineTokens(i).forEach(tok => {
                    ctx.fillStyle = tokenColour(tok.type);
                    const text = tok.string.slice(0, maxChars - charIdx);
                    if (!text) return;
                    const w = Math.min(text.length * CHAR_W, MAX_W - x - PADDING);
                    if (w > 0) ctx.fillRect(x, y, w, Math.max(LINE_H - 0.5, 1));
                    x += text.length * CHAR_W;
                    charIdx += text.length;
                });
            } catch (_) {}
        }

        const vTop    = (scrollInfo.top            / docH) * canvasH;
        const vHeight = Math.max((scrollInfo.clientHeight / docH) * canvasH, 8);
        ctx.fillStyle = COLOURS.viewport;
        ctx.fillRect(0, vTop, MAX_W, vHeight);
        ctx.strokeStyle = COLOURS.viewportBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, vTop + 0.5, MAX_W - 1, Math.max(vHeight - 1, 1));

        syncCanvasOffset();
    }

    function scheduleRender() {
        if (renderTimeout) return;
        renderTimeout = setTimeout(() => { renderTimeout = null; render(); }, 80);
    }

    // ── pointer interaction ──────────────────────────────────────────────
    function scrollEditorToCanvasY(clientY) {
        if (!codeEditor || !canvas || !wrap) return;
        // clientY relative to the wrap top gives position within the visible window.
        // Add the canvas's current translateY offset to get the true canvas-coordinate Y.
        const wrapRect  = wrap.getBoundingClientRect();
        const relY      = clientY - wrapRect.top;
        const translateY = getCurrentTranslateY();
        const canvasY   = relY + translateY;
        const fraction  = Math.max(0, Math.min(1, canvasY / canvas.height));
        const scrollInfo = codeEditor.getScrollInfo();
        codeEditor.scrollTo(null, fraction * scrollInfo.height);
    }

    // Extract the current translateY value set on the canvas element
    function getCurrentTranslateY() {
        if (!canvas) return 0;
        const t = canvas.style.transform;
        if (!t) return 0;
        const m = t.match(/translateY\(\s*(-?[\d.]+)px\s*\)/);
        return m ? -parseFloat(m[1]) : 0;  // stored as negative, we want positive offset
    }

    function ensureCanvas() {
        if (canvas) return;
        wrap = document.getElementById('minimapWrap');
        if (!wrap) { console.warn('[Minimap] #minimapWrap not found'); return; }

        canvas = document.createElement('canvas');
        canvas.id = 'minimapCanvas';
        // position:absolute so translateY() moves it within the overflow:hidden wrap
        canvas.style.cssText = `display:block;width:${MAX_W}px;position:absolute;top:0;left:0;cursor:pointer;will-change:transform;`;
        wrap.appendChild(canvas);
        ctx = canvas.getContext('2d');

        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            scrollEditorToCanvasY(e.clientY);
        });
        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) scrollEditorToCanvasY(e.clientY);
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    // ── public API ───────────────────────────────────────────────────────
    window.initMinimap = function () {
        ensureCanvas();
        if (!codeEditor) { console.warn('[Minimap] codeEditor not available'); return; }
        codeEditor.on('change',         scheduleRender);
        codeEditor.on('scroll',         onScroll);
        codeEditor.on('viewportChange', scheduleRender);
        codeEditor.on('swapDoc',        scheduleRender);
        render();
        console.log('[Minimap] Initialised');
    };

    window.refreshMinimap = function () { scheduleRender(); };

    window.destroyMinimap = function () {
        if (!codeEditor) return;
        codeEditor.off('change',         scheduleRender);
        codeEditor.off('scroll',         onScroll);
        codeEditor.off('viewportChange', scheduleRender);
        codeEditor.off('swapDoc',        scheduleRender);
        if (canvas) { canvas.remove(); canvas = null; ctx = null; }
        console.log('[Minimap] Destroyed');
    };
})();