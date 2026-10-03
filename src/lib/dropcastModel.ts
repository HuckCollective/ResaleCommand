/**
 * Dropcast Data Model & Persistence
 * Manages Quick Casts, Custom Casts, and Draft/Ready/Broadcasted Lifecycles
 */

import type { SocialStudioItem, PostMediaSlide } from './socialMediaStudio';
import type { LocationPhoto } from './locationPhotos';

export type CastType = 'restock' | 'grail' | 'haul' | 'recap' | 'custom' | 'event';
export type CastStatus = 'draft' | 'paused' | 'ready' | 'broadcasted' | 'archived';

export interface Dropcast {
  id: string;
  title: string;
  type: CastType;
  status: CastStatus;
  locationName: string;
  locationCode?: string; // 'MD' | 'DT' | etc.
  manifestId?: string;
  items: SocialStudioItem[];
  slides: PostMediaSlide[];
  boothPhotos?: LocationPhoto[];
  personaId: string;
  customTonePrompt?: string;
  customNotes?: string;
  platform: 'instagram' | 'tiktok' | 'facebook' | 'story' | string;
  authorHandle: string;
  includePrices: boolean;
  generatedCaption?: string;
  hashtags?: string[];
  totalRetailValue: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export const CAST_TYPE_META: Record<CastType, { label: string; icon: string; emoji: string; colorBadge: string; description: string }> = {
  restock: {
    label: 'Restock Dropcast',
    icon: 'solar:box-minimalistic-bold',
    emoji: '🚨',
    colorBadge: 'badge-primary',
    description: 'Fresh booth drop & restock to drive in-store hunt foot traffic'
  },
  grail: {
    label: 'Grail Spotlight',
    icon: 'solar:star-bold',
    emoji: '💎',
    colorBadge: 'badge-secondary',
    description: 'Showcases high-ticket vintage treasure, maker pedigree & craftsmanship'
  },
  haul: {
    label: 'Haul Teaser',
    icon: 'solar:delivery-bold',
    emoji: '📦',
    colorBadge: 'badge-accent',
    description: 'Unboxing fresh thrift & estate finds before pricing'
  },
  recap: {
    label: 'Sales Wrap-Up',
    icon: 'solar:dollar-bold',
    emoji: '💰',
    colorBadge: 'badge-success',
    description: 'Recap of grails claimed & sold this week'
  },
  custom: {
    label: 'Custom Cast',
    icon: 'solar:magic-stick-3-bold',
    emoji: '🎨',
    colorBadge: 'badge-neutral',
    description: 'Hand-crafted multi-channel broadcast with custom aesthetic tone'
  },
  event: {
    label: 'Event & Popup',
    icon: 'solar:shop-2-bold',
    emoji: '🎪',
    colorBadge: 'badge-warning',
    description: 'Oddities expos, flea markets, and popups announcement'
  }
};

export const CAST_STATUS_META: Record<CastStatus, { label: string; badgeClass: string; icon: string }> = {
  draft: {
    label: 'Draft',
    badgeClass: 'badge-warning text-warning-content font-bold',
    icon: 'solar:pen-new-square-linear'
  },
  paused: {
    label: 'Paused',
    badgeClass: 'badge-warning badge-outline font-bold',
    icon: 'solar:pause-circle-bold'
  },
  ready: {
    label: 'Ready to Post',
    badgeClass: 'badge-info text-info-content font-bold',
    icon: 'solar:check-circle-bold'
  },
  broadcasted: {
    label: 'Broadcasted',
    badgeClass: 'badge-success text-success-content font-bold',
    icon: 'solar:broadcast-bold'
  },
  archived: {
    label: 'Archived',
    badgeClass: 'badge-ghost opacity-60',
    icon: 'solar:archive-linear'
  }
};

const STORAGE_KEY = 'resale_command_dropcasts';

// Built-in seed data so user has immediate rich dropcasts to test
export const SEED_DROPCASTS: Dropcast[] = [
  {
    id: 'cast_md_sep27_restock',
    title: 'Memory Den Autumn Restock — Sep 27 Drop',
    type: 'restock',
    status: 'draft',
    locationName: 'Memory Den',
    locationCode: 'MD',
    personaId: 'lestat',
    customTonePrompt: 'Vampire Lestat — decadent, poetic, darkly romantic gothic aristocrat from Anne Rice. Velvet relics, dark aesthetic curio, nocturnal allure.',
    platform: 'instagram',
    authorHandle: 'resalecommand',
    includePrices: true,
    customNotes: 'Booth 42 main aisle curio cabinet restock',
    totalRetailValue: 345.00,
    createdAt: '2026-09-27T14:30:00.000Z',
    updatedAt: '2026-09-29T10:15:00.000Z',
    items: [
      {
        id: 'item_md_1',
        title: 'Victorian Ornate Brass Table Easel Mirror',
        resalePrice: 65,
        boutiquePrice: 65,
        brand: 'Heirloom Brass',
        category: 'Home Decor & Curios',
        condition: 'Vintage Excellent',
        imageUrl: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=1080&auto=format&fit=crop&q=80'
      },
      {
        id: 'item_md_2',
        title: '90s Whimsigoth Celestial Velvet Duster Coat',
        resalePrice: 125,
        boutiquePrice: 125,
        brand: 'Midnight Velvet',
        category: 'Outerwear',
        condition: 'Mint Vintage',
        imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1080&auto=format&fit=crop&q=80'
      },
      {
        id: 'item_md_3',
        title: 'Dark Academia Leather-Bound Poetry Anthology (1924)',
        resalePrice: 48,
        boutiquePrice: 48,
        brand: 'Antiquarian Press',
        category: 'Books & Ephemera',
        condition: 'Antique Patina',
        imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1080&auto=format&fit=crop&q=80'
      },
      {
        id: 'item_md_4',
        title: 'Hand-Carved Black Forest Wood Curio Box',
        resalePrice: 55,
        boutiquePrice: 55,
        brand: 'Folk Art Woodcraft',
        category: 'Curiosities',
        condition: 'Very Good',
        imageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1080&auto=format&fit=crop&q=80'
      },
      {
        id: 'item_md_5',
        title: 'Heavy Pewter Candlestick Candelabra Pair',
        resalePrice: 52,
        boutiquePrice: 52,
        brand: 'Continental Pewter',
        category: 'Curiosities',
        condition: 'Aged Patina',
        imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1080&auto=format&fit=crop&q=80'
      }
    ],
    slides: [
      {
        id: 'slide_md_1',
        type: 'item_hero',
        url: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=1080&auto=format&fit=crop&q=80',
        title: 'Victorian Ornate Brass Table Easel Mirror',
        price: 65,
        locationName: 'Memory Den',
        description: 'Ornate Victorian filigree brass mirror for an alcove or curio altar.'
      },
      {
        id: 'slide_md_2',
        type: 'item_gallery',
        url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1080&auto=format&fit=crop&q=80',
        title: '90s Whimsigoth Celestial Velvet Duster Coat',
        price: 125,
        locationName: 'Memory Den',
        description: 'Deep midnight velvet duster with celestial star embroidery.'
      },
      {
        id: 'slide_md_3',
        type: 'item_gallery',
        url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1080&auto=format&fit=crop&q=80',
        title: 'Dark Academia Leather-Bound Poetry Anthology (1924)',
        price: 48,
        locationName: 'Memory Den',
        description: 'Gold-embossed spine with original gilded edges from 1924.'
      },
      {
        id: 'slide_md_4',
        type: 'item_gallery',
        url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1080&auto=format&fit=crop&q=80',
        title: 'Hand-Carved Black Forest Wood Curio Box',
        price: 55,
        locationName: 'Memory Den',
        description: 'Deep relief foliate carvings with original brass clasp.'
      },
      {
        id: 'slide_md_5',
        type: 'item_gallery',
        url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1080&auto=format&fit=crop&q=80',
        title: 'Heavy Pewter Candlestick Candelabra Pair',
        price: 52,
        locationName: 'Memory Den',
        description: 'Solid continental pewter with natural aged gunmetal patina.'
      }
    ],
    generatedCaption: `🥀 FRESH RESTOCK AT MEMORY DEN (BOOTH 42) 🥀\n\nShadows lengthen and new relics have emerged from the twilight. Five decadent pieces just landed in our curio alcove on SE 2nd Ave:\n\n• 90s Whimsigoth Celestial Velvet Duster Coat — $125\n• Victorian Ornate Brass Table Easel Mirror — $65\n• Heavy Pewter Candlestick Candelabra Pair — $52\n• Dark Academia Leather-Bound Poetry Anthology (1924) — $48\n• Hand-Carved Black Forest Wood Curio Box — $55\n\n📍 Find us at Memory Den Booth 42, Portland, OR.\nDM to claim or visit the booth before twilight takes them.\n\n#vintagerestock #memoryden #portlandvintage #gothicaesthetic #darkacademia #whimsigoth #antiquecurio #secondhandpdx`,
    hashtags: ['#vintagerestock', '#memoryden', '#portlandvintage', '#gothicaesthetic', '#darkacademia']
  },
  {
    id: 'cast_grail_velvet_jacket',
    title: '1993 Tim Burton Nightmare Velvet Hero Grail',
    type: 'grail',
    status: 'ready',
    locationName: 'Dusty Tiger',
    locationCode: 'DT',
    personaId: 'grail',
    customTonePrompt: 'Museum archivist and pedigree specialist. Focus on era provenance, authentic tags, and collector value.',
    platform: 'instagram',
    authorHandle: 'resalecommand',
    includePrices: true,
    totalRetailValue: 195.00,
    createdAt: '2026-09-28T11:00:00.000Z',
    updatedAt: '2026-09-29T09:30:00.000Z',
    items: [
      {
        id: 'item_grail_1',
        title: '1993 Tim Burton Nightmare Before Christmas Velvet Reversible Bomber',
        resalePrice: 195,
        boutiquePrice: 195,
        brand: 'Touchstone / Disney Originals',
        category: 'Vintage Apparel',
        condition: 'Archival Grade',
        imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1080&auto=format&fit=crop&q=80'
      }
    ],
    slides: [
      {
        id: 'slide_grail_1',
        type: 'item_hero',
        url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1080&auto=format&fit=crop&q=80',
        title: '1993 Tim Burton Nightmare Velvet Reversible Bomber',
        price: 195,
        locationName: 'Dusty Tiger',
        description: 'Authentic 1993 Touchstone original in rich midnight velvet.'
      }
    ],
    generatedCaption: `💎 GRAIL SPOTLIGHT // 1993 TOUCHSTONE ORIGINAL 💎\n\nAn authentic museum-grade relic of 90s gothic cinema history: the official 1993 Tim Burton Nightmare Before Christmas reversible velvet bomber.\n\nFeaturing deep midnight velvet, jacquard lining, and original copyright tags. True piece of animation provenance.\n\nTag Price: $195.00\nLocation: Dusty Tiger Booth & Online\n\n#vintagegrail #90svintage #timburton #nightmarebeforechristmas #grailheat #vintagejacket #vintageclothing #resalecommand`,
    hashtags: ['#vintagegrail', '#90svintage', '#timburton', '#grailheat', '#vintageclothing']
  },
  {
    id: 'cast_dusty_tiger_drop_sep20',
    title: 'Dusty Tiger Mid-Century Barware & Curios Drop',
    type: 'restock',
    status: 'broadcasted',
    locationName: 'Dusty Tiger',
    locationCode: 'DT',
    personaId: 'hustler',
    platform: 'instagram',
    authorHandle: 'resalecommand',
    includePrices: true,
    totalRetailValue: 195.00,
    createdAt: '2026-09-20T16:00:00.000Z',
    updatedAt: '2026-09-20T18:00:00.000Z',
    publishedAt: '2026-09-20T18:15:00.000Z',
    items: [
      {
        id: 'item_dt_1',
        title: 'MCM Culver 22k Gold Barware Set (6 Tumblers)',
        resalePrice: 120,
        boutiquePrice: 120,
        brand: 'Culver LTD',
        category: 'Barware',
        imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1080&auto=format&fit=crop&q=80'
      },
      {
        id: 'item_dt_2',
        title: 'Cast Iron Dachshund Boot Scraper',
        resalePrice: 75,
        boutiquePrice: 75,
        brand: 'Mid-Century Iron',
        category: 'Folk Art',
        imageUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=1080&auto=format&fit=crop&q=80'
      }
    ],
    slides: [
      {
        id: 'slide_dt_1',
        type: 'item_hero',
        url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1080&auto=format&fit=crop&q=80',
        title: 'MCM Culver 22k Gold Barware Set (6 Tumblers)',
        price: 120,
        locationName: 'Dusty Tiger',
        description: 'Iconic 22-karat gilded geometric glassware from the 1960s.'
      },
      {
        id: 'slide_dt_2',
        type: 'item_gallery',
        url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=1080&auto=format&fit=crop&q=80',
        title: 'Cast Iron Dachshund Boot Scraper',
        price: 75,
        locationName: 'Dusty Tiger',
        description: 'Heavy solid cast iron folk art dachshund with rustic weathered finish.'
      }
    ],
    generatedCaption: `🔥 JUST PLACED AT DUSTY TIGER HAWTHORNE 🔥\nFresh batch of mid-century barware and oddities just hit our shelves! Come grab these before the weekend rush!`,
    hashtags: ['#dustytiger', '#mcmbarware', '#hawthornepdx', '#vintagepdx']
  }
];

export function getSavedDropcasts(): Dropcast[] {
  if (typeof window === 'undefined') return SEED_DROPCASTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DROPCASTS));
      return SEED_DROPCASTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Auto-heal seed casts if corrupted or contaminated by other casts
      let needsResave = false;
      const healed = parsed.map(c => {
        const seed = SEED_DROPCASTS.find(s => s.id === c.id);
        if (seed) {
          // If Tim Burton cast was contaminated by Cyberpunk items, missing images, or wrong location
          if (c.id === 'cast_grail_velvet_jacket') {
            const hasBurton = c.items?.some((i: any) => (i.title || '').toLowerCase().includes('burton'));
            const isSingle = Array.isArray(c.items) && c.items.length === 1;
            const hasPhoto = Boolean(c.items?.[0]?.imageUrl || c.items?.[0]?.photo);
            if (!hasBurton || !isSingle || !hasPhoto || c.locationName !== 'Dusty Tiger') {
              needsResave = true;
              return { ...seed };
            }
          }
          // If Memory Den seed cast was emptied or corrupted
          if (c.id === 'cast_md_sep27_restock') {
            if (!Array.isArray(c.items) || c.items.length === 0 || !c.items[0]?.imageUrl) {
              needsResave = true;
              return { ...seed };
            }
          }
          // If Dusty Tiger barware seed cast was emptied
          if (c.id === 'cast_dusty_tiger_drop_sep20') {
            if (!Array.isArray(c.items) || c.items.length === 0) {
              needsResave = true;
              return { ...seed };
            }
          }
        }
        return c;
      });

      if (needsResave) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(healed));
      }
      return healed;
    }
    return SEED_DROPCASTS;
  } catch (err) {
    console.warn('[DropcastModel] Error reading dropcasts from storage:', err);
    return SEED_DROPCASTS;
  }
}

