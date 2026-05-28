# CBZ Reader

Read `.cbz` comic archives in the browser.

**Live site:** [https://laim-1.github.io/CBZReader/](https://laim-1.github.io/CBZReader/)

## GitHub Pages (required settings)

In **Settings → Pages → Build and deployment**:

| Setting | Value |
|--------|--------|
| Source | **Deploy from a branch** |
| Branch | `main` |
| Folder | **`/docs`** |

Use **`/docs`**, not **root (`/`)**. The root of the repo is source code; the built site is in [`docs/`](docs/).

If Pages is set to root by mistake, you get an unstyled page. The root [`index.html`](index.html) only redirects to `docs/`.

After changing settings or pushing, wait 1–2 minutes and hard-refresh (Ctrl+F5).

## Controls

| Key | Action |
|-----|--------|
| ← → | Previous / next page |
| Home / End | First / last page |
| F | Fullscreen |
| M | Magnifier |
| Esc | Exit magnifier, then fullscreen |

Drag and drop a `.cbz` file, or use **Open**.
