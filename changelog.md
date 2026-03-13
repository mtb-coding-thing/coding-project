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

## Additions
- `js/minimap.js` — canvas minimap (previously present but inactive; now loaded and initialised)
- `js/latex.js` — LaTeX preview renderer extracted from `layout.js` (added in v0.3.1 initial fix)
- `bracketColorization` setting added to defaults and Settings UI
- Added a new breadcrumb path system just beneath the tabs.

