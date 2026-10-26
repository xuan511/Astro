export interface SiteConfig {
  title: string;
  author: string;
  description: string;
  avatar: string;
  hero: { title: string; description: string; note: string };
  navigation: { label: string; path: string }[];
  social: { label: string; url: string }[];
  interests: string[];
  about: string[];
  timeline: { year: string; text: string }[];
  defaultTheme: 'system' | 'light' | 'dark';
  footer: string;
}

export const site: SiteConfig = {
  title: '拾间',
  author: 'Ethan',
  description: '记录代码、日常与值得留下的片刻。',
  avatar: 'images/avatar.svg',
  hero: {
    title: '记录，是生活的\n另一种回声。',
    description: '关于代码的思考，关于生活的碎片。\n把那些不想忘记的事情，慢慢写下来。',
    note: 'WRITE A LITTLE. LIVE A LOT.',
  },
  navigation: [
    { label: '首页', path: '' },
    { label: '技术', path: 'tech/' },
    { label: '生活', path: 'life/' },
    { label: '项目', path: 'projects/' },
    { label: '音乐', path: 'music/' },
    { label: '关于', path: 'about/' },
  ],
  social: [{ label: 'GitHub', url: 'https://github.com/xuan511' }],
  interests: ['嵌入式', 'Linux', '音乐', '日常记录'],
  about: [
    '你好，我是 Ethan。这里是拾间，一个用来记录代码、想法和日常的小站。',
    '我对嵌入式与 Linux 感兴趣，也喜欢在文字之外，给音乐和普通的生活留一点时间。',
    '把遇到的问题慢慢弄明白，把不想忘记的片刻写下来。这就是这个小站的起点。',
  ],
  timeline: [],
  defaultTheme: 'light',
  footer: '慢慢记录，认真生活。',
};
