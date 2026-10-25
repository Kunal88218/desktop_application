# Testing & Troubleshooting Guide

This guide provides automated test instructions, manual quality assurance procedures, troubleshooting guidance, and bug reporting steps for Desktop Productivity Manager.

---

## 1. Automated Testing

The automated test suite runs in standard Node.js without requiring third-party testing frameworks or GUI display servers.

### Run the Complete Test Suite
```bash
npm test
```

### Individual Test Suites

| Command | Suite Name | Coverage |
|---|---|---|
| `node test/storage.test.js` | Storage & Persistence | Schema enforcement, missing fields, type coercion, duplicate ID resolution, bounds clipping, missing file initialization, empty files, corrupted JSON fallback, atomic-write recovery. |
| `node test/ipc.test.js` | Secure IPC Communication | Sender frame validation (`isValidSender`), blocking remote/untrusted protocols (`https`, `http`, `ftp`, `data`, `blob`), missing frame rejection, payload validation on all channels. |
| `node test/dialogs.test.js` | Native Desktop Integrations | Export serialization, import validation and ID collision avoidance, export/import cancellation, disk write errors, notification fallbacks, quick-add duplicate prevention, menu accelerators. |
| `node test/error-handling.test.js` | User-Facing Error Handling | Private file path stripping (Unix & Windows), Node error code removal, stack trace omission, pattern-to-message mapping, button loading state reset, toast debouncing. |
| `node test/security-hardening.test.js` | Security & Regression Audit | HTML Content Security Policy (`default-src 'self'`, `script-src 'self'`), Preload isolation audit, BrowserWindow security preferences (`contextIsolation`, `nodeIntegration: false`, `sandbox`), `will-navigate` locks, task regression. |
| `node test/smoke-check.js` | Electron Smoke Check | Headless application launch, window creation, preload binding, primary window load event assertion, clean shutdown. |

---

## 2. Manual Verification Checklist

Certain native OS integrations (native file dialogs, system menus, desktop notifications) require verification on a running desktop environment.

### A. Task CRUD & Local Persistence
1. **Launch App**: Run `npm start`.
2. **Create Task**:
   - Click `+ New Task` in the top right.
   - Enter a title (e.g. `"Prepare Milestone 8 Report"`), description, set priority to `High`, and choose a due date.
   - Click `Save Task`. Confirm the task card appears at the top of the list with a red `HIGH` badge.
   - Verify Total Tasks counter increments.
3. **Toggle Completion**:
   - Click the checkbox on the task card.
   - Confirm card visually updates to completed style (dimmed, strikethrough title).
   - Check the `Completed` counter increments and `In Progress` decrements.
4. **Edit Task**:
   - Click the pencil (`✏️`) icon.
   - Modify the title or priority and click `Save Task`.
   - Confirm changes reflect immediately.
5. **Delete Task**:
   - Click the trash (`🗑️`) icon.
   - Confirm card is removed and metrics update.
6. **Persistence Test**:
   - Quit the application (`Cmd+Q` on macOS, or close window on Windows/Linux).
   - Relaunch with `npm start`.
   - Confirm previously saved tasks remain intact.

### B. Search & Filtering
1. **Search**: Type a query into the top search bar. Confirm only matching tasks remain visible. Click `✕` to clear search.
2. **View Filter**: Click `Active` in the sidebar; confirm only uncompleted tasks are shown. Click `Completed`; confirm only completed tasks are shown.
3. **Priority Filter**: Use the Priority dropdown to select `High`; confirm only high-priority tasks display.

### C. Menu Actions & Keyboard Accelerators
1. **Quick-Add (`Cmd+N` or `Ctrl+N`)**:
   - Press the shortcut or select `File -> Quick Add Task...` from the application menu.
   - Confirm the secondary Quick-Add Task window opens.
2. **Export (`Cmd+E` or `Ctrl+E`)**:
   - Press shortcut or select `File -> Export Tasks...`.
   - Confirm native OS Save Dialog opens.
3. **Import (`Cmd+I` or `Ctrl+I`)**:
   - Press shortcut or select `File -> Import Tasks...`.
   - Confirm native OS Open File Dialog opens.

