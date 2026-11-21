---
title: 一篇 Markdown 如何变成完整的博客页面
description: 从文章文件、元数据校验到分类、搜索和 RSS，沿着本站的数据流走一次发布过程。
publishedAt: 2026-11-22
kind: tech
category: 工程实践
tags: [Markdown, Astro, 内容管理]
draft: false
featured: true
demo: false
tone: lavender
---

在文件夹里保存一篇 Markdown，只完成了文章发布的第一步。它还需要出现在文章列表、分类、标签、归档和搜索里，订阅读者也应当能在 RSS 中看到它。

本站没有让这些入口各自维护一份文章清单。它们从同一个内容集合出发，再使用同一套公开性与排序规则。

## 文件提供正文，元数据说明它是什么

文章位于 `src/content/posts/`。文件名决定稳定的文章 ID，开头的 YAML 提供标题、摘要和栏目等字段：

```yaml
---
title: 一个可以复现的小问题
description: 记录现象、尝试与验证结果。
publishedAt: 2026-11-22
kind: tech
category: 代码
tags: [调试, 学习记录]
draft: true
featured: false
demo: false
---
```

`kind` 决定技术或生活栏目，`category` 和 `tags` 用于分类，`featured` 决定是否优先进入首页精选。元数据的作用是描述文章，不要求作者记住每一个列表页面的实现方式。

新文件可通过项目命令创建：

```bash
npm run new:post -- "一个可以复现的小问题" --kind=tech --slug=a-reproducible-question
```

生成器默认创建草稿。准备公开时，把 `draft` 改成 `false`，检查并构建，再提交到仓库。

## Schema 检查字段，查询规则决定公开范围

本站的 Content Collections schema 校验标题和摘要长度、栏目类型、日期，以及更新时间不能早于发布时间等条件。Astro 用这些约束验证数据，并提供对应的 TypeScript 类型。[Astro 集合 schema](https://docs.astro.build/en/guides/content-collections/#defining-the-collection-schema)

但在 schema 中声明 `draft`，不会自动隐藏文章。公开范围由应用查询决定：本站的 `selectPublishedPosts` 排除草稿，并按发布时间倒序排列；日期相同，再按 ID 排序，以得到稳定顺序。[Astro 集合查询过滤](https://docs.astro.build/en/guides/content-collections/#filtering-collection-queries)

这里有两个容易混淆的边界。第一，本站的 `publishedAt` 用于日期显示和排序，没有实现定时发布，填写未来日期也不会自动保密。第二，`draft: true` 只控制生成网页，公开仓库里的源文件仍能被查看。

需要保密的记录，应保存在公开仓库之外。

## 所有入口使用同一个公开列表

内容流可以写成一条线：

```text
Markdown / MDX 文件
        ↓
内容集合与字段校验
        ↓
统一的草稿过滤、栏目筛选和排序
        ↓
文章页、列表、分类、标签、归档、RSS、搜索
```

这样修改草稿策略时，不需要去七个页面分别寻找过滤条件。分类和标签只对公开文章分组，搜索索引与 RSS 也使用同一份公开集合。

文章正文在构建时转成 HTML。代码高亮、目录和数学排版可以提前完成，浏览器只为目录跟踪、阅读设置、搜索和音乐等交互执行必要脚本。

如果只需要写文章，普通 Markdown 已经足够。MDX 可以导入组件，它同时也是受信任的仓库代码；是否使用它，应由内容需要决定。

## 验证最终产物里的对应关系

内容校验通过后，还需要检查生成结果。本站的成品检查会核对文章数和搜索中的文章数、RSS 项、Sitemap 与可索引页面，以及本地资源引用是否存在。

这些检查关注“同一篇文章有没有在不同入口里失踪”，而不是规定正文必须怎样换行。

发布一篇新文章时，可以沿着下面的顺序查看：

1. 直接打开文章地址，确认正文、目录和代码显示正常。
2. 在对应栏目和归档中找到它。
3. 用标题中的独特词搜索，检查链接是否指向同一页。
4. 查看 RSS 是否包含这一项；草稿则应同时缺席这些公开入口。

## 让下一次修改更小

写作时只编辑文章，增加分类时只填写元数据，调整列表规则时只修改共享查询。职责越清楚，越容易判断一次变更会影响哪里。

一个静态博客是否便于长期维护，可以从这里开始观察：发布下一篇文章，需要重复多少手工步骤，又有多少结果可以直接验证。
