import JSZip from 'jszip';
import { ambientSoundtrack } from './ambientSoundtrack';
import type { PostMediaSlide, SocialStudioItem } from './socialMediaStudio';

export type OverlayTheme = 'cyberpunk' | 'antique' | 'minimalist' | 'editorial' | 'boutique';
export type AspectRatio = '1:1' | '9:16';
export type OverlayPosition = 'bottom_card' | 'top_banner' | 'center_spotlight' | 'bottom_compact' | 'none';

export interface SlideRenderOptions {
  theme?: OverlayTheme;
  aspectRatio?: AspectRatio;
  position?: OverlayPosition;
  showOverlay?: boolean;
  venueName?: string;
  zoom?: number;
  panX?: number;
  panY?: number;
  opacity?: number;
  fontSizeScale?: number;
  cardOpacity?: number;
  showTitle?: boolean;
  showPrice?: boolean;
  showQuote?: boolean;
  showVenue?: boolean;
}

export const OVERLAY_POSITIONS: Record<OverlayPosition, { label: string; emoji: string }> = {
  bottom_card: { label: 'Bottom Card', emoji: '⬇️' },
  top_banner: { label: 'Top Banner', emoji: '⬆️' },
  center_spotlight: { label: 'Center Spotlight', emoji: '🎯' },
  bottom_compact: { label: 'Bottom Compact', emoji: '▫️' },
  none: { label: 'No Overlay (Raw)', emoji: '🚫' }
};

export const OVERLAY_THEMES: Record<OverlayTheme, { label: string; emoji: string; previewClass: string }> = {
  cyberpunk: {
    label: 'Cyberpunk Neon',
    emoji: '💾',
    previewClass: 'bg-black/90 text-cyan-400 border-pink-500 font-mono'
  },
  antique: {
    label: "Huck's Antique Scholar",
    emoji: '🏛️',
    previewClass: 'bg-[#1b1511]/95 text-amber-100 border-amber-600 font-serif'
  },
  minimalist: {
    label: 'Modern Minimalist',
    emoji: '⚡',
    previewClass: 'bg-black/90 text-white border-white/40 font-sans'
  },
  editorial: {
    label: 'Vogue Editorial',
    emoji: '✨',
    previewClass: 'bg-white/95 text-black border-black font-serif'
  },
  boutique: {
    label: 'Vintage Boutique',
    emoji: '🏷️',
    previewClass: 'bg-amber-950/90 text-amber-200 border-amber-400 font-mono'
  }
};

/**
 * Loads an image from a URL or data URL and returns an HTMLImageElement.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    let triedProxy = false;
    img.onerror = () => {
      // If direct load failed and it's not already proxied, try image proxy once
      if (!triedProxy && !src.startsWith('data:') && !src.startsWith('blob:') && !src.includes('/api/proxy-image')) {
        triedProxy = true;
        img.src = `/api/proxy-image?url=${encodeURIComponent(src)}`;
      } else {
        reject(new Error(`Failed to load image: ${src.slice(0, 50)}`));
      }
    };
    img.src = src;
  });
}

/**
 * Renders a single slide onto a 2D canvas context with the selected theme,
 * backdrop gradients, and stylized typography.
 */
