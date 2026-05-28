import "./styles.css";
import { loadCbzFromFile, type LoadedCbz } from "./cbz";
import { drawLens, pickImageUnderPoint } from "./magnifier";

type ViewMode = "paged" | "scroll";
type FitMode = "width" | "height";

const LENS_RADIUS = 110;
const CHROME_HIDE_MS = 2800;

const app = document.getElementById("app")!;
const reader = document.getElementById("reader")!;
const welcome = document.getElementById("welcome")!;
const loading = document.getElementById("loading")!;
const loadingText = document.getElementById("loading-text")!;
const loadingFill = document.getElementById("loading-fill")!;
const pagedView = document.getElementById("paged-view")!;
const pageImg = document.getElementById("page-img") as HTMLImageElement;
const scrollView = document.getElementById("scroll-view")!;
const lensCanvas = document.getElementById("magnifier-lens") as HTMLCanvasElement;
const toastEl = document.getElementById("toast")!;
const bottomBar = document.getElementById("bottom-bar")!;
const fileLabel = document.getElementById("file-label")!;
const pageStatus = document.getElementById("page-status")!;
const pageSlider = document.getElementById("page-slider") as HTMLInputElement;
const progressFill = document.getElementById("progress-fill")!;
const zoomControl = document.getElementById("zoom-control")!;

const fileInputs = [
  document.getElementById("file-input") as HTMLInputElement,
  document.getElementById("file-input-welcome") as HTMLInputElement,
];
const modePagedBtn = document.getElementById("mode-paged")!;
const modeScrollBtn = document.getElementById("mode-scroll")!;
const fitWidthBtn = document.getElementById("fit-width")!;
const fitHeightBtn = document.getElementById("fit-height")!;
const btnMagnifier = document.getElementById("btn-magnifier")!;
const magnifierZoomInput = document.getElementById("magnifier-zoom") as HTMLInputElement;
const btnFullscreen = document.getElementById("btn-fullscreen")!;
const navPrev = document.getElementById("nav-prev")!;
const navNext = document.getElementById("nav-next")!;
const btnFirst = document.getElementById("btn-first")!;
const btnLast = document.getElementById("btn-last")!;
const iconFsEnter = btnFullscreen.querySelector(".icon-fs-enter")!;
const iconFsExit = btnFullscreen.querySelector(".icon-fs-exit")!;

let loaded: LoadedCbz | null = null;
let revokePrevious: (() => void) | null = null;
let currentPage = 0;
let viewMode: ViewMode = "paged";
let fit: FitMode = "width";
let magnifierActive = false;
let magnifierZoom = Number(magnifierZoomInput.value) || 2.5;
let scrollPageEstimate = 1;
let scrollObserver: IntersectionObserver | null = null;
let chromeHideTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, isError = false): void {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden", "is-error", "is-visible");
  void toastEl.offsetWidth;
  toastEl.classList.add("is-visible");
  if (isError) toastEl.classList.add("is-error");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("is-visible");
    setTimeout(() => toastEl.classList.add("hidden"), 300);
  }, 3500);
}

function setLoading(on: boolean, text = "Loading…", percent?: number): void {
  loading.classList.toggle("hidden", !on);
  loadingText.textContent = text;
  if (percent !== undefined) {
    loadingFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }
}

function setSegmented(
  btnA: HTMLElement,
  btnB: HTMLElement,
  activeA: boolean,
): void {
  btnA.classList.toggle("active", activeA);
  btnA.setAttribute("aria-pressed", String(activeA));
  btnB.classList.toggle("active", !activeA);
  btnB.setAttribute("aria-pressed", String(!activeA));
}

function setFit(f: FitMode): void {
  fit = f;
  setSegmented(fitWidthBtn, fitHeightBtn, f === "width");
  pageImg.classList.remove("fit-width", "fit-height");
  pageImg.classList.add(f === "width" ? "fit-width" : "fit-height");
  scrollView.querySelectorAll(".scroll-page img").forEach((img) => {
    img.classList.remove("fit-width", "fit-height");
    img.classList.add(f === "width" ? "fit-width" : "fit-height");
  });
}

