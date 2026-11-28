export interface SiteConfig {
  title: string;
  homeTopic: string;
  homeDescription: string;
  author: string;
  description: string;
  avatar: string;
  hero: { title: string; description: string; note: string };
  navigation: { label: string; items: { label: string; path: string }[] }[];
  social: { label: string; url: string }[];
  interests: string[];
  about: string[];
  timeline: { year: string; text: string }[];
  defaultTheme: 'system' | 'light' | 'dark';
  footer: string;
}

export const site: SiteConfig = {
  title: 'Qing Notes',
  homeTopic: '嵌入式与 Linux 博客',
  homeDescription:
    '红叶清雨的个人博客，记录 STM32、ESP32 和 Linux 的开发笔记与项目实践，也收录个人日志与口琴谱。',
  author: '红叶清雨',
  description: '记录代码、日常与值得留下的片刻。',
  avatar: 'images/avatar-user.webp',
  hero: {
    title: '记录，是生活的\n另一种回声。',
    description: '关于代码的思考，关于生活的碎片。\n把那些不想忘记的事情，慢慢写下来。',
    note: 'WRITE A LITTLE. LIVE A LOT.',
  },
  navigation: [
    {
      label: '阅读',
      items: [
        { label: '技术', path: 'tech/' },
        { label: '日志', path: 'log/' },
        { label: '归档', path: 'archive/' },
        { label: '生活', path: 'life/' },
        { label: '随记', path: 'notes/' },
      ],
    },
    {
      label: '音乐',
      items: [
        { label: '音乐台', path: 'music/' },
        { label: '口琴谱', path: 'music/scores/' },
      ],
    },
    {
      label: '小站',
      items: [
        { label: '首页', path: '' },
        { label: '项目', path: 'projects/' },
        { label: '资源下载', path: 'resources/' },
        { label: '访问统计', path: 'stats/' },
        { label: '关于', path: 'about/' },
      ],
    },
  ],
  social: [{ label: 'GitHub', url: 'https://github.com/xuan511' }],
  interests: ['嵌入式', 'Linux', '音乐', '日常记录'],
  about: [
    '你好，我是红叶清雨。这里是 Qing Notes，一个用来记录代码、想法和日常的小站。',
    '我对嵌入式与 Linux 感兴趣，也喜欢在文字之外，给音乐和普通的生活留一点时间。',
    '把遇到的问题慢慢弄明白，把不想忘记的片刻写下来。这就是这个小站的起点。',
  ],
  timeline: [],
  defaultTheme: 'system',
  footer: '慢慢记录，认真生活。',
};
