import { unzip } from "fflate";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|avif)$/i;

function isImagePath(path: string): boolean {
  const base = path.split("/").pop() ?? path;
  return IMAGE_EXT.test(base);
}

function comparePaths(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
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

export type LoadedCbz = {
  paths: string[];
  objectUrls: string[];
  fileName: string;
  revokeAll: () => void;
};

export type LoadProgress = (message: string, percent?: number) => void;

export function loadCbzFromFile(
  file: File,
  onProgress?: LoadProgress,
): Promise<LoadedCbz> {
  onProgress?.("Reading file…", 0);
  return file.arrayBuffer().then((buffer) =>
    loadCbzFromBuffer(buffer, file.name, onProgress),
  );
}

export function loadCbzFromBuffer(
  buffer: ArrayBuffer,
  fileName = "archive.cbz",
  onProgress?: LoadProgress,
): Promise<LoadedCbz> {
  return new Promise((resolve, reject) => {
    onProgress?.("Unpacking archive…", 10);
    unzip(new Uint8Array(buffer), (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const result = processUnzipped(files, fileName, onProgress);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function processUnzipped(
  files: Record<string, Uint8Array>,
  fileName: string,
  onProgress?: LoadProgress,
): LoadedCbz {
  const paths = Object.keys(files)
    .filter((p) => !p.endsWith("/") && isImagePath(p))
    .sort(comparePaths);

  const objectUrls: string[] = [];
  const keptPaths: string[] = [];
  const total = paths.length;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!;
    const data = files[path];
    if (!data?.length) continue;
    const blob = new Blob([data], { type: mimeForPath(path) });
    keptPaths.push(path);
    objectUrls.push(URL.createObjectURL(blob));
    if (total > 0 && onProgress) {
      const pct = 20 + Math.round(((i + 1) / total) * 75);
      onProgress(`Preparing page ${i + 1} of ${total}…`, pct);
    }
  }

  onProgress?.("Ready", 100);

  const revokeAll = (): void => {
    for (const url of objectUrls) URL.revokeObjectURL(url);
  };

  return { paths: keptPaths, objectUrls, fileName, revokeAll };
}
