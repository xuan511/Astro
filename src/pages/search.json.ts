import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { publishedPosts } from '../lib/content';
import { postPath, projectPath } from '../lib/paths';
import type { SearchEntry } from '../lib/search';
export const GET: APIRoute = async () => {
  const posts = await publishedPosts();
  const projects = await getCollection('projects');
  const rows: SearchEntry[] = posts.map((post) => ({
    id: post.id,
    title: post.data.title,
    description: post.data.description,
    body: (post.body || '')
      .replace(/^import .+$/gm, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[#*`>]/g, '')
      .replace(/\s+/g, ' '),
    url: postPath(post.id),
    kind: post.data.kind,
    category: post.data.category,
    tags: post.data.tags,
    date: post.data.publishedAt.toISOString(),
    demo: post.data.demo,
  }));
  rows.push(
    ...projects.map((project): SearchEntry => ({
      id: project.id,
      title: project.data.name,
      description: project.data.description,
      body: project.data.details.join(' '),
      url: projectPath(project.id),
      kind: 'project',
      category: '项目',
      tags: project.data.stack,
      date: '',
      demo: false,
    })),
  );
  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
