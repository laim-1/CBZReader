import "./styles.css";
import { loadCbzFromFile, type LoadedCbz } from "./cbz";
import { pickImageUnderPoint, updateLens } from "./magnifier";

const app = document.getElementById("app") as HTMLElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const modePagedBtn = document.getElementById("mode-paged") as HTMLButtonElement;
const modeScrollBtn = document.getElementById("mode-scroll") as HTMLButtonElement;
const btnFullscreen = document.getElementById("btn-fullscreen") as HTMLButtonElement;
const btnMagnifier = document.getElementById("btn-magnifier") as HTMLButtonElement;
const magnifierZoomInput = document.getElementById(
  "magnifier-zoom",
) as HTMLInputElement;
const fitWidthBtn = document.getElementById("fit-width") as HTMLButtonElement;
const fitHeightBtn = document.getElementById("fit-height") as HTMLButtonElement;
const mainArea = document.getElementById("main-area") as HTMLElement;
const pagedView = document.getElementById("paged-view") as HTMLElement;
const pagedImage = document.getElementById("paged-image") as HTMLImageElement;
const scrollView = document.getElementById("scroll-view") as HTMLElement;
const lensEl = document.getElementById("magnifier-lens") as HTMLElement;
const emptyHint = document.getElementById("empty-hint") as HTMLElement;
const pageStatus = document.getElementById("page-status") as HTMLElement;

const LENS_RADIUS = 100;

type ViewMode = "paged" | "scroll";
type FitMode = "width" | "height";

let loaded: LoadedCbz | null = null;
let revokePrevious: (() => void) | null = null;
let currentPage = 0;
let viewMode: ViewMode = "paged";
let fit: FitMode = "width";
let magnifierActive = false;
let magnifierZoom = Number(magnifierZoomInput.value) || 3;
let scrollPageEstimate = 1;

let scrollObserver: IntersectionObserver | null = null;

function setViewMode(mode: ViewMode): void {
  viewMode = mode;
  const paged = mode === "paged";
  modePagedBtn.classList.toggle("active", paged);
  modePagedBtn.setAttribute("aria-pressed", String(paged));
  modeScrollBtn.classList.toggle("active", !paged);
  modeScrollBtn.setAttribute("aria-pressed", String(!paged));
  pagedView.classList.toggle("hidden", !paged);
  scrollView.classList.toggle("hidden", paged);
  if (paged) {
    disconnectScrollObserver();
    updatePagedSrc();
  } else {
    updateScrollPageFromScroll();
    connectScrollObserver();
  }
  updateStatus();
}

function setFit(f: FitMode): void {
  fit = f;
  fitWidthBtn.classList.toggle("active", f === "width");
  fitHeightBtn.classList.toggle("active", f === "height");
  pagedImage.classList.remove("fit-width", "fit-height");
  pagedImage.classList.add(f === "width" ? "fit-width" : "fit-height");
  scrollView.querySelectorAll(".scroll-img").forEach((img) => {
    img.classList.remove("fit-width", "fit-height");
    img.classList.add(f === "width" ? "fit-width" : "fit-height");
  });
}

function clearScrollView(): void {
  scrollView.replaceChildren();
}

function buildScrollView(): void {
  clearScrollView();
  if (!loaded) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < loaded.objectUrls.length; i++) {
    const img = document.createElement("img");
    img.className = `scroll-img ${fit === "width" ? "fit-width" : "fit-height"}`;
    img.src = loaded.objectUrls[i];
    img.alt = `Page ${i + 1}`;
    img.loading = "lazy";
    img.dataset.index = String(i);
    frag.appendChild(img);
  }
  scrollView.appendChild(frag);
}

function updatePagedSrc(): void {
  if (!loaded || loaded.objectUrls.length === 0) {
    pagedImage.removeAttribute("src");
    return;
  }
  currentPage = Math.max(0, Math.min(currentPage, loaded.objectUrls.length - 1));
  const url = loaded.objectUrls[currentPage];
  if (pagedImage.src !== url) {
    pagedImage.src = url;
  }
  preloadNeighbors();
}

function preloadNeighbors(): void {
  if (!loaded) return;
  const n = loaded.objectUrls.length;
  const next = (currentPage + 1) % n;
  const prev = (currentPage - 1 + n) % n;
  for (const i of [next, prev]) {
    const im = new Image();
    im.src = loaded.objectUrls[i];
  }
}

function goPage(delta: number): void {
  if (!loaded || loaded.objectUrls.length === 0) return;
  const n = loaded.objectUrls.length;
  currentPage = (currentPage + delta + n) % n;
  updatePagedSrc();
  updateStatus();
}

function scrollByChunk(direction: 1 | -1): void {
  const h = scrollView.clientHeight;
  scrollView.scrollBy({ top: direction * h * 0.92, behavior: "smooth" });
}

