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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Draw magnified region into a circular canvas lens. */
export function drawLens(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
  zoom: number,
  radius: number,
): boolean {
  const content = getImageContentRect(img);
  const point = clientToNatural(img, clientX, clientY);
  if (!content || !point) return false;

  const d = radius * 2;
  const scaleX = img.naturalWidth / content.width;
  const scaleY = img.naturalHeight / content.height;
  const srcW = (d / zoom) * scaleX;
  const srcH = (d / zoom) * scaleY;
  const { nx, ny } = point;
  const sx = clamp(nx - srcW / 2, 0, img.naturalWidth - srcW);
  const sy = clamp(ny - srcH / 2, 0, img.naturalHeight - srcH);

  canvas.width = d;
  canvas.height = d;
  canvas.style.width = `${d}px`;
  canvas.style.height = `${d}px`;
  canvas.style.left = `${clientX - radius}px`;
  canvas.style.top = `${clientY - radius}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  ctx.clearRect(0, 0, d, d);
  ctx.save();
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, d, d);
  ctx.restore();

  return true;
}

export function pickImageUnderPoint(
  clientX: number,
  clientY: number,
  root: HTMLElement,
): HTMLImageElement | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    if (!root.contains(el)) continue;
    if (el instanceof HTMLImageElement && el.naturalWidth > 0) return el;
  }
  return null;
}
