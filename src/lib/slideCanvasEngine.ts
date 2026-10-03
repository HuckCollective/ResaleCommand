import JSZip from 'jszip';
import { ambientSoundtrack } from './ambientSoundtrack';
import type { PostMediaSlide, SocialStudioItem } from './socialMediaStudio';

export type OverlayTheme = 'instagram' | 'tiktok' | 'cyberpunk' | 'neo' | 'antique' | 'minimalist' | 'editorial' | 'boutique';
export type AspectRatio = '1:1' | '9:16';
export type OverlayPosition = 'bottom_card' | 'top_banner' | 'center_spotlight' | 'bottom_compact' | 'none';
export type CardStyleTreatment = 
  | 'tiktok_scrim' 
  | 'grailed_editorial' 
  | 'whatnot_pill' 
  | 'cyber_neon' 
  | 'portland_editorial'
  | 'promo_flyer'
  | 'instagram_pill' 
  | 'card' 
  | 'glass' 
  | 'floating_pill' 
  | 'clean_text' 
  | 'cinematic_lower_third';

export const CARD_TREATMENTS: Record<CardStyleTreatment, { label: string; emoji: string; description: string; tag?: string }> = {
  portland_editorial: { label: 'Portland Alt-Weekly (Story Card)', emoji: '📰', description: 'Crisp white paper editorial box with black text over photo collage, matching Portland Mercury', tag: 'STORY CARD' },
  promo_flyer: { label: 'Promo Ad Flyer (Pin Depot)', emoji: '🎯', description: 'Bold top title banner, accent ribbon callout, clean product showcase, matching Pin Depot ad', tag: 'HERO AD' },
  tiktok_scrim: { label: 'TikTok / Reel Scrim', emoji: '📱', description: 'Cinematic bottom fade, bold white sans, zero clunky box', tag: 'VIRAL REELS' },
  grailed_editorial: { label: 'Grailed Editorial', emoji: '🏷️', description: 'Luxury streetwear aesthetic, wide-spaced mono, frosted glass', tag: 'LUXURY DROP' },
  whatnot_pill: { label: 'WhatNot Live Spec', emoji: '🛍️', description: 'Micro-pill in corner, 1-line spec, 95% photo open', tag: 'ZERO BLOCK' },
  cyber_neon: { label: 'Neo Spike Pop', emoji: '🚬', description: 'Spike Spiegel Bebop noir, syndicate cyan glow & amber bounty tag, tactical HUD', tag: 'SPIKE NOIR' },
  instagram_pill: { label: 'IG Story Sticker', emoji: '📸', description: 'Translucent rounded pill, signature Instagram sticker style', tag: 'STORY' },
  floating_pill: { label: 'Product Tag', emoji: '🛍️', description: 'Ultra-compact capsule for maximum photo view', tag: 'MINIMAL' },
  clean_text: { label: 'Clean (No Box)', emoji: '✨', description: 'Direct text with shadow, zero background obstruction', tag: 'PURE' },
  glass: { label: 'Frosted Glass', emoji: '🛡️', description: 'Translucent glass with fine border', tag: 'GLASS' },
  card: { label: 'Snug Card', emoji: '🔲', description: 'Content-hugging solid or classic card', tag: 'CLASSIC' },
  cinematic_lower_third: { label: 'Lower Third', emoji: '🎬', description: 'Soft cinematic fade across bottom', tag: 'BROADCAST' }
};

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
  vignetteOpacity?: number; // 0 = no bleed (default), 0.20 = soft, 0.45 = medium
  cardTreatment?: CardStyleTreatment;
  accentColor?: string; // custom hex color
  showTitle?: boolean;
  showPrice?: boolean;
  showQuote?: boolean;
  showVenue?: boolean;
  autoCropWatermark?: boolean; // automatically trims top/bottom auction watermarks
}

export const OVERLAY_POSITIONS: Record<OverlayPosition, { label: string; emoji: string }> = {
  bottom_card: { label: 'Bottom Card (Safe Zone)', emoji: '⬇️' },
  top_banner: { label: 'Top Banner', emoji: '⬆️' },
  center_spotlight: { label: 'Center Spotlight', emoji: '🎯' },
  bottom_compact: { label: 'Bottom Compact', emoji: '▫️' },
  none: { label: 'No Overlay (Raw Photo)', emoji: '🚫' }
};