function updateProgress(): void {
  if (!loaded?.objectUrls.length) {
    progressFill.style.width = "0%";
    return;
  }
  const total = loaded.objectUrls.length;
  const page =
    viewMode === "paged" ? currentPage + 1 : scrollPageEstimate;
  const pct = (page / total) * 100;
  progressFill.style.width = `${pct}%`;
  pageSlider.max = String(total);
  pageSlider.value = String(page);
  pageSlider.disabled = viewMode === "scroll";
}

function updateStatus(): void {
  if (!loaded?.objectUrls.length) return;
  const total = loaded.objectUrls.length;
  if (viewMode === "paged") {
    pageStatus.textContent = `Page ${currentPage + 1} of ${total}`;
  } else {
    pageStatus.textContent = `Page ${scrollPageEstimate} of ${total}`;
  }
  updateProgress();
}

function showReaderChrome(hasBook: boolean): void {
  welcome.classList.toggle("hidden", hasBook);
  bottomBar.hidden = !hasBook;
  if (!hasBook) {
    pagedView.classList.add("hidden");
    scrollView.classList.add("hidden");
  }
}

function refreshViewVisibility(): void {
  if (!loaded?.objectUrls.length) return;
  const paged = viewMode === "paged";
  pagedView.classList.toggle("hidden", !paged);
  scrollView.classList.toggle("hidden", paged);
}

function setViewMode(mode: ViewMode): void {
  viewMode = mode;
  setSegmented(modePagedBtn, modeScrollBtn, mode === "paged");
  refreshViewVisibility();
  if (mode === "paged") {
    disconnectScrollObserver();
    void showPagedPage();
  } else {
    connectScrollObserver();
    updateScrollPageFromScroll();
  }
  updateStatus();
}

function buildScrollView(): void {
  scrollView.replaceChildren();
  if (!loaded) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < loaded.objectUrls.length; i++) {
    const wrap = document.createElement("div");
    wrap.className = "scroll-page";
    wrap.dataset.index = String(i);
    const num = document.createElement("span");
    num.className = "page-num";
    num.textContent = `${i + 1}`;
    const img = document.createElement("img");
    img.className = fit === "width" ? "fit-width" : "fit-height";
    img.src = loaded.objectUrls[i]!;
    img.alt = `Page ${i + 1}`;
    img.loading = i < 3 ? "eager" : "lazy";
    img.decoding = "async";
    wrap.appendChild(img);
    wrap.appendChild(num);
    frag.appendChild(wrap);
  }
  scrollView.appendChild(frag);
}

function preloadNeighbors(): void {
  if (!loaded) return;
  const n = loaded.objectUrls.length;
  for (const i of [
    (currentPage + 1) % n,
    (currentPage - 1 + n) % n,
  ]) {
    const im = new Image();
    im.src = loaded.objectUrls[i]!;
  }
}

async function showPagedPage(): Promise<void> {
  if (!loaded?.objectUrls.length) {
    pageImg.removeAttribute("src");
    return;
  }
  currentPage = Math.max(0, Math.min(currentPage, loaded.objectUrls.length - 1));
  const url = loaded.objectUrls[currentPage]!;
  if (pageImg.src === url && pageImg.complete) {
    updateStatus();
    return;
  }
  pageImg.classList.add("is-loading");
  pageImg.alt = `Page ${currentPage + 1}`;
  await new Promise<void>((resolve) => {
    const done = (): void => {
      pageImg.classList.remove("is-loading");
      resolve();
    };
    pageImg.onload = done;
    pageImg.onerror = done;
    pageImg.src = url;
    if (pageImg.complete) done();
  });
  preloadNeighbors();
  updateStatus();
}

function goPage(delta: number): void {
  if (!loaded?.objectUrls.length) return;
  const n = loaded.objectUrls.length;
  currentPage = (currentPage + delta + n) % n;
  void showPagedPage();
}

