// js/minimap.js — Canvas minimap for CodeMirror 5

(function () {
    const LINE_H = 2;      // canvas px per doc line
    const CHAR_W = 1.4;    // canvas px per character
    const WIDTH  = 82;     // must match .minimap-wrap width in CSS
    const PAD    = 3;

    const C = {
        bg:       '#1e1e1e',
        text:     '#4e5a65',
        band:     'rgba(160,160,255,0.30)',
        border:   'rgba(160,160,255,0.70)',
        keyword:  '#f92672', string:    '#a6e22e', comment:   '#75715e',
        number:   '#ae81ff', def:       '#66d9ef', variable:  '#fd971f',
        atom:     '#ae81ff', operator:  '#f92672', tag:       '#f92672',
        attribute:'#a6e22e', builtin:   '#66d9ef',
    };

    function tokCol(type) {
        if (!type) return C.text;
        for (const k of type.split(' ')) if (C[k]) return C[k];
        return C.text;
    }

    let wrap = null, canvas = null, ctx = null;
    let scheduled = false;

    // ── core math helpers ─────────────────────────────────────────────────
    // CM5 scrollInfo:
    //   .height       = total document pixel height (always > clientHeight)
    //   .clientHeight = visible editor pixel height
    //   .top          = current scroll offset, range [0 .. height-clientHeight]
    //
    // We map the canvas linearly to the document:
    //   canvasY / canH  =  line / totalLines
    //
    // So scroll position for a given canvas Y:
    //   scrollTop = (canvasY / canH) * scrollRange
    //   where scrollRange = height - clientHeight
    //
    // Band on canvas for current scroll:
    //   bandTop = (top / scrollRange) * (canH - bandH)   <- keeps band inside canvas
    //   bandH   = (clientHeight / height) * canH

    function getBandGeometry(si, canH) {
        const scrollRange = Math.max(si.height - si.clientHeight, 1);
        const scrollFrac  = si.top / scrollRange;           // 0..1
        const bandH       = Math.max((si.clientHeight / si.height) * canH, 8);
        const bandTop     = scrollFrac * (canH - bandH);    // stays within canvas
        return { bandTop, bandH, scrollRange };
    }

    // ── draw ─────────────────────────────────────────────────────────────

    function draw() {
        scheduled = false;
        if (!codeEditor || !canvas || !ctx) return;

        const totalLines = codeEditor.lineCount();
        const canH = Math.max(totalLines * LINE_H, 1);

        // Resize canvas (logical size; CSS width is fixed via stylesheet)
        if (canvas.width !== WIDTH || canvas.height !== canH) {
            canvas.width  = WIDTH;
            canvas.height = canH;
            canvas.style.height = canH + 'px';  // keep CSS in sync to avoid scaling
        }

        // Background
        ctx.fillStyle = C.bg;
        ctx.fillRect(0, 0, WIDTH, canH);

        // Lines — precise mode (true) forces CM5 to tokenize off-screen lines
        for (let ln = 0; ln < totalLines; ln++) {
            const y = ln * LINE_H;
            let x = PAD;
            try {
                const tokens = codeEditor.getLineTokens(ln, true);
                for (const tok of tokens) {
                    if (x >= WIDTH || !tok.string) continue;
                    const w = Math.min(tok.string.length * CHAR_W, WIDTH - x);
                    if (w > 0) {
                        ctx.fillStyle = tokCol(tok.type);
                        ctx.fillRect(x, y, w, LINE_H - 0.5);
                    }
                    x += tok.string.length * CHAR_W;
                }
            } catch (_) {
                const line = codeEditor.getLine(ln) || '';
                const w = Math.min(line.length * CHAR_W, WIDTH - PAD);
                ctx.fillStyle = C.text;
                if (w > 0) ctx.fillRect(PAD, y, w, LINE_H - 0.5);
            }
        }

        // Viewport band
        const si = codeEditor.getScrollInfo();
        const { bandTop, bandH } = getBandGeometry(si, canH);

        ctx.fillStyle = C.band;
        ctx.fillRect(0, bandTop, WIDTH, bandH);
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, bandTop + 0.5, WIDTH - 1, bandH - 1);

        // Slide canvas inside wrap so the band stays visible
        slideToShowBand(canH, bandTop, bandH);
    }

    function slideToShowBand(canH, bandTop, bandH) {
        const wrapH = wrap.clientHeight;
        if (canH <= wrapH) {
            canvas.style.transform = 'translateY(0)';
            return;
        }
        let offset = bandTop + bandH / 2 - wrapH / 2;
        offset = Math.max(0, Math.min(offset, canH - wrapH));
        canvas.style.transform = `translateY(${-offset}px)`;
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(draw);
    }

    // ── click / drag ─────────────────────────────────────────────────────

    function jumpTo(clientY) {
        if (!codeEditor || !canvas || !wrap) return;

        // 1. Convert screen Y to canvas Y (accounting for the slide offset)
        const wrapRect    = wrap.getBoundingClientRect();
        const m           = canvas.style.transform.match(/translateY\(\s*(-?[\d.]+)px\)/);
        const slideOffset = m ? -parseFloat(m[1]) : 0;   // positive = canvas slid up
        const canvasY     = (clientY - wrapRect.top) + slideOffset;

        // 2. canvasY / canH = doc fraction; map to scroll position using scrollRange
        const si          = codeEditor.getScrollInfo();
        const canH        = canvas.height;
        const scrollRange = Math.max(si.height - si.clientHeight, 1);
        const fraction    = Math.max(0, Math.min(1, canvasY / canH));

        codeEditor.scrollTo(null, fraction * scrollRange);
    }

    // ── init ─────────────────────────────────────────────────────────────

    window.initMinimap = function () {
        wrap = document.getElementById('minimapWrap');
        if (!wrap) { console.error('[Minimap] #minimapWrap missing'); return; }
        if (!codeEditor) { console.error('[Minimap] codeEditor not ready'); return; }

        canvas = document.createElement('canvas');
        canvas.id = 'minimapCanvas';
        canvas.style.cssText = `position:absolute;top:0;left:0;width:${WIDTH}px;cursor:pointer;will-change:transform;`;
        wrap.appendChild(canvas);
        ctx = canvas.getContext('2d');

        let dragging = false;
        canvas.addEventListener('mousedown', e => { e.preventDefault(); dragging = true; jumpTo(e.clientY); });
        window.addEventListener('mousemove', e => { if (dragging) jumpTo(e.clientY); });
        window.addEventListener('mouseup',   () => { dragging = false; });

        codeEditor.on('change',         schedule);
        codeEditor.on('scroll',         schedule);
        codeEditor.on('viewportChange', schedule);
        codeEditor.on('swapDoc',        schedule);

        draw();
        console.log('[Minimap] ready —', codeEditor.lineCount(), 'lines, canH:', codeEditor.lineCount() * LINE_H);
    };

    window.refreshMinimap = function () { schedule(); };

    window.destroyMinimap = function () {
        if (codeEditor) {
            codeEditor.off('change',         schedule);
            codeEditor.off('scroll',         schedule);
            codeEditor.off('viewportChange', schedule);
            codeEditor.off('swapDoc',        schedule);
        }
        if (canvas) { canvas.remove(); canvas = null; ctx = null; }
    };
})();
