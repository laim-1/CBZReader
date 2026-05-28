import { unzipSync } from "fflate";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;

function isImagePath(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  return IMAGE_EXT.test(base);
}

/** Natural sort on full path (numeric segments compare as numbers). */
function comparePaths(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export type LoadedCbz = {
  paths: string[];
  objectUrls: string[];
  revokeAll: () => void;
};

/**
 * Read a .cbz (zip) file, extract image entries, return sorted blob URLs.
 */
export function loadCbzFromFile(file: File): Promise<LoadedCbz> {
  return file.arrayBuffer().then((buffer) => loadCbzFromBuffer(buffer));
}

function mimeForPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

export function loadCbzFromBuffer(buffer: ArrayBuffer): LoadedCbz {
  const u8 = new Uint8Array(buffer);
  const files = unzipSync(u8);
  const paths = Object.keys(files)
    .filter((p) => !p.endsWith("/") && isImagePath(p))
    .sort(comparePaths);

  const objectUrls: string[] = [];
  const keptPaths: string[] = [];
  for (const path of paths) {
    const data = files[path];
    if (!data || data.length === 0) continue;
    const blob = new Blob([data], { type: mimeForPath(path) });
    keptPaths.push(path);
    objectUrls.push(URL.createObjectURL(blob));
  }

  const revokeAll = (): void => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
  };

  return { paths: keptPaths, objectUrls, revokeAll };
}
