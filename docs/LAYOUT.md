# 布局与外观

2026-11-27。本轮基于 `xuan511/Astro` 的 `61b91ec9a41b86db2a0dceeacba1260be103477a`，保留新增的日志栏目、资源下载、全部文章与原始资源。音乐台仍只有用户上传的 5 首完整歌曲。

## 默认结构

宽屏采用「个人资料与折叠导航 / 主内容 / 分类标签与最近更新」三列。文章页右侧切换为文章目录，正文默认保持 44rem 阅读宽度，原有宽屏阅读按钮仍可扩展至 51rem。顶栏保留一个默认关闭的目录，侧栏阅读、音乐、小站分组也默认折叠。

- `≥1280px`：双侧栏，中间文章网格按可用宽度自动分列；1600px 实测 3 列、1280px 实测 2 列。
- `864–1279px`：双侧栏配置退为一个侧栏，默认保留左侧；`sidebar.tablet` 可改为 `right`。
- `<864px`：隐藏辅助栏，保留顶栏目录、搜索及正文；768px 可有两列卡片，390px / 320px 为一列。
- 文章右栏不可见时，正文内的折叠目录出现。两种目录共用 `TocLinks`，目标与顺序由成品检查比对。

侧栏普通卡片跟随文档滚动，文章目录单独吸附。窄屏不会同时塞入侧栏和正文。

## 修改默认配置

`src/config/presentation.ts` 是构建期配置，不会被客户端模块导入。配置修改后重新构建和发布。

| 配置                    | 可选值或用途                                                              |
| ----------------------- | ------------------------------------------------------------------------- |
| `sidebar.position`      | `left` / `right` / `both` / `none`，默认 `both`                           |
| `sidebar.tablet`        | 双栏在平板上保留 `left` 或 `right`                                        |
| `posts.defaultMode`     | `list` / `grid` / `masonry`，默认 `grid`                                  |
| `posts.columnWidth`     | 卡片最小宽度，默认 280px；实际列数根据中栏宽度计算                        |
| `posts.gap`             | 卡片间距，默认 20px                                                       |
| `wallpaper.mode`        | `banner` 横幅 / `fullscreen` 全屏 / `transparent` 全屏透明 / `solid` 纯色 |
| `wallpaper.image`       | 默认本地背景 `images/coastal-summer.webp`                                 |
| `wallpaper.scene`       | `coast` / `mist` / `paper`，也可由面板切换                                |
| `hue`                   | 0–359 色相，默认 165；亮暗模式分别使用可读的明度                          |
| `font` / `fonts`        | 默认字体 id 与可选择的字体目录                                            |
| `navbar`                | Logo、标题、副标题、分组链接；默认引用站点配置，顶栏和侧栏导航共用        |
| `footer.replaceDefault` | `true` 时用自定义 HTML 替换默认页脚内容；小伙伴恢复按钮保留               |

三态主题的站点默认值在 `src/config/site.ts` 的 `defaultTheme`，默认 `system`。顶栏月亮 / 太阳按钮继续快捷切换亮暗，面板可以显式选「亮色 / 暗色 / 跟随系统」。

面板位于顶栏调色板按钮，提供即时切换、色相滑块、字体预览和「恢复站点默认」。偏好沿用部署路径隔离的 `appearance-v1` 键，原有 `scene` / `solid` 自动迁入；亮暗主题继续使用独立的 `theme-v3`。旧标签页在部署后需完整刷新以载入新的持久组件。

## 字体与页脚

内置 6 组设备字库：系统黑体、宋体、圆体、人文无衬线、经典衬线、等宽手记。它们不发起第三方字体请求，缺字库时按声明顺序回退；并非每台设备都安装同样的字体。选择同步影响页面与文章正文，代码和数字谱保持等宽。

添加自托管字体：把有使用权限的 WOFF2 文件放进 `public/fonts/`，在 `fonts` 数组加入例如：

```ts
{ id: 'my-font', label: '我的字体', family: 'MyBlogFont', source: 'fonts/my-font.woff2' }
```

`family` 使用该字体的单一 CSS 名称，`source` 相对 `public/`，不要手写 `/Astro/`。配置生成 `@font-face` 并使用 `font-display: swap`，浏览器只会请求被选中的字体。把 `font` 改成该 id 可设为默认。

