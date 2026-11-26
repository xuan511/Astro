# 拾间 · Ethan 的个人博客

红叶清雨的个人网站，以中文阅读、Markdown 写作和音乐为中心。使用 Astro 7、TypeScript、Content Collections 与 MDX，支持 GitHub Pages。由原版拾间渐进迁移，保留视觉语言、明确标记的示例内容与旧数据恢复入口。

2026-11-18 参照 [XHBlogs](https://github.com/heiehiehi/XinghuisamaBlogs) 改为毛玻璃卡片首页：个人名片、同步音乐卡、精选切换、随记和背景选择，阅读页保留清晰底色。参考、许可与适配边界见 [改版说明](docs/XHBLOGS-REFERENCE.md)。

## 开始使用

推荐 Node 24（最低 22.23.4），在项目根目录执行：

```bash
npm ci
npm run dev
```

打开终端给出的 HTTP 地址，默认端口 4173。开发和预览服务器使用同一端口，请分别运行。

```bash
npm run check
npm run check:architecture
npm test
npm run build
npm run test:built
npm run preview
```

一次执行日常检查：`npm run verify`（类型与内容、架构、测试、构建、成品）。格式检查独立提供建议，不阻断发布；文章目录不交给 Prettier 重排。可选 `npm run format:check` 或 `npm run verify:strict`。首次发布或修改路径逻辑后，再执行 `npm run verify:pages -- --repo=xuan511/Astro`，分别构建根目录、项目子目录与自定义域名，检查链接、字体、SEO、RSS、歌单与草稿隔离；临时成品在同盘的 `.astro/` 中生成并自动清理，现有 `dist/` 保持不变。

## 发布到 GitHub Pages

已指定源码仓库 [xuan511/Astro](https://github.com/xuan511/Astro)，预计 GitHub Pages 地址为 `https://xuan511.github.io/Astro/`。源码上传不代表 Pages 已部署成功；上线状态以 Actions 的 deploy 结果和返回的网址为准。完整源码需位于仓库根目录，不能只上传 ZIP，也不需要手动上传 dist。

1. 下载源码、解压并完成本地检查。
2. 将完整源码提交推送到 `xuan511/Astro` 的 `main` 分支。
3. 在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 Actions 中运行 **Check, build and deploy Pages**，分支选 `main`，等待 build、paths、deploy 都成功。
5. 打开 deploy 任务输出的真实网址，按 [上线验收步骤](docs/DEPLOYMENT.md#上线后验收) 检查阅读、搜索和音乐。

只允许 `main` 发布正式站点；PR 和手动选择其他分支时只执行检查。连续提交会等待正在进行的正式部署完成。工作流汇总页提供构建目标和检查结果。

首次 Git 提交、常见失败与后续域名迁移的详细操作见 [部署说明](docs/DEPLOYMENT.md)。本地配置保留根路径 `/` 便于预览；Actions 会根据 `xuan511/Astro` 自动推导 `/Astro/`，无需改写每个页面。

## 写作与发布文章

文章保存在 `src/content/posts/`，日常写作用 UTF-8 编码的 `.md` 文件。文件名会成为文章地址的一部分，例如 `uart-notes.md` 上线后对应 `/Astro/posts/uart-notes/`。建议用小写英文、数字和连字符命名。更新已上线的文章时，编辑原文件以保留访问地址。

### 1. 新建文章

第一次在这台电脑上写作，可以先克隆仓库并安装依赖。已有本地仓库时，在项目根目录开始，先同步 `main` 再编辑。

```bash
git clone https://github.com/xuan511/Astro.git
cd Astro
npm ci
```

用 VS Code 打开项目，在项目根目录运行下面的命令生成草稿。生活随笔使用 `--kind=life`，日志使用 `--kind=log`。也可以手动创建同名文件并使用下一节的模板。

```bash
npm run new:post -- "串口联调笔记" --kind=tech --slug=uart-notes
```

### 2. 填写文章信息和正文

下面是一篇可完整复制的草稿。将开头的 `---` 放在文件首行，两个分隔线之间填写 YAML 文章信息（frontmatter），结束分隔线下方留一行，再写 Markdown 正文。

`````markdown
---
title: '串口联调笔记'
description: '记录 STM32 与 ESP32 串口联调时检查的参数和会话流程。'
publishedAt: 2026-11-26
kind: tech
category: 嵌入式
tags: [STM32, ESP32, UART]
draft: true
featured: false
---

先确认两块板的串口参数一致，再观察启动时的收发日志。

## 检查串口参数

- 检查波特率、数据位和停止位。
- 检查两块板是否共地。

### 观察会话日志

收到 `READY` 后开始发送后续指令。

```text
STM32 → ESP32: HELLO
ESP32 → STM32: READY
```
`````

| 字段 | 填法 |
| --- | --- |
| `title` | 必填，页面标题，最多 150 字。正文可从 `##` 开始。 |
| `description` | 必填，列表页和搜索引擎使用的摘要，最多 300 字。 |
| `publishedAt` | 必填，填实际发布日期，格式为 `YYYY-MM-DD`。日期用于显示与排序。 |
| `kind` | 必填，`tech` 进入技术栏目，`life` 进入生活栏目，`log` 进入独立日志栏目。 |
| `category` | 必填，文章的主分类，例如 `嵌入式`。 |
| `tags` | 可选，用英文方括号和逗号列出标签，例如 `[STM32, UART]`。 |
| `draft` | `true` 保持草稿，`false` 随部署公开。省略时默认为 `true`。 |
| `featured` | 设为 `true` 时优先参与首页精选，默认为 `false`。 |
| `updatedAt` | 可选，用于标记文章更新日期，须晚于或等于 `publishedAt`。 |

YAML 使用英文冒号，冒号后留空格。布尔值写 `true` / `false`，给它们加引号会变成字符串。含冒号的标题或摘要建议用引号包起来。草稿标记只控制站点是否生成页面，公开仓库仍可读取已提交的草稿源码。

### 3. 写 Markdown 和添加图片

| 想显示的内容 | 在正文中输入 |
| --- | --- |
| 二级、三级标题 | `## 调试过程`、`### 第一次上电` |
| 加粗、行内代码 | `**重点**`、`` `READY` `` |
| 无序列表、有序列表 | 每行用 `- ` 或 `1. ` 开头 |
| 引用 | 行首写 `> ` |
| 链接 | `[项目源码](https://github.com/xuan511/embedded-smart-home)` |
| 图片 | `![串口联调日志](./photos/uart-notes/terminal.png)` |
| 行内公式、单独成行的公式 | `$E=mc^2$`、`$$E=mc^2$$` |

自然段之间空一行。多行代码用三个反引号围起来，在开头的反引号后加语言名，例如 `c`、`bash` 或 `text`。表格的第二行写列分隔线，例如 `| --- | --- |`。

上表的图片路径相对于文章文件。把图片保存为 `src/content/posts/photos/uart-notes/terminal.png`，与文章一起提交。需要封面时，在 frontmatter 加上 `cover: "./photos/uart-notes/terminal.png"` 和 `coverAlt: "串口联调日志"`。

### 4. 本地检查并发布

1. 写完后把 `draft` 改为 `false`，运行 `npm run dev`，打开终端显示的网址，再进入 `/posts/uart-notes/`。检查标题、图片、代码块和链接。
2. 结束预览后运行 `npm run verify`。检查通过后提交文章。若添加了图片，也要将图片文件加入同一次提交。

```bash
npm run verify
git add -- src/content/posts/uart-notes.md
# 添加了图片时，再执行下一行
# git add -- src/content/posts/photos/uart-notes/
git diff --cached
git commit -m "发布串口联调笔记"
git push origin main
```

3. 打开 [GitHub Actions](https://github.com/xuan511/Astro/actions/workflows/deploy.yml)，找到这次提交的 **Check, build and deploy Pages**，等 `deploy` 任务成功后打开文章网址检查。走 PR 流程时，合并到 `main` 后才会发布。

### 只用 GitHub 网页发布

1. 打开仓库，选择 `main`，进入 [文章目录](https://github.com/xuan511/Astro/tree/main/src/content/posts)。
2. 已有 `.md` 文件时，点 **Add file → Upload files** 上传。直接在网页写时，点 **Add file → Create new file**，输入文件名（如 `uart-notes.md`），粘贴完整文章。图片按正文引用的路径上传。
3. 检查 `draft: false`，点 **Commit changes**。有权限时可提交到 `main`，也可以创建分支并开 PR，再合并到 `main`。按上节查看部署结果。[GitHub 添加文件说明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)

如果部署成功却找不到文章，先核对源码里是否写了 `draft: false`，再检查 URL 的文件名和 `/Astro/` 前缀。构建失败时，打开 Actions 里失败的任务，优先查看报错的文件路径、YAML 字段和图片链接。

## 其他日常修改

| 内容                                                     | 文件                                |
| -------------------------------------------------------- | ----------------------------------- |
| 标题、作者、头像、导航、社交、兴趣、成长经历、主题默认值 | `src/config/site.ts`                |
| 技术文章与生活随笔                                       | `src/content/posts/**/*.{md,mdx}`   |
| 项目名称、技术栈、状态、截图和详情                       | `src/data/projects.json`            |
| 随记                                                     | `src/data/notes.json`               |
| 歌单信息                                                 | `src/data/music.json`               |
| 音频文件                                                 | `public/music/`                     |
| 域名与子路径                                             | `config/deployment.json` 或环境变量 |
| 设计变量与样式                                           | `src/styles/`、组件内样式           |

完整说明：[架构与边界](docs/ARCHITECTURE.md)、[设计系统](docs/DESIGN.md)、[开发与交付](CONTRIBUTING.md)、[写作指南](docs/WRITING.md)、[音乐管理](docs/MUSIC.md)、[部署与迁移](docs/DEPLOYMENT.md)、[阶段验收](docs/ACCEPTANCE.md)。

## 项目结构

```text
src/
  components/          共享导航、卡片、播放器、图片与组件
  layouts/             全站外壳、文章展示与文章列表
  pages/               首页、文章、栏目、项目、音乐、搜索、RSS、404
  content/posts/       Markdown / MDX 与草稿
  content.config.ts    文章、项目、随记的类型与校验
  config/site.ts       统一站点配置
  data/                项目、随记和歌单
  lib/                 路径、内容查询、搜索与播放逻辑
  scripts/             必要的浏览器交互
  styles/              设计变量、正文与播放器样式
public/                静态资源、音频、旧版恢复页面
scripts/               新建文章、迁移、部署与构建检查
tests/                 逻辑测试
docs/                  中文说明
legacy/                原版源码、工具与说明
.github/workflows/     检查部署、手动 Lighthouse 审计
```

## 可用功能

- 首页个人简介、精选/最新文章、真实公开项目、随记与音乐入口。
- 技术与生活栏目、分类、标签、归档，标题/正文/标签/项目搜索。
- Markdown / MDX、发布与更新日期、Shiki 高亮、代码复制、自动目录、阅读进度、图片、GFM 表格、引用与 KaTeX 公式。
- 生活文章使用更舒展的衬线排版，支持封面。项目截图可选，没有真实截图时不显示伪造界面。
- 音乐页与全站迷你播放器，进度、音量、播放列表、顺序/单曲/随机、键盘交互、偏好与进度记忆。
- 浅色/深色、手机/平板布局、跳到正文、键盘焦点、减少动画偏好。
- SEO、Open Graph、文章结构化数据、RSS、Sitemap、robots 与 404。

## 阅读与查找 · v3.1

- 点击导航搜索，或按 `Ctrl / ⌘ K`、非输入状态下按 `/`，在当前页面打开快捷搜索。方向键浏览结果，Enter 打开，Esc 关闭；音乐继续播放。独立搜索页与弹窗共享索引、排序、范围筛选和安全高亮。
- 文章顶部提供 16 / 18 / 20px 正文字号与桌面宽屏阅读，设置保存在当前浏览器。标题、代码与导航保持各自排版。
- 手机目录固定在阅读区域顶部，显示当前章节；点击条目自动收起。桌面目录随滚动定位，章节旁的 `#` 可直接链接到该节。
- 正文图片和生活封面支持点击放大，Esc、关闭按钮或背景退出，焦点返回原图片。已有链接的图片保留原链接行为。
- 文章链接可一键复制，代码与表格支持键盘横向滚动；手机菜单按 Esc 关闭后恢复焦点，主题按钮随模式显示月亮或太阳。

设计参考、取舍和自行测试步骤见 [体验改进记录](docs/EXPERIENCE.md)。没有增加客户端框架或新依赖；站点仍为可部署至 GitHub Pages 的静态 Astro 项目。

## 架构选择

### 展示层与设计系统 · 2026-11-13

参考 wdxtub.com 实际页面的紧凑导航、阅读宽度和内容层级，保留拾间既有配色与内容。`tokens.css` 集中管理布局、字号、间距和控件；首页、文章卡片与全局壳分别拥有样式。文章路由只组装数据，`PostLayout` 负责阅读展示，桌面和手机目录共用 `TocLinks`。

首页、文章、栏目、关于、归档、项目和随记使用统一对齐规则；文章先保证正文宽度，再显示侧目录和宽阅读按钮。播放器与浮层采用 44px 操作区，窄屏换行和错误状态预留空间。成品检查新增阅读结构、目录目标、卡片标题与封面的回归约束，设计依据和维护规则见 [设计系统](docs/DESIGN.md)。

### 规则与工程门禁 · 2026-11-12

内容读取、纯查询、页面元信息和客户端状态各有边界。文章的公开过滤、同日稳定顺序、栏目、标签、邻篇与归档使用共享查询；日期显示和归档统一到上海时区。`SeoHead` 与 Sitemap 共用索引政策，搜索和写作工具页可访问，但不进入 Sitemap。

主题控制器区分会话偏好和浏览器存储，存储失败时切页仍保留手动选择；跟随系统时响应系统变化。搜索、图片、项目速览共用原生弹层控制器，统一能力降级、互斥、背景边界和焦点恢复。音频继续由 Base 内的唯一持久播放器持有。

`npm run check:architecture` 使用 TypeScript AST 检查客户端运行时依赖，阻止构建侧内容、配置或 Node API 进入浏览器；具体检查范围和限制见架构文档。`verify` 已包含该门禁。CI 分别执行日常检查与三种部署路径验证，两者通过后才允许部署；成品检查同时校验 Sitemap/noindex 一致和每页单个持久播放器。修改与交付流程见 [CONTRIBUTING](CONTRIBUTING.md)。

### 项目浏览与搜索条件 · 2026-10-28

项目卡片将真实进度、摘要和技术栈分层展示。点击主链接进入完整项目；“快速了解”可在当前列表打开速览，桌面使用侧边抽屉，手机使用全宽对话框。Esc 或关闭按钮退出后返回原入口，列表位置保留；没有 JavaScript 时完整详情链接仍可用。

快捷搜索与独立搜索页提供可见的范围按钮、当前关键词与范围条件，条件可以分别移除，“清除全部”同时重置两者。项目还可通过 `embedded-console` 等 ID 检索。中文输入法、方向键、错误重试和快捷搜索不改文章地址的行为继续保留。

本轮未增加客户端框架或后端。相册将在有真实照片后继续实现，不生成虚构内容。实现与新一轮验收见 [体验记录](docs/EXPERIENCE.md) 和 [阶段验收](docs/ACCEPTANCE.md)。

**静态优先。** 页面在构建时生成 HTML，只为主题、搜索、阅读辅助、导航和音乐发送必要脚本。没有 React/Vue 运行时或数据库。

**组件 CSS 与设计变量。** 当前规模不需要额外 UI 套件；统一色彩、字号、间距与边框。中文使用系统字体，不依赖大体积远程字体。

**内容与展示分离。** Content Collections 负责数据结构与查询，以后可以更换 CMS/API loader，继续使用文章组件与布局。MDX 是受信任的仓库代码，不应直接执行陌生投稿。

**音乐单实例。** 使用 ClientRouter 与 transition:persist 保留共享播放器和音频节点；控制器只绑定一次。阅读观察器在离开页面时清理。首次播放由用户触发；刷新、跨站跳转和系统暂停仍可能停止播放，下次手动播放可恢复保存的进度。

**统一路径。** GitHub Actions 根据仓库自动推导用户 Pages 或项目子路径。自定义域名可以覆盖 SITE_URL 与 BASE_PATH。组件不要写死部署域名。

## 内容与迁移

2026-11-22 新增三篇项目实践文章与一篇音乐随笔，并保留用户在 GitHub 新增的《日志1》。四篇原有示例文章、三条示例随记都明确标记为示例。一份未发布草稿用于验证隔离，不生成页面。正式歌单仅保留 5 首用户提供的完整音乐，试听片段已经全部移除；专辑封面与来源见 [音乐管理](docs/MUSIC.md)。原合成示例已移除。

项目资料来自 xuan511/linux-device-manager 和 xuan511/embedded-smart-home 的公开 README 与验证文档。后者保留“待真机验证”状态。没有填入虚构的成长经历、联系方式或截图。

旧数据未被自动删除。进入原站同一网址的 legacy/ 页面，导出 JSON 完整备份，再执行：

```bash
npm run import:backup -- 备份.json 新暂存目录
```

脚本把文章、媒体和其他记录还原到独立暂存目录，保留草稿状态，供检查后合并。换域名或子路径前必须先在旧网址导出。原版页面是兼容迁移工具，不是新站内容管理后端。

## 验证与边界

检查包含类型、构建、关键逻辑、整站页面/图片/字体链接、Canonical、RSS、Sitemap、草稿隔离与根路径、项目子路径、自定义域名。删除示例文章不会破坏构建检查，Lighthouse 也会自动选择实际发布的文章。准确结果和手动步骤见阶段验收文档。GitHub Actions 已配置；源码上传和配置存在不代表已经上线，实际部署结果应在 [仓库 Actions](https://github.com/xuan511/Astro/actions) 核实。

2026-10-27 在 Windows、Node 24.19.0 上完成新一轮检查，修复父目录配置干扰、跨盘预检、搜索异步边界、播放器恢复与重试，以及浅色辅助文字对比度。浏览器已验证根路径和 `/blog/` 的导航、搜索与音乐连续播放；本轮 Lighthouse 使用本机 Chrome 和生产预览，实际条件与结果见 [阶段验收](docs/ACCEPTANCE.md)。本地结果不能替代部署后的网络与真机验收。

以后迁移自有服务器时发布 dist/，配置域名与 404 即可，不需要运行 Node。音乐地址可换成对象存储 URL。可视化 CMS、账号和云存储属于后续功能，当前没有无法运行的占位接口。

### 目录、琴谱与项目 · 2026-11-23

所有视口共用一个默认折叠的站点目录，点击顶栏「目录」展开阅读、音乐与小站入口；「日志」只收录已发布的 `kind: log` 文章，「归档」按时间列出全部已发布文章。原生 details/summary 在无脚本时仍可操作，Escape、点击外部、离开目录焦点与站内导航会关闭面板。

新增 `format: score` 内容类型，琴谱仍沿用文章的校验、草稿策略、布局、搜索和 RSS。`lib/content.ts` 统一派生口琴谱列表，入口位于 `/music/scores/` 与音乐台。第一份《Summer Pockets》保留用户的 21 行简谱，支持复制和纯文本下载。

网名为红叶清雨；智能家居项目已替换旧展示，文档链接集中于项目数据的 resources 字段。旧项目地址保留为不索引的迁移入口。
