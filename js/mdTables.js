/* This script doesn't currently do anything because the universe seems to have a profound dislike of markdown tables. The next comment is flat-out wrong. */

/* Hey looks like tables work now, but this script is still useless. It's too iconic to delete. The previous comment referred to the comment after this comment. */

/**
 * Custom Markdown Table Preprocessor
 * Detects Markdown tables and converts them to HTML.
 * This guarantees tables render regardless of external library versions/plugins.
 */
function please_work_this_time(markdown) {
    const lines = markdown.split('\n');
    let output = [];
    let tableBuffer =[];

    // Helper: checks if a line is a valid Markdown table separator (e.g., |---|---| )
    const isSeparatorLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed.includes('-') || !trimmed.includes('|')) return false;
        // Should strictly contain pipes, hyphens, colons, and spaces
        return /^[\s\|\-\:]+$/.test(trimmed);
    };

    // Helper: splits a row by '|' but ignores escaped pipes '\|'
    const parseRow = (line) => {
        let trimmed = line.trim();
        // Remove leading and trailing pipes for splitting
        if (trimmed.startsWith('|')) trimmed = trimmed.substring(1);
        if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.substring(0, trimmed.length - 1);
        
        const cells =[];
        let currentCell = '';
        for (let i = 0; i < trimmed.length; i++) {
            if (trimmed[i] === '\\' && trimmed[i + 1] === '|') {
                currentCell += '|';
                i++; // skip the escaped pipe
            } else if (trimmed[i] === '|') {
                cells.push(currentCell.trim());
                currentCell = '';
            } else {
                currentCell += trimmed[i];
            }
        }
        cells.push(currentCell.trim());
        return cells;
    };

    // Helper: parses inline formatting (bold, code, links) inside cells
    const parseCell = (cellText) => {
        if (typeof marked !== 'undefined' && typeof marked.parseInline === 'function') {
            return marked.parseInline(cellText);
        }
        return cellText; // Fallback to raw text
    };

    const flushTable = () => {
        if (tableBuffer.length < 2) {
            // Not a valid table structure (needs at least header + separator)
            output.push(...tableBuffer);
            tableBuffer =[];
            return;
        }

        if (!isSeparatorLine(tableBuffer[1])) {
            // Second line isn't a separator, dump as normal text
            output.push(...tableBuffer);
            tableBuffer =[];
            return;
        }

        // Generate the custom HTML table
        let html = '<div class="md-table-wrapper">\n<table class="md-table">\n';
        
        const headers = parseRow(tableBuffer[0]);
        html += '  <thead>\n    <tr>\n';
        headers.forEach(h => html += `      <th>${parseCell(h)}</th>\n`);
        html += '    </tr>\n  </thead>\n  <tbody>\n';

        // Add Data Rows
        for (let i = 2; i < tableBuffer.length; i++) {
            const row = parseRow(tableBuffer[i]);
            html += '    <tr>\n';
            row.forEach(cell => html += `      <td>${parseCell(cell)}</td>\n`);
            html += '    </tr>\n';
        }

        html += '  </tbody>\n</table>\n</div>\n';
        output.push(html);
        tableBuffer =[];
    };

    // Iterate over every line to locate table blocks
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.includes('|')) {
            // Buffer potential table lines
            tableBuffer.push(line);
        } else {
            // Empty line or non-table line breaks the current table block
            if (tableBuffer.length > 0) flushTable();
            output.push(line);
        }
    }

    // Flush any table stuck in buffer at end of file
    if (tableBuffer.length > 0) flushTable();

    return output.join('\n');
}