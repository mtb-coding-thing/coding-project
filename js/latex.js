function renderLatexToHtml(content) {
    let footnoteCounter = 0;
    const footnotes = [];

    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function stripComments(s) {
        return s.replace(/(?<!\\)%[^\n]*/g, '');
    }

    function renderInline(s) {
        s = s.replace(/\\textbf\{([^}]*)\}/g, '<span class="tex-bold">$1</span>');
        s = s.replace(/\\textit\{([^}]*)\}/g, '<span class="tex-italic">$1</span>');
        s = s.replace(/\\emph\{([^}]*)\}/g, '<span class="tex-italic">$1</span>');
        s = s.replace(/\\underline\{([^}]*)\}/g, '<span class="tex-underline">$1</span>');
        s = s.replace(/\\texttt\{([^}]*)\}/g, '<span class="tex-code">$1</span>');
        s = s.replace(/\\textrm\{([^}]*)\}/g, '$1');
        s = s.replace(/\\textsf\{([^}]*)\}/g, '$1');
        s = s.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '<span class="tex-href"><a href="$1">$2</a></span>');
        s = s.replace(/\\url\{([^}]*)\}/g, '<span class="tex-href"><a href="$1">$1</a></span>');
        s = s.replace(/\\footnote\{([^}]*)\}/g, (_, fn) => {
            footnoteCounter++;
            footnotes.push({ n: footnoteCounter, text: fn });
            return `<sup class="footnote-mark" title="${esc(fn)}">${footnoteCounter}</sup>`;
        });
        s = s.replace(/\\&/g, '&amp;');
        s = s.replace(/\\%/g, '%');
        s = s.replace(/\\\$/g, '$');
        s = s.replace(/\\#/g, '#');
        s = s.replace(/\\_/g, '_');
        s = s.replace(/\\\{/g, '{');
        s = s.replace(/\\\}/g, '}');
        s = s.replace(/\\~/g, '&nbsp;');
        s = s.replace(/---/g, '&mdash;');
        s = s.replace(/--/g, '&ndash;');
        s = s.replace(/``/g, '&ldquo;');
        s = s.replace(/''/g, '&rdquo;');
        s = s.replace(/`/g, '&lsquo;');
        s = s.replace(/\\newline|\\\\(?![a-zA-Z])/g, '<br>');
        s = s.replace(/\\noindent\s*/g, '');
        s = s.replace(/\\medskip|\\bigskip|\\smallskip/g, '<br>');
        s = s.replace(/\\vspace\{[^}]*\}/g, '<br>');
        s = s.replace(/\\hspace\{[^}]*\}/g, '&nbsp;');
        s = s.replace(/\\label\{[^}]*\}/g, '');
        s = s.replace(/\\ref\{([^}]*)\}/g, '[ref:$1]');
        s = s.replace(/\\cite\{([^}]*)\}/g, '<span class="tex-code">[$1]</span>');
        s = s.replace(/\\LaTeX\{\}/g, 'L<sup style="font-size:0.7em;vertical-align:0.35em">A</sup>T<sub style="font-size:0.7em;vertical-align:-0.1em">E</sub>X');
        s = s.replace(/\\LaTeX/g, 'L<sup style="font-size:0.7em;vertical-align:0.35em">A</sup>T<sub style="font-size:0.7em;vertical-align:-0.1em">E</sub>X');
        s = s.replace(/\\TeX\{\}/g, 'T<sub style="font-size:0.7em;vertical-align:-0.1em">E</sub>X');
        s = s.replace(/\\TeX/g, 'T<sub style="font-size:0.7em;vertical-align:-0.1em">E</sub>X');
        return s;
    }

    function renderBlock(s) {
        // Verbatim first (protect content from further substitution)
        const verbatimSlots = [];
        s = s.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, (_, c) => {
            const idx = verbatimSlots.length;
            verbatimSlots.push('<code class="tex-verbatim">' + esc(c) + '</code>');
            return `\x00VERBATIM${idx}\x00`;
        });

        // Section headers
        s = s.replace(/\\section\*?\{([^}]*)\}/g, '<div class="section">$1</div>');
        s = s.replace(/\\subsection\*?\{([^}]*)\}/g, '<div class="subsection">$1</div>');
        s = s.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<div class="subsubsection">$1</div>');

        // Display math
        s = s.replace(/\\\[([\s\S]*?)\\\]/g, '<div class="tex-equation">\\[$1\\]</div>');
        s = s.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, '<div class="tex-equation">\\[$1\\]</div>');
        s = s.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, '<div class="tex-equation">\\[\\begin{aligned}$1\\end{aligned}\\]</div>');
        s = s.replace(/\\begin\{gather\*?\}([\s\S]*?)\\end\{gather\*?\}/g, '<div class="tex-equation">\\[$1\\]</div>');
        s = s.replace(/\\begin\{multline\*?\}([\s\S]*?)\\end\{multline\*?\}/g, '<div class="tex-equation">\\[$1\\]</div>');

        // Abstract
        s = s.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, '<div class="tex-abstract">$1</div>');

        // Itemize
        s = s.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, items) => {
            const lis = items.split(/\\item/).filter(i => i.trim()).map(i => '<li>' + renderInline(i.trim()) + '</li>').join('');
            return '<ul class="tex-itemize">' + lis + '</ul>';
        });

        // Enumerate
        s = s.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, items) => {
            const lis = items.split(/\\item/).filter(i => i.trim()).map(i => '<li>' + renderInline(i.trim()) + '</li>').join('');
            return '<ol class="tex-enumerate">' + lis + '</ol>';
        });

        // Description
        s = s.replace(/\\begin\{description\}([\s\S]*?)\\end\{description\}/g, (_, items) => {
            const lis = items.split(/\\item/).filter(i => i.trim()).map(i => {
                const lm = i.match(/^\[([^\]]*?)\]([\s\S]*)$/);
                return lm ? '<li><strong>' + esc(lm[1]) + '</strong> ' + renderInline(lm[2].trim()) + '</li>' : '<li>' + renderInline(i.trim()) + '</li>';
            }).join('');
            return '<ul class="tex-itemize">' + lis + '</ul>';
        });

        // Tabular
        s = s.replace(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (_, tbody) => {
            const rows = tbody.split(/\\\\/).filter(r => r.trim() && !r.includes('\\hline'));
            const htmlRows = rows.map(r => {
                const cols = r.split('&').map(c => '<td>' + renderInline(c.trim()) + '</td>').join('');
                return '<tr>' + cols + '</tr>';
            }).join('');
            return '<table class="tex-table">' + htmlRows + '</table>';
        });

        // Horizontal rule
        s = s.replace(/\\hline|\\rule\{[^}]*\}\{[^}]*\}/g, '<hr class="tex-rule">');

        // Strip remaining unknown environments
        s = s.replace(/\\begin\{[^}]+\}/g, '').replace(/\\end\{[^}]+\}/g, '');

        // Paragraph breaks
        s = s.replace(/\n{2,}/g, '</p><p>');

        // Inline substitutions
        s = renderInline(s);

        // Restore verbatim slots
        s = s.replace(/\x00VERBATIM(\d+)\x00/g, (_, i) => verbatimSlots[+i]);

        return s;
    }

    let src = stripComments(content);

    const titleM  = src.match(/\\title\{([^}]*)\}/);
    const authorM = src.match(/\\author\{([^}]*)\}/);
    const dateM   = src.match(/\\date\{([^}]*)\}/);

    const bodyM = src.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    let body = bodyM ? bodyM[1] : src;

    body = body.replace(/\\maketitle\s*/g, '');
    body = body.replace(/\\tableofcontents\s*/g, '<span class="tex-warn">[Table of Contents — not rendered]</span>');

    let html = '';
    if (titleM)  html += `<div class="tex-title">${renderInline(titleM[1])}</div>`;
    if (authorM && authorM[1].trim()) html += `<div class="tex-author">${renderInline(authorM[1])}</div>`;
    if (dateM) {
        const dateStr = dateM[1].replace(/\\today/, new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'}));
        html += `<div class="tex-date">${renderInline(dateStr)}</div>`;
    }

    html += '<p>' + renderBlock(body) + '</p>';

    let footnotesHtml = '';
    if (footnotes.length > 0) {
        footnotesHtml = '<hr class="tex-rule">' + footnotes.map(f => `<div class="tex-footnote"><sup>${f.n}</sup> ${esc(f.text)}</div>`).join('');
    }

    return `<!DOCTYPE html>
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
<div id="output">${html}</div>
<div id="footnotes-area">${footnotesHtml}</div>
<script>
renderMathInElement(document.body, {
  delimiters: [
    {left:'$$', right:'$$', display:true},
    {left:'\\\\[', right:'\\\\]', display:true},
    {left:'$', right:'$', display:false},
    {left:'\\\\(', right:'\\\\)', display:false}
  ],
  throwOnError: false
});
<\/script>
</body>
</html>`;
}