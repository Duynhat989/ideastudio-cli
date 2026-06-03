# IdeaStudio CLI

> **Turn ideas into video — on your machine.**  
> AI workflow canvas, image & video generation, and a pro render timeline. One command, studio open.

**Official install page:** [idea2vid.com](https://www.idea2vid.com/)

---

## What you get

| | |
|---|---|
| **Workflow Video** | Node-based canvas — Start, AI Chat, image/video gen, loops, preview… then run it all automatically |
| **Gen Image / Gen Video** | Standalone creation studios wired into your flows |
| **Render Editor** | Editor-style timeline: trim, text overlays, export |
| **Runs locally** | Express backend + Vue UI; browser opens automatically on start |

No separate Electron install — just **Node.js** and a terminal.

---

## Quick install

Full guides, downloads, and the latest release:

**[https://www.idea2vid.com/](https://www.idea2vid.com/)**

Install via npm (global):

```bash
npm install -g ideastudio-cli
```

**Requires:** Node.js **≥ 18**

---

## Run the studio

```bash
ideastudio
```

Starts the server, serves the built web UI, and **opens your browser**.  
Sign in, open **Workflow Video**, and start dragging nodes.

---

## CLI commands

| Command | Description |
|---------|-------------|
| `ideastudio` | Run release mode (default) |
| `ideastudio dev` | Dev mode — backend + Vite hot reload |
| `ideastudio stop` | Stop the running instance |
| `ideastudio doctor` | Check runtime status |
| `ideastudio update` | Show the CLI update command |

### Options

```bash
ideastudio --port 1212              # custom server port
ideastudio --port=1212 --no-open    # do not open the browser
```

### Examples

```bash
ideastudio --port 1212
ideastudio stop
ideastudio doctor
```

---

## Stop the app

**Option 1** — In the terminal running `ideastudio`:

```
Ctrl + C
```

**Option 2** — From another terminal:

```bash
ideastudio stop
```

---

## Update

```bash
npm update -g ideastudio-cli
ideastudio
```

Or follow the steps on [idea2vid.com](https://www.idea2vid.com/).

---

## Development (contributors)

Clone the repo, install dependencies, and run dev:

```bash
git clone <repo-url>
cd ideastudio-cli
npm install
npm run dev          # ideastudio dev — hot reload
npm run build        # build frontend → dist/
```

---

## Suggested workflow

```
Idea → Workflow canvas → Gen image/video → Render timeline → Export
```

1. Create a project in **Workflow Video**
2. Connect nodes (input, AI, generation, loops…)
3. Open **Render** to edit the timeline and export
4. Save your flow as JSON — import/export anytime from the toolbar

---

<p align="center">
  <strong>IdeaStudio</strong> · CLI <code>v2.2.3</code> ·
  <a href="https://www.idea2vid.com/">idea2vid.com</a>
</p>
