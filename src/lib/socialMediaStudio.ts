import JSZip from 'jszip';
import { getAssetUrl } from './inventory';

export interface SocialStudioItem {
    id?: string;
    $id?: string;
    title: string;
    upc?: string;
    resalePrice?: number | string;
    price?: number | string;
    boutiquePrice?: number | string;
    cost?: number | string;
    brand?: string;
    category?: string;
    condition?: string;
    imageId?: string;
    galleryImageIds?: string[];
    images?: (string | { id?: string; url?: string })[];
    conditionNotes?: string;
    storageLocation?: string;
    customPhotoDataUrl?: string;
    customPhotoBlob?: Blob;
    isEnhanced?: boolean;
    cropRatio?: string;
}

export interface PostMediaSlide {
    id: string;
    type: 'item_hero' | 'item_gallery' | 'card_graphic' | 'booth_display';
    url: string;
    title: string;
    price?: number | string;
    locationName?: string;
    sourceItemId?: string;
    sourceType?: 'drop' | 'haul' | 'sale' | 'catalog' | 'booth';
    description?: string;
}

/**
 * Resolves all available image URLs for an item.
 */
export function getItemImageUrls(item: SocialStudioItem): string[] {
    if (!item) return [];
    const urls: string[] = [];

    // 1. Primary imageId
    if (item.imageId) {
        const u = getAssetUrl(item.imageId, { preview: false });
        if (u) urls.push(u);
    }

    // 2. Gallery images
    if (Array.isArray(item.galleryImageIds)) {
        for (const gId of item.galleryImageIds) {
            if (gId && gId !== item.imageId) {
                const u = getAssetUrl(gId, { preview: false });
                if (u && !urls.includes(u)) urls.push(u);
            }
        }
    }

    // 3. Array of images
    if (Array.isArray(item.images)) {
        for (const img of item.images) {
            const rawId = typeof img === 'string' ? img : (img?.url || img?.id);
            if (rawId) {
                const u = getAssetUrl(rawId, { preview: false });
                if (u && !urls.includes(u)) urls.push(u);
            }
        }
    }

    // 4. Fallback conditionNotes regex [MAIN IMAGE ID: ...]
    if (urls.length === 0 && item.conditionNotes && typeof item.conditionNotes === 'string') {
        const match = item.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/);
        if (match && match[1]) {
            const ids = match[1].split(',').map(s => s.trim());
            for (const id of ids) {
                const u = getAssetUrl(id, { preview: false });
                if (u && !urls.includes(u)) urls.push(u);
            }
        }
    }

    return urls;
}

/**
 * Clean sanitization for filenames.
 */
function sanitizeFilename(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 40)
        .replace(/^_|_$/g, '');
}

/**
 * Downloads a single image directly with filename.
 */
