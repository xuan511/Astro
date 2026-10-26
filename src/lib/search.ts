export interface SearchEntry {
  id: string;
  title: string;
  description: string;
  body: string;
  url: string;
  kind: 'tech' | 'life' | 'project';
  category: string;
  tags: string[];
  date: string;
  demo: boolean;
}

/** Validate the network boundary before a shared request can cache unusable data. */
export function parseSearchIndex(value: unknown): SearchEntry[] {
  const strings = ['id', 'title', 'description', 'body', 'url', 'category', 'date'] as const;
  if (
    !Array.isArray(value) ||
    !value.every((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
      return (
        strings.every((field) => typeof row[field] === 'string') &&
        ['tech', 'life', 'project'].includes(row.kind) &&
        Array.isArray(row.tags) &&
        row.tags.every((tag: unknown) => typeof tag === 'string') &&
        typeof row.demo === 'boolean' &&
        row.url.startsWith('/') &&
        !row.url.startsWith('//') &&
        !/[\\\u0000-\u0020]/.test(row.url)
      );
    })
  )
    throw new Error('搜索索引格式不正确');
  return value as SearchEntry[];
}

export function tokens(query: string): string[] {
  return [
    ...new Set(query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)),
  ].slice(0, 12);
}
export function searchEntries(entries: SearchEntry[], query: string, kind = 'all'): SearchEntry[] {
  const words = tokens(query);
  if (words.length === 0) return [];
  return entries
    .filter((entry) => kind === 'all' || entry.kind === kind)
    .map((entry) => {
      const title = entry.title.normalize('NFKC').toLocaleLowerCase();
      const metadata = `${entry.category} ${entry.tags.join(' ')} ${entry.description}`
        .normalize('NFKC')
        .toLocaleLowerCase();
      const body = entry.body.normalize('NFKC').toLocaleLowerCase();
      const score = words.reduce(
        (sum, word) =>
          sum +
          (title.includes(word)
            ? 9
            : metadata.includes(word)
              ? 4
              : body.includes(word)
                ? 1
                : -1000),
        0,
      );
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date))
    .map(({ entry }) => entry);
}
export function snippet(entry: SearchEntry, query: string): string {
  const word = tokens(query).find((part) => entry.body.toLocaleLowerCase().includes(part));
  if (!word) return entry.description;
  const at = entry.body.toLocaleLowerCase().indexOf(word);
  const start = Math.max(0, at - 36);
  return (
    (start ? '…' : '') +
    entry.body.slice(start, start + 155) +
    (start + 155 < entry.body.length ? '…' : '')
  );
}

/** Preserve original text while matching normalized forms; never render search data as HTML. */
export function highlightParts(text: string, query: string): { text: string; matched: boolean }[] {
  let folded = '',
    offset = 0;
  const starts: number[] = [],
    ends: number[] = [];
  for (const character of text) {
    const normalized = character.normalize('NFKC').toLocaleLowerCase();
    for (let i = 0; i < normalized.length; i++) {
      starts.push(offset);
      ends.push(offset + character.length);
    }
    folded += normalized;
    offset += character.length;
  }
  const ranges: [number, number][] = [];
  for (const word of tokens(query)) {
    let at = folded.indexOf(word);
    while (at !== -1) {
      ranges.push([starts[at], ends[at + word.length - 1]]);
      at = folded.indexOf(word, at + word.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  const parts: { text: string; matched: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), matched: false });
    parts.push({ text: text.slice(start, end), matched: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), matched: false });
  return parts;
}
