export interface SiteConfig {
  title: string;
  homeTopic: string;
  homeDescription: string;
  author: string;
  description: string;
  avatar: string;
  navigation: { label: string; items: { label: string; path: string }[] }[];
  social: { label: string; url: string }[];
  interests: string[];
  timeline: { year: string; text: string }[];
  defaultTheme: 'system' | 'light' | 'dark';
}

export const site: SiteConfig = {
  title: 'Qing Notes',
  homeTopic: '嵌入式与 Linux 博客',
  homeDescription:
    '红叶清雨的个人博客，记录 STM32、ESP32 和 Linux 的开发笔记与项目实践，也收录个人日志与口琴谱。',
  author: '红叶清雨',
  description: '红叶清雨的个人博客，收录技术文章、项目、日志与口琴谱。',
  avatar: 'images/avatar-user.webp',
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
  timeline: [],
  defaultTheme: 'system',
};