export function renderSlideToCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  slide: { title: string; price?: number | string; description?: string; locationName?: string },
  options?: SlideRenderOptions
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const theme = options?.theme || 'antique';
  const showOverlay = options?.showOverlay !== false;
  const zoom = options?.zoom || 1.0;
  const panX = options?.panX || 0;
  const panY = options?.panY || 0;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Draw Image with Fill / Cover + Zoom/Pan
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = width / height;

  let drawW = width;
  let drawH = height;
  let drawX = 0;
  let drawY = 0;

  if (imgAspect > canvasAspect) {
    drawW = height * imgAspect;
    drawX = (width - drawW) / 2;
  } else {
    drawH = width / imgAspect;
    drawY = (height - drawH) / 2;
  }

  // Apply motion zoom/pan
  const zoomedW = drawW * zoom;
  const zoomedH = drawH * zoom;
  const zoomedX = drawX - (zoomedW - drawW) / 2 + panX;
  const zoomedY = drawY - (zoomedH - drawH) / 2 + panY;

  ctx.drawImage(img, zoomedX, zoomedY, zoomedW, zoomedH);

  // 2. Draw Vignette Gradient based on position
  const position = options?.position || 'bottom_card';
  if (showOverlay && position !== 'none') {
    const gradientHeight = height * 0.58;
    let gradient: CanvasGradient;

    if (position === 'top_banner') {
      gradient = ctx.createLinearGradient(0, gradientHeight, 0, 0);
    } else if (position === 'center_spotlight') {
      gradient = ctx.createLinearGradient(0, height * 0.15, 0, height * 0.85);
    } else {
      gradient = ctx.createLinearGradient(0, height - gradientHeight, 0, height);
    }

    if (theme === 'antique') {
      gradient.addColorStop(0, 'rgba(15, 11, 8, 0)');
      gradient.addColorStop(0.35, 'rgba(15, 11, 8, 0.65)');
      gradient.addColorStop(1, 'rgba(15, 11, 8, 0.96)');
    } else if (theme === 'cyberpunk') {
      gradient.addColorStop(0, 'rgba(5, 7, 15, 0)');
      gradient.addColorStop(0.35, 'rgba(5, 7, 15, 0.75)');
      gradient.addColorStop(1, 'rgba(5, 7, 15, 0.98)');
    } else if (theme === 'editorial') {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.7)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.96)');
    } else {
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.35, 'rgba(0, 0, 0, 0.65)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    }

    ctx.fillStyle = gradient;
    if (position === 'top_banner') {
      ctx.fillRect(0, 0, width, gradientHeight);
    } else if (position === 'center_spotlight') {
      ctx.fillRect(0, height * 0.15, width, height * 0.7);
    } else {
      ctx.fillRect(0, height - gradientHeight, width, gradientHeight);
    }

    // 3. Render Theme-Specific Overlay Card & Typography
    renderThemeCard(ctx, width, height, slide, options);
  }

  ctx.restore();
}

/**
 * Draws the stylized typography, price badges, and micro-narrative card.
 */
function renderThemeCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  slide: { title: string; price?: number | string; description?: string; locationName?: string },
  options?: SlideRenderOptions
) {
  const theme = options?.theme || 'antique';
  const position = options?.position || 'bottom_card';
  if (position === 'none' || options?.showOverlay === false) return;

  const padX = width * 0.055;
  const cardW = width - (padX * 2);
  const cardBottom = height - (height * 0.045);
  const title = slide.title || 'Curated Artifact';
  const priceNum = Number(slide.price);
  const priceStr = !isNaN(priceNum) && priceNum > 0 ? `$${priceNum.toFixed(2)}` : '';
  const venue = options?.venueName || slide.locationName || 'Memory Den';
  const desc = options?.showQuote !== false ? (slide.description || '') : '';
  const showTitle = options?.showTitle !== false;
  const showPrice = options?.showPrice !== false;
  const showVenue = options?.showVenue !== false;
  const cardOpacity = typeof options?.cardOpacity === 'number' ? options.cardOpacity : 0.88;
  const fontScale = options?.fontSizeScale || 1.0;

  ctx.save();

  if (theme === 'antique') {
    // -------------------------------------------------------------
    // THEME: HUCK'S ANTIQUE SCHOLAR (Warm Sepia & Gold Filigree)
    // -------------------------------------------------------------
    let cardH = desc ? height * 0.38 : height * 0.22;
    if (position === 'bottom_compact') {
      cardH = desc ? height * 0.28 : height * 0.16;
    }

    let cardY = cardBottom - cardH;
    if (position === 'top_banner') {
      cardY = height * 0.045;
    } else if (position === 'center_spotlight') {
      cardY = (height - cardH) / 2;
    }

    // Translucent dark parchment backing with adjustable opacity
    ctx.fillStyle = `rgba(26, 19, 14, ${cardOpacity})`;
    roundRect(ctx, padX, cardY, cardW, cardH, 24);
    ctx.fill();

    // Dual Gold Accent Border
    ctx.strokeStyle = '#d97706'; // warm amber gold
    ctx.lineWidth = 2.5;
    roundRect(ctx, padX, cardY, cardW, cardH, 24);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
    ctx.lineWidth = 1;
    roundRect(ctx, padX + 5, cardY + 5, cardW - 10, cardH - 10, 20);
    ctx.stroke();

    let currentY = cardY + Math.round(36 * fontScale);

    // Header Tag: 🏛️ ARCHIVES OF HUCK'S HIDEOUT
    if (showVenue) {
      ctx.font = `bold ${Math.round(22 * fontScale)}px "Georgia", serif`;
      ctx.fillStyle = '#fbbf24';
      ctx.letterSpacing = '2px';
      ctx.fillText(`🏛️ ARCHIVES OF ${venue.toUpperCase()}`, padX + 24, currentY);
      currentY += Math.round(46 * fontScale);
    } else {
      currentY += Math.round(20 * fontScale);
    }

    // Title & Price Row
    if (showTitle) {
      ctx.font = `bold italic ${Math.round(44 * fontScale)}px "Georgia", serif`;
      ctx.fillStyle = '#ffffff';
      ctx.letterSpacing = '0px';

      const maxTitleW = (showPrice && priceStr) ? cardW - 200 : cardW - 48;
      const truncatedTitle = truncateText(ctx, title, maxTitleW);
      ctx.fillText(truncatedTitle, padX + 24, currentY);
    }

    if (showPrice && priceStr) {
      // Gold Price Pill on right
      const pillW = 140;
      const pillH = Math.round(46 * fontScale);
      const pillX = padX + cardW - pillW - 24;
      const pillY = currentY - Math.round(34 * fontScale);

      ctx.fillStyle = '#d97706';
      roundRect(ctx, pillX, pillY, pillW, pillH, 23);
      ctx.fill();

      ctx.font = `black ${Math.round(26 * fontScale)}px "Courier New", monospace`;
      ctx.fillStyle = '#1c130d';
      ctx.textAlign = 'center';
      ctx.fillText(priceStr, pillX + (pillW / 2), pillY + Math.round(32 * fontScale));
      ctx.textAlign = 'left';
    }

    // Micro-narrative Description (Italicized literary quote)
    if (showQuote && desc) {
      currentY += 28;
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.25)';
      ctx.beginPath();
      ctx.moveTo(padX + 24, currentY);
      ctx.lineTo(padX + cardW - 24, currentY);
      ctx.stroke();

      currentY += 32;
      ctx.font = `italic ${Math.round(23 * fontScale)}px "Georgia", serif`;
      ctx.fillStyle = '#e2d9cf';
      wrapText(ctx, `"${desc}"`, padX + 24, currentY, cardW - 48, Math.round(34 * fontScale), 4);
    }

  } else if (theme === 'cyberpunk') {
    // -------------------------------------------------------------
    // THEME: RETRO-TECH CYBERPUNK (Neon Cyan & Electric Magenta)
    // -------------------------------------------------------------
    let cardH = desc ? height * 0.36 : height * 0.21;
    if (position === 'bottom_compact') {
      cardH = desc ? height * 0.26 : height * 0.15;
    }

    let cardY = cardBottom - cardH;
    if (position === 'top_banner') {
      cardY = height * 0.045;
    } else if (position === 'center_spotlight') {
      cardY = (height - cardH) / 2;
    }

    // Dark HUD Backing
    ctx.fillStyle = `rgba(8, 11, 20, ${cardOpacity})`;
    roundRect(ctx, padX, cardY, cardW, cardH, 18);
    ctx.fill();

    // Electric Cyan Border
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    roundRect(ctx, padX, cardY, cardW, cardH, 18);
    ctx.stroke();

    // Magenta Left Accent Pillar
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(padX, cardY + 12, 6, cardH - 24);

    let currentY = cardY + Math.round(34 * fontScale);

    // HUD Header Tag: // SYSTEM SPECIMEN //
    if (showVenue) {
      ctx.font = `bold ${Math.round(20 * fontScale)}px "Courier New", monospace`;
      ctx.fillStyle = '#ec4899';
      ctx.fillText(`// SYSTEM SPECIMEN: ${venue.toUpperCase()} //`, padX + 24, currentY);
      currentY += Math.round(44 * fontScale);
    } else {
      currentY += Math.round(18 * fontScale);
    }

    // Title
    if (showTitle) {
      ctx.font = `900 ${Math.round(42 * fontScale)}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      const maxTitleW = (showPrice && priceStr) ? cardW - 210 : cardW - 48;
      ctx.fillText(truncateText(ctx, title, maxTitleW), padX + 24, currentY);
    }

    // Glowing Neon Price Badge
    if (showPrice && priceStr) {
      const pillW = 150;
      const pillH = Math.round(44 * fontScale);
      const pillX = padX + cardW - pillW - 20;
      const pillY = currentY - Math.round(34 * fontScale);

      ctx.fillStyle = '#06b6d4';
      roundRect(ctx, pillX, pillY, pillW, pillH, 8);
      ctx.fill();

      ctx.font = `black ${Math.round(26 * fontScale)}px "Courier New", monospace`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(priceStr, pillX + (pillW / 2), pillY + Math.round(31 * fontScale));
      ctx.textAlign = 'left';
    }

    // Micro-narrative description
    if (showQuote && desc) {
      currentY += Math.round(34 * fontScale);
      ctx.font = `500 ${Math.round(23 * fontScale)}px "Courier New", monospace`;
      ctx.fillStyle = '#a5f3fc';
      wrapText(ctx, `> ${desc}`, padX + 24, currentY, cardW - 48, Math.round(32 * fontScale), 4);
    }

  } else if (theme === 'editorial') {
    // -------------------------------------------------------------
    // THEME: VOGUE EDITORIAL (High Fashion Minimal White & Black)
    // -------------------------------------------------------------
    let cardH = desc ? height * 0.35 : height * 0.20;
    if (position === 'bottom_compact') {
      cardH = desc ? height * 0.25 : height * 0.15;
    }

    let cardY = cardBottom - cardH;
    if (position === 'top_banner') {
      cardY = height * 0.045;
    } else if (position === 'center_spotlight') {
      cardY = (height - cardH) / 2;
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${cardOpacity})`;
    roundRect(ctx, padX, cardY, cardW, cardH, 20);
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    roundRect(ctx, padX, cardY, cardW, cardH, 20);
    ctx.stroke();

    let currentY = cardY + Math.round(34 * fontScale);
    if (showVenue) {
      ctx.font = `900 ${Math.round(18 * fontScale)}px sans-serif`;
      ctx.fillStyle = '#666666';
      ctx.fillText(`${venue.toUpperCase()} • CURATION`, padX + 24, currentY);
      currentY += Math.round(46 * fontScale);
    } else {
      currentY += Math.round(18 * fontScale);
    }

    if (showTitle) {
      ctx.font = `italic bold ${Math.round(44 * fontScale)}px "Georgia", serif`;
      ctx.fillStyle = '#000000';
      const maxTitleW = (showPrice && priceStr) ? cardW - 190 : cardW - 48;
      ctx.fillText(truncateText(ctx, title, maxTitleW), padX + 24, currentY);
    }

    if (showPrice && priceStr) {
      const pillW = 140;
      const pillH = Math.round(44 * fontScale);
      const pillX = padX + cardW - pillW - 20;
      const pillY = currentY - Math.round(34 * fontScale);

      ctx.fillStyle = '#000000';
      roundRect(ctx, pillX, pillY, pillW, pillH, 22);
      ctx.fill();

      ctx.font = `bold ${Math.round(24 * fontScale)}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(priceStr, pillX + (pillW / 2), pillY + Math.round(31 * fontScale));
      ctx.textAlign = 'left';
    }

    if (showQuote && desc) {
      currentY += Math.round(34 * fontScale);
      ctx.font = `400 ${Math.round(23 * fontScale)}px sans-serif`;
      ctx.fillStyle = '#222222';
      wrapText(ctx, desc, padX + 24, currentY, cardW - 48, Math.round(32 * fontScale), 4);
    }

  } else {
    // -------------------------------------------------------------
    // DEFAULT MINIMALIST MODERN / BOUTIQUE
    // -------------------------------------------------------------
    let cardH = desc ? height * 0.34 : height * 0.19;
    if (position === 'bottom_compact') {
      cardH = desc ? height * 0.25 : height * 0.14;
    }

    let cardY = cardBottom - cardH;
    if (position === 'top_banner') {
      cardY = height * 0.045;
    } else if (position === 'center_spotlight') {
      cardY = (height - cardH) / 2;
    }

    ctx.fillStyle = `rgba(15, 23, 42, ${cardOpacity})`;
    roundRect(ctx, padX, cardY, cardW, cardH, 22);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, padX, cardY, cardW, cardH, 22);
    ctx.stroke();

    let currentY = cardY + Math.round(34 * fontScale);
    if (showVenue) {
      ctx.font = `bold ${Math.round(19 * fontScale)}px sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`📍 ${venue.toUpperCase()}`, padX + 24, currentY);
      currentY += Math.round(46 * fontScale);
    } else {
      currentY += Math.round(18 * fontScale);
    }

    if (showTitle) {
      ctx.font = `900 ${Math.round(42 * fontScale)}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      const maxTitleW = (showPrice && priceStr) ? cardW - 190 : cardW - 48;
      ctx.fillText(truncateText(ctx, title, maxTitleW), padX + 24, currentY);
    }

    if (showPrice && priceStr) {
      const pillW = 140;
      const pillH = Math.round(44 * fontScale);
      const pillX = padX + cardW - pillW - 20;
      const pillY = currentY - Math.round(34 * fontScale);

      ctx.fillStyle = '#10b981'; // Emerald
      roundRect(ctx, pillX, pillY, pillW, pillH, 22);
      ctx.fill();

      ctx.font = `bold ${Math.round(24 * fontScale)}px monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(priceStr, pillX + (pillW / 2), pillY + Math.round(31 * fontScale));
      ctx.textAlign = 'left';
    }

    if (showQuote && desc) {
      currentY += Math.round(34 * fontScale);
      ctx.font = `400 ${Math.round(23 * fontScale)}px sans-serif`;
      ctx.fillStyle = '#cbd5e1';
      wrapText(ctx, desc, padX + 24, currentY, cardW - 48, Math.round(32 * fontScale), 4);
    }
  }

  ctx.restore();
}

