import { getProxiedAssetUrl } from './inventory';

/** [ymin, xmin, ymax, xmax] normalized to a 0-1000 scale. */
export type NormBox = [number, number, number, number];

export interface CropResult {
  blob: Blob;
  dataUrl: string;
}

const imagePromiseCache = new Map<string, Promise<HTMLImageElement>>();

/** Loads an image through /api/proxy-image with crossOrigin=anonymous so canvas export never taints. Reuses decoded image promise to avoid redundant network decodes. */
export function loadProxiedImage(idOrUrl: string): Promise<HTMLImageElement> {
  const src = getProxiedAssetUrl(idOrUrl);
  if (!src) return Promise.reject(new Error('Empty image source'));

  if (imagePromiseCache.has(src)) {
    return imagePromiseCache.get(src)!;
  }

  // Bound the cache size to avoid memory buildup across long sessions
  if (imagePromiseCache.size > 25) {
    const oldestKey = imagePromiseCache.keys().next().value;
    if (oldestKey) imagePromiseCache.delete(oldestKey);
  }

  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      imagePromiseCache.delete(src);
      reject(new Error('Failed to load image for cropping'));
    };
    img.src = src;
  });

  imagePromiseCache.set(src, p);
  return p;
}

/** Converts a 0-1000 box [ymin, xmin, ymax, xmax] strictly to source pixel coordinates:
 * sx = (xmin/1000)*naturalWidth
 * sy = (ymin/1000)*naturalHeight
 * sw = ((xmax-xmin)/1000)*naturalWidth
 * sh = ((ymax-ymin)/1000)*naturalHeight
 */
export function boxToPixelRect(box: NormBox, naturalWidth: number, naturalHeight: number, padding = 0) {
  const [ymin, xmin, ymax, xmax] = box;
  const rawX = (xmin / 1000) * naturalWidth;
  const rawY = (ymin / 1000) * naturalHeight;
  const rawW = ((xmax - xmin) / 1000) * naturalWidth;
  const rawH = ((ymax - ymin) / 1000) * naturalHeight;

  if (padding > 0) {
    const padX = rawW * padding;
    const padY = rawH * padding;
    const x = Math.max(0, rawX - padX);
    const y = Math.max(0, rawY - padY);
    const w = Math.min(naturalWidth - x, rawW + (rawX - x) + padX);
    const h = Math.min(naturalHeight - y, rawH + (rawY - y) + padY);
    return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
  }

  const x = Math.max(0, Math.min(naturalWidth - 1, rawX));
  const y = Math.max(0, Math.min(naturalHeight - 1, rawY));
  const w = Math.max(1, Math.min(naturalWidth - x, rawW));
  const h = Math.max(1, Math.min(naturalHeight - y, rawH));
  return { x, y, w, h };
}

/** Crops the given box strictly from a gallery photo and returns a JPEG Blob + DataURL. */
export async function cropPhotoToJpeg(
  idOrUrl: string,
  box: NormBox,
  options: { padding?: number; quality?: number; maxSize?: number } = {}
): Promise<CropResult> {
  const img = await loadProxiedImage(idOrUrl);
  const { x, y, w, h } = boxToPixelRect(box, img.naturalWidth, img.naturalHeight, options.padding ?? 0);
  const maxSize = options.maxSize ?? 1200;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  const quality = options.quality ?? 0.9;
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/jpeg', quality)
  );
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  // Free canvas GPU buffer memory immediately
  canvas.width = 0;
  canvas.height = 0;
  return { blob, dataUrl };
}
