# System Architecture & IPC Security

This document outlines the technical architecture, security model, and data flow of Desktop Productivity Manager.

---

## 1. Multi-Process Separation of Concerns

Electron divides application execution across distinct process boundaries:

```
+--------------------------------------------------------------------------+
|                              Main Process                                |
|   • Direct Node.js runtime and full operating system privileges          |
|   • Creates & manages BrowserWindows (Primary & Quick-Add)               |
|   • Atomic persistence to tasks.json in app.getPath('userData')          |
|   • Native OS integrations: Menus, Dialogs, Notifications                |
|   • IPC Handler registration, sender validation & payload sanitization   |
+---------------------+------------------------------+---------------------+
                      |                              |
         Preload Bridge (Main Window)   Preload Bridge (Quick-Add)
      (contextBridge.exposeInMainWorld) (contextBridge.exposeInMainWorld)
                      |                              |
+---------------------+-------+      +---------------+---------------------+
|      Primary Dashboard      |      |          Quick-Add Window           |
|      (Renderer Process)     |      |         (Renderer Process)          |
| • Sandboxed Chromium view   |      | • Sandboxed Chromium modal-style    |
| • Zero Node.js integration  |      | • Zero Node.js integration          |
| • Full CRUD UI & search     |      | • Quick task entry form             |
| • Subscribed to tasks:sync  |      | • Triggers tasks:quick-add IPC      |
+-----------------------------+      +-------------------------------------+
```

### Main Process (`src/main/`)
- **`main.js`**: Application lifecycle orchestrator. Handles startup, window creation, window-all-closed, dock re-activation, and navigation locks (`will-navigate`, `setWindowOpenHandler`).
- **`ipc.js`**: Central IPC handler registration. Validates sender frame origins (`isValidSender`) and payload contracts. Broadcasts state updates across windows.
- **`storage.js`**: Local file I/O using atomic temp-file rename patterns, schema validation (`validateTasks`), and corrupted JSON recovery fallbacks.
- **`dialogs.js`**: Bridges renderer export and import requests to native OS file dialogs (`showSaveDialog`, `showOpenDialog`).
- **`menu.js`**: Builds native macOS and cross-platform desktop application menus with keyboard accelerators (`CmdOrCtrl+N`, `CmdOrCtrl+E`, `CmdOrCtrl+I`).
- **`notifications.js`**: Interfaces with the OS notification daemon (`Notification`), checking `isSupported()` before attempting display.
- **`error-utils.js`**: Sanitizes errors by stripping private paths, raw OS codes, and stack traces before renderer delivery.

### Preload Bridge Layer (`src/preload/preload.js`)
Acts as the secure, isolated intermediary between renderer views and main process APIs:
- Employs `contextBridge.exposeInMainWorld('electronAPI', { ... })`.
- Exposes only explicit, typed function signatures that invoke specific channels.
- Completely shields `ipcRenderer` from the global `window` object so renderer scripts cannot invoke unauthorized channels or inspect private IPC events.
- Encapsulates push event listeners (`onTasksSync`) and provides unsubscription callbacks to prevent memory leaks.

### Renderer Processes (`src/renderer/`)
- **Primary Dashboard (`index.html`, `renderer.js`, `styles.css`)**: Pure client-side UI rendering task lists, priority badges, completion toggles, and live search.
- **Quick-Add (`quick-add.html`, `quick-add.js`)**: Dedicated secondary entry window that submits new tasks via IPC, triggers a desktop notification, and closes upon completion.

---

## 2. IPC Security Architecture

### Origin Validation (`isValidSender`)
Untrusted web content or malicious redirects must never be permitted to execute privileged IPC handlers. Before processing any handler invocation, the main process runs:

```javascript
function isValidSender(event) {
  if (!event || !event.senderFrame || typeof event.senderFrame.url !== 'string') {
    return false;
  }
  const url = event.senderFrame.url.trim();
  if (!url || (!url.startsWith('file://') && !url.startsWith('devtools://'))) {
    return false;
  }
  return true;
}
```

Any request originating from `http://`, `https://`, `data:`, `blob:`, or a missing frame is immediately blocked and logged.

