import { getCollection } from 'astro:content';

export async function publishedPosts() {
  return (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
}

export async function recentNotes(limit?: number) {
  const notes = (await getCollection('notes')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
  return limit ? notes.slice(0, limit) : notes;
}
