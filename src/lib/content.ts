import { getCollection } from 'astro:content';
import { selectPublishedPosts } from './post-query';
import type { PostKind } from './post-query';

export async function publishedPosts(kind?: PostKind) {
  return selectPublishedPosts(await getCollection('posts'), kind);
}

export async function recentNotes(limit?: number) {
  const notes = (await getCollection('notes')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
  return limit ? notes.slice(0, limit) : notes;
}
