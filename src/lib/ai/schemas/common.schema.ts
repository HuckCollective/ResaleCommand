import { SchemaType, type Schema } from '@google/generative-ai';

export const priceBreakdownSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    mint: { type: SchemaType.STRING, description: 'Price range if New/Mint (e.g. "$45 - $60")' },
    boutique_premium: { type: SchemaType.STRING, description: 'Curated physical booth price range (e.g. "$35 - $50")' },
    fair: { type: SchemaType.STRING, description: 'Secondary market sold comp range (e.g. "$25 - $40")' },
    poor: { type: SchemaType.STRING, description: 'Damaged/parts price range (e.g. "$10 - $18")' },
    confidence: { type: SchemaType.STRING, format: 'enum', enum: ['High', 'Medium', 'Low'] }
  },
  required: ['mint', 'boutique_premium', 'fair', 'poor']
};

export const marketReportSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    best_platform: { type: SchemaType.STRING },
    platform_rationale: { type: SchemaType.STRING },
    sell_through_velocity: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['Fast (< 7 days)', 'Moderate (2-4 weeks)', 'Slow / Long-Tail (1-3 months)']
    },
    target_buyer: { type: SchemaType.STRING },
    channels: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          est_price: { type: SchemaType.STRING },
          net_payout: { type: SchemaType.STRING },
          speed: { type: SchemaType.STRING },
          recommendation: { type: SchemaType.STRING }
        },
        required: ['name', 'est_price', 'net_payout', 'speed', 'recommendation']
      }
    }
  },
  required: ['best_platform', 'platform_rationale', 'sell_through_velocity', 'channels']
};

export const componentItemSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING, description: 'Clean item title without tier bracket prefixes' },
    identity: { type: SchemaType.STRING, description: 'Specific edition/model identity' },
    tag_title: { type: SchemaType.STRING, description: 'Thermal barcode label title, strictly <= 40 chars' },
    physical_substrate: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['BOOK_PERIODICAL', 'APPAREL_GARMENT', 'WALL_ART', 'TOY_FIGURE', 'MEDIA_ELECTRONICS', 'POTTERY_DRINKWARE', 'JEWELRY_METAL', 'OTHER']
    },
    tier: { type: SchemaType.STRING, format: 'enum', enum: ['showcase', 'core', 'quick_turn'] },
    is_key_issue: { type: SchemaType.BOOLEAN },
    condition: { type: SchemaType.STRING },
    estimated_value: { type: SchemaType.STRING, description: 'Fair market range (e.g. "$20 - $30")' },
    ocr_detected_text: { type: SchemaType.STRING, description: 'Verbatim text and copyright year read from item' },
    image_index: { type: SchemaType.INTEGER, description: '0-based index of photo showing this item' },
    bounding_box: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.INTEGER },
      description: '[ymin, xmin, ymax, xmax] normalized 0-1000'
    },
    views: {
      type: SchemaType.ARRAY,
      description: 'EVERY photo where this specific item appears (front, back, spine, detail, tag), each with its own bounding box',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          role: { type: SchemaType.STRING, format: 'enum', enum: ['front', 'back', 'spine', 'detail', 'tag'] },
          image_index: { type: SchemaType.INTEGER, description: '0-based photo index' },
          bounding_box: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.INTEGER },
            description: '[ymin, xmin, ymax, xmax] normalized 0-1000'
          }
        },
        required: ['role', 'image_index', 'bounding_box']
      }
    },
    pricing_potential: {
      type: SchemaType.OBJECT,
      properties: {
        boutique: { type: SchemaType.STRING },
        fair: { type: SchemaType.STRING }
      },
      required: ['boutique', 'fair']
    },
    buy_range: {
      type: SchemaType.OBJECT,
      properties: {
        min: { type: SchemaType.NUMBER },
        max: { type: SchemaType.NUMBER },
        formatted: { type: SchemaType.STRING }
      },
      required: ['min', 'max', 'formatted']
    },
    price_breakdown: priceBreakdownSchema,
    red_flags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  },
  required: [
    'name',
    'identity',
    'tag_title',
    'physical_substrate',
    'tier',
    'condition',
    'estimated_value',
    'ocr_detected_text',
    'image_index',
    'price_breakdown'
  ]
};
