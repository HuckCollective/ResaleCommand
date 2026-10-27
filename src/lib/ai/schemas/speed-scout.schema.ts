import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { priceBreakdownSchema, marketReportSchema, componentItemSchema } from './common.schema';

export const speedScoutResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          identity: { type: SchemaType.STRING },
          title: { type: SchemaType.STRING },
          tag_title: { type: SchemaType.STRING, description: 'Strictly <= 40 characters for Rollo/Ricochet labels' },
          physical_substrate: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['BOOK_PERIODICAL', 'APPAREL_GARMENT', 'WALL_ART', 'TOY_FIGURE', 'MEDIA_ELECTRONICS', 'POTTERY_DRINKWARE', 'JEWELRY_METAL', 'OTHER']
          },
          tier: { type: SchemaType.STRING, format: 'enum', enum: ['showcase', 'core', 'quick_turn'] },
          tier_label: { type: SchemaType.STRING },
          pricing_potential: {
            type: SchemaType.OBJECT,
            properties: {
              fair: { type: SchemaType.STRING },
              boutique: { type: SchemaType.STRING }
            },
            required: ['fair', 'boutique']
          },
          why_pay_up: { type: SchemaType.STRING },
          why_pass: { type: SchemaType.STRING },
          ocr_detected_text: { type: SchemaType.STRING },
          keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          condition_notes: { type: SchemaType.STRING },
          country_of_origin: { type: SchemaType.STRING },
          red_flags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          price_breakdown: priceBreakdownSchema,
          comparables: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                price: { type: SchemaType.STRING },
                status: { type: SchemaType.STRING, format: 'enum', enum: ['Sold', 'Listed'] }
              },
              required: ['name', 'price', 'status']
            }
          },
          bounding_box: { type: SchemaType.ARRAY, items: { type: SchemaType.INTEGER } },
          purchase_strategy: {
            type: SchemaType.OBJECT,
            properties: {
              verdict: { type: SchemaType.STRING, format: 'enum', enum: ['PASS', 'WATCH', 'BUY_NOW', 'NEGOTIATE', 'CHASE_AUCTION'] },
              current_asking_price: { type: SchemaType.STRING },
              max_bid: { type: SchemaType.NUMBER },
              max_landed_cost: { type: SchemaType.NUMBER },
              advice: { type: SchemaType.STRING }
            },
            required: ['verdict', 'max_bid', 'max_landed_cost', 'advice']
          },
          auction_meta: {
            type: SchemaType.OBJECT,
            nullable: true,
            properties: {
              is_auction: { type: SchemaType.BOOLEAN },
              end_time: { type: SchemaType.STRING, nullable: true },
              time_left_text: { type: SchemaType.STRING },
              urgency: { type: SchemaType.STRING, format: 'enum', enum: ['CRITICAL', 'SOON', 'NORMAL', 'NONE'] },
              platform: { type: SchemaType.STRING },
              buyers_premium_pct: { type: SchemaType.NUMBER },
              is_local_pickup_only: { type: SchemaType.BOOLEAN },
              current_bid: { type: SchemaType.NUMBER, nullable: true }
            },
            required: ['is_auction', 'urgency', 'platform', 'buyers_premium_pct', 'is_local_pickup_only']
          },
          market_report: marketReportSchema,
          lot_items: {
            type: SchemaType.ARRAY,
            nullable: true,
            items: componentItemSchema
          }
        },
        required: [
          'identity',
          'title',
          'tag_title',
          'physical_substrate',
          'tier',
          'pricing_potential',
          'why_pay_up',
          'why_pass',
          'ocr_detected_text',
          'keywords',
          'condition_notes',
          'red_flags',
          'price_breakdown',
          'purchase_strategy',
          'market_report'
        ]
      }
    }
  },
  required: ['items']
};