function connectScrollObserver(): void {
  disconnectScrollObserver();
  if (!loaded || loaded.objectUrls.length === 0) return;
  scrollObserver = new IntersectionObserver(
    (entries) => {
      let best: { ratio: number; index: number } | null = null;
      for (const e of entries) {
        const t = e.target as HTMLElement;
        const idx = Number(t.dataset.index);
        if (Number.isNaN(idx)) continue;
        const ratio = e.intersectionRatio;
        if (!best || ratio > best.ratio) {
          best = { ratio, index: idx };
        }
      }
      if (best && best.ratio > 0) {
        scrollPageEstimate = best.index + 1;
        updateStatus();
      }
    },
    { root: scrollView, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
  );
  scrollView.querySelectorAll(".scroll-img").forEach((img) => {
    scrollObserver?.observe(img);
  });
}

function disconnectScrollObserver(): void {
  scrollObserver?.disconnect();
  scrollObserver = null;
}

function updateScrollPageFromScroll(): void {
  const imgs = scrollView.querySelectorAll(".scroll-img");
  if (imgs.length === 0) return;
  const mid = scrollView.scrollTop + scrollView.clientHeight / 2;
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < imgs.length; i++) {
    const el = imgs[i]!;
    const r = el.getBoundingClientRect();
    const root = scrollView.getBoundingClientRect();
    const top = r.top - root.top + scrollView.scrollTop;
    const center = top + r.height / 2;
    const d = Math.abs(center - mid);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  scrollPageEstimate = bestIdx + 1;
}

function updateStatus(): void {
  if (!loaded || loaded.objectUrls.length === 0) {
    pageStatus.textContent = "No file loaded";
    return;
  }
  const total = loaded.objectUrls.length;
  if (viewMode === "paged") {
    pageStatus.textContent = `Page ${currentPage + 1} / ${total}`;
  } else {
    pageStatus.textContent = `Page ~${scrollPageEstimate} / ${total} (scroll)`;
  }
}

/** Shows hint when nothing loaded; otherwise shows paged or scroll view per mode. */
function refreshEmptyState(): void {
  const empty = !loaded || loaded.objectUrls.length === 0;
  emptyHint.classList.toggle("hidden", !empty);
  if (empty) {
    pagedView.classList.add("hidden");
    scrollView.classList.add("hidden");
    pagedImage.removeAttribute("src");
    return;
  }
  if (viewMode === "paged") {
    pagedView.classList.remove("hidden");
    scrollView.classList.add("hidden");
  } else {
    pagedView.classList.add("hidden");
    scrollView.classList.remove("hidden");
  }
}

async function openFile(file: File): Promise<void> {
  revokePrevious?.();
  revokePrevious = null;
  loaded = null;
  currentPage = 0;
  try {
    const result = await loadCbzFromFile(file);
    loaded = result;
    revokePrevious = result.revokeAll;
  } catch (e) {
    console.error(e);
    pageStatus.textContent = "Could not read CBZ (invalid zip or empty).";
    loaded = null;
    refreshEmptyState();
    updateStatus();
    return;
  }
  if (!loaded.objectUrls.length) {
    loaded.revokeAll();
    revokePrevious = null;
    pageStatus.textContent = "No images found in archive.";
    loaded = null;
    refreshEmptyState();
    updateStatus();
    return;
  }
  setFit(fit);
  buildScrollView();
  updatePagedSrc();
  refreshEmptyState();
  setViewMode(viewMode);
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) {
      await app.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (e) {
    console.error(e);
  }
}

function setMagnifier(on: boolean): void {
  magnifierActive = on;
  btnMagnifier.setAttribute("aria-pressed", String(on));
  btnMagnifier.classList.toggle("active", on);
  document.body.classList.toggle("magnifier-on", on);
  if (!on) {
    lensEl.classList.add("hidden");
  }
}

function onPointerMove(ev: PointerEvent): void {
  if (!magnifierActive) return;
  const img = pickImageUnderPoint(ev.clientX, ev.clientY, mainArea);
  if (!img) {
    lensEl.classList.add("hidden");
    return;
  }
  updateLens(img, lensEl, ev.clientX, ev.clientY, magnifierZoom, LENS_RADIUS);
}

function onKeyDown(ev: KeyboardEvent): void {
  const t = ev.target as HTMLElement | null;
  if (
    t &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
  ) {
    return;
  }

  if (ev.key === "Escape") {
    if (magnifierActive) {
      ev.preventDefault();
      setMagnifier(false);
      return;
    }
    if (document.fullscreenElement) {
      ev.preventDefault();
      void document.exitFullscreen();
    }
    return;
  }

  if (ev.key === "f" || ev.key === "F" || (ev.ctrlKey && ev.key === "Enter")) {
    ev.preventDefault();
    void toggleFullscreen();
    return;
  }

  if (ev.key === "m" || ev.key === "M") {
    ev.preventDefault();
    setMagnifier(!magnifierActive);
    return;
  }

  if (!loaded || loaded.objectUrls.length === 0) return;

  if (viewMode === "paged") {
    if (ev.key === "ArrowRight" || ev.key === "PageDown") {
      ev.preventDefault();
      goPage(1);
    } else if (ev.key === "ArrowLeft" || ev.key === "PageUp") {
      ev.preventDefault();
      goPage(-1);
    }
  } else {
    if (ev.key === "ArrowRight" || ev.key === "PageDown" || ev.key === "ArrowDown") {
      ev.preventDefault();
      scrollByChunk(1);
    } else if (ev.key === "ArrowLeft" || ev.key === "PageUp" || ev.key === "ArrowUp") {
      ev.preventDefault();
      scrollByChunk(-1);
    }
  }
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) void openFile(f);
  fileInput.value = "";
});

modePagedBtn.addEventListener("click", () => setViewMode("paged"));
modeScrollBtn.addEventListener("click", () => setViewMode("scroll"));

fitWidthBtn.addEventListener("click", () => setFit("width"));
fitHeightBtn.addEventListener("click", () => setFit("height"));

btnFullscreen.addEventListener("click", () => {
  void toggleFullscreen();
});

btnMagnifier.addEventListener("click", () => {
  setMagnifier(!magnifierActive);
});

magnifierZoomInput.addEventListener("input", () => {
  magnifierZoom = Number(magnifierZoomInput.value) || 3;
});

window.addEventListener("pointermove", onPointerMove);
window.addEventListener("keydown", onKeyDown);

scrollView.addEventListener("scroll", () => {
  if (viewMode === "scroll") updateScrollPageFromScroll();
  if (viewMode === "scroll") updateStatus();
});

setFit("width");
refreshEmptyState();
updateStatus();