export function saveDropcast(cast: Dropcast): Dropcast[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = getSavedDropcasts();
    const idx = list.findIndex(c => c.id === cast.id);
    const now = new Date().toISOString();
    cast.updatedAt = now;
    if (cast.status === 'broadcasted' && !cast.publishedAt) {
      cast.publishedAt = now;
    }

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...cast };
    } else {
      list.unshift(cast);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (err) {
    console.error('[DropcastModel] Failed to save dropcast:', err);
    return [];
  }
}

export function deleteDropcast(id: string): Dropcast[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = getSavedDropcasts().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (err) {
    console.error('[DropcastModel] Failed to delete dropcast:', err);
    return [];
  }
}

export function duplicateDropcast(id: string): Dropcast | null {
  const list = getSavedDropcasts();
  const source = list.find(c => c.id === id);
  if (!source) return null;

  const copy: Dropcast = {
    ...source,
    id: `cast_${Date.now()}`,
    title: `${source.title} (Copy)`,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: undefined
  };

  saveDropcast(copy);
  return copy;
}

/**
 * Creates a Quick Cast based on archetype and optional context
 */
export function createQuickCast(
  type: CastType, 
  options?: {
    manifest?: any;
    items?: any[];
    locationName?: string;
    locationCode?: string;
    title?: string;
  }
): Dropcast {
  const now = new Date().toISOString();
  const id = `cast_${type}_${Date.now()}`;
  const loc = options?.locationName || (options?.locationCode === 'DT' ? 'Dusty Tiger' : 'Memory Den');
  const items = options?.items || [];
  const totalValue = items.reduce((acc, it) => acc + Number(it.boutiquePrice || it.resalePrice || it.price || 0), 0);

  let defaultTitle = '';
  let defaultPersona = 'lestat';
  let defaultCustomTone = '';

  switch (type) {
    case 'restock':
      defaultTitle = options?.title || `${loc} Fresh Restock Drop`;
      defaultPersona = 'lestat';
      defaultCustomTone = 'Fresh retail booth drop. Urgent, evocative, inviting followers to hunt physical shelves.';
      break;
    case 'grail':
      defaultTitle = options?.title || `Grail Spotlight // ${items[0]?.title || 'Featured Relic'}`;
      defaultPersona = 'curator';
      defaultCustomTone = 'Heritage curator, provenance and collector value breakdown.';
      break;
    case 'haul':
      defaultTitle = options?.title || `Fresh Estate & Thrift Haul Preview`;
      defaultPersona = 'hustler';
      defaultCustomTone = 'Fast-flipping deal alert, treasure hunt enthusiasm, behind-the-scenes.';
      break;
    case 'recap':
      defaultTitle = options?.title || `Weekly Sold Grails Wrap-Up`;
      defaultPersona = 'hustler';
      defaultCustomTone = 'Celebratory wrap-up of grails claimed by collectors this week.';
      break;
    case 'event':
      defaultTitle = options?.title || `Popup & Expo Announcement`;
      defaultPersona = 'curator';
      defaultCustomTone = 'Community rally, weekend hours, booth number and venue directions.';
      break;
    default:
      defaultTitle = options?.title || `New Dropcast`;
      defaultPersona = 'lestat';
  }

  const cast: Dropcast = {
    id,
    title: defaultTitle,
    type,
    status: 'draft',
    locationName: loc,
    locationCode: options?.locationCode || (loc.includes('Tiger') ? 'DT' : 'MD'),
    manifestId: options?.manifest?.$id || options?.manifest?.id,
    items,
    slides: [],
    personaId: defaultPersona,
    customTonePrompt: defaultCustomTone,
    platform: 'instagram',
    authorHandle: 'resalecommand',
    includePrices: true,
    totalRetailValue: totalValue,
    createdAt: now,
    updatedAt: now
  };

  saveDropcast(cast);
  return cast;
}

/**
 * Creates an empty Custom Cast
 */
export function createCustomCast(title?: string, locationName: string = 'Memory Den'): Dropcast {
  return createQuickCast('custom', {
    title: title || 'Custom Dropcast',
    locationName
  });
}
