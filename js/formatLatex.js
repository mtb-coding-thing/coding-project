// js/formatLatex.js
// Native LaTeX formatter — runs without Prettier.
// Grows here as formatting rules become more sophisticated.

function formatLatex(src) {
    const indent = ' '.repeat(settings.tabWidth || 4);
    const lines = src.split('\n');
    const out = [];
    let depth = 0;
    let prevBlank = false;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();

        // Collapse runs of blank lines to a single blank
        if (trimmed === '') {
            if (!prevBlank && out.length > 0) { out.push(''); prevBlank = true; }
            continue;
        }
        prevBlank = false;

        // \end{} dedents before the line is written
        const isEnd   = /^\\end\{/.test(trimmed);
        const isBegin = /^\\begin\{/.test(trimmed);

        if (isEnd && depth > 0) depth--;

        out.push(indent.repeat(depth) + trimmed);

        // \begin{env} indents subsequent lines
        if (isBegin) depth++;
    }

    // Ensure single trailing newline
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n') + '\n';
}