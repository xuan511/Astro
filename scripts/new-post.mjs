import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createPost(
  title,
  { kind = 'tech', slug, mdx = false, root = process.cwd() } = {},
) {
  if (!title?.trim()) throw new Error('请提供文章标题。');
  if (!['tech', 'life'].includes(kind)) throw new Error('--kind 只能是 tech 或 life。');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  const id =
    slug ||
    title
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}-]+/gu, '-')
      .replace(/^-|-$/g, '');
  if (!/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(id))
    throw new Error('slug 只能包含文字、数字与连字符。');
  const path = resolve(root, 'src/content/posts', `${id}.${mdx ? 'mdx' : 'md'}`);
  const data = {
    title: title.trim(),
    description: '写一段简短摘要。',
    publishedAt: date,
    kind,
    category: kind === 'tech' ? '学习笔记' : '日常',
    tags: [],
    draft: true,
    featured: false,
    demo: false,
  };
  const frontmatter = Object.entries(data)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');
  const body = `---\n${frontmatter}\n---\n\n## ${kind === 'tech' ? '背景' : '记下一点'}\n\n从这里开始。\n`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, { flag: 'wx' });
  return path;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const title = args.find((arg) => !arg.startsWith('--'));
  const options = Object.fromEntries(
    args
      .filter((arg) => arg.startsWith('--'))
      .map((arg) => {
        const [key, value] = arg.slice(2).split('=');
        if (!['kind', 'slug', 'mdx'].includes(key)) throw new Error(`未知选项：${key}`);
        return [key, key === 'mdx' ? true : value];
      }),
  );
  try {
    console.log(
      `已创建草稿：${await createPost(title, options)}\n完成后把 draft 改成 false，再提交仓库。`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
