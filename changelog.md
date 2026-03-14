# Changes in v0.3.1

## Bugfixes
- soon

## Improvements
- soon

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
