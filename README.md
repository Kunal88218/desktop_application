# Desktop Productivity Manager

An Electron-based desktop productivity and task management application built with secure multi-process architecture, persistent local storage, native OS integrations, and strict context isolation.

---

## 1. Project Overview & Problem Statement

Productivity applications frequently suffer from two common design flaws:
1. **Web-only limitations**: Web applications cannot integrate seamlessly with operating system file dialogs, native application menus, or secondary quick-entry windows.
2. **Insecure desktop wrappers**: Naive Electron applications often disable security primitives (e.g., setting `nodeIntegration: true` or `contextIsolation: false`), which exposes the host machine to Remote Code Execution (RCE) and filesystem vulnerabilities if untrusted input is processed.

**Desktop Productivity Manager** demonstrates an enterprise-grade desktop productivity solution that pairs a responsive, zero-framework productivity dashboard with Electron's modern security recommendations:
- Zero Node.js exposure in the renderer processes (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`).
- Strictly typed and validated inter-process communication (IPC) through a minimal `contextBridge` preload layer.
- Atomic local file persistence (`tasks.json` in Electron's `userData` directory) resilient against disk and corruption failures.
- Native operating system integrations including system menus with accelerators, desktop notifications, native file import/export dialogs, and a dedicated Quick-Add secondary window.

---

## 2. Feature Set

### 📋 Task Management & Productivity Dashboard
- **Full CRUD operations**: Create, read, update, complete, and delete tasks.
- **Dynamic filtering**: Switch between All Tasks, Active Tasks, and Completed Tasks via sidebar navigation and filter pills.
- **Priority tagging**: Categorize tasks as `Low`, `Medium`, or `High` priority with color-coded status badges.
- **Live Search**: Client-side full-text search across task titles and descriptions with instant clear actions.
- **Metrics summary**: Real-time counter cards tracking Total Tasks, In Progress, Completed, and High Priority items.
- **Due dates & overdue indicators**: Date picker input with visual alerts for overdue items.

### 💾 Robust Local Persistence
- **Atomic File Writes**: Writes data to a temporary file (`tasks.json.tmp`) before renaming it to `tasks.json`, preventing partial or corrupted write states during sudden terminations.
- **Standardized userData storage**: Stores tasks in the OS-standard application data path (`app.getPath('userData')/tasks.json`).
- **Corruption Resilience & Emergency Fallback**: Automatically validates JSON on load. If corrupted or malformed, falls back safely to default seed tasks without overwriting or destroying the damaged file on disk.
- **Strict Schema Enforcement**: Discards invalid primitives, truncates excessively long strings, normalizes priorities, and ensures unique IDs even when imported data contains collisions.

### 🛡️ Secure Inter-Process Communication (IPC)
- **Origin Validation**: `isValidSender` verifies every IPC invocation originated from authorized `file://` or `devtools://` frames, rejecting remote or unauthorized origins.
- **Payload Validation**: IPC handlers validate payload types (arrays, objects, strings) and reject malformed inputs before reaching business logic.
- **Isolated Renderer**: Preload script exposes a tightly scoped `window.electronAPI` bridge. The renderer has zero direct access to `ipcRenderer`, Node.js built-ins (`fs`, `child_process`), or shell commands.

### 🖥️ Native Desktop Integrations
- **Application Menu**: Platform-aware desktop menu (macOS app menu and File, Edit, View, Window, Help menus) with keyboard shortcuts:
  - `CmdOrCtrl+N`: Open Quick-Add Task window.
  - `CmdOrCtrl+E`: Export Tasks to a JSON file.
  - `CmdOrCtrl+I`: Import Tasks from a JSON file.
- **Native Secondary Window (Quick-Add)**: Lightweight modal-style window for quick task entry:
  - Prevents duplicate windows by focusing the existing window if already open.
  - Automatically synchronizes newly created tasks to the main window via IPC broadcast (`tasks:sync`).
  - Closes cleanly via `Escape` key or Cancel button.
- **File Dialogs (Import & Export)**:
  - Native save dialog (`dialog.showSaveDialog`) to export structured JSON backup.
  - Native open dialog (`dialog.showOpenDialog`) to import external JSON files with automatic ID collision remapping.
- **Desktop Notifications**: Uses Electron's native `Notification` API with environment checks (`Notification.isSupported()`) and graceful fallbacks when notifications are denied or unsupported.

### ⚡ User-Facing Error Handling
- **Sanitized Errors**: Private absolute file paths, internal Node error codes (`ENOENT`, `EACCES`), and multi-line stack traces are sanitized before displaying to users.
- **Control State Recovery**: Action buttons (Export, Import, Quick-Add) properly restore loading states (`disabled = false`) even when requests fail or are cancelled.
- **Notification Deduplication**: Rapid, repeated error notifications are debounced to avoid flooding the user interface.

---

## 3. Technology Stack

- **Runtime & Desktop Framework**: Electron 45 (`^45.0.0`)
- **Execution Environment**: Node.js (`v24.x`)
- **Rendering Engine**: Chromium (sandboxed)
- **Frontend Architecture**: Vanilla HTML5, CSS3, JavaScript (ES6+, zero third-party UI framework dependencies)
- **Testing**: Node.js native `assert` runner & headless Electron smoke test

---

## 4. Architecture

The application strictly implements Electron's recommended **multi-process separation of concerns**:

```
+-------------------------------------------------------------------------+
|                              Main Process                               |
| (Node.js runtime, full OS access, window orchestration, native dialogs) |
|                                                                         |
|  • src/main/main.js          - App lifecycle, primary & quick-add window|
|  • src/main/ipc.js           - IPC handler registration & origin checks |
|  • src/main/storage.js       - Atomic file I/O & schema validation      |
|  • src/main/dialogs.js       - Native import/export file pickers        |
|  • src/main/menu.js          - Native application menu & accelerators   |
|  • src/main/notifications.js - Native OS notification management        |
|  • src/main/error-utils.js   - Path stripping & message sanitization    |
+------------------------------------+------------------------------------+
                                     |
                               IPC Channel
                        (invoke / handle / send)
                                     |
+------------------------------------+------------------------------------+
|                         Preload Bridge Layer                            |
|       (src/preload/preload.js - contextBridge.exposeInMainWorld)        |
|                                                                         |
|  • Exposes window.electronAPI with strictly scoped wrapper methods      |
|  • Protects raw ipcRenderer, Node.js APIs, and filesystem access        |
+------------------------------------+------------------------------------+
                                     |
                       Isolated Renderer Contexts
                     (contextIsolation: true, sandbox: true)
                                     |
+------------------------------------+------------------------------------+
|                        Renderer Process (UI)                            |
|                                                                         |
|  Primary Dashboard Window:          Secondary Quick-Add Window:         |
|  • src/renderer/index.html          • src/renderer/quick-add.html       |
|  • src/renderer/renderer.js         • src/renderer/quick-add.js         |
|  • src/renderer/styles.css          • (Lightweight form & quick sync)   |
+-------------------------------------------------------------------------+
```

---

## 5. Prerequisites & Installation

### Prerequisites
- **Node.js**: `v20.x` or higher (verified on Node.js `v24.x`)
- **npm**: `v10.x` or higher
- **Operating System**: macOS (tested on macOS Sonoma / Darwin arm64) or Windows 10/11 / Linux (with X11/Wayland display server)

### Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Kunal88218/desktop_application.git
cd desktop_application
npm install
```

---

## 6. Running the Application

To launch the desktop application:
```bash
npm start
```

This starts Electron and opens the main Productivity Dashboard window. You can press `CmdOrCtrl+N` to open the Quick-Add window, `CmdOrCtrl+E` to export tasks, or `CmdOrCtrl+I` to import tasks.

---

## 7. Running the Automated Test Suite

The test suite runs headlessly without requiring external testing frameworks or graphical display servers:

```bash
npm test
```

### Test Suite Breakdown
1. `node test/storage.test.js`:
   - Validates `validateTasks()` schema enforcement, bounds clipping, missing fields, type coercion, and duplicate ID resolution.
   - Tests file I/O, missing file initialization, empty file handling, corrupted JSON fallback, and atomic write recovery in temporary directories.
2. `node test/ipc.test.js`:
   - Tests `isValidSender()` origin protection (allows `file://` and `devtools://`, rejects `https://`, `http://`, `ftp://`, `data:`, `blob:`, missing frames).
   - Audits all registered IPC handlers for authorization and payload validation.
3. `node test/dialogs.test.js`:
   - Tests export payload serialization and import collision avoidance.
   - Tests dialog cancellation paths, file read/write errors, and malformed import JSON.
   - Tests native notification fallback when unsupported or when the OS denies permissions.
   - Verifies duplicate-window prevention logic and application menu keyboard accelerators.
4. `node test/error-handling.test.js`:
   - Verifies sanitization of absolute private paths (Unix and Windows), Node OS error codes, and stack traces.
   - Verifies button state recovery on failure and toast notification debouncing.
5. `node test/security-hardening.test.js`:
   - Audits HTML Content Security Policy (`default-src 'self'`, `script-src 'self'`).
   - Audits Preload script to guarantee no raw `ipcRenderer` or Node built-ins are exposed.
   - Audits `BrowserWindow` configurations (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `will-navigate`, and `setWindowOpenHandler`).
6. `node test/smoke-check.js`:
   - Launches a real Electron instance headlessly, verifies window load and preload binding, tests IPC round-trip, and terminates cleanly with exit code 0.

---

## 8. Implemented Features vs. Known Limitations

### Implemented Features
- Fully functional local task management with live metrics, search, and priority sorting.
- Multi-window orchestration with parent-child window relationships and state synchronization.
- Native menus with cross-platform accelerators (`CmdOrCtrl+N/E/I`).
- Native JSON export and import with collision avoidance.
- Native desktop notifications with fallback detection.
- Complete IPC input validation, origin verification, and sandboxed rendering.
- Robust error sanitization preventing path exposure or frozen UI buttons.

### Known Limitations
- **Single-User / Local Storage**: Tasks are stored locally in the user's `userData` directory. There is currently no cloud synchronization or multi-device account sync.
- **Headless Notification Display**: OS-level notification popups depend on the operating system's desktop notification center permissions. In headless CI environments, notifications gracefully fall back to log messages.
- **Import Format**: The import feature currently expects structured JSON arrays or objects containing a `tasks` array. CSV or third-party formats (e.g. Todoist, Trello) are not supported out of the box.
- **Platform Window Framing**: Application window styling uses native platform borders; custom frameless titlebars are not currently implemented.