function goToPage(index: number): void {
  if (!loaded?.objectUrls.length) return;
  currentPage = Math.max(0, Math.min(index, loaded.objectUrls.length - 1));
  if (viewMode === "paged") {
    void showPagedPage();
  } else {
    const el = scrollView.querySelector(`[data-index="${currentPage}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    scrollPageEstimate = currentPage + 1;
    updateStatus();
  }
}

function scrollByChunk(direction: 1 | -1): void {
  scrollView.scrollBy({
    top: direction * scrollView.clientHeight * 0.88,
    behavior: "smooth",
  });
}

function connectScrollObserver(): void {
  disconnectScrollObserver();
  if (!loaded?.objectUrls.length) return;
  scrollObserver = new IntersectionObserver(
    (entries) => {
      let best: { ratio: number; index: number } | null = null;
      for (const e of entries) {
        const wrap = e.target as HTMLElement;
        const idx = Number(wrap.dataset.index);
        if (Number.isNaN(idx)) continue;
        if (!best || e.intersectionRatio > best.ratio) {
          best = { ratio: e.intersectionRatio, index: idx };
        }
      }
      if (best && best.ratio > 0.15) {
        scrollPageEstimate = best.index + 1;
        currentPage = best.index;
        updateStatus();
      }
    },
    { root: scrollView, threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  scrollView.querySelectorAll(".scroll-page").forEach((el) => {
    scrollObserver?.observe(el);
  });
}

function disconnectScrollObserver(): void {
  scrollObserver?.disconnect();
  scrollObserver = null;
}

function updateScrollPageFromScroll(): void {
  const pages = scrollView.querySelectorAll(".scroll-page");
  if (!pages.length) return;
  const mid = scrollView.scrollTop + scrollView.clientHeight / 2;
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pages.length; i++) {
    const el = pages[i]!;
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
  currentPage = bestIdx;
}

async function openFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().match(/\.(cbz|zip)$/)) {
    showToast("Please choose a .cbz or .zip file", true);
    return;
  }

  revokePrevious?.();
  revokePrevious = null;
  loaded = null;
  currentPage = 0;
  showReaderChrome(false);
  setLoading(true, "Opening…", 0);

  try {
    const result = await loadCbzFromFile(file, (msg, pct) => {
      setLoading(true, msg, pct);
    });
    loaded = result;
    revokePrevious = result.revokeAll;
  } catch (e) {
    console.error(e);
    setLoading(false);
    showToast("Could not open this file. Is it a valid CBZ?", true);
    showReaderChrome(false);
    return;
  }

  setLoading(false);

  if (!loaded.objectUrls.length) {
    loaded.revokeAll();
    revokePrevious = null;
    loaded = null;
    showToast("No images found in this archive", true);
    showReaderChrome(false);
    return;
  }

  fileLabel.textContent = loaded.fileName;
  setFit(fit);
  buildScrollView();
  showReaderChrome(true);
  refreshViewVisibility();
  await showPagedPage();
  setViewMode(viewMode);
  showToast(`Loaded ${loaded.objectUrls.length} pages`);
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) {
      await app.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    showToast("Fullscreen is not available here", true);
  }
}

function updateFullscreenIcon(): void {
  const fs = Boolean(document.fullscreenElement);
  iconFsEnter.classList.toggle("hidden", fs);
  iconFsExit.classList.toggle("hidden", !fs);
}

function setMagnifier(on: boolean): void {
  magnifierActive = on;
  btnMagnifier.setAttribute("aria-pressed", String(on));
  zoomControl.hidden = !on;
  document.body.classList.toggle("magnifier-on", on);
  if (!on) lensCanvas.classList.add("hidden");
}

function scheduleChromeHide(): void {
  if (!document.fullscreenElement) {
    app.classList.remove("chrome-hidden");
    return;
  }
  app.classList.remove("chrome-hidden");
  if (chromeHideTimer) clearTimeout(chromeHideTimer);
  chromeHideTimer = setTimeout(() => {
    if (document.fullscreenElement && !magnifierActive) {
      app.classList.add("chrome-hidden");
    }
  }, CHROME_HIDE_MS);
}

function onPointerMove(ev: PointerEvent): void {
  if (document.fullscreenElement) scheduleChromeHide();
  if (!magnifierActive) return;
  const img = pickImageUnderPoint(ev.clientX, ev.clientY, reader);
  if (!img || !drawLens(lensCanvas, img, ev.clientX, ev.clientY, magnifierZoom, LENS_RADIUS)) {
    lensCanvas.classList.add("hidden");
    return;
  }
  lensCanvas.classList.remove("hidden");
}

function onKeyDown(ev: KeyboardEvent): void {
  const t = ev.target as HTMLElement | null;
  if (t?.matches("input, textarea, [contenteditable]")) return;

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

  if (!loaded?.objectUrls.length) return;

  if (viewMode === "paged") {
    if (ev.key === "ArrowRight" || ev.key === "PageDown") {
      ev.preventDefault();
      goPage(1);
    } else if (ev.key === "ArrowLeft" || ev.key === "PageUp") {
      ev.preventDefault();
      goPage(-1);
    } else if (ev.key === "Home") {
      ev.preventDefault();
      goToPage(0);
    } else if (ev.key === "End") {
      ev.preventDefault();
      goToPage(loaded.objectUrls.length - 1);
    }
  } else {
    if (
      ev.key === "ArrowDown" ||
      ev.key === "ArrowRight" ||
      ev.key === "PageDown"
    ) {
      ev.preventDefault();
      scrollByChunk(1);
    } else if (
      ev.key === "ArrowUp" ||
      ev.key === "ArrowLeft" ||
      ev.key === "PageUp"
    ) {
      ev.preventDefault();
      scrollByChunk(-1);
    }
  }
}

function handleFiles(files: FileList | null): void {
  const f = files?.[0];
  if (f) void openFile(f);
}

function setupDragDrop(): void {
  let dragDepth = 0;
  const onDrag = (over: boolean): void => {
    reader.classList.toggle("is-dragover", over);
  };
  reader.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragDepth++;
    onDrag(true);
  });
  reader.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) onDrag(false);
  });
  reader.addEventListener("dragover", (e) => e.preventDefault());
  reader.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    onDrag(false);
    handleFiles(e.dataTransfer?.files ?? null);
  });
}

fileInputs.forEach((input) => {
  input.addEventListener("change", () => {
    handleFiles(input.files);
    input.value = "";
  });
});

modePagedBtn.addEventListener("click", () => setViewMode("paged"));
modeScrollBtn.addEventListener("click", () => setViewMode("scroll"));
fitWidthBtn.addEventListener("click", () => setFit("width"));
fitHeightBtn.addEventListener("click", () => setFit("height"));
btnFullscreen.addEventListener("click", () => void toggleFullscreen());
btnMagnifier.addEventListener("click", () => setMagnifier(!magnifierActive));
magnifierZoomInput.addEventListener("input", () => {
  magnifierZoom = Number(magnifierZoomInput.value) || 2.5;
});
navPrev.addEventListener("click", () => goPage(-1));
navNext.addEventListener("click", () => goPage(1));
btnFirst.addEventListener("click", () => goToPage(0));
btnLast.addEventListener("click", () => {
  if (loaded) goToPage(loaded.objectUrls.length - 1);
});
pageSlider.addEventListener("input", () => {
  goToPage(Number(pageSlider.value) - 1);
});

window.addEventListener("pointermove", onPointerMove);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("mousemove", scheduleChromeHide);
document.addEventListener("fullscreenchange", () => {
  updateFullscreenIcon();
  app.classList.remove("chrome-hidden");
  scheduleChromeHide();
});

scrollView.addEventListener("scroll", () => {
  if (viewMode !== "scroll") return;
  updateScrollPageFromScroll();
  updateStatus();
});

setFit("width");
showReaderChrome(false);
setupDragDrop();
