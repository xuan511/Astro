/** Site-relative paths are resolved in one place; external storage URLs pass through. */
export function withBase(path = '', base = import.meta.env?.BASE_URL || '/'): string {
  if (/^(?:https?:|mailto:|tel:)/i.test(path) || path.startsWith('#')) return path;
  const prefix = '/' + base.split('/').filter(Boolean).join('/');
  const normalized = path.replace(/^\/+/, '');
  return `${prefix === '/' ? '' : prefix}/${normalized}`;
}

export const postPath = (id: string) =>
  withBase(`posts/${id.split('/').map(encodeURIComponent).join('/')}/`);
export const projectPath = (id: string) => withBase(`projects/${encodeURIComponent(id)}/`);
export const taxonomyPath = (kind: 'tags' | 'categories', name: string) =>
  withBase(`${kind}/${encodeURIComponent(name)}/`);
export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  }).format(date);

export function readingMinutes(body = ''): number {
  const plain = body.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, '');
  return Math.max(1, Math.ceil(plain.length / 450));
}
