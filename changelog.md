*(repo might not be updated as fast as the changelog; as such the changes here might not be there yet)*

# Changes in v0.3.2

## Bugfixes
- Fixed a bug that made bracket colorization not work.

## Improvements
- Implemented pinned tabs logic.

## Additions
- soon

---

# Changes in v0.3.1

## Bugfixes
- Fixed a critical bug with v0.3.1 (a syntax error in `layout.js` that caused the entire app to malfunction)
- Fixed LaTeX preview by correcting regex escaping and refactoring the renderer into a new `js/latex.js` module
- Fixed root folder not appearing on load (was masked by the `layout.js` syntax error)
- Fixed CWD not updating when opening a file — "New File" now always creates in the correct folder
- Fixed session restore race condition where `openFile` could run before `renderFileTree` completed
- Fixed `expandAll` not saving session (folder expand/collapse state now persists correctly)
- Fixed duplicated files starting with an unsaved asterisk — `Duplicate` now creates a clean saved copy
- Fixed global replace not preserving the correct diff baseline — `savedContent` is now kept as the pre-replace original so the diff view is accurate
- Fixed a bug that made the editor unscrollable
- Fixed a bug that made the minimap malfunction
- Fixed `applySettings()` aborting before `applyThemeChrome()` ran — any `getElementById` returning `null` (e.g. when called before full DOM parse) would throw and prevent theme chrome from applying; all element lookups are now null-guarded
- Fixed JSON linting console error ("window.jsonlint not defined") — replaced broken CDN + shim with an inline `window.jsonlint` definition backed by `JSON.parse`, which already satisfies the CodeMirror `json-lint.js` addon's full interface
- Fixed file tree selection highlight showing white text on light-theme backgrounds — `.active-tree-node` and `.recent-file-item.active` now use `var(--selected-text)` instead of hardcoded `color: white`

## Improvements
- Word Wrap is now togglable from the `···` overflow toolbar menu with a live checkmark indicator
- Bracket pair colorization: brackets now cycle through 3 colours by nesting depth (can be toggled in Settings)
- Timed auto-save interval controls are now visible in Settings (the logic already existed but had no UI)
- Minimap is now active — the canvas-based minimap (`js/minimap.js`) was fully written but was never loaded or initialised; it is now wired up and displayed alongside the editor
- Breadcrumb bar added above the toolbar showing the current file path with clickable folder segments that update CWD
- Pinned tabs now show a blue top-border for clearer visual distinction
- `collapseAll` / `expandAll` both save session so tree state persists across reloads
- Diff view word wrap now correctly follows the global Word Wrap setting
- Breadcrumb path now copyable
- Editor scrollbar now matches the active theme instead of always rendering white/default
- Written lines (content area) now have a subtle brightness difference from the empty dead zone below the last line, making it visually clear where the file ends — theme-aware (brightens on dark themes, darkens on light)
- Full chrome theming system: sidebar, tab strip, toolbar, breadcrumb bar, status bar, context menus, modals, inputs, and scrollbars all update to match the active CodeMirror theme via CSS custom properties driven by a new `applyThemeChrome()` function in `settings.js`
- Each theme has a distinct visual identity with clear shading steps (sidebar darkest → toolbar → inactive tab → active tab = editor bg), rather than uniform gray chrome across all themes

## Additions
- `js/minimap.js` — canvas minimap 
- `js/latex.js` — LaTeX preview renderer extracted from `layout.js` (added in v0.3.1 initial fix)
- `bracketColorization` setting added to defaults and Settings UI
- Added a new breadcrumb path system just beneath the tabs.

---

# <u>Changes in v0.3.0</u>
## <u>Bugfixes</u>
* **Stale recent files after rename** — `saveRenaming` now remaps all `recentFiles` entries whose paths matched the old file or folder path (including children of renamed folders)
* **Global replace "Searching…" flash** — search results div is cleared to `'Searching...'` *before* dispatching to the worker, replacing stale results cleanly instead of flashing old content
* **`closeLocalSearch` crash when editor not ready** — `codeEditor.focus()` is now guarded with `if (codeEditor)` to prevent a throw if the shortcut fires before initialisation
* **Deleted files remain in recent files panel** — `deleteEntry` now prunes `recentFiles` of any entries whose path starts with the deleted path, and re-renders the panel
* **`openGoToLine` crash on Escape/backdrop dismiss** — `.then()` callback now receives the full result object and guards against `null` before destructuring, preventing an uncaught TypeError
* **HTML syntax highlighting broken** — the `htmlmixed` CodeMirror mode script was missing from `index.html`; `xml.js`, `javascript.js`, and `css.js` are prerequisites but do not themselves register `htmlmixed`. The mode script is now loaded immediately after its dependencies in the correct order
* **No unsaved asterisk on md files** -- `change` handler used a broken allow list for user origins; now it uses a denylist instead.
* **Drag and drop for files within the tree broken** -- fixed; dragging and dropping files should now avoid visual 'stutter' and it now has clarity. Files are no longer 'stuck' in folders.
* **Minor status message bug related to dragdrop functionality** -- fixed.
* **Preview resize handle stays latched after mouse release** — both the sidebar and editor/preview resize handles were using `mousemove`/`mouseup` listeners on `document`, which fail to fire if the pointer is released outside the browser window (e.g. over an iframe); both resizers now use the Pointer Events API (`pointerdown`/`pointermove`/`pointerup`) with `setPointerCapture`/`releasePointerCapture` so release is always received regardless of where the pointer goes
* **`formatCode` declaration eaten by refactor** — a `str_replace` during the Copy button addition accidentally consumed the `function formatCode() {` opening line, orphaning its body as top-level code and causing cascading `ReferenceError`s; declaration restored
* **`···` toolbar button spacing too narrow** — `.toolbar-overflow-wrap` is a `div` and did not inherit the `margin-left: 8px` that `.editor-header button` applies to `button` elements; explicit `margin-left: 8px` added to the wrapper class

