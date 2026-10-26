import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { publishedPosts } from '../lib/content';
import { postPath, withBase } from '../lib/paths';
import { site } from '../config/site';
export const GET: APIRoute = async (context) =>
  rss({
    title: `${site.title} · ${site.author}`,
    description: site.description,
    site: new URL(withBase(), context.site!),
    items: (await publishedPosts()).map((post) => ({
      title: `${post.data.demo ? '【示例】' : ''}${post.data.title}`,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: postPath(post.id),
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: '<language>zh-CN</language>',
  });