/**
 * Helper to truncate text to fit a max width.
 */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let len = text.length;
  while (len > 3) {
    len--;
    const sub = text.slice(0, len) + '…';
    if (ctx.measureText(sub).width <= maxWidth) return sub;
  }
  return text;
}

/**
 * Helper to wrap text with line height and max lines limit.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 4
): void {
  const words = text.split(/\s+/);
  let line = '';
  let lineCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + (line ? ' ' : '') + words[n];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n];
      y += lineHeight;
      lineCount++;
      if (lineCount >= maxLines - 1 && n < words.length - 1) {
        // Truncate remaining
        ctx.fillText(truncateText(ctx, line + ' ' + words.slice(n + 1).join(' '), maxWidth), x, y);
        return;
      }
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
  }
}

/**
 * Draws rounded rectangle path on canvas.
 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders a slide directly to a high-resolution Blob (JPEG or PNG).
 */
export async function renderSlideToBlob(
  slide: PostMediaSlide,
  options?: SlideRenderOptions
): Promise<Blob> {
  const isVertical = options?.aspectRatio === '9:16';
  const width = 1080;
  const height = isVertical ? 1920 : 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  const img = await loadImage(slide.url);
  renderSlideToCanvas(ctx, img, slide, options);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/jpeg', 0.94);
  });
}

