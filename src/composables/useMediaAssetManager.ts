import { ref, computed, type Ref } from 'vue';
import { getAssetUrl, cloneItemMediaPayload, duplicateItemMediaInStorage, APPWRITE_PROJECT_ID, BUCKET_ID } from '../lib/inventory';
export { cloneItemMediaPayload, duplicateItemMediaInStorage };
import { addToast } from '../stores/toast';

export interface MainPhotoSelection {
    type: 'existing' | 'new' | 'none';
    val: string | number | null;
}

export interface ResolvedPhoto {
    url: string;
    id?: string | null;
    file?: File | null;
    type: 'existing' | 'new' | 'none';
    idx?: number | null;
}

export interface AiReadyPayload {
    images: string[];
    remoteImageUrls: string[];
}

export interface MediaManagerOptions {
    existingImages?: Ref<string[]> | string[];
    newPhotos?: Ref<any[]> | any[];
    mainSelection?: Ref<MainPhotoSelection>;
    maxPhotos?: number;
    outputFormat?: 'file' | 'object';
}

/**
 * Universal, reusable composable for managing item media, photo galleries,
 * thumbnail selections, and AI vision preparation across Resale Command.
 */
export function useMediaAssetManager(options: MediaManagerOptions = {}) {
    const existingImagesRef = ref<string[]>(
        Array.isArray(options.existingImages) 
            ? [...options.existingImages] 
            : (options.existingImages?.value ? [...options.existingImages.value] : [])
    );

    const newPhotosRef = ref<any[]>(
        Array.isArray(options.newPhotos) 
            ? [...options.newPhotos] 
            : (options.newPhotos?.value ? [...options.newPhotos.value] : [])
    );

    const mainSelectionRef = ref<MainPhotoSelection>(
        options.mainSelection?.value || { type: 'none', val: null }
    );

    const maxPhotos = options.maxPhotos || 20;
    const objectUrlMap = new WeakMap<File, string>();

    // Helper: Turn File into Object URL safely with caching
    const getFileUrl = (file: File): string => {
        if (!objectUrlMap.has(file)) {
            objectUrlMap.set(file, URL.createObjectURL(file));
        }
        return objectUrlMap.get(file)!;
    };

    // Helper: Resolve any item photo reference into a display URL
    const resolvePhotoUrl = (item: any): string => {
        if (!item) return '';
        if (typeof item === 'string') return getAssetUrl(item);
        if (item.url) return item.url;
        if (item instanceof File) return getFileUrl(item);
        if (item.file instanceof File) return getFileUrl(item.file);
        return '';
    };

    // Total photos currently in gallery
    const totalCount = computed(() => {
        return existingImagesRef.value.length + newPhotosRef.value.length;
    });

    // Resolved list of all photo URLs in gallery order (existing first, then newly added)
    const allPhotoUrls = computed<string[]>(() => {
        const urls: string[] = [];
        existingImagesRef.value.forEach(id => {
            const u = getAssetUrl(id);
            if (u && !urls.includes(u)) urls.push(u);
        });
        newPhotosRef.value.forEach(item => {
            const u = resolvePhotoUrl(item);
            if (u && !urls.includes(u)) urls.push(u);
        });
        return urls;
    });

    // Currently designated hero cover photo
    const actualMainPhoto = computed<ResolvedPhoto>(() => {
        const sel = mainSelectionRef.value;
        
        // 1. Explicit selection from newly added photos
        if (sel.type === 'new' && typeof sel.val === 'number' && newPhotosRef.value[sel.val]) {
            const item = newPhotosRef.value[sel.val];
            const file = item instanceof File ? item : item.file;
            return {
                file: file || null,
                url: resolvePhotoUrl(item),
                type: 'new',
                idx: sel.val
            };
        }

        // 2. Explicit selection from existing photos
        if (sel.type === 'existing' && sel.val) {
            const id = String(sel.val);
            if (existingImagesRef.value.includes(id)) {
                return {
                    file: null,
                    url: getAssetUrl(id),
                    id,
                    type: 'existing'
                };
            }
        }

        // 3. Natural fallback: First new photo
        if (newPhotosRef.value.length > 0) {
            const item = newPhotosRef.value[0];
            const file = item instanceof File ? item : item.file;
            return {
                file: file || null,
                url: resolvePhotoUrl(item),
                type: 'new',
                idx: 0
            };
        }

        // 4. Natural fallback: First existing photo
        if (existingImagesRef.value.length > 0) {
            const id = existingImagesRef.value[0];
            return {
                file: null,
                url: getAssetUrl(id),
                id,
                type: 'existing'
            };
        }

        return { file: null, url: '', type: 'none', id: null, idx: null };
    });

    // Set designated main hero photo
    const setMainPhoto = (type: 'existing' | 'new', val: any) => {
        mainSelectionRef.value = { type, val };
        addToast({ type: 'info', message: 'Main cover photo updated ⭐' });
    };

    // Remove photo from existing list
    const removeExisting = (id: string) => {
        existingImagesRef.value = existingImagesRef.value.filter(item => item !== id);
        if (actualMainPhoto.value.id === id) {
            mainSelectionRef.value = { type: 'none', val: null };
        }
    };

    // Remove photo from new files buffer
    const removeNew = (idx: number) => {
        newPhotosRef.value.splice(idx, 1);
        if (actualMainPhoto.value.type === 'new' && actualMainPhoto.value.idx === idx) {
            mainSelectionRef.value = { type: 'none', val: null };
        }
    };

    // Add new files from picker, drag & drop, or camera
    const addFiles = async (files: File[]) => {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            addToast({ type: 'error', message: 'Only image files can be added to the gallery.' });
            return;
        }

        const remainingSlots = maxPhotos - totalCount.value;
        if (remainingSlots <= 0) {
            addToast({ type: 'warning', message: `Gallery limit of ${maxPhotos} photos reached.` });
            return;
        }

        const toAdd = imageFiles.slice(0, remainingSlots);
        newPhotosRef.value.push(...toAdd);

        // Auto-select as main if no photo was active
        if (!actualMainPhoto.value.url && toAdd.length > 0) {
            setMainPhoto('new', newPhotosRef.value.length - toAdd.length);
        }

        addToast({ type: 'success', message: `📸 Added ${toAdd.length} photo${toAdd.length > 1 ? 's' : ''} to gallery!` });
    };

    /**
     * High-speed client-side canvas downscaler (1024px max, 0.85 JPEG).
     * Prevents multi-megabyte camera photos from blowing serverless function payload limits.
     */
    const resizeToCanvasBase64 = (fileOrBlob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                const maxDim = 1024;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context unavailable'));
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => reject(new Error('Failed to load image for downscaling'));
            const reader = new FileReader();
            reader.onload = (e) => (img.src = e.target?.result as string);
            reader.onerror = () => reject(new Error('Failed to read file for canvas downscaling'));
            reader.readAsDataURL(fileOrBlob);
        });
    };

    /**
     * Gathers all images visible in the gallery at the time of the run,
     * downscales local files and remote URLs to base64, and returns the AI-ready payload.
     */
    const getAiReadyPayload = async (additionalItemContext?: { imageId?: string; galleryImageIds?: string[] }): Promise<AiReadyPayload> => {
        const base64Images: string[] = [];
        const remoteUrls: string[] = [];
        const candidateUrls = new Set<string>();

        // 1. Scrape visible <img> elements directly from the photo gallery UI in the DOM
        if (typeof document !== 'undefined') {
            const domImgs = document.querySelectorAll('.photo-gallery-manager img');
            domImgs.forEach((img: any) => {
                if (img?.src && !img.src.includes('data:image/svg')) {
                    candidateUrls.add(img.src);
                }
            });
        }

        // 2. Add computed URLs from all gallery state
        allPhotoUrls.value.forEach(u => {
            if (u) candidateUrls.add(u);
        });

        // 3. Add hero main photo
        if (actualMainPhoto.value.url) {
            candidateUrls.add(actualMainPhoto.value.url);
        }

        // 4. Add additional item context (e.g. from props.item)
        if (additionalItemContext?.imageId) {
            const u = getAssetUrl(additionalItemContext.imageId);
            if (u) candidateUrls.add(u);
        }
        if (Array.isArray(additionalItemContext?.galleryImageIds)) {
            additionalItemContext.galleryImageIds.forEach(id => {
                const u = getAssetUrl(id);
                if (u) candidateUrls.add(u);
            });
        }

        // 5. Downscale newly added local files directly from buffer
        const localFiles: File[] = newPhotosRef.value.map(item => item instanceof File ? item : item.file).filter(Boolean);
        const resizeLocalPromises = localFiles.slice(0, 30).map(async file => {
            try {
                return await resizeToCanvasBase64(file);
            } catch {
                return null;
            }
        });
        const resizedLocals = (await Promise.all(resizeLocalPromises)).filter(Boolean) as string[];
        base64Images.push(...resizedLocals);

        // 6. Process all candidate URLs (blobs, data URLs, and remote URLs)
        const remoteFetchPromises = Array.from(candidateUrls).slice(0, 20).map(async sourceUrl => {
            if (!sourceUrl || typeof sourceUrl !== 'string') return;

            if (sourceUrl.startsWith('data:')) {
                if (!base64Images.includes(sourceUrl)) base64Images.push(sourceUrl);
                return;
            }

            if (sourceUrl.startsWith('blob:')) {
                try {
                    const res = await fetch(sourceUrl);
                    if (res.ok) {
                        const blob = await res.blob();
                        const b64 = await resizeToCanvasBase64(blob);
                        if (b64 && !base64Images.includes(b64)) base64Images.push(b64);
                    }
                } catch {}
                return;
            }

            // HTTP / HTTPS (Appwrite storage or external URL)
            if (!remoteUrls.includes(sourceUrl)) remoteUrls.push(sourceUrl);
            try {
                const res = await fetch(sourceUrl);
                if (res.ok) {
                    const blob = await res.blob();
                    const b64 = await resizeToCanvasBase64(blob);
                    if (b64 && !base64Images.includes(b64)) base64Images.push(b64);
                }
            } catch {
                // If client-side fetch is blocked, remoteUrls will be processed by serverless API
            }
        });

        await Promise.allSettled(remoteFetchPromises);

        return {
            images: base64Images,
            remoteImageUrls: remoteUrls
        };
    };

    /**
     * Copy media from this manager for an item split, extraction, or duplication.
     * Synchronous reference cloning of image IDs.
     */
    const cloneMediaForSplit = (targetIndex?: number, copyAll = false) => {
        return cloneItemMediaPayload({
            imageId: actualMainPhoto.value.id || undefined,
            existingGalleryIds: existingImagesRef.value
        }, {
            targetIndex,
            copyAll
        });
    };

    /**
     * Asynchronous copy method that can be used when splitting or duplicating an item
     * so that child/duplicated items get their OWN independent images from the parent.
     * When deepCopy is true (default), creates independent copies in Appwrite storage.
     * Falls back to reference IDs if storage duplication is disabled or fails.
     */
    const copyMedia = async (options: { targetIndex?: number; copyAll?: boolean; deepCopy?: boolean } = {}) => {
        const { targetIndex, copyAll = false, deepCopy = true } = options;
        if (deepCopy) {
            return await duplicateItemMediaInStorage({
                imageId: actualMainPhoto.value.id || undefined,
                existingGalleryIds: existingImagesRef.value
            }, {
                targetIndex,
                copyAll
            });
        }
        return cloneMediaForSplit(targetIndex, copyAll);
    };

    return {
        existingImages: existingImagesRef,
        newPhotos: newPhotosRef,
        mainSelection: mainSelectionRef,
        totalCount,
        allPhotoUrls,
        actualMainPhoto,
        resolvePhotoUrl,
        setMainPhoto,
        removeExisting,
        removeNew,
        addFiles,
        resizeToCanvasBase64,
        getAiReadyPayload,
        cloneMediaForSplit,
        copyMedia
    };
}

