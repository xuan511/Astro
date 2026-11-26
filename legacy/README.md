# 拾间旧版写作台

旧版写作台将编辑内容保存在当前浏览器。在「数据备份」中可以导出完整 JSON、Markdown 或整站 ZIP。完整 JSON 包含草稿、回收站和引用的媒体，请妥善保存。

迁移到 Astro 时，在项目根目录运行 `npm run import:backup -- 备份.json 暂存目录`，检查暂存内容后再提交。当前博客由 GitHub Actions 从 main 分支构建并发布。

## 本地构建

运行 `python3 tools/build.py` 重新生成旧版静态页面。开发源码位于 `src/`，生成目录为 `dist/`。
 
| 模块 | 职责 |
| --- | --- |
| `storage.js` | IndexedDB、路径隔离、旧数据迁移、事务中的版本检查 |
| `workspace.js` | 串行保存、真实保存状态、标签页冲突、编辑恢复 |
| `core.js`、`content.js` | 内容校验、Markdown、只处理媒体字段的引用转换 |
| `app.js`、`studio.js`、`editor.js`、`studio-actions.js` | 页面、写作台、稳定编辑器与回收站 |
| `transfer.js`、`backup.js` | 公开内容导出、ZIP、带媒体的完整备份与导入 |
| `network.js` | 请求超时、取消与读取重试 |
| `player.js` | 持续播放、音量与进度记忆、慢请求取消 |
| `bootstrap.js` | 等待工作区载入后再渲染 |

```bash
python3 tools/build.py
node tools/verify-storage.mjs
node tools/verify.mjs
```

构建输出 `dist/index.html`、`dist/assets/blog.js`、`dist/assets/blog.css`；页面使用内容哈希查询参数更新缓存。公开内容单独保存在 `dist/content.js`。

