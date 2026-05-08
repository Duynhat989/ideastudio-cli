# IdeaStudio

IdeaStudio is an Electron desktop app with a Vue 3 renderer for AI workflow creation, media generation, timeline editing, and final video rendering.

## Tech Stack

- Electron 31
- Vue 3 + Vite
- Express (local API server in main process runtime)
- FFmpeg / FFprobe via `ffmpeg-static` and `ffprobe-static`
- Electron Builder (NSIS / DMG / AppImage-DEB packaging)

## Project Structure

```text
IdeaStudio/
├─ index.js                    # Electron main process bootstrap
├─ config.js                   # Runtime path strategy (dev vs packaged)
├─ preload.js                  # Preload bridge
├─ package.json                # Build scripts and electron-builder config
├─ build/
│  └─ installer.nsh            # NSIS custom uninstall prompt
├─ scripts/
│  └─ bump-version.js          # Auto bump patch version before build
├─ src/
│  ├─ routes/                  # Express routes
│  └─ services/                # Project / render / meta backend services
├─ metadata/                   # Dev-only local metadata/static endpoint files
└─ view/                       # Vue renderer app
   ├─ package.json
   ├─ vite.config.js
   └─ src/
```

## Environment Requirements

- Node.js 20+
- npm 10+
- Windows/macOS/Linux for development

## Install Dependencies

At repo root:

```bash
npm install
```

In renderer app:

```bash
cd view
npm install
```

Optional environment in `view/.env`:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Run in Development

Use 2 terminals.

Terminal A (renderer):

```bash
cd view
npm run dev
```

Terminal B (Electron):

```bash
cd ..
npm start
```

Electron app runs with `--dev` and loads `http://localhost:5173`.

## Build & Packaging

> Note: each build command bumps patch version automatically via `scripts/bump-version.js`.

- Windows:

```bash
npm run build:win
```

- macOS:

```bash
npm run build:mac
```

- Linux:

```bash
npm run build:linux
```

- All targets:

```bash
npm run build:all
```

### Important Cross-Platform Notes

- Build macOS targets on macOS.
- Linux AppImage/DEB should be built on Linux (or CI Linux runners).
- On Windows local machine, prefer `npm run build:win`.

## Runtime Data Location

The app stores runtime data in a user-writable directory (not beside `.exe` in packaged mode):

- Dev mode: `<repo>/metadata`
- Packaged mode: `app.getPath('userData')/metadata`

Main data folders:

- `metadata/resources` - projects/assets
- `metadata/renders` - rendered videos
- `metadata/config.json` - app runtime config
- `metadata/version.json` - app metadata/version payload

## Uninstall Behavior (Windows NSIS)

During uninstall, the installer asks whether to remove user data:

- Yes -> delete `%APPDATA%\IdeaStudio`
- No -> keep data

Configured via `build/installer.nsh`.

## Auto Versioning

Patch version increases on each build command:

- `2.1.14 -> 2.1.15`

The same version is synced into `metadata/version.json`.

## Useful Scripts

- `npm start` - run Electron in dev mode
- `npm run version:bump` - bump patch version only
- `npm run build:win` - build Windows installer
- `npm run dist` - alias to Windows build

## Troubleshooting

- If build fails for mac target on Windows: run only `npm run build:win`.
- If Linux AppImage fails on Windows symlink permission: build Linux target on Linux runner.
- If static media tools fail, reinstall root deps to ensure `ffmpeg-static` and `ffprobe-static` are present.
