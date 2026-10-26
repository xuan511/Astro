import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1).max(150),
        description: z.string().min(1).max(300),
        publishedAt: z.coerce.date(),
        updatedAt: z.coerce.date().optional(),
        kind: z.enum(['tech', 'life']),
        category: z.string().min(1),
        tags: z.array(z.string().min(1)).default([]),
        draft: z.boolean().default(true),
        featured: z.boolean().default(false),
        demo: z.boolean().default(false),
        tone: z.enum(['sage', 'sand', 'night', 'lavender']).default('sage'),
        cover: z.union([z.string().regex(/^(?:https?:\/\/|images\/|media\/)/), image()]).optional(),
        coverAlt: z.string().default('文章封面插画'),
      })
      .refine((post) => !post.updatedAt || post.updatedAt >= post.publishedAt, {
        message: '更新时间不能早于发布时间',
        path: ['updatedAt'],
      }),
});

const projects = defineCollection({
  loader: file('src/data/projects.json'),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    stack: z.array(z.string()),
    status: z.enum(['持续维护', '待真机验证', '已归档', '开发中']),
    github: z.url(),
    details: z.array(z.string()),
    screenshot: z.string().optional(),
    screenshotAlt: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const notes = defineCollection({
  loader: file('src/data/notes.json'),
  schema: z.object({
    body: z.string().max(3000),
    date: z.coerce.date(),
    demo: z.boolean().default(false),
  }),
});

export const collections = { posts, projects, notes };