export const OVERLAY_THEMES: Record<OverlayTheme, { label: string; emoji: string; previewClass: string }> = {
  instagram: {
    label: 'Instagram Reels',
    emoji: '📸',
    previewClass: 'bg-black/85 text-white border-pink-500 font-sans'
  },
  tiktok: {
    label: 'TikTok Viral',
    emoji: '🎵',
    previewClass: 'bg-black/90 text-white border-cyan-400 font-sans'
  },
  cyberpunk: {
    label: 'Neo Spike (Bebop Noir)',
    emoji: '🚬',
    previewClass: 'bg-black/90 text-cyan-400 border-cyan-400 font-mono'
  },
  neo: {
    label: 'Neo Spike (Spiegel Persona)',
    emoji: '🚬',
    previewClass: 'bg-[#060912] text-cyan-400 border-cyan-400 font-mono'
  },
  antique: {
    label: "Huck's Antique Scholar",
    emoji: '🏛️',
    previewClass: 'bg-[#1b1511]/95 text-amber-100 border-amber-600 font-serif'
  },
  editorial: {
    label: 'Vogue Editorial',
    emoji: '✨',
    previewClass: 'bg-white/95 text-black border-black font-serif'
  },
  boutique: {
    label: 'Vintage Boutique',
    emoji: '🏷️',
    previewClass: 'bg-amber-950/90 text-amber-200 border-amber-400 font-sans'
  },
  minimalist: {
    label: 'Modern Minimalist',
    emoji: '⚡',
    previewClass: 'bg-black/90 text-white border-white/40 font-sans'
  }
};

/**
 * Generates an in-memory styled slide card when an image is missing, loading, or fails to load.
 * This guarantees the reel canvas or video export never renders pitch black!
 */
export function createFallbackImage(title?: string, theme: OverlayTheme = 'antique'): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallbackImg = new Image();
      fallbackImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="%2318181b"/><text x="540" y="540" fill="%23aaa" font-size="44" text-anchor="middle" font-family="sans-serif">Hero Spotlight</text></svg>';
      fallbackImg.onload = () => resolve(fallbackImg);
      return;
    }

    const palette = getThemePalette(theme);

    // Dynamic gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    if (theme === 'antique') {
      bgGrad.addColorStop(0, '#1c1511');
      bgGrad.addColorStop(0.5, '#2b1f18');
      bgGrad.addColorStop(1, '#0e0b09');
    } else if (theme === 'cyberpunk') {
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(0.5, '#121b2d');
      bgGrad.addColorStop(1, '#04060a');
    } else if (theme === 'editorial') {
      bgGrad.addColorStop(0, '#f5f5f4');
      bgGrad.addColorStop(0.5, '#e7e5e4');
      bgGrad.addColorStop(1, '#d6d3d1');
    } else {
      bgGrad.addColorStop(0, '#18181b');
      bgGrad.addColorStop(0.5, '#27272a');
      bgGrad.addColorStop(1, '#09090b');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Decorative inner frame
    ctx.strokeStyle = palette.dividerColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, 980, 980);

    // Subtitle badge
    ctx.font = `bold 24px ${palette.fontFamilyMono}`;
    ctx.fillStyle = palette.badgeText;
    ctx.textAlign = 'center';
    ctx.fillText('✨ DROPCAST SPOTLIGHT', 540, 440);

    // Slide Title
    const cleanTitle = (title || 'Curated Relic Spotlight').trim();
    ctx.font = `bold 52px ${palette.fontFamilyTitle}`;
    ctx.fillStyle = palette.titleColor;
    wrapText(ctx, cleanTitle, 540, 520, 860, 68, 3);

    const img = new Image();
    img.onload = () => resolve(img);
    img.src = canvas.toDataURL('image/jpeg', 0.85);
  });
}

/**
 * Loads an image from a URL, data URL, or proxy with robust multi-stage fallbacks.
 * Never rejects: falls back safely to prevent black screen renders!
 */
