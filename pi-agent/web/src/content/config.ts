// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const modules = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    // M01–M12 = 源码精读篇；P01–P07 = 实战上手篇
    module: z.string().regex(/^[MP]\d+(\.\d+)?$/),
    displayOrder: z.number(),
    status: z.enum(['published', 'draft', 'planned']),
    variant: z.enum(['ts', 'python']).default('ts'),
    counterpart: z.string().optional(),
    // book = 系列：internals（源码精读）/ practice（实战上手）
    book: z.enum(['internals', 'practice']).default('internals'),
    summary: z.string(),
    prev: z.string().optional(),
    next: z.string().optional(),
    diagrams: z.array(z.object({
      id: z.string(),
      file: z.string(),
      caption: z.string().optional(),
      darkMode: z.enum(['invert', 'native', 'none']).optional(),
      anchors: z.array(z.object({
        anchor: z.string(),
        label: z.string().optional(),
      })).optional(),
    })).optional(),
    keyPoints: z.array(z.string()).optional(),
    furtherReading: z.array(z.object({
      label: z.string(),
      url: z.string().url().optional(),
      module: z.string().optional(),
    })).optional(),
    simulator: z.object({
      preset: z.enum(['partial-message', 'error-defense']),
    }).optional(),
  }),
});

export const collections = { modules };
