/**
 * Location & Physical Booth Photos Manager
 * Supports uploading, storing, and mixing real booth photos into social drops.
 */

export interface LocationPhoto {
    id: string;
    locationCode: string; // 'MD' | 'DT' | 'HG' | etc.
    locationName: string; // 'Memory Den', 'Dusty Tiger', etc.
    title: string;        // e.g. 'Main Booth Curio Shelving'
    dataUrl: string;      // Base64 data URL or remote URL
    uploadedAt: string;
    isDefault?: boolean;
}

const STORAGE_KEY = 'resale_command_location_photos';

// Built-in placeholder fallback cards if no real photos uploaded yet
const DEFAULT_LOCATION_CARDS: LocationPhoto[] = [
    {
        id: 'loc_md_default_card',
        locationCode: 'MD',
        locationName: 'Memory Den',
        title: "Memory Den - Huck's Adventures Outfitters",
        dataUrl: createProceduralLocationCard('Memory Den', "Huck's Adventures Outfitters", 'SE 2nd Ave, Portland, OR', '#ec4899', '#8b5cf6'),
        uploadedAt: new Date().toISOString(),
        isDefault: true
    },
    {
        id: 'loc_dt_default_card',
        locationCode: 'DT',
        locationName: 'Dusty Tiger',
        title: 'Dusty Tiger Vintage Booth',
        dataUrl: createProceduralLocationCard('Dusty Tiger', 'Vintage & Curiosities', 'Hawthorne District, Portland, OR', '#f59e0b', '#ef4444'),
        uploadedAt: new Date().toISOString(),
        isDefault: true
    }
];

/**
 * Creates an aesthetic high-resolution SVG/Canvas data URL announcement card
 */
function createProceduralLocationCard(
    storeName: string, 
    subtitle: string, 
    address: string,
    color1: string,
    color2: string
): string {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#111827"/>
          <stop offset="50%" stop-color="#1f2937"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color1}"/>
          <stop offset="100%" stop-color="${color2}"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#grad)"/>
      <rect x="60" y="60" width="960" height="960" rx="40" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="4"/>
      
      <!-- Top Pill -->
      <g transform="translate(540, 200)">
        <rect x="-180" y="-30" width="360" height="60" rx="30" fill="url(#accent)"/>
        <text x="0" y="8" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="24" text-anchor="middle" letter-spacing="3">PHYSICAL BOOTH DROP</text>
      </g>

      <!-- Store Name -->
      <text x="540" y="440" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="72" text-anchor="middle" letter-spacing="-1">${storeName}</text>
      <text x="540" y="520" fill="rgba(255,255,255,0.8)" font-family="system-ui, sans-serif" font-weight="600" font-size="36" text-anchor="middle">${subtitle}</text>

      <!-- Divider line -->
      <line x1="340" y1="590" x2="740" y2="590" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>

      <!-- Location pin badge -->
      <text x="540" y="680" fill="${color1}" font-family="system-ui, sans-serif" font-weight="800" font-size="32" text-anchor="middle">📍 IN-STORE NOW</text>
      <text x="540" y="740" fill="rgba(255,255,255,0.65)" font-family="monospace" font-size="28" text-anchor="middle">${address}</text>

      <!-- Bottom instruction -->
      <rect x="240" y="830" width="600" height="70" rx="20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
      <text x="540" y="875" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="700" font-size="24" text-anchor="middle">Visit In Person • Tagged &amp; Ready on Shelf</text>
    </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Loads all saved location photos from local storage
 */
export function getAllLocationPhotos(): LocationPhoto[] {
    if (typeof window === 'undefined') return DEFAULT_LOCATION_CARDS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_LOCATION_CARDS;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LOCATION_CARDS;
        // Merge user photos with default cards
        return [...parsed, ...DEFAULT_LOCATION_CARDS.filter(d => !parsed.some(p => p.id === d.id))];
    } catch {
        return DEFAULT_LOCATION_CARDS;
    }
}

/**
 * Gets location photos matching a specific facility
 */
export function getLocationPhotosForFacility(facilityCodeOrName: string): LocationPhoto[] {
    const all = getAllLocationPhotos();
    if (!facilityCodeOrName) return all;

    const term = facilityCodeOrName.trim().toLowerCase();
    return all.filter(p => {
        const c = p.locationCode.toLowerCase();
        const n = p.locationName.toLowerCase();
        return c === term || n.includes(term) || term.includes(c) || term.includes(n);
    });
}

/**
 * Saves a new uploaded location photo
 */
export async function saveLocationPhoto(file: File, options: {
    locationCode: string;
    locationName: string;
    title?: string;
}): Promise<LocationPhoto> {
    const dataUrl = await readFileAsDataUrl(file);
    const newPhoto: LocationPhoto = {
        id: `loc_photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        locationCode: options.locationCode || 'MD',
        locationName: options.locationName || 'Memory Den',
        title: options.title || file.name.replace(/\.[^/.]+$/, ''),
        dataUrl,
        uploadedAt: new Date().toISOString(),
        isDefault: false
    };

    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const list: LocationPhoto[] = raw ? JSON.parse(raw) : [];
            list.unshift(newPhoto);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn('[LocationPhotos] Failed saving to localStorage:', e);
        }
    }

    return newPhoto;
}

/**
 * Deletes a location photo
 */
export function deleteLocationPhoto(photoId: string): void {
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const list: LocationPhoto[] = JSON.parse(raw);
        const filtered = list.filter(p => p.id !== photoId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
        console.warn('[LocationPhotos] Failed deleting photo:', e);
    }
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
