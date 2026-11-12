import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const coopDocs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coop' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    updatedDate: z.string(),
    hatTags: z.array(z.string()).default([]),
    order: z.number().default(10),
  }),
});

const charter = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/charter' }),
  schema: z.object({
    sectionId: z.enum(['payouts', 'monthly', 'expenses', 'governance', 'legal']),
    order: z.number(),
    icon: z.string(),
    title: z.string(),
    summary: z.string(),
    stat: z.string(),
    memberHref: z.string(),
    memberCtaLabel: z.string(),
  }),
});

const tax = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tax' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    updatedDate: z.string(),
  }),
});

const roleHelp = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/roles' }),
  schema: z.object({
    hatId: z.enum(['curator', 'promoter', 'enabler', 'consignor', 'founder']),
    order: z.number(),
    icon: z.string(),
    title: z.string(),
    pitch: z.string(),
    tags: z.array(z.string()).default([]),
    showInJoinGrid: z.boolean().default(true),
  }),
});

export const collections = {
  coopDocs,
  charter,
  tax,
  roleHelp,
};

