# 拾间 · 个人博客

零依赖静态网站，支持 Markdown 编辑、草稿、图片、随记、音乐、明暗主题、回收站和专注写作。

## GitHub Pages
1. 创建公开仓库，推荐 xuan511.github.io，也支持任意仓库名。
2. 把本压缩包内文件上传到仓库根目录（不要再包一层目录）。
3. Settings → Pages → Deploy from a branch → main → /(root) → Save。
4. 等待 Pages 完成部署后，通过仓库 Settings → Pages 显示的链接访问。

## 写作与更新
页面底部 → 写作台。内容先保存在浏览器，公开更新有两种方式：
- 发布上线 → 导出整站 ZIP → 上传替换仓库中的文件。
- 发布上线 → 连接已有 GitHub 仓库 → 同步公开内容。令牌仅在当前页面内存中使用，不写入本地存储或导出文件。

GitHub 在线同步需要 fine-grained Personal Access Token，仅选择博客仓库，Contents: Read and write。令牌过期后重新输入。请勿把令牌写入 content.js 或文章正文。

文章点击「设为公开」之后才会进入发布包。JSON 完整备份包含草稿、回收站和已引用的站内媒体；Markdown 导出包含正文图片。部署包不含草稿和回收站。写作数据主要存于 IndexedDB，会迁移旧版数据。不同站点子目录分别保存；多标签页版本冲突时会停止覆盖并提示备份。定期导出备份，浏览器清理数据会删除本地工作区与未同步媒体。

本地预览：在此目录执行 python -m http.server 8000，然后访问 http://localhost:8000。可直接打开 index.html 阅读；整站导出与 GitHub 同步请通过 HTTP/HTTPS 使用。

## 升级已有站点
先在旧站点导出 JSON 完整备份，再上传新版文件。每次升级请一并替换 index.html 与 assets/blog.js、assets/blog.css；保留自己的 content.js 与 assets/uploads。只同步 GitHub 公开内容不会升级程序文件。写作空间按网址与子目录隔离，更换域名或目录时请导出备份，再到新网址导入。

## 迁移服务器 / 域名
把整站文件放入 Nginx 等静态服务目录即可；不需要 Node、数据库或构建过程。自定义域名在 GitHub Pages 或你的服务器中配置。

音乐不自动播放；支持本地音频和可公开访问的音频直链。内置「纸上微光」为本项目合成的原创示例，可自由使用与删除。示例文章与随记均可在数据备份页一键移除。


## 开发与架构

这是可直接迁移的纯静态应用。开发时按职责拆分源码，构建后仅需部署 `dist/`；没有运行时服务端依赖。

| 模块 | 职责 |
| --- | --- |
| `storage.js` | IndexedDB、路径隔离、旧数据迁移、事务中的版本检查 |
| `workspace.js` | 串行保存、真实保存状态、标签页冲突、编辑恢复 |
| `core.js`、`content.js` | 内容校验、Markdown、只处理媒体字段的引用转换 |
| `app.js`、`studio.js`、`editor.js`、`studio-actions.js` | 页面、写作台、稳定编辑器与回收站 |
| `transfer.js`、`backup.js` | 公开内容导出、ZIP、带媒体的完整备份与导入 |
| `network.js`、`github.js`、`publish.js` | 超时、取消、只重试读取、原子提交与并发保护 |
| `player.js` | 持续播放、音量与进度记忆、慢请求取消 |
| `bootstrap.js` | 等待工作区载入后再渲染 |

```bash
python3 tools/build.py
node tools/verify-storage.mjs
node tools/verify.mjs
```

构建输出 `dist/index.html`、`dist/assets/blog.js`、`dist/assets/blog.css`；页面使用内容哈希查询参数更新缓存。公开内容单独保存在 `dist/content.js`。

验证覆盖旧数据迁移、不同目录隔离、存储失败、过期写入、Markdown 转义、草稿不进入公开包、完整备份还原媒体、GitHub 分支与内容冲突、超时后的提交结果核对，以及发布过程中继续编辑。

IndexedDB 不可用时会明确提示兼容保存模式；兼容模式请只开一个编辑页面。本地保存不是跨设备同步，清除浏览器数据前应先备份。GitHub 传输已用模拟响应验证，当前未在真实博客仓库上执行发布验收。
