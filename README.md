# NovaOS 4

A local-first desktop for the browser. Files, notes, projects, development tools, and media share one workspace, with 23 built-in apps and three customizable spaces.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4187. The build bundles CSS, CodeMirror, and the Markdown renderer, copies PDF.js and its worker/fonts, and prepares `dist/`. Dependencies are served locally; the app does not load libraries from third-party CDNs.

## What changed in version 4

| Area         | Behavior                                                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop      | Consistent surfaces, typography, controls and icons; light/dark appearance; compact density; calmer default wallpaper; optional Orbit wallpaper and globe                                                                   |
| Windows      | Multiple Files, Code, PDF, Images and Terminal windows; session restoration; persistent workspace placement; snapping and floating restoration; adjustable paired splits; saved layouts; dock previews; mobile app switcher |
| Widgets      | Move widgets with their grip; resize positioned widgets from the bottom-right corner; reset positions from Saved layouts                                                                                                    |
| Files        | Grid/list views, search/sort, previews, multiselect, copy/cut/paste, move/duplicate, drag-and-drop import/move, downloads, Trash and restore                                                                                |
| Notes        | Folders, tags, document tabs, Markdown formatting/read mode, linked file attachments, export, automatic saving                                                                                                              |
| Projects     | Tasks and Board share records; priorities, due dates, projects, descriptions and subtasks; tasks also appear on Calendar                                                                                                    |
| Calendar     | Month/week/agenda, draggable events and due tasks, daily/weekly/monthly recurrence with optional end date                                                                                                                   |
| Focus        | Link a task, run persistent sessions, review completed session history                                                                                                                                                      |
| Code         | Locally bundled CodeMirror, tabs, file tree, search/replace, syntax highlighting, recovery drafts and isolated live previews                                                                                                |
| PDF          | Locally bundled PDF.js, page navigation, zoom/fit, thumbnails, text search and saved reading position                                                                                                                       |
| Images/Paint | Image pan/zoom/rotate/crop with save-copy; pointer drawing, shapes, undo/redo, automatic draft and PNG export                                                                                                               |
| Music        | Imported audio, queues, playlists, shuffle/repeat, remembered track/position, desktop controls and browser Media Session integration                                                                                        |
| Camera       | Camera/device selection after permission, mirror, capture, review and save to Pictures                                                                                                                                      |
| Browser      | Saved tabs, navigation history, bookmarks, external-open action and embedding limitations shown in the interface                                                                                                            |
| Terminal     | Virtual filesystem commands, copy/move, filename search, Trash restore, autocomplete and saved history                                                                                                                      |
| Calculator   | Scientific functions, angle mode, factorial/powers, safe expression parser, saved history                                                                                                                                   |
| Games        | Shared visual styling, saved profile scores, Snake speed/touch controls, Minesweeper touch flag mode and best times, resumable 2048                                                                                         |
| Offline      | Versioned service-worker precache of bundled apps/assets; update prompt instead of immediately replacing running code                                                                                                       |

## Data and migration

Each browser-local profile stores application state in IndexedDB. Imported binary file contents are stored as blobs. Small profile selection and lock preferences remain in localStorage. Existing version 3 profile data migrates on startup; the legacy profile key is removed only after an IndexedDB transaction succeeds. Existing Board cards migrate into shared task records once.

The working file tree is kept in memory while the app is open and hydrated from IndexedDB at startup. Saves are asynchronous and serialized. Save status appears on the desktop. An unsaved-change browser prompt protects pending writes when leaving the page.

**Settings → System → Export** downloads a JSON backup containing the current profile, including file contents. Import validates the backup before replacing that profile. Export before changing domains or browsers, clearing site data, or performing a reset. Browser storage remains subject to browser quota and retention policies. Profiles and the convenience lock screen do not encrypt your content.

The `clear.html` recovery page can refresh the service-worker cache without erasing user files. Its separate destructive action clears IndexedDB and localStorage after confirmation; close other NovaOS tabs before using it.

## Shortcuts

| Shortcut                 | Action                                                |
| ------------------------ | ----------------------------------------------------- |
| Ctrl/Cmd + Space         | App launcher                                          |
| Ctrl/Cmd + K             | Search apps, files, notes, tasks, events and commands |
| Ctrl/Cmd + Shift + O     | Window overview                                       |
| Ctrl/Cmd + Shift + 1/2/3 | Switch workspace                                      |
| Ctrl/Cmd + Shift + D     | Show desktop                                          |
| Ctrl/Cmd + backtick      | Cycle open windows                                    |
| Shift-click a dock icon  | New window for supported apps                         |
| Ctrl/Cmd + S             | Save in Code                                          |
| Ctrl/Cmd + F             | Find in Code                                          |
| Ctrl/Cmd + A/C/X/V       | Select/copy/cut/paste in Files                        |
| F2 / Delete              | Rename / move to Trash in Files                       |

Browser and operating-system shortcuts may take precedence. Visible alternatives are available.

## Validation

```sh
npm run build
npm run check
npm test
npm run test:e2e
```

Unit tests cover storage/blob round trips and profile isolation, backup validation and failure handling, filesystem copy/move/restore, recurring dates, timer transitions and calculator parsing. The Playwright suite starts its own local server and checks all app mounts, notes, shared tasks, file handoffs, code previews, PDF reading/search, media, image export, drawing, session restoration, mobile layout and offline loading. Screenshots are written to ignored `artifacts/`.

On Linux the test helper uses the packaged Chromium executable with system fonts. On other platforms, install the browser once with `npx playwright install chromium`. Camera permission and physical device behavior still depend on the user's browser and hardware.

## Hosting

`vercel.json` deploys `dist/` after `npm ci` and `npm run build`. Only public runtime assets are copied there; tests, tooling and dependencies are excluded from the deployed site. GitHub Actions runs the build, unit checks and browser workflows.

## Browser boundaries

NovaOS is a browser desktop simulation. It cannot execute native programs or provide an unrestricted system shell. The Browser app uses sandboxed iframes; websites can prohibit embedding and should be opened externally when needed. Code previews run in an iframe without same-origin access, with a restricted content policy. Markdown rendering is sanitized.

There is no server-side account or cross-device synchronization. Music does not autoplay after a page refresh; press Play to resume the remembered track. Monthly recurring events on dates that do not exist in a month are skipped. Editing or dragging a repeating event changes the series. PDF thumbnails are generated for the first 30 pages, while all pages remain navigable and searchable. Camera requires HTTPS/localhost, permission and a supported device. Focus notifications require NovaOS to be running or reopened.

## Project structure

```text
src/core/          Profile storage, filesystem, windows, shared tasks and media
src/ui/            Desktop, menus, dialogs, search, widgets and dock
src/apps/          Built-in applications
src/vendor/        Build entry points for locally bundled dependencies
styles/            Shared desktop and app styles; system.css combines them
scripts/           Build, static server and browser verification
 tests/            Node regression tests
vercel.json        Static hosting configuration
sw.js              Offline cache and update lifecycle
```

CodeMirror, PDF.js, Marked, DOMPurify and esbuild supply the editing, PDF, Markdown and build foundations. Exact dependency versions are recorded in `package-lock.json`.
