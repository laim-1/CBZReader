# CBZ Reader

Read `.cbz` comic archives in the browser — paged or scroll mode, fullscreen, and magnifier.

**Live site:** [https://laim-1.github.io/CBZReader/](https://laim-1.github.io/CBZReader/)

## GitHub Pages setup

1. Open **Settings → Pages** on this repo.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Branch: **`main`**, folder: **`/docs`** (not root).

The site files live in the [`docs/`](docs/) folder (built output). Root of `main` is source code only.

> **Note:** After changing source code, the `docs/` folder must be rebuilt before pushing. If you add a GitHub Actions workflow later, it can do that automatically on each push.

## Controls

| Key | Action |
|-----|--------|
| ← → | Previous / next page |
| Home / End | First / last page |
| F | Fullscreen |
| M | Magnifier |
| Esc | Exit magnifier, then fullscreen |

Drag and drop a `.cbz` file onto the page, or use **Open**.