编辑 `src/config/footer.html` 可插入任意仓库维护者信任的 HTML。`footer.replaceDefault: false` 追加在默认页脚后；`true` 替换默认内容。这里是构建模板，访客偏好不会提供 HTML、资源 URL 或任意 CSS。需带部署前缀的站内链接可继续在 `Footer.astro` 使用 `withBase` 生成。

## 职责与回退

- `Base.astro` 是唯一页面列容器。`Sidebar.astro` 读取统一的已发布文章查询，生成真实分类计数与标签；没有额外请求。
- `PostIndex` 和首页共用 `PostFeed`。普通网格用 CSS Grid；列表为单列。瀑布流用纯函数计算最短列位置，ResizeObserver 监听宽度与卡片高度，字体就绪后重排；原始 DOM 顺序保持不变。
- `post-feed.ts` 在换页时取消帧并释放观察器。禁用脚本时保留普通网格、文章链接、原生折叠导航与清晰正文。
- `layout-preferences.ts` 对存储作枚举、字体 id 与色相范围校验，并生成同规则的首屏启动脚本。`appearance.ts` 保留会话状态；禁用存储后站内换页仍沿用选择；另一个标签页的有效更改可同步。
- `theme.ts` 处理三态主题与系统事件；外观控制器不另建一套亮暗状态。
- 页面仍使用 Astro ClientRouter。播放器、外观对话框和角色保留持久节点，音频仍只有一个且不自动播放。
- 旧首页的轮播与独立音乐卡组件、轮播入口和旧背景解析器已移除；右下角播放器和音乐页完整保留。

## 参考与归属

参考 [Firefly 布局说明](https://firefly.cuteleaf.cn/posts/guide/firefly-layout-system/) 和固定源码快照 [`5de25c40`](https://github.com/CuteLeaf/Firefly/tree/5de25c40cf3778451107dd2508e869536dac27ad)：[侧栏配置](https://github.com/CuteLeaf/Firefly/blob/5de25c40cf3778451107dd2508e869536dac27ad/src/config/sidebarConfig.ts)、[响应式样式](https://github.com/CuteLeaf/Firefly/blob/5de25c40cf3778451107dd2508e869536dac27ad/src/styles/layout-base.css)、[文章布局](https://github.com/CuteLeaf/Firefly/blob/5de25c40cf3778451107dd2508e869536dac27ad/src/components/layout/PostPage.astro)、[字体配置](https://github.com/CuteLeaf/Firefly/blob/5de25c40cf3778451107dd2508e869536dac27ad/src/config/fontConfig.ts)。

Firefly 当前源码允许双侧栏和网格独立配置；旧侧栏文档「both 强制单列」的说明已经过时。本项目自行实现相应布局与状态逻辑，没有整体搬入 Firefly，也没有引入其 Swup、Svelte、Tailwind 或字体供应商。移动断点按本站的内容宽度调整为 864px。保留已有海边背景与角色资源，没有搬用 Firefly 的游戏插画或示例文章。

Firefly 代码采用 [MIT](https://github.com/CuteLeaf/Firefly/blob/5de25c40cf3778451107dd2508e869536dac27ad/LICENSE)，原项目版权归属为 Copyright (c) 2024 saicaca、Copyright (c) 2025 CuteLeaf。页面与本文注明布局设计参考；本站既有 XHBlogs 来源说明继续保留。

## 本地验收

本轮自动测试共 94 项通过。Astro / TypeScript 检查 76 个文件，0 errors、0 warnings，保留现有搜索 IME 兼容代码的 `keyCode` 弃用提示 1 项。客户端边界检查 19 个入口、29 个模块，无服务端依赖泄漏。

静态成品为 65 页、12 篇已发布文章、14 条搜索记录、12 条 RSS 项；检查 5946 个本地链接 / 资源和 62 条 Sitemap URL。根路径、`/Astro/` 与自定义域名预检均通过。最终 JS gzip 23,234 B、CSS gzip 23,054 B，在既有预算内。

浏览器覆盖 1600 / 1280 / 1024 / 768 / 390 / 320px，未见页面水平溢出。宽屏验证四种侧栏、三种文章模式、三态主题、字体、色相末端 359°、背景切换与恢复默认；12 张瀑布流卡片无重叠，退出后清除绝对定位。320px 对话框内部无横向溢出；琴谱保留 21 行、16px 等宽显示，正文能跟随字体选择。部署与外网核对结果另见发布回执。