export function loadImage(src?: string, fallbackTitle?: string, fallbackTheme?: OverlayTheme): Promise<HTMLImageElement> {
  const cleanSrc = (src || '').trim();
  if (!cleanSrc || cleanSrc === 'undefined' || cleanSrc === 'null') {
    return createFallbackImage(fallbackTitle, fallbackTheme);
  }

  // Direct load for data / blob
  if (cleanSrc.startsWith('data:') || cleanSrc.startsWith('blob:')) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        createFallbackImage(fallbackTitle, fallbackTheme).then(resolve);
      };
      img.src = cleanSrc;
    });
  }

  // Resolve relative URLs to absolute so server-side fetch/proxy won't fail
  let targetUrl = cleanSrc;
  if (!cleanSrc.includes('://') && typeof window !== 'undefined') {
    targetUrl = `${window.location.origin}${cleanSrc.startsWith('/') ? '' : '/'}${cleanSrc}`;
  }

  return new Promise((resolve) => {
    // Attempt 1: Direct load with crossOrigin = 'anonymous' (ideal for canvas export)
    const img1 = new Image();
    img1.crossOrigin = 'anonymous';
    img1.onload = () => resolve(img1);
    img1.onerror = () => {
      // Attempt 2: Fetch via /api/proxy-image as Blob (Guarantees CORS-clean, untainted canvas export)
      const proxyUrl = targetUrl.includes('/api/proxy-image')
        ? targetUrl
        : `/api/proxy-image?url=${encodeURIComponent(targetUrl)}`;
      fetch(proxyUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`Proxy status: ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const blobImg = new Image();
          blobImg.onload = () => resolve(blobImg);
          blobImg.onerror = () => {
            // Attempt 3: Try direct load WITHOUT crossOrigin (works for playback)
            const img3 = new Image();
            img3.onload = () => resolve(img3);
            img3.onerror = () => {
              createFallbackImage(fallbackTitle, fallbackTheme).then(resolve);
            };
            img3.src = targetUrl;
          };
          blobImg.src = blobUrl;
        })
        .catch(() => {
          // Attempt 3: Try direct load WITHOUT crossOrigin
          const img3 = new Image();
          img3.onload = () => resolve(img3);
          img3.onerror = () => {
            createFallbackImage(fallbackTitle, fallbackTheme).then(resolve);
          };
          img3.src = targetUrl;
        });
    };
    img1.src = targetUrl;
  });
}

/**
 * Resolves theme color palettes and typography rules.
 */
export function getThemePalette(theme: OverlayTheme, customAccent?: string) {
  switch (theme) {
    case 'instagram':
      return {
        accent: customAccent || '#e1306c',
        badgeText: '#f43f5e',
        titleColor: '#ffffff',
        quoteColor: '#f1f5f9',
        cardFillRgb: '18, 18, 24',
        borderColor: customAccent || 'rgba(255, 255, 255, 0.28)',
        dividerColor: 'rgba(255, 255, 255, 0.16)',
        priceBg: '#ffffff',
        priceText: '#000000',
        fontFamilyTitle: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        fontFamilyBody: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        fontFamilyMono: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      };
    case 'tiktok':
      return {
        accent: customAccent || '#00f2fe',
        badgeText: '#00f2fe',
        titleColor: '#ffffff',
        quoteColor: '#ffffff',
        cardFillRgb: '4, 4, 6',
        borderColor: customAccent || '#fe2c55',
        dividerColor: 'rgba(254, 44, 85, 0.35)',
        priceBg: '#fe2c55',
        priceText: '#ffffff',
        fontFamilyTitle: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontFamilyBody: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontFamilyMono: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      };
    case 'neo':
    case 'cyberpunk':
      return {
        accent: customAccent || '#00f0ff',
        badgeText: customAccent ? customAccent : '#fbbf24', // Syndicate Amber HUD
        titleColor: '#ffffff',
        quoteColor: '#67e8f9', // Neon Cyan
        cardFillRgb: '6, 9, 18', // Deep Bebop Obsidian
        borderColor: customAccent || '#00f0ff',
        dividerColor: 'rgba(0, 240, 255, 0.4)',
        priceBg: customAccent || '#f59e0b', // Amber bounty tag
        priceText: '#000000',
        fontFamilyTitle: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontFamilyBody: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontFamilyMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      };
    case 'editorial':
      return {
        accent: customAccent || '#000000',
        badgeText: '#666666',
        titleColor: '#000000',
        quoteColor: '#333333',
        cardFillRgb: '255, 255, 255',
        borderColor: customAccent || '#000000',
        dividerColor: 'rgba(0, 0, 0, 0.15)',
        priceBg: customAccent || '#000000',
        priceText: '#ffffff',
        fontFamilyTitle: '"Georgia", serif',
        fontFamilyBody: 'system-ui, -apple-system, sans-serif',
        fontFamilyMono: 'system-ui, sans-serif'
      };
    case 'minimalist':
      return {
        accent: customAccent || '#f8fafc',
        badgeText: '#94a3b8',
        titleColor: '#ffffff',
        quoteColor: '#e2e8f0',
        cardFillRgb: '0, 0, 0',
        borderColor: customAccent || 'rgba(255, 255, 255, 0.25)',
        dividerColor: 'rgba(255, 255, 255, 0.15)',
        priceBg: customAccent || '#3b82f6',
        priceText: '#ffffff',
        fontFamilyTitle: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontFamilyBody: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontFamilyMono: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      };
    case 'boutique':
      return {
        accent: customAccent || '#10b981',
        badgeText: '#34d399',
        titleColor: '#ffffff',
        quoteColor: '#d1fae5',
        cardFillRgb: '6, 46, 36',
        borderColor: customAccent || '#10b981',
        dividerColor: 'rgba(16, 185, 129, 0.3)',
        priceBg: customAccent || '#10b981',
        priceText: '#ffffff',
        fontFamilyTitle: '"Georgia", serif',
        fontFamilyBody: '"Georgia", serif',
        fontFamilyMono: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      };
    case 'antique':
    default:
      return {
        accent: customAccent || '#d97706',
        badgeText: '#fbbf24',
        titleColor: '#ffffff',
        quoteColor: '#fde68a',
        cardFillRgb: '26, 19, 14',
        borderColor: customAccent || '#d97706',
        dividerColor: 'rgba(217, 119, 6, 0.3)',
        priceBg: customAccent || '#d97706',
        priceText: '#1c130d',
        fontFamilyTitle: '"Georgia", serif',
        fontFamilyBody: '"Georgia", serif',
        fontFamilyMono: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      };
  }
}

/**
 * Measures wrapped lines of text against a maximum width constraint.
 */
export function measureWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 4
): string[] {
  if (!text || !text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (let n = 0; n < words.length; n++) {
    const testLine = currentLine ? `${currentLine} ${words[n]}` : words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(currentLine);
      currentLine = words[n];
      if (lines.length >= maxLines - 1 && n < words.length - 1) {
        const remaining = words.slice(n).join(' ');
        lines.push(truncateText(ctx, remaining, maxWidth));
        return lines;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Renders a single slide onto a 2D canvas context with the selected theme,
 * dynamic content-fitted card, and zero background bleeding by default.
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

  // 1. Draw Image with Fill / Cover + Zoom/Pan + Smart Auction Watermark Auto-Cropping
  const srcLower = (img.src || '').toLowerCase();
  const titleLower = (slide.title || '').toLowerCase();
  const descLower = (slide.description || '').toLowerCase();
  const isAuctionWatermark = options?.autoCropWatermark !== false && (
    srcLower.includes('shopgoodwill') ||
    srcLower.includes('azureedge') ||
    srcLower.includes('goodwill') ||
    srcLower.includes('sgw') ||
    titleLower.includes('shopgoodwill') ||
    descLower.includes('goodwill')
  );

  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (isAuctionWatermark && img.naturalHeight > 100) {
    // Cleanly remove top ~7% ("Property of Goodwill") and bottom ~11% ("ShopGoodwill.com") banners
    const topTrim = Math.round(img.naturalHeight * 0.07);
    const btmTrim = Math.round(img.naturalHeight * 0.11);
    sy = topTrim;
    sh = Math.max(50, img.naturalHeight - topTrim - btmTrim);
  }

  const croppedAspect = sw / sh;
  const canvasAspect = width / height;

  let drawW = width;
  let drawH = height;
  let drawX = 0;
  let drawY = 0;

  if (croppedAspect > canvasAspect) {
    drawW = height * croppedAspect;
    drawX = (width - drawW) / 2;
  } else {
    drawH = width / croppedAspect;
    drawY = (height - drawH) / 2;
  }

  // Apply motion zoom/pan
  const zoomedW = drawW * zoom;
  const zoomedH = drawH * zoom;
  const zoomedX = drawX - (zoomedW - drawW) / 2 + panX;
  const zoomedY = drawY - (zoomedH - drawH) / 2 + panY;

  ctx.drawImage(img, sx, sy, sw, sh, zoomedX, zoomedY, zoomedW, zoomedH);

  // 2. Draw Vignette Gradient ONLY if explicitly requested (defaults to 0: NO BLEEDING!)
  const position = options?.position || 'bottom_card';
  const vignetteOpacity = typeof options?.vignetteOpacity === 'number' ? options.vignetteOpacity : 0;

  if (showOverlay && position !== 'none' && vignetteOpacity > 0) {
    // Only a gentle, compact gradient right at the edge (max 25% of canvas, never 58%!)
    const gradientHeight = Math.min(height * 0.25, 400);
    let gradient: CanvasGradient;

    if (position === 'top_banner') {
      gradient = ctx.createLinearGradient(0, gradientHeight, 0, 0);
    } else if (position === 'center_spotlight') {
      gradient = ctx.createLinearGradient(0, height * 0.25, 0, height * 0.75);
    } else {
      gradient = ctx.createLinearGradient(0, height - gradientHeight, 0, height);
    }

    if (theme === 'editorial') {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(1, `rgba(255, 255, 255, ${vignetteOpacity})`);
    } else if (theme === 'antique') {
      gradient.addColorStop(0, 'rgba(15, 11, 8, 0)');
      gradient.addColorStop(1, `rgba(15, 11, 8, ${vignetteOpacity})`);
    } else {
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, `rgba(0, 0, 0, ${vignetteOpacity})`);
    }

    ctx.fillStyle = gradient;
    if (position === 'top_banner') {
      ctx.fillRect(0, 0, width, gradientHeight);
    } else if (position === 'center_spotlight') {
      ctx.fillRect(0, height * 0.25, width, height * 0.5);
    } else {
      ctx.fillRect(0, height - gradientHeight, width, gradientHeight);
    }
  }

  // 3. Render Theme-Specific Overlay Card & Typography
  if (showOverlay && position !== 'none') {
    renderThemeCard(ctx, width, height, slide, options);
  }

  ctx.restore();
}

/**
 * Draws the stylized typography, price badges, and micro-narrative card.
 * Automatically sizes card height snugly to match the exact content rendered.
 */
export function renderThemeCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  slide: { title: string; price?: number | string; description?: string; locationName?: string },
  options?: SlideRenderOptions
) {
  const theme = options?.theme || 'antique';
  const position = options?.position || 'bottom_card';
  if (position === 'none' || options?.showOverlay === false) return;

  const treatment = options?.cardTreatment || 'card';
  const fontScale = options?.fontSizeScale || 1.0;
  const cardOpacity = typeof options?.cardOpacity === 'number' 
    ? options.cardOpacity 
    : (treatment === 'glass' ? 0.45 : (treatment === 'clean_text' ? 0 : 0.85));

  const title = (slide.title || 'Curated Artifact').trim();
  const priceNum = Number(slide.price);
  const priceStr = !isNaN(priceNum) && priceNum > 0 ? `$${priceNum.toFixed(2)}` : '';
  const venue = (options?.venueName || slide.locationName || 'Memory Den').trim();
  const rawDesc = (slide.description || '').trim();
  const desc = options?.showQuote !== false ? rawDesc : '';

  const showTitle = options?.showTitle !== false && !!title;
  const showPrice = options?.showPrice !== false && !!priceStr;
  const showQuote = options?.showQuote !== false && !!desc;
  const showVenue = options?.showVenue !== false && !!venue;

  // If all text is disabled, nothing to render
  if (!showTitle && !showPrice && !showQuote && !showVenue) return;

  // Resolve Palette Colors & Fonts
  const palette = getThemePalette(theme, options?.accentColor);

  const isVertical = height > width;
  const isBottomCard = position === 'bottom_card';
  const isTopBanner = position === 'top_banner';

  // Safe Margins & Dynamic Typography Scale for 9:16 Vertical Reels
  const vScale = isVertical ? 1.65 : 1.0;
  const quoteFontSize = Math.round(22 * fontScale * vScale);
  const quoteLineH = Math.round(30 * fontScale * vScale);
  const titleFontSize = Math.round(28 * fontScale * vScale);
  const venueFontSize = Math.round(15 * fontScale * vScale);
  const priceFontSize = Math.round(18 * fontScale * vScale);

  const padLeft = isVertical ? Math.round(44 * fontScale) : Math.round(36 * fontScale);
  const padRight = isVertical ? Math.round(140 * fontScale) : Math.round(36 * fontScale);
  const bottomMargin = isVertical ? Math.round(410 * fontScale) : Math.round(36 * fontScale);

  const padX = padLeft;
  const cardW = width - padLeft - padRight;
  const innerPadX = Math.round(24 * fontScale * (isVertical ? 1.15 : 1.0));
  const maxInnerW = cardW - (innerPadX * 2);

  // Measure quotes if enabled
  let quoteLines: string[] = [];
  if (showQuote && desc) {
    ctx.save();
    ctx.font = `bold ${quoteFontSize}px ${palette.fontFamilyBody}`;
    quoteLines = measureWrappedLines(ctx, `"${desc}"`, maxInnerW, 4);
    ctx.restore();
  }

  // Calculate dynamic content height snugly
  let contentH = Math.round(18 * fontScale * vScale); // top padding
  if (showVenue || (showPrice && priceStr)) {
    contentH += Math.round(34 * fontScale * vScale);
  }
  if (showTitle) {
    contentH += Math.round(40 * fontScale * vScale);
  }
  if (quoteLines.length > 0) {
    contentH += Math.round(12 * fontScale * vScale); // divider & gap
    contentH += quoteLines.length * quoteLineH;
  }
  contentH += Math.round(20 * fontScale * vScale); // bottom padding

  const cardH = Math.max(Math.round(80 * fontScale * vScale), contentH);

  // Calculate card Y position with safe zones
  let cardY = height - cardH - bottomMargin; // Floats cleanly inside Instagram/phone safe zone!
  if (treatment === 'portland_editorial' || position === 'center_spotlight') {
    cardY = isVertical ? Math.round((height - cardH) * 0.48) : Math.round((height - cardH) / 2);
  } else if (treatment === 'promo_flyer' || position === 'top_banner') {
    cardY = isVertical ? Math.round(140 * fontScale) : Math.round(28 * fontScale);
  }

  ctx.save();

  // -----------------------------------------------------------
  // A. DRAW BACKGROUND / CARD BOX (Based on Treatment & Position)
  // -----------------------------------------------------------
  if (treatment === 'portland_editorial') {
    // Portland Mercury Alt-Weekly Newspaper Paper Card (Screenshot 1 Match!)
    const cardRadius = Math.round(10 * fontScale);
    ctx.save();
    // Realistic paper drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, padX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    // Fine editorial paper border
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    roundRect(ctx, padX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();
    ctx.restore();
  } else if (treatment === 'promo_flyer') {
    // Pin Depot / Commercial Drop Flyer Banner (Screenshot 2 Match!)
    const cardRadius = Math.round(16 * fontScale);
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 4;
    // Dark deep navy gradient banner
    const grad = ctx.createLinearGradient(padX, cardY, padX, cardY + cardH);
    grad.addColorStop(0, '#0284c7'); // Vivid cyan-blue header
    grad.addColorStop(1, '#0f172a'); // Deep slate navy
    ctx.fillStyle = grad;
    roundRect(ctx, padX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    // Vibrant amber callout accent line
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(padX + 2, cardY + cardH - Math.round(5 * fontScale), cardW - 4, Math.round(5 * fontScale));
    ctx.restore();
  } else if (treatment === 'tiktok_scrim') {
    // 1. Draw smooth vertical gradient scrim across bottom of canvas (no clunky box!)
    const scrimH = Math.min(height * 0.45, Math.round(cardH + bottomMargin + 80));
    const scrimY = height - scrimH;
    const scrimGrad = ctx.createLinearGradient(0, scrimY, 0, height);
    scrimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    scrimGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.45)');
    scrimGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.78)');
    scrimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.fillStyle = scrimGrad;
    ctx.fillRect(0, scrimY, width, scrimH);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
  } else if (treatment === 'clean_text') {
    // No box! Use dual text shadow for high contrast directly on photo
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;
  } else if (treatment === 'grailed_editorial') {
    // Frosted glass luxury box with fine white border
    const cardRadius = Math.round(20 * fontScale);
    ctx.fillStyle = 'rgba(10, 10, 14, 0.82)';
    roundRect(ctx, padX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, padX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();
  } else if (treatment === 'whatnot_pill') {
    // Micro corner pill tag
    const pillRadius = Math.round(cardH / 2);
    ctx.fillStyle = 'rgba(8, 8, 12, 0.92)';
    roundRect(ctx, padX, cardY, cardW, cardH, pillRadius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, padX, cardY, cardW, cardH, pillRadius);
    ctx.stroke();
  } else if (treatment === 'cyber_neon') {
    // Spike Spiegel Bebop Noir / Neo Cyberpunk Card
    const cardRadius = Math.round(20 * fontScale);
    ctx.save();
    // Deep syndicate noir glass with cyan outer glow
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(6, 10, 20, 0.90)';
    roundRect(ctx, padX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.stroke();

    // Top-left tactical Syndicate amber badge tab
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(padX + Math.round(20 * fontScale), cardY, Math.round(40 * fontScale), 3);

    // Subtle tactical inner border / Bebop frame accent
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX + 5, cardY + 5, cardW - 10, cardH - 10);
    ctx.restore();
  } else if (treatment === 'instagram_pill' || treatment === 'floating_pill') {
    // Instagram Story Sticker Pill Capsule
    const pillRadius = Math.min(cardH / 2, Math.round(28 * fontScale));
    ctx.fillStyle = `rgba(${palette.cardFillRgb}, ${cardOpacity})`;
    roundRect(ctx, padX, cardY, cardW, cardH, pillRadius);
    ctx.fill();
    ctx.strokeStyle = palette.borderColor;
    ctx.lineWidth = 2;
    roundRect(ctx, padX, cardY, cardW, cardH, pillRadius);
    ctx.stroke();
  } else {
    // Studio Card Sticker (Rounded corners, safe from phone bezels)
    const cardRadius = Math.round(22 * fontScale);
    ctx.fillStyle = `rgba(${palette.cardFillRgb}, ${cardOpacity})`;
    roundRect(ctx, padX, cardY, cardW, cardH, cardRadius);
    ctx.fill();

    // Accent Border
    ctx.strokeStyle = palette.borderColor;
    ctx.lineWidth = 2.5;
    roundRect(ctx, padX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();
  }

  // -----------------------------------------------------------
  // B. DRAW TYPOGRAPHY INSIDE THE CARD
  // -----------------------------------------------------------
  let currentY = cardY + Math.round(26 * fontScale * (isVertical ? 1.15 : 1.0));

  // 1. Venue Tag & Price Badge Row
  const pillW = Math.round(135 * fontScale * (isVertical ? 1.2 : 1.0));
  const pillH = Math.round(36 * fontScale * (isVertical ? 1.2 : 1.0));

  if (showVenue || (showPrice && priceStr)) {
    if (showVenue) {
      ctx.font = `bold ${venueFontSize}px ${palette.fontFamilyMono}`;
      ctx.fillStyle = palette.badgeText;
      ctx.letterSpacing = '1.2px';
      let venuePrefix = '📍 ';
      if (treatment === 'portland_editorial') {
        ctx.fillStyle = '#64748b';
        venuePrefix = 'PORTLAND // ';
      } else if (treatment === 'promo_flyer') {
        ctx.fillStyle = '#fbbf24';
        venuePrefix = '⭐ DROP FEATURE // ';
      } else if (theme === 'antique') {
        venuePrefix = '🏛️ ARCHIVES OF ';
      } else if (theme === 'cyberpunk' || (theme as string) === 'neo') {
        venuePrefix = '🚬 BOUNTY // ';
      } else if (theme === 'tiktok') {
        venuePrefix = '🔥 ';
      } else if (theme === 'instagram') {
        venuePrefix = '📍 ';
      }
      
      const maxVenueW = (showPrice && priceStr) ? maxInnerW - pillW - 20 : maxInnerW;
      const truncatedVenue = truncateText(ctx, `${venuePrefix}${venue.toUpperCase()}`, maxVenueW);
      ctx.fillText(truncatedVenue, padX + innerPadX, currentY + Math.round(4 * fontScale));
    }

    // Price Badge (Pill) placed on the same top line (Right Aligned)
    if (showPrice && priceStr) {
      const pillX = padX + cardW - pillW - innerPadX;
      const pillY = currentY - Math.round(20 * fontScale);

      if (treatment === 'portland_editorial') {
        ctx.fillStyle = '#0f172a';
        roundRect(ctx, pillX, pillY, pillW, pillH, 8);
        ctx.fill();
        ctx.font = `900 ${priceFontSize}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = palette.priceBg;
        roundRect(ctx, pillX, pillY, pillW, pillH, 16);
        ctx.fill();
        ctx.font = `900 ${priceFontSize}px ${palette.fontFamilyMono}`;
        ctx.fillStyle = palette.priceText;
      }
      ctx.textAlign = 'center';
      ctx.letterSpacing = '0.5px';
      ctx.fillText(priceStr, pillX + (pillW / 2), pillY + Math.round(24 * fontScale * (isVertical ? 1.15 : 1.0)));
      ctx.textAlign = 'left';
      ctx.letterSpacing = '0px';
    }

    currentY += Math.round(38 * fontScale * (isVertical ? 1.2 : 1.0));
  } else {
    currentY += Math.round(10 * fontScale);
  }

  // 2. Title Row (Full width line)
  if (showTitle) {
    if (treatment === 'portland_editorial') {
      ctx.font = `900 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#0f172a'; // Bold clean black headline
    } else if (treatment === 'promo_flyer') {
      ctx.font = `900 ${Math.round(titleFontSize * 1.12)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#ffffff'; // Large bold white title
      ctx.letterSpacing = '1px';
    } else if (treatment === 'grailed_editorial') {
      ctx.font = `bold ${titleFontSize}px monospace`;
      ctx.letterSpacing = '1.5px';
      ctx.fillStyle = '#ffffff';
    } else if (treatment === 'cyber_neon') {
      ctx.font = `900 ${titleFontSize}px system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.font = `900 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#ffffff';
    }

    const truncatedTitle = truncateText(ctx, title, maxInnerW);
    ctx.fillText(truncatedTitle, padX + innerPadX, currentY);
    currentY += Math.round(18 * fontScale * (isVertical ? 1.15 : 1.0));
  }

  // 3. Micro-Quote / Narrative
  if (quoteLines.length > 0) {
    currentY += Math.round(10 * fontScale);

    // Subtle divider line
    if (treatment !== 'clean_text' && treatment !== 'tiktok_scrim') {
      ctx.strokeStyle = treatment === 'portland_editorial' ? 'rgba(0, 0, 0, 0.08)' : palette.dividerColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padX + innerPadX, currentY);
      ctx.lineTo(padX + cardW - innerPadX, currentY);
      ctx.stroke();
    }

    currentY += Math.round(26 * fontScale * (isVertical ? 1.15 : 1.0));

    ctx.save();
    if (treatment === 'portland_editorial') {
      // Pure print clarity - zero shadow blur for clean newsprint readability
      ctx.font = `500 ${Math.round(quoteFontSize * 0.95)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#1e293b';
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 2;

      if (treatment === 'promo_flyer') {
        ctx.font = `bold ${quoteFontSize}px system-ui, sans-serif`;
        ctx.fillStyle = '#f8fafc';
      } else if (treatment === 'tiktok_scrim') {
        ctx.font = `900 ${quoteFontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = '#ffffff';
      } else if (treatment === 'grailed_editorial') {
        ctx.font = `bold ${Math.round(quoteFontSize * 0.9)}px monospace`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.letterSpacing = '1px';
      } else if (treatment === 'cyber_neon') {
        ctx.font = `900 ${quoteFontSize}px system-ui, sans-serif`;
        ctx.fillStyle = '#67e8f9';
      } else {
        ctx.font = `bold ${quoteFontSize}px ${palette.fontFamilyBody}`;
        ctx.fillStyle = palette.quoteColor || '#ffffff';
      }
    }

    for (const qLine of quoteLines) {
      ctx.fillText(qLine, padX + innerPadX, currentY);
      currentY += quoteLineH;
    }
    ctx.restore();
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

export { renderThemeCard as drawOverlayCard };
