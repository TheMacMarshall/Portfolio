import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const projects = defineCollection({
  loader: glob({
    pattern: "**/index.mdx",
    base: "./src/content/projects",
    generateId: ({ entry }) => entry.replace(/\/index\.mdx$/, ""),
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().trim().min(1).max(90),
        description: z.string().trim().min(1).max(180),
        year: z.number().int().min(1900).max(2100),
        role: z.array(z.string().trim().min(1)).default([]),
        client: z.string().trim().min(1).optional(),
        industry: z.string().trim().min(1).optional(),
        disciplines: z.array(z.string().trim().min(1)).default([]),
        tags: z.array(z.string().trim().min(1)).default([]),
        featured: z.boolean().default(false),
        order: z.number().int().positive().optional(),
        cover: image(),
        coverAlt: z.string().trim().min(1).max(180),
        placeholder: z.boolean().default(false),
      })
      .strict(),
});

export const collections = { projects };
