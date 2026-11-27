import { site } from './site';

/** Build-time defaults. Visitor overrides live only in their own browser. */
export const presentation = {
  sidebar: { position: 'both' as const, tablet: 'left' as const },
  posts: { defaultMode: 'grid' as const, columnWidth: 280, gap: 20 },
  wallpaper: {
    mode: 'banner' as const,
    scene: 'coast' as const,
    image: 'images/coastal-summer.webp',
    responsive: {
      small: 'images/coastal-summer-800.webp',
      large: 'images/coastal-summer-1280.webp',
    },
  },
  hue: 205,
  font: 'system',
  footer: { replaceDefault: false },
  fonts: [
    {
      id: 'system',
      label: '系统黑体',
      family: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
    },
    {
      id: 'serif',
      label: '宋体 · 书页',
      family: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif',
    },
    {
      id: 'rounded',
      label: '圆体 · 轻松',
      family: '"Yuanti SC", "YouYuan", "Microsoft YaHei", sans-serif',
    },
    {
      id: 'humanist',
      label: '人文无衬线',
      family: '"Trebuchet MS", "Segoe UI", "Microsoft YaHei", sans-serif',
    },
    {
      id: 'classic',
      label: '经典衬线',
      family: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif',
    },
    {
      id: 'mono',
      label: '等宽 · 手记',
      family: '"Cascadia Code", Consolas, "Microsoft YaHei", monospace',
    },
    // Add { id, label, family, source: 'fonts/example.woff2' } for a self-hosted font.
  ] as { id: string; label: string; family: string; source?: string }[],
  navbar: {
    logo: site.avatar,
    title: site.title,
    subtitle: `${site.author}的个人手记`,
    links: site.navigation,
  },
};

export const appearanceDefaults = {
  paletteVersion: 2 as const,
  sidebar: presentation.sidebar.position,
  layout: presentation.posts.defaultMode,
  wallpaper: presentation.wallpaper.mode,
  scene: presentation.wallpaper.scene,
  solid: false,
  hue: presentation.hue,
  font: presentation.font,
};
