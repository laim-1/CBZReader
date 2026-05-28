export type MagnifierOptions = {
  lensEl: HTMLElement;
  zoom: number;
  /** Lens radius in CSS pixels */
  radius: number;
};

/**
 * Compute the content rectangle of an image with object-fit: contain
 * (letterboxed area inside the element).
 */
export function getImageContentRect(img: HTMLImageElement): DOMRect | null {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return null;

  const elW = img.clientWidth;
  const elH = img.clientHeight;
  if (!elW || !elH) return null;

  const imgAspect = nw / nh;
  const elAspect = elW / elH;

  let cw: number;
  let ch: number;
  let ox: number;
  let oy: number;

  if (imgAspect > elAspect) {
    cw = elW;
    ch = elW / imgAspect;
    ox = 0;
    oy = (elH - ch) / 2;
  } else {
    ch = elH;
    cw = elH * imgAspect;
    ox = (elW - cw) / 2;
    oy = 0;
  }

  const root = img.getBoundingClientRect();
  return new DOMRect(root.left + ox, root.top + oy, cw, ch);
}

export function clientToNatural(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
): { nx: number; ny: number } | null {
  const rect = getImageContentRect(img);
  if (!rect) return null;
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }

  const nx = ((clientX - rect.left) / rect.width) * img.naturalWidth;
  const ny = ((clientY - rect.top) / rect.height) * img.naturalHeight;
  return { nx, ny };
}

/**
 * Update lens position and background to magnify the image under (clientX, clientY).
 * Lens element should have pointer-events: none.
 */
export function updateLens(
  img: HTMLImageElement,
  lensEl: HTMLElement,
  clientX: number,
  clientY: number,
  zoom: number,
  radius: number,
): void {
  const natural = clientToNatural(img, clientX, clientY);
  if (!natural) {
    lensEl.classList.add("hidden");
    return;
  }

  const { nx, ny } = natural;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const d = radius * 2;

  lensEl.classList.remove("hidden");
  lensEl.style.width = `${d}px`;
  lensEl.style.height = `${d}px`;
  lensEl.style.left = `${clientX - radius}px`;
  lensEl.style.top = `${clientY - radius}px`;

  const src = img.currentSrc || img.src;
  lensEl.style.backgroundImage = `url("${src.replace(/"/g, '\\"')}")`;
  lensEl.style.backgroundSize = `${nw * zoom}px ${nh * zoom}px`;
  const px = radius - nx * zoom;
  const py = radius - ny * zoom;
  lensEl.style.backgroundPosition = `${px}px ${py}px`;
}

export function pickImageUnderPoint(
  clientX: number,
  clientY: number,
  root: HTMLElement,
): HTMLImageElement | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (!root.contains(el)) continue;
    if (el instanceof HTMLImageElement) return el;
  }
  return null;
}
