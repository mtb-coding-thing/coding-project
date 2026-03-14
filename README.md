# CodeEdit User Guide

CodeEdit is a fully open-source, portable, persistent, and lightweight code editor built mainly in JS that runs entirely within your web browser.

## 📂 Project & File Management
*   **New Project**: Resets the current environment and starts a fresh project.
*   **Open Directory**: Use the **Open Directory** button to load an entire folder structure into the editor. Your browser will keep these files in its local storage database.
*   **File Explorer**: The collapsible **File Explorer** panel on the left lets you navigate your project.
    *   **Right-click** any file or folder to access context menus for Renaming, Deleting, Creating new sub-items, Copying the path, and downloading a folder as a ZIP.
    *   **Root**: Right-click the root folder to rename the project, collapse/expand all folders, or sort files by extension.
    *   **Drag and Drop**: You can drag files or folders directly into the sidebar to import them into your workspace. You can also drag items within the explorer to reorder or move them (this also updates their paths). A blue insert-line indicator shows exactly where the item will land.
*   **Recent Files**: A collapsible **Recent Files** panel above the File Explorer tracks the last 20 files you opened. Click any entry to reopen it; click `×` to remove it from the list. Recent files are persisted across sessions.
*   **Downloading**: Click **Download Project** to zip your current workspace and save it to your computer. Right-click any folder in the tree and choose **Download Folder** to zip just that subtree. (Note: Windows may flag the downloaded zip — right-click it, open Properties, then click 'Unblock'.)

## ✍️ The Editor
*   **Tabs**: Manage multiple open files at the top of the editor pane.
    *   Right-click a tab for a context menu with options including "Close others," "Close all," and Rename (which renames the file in the explorer as well).
    *   An asterisk (`*`) indicates unsaved changes.
    *   Warnings appear when attempting to close a tab with unsaved changes.
    *   **Pin tabs** by right-clicking and selecting Pin — pinned tabs show a coloured top border and stay anchored to the left.
    *   Use `Ctrl+Tab` / `Ctrl+Shift+Tab` to cycle between open tabs.
*   **Local Search & Replace**: Press `Ctrl+F` (Find) or `Ctrl+H` (Replace) to open the floating widget in the top-right of the editor.
    *   Click the **Aa** button (or press `Alt+C` while the widget is open) to toggle **case-sensitive** matching.
    *   Search matches are annotated as yellow tick marks on the scrollbar so you can see their distribution across the whole file at a glance.
*   **Global Search & Replace**: Use the top header input fields to search across **every file in your project**. Click **Replace All** to perform a project-wide replacement.
*   **Breadcrumb**: Beneath the tabs is the full filepath to the current file. Click the filename to copy the path to your clipboard. Folder segments are clickable and update the current working directory.
*   **Go to Line / Column**: Press `Ctrl+G` (or click the `Ln/Col` indicator in the status bar) to jump to a specific line. Enter a line number (e.g. `42`) or a `line:column` pair (e.g. `42:10`).
*   **Formatting**: Use the **Format** button or `Ctrl+Shift+F` to automatically clean up your code using Prettier. Supported languages include JS, TS, JSX, TSX, CSS, HTML, JSON, Markdown, and GraphQL.
*   **Word Wrap**: Toggle word wrap from the `···` overflow menu in the toolbar. The current state is indicated by a checkmark.
*   **Diff Viewer**: Click the **Diff** button to open a side-by-side view of your unsaved changes vs. the last saved state. Edits made in the right (modified) pane are reflected back in the main editor.
*   **Auto-Save on Focus Loss**: Enable in Settings to automatically save the active file whenever you switch away from the browser tab.
*   **Timed Auto-Save**: Enable in Settings to automatically save all unsaved files on a configurable interval (minimum 5 seconds).
*   **Copy Contents**: Available in the `···` overflow menu — copies the full contents of the current file to the clipboard.
*   **Save All**: Available in the `···` overflow menu or via `Ctrl+Shift+S` — saves every open file with unsaved changes at once.
*   **Minimap**: A canvas-based minimap sits to the right of the editor. Click anywhere on it to jump to that position, or drag the viewport band to scroll.

## 🎨 Appearance & Themes
*   **Theme**: Choose from five editor themes in Settings — **Dark (Monokai)**, **Dracula**, **Solarized Dark**, **Solarized Light**, and **Light**. Each theme has a unique feel.
*   **Bracket Colorization**: Matching bracket pairs are coloured by nesting depth (three cycling colours). Can be toggled in Settings.
*   **Font**: The editor uses Fira Code with fallbacks to Consolas and Monaco for ligature and monospace rendering.

## 🚀 Command Palette
Can't remember a shortcut?
*   **Open**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
*   **Usage**: Type to filter through available commands (e.g., "save," "new," "format," "goto"). Use arrow keys to navigate and `Enter` to execute. Press `Esc` to close.

## 👁️ Preview Mode
Click the **Preview** button to enable the split-pane preview.
*   **Markdown**: Automatically renders headers, formatting, blockquotes, tables, and code blocks.
*   **HTML**: Renders the raw HTML content in real-time. (Linked external CSS/JS files are not resolved.)
*   **LaTeX**: `.tex` and `.bib` files render a live KaTeX preview. Math, sections, lists, and common environments are supported.

## 🛠️ Workspace Isolation
Because CodeEdit persists your work in your browser's database, you may want to separate different projects. To do this:
1.  Open `js/globals.js`.
2.  Update the `VERSION` constant (e.g. `"0.2.3"` or any other string). The page title will reflect this version.
3.  The editor will treat this as a completely separate workspace, isolating files, tabs, and session state from any other version.

## ⌨️ Keyboard Shortcuts Reference

| Action | Shortcut |
| :--- | :--- |
| **Open Command Palette** | `Ctrl + Shift + P` |
| **Save Current File** | `Ctrl + S` |
| **Save All Files** | `Ctrl + Shift + S` |
| **New File** | `Ctrl + Shift + N` |
| **New Folder** | `Ctrl + Shift + D` |
| **New Untitled Tab** | `Ctrl + N` |
| **Close Tab** | `Ctrl + W` |
| **Cycle Tabs Forward** | `Ctrl + Tab` |
| **Cycle Tabs Backward** | `Ctrl + Shift + Tab` |
| **Format Document** | `Ctrl + Shift + F` |
| **Find in File** | `Ctrl + F` |
| **Replace in File** | `Ctrl + H` |
| **Toggle Case Sensitive (Find)** | `Alt + C` (widget open) |
| **Go to Line / Column** | `Ctrl + G` |
| **Toggle Comment** | `Ctrl + /` |
| **Global Search Focus** | `Ctrl + Shift + G` |

## ⚠️ Known Limitations
1. No console or compiler yet
2. Binary files, videos, and certain unsupported formats are currently unsupported.

---
*Pro-Tip: CodeEdit is persistent. If you close your browser tab and come back later, your files, folders, open tabs, and recent file history will be exactly where you left them.*