/**
 * Batch-burns all slides with their stylized text overlays and packages
 * them into a sequentially numbered ZIP archive.
 */
export async function burnAllSlidesToZip(
  slides: PostMediaSlide[],
  options?: SlideRenderOptions & { onProgress?: (pct: number, msg: string) => void }
): Promise<Blob> {
  const zip = new JSZip();
  const total = slides.length;
  const onProgress = options?.onProgress || (() => {});

  for (let i = 0; i < total; i++) {
    const slide = slides[i];
    const pct = Math.round((i / total) * 80);
    onProgress(pct, `Burning text on slide ${i + 1}/${total}: ${slide.title.slice(0, 20)}...`);

    const blob = await renderSlideToBlob(slide, options);
    const numPrefix = String(i + 1).padStart(2, '0');
    const safeTitle = (slide.title || 'Slide').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    zip.file(`${numPrefix}_${safeTitle}.jpg`, blob);
  }

  onProgress(85, 'Packaging ZIP archive...');
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  }, meta => {
    onProgress(85 + Math.round((meta.percent / 100) * 15), `Compressing: ${meta.percent.toFixed(0)}%`);
  });

  onProgress(100, 'Download ready!');
  return zipBlob;
}

/**
 * Exports animated slideshow with transitions and live soundtrack directly into an MP4/WebM video.
 */
