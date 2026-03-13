# CodeEdit User Guide

CodeEdit is a fully open-source, portable, persistent, and lightweight code editor built mainly on JS that runs entirely within your web browser. 

## 📂 Project & File Management
*   **New Project**: Resets the current environment and starts a fresh project.
*   **Open Directory**: Use the **Open Directory** button to load an entire folder structure into the editor. Your browser will keep these files in its local storage database.
*   **File Explorer**: The collapsible **File Explorer** panel on the left lets you navigate your project.
    *   **Right-click** any file or folder to access context menus for Renaming, Deleting, Creating new sub-items, Copying the path, and downloading a folder as a ZIP.
    *   **Drag and Drop**: You can drag files or folders directly into the Sidebar to import them into your workspace.
*   **Recent Files**: A collapsible **Recent Files** panel above the File Explorer tracks the last 20 files you opened. Click any entry to reopen it; click `×` to remove it from the list. Recent files are persisted across sessions.
*   **Downloading**: Click **Download Project** to zip your current workspace and save it to your computer. Right-click any folder in the tree and choose **Download Folder** to zip just that subtree. (Be careful since Windows' aggressive protection might block the unzip — right-click the zip, click Properties, then click 'Unblock'.)

## ✍️ The Editor
*   **Tabs**: Manage multiple open files at the top of the editor pane.
    *   Right-click a tab for a context menu showing options incl. "Close others," "Close all," & Rename (which renames the file in the explorer as well).
    *   An asterisk (`*`) indicates unsaved changes.
    *   Warnings exist when attempting to exit a tab with unsaved changes.
    *   Use `Ctrl+Tab` / `Ctrl+Shift+Tab` to cycle between open tabs.
*   **Local Search & Replace**: Press `Ctrl+F` (Find) or `Ctrl+H` (Replace) to open the floating widget in the top-right of the editor.
    *   Click the **Aa** button (or press `Alt+C` while the widget is open) to toggle **case-sensitive** matching.
    *   Search matches are annotated as yellow tick marks on the scrollbar so you can see their distribution across the whole file at a glance.
*   **Global Search & Replace**: Use the top header input fields to search across **every file in your project**. Click "Replace All" to perform a project-wide search and replace.
*   **Go to Line / Column**: Press `Ctrl+G` (or click the `Ln/Col` indicator in the status bar, or use the **Go to…** button) to jump to a specific line. Enter just a line number (e.g. `42`) or a `line:column` pair (e.g. `42:10`).
*   **Formatting**: Use the "Format" button or `Ctrl+Shift+F` to automatically clean up your code structure using Prettier.
*   **Diff Viewer**: Click the **Diff** button to open a side-by-side view of your unsaved changes vs. the last saved state. Edits made in the right (modified) pane are reflected back in the main editor.
*   **Auto-Save on Focus Loss**: Enable **Auto-Save on Focus Loss** in Settings to automatically save the active file whenever you switch to another application or browser tab.

## 🚀 Command Palette
Can't remember a shortcut? 
*   **Open**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
*   **Usage**: Type to filter through available commands (e.g., "save," "new," "format," "goto"). Use arrow keys to navigate and `Enter` to execute.

## 👁️ Preview Mode
Click the **Preview** button to enable the split-pane view. 
*   **Markdown**: Automatically renders headers, formatting, blockquotes, tables, and code blocks.
*   **HTML**: Renders the raw HTML content in real-time. (No support yet for loading CSS/JS in other linked files)
*   **LaTeX**: LaTeX document rendering will be added in the latest version (still testing)

## 🛠️ Managing Versions (Workspace Isolation)
Because CodeEdit persists your work in your browser's database, you may want to separate your "Working" version from your "Stable" version (assuming you're editing it).
1.  Open `js/globals.js`.
2.  Update the `VERSION` constant (e.g., `"0.2.3"`).
3.  The editor will treat this as a completely separate workspace, ensuring your files, tabs, and session state are isolated from other versions.

## ⌨️ Keyboard Shortcuts Reference

| Action | Shortcut |
| :--- | :--- |
| **Open Command Palette** | `Ctrl + Shift + P` |
| **Save Current File** | `Ctrl + S` |
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

---
*Pro-Tip: CodeEdit is persistent. If you close your browser tab and come back later, your files, folders, open tabs, and recent file history will be exactly where you left them. (Assuming nothing else broke)*