### Payload Schema Validation
Every IPC handler enforces defensive type and structure checking:
- **`tasks:save`**: Rejects non-array payloads immediately (`{ success: false, error: 'Invalid payload: tasks must be an array' }`).
- **`tasks:quick-add`**: Validates that the payload is a non-null object, ensures `title` is a non-empty string capped at 300 characters, normalizes `priority` against allowed enum values (`low`, `medium`, `high`), and sanitizes optional fields before persisting.
- **`app:ping`**: Normalizes `clientTimestamp` to finite numbers or `null`.

### Window Navigation Locks
To prevent unauthorized navigation or malicious page loading:
- `mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))`
- `mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('file://')) event.preventDefault(); })`
- Identical rules are enforced on `quickAddWindow`.

### Content Security Policy (CSP)
Both renderer documents specify a strict CSP meta header:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;">
```
Inline script execution and `eval()` are prohibited.

---

## 3. Storage & Persistence Architecture

### File Location
Tasks are stored locally in the standard application data path resolved via Electron:
```javascript
app.getPath('userData') + '/tasks.json'
```
*(On macOS: `~/Library/Application Support/desktop-productivity-manager/tasks.json`)*

### Atomic Write Pattern
To prevent file corruption caused by crashes, power loss, or interrupted disk writes:
1. Validates and sanitizes tasks in memory using `validateTasks()`.
2. Formats JSON into a temporary file: `tasks.json.tmp`.
3. Renames `tasks.json.tmp` to `tasks.json` atomically via `fs.promises.rename`.
4. If an error occurs, the temporary file is unlinked and the existing `tasks.json` remains intact.

### Corruption Recovery
If `tasks.json` contains malformed JSON or invalid structures upon startup:
- The corrupted file is **not** overwritten or deleted (preserving forensics/data recovery potential).
- The storage system returns a safe emergency fallback (`DEFAULT_TASKS`) with a warning flag (`success: false`).
- The UI displays an informative toast notifying the user that fallback tasks were loaded.

---

## 4. Multi-Window Orchestration & Sync

```
+------------------+         tasks:quick-add          +-------------------+
| Quick-Add Window | -------------------------------> |    Main Process   |
+------------------+                                  +---------+---------+
        |                                                       |
  (Auto-closes)                                          1. Validates & saves
                                                         2. Triggers notification
                                                         3. Broadcasts tasks:sync
                                                                |
                                                                v
                                                      +-------------------+
                                                      |    Main Window    |
                                                      | (Refreshes view)  |
                                                      +-------------------+
```

1. User presses `CmdOrCtrl+N` or clicks "Quick Add Window".
2. Main process checks if `quickAddWindow` exists and is not destroyed:
   - If open: brings it into focus (`quickAddWindow.focus()`), preventing duplicates.
   - If not open: instantiates a new child BrowserWindow.
3. User fills out the quick task form and clicks "Add Task".
4. Renderer invokes `tasks:quick-add` through the preload bridge.
5. Main process validates the task, prepends it to persistent storage, broadcasts `tasks:sync` to all active windows, fires a native notification, and closes `quickAddWindow`.
6. Main window receives `tasks:sync`, updates its internal task state, and re-renders the task list and metric counters automatically.

---

## 5. Native Dialogs: Export & Import

### Export Flow
1. User triggers export (`CmdOrCtrl+E` or Export button).
2. Renderer invokes `tasks:export-dialog`.
3. Main process prompts user via native `dialog.showSaveDialog`.
4. If confirmed, current tasks are serialized with envelope metadata (`app`, `version`, `exportedAt`, `taskCount`, `tasks`) and written to the chosen path.
5. Native desktop notification confirms completion.

### Import Flow
1. User triggers import (`CmdOrCtrl+I` or Import button).
2. Renderer invokes `tasks:import-dialog`.
3. Main process prompts user via native `dialog.showOpenDialog`.
4. File is read and validated. Accepts both wrapped envelope objects (`{ tasks: [...] }`) and flat arrays (`[...]`).
5. **ID Collision Avoidance**: Compares imported task IDs against existing task IDs. Colliding IDs are regenerated with unique IDs (`task-<timestamp>-<hash>`).
6. Merged tasks are saved atomically to `tasks.json`, and `tasks:sync` broadcasts the new list to all windows.