export async function exportSlidesToVideo(
  slides: PostMediaSlide[],
  options: SlideRenderOptions & {
    soundPreset?: 'cyberpunk' | 'antique' | 'lofi' | 'ethereal' | 'none';
    customAudioFile?: File | Blob;
    durationPerSlideSec?: number;
    onProgress?: (pct: number, msg: string) => void;
  }
): Promise<Blob> {
  if (slides.length === 0) throw new Error('No slides to export');

  const onProgress = options.onProgress || (() => {});
  const isVertical = options.aspectRatio === '9:16';
  const width = 1080;
  const height = isVertical ? 1920 : 1080;
  const durationPerSlide = options.durationPerSlideSec || 3.5;
  const fps = 30;
  const totalSlideFrames = Math.round(durationPerSlide * fps);
  const transitionFrames = Math.round(0.7 * fps); // 0.7s cross-fade

  onProgress(5, 'Preloading slide media assets...');
  const loadedImages: HTMLImageElement[] = [];
  for (let i = 0; i < slides.length; i++) {
    onProgress(5 + Math.round((i / slides.length) * 15), `Loading photo ${i + 1}/${slides.length}...`);
    const img = await loadImage(slides[i].url);
    loadedImages.push(img);
  }

  // Set up canvas & audio stream
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Failed to create canvas 2D context');

  // Start sound generator
  if (options.customAudioFile || (options.soundPreset && options.soundPreset !== 'none')) {
    await ambientSoundtrack.play((options.soundPreset || 'none') as any, options.customAudioFile);
  }

  const canvasStream = canvas.captureStream(fps);
  const audioStream = ambientSoundtrack.getAudioStream();

  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
  if (audioStream && audioStream.getAudioTracks().length > 0) {
    audioStream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
  }

  // Determine supported recorder format
  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4';
    }
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
    videoBitsPerSecond: 6_000_000 // 6 Mbps crisp export
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingFinished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      ambientSoundtrack.stop();
      const finalBlob = new Blob(chunks, { type: mimeType });
      resolve(finalBlob);
    };
    recorder.onerror = err => {
      ambientSoundtrack.stop();
      reject(err);
    };
  });

  recorder.start();

  // Render loop frame-by-frame
  const totalFrames = slides.length * totalSlideFrames;
  let currentFrame = 0;

  for (let sIdx = 0; sIdx < slides.length; sIdx++) {
    const slide = slides[sIdx];
    const img = loadedImages[sIdx];
    const nextSlide = slides[(sIdx + 1) % slides.length];
    const nextImg = loadedImages[(sIdx + 1) % slides.length];

    for (let f = 0; f < totalSlideFrames; f++) {
      currentFrame++;
      const progress = f / totalSlideFrames;
      const zoom = 1.0 + (progress * 0.07); // gentle Ken Burns zoom
      const panX = Math.sin(progress * Math.PI) * 15;

      // Render base slide
      renderSlideToCanvas(ctx, img, slide, {
        ...options,
        zoom,
        panX,
        showOverlay: options.position !== 'none'
      });

      // Handle cross-fade transition during the last transitionFrames
      if (f >= totalSlideFrames - transitionFrames && slides.length > 1) {
        const transProg = (f - (totalSlideFrames - transitionFrames)) / transitionFrames;
        ctx.save();
        ctx.globalAlpha = transProg;
        renderSlideToCanvas(ctx, nextImg, nextSlide, {
          ...options,
          zoom: 1.0,
          showOverlay: options.position !== 'none'
        });
        ctx.restore();
      }

      if (currentFrame % 10 === 0) {
        const overallPct = 20 + Math.round((currentFrame / totalFrames) * 75);
        onProgress(overallPct, `Rendering Reel video: ${Math.round((currentFrame / totalFrames) * 100)}% (${Math.round(currentFrame / fps)}s)`);
      }

      // Yield event loop to allow video frame encoding
      await new Promise(r => setTimeout(r, 1000 / fps));
    }
  }

  onProgress(96, 'Finalizing video stream & audio mix...');
  recorder.stop();

  const finalVideo = await recordingFinished;
  onProgress(100, 'Video ready to post!');
  return finalVideo;
}

