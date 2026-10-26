正式内容来自仓库。网页不会声称已经上传文件、保存到服务器或发布文章。

## 新建与发布

```bash
npm run new:post -- "第一次学习记录" --kind=tech --slug=my-first-note
npm run new:post -- "一个普通的下午" --kind=life --slug=an-ordinary-afternoon --mdx
```

文件位于 `src/content/posts/`。新文章默认 `draft: true`，不会生成页面，也不会进入首页、分类、标签、搜索、RSS 或 Sitemap。要正式发布，改为 `draft: false`，运行检查和构建，然后提交、推送仓库。删除文章则删除对应文件，再推送。

```yaml
---
title: '文章标题'
description: '用于列表与 SEO 的简短摘要，最多 300 字。'
publishedAt: 2026-10-23
updatedAt: 2026-10-23
kind: tech
category: Linux
tags: [C, 系统编程]
draft: true
featured: false
demo: false
---
```

`kind` 只能为 `tech` 或 `life`；分类与标签可自由增加。`updatedAt` 可以省略，但不能早于发布时间。`featured: true` 会进入首页精选。文章文件名决定 URL，请尽量保持稳定；子目录也会成为 URL 的一部分。示例文章使用 `demo: true` 明确标记。

`draft: true` 只控制是否生成公开网页，不提供仓库保密。如果源码仓库公开，别人仍能查看草稿源文件；私密记录请保存在仓库外。

## 图片与封面

推荐为每篇文章建立独立的图片目录：

```text
src/content/posts/my-first-note.md
src/content/posts/photos/my-first-note/terminal.png
```

正文引用 `![终端实际输出](./photos/my-first-note/terminal.png)`。Astro 在构建时处理本地图片，生成尺寸信息与优化产物；正文图片默认懒加载。请写有意义的替代文字。封面可以写 `cover: "./photos/my-first-note/cover.jpg"` 与 `coverAlt: "封面内容说明"`，同样可进入图片处理流程。

少量无需处理的图标放在 `public/images/`，在 frontmatter 中写 `cover: "images/cover.svg"`。Markdown 正文引用公共图片可写 `/images/photo.webp`，构建插件会补上 GitHub Pages 子路径。不要在内容里写死当前站点域名。外部 HTTPS 图片可以使用完整地址；部署方要自行保证这些资源长期可访问。

## Markdown / MDX

支持 GFM 表格、引用、任务列表、带语言名的代码块和数学公式。代码块由 Shiki 在构建时高亮；阅读页提供复制、目录与进度。行内公式使用 `$...$`，独立公式使用 `$$`。公式由 KaTeX 在构建时生成 HTML，不下载运行时公式脚本。

`.mdx` 可以导入 Astro 组件，例如 `import Callout from '../../components/Callout.astro'`。参考已标记为示例的 `start-with-one-question.mdx`。MDX 是受信任的仓库代码，允许组件执行，因此不要直接合并来路不明的 MDX。

## 修改其他内容

| 内容                                             | 位置                                 |
| ------------------------------------------------ | ------------------------------------ |
| 标题、作者、头像、导航、社交链接、兴趣、成长经历 | `src/config/site.ts`                 |
| 项目名称、说明、技术栈、状态、截图、GitHub       | `src/data/projects.json`             |
| 简短动态                                         | `src/data/notes.json`                |
| 歌曲清单                                         | `src/data/music.json`                |
| 音乐文件                                         | `public/music/`                      |
| 域名、子路径                                     | `config/deployment.json`，或环境变量 |

项目截图是可选项；没有真实截图时不显示伪造界面。成长经历目前留空，补入自己的真实记录即可。联系邮箱未设置，可以在 `site.social` 添加 `mailto:` 链接。

## 本地验证

```bash
npm run dev
npm run check
npm test
npm run build
npm run test:built
```

打开本地终端显示的地址，检查正文、代码复制、目录、手机布局与主题。构建产物在 `dist/`，只读 `file://` 无法完整验证客户端导航，请使用 HTTP 预览。

## 旧版迁移

原版源码保留在 `legacy/`，兼容页面位于网站的 `legacy/` 路径。它会读取同一站点原来的本地写作数据库。先从兼容页面的数据备份中导出 JSON，再执行：

```bash
npm run import:backup -- "shijian-backup.json" migration-output
```

脚本生成全新的暂存目录，保留文章的草稿状态并还原媒体，不覆盖源码。按暂存目录的 `README.txt` 合并文章、媒体、歌单和随记；资料、回收站和媒体映射也会保留。预览检查后再提交，原始 JSON 备份继续保留。

不要清除浏览器数据。换了域名、浏览器或站点子路径后，必须先在旧网址导出。
