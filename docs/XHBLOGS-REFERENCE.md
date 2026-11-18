# XHBlogs 参考改版

2026-11-18。用户指定 [XinghuisamaBlogs](https://github.com/heiehiehi/XinghuisamaBlogs) 和 [演示站](https://www.xinghuisama.top/) 作为模板。本轮检查固定源码版本 [a5d98c8](https://github.com/heiehiehi/XinghuisamaBlogs/tree/a5d98c880af25e124d6b4c3130b2193efa90d923)，结合公开首页 HTML 与源码结构，迁移其视觉和交互思路。当前工程仍为 Astro 静态站。

## 架构事实与适配

参考仓库的 `XHBlogs/package.json` 为 Next.js 16.2.1、React 19.2.4、Tailwind 4、Framer Motion；网页页脚的 Next.js 15 徽章不能替代依赖版本证据。`XHBlogs/next.config.ts` 注释掉静态 export，以运行 API；另一个 `my-blog-manager/` 项目包含 Next 管理界面和 FastAPI 本机内容服务。

| 原参考位置                                     | 迁入拾间的体验                                             | 现有工程实现                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `app/page.tsx`、`ProfileCard.tsx`              | 搜索、个人名片与音乐卡组成首屏，后续为精选、随记和外观矩阵 | `pages/index.astro`、`HomeMusic.astro`、`HomeSpotlight.astro`，统计由实际集合派生          |
| `app/layout.tsx`、`globals.css`                | 圆角半透明表面、背景图、浅色与深色层次                     | 语义 tokens、`shell.css`；阅读正文使用更实的底色                                           |
| `Navbar.tsx`                                   | 悬浮胶囊导航、明确当前栏目                                 | 共享 Header、常规手机菜单与原键盘交互                                                      |
| `LatestPostsCarousel.tsx`                      | 封面海报、标题摘要、手动切换                               | 静态输出第一篇，按钮、圆点、左右键、Home/End 切换；隐藏项 hidden + inert；没有自动计时轮播 |
| `CloudPlayer.tsx`、`MusicProvider.tsx`         | 首页可直接听歌，与跨页播放保持同步                         | 首页复用已有 `data-player-*` 控制器和缓存进度控件；全站仍只有一个 audio                    |
| `BackgroundSlider.tsx`、`ThemeToggleBlock.tsx` | 选择页面氛围                                               | 海边夏日、云间微光、专注阅读三种背景与卡片清晰度；偏好按 base 隔离，渲染前恢复             |
| `posts/[slug]/page.tsx`、`ClientTOC.tsx`       | 阅读主卡与 sticky 目录分工                                 | 保留 PostLayout、已有标题 slug、移动目录、阅读字号与宽屏设置；增加 104px 锚点避让          |

上游 API 的 AI、天气、网易云代理、OAuth，以及本机管理端，依赖服务器或本机服务。此次展示改版继续使用仓库内容、现有搜索、现有歌单和 GitHub Pages，不增加这些服务的假入口。也不迁入上游 `ignoreBuildErrors:true` 或隐藏整个站点等待 Splash 的启动方式。

## 许可、素材与改动说明

XHBlogs 作者为 **heiehiehi / XingHuiSama**，原仓库 [LICENSE](https://github.com/heiehiehi/XinghuisamaBlogs/blob/a5d98c880af25e124d6b4c3130b2193efa90d923/LICENSE) 为 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)。页脚保留作者、仓库和许可链接。

此次按照其信息结构和视觉思路独立编写 Astro 组件与 CSS，改动为：适配拾间品牌及内容、静态生成、现有播放器与搜索、外观偏好、响应式阅读和工程检查。没有整套迁入 Next 源码。上述署名不改变拾间已有代码和各自素材原本的权利归属。

`public/images/coastal-summer.webp` 是本轮用 imagegen 新绘的原创夏日海湾背景，原画 1672×941，按页面用途缩放为 1600×900、编码为 112610 字节 WebP。角色素材继续按 [COMPANIONS.md](COMPANIONS.md) 管理，曲目与封面按 [MUSIC.md](MUSIC.md) 管理。参考站的个人照片、文章、外链壁纸、音乐和第三方宠物动画未进入交付文件。

上游大肥鱼素材另有 CC BY-NC-SA 4.0 和独立署名，不属于可用主仓库许可覆盖的素材。本工程继续使用已建立的小伙伴组件。

## 工程边界与验收

开始改版前，main 已合并两组性能 PR。本机先同步到 `ae342f6b6aba4c2c7955ff943858704f3c97c16e`，逐个核对全部 181 个文件的 Git blob SHA。保留即时搜索、120ms 页面进入、封面 WebP/缩略图、文章播放器默认收起与进度节点缓存。

本轮没有新增依赖或第二套客户端状态框架。全局外观和音频分别只有一个所有者；精选组件仅绑定当前页面，导航时清理监听。存储不可用时当前会话仍可使用外观选择；持久会话状态会在下一页渲染前继续应用。

新增检查覆盖偏好损坏/非法值、bootstrap 与运行时一致、阻止存储、当前会话恢复和 inline script key 转义；构建产物还验证每页唯一持久外观节点、首页音乐卡、初始唯一可见精选、选择点数量和现有唯一音频。最终本地检查、视口、发布与线上资源结果另记录在本次交付报告中。