/**
 * Intelligent helper: Parses paragraphs from AI generated caption text
 * and maps each paragraph to the matching slide/item.
 */
export function parseItemDescriptionsFromCaption(
  caption: string,
  items: SocialStudioItem[]
): Record<number, string> {
  const result: Record<number, string> = {};
  if (!caption || items.length === 0) return result;

  // Split caption by double newlines into clean paragraphs
  const paragraphs = caption
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 25);

  // Filter out introduction, outro, and call-to-action paragraphs
  const candidateParagraphs = paragraphs.filter(p => {
    const lower = p.toLowerCase();
    if (lower.startsWith('within the quiet') || lower.startsWith('for the collector') || lower.startsWith('visit our') || lower.startsWith('emerging from')) {
      return false;
    }
    if (lower.includes('dm for details') || lower.includes('claim your own') || lower.includes('inquire via dm')) {
      return true;
    }
    return true;
  });

  // Assign paragraphs to items by title matching or sequential order
  items.forEach((item, idx) => {
    const itemWords = (item.title || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);

    // Look for paragraph containing key title words
    let matched = candidateParagraphs.find(p => {
      const pLower = p.toLowerCase();
      return itemWords.some(w => pLower.includes(w));
    });

    if (!matched && candidateParagraphs[idx]) {
      matched = candidateParagraphs[idx];
    }

    if (matched) {
      // Clean trailing "DM for details" or hashtags
      const cleaned = matched
        .replace(/DM for details\.?/i, '')
        .replace(/#[a-zA-Z0-9_]+/g, '')
        .trim();
      result[idx] = cleaned;
    }
  });

  return result;
}
