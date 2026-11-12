import type { CollectionEntry } from 'astro:content';
import { calendarDate } from './dates.ts';

type Post = CollectionEntry<'posts'>;
export type PostKind = Post['data']['kind'];
export type PostTaxonomy = 'category' | 'tags';

/** Draft policy and publication order are shared by pages, feeds and search. */
export function selectPublishedPosts<T extends Post>(posts: readonly T[], kind?: PostKind): T[] {
  return posts
    .filter(({ data }) => !data.draft && (!kind || data.kind === kind))
    .sort((a, b) => {
      const time = b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
      return time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
}

/** Compose these queries from the same published, ordered list. */
export function groupPostsByTaxonomy<T extends Post>(posts: readonly T[], taxonomy: PostTaxonomy) {
  const groups = new Map<string, T[]>();
  for (const post of posts) {
    const names = taxonomy === 'category' ? [post.data.category] : post.data.tags;
    for (const name of new Set(names)) {
      const group = groups.get(name);
      if (group) group.push(post);
      else groups.set(name, [post]);
    }
  }
  return [...groups].map(([name, entries]) => ({ name, posts: entries }));
}

export function postsWithNeighbors<T extends Post>(
  posts: readonly T[],
): { post: T; previous: T | undefined; next: T | undefined }[] {
  return posts.map((post, index) => ({
    post,
    previous: posts[index + 1],
    next: posts[index - 1],
  }));
}

export function groupPostsByYear<T extends Post>(posts: readonly T[]) {
  const groups = new Map<number, { post: T; date: ReturnType<typeof calendarDate> }[]>();
  for (const post of posts) {
    const date = calendarDate(post.data.publishedAt);
    const entry = { post, date };
    const group = groups.get(date.year);
    if (group) group.push(entry);
    else groups.set(date.year, [entry]);
  }
  return [...groups].map(([year, entries]) => ({ year, entries }));
}