### D. Secondary Quick-Add Window
1. **Open Window**: Click `⚡ Quick Add Window` or press `Cmd/Ctrl+N`.
2. **Duplicate Prevention**: While the Quick-Add window is open, press `Cmd/Ctrl+N` again. Confirm no second window opens; the existing Quick-Add window gains focus.
3. **Escape to Close**: Press `Escape`. Confirm window closes immediately.
4. **Task Submission & Synchronization**:
   - Reopen Quick-Add window.
   - Enter title `"Quick Task From Shortcut"`, select `Low` priority, and click `Add Task`.
   - Confirm button displays `Adding...`, a desktop notification appears, the quick-add window closes, and the main window instantly displays the new task without needing a manual refresh.

### E. JSON Import & Export
1. **Export Tasks**:
   - Click `💾 Export` in header.
   - Select a target location (e.g., `~/Desktop/backup.json`) and save.
   - Confirm success toast: `"Exported X tasks successfully"`.
   - Inspect the file in a text editor to ensure valid JSON containing `{ app, version, exportedAt, taskCount, tasks }`.
2. **Export Cancellation**:
   - Click `💾 Export` and press `Cancel`.
   - Confirm no error is shown and button returns to enabled state.
3. **Import Tasks**:
   - Click `📥 Import` and choose the exported file.
   - Confirm success toast: `"Imported X tasks (Y total)"`.
   - Verify task IDs were deduplicated without overwriting existing tasks.
4. **Malformed Import**:
   - Create a text file with invalid JSON: `{ bad json... }`.
   - Click `📥 Import` and select this file.
   - Confirm error toast: `"Import error: The selected file contains invalid or corrupted JSON data."`.
   - Confirm application does not crash and existing tasks remain untouched.

### F. Desktop Notifications
1. Mark a task as completed or submit a quick-add task.
2. Confirm an OS desktop notification banner appears with the task title.
3. If notifications are disabled in OS settings, confirm the app logs a clean fallback warning without throwing uncaught exceptions.

---

## 3. Troubleshooting & Common Setup Issues

### Issue 1: Electron Fails to Start Headlessly (`No available display`)
- **Cause**: Running `npm start` on a Linux server without an X11 or Wayland display server.
- **Solution**: For automated headless testing, use `npm test` (which uses headless Electron smoke check flags) or run with `xvfb-run npm start`.

### Issue 2: Notifications Do Not Pop Up on macOS
- **Cause**: macOS Notification Center permissions might be disabled for Terminal, Node, or Electron.
- **Diagnosis**: Open **System Settings -> Notifications -> Terminal / Electron** and ensure "Allow Notifications" is enabled.
- **Fallback**: The application checks `Notification.isSupported()` and logs notification messages to the console if OS permissions are denied.

### Issue 3: Corrupted `tasks.json` File
- **Symptom**: User accidentally edited `tasks.json` with invalid syntax.
- **Recovery Behavior**: The storage engine detects the invalid JSON, logs a warning, loads safe default seed tasks into memory, and leaves the damaged `tasks.json` file on disk for forensics.
- **Manual Reset**: To start fresh, delete the file:
  - macOS: `rm ~/Library/Application\ Support/desktop-productivity-manager/tasks.json`
  - Windows: `del "%APPDATA%\desktop-productivity-manager\tasks.json"`

---

## 4. Reporting Reproducible Bugs

When filing a bug report, include:
1. **Operating System & Architecture**: e.g. macOS Sonoma 14.5 (Apple Silicon arm64) or Windows 11 x64.
2. **Node.js & Electron Versions**:
   ```bash
   node -v
   npx electron -v
   ```
3. **Steps to Reproduce**:
   - Step 1: Launch application via `npm start`.
   - Step 2: ...
   - Step 3: ...
4. **Expected Behavior**: What should have happened.
5. **Actual Behavior**: What actually occurred (include console logs if available).
6. **Relevant Error Logs**: Check terminal output or the DevTools console (`Cmd+Alt+I` / `Ctrl+Shift+I`).
