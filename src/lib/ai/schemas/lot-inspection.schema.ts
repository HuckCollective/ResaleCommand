import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { priceBreakdownSchema, marketReportSchema, componentItemSchema } from './common.schema';

export const lotInspectionResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    identity: { type: SchemaType.STRING },
    title: { type: SchemaType.STRING },
    keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    condition_notes: { type: SchemaType.STRING },
    country_of_origin: { type: SchemaType.STRING },
    red_flags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    price_breakdown: priceBreakdownSchema,
    purchase_strategy: {
      type: SchemaType.OBJECT,
      properties: {
        verdict: { type: SchemaType.STRING, format: 'enum', enum: ['BUY_NOW', 'WATCH', 'PASS', 'NEGOTIATE', 'CHASE_AUCTION'] },
        current_asking_price: { type: SchemaType.STRING },
        max_bid: { type: SchemaType.NUMBER },
        max_landed_cost: { type: SchemaType.NUMBER },
        advice: { type: SchemaType.STRING }
      },
      required: ['verdict', 'max_bid', 'max_landed_cost', 'advice']
    },
    market_report: marketReportSchema,
    exit_strategy: {
      type: SchemaType.OBJECT,
      properties: {
        summary: { type: SchemaType.STRING },
        projected_bulk_yield: { type: SchemaType.NUMBER },
        projected_split_yield: { type: SchemaType.NUMBER },
        profit_increase_pct: { type: SchemaType.NUMBER },
        hero_singles: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              est_price: { type: SchemaType.STRING },
              target_channel: { type: SchemaType.STRING },
              reason: { type: SchemaType.STRING }
            },
            required: ['name', 'est_price', 'target_channel', 'reason']
          }
        },
        themed_combines: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              est_price: { type: SchemaType.STRING },
              items: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              reason: { type: SchemaType.STRING }
            },
            required: ['name', 'est_price', 'items', 'reason']
          }
        },
        floor_fillers: {
          type: SchemaType.OBJECT,
          nullable: true,
          properties: {
            name: { type: SchemaType.STRING },
            est_price: { type: SchemaType.STRING },
            count: { type: SchemaType.INTEGER },
            target_channel: { type: SchemaType.STRING }
          },
          required: ['name', 'est_price', 'count', 'target_channel']
        }
      },
      required: ['summary', 'projected_bulk_yield', 'projected_split_yield', 'profit_increase_pct', 'hero_singles', 'themed_combines']
    },
    lot_items: {
      type: SchemaType.ARRAY,
      items: componentItemSchema
    }
  },
  required: [
    'identity',
    'title',
    'keywords',
    'condition_notes',
    'red_flags',
    'price_breakdown',
    'purchase_strategy',
    'market_report',
    'exit_strategy',
    'lot_items'
  ]
};