## <u>Improvements</u>
* **Case-sensitive global search** — added an **Aa** toggle button next to the global search bar (matches the local search widget behaviour); flag is respected by the search worker, the result highlighter, and global Replace All
* **Debounced file tree re-render on background tab close** — closing a tab that is not the active file now uses a debounced render (80 ms) instead of an immediate full tree rebuild, reducing redundant DOM churn when closing many tabs in sequence
* **Tab Width setting** — Settings modal now includes a Tab Width selector (2 / 4 / 8 spaces) under Appearance; changing it immediately updates the editor indent and `tabSize`; `applySettings` also calls `updateStatusBar()` so the status bar refreshes after any settings change
* **Tab scroll and cursor position restored on switch** — when switching back to an already-open tab the editor restores the exact scroll position and cursor location from when the tab was last active, so you no longer lose your place
* **Refactored fileTree.js** -- fileTree.js is now refactored into smaller subcomponents in `js/filetree/`. References are added to `index.html`
* **Toolbar overflow menu** — the editor toolbar was growing too wide; less-frequently-used actions (Download File, Format Code, Go to Line…, Copy Contents, Save All, Download Project, Close All Tabs) are now grouped behind a `···` button that opens a compact dropdown, keeping the primary toolbar to four buttons (≡, New Tab, Save, Find/Replace); keyboard shortcuts are shown inline in the menu
* **Format code expanded language support** — `formatCode` now covers TypeScript (`text/typescript`), TSX (`text/typescript-jsx`), JSX (`text/jsx`) via Prettier's TypeScript parser, and GraphQL via Prettier's GraphQL parser; `parser-typescript.js` and `parser-graphql.js` are loaded from the Prettier CDN; LaTeX has a dedicated native formatter (see Additions)
* **LaTeX formatter extracted to own module** — `formatLatex` moved from `editor.js` into `js/formatLatex.js` so it can grow independently; loaded before `editor.js` in `index.html`

## <u>Additions</u>
* **File templates on new file** — creating a new file via the tree input auto-populates language-appropriate boilerplate (HTML doctype, JSON braces, shell shebang, Rust/Go/C/Java stubs, Vue/Svelte scaffolding, etc.) for 25+ extensions; controlled by a new **File Templates on New File** toggle in Settings → Editor (default on)
* **Duplicate file** — file tree context menu now includes a **Duplicate** option for files; creates `filename_copy.ext` (or `filename_copy2.ext`, etc.) in the same folder, opens the duplicate, and marks it unsaved
* **Save All** (`Ctrl+Shift+S`) — saves every open non-untitled tab that has unsaved changes in one action; available via keyboard shortcut, the **Save All** entry in the tab right-click context menu, and the command palette
* **Reveal in Tree** — tab right-click context menu includes **Reveal in Tree** for non-untitled files; expands the File Explorer sidebar section if collapsed, expands all ancestor folders, re-renders the tree, and scrolls the entry into view
* **Word count in status bar** — when editing a Markdown or plain-text file the status bar shows a live word count (e.g. `| 312 words`) between the line/column segment and the byte size
* **Drag-and-drop in file tree** — any file or folder (except root) can be dragged onto another node; dropping onto a folder moves the entry into that folder; dropping onto a sibling within the same folder reorders it to that position; cross-folder moves update all open tabs, recent files, and current working directory; the dragged node dims and the drop target highlights in accent colour
* **Sort by Extension** — folder context menu and bare-tree background context menu include **Sort by Extension**, which re-orders that folder's children with folders first, then files grouped by extension alphabetically, then by name within each group; also available in the command palette as "Sort Root by Extension"
* **Expand All** — mirrors **Collapse All**; recursively expands every folder in the tree; available in the folder context menu, bare-tree background context menu, and command palette
* **Bare-tree background context menu** — right-clicking the file tree panel outside any file or folder node opens a lightweight context menu with New File, New Folder, Expand All, Collapse All, and Sort by Extension
* **LaTeX (`.tex`) support** — syntax highlighting via CodeMirror's `stex` mode; live preview rendered in the preview pane using KaTeX (loaded on demand inside the iframe's `srcdoc`) with support for math environments (`equation`, `align`, `gather`), sectioning commands, inline formatting, `itemize`/`enumerate`/`description` lists, `tabular`, `verbatim`, `\footnote`, `\href`, and title/author/date metadata; native formatter in `js/formatLatex.js` normalises blank lines and indents `\begin{}`/`\end{}` blocks; `.tex` and `.bib` added to the icon map (📐 and 📚), mode map, file templates, and drag-and-drop text allowlist
* **Copy Contents button** — toolbar `···` menu includes **Copy Contents**, which copies the full editor text to the clipboard as plain text via the Clipboard API
* **Rename Root** -- Root folder (after which the zip is named) is now renamable. Internally paths are still treated as root/ despite rename.


