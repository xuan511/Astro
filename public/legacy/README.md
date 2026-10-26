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
