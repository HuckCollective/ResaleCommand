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

export const collections = {
  coopDocs,
};
