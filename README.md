# 拾间 · Ethan 的个人博客

以中文阅读、Markdown 写作和音乐为中心的静态个人网站。使用 Astro 7、TypeScript、Content Collections 与 MDX，支持 GitHub Pages。由原版拾间渐进迁移，保留视觉语言、明确标记的示例内容与旧数据恢复入口。

## 开始使用

推荐 Node 24（最低 22.23.4），在项目根目录执行：

```bash
npm ci
npm run dev
```

打开终端给出的 HTTP 地址，默认端口 4173。开发和预览服务器使用同一端口，请分别运行。

```bash
npm run check
npm test
npm run build
npm run test:built
npm run preview
```

一次执行日常检查：`npm run verify`。首次发布或修改路径逻辑后，再执行 `npm run verify:pages -- --repo=xuan511/Astro`，分别构建根目录、项目子目录与自定义域名，检查链接、字体、SEO、RSS、歌单与草稿隔离；临时成品在同盘的 `.astro/` 中生成并自动清理，现有 `dist/` 保持不变。

## 发布到 GitHub Pages

已指定源码仓库 [xuan511/Astro](https://github.com/xuan511/Astro)，预计 GitHub Pages 地址为 `https://xuan511.github.io/Astro/`。源码上传不代表 Pages 已部署成功；上线状态以 Actions 的 deploy 结果和返回的网址为准。完整源码需位于仓库根目录，不能只上传 ZIP，也不需要手动上传 dist。

1. 下载源码、解压并完成本地检查。
2. 将完整源码提交推送到 `xuan511/Astro` 的 `main` 分支。
3. 在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 Actions 中运行 **Check, build and deploy Pages**，分支选 `main`，等待 build、deploy 都成功。
5. 打开 deploy 任务输出的真实网址，按 [上线验收步骤](docs/DEPLOYMENT.md#上线后验收) 检查阅读、搜索和音乐。

只允许 `main` 发布正式站点；PR 和手动选择其他分支时只执行检查。连续提交会等待正在进行的正式部署完成。工作流汇总页提供构建目标和检查结果。

首次 Git 提交、常见失败与后续域名迁移的详细操作见 [部署说明](docs/DEPLOYMENT.md)。本地配置保留根路径 `/` 便于预览；Actions 会根据 `xuan511/Astro` 自动推导 `/Astro/`，无需改写每个页面。

## 日常修改

```bash
npm run new:post -- "我的第一篇记录" --kind=tech --slug=my-first-note
npm run new:post -- "一些日常" --kind=life --slug=ordinary-days --mdx
```

新文件默认是草稿。写好后改成 `draft: false`，检查构建，再提交推送。主站没有在线上传、云端写作或虚构的后台；内容以仓库为准。草稿标记仅控制网页生成，公开仓库仍可查看源文件；私密记录不要提交到公开仓库。

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

完整说明：[写作指南](docs/WRITING.md)、[音乐管理](docs/MUSIC.md)、[部署与迁移](docs/DEPLOYMENT.md)、[阶段验收](docs/ACCEPTANCE.md)。

## 项目结构

```text
src/
  components/          共享导航、卡片、播放器、图片与组件
  layouts/             页面外壳与文章列表
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

四篇原有示例文章、三条示例随记和原创合成音乐「纸上微光」都明确标记为示例。一份未发布草稿用于验证隔离，不生成页面。

项目资料来自 xuan511/linux-device-manager 和 xuan511/ESP32-S31-Embedded-Device-Console 的公开 README。后者保留“待真机验证”状态。没有填入虚构的成长经历、联系方式或截图。

旧数据未被自动删除。进入原站同一网址的 legacy/ 页面，导出 JSON 完整备份，再执行：

```bash
npm run import:backup -- 备份.json 新暂存目录
```

脚本把文章、媒体和其他记录还原到独立暂存目录，保留草稿状态，供检查后合并。换域名或子路径前必须先在旧网址导出。原版页面是兼容迁移工具，不是新站内容管理后端。

## 验证与边界

检查包含类型、构建、关键逻辑、整站页面/图片/字体链接、Canonical、RSS、Sitemap、草稿隔离与根路径、项目子路径、自定义域名。删除示例文章不会破坏构建检查，Lighthouse 也会自动选择实际发布的文章。准确结果和手动步骤见阶段验收文档。GitHub Actions 已配置；源码上传和配置存在不代表已经上线，实际部署结果应在 [仓库 Actions](https://github.com/xuan511/Astro/actions) 核实。

2026-10-27 在 Windows、Node 24.19.0 上完成新一轮检查，修复父目录配置干扰、跨盘预检、搜索异步边界、播放器恢复与重试，以及浅色辅助文字对比度。浏览器已验证根路径和 `/blog/` 的导航、搜索与音乐连续播放；本轮 Lighthouse 使用本机 Chrome 和生产预览，实际条件与结果见 [阶段验收](docs/ACCEPTANCE.md)。本地结果不能替代部署后的网络与真机验收。

以后迁移自有服务器时发布 dist/，配置域名与 404 即可，不需要运行 Node。音乐地址可换成对象存储 URL。可视化 CMS、账号和云存储属于后续功能，当前没有无法运行的占位接口。
