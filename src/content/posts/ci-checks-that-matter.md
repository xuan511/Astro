---
title: 让 CI 检查真正重要的事
description: 从一次被格式检查拦住的文章发布说起，整理博客的检查边界：排版给建议，内容、行为和成品继续认真验证。
publishedAt: 2026-11-22
kind: tech
category: 工程实践
tags: [CI, GitHub Actions, 博客维护]
draft: false
featured: true
demo: false
tone: sage
---

一次发布只增加了一篇 Markdown。标题、日期、分类都有，正文也能正常解析，构建却停在了 `npm run format:check`。

这次博客更新之前的 Actions 记录里，`paths` 检查已经成功，`build` 在 Prettier 步骤失败，后面的部署因此跳过。失败信息表达的是“写法与格式工具的输出不同”，却被当成了“网站不能发布”。

问题可以落到一个具体判断上：这个检查失败，是否意味着访问者会遇到错误？

## 排版差异与发布错误，分别处理

对于文章，中文段落怎么换行、YAML 用哪一种引号，通常不改变最终含义。只要 Markdown 和元数据可以解析，就没有必要为了这些差异反复提交。

对于程序，缺失导入、类型不匹配、播放状态回退、生成页面引用了不存在的资源，都可能影响实际使用。这些问题仍应当阻止发布。

博客现在把检查分成两类：

| 检查内容 | 发现问题后的处理 |
| --- | --- |
| 代码与配置的 Prettier 排版 | 在独立任务中给出提示 |
| 文章的引号、段落与表格排版 | 交给作者，文章目录不参与 Prettier 检查 |
| 类型、内容字段、客户端依赖方向 | 阻止构建 |
| 行为测试、生产构建与资源引用 | 阻止发布 |
| 根路径、项目子路径与自定义域名适配 | 阻止发布 |

放宽的是格式工具的发布权限。文章缺少标题、日期无效，或者生成结果出现错误，仍然需要修复。

## 日常检查使用同一个入口

本地和 CI 都运行：

```bash
npm run verify
```

它依次执行 Astro 检查、客户端架构检查、行为测试、生产构建和成品检查。工作流引用这条命令，减少“本地加了检查，CI 忘记同步”的机会。

想额外检查代码排版时，可以运行：

```bash
npm run format:check
# 或把排版和日常验证一起执行
npm run verify:strict
```

`--check` 只检查，不写文件。真正需要整理某个代码文件时，再对那个文件执行 `prettier --write`。文章目录已经排除，所以这些命令也不会顺手重排文章。

Prettier 的 `--list-different` 只改变输出形式，仍然会在格式不一致时返回失败；把 `--check` 换成它，并不能解决发布被阻断的问题。[Prettier CLI 文档](https://prettier.io/docs/cli#--check)

## 可选提示有明确的作用范围

格式建议现在位于独立的 `format` 作业，Prettier 步骤使用 `continue-on-error: true`。它发现差异后，后续步骤读取 `steps.prettier.outcome`，把说明写进 Actions 摘要。

GitHub 区分步骤原始结果 `outcome` 和应用容错后的 `conclusion`。容错步骤失败时，前者仍是 `failure`，因此适合用来生成提示。[GitHub steps 上下文](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#steps-context)

正式部署只依赖 `build` 和 `paths`。这两个作业没有忽略错误，也没有用 `always()` 强行进入发布。依赖失败时停止部署，仍然是工作流的默认行为。[GitHub needs 语法](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idneeds)

## 发布完成，还要看实际页面

构建通过只能说明产物生成成功。确认上线时，还要核对提交、部署任务、实际网址，以及文章是否进入列表、搜索和 RSS。

源码已上传、构建成功、页面已经上线，是三个分别可以验证的状态。遇到错误时，沿着这三个状态定位，比看到一个红色图标就重新修改全文更有效。

这套边界也可以继续调整。每当添加一个新检查，先写清它防止什么问题、失败后该做什么；如果答不出来，就先把它作为建议，而不是发布条件。