export async function downloadSingleImage(url: string, filename: string): Promise<void> {
    try {
        const proxyUrl = url.includes('/api/proxy-image') ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        triggerBlobDownload(blob, filename);
    } catch (e) {
        // Fallback direct link download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

/**
 * Batch-downloads all item photos and packages them into a clean ZIP file.
 */
export async function downloadItemsAsZip(
    items: SocialStudioItem[],
    options?: {
        zipName?: string;
        allPhotos?: boolean; // If true, download gallery photos too; if false, primary only
        onProgress?: (percent: number, statusMsg: string) => void;
    }
): Promise<{ success: number; failed: number }> {
    const zip = new JSZip();
    const zipName = options?.zipName || `Drop_Photos_${new Date().toISOString().slice(0, 10)}.zip`;
    const onProgress = options?.onProgress || (() => {});

    let success = 0;
    let failed = 0;

    let totalToFetch = 0;
    const fetchQueue: { url: string; filename: string; title: string }[] = [];

    // Collect all tasks
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const upcPrefix = item.upc ? `${sanitizeFilename(item.upc)}_` : '';
        const titleSlug = sanitizeFilename(item.title || `Item_${i + 1}`);

        // If user enhanced/cropped this photo, bundle the custom blob directly
        if (item.customPhotoBlob) {
            const ratioSuffix = item.cropRatio ? `_${item.cropRatio.replace(':', 'x')}` : '_enhanced';
            zip.file(`${upcPrefix}${titleSlug}${ratioSuffix}.jpg`, item.customPhotoBlob);
            success++;
            continue;
        }

        const urls = getItemImageUrls(item);
        if (urls.length === 0) continue;

        if (options?.allPhotos && urls.length > 1) {
            urls.forEach((u, imgIdx) => {
                fetchQueue.push({
                    url: u,
                    filename: `${upcPrefix}${titleSlug}_${imgIdx + 1}.jpg`,
                    title: item.title
                });
            });
        } else {
            fetchQueue.push({
                url: urls[0],
                filename: `${upcPrefix}${titleSlug}.jpg`,
                title: item.title
            });
        }
    }

    totalToFetch = fetchQueue.length;
    if (totalToFetch === 0 && success === 0) {
        throw new Error('No photos available to download for these items.');
    }

    for (let i = 0; i < fetchQueue.length; i++) {
        const task = fetchQueue[i];
        const pct = Math.round(((i) / totalToFetch) * 80);
        onProgress(pct, `Downloading ${i + 1}/${totalToFetch}: ${task.title.slice(0, 25)}...`);

        try {
            const proxyUrl = task.url.includes('/api/proxy-image') ? task.url : `/api/proxy-image?url=${encodeURIComponent(task.url)}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            zip.file(task.filename, blob);
            success++;
        } catch (err) {
            console.warn(`[SocialMediaStudio] Failed to fetch photo for ${task.title}:`, err);
            failed++;
        }
    }

    onProgress(85, 'Packaging ZIP archive...');
    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    }, (meta) => {
        const p = 85 + Math.round((meta.percent / 100) * 15);
        onProgress(p, `Compressing photos: ${meta.percent.toFixed(0)}%`);
    });

    onProgress(100, 'Download complete!');
    triggerBlobDownload(zipBlob, zipName);

    return { success, failed };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Downloads ordered media reel slides into a sequentially named ZIP.
 * e.g., 01_COVER_Vintage_Jacket.jpg, 02_Back_Detail.jpg, etc.
 */
export async function downloadMediaSlidesAsZip(
    slides: PostMediaSlide[],
    options?: {
        zipName?: string;
        onProgress?: (percent: number, statusMsg: string) => void;
    }
): Promise<{ success: number; failed: number }> {
    const zip = new JSZip();
    const zipName = options?.zipName || `Drop_Post_Reel_${new Date().toISOString().slice(0, 10)}.zip`;
    const onProgress = options?.onProgress || (() => {});

    let success = 0;
    let failed = 0;

    const totalToFetch = slides.length;
    if (totalToFetch === 0) {
        throw new Error('No media slides to download.');
    }

    for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const numPrefix = String(i + 1).padStart(2, '0');
        const coverTag = i === 0 ? '_COVER' : '';
        const titleSlug = sanitizeFilename(slide.title || `Slide_${i + 1}`);
        const filename = `${numPrefix}${coverTag}_${titleSlug}.jpg`;

        const pct = Math.round((i / totalToFetch) * 80);
        onProgress(pct, `Preparing slide ${i + 1}/${totalToFetch}: ${titleSlug.slice(0, 20)}...`);

        try {
            if (slide.url.startsWith('data:')) {
                const commaIdx = slide.url.indexOf(',');
                if (commaIdx !== -1) {
                    const base64Data = slide.url.substring(commaIdx + 1);
                    zip.file(filename, base64Data, { base64: true });
                    success++;
                    continue;
                }
            }

            const fetchUrl = slide.url.startsWith('blob:')
                ? slide.url
                : (slide.url.includes('/api/proxy-image') ? slide.url : `/api/proxy-image?url=${encodeURIComponent(slide.url)}`);

            const res = await fetch(fetchUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            zip.file(filename, blob);
            success++;
        } catch (err) {
            console.warn(`[SocialMediaStudio] Failed to package slide ${i + 1}:`, err);
            failed++;
        }
    }

    onProgress(85, 'Packaging ZIP archive...');
    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    }, (meta) => {
        const p = 85 + Math.round((meta.percent / 100) * 15);
        onProgress(p, `Compressing media reel: ${meta.percent.toFixed(0)}%`);
    });

    onProgress(100, 'Download complete!');
    triggerBlobDownload(zipBlob, zipName);

    return { success, failed };
}
