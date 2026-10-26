# 构建、发布与迁移

## GitHub Pages：推荐使用 Actions

已指定公开源码仓库 [xuan511/Astro](https://github.com/xuan511/Astro)，预计 Pages 地址为 `https://xuan511.github.io/Astro/`。代码上传不代表 Pages 部署成功；请以 [Actions](https://github.com/xuan511/Astro/actions) 中 deploy 任务的成功结果及返回网址为准。项目仓库的 `/Astro/` 子路径由 Actions 自动推导，无需逐个修改页面资源。

### 首次发布

1. 打开已指定的 [xuan511/Astro 仓库](https://github.com/xuan511/Astro)，确认使用 `main` 分支。若已上传源码，继续维护现有历史，不重复初始化或覆盖远程提交。
2. 解压源码，VS Code 打开包含 `package.json` 的目录。确认 `.github/workflows/deploy.yml` 一并保留。ZIP 本身不能作为站点源码上传。
3. 安装 Node 24，执行：

   ```bash
   npm ci
   npm run verify
   npm run verify:pages -- --repo=xuan511/Astro
   ```

   `verify` 执行类型、格式、逻辑、构建和成品检查。`verify:pages` 独立构建用户根路径、项目子路径 `/Astro/` 与自定义域名（测试源地址 `https://journal.example.com`），每份产物均运行完整检查。临时目录位于已忽略的 `.astro/pages-*` 并自动清理，避免 Windows 跨盘移动失败；不修改现有 dist，也不访问或修改 GitHub 仓库。测试域名不会写入正式配置或发布。以后更换仓库时，把参数改为新的 `用户名/仓库名`。

4. 仅在本地尚无 Git 历史、远程仓库仍为空时，在解压后的项目目录执行首次提交：

   ```bash
   git init -b main
   git add .
   git commit -m "Publish Shijian blog"
   git remote add origin https://github.com/xuan511/Astro.git
   git push -u origin main
   ```

   使用 GitHub 自己的登录或凭据管理器完成认证，不要把令牌写入源码或远程地址。已有本地仓库时沿用原有 Git 配置，不重复初始化；远程已有源码时先克隆或同步已有提交，再修改、提交与推送，不使用强制推送覆盖历史。

5. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
6. 打开 **Actions → Check, build and deploy Pages → Run workflow**，选择 `main`。如果首次推送的运行因 Pages 尚未启用而失败，设置完成后重新运行即可。
7. 等待 build、deploy 两个任务均成功，从 deploy 任务或 Pages 设置中取得真实网址。后续推送到 `main` 会自动重新部署。

工作流先安装、类型检查、格式检查、运行测试、构建、检查成品，再上传并部署。Actions 汇总页显示目标地址、页面数、资源引用、RSS 和体积估算。构建过程使用只读源码权限；只有部署任务申请 Pages 与身份令牌权限。不需要自建部署 Token。

PR 只检查；手动运行其他分支也不会发布。只有 `main` 可上传生产产物并部署。PR 检查可以被后续提交替代，已经开始的正式部署会执行完毕。若主分支不叫 `main`，同时修改工作流的 `push.branches` 和两个分支判断。

## 上线后验收

1. 从发布网址进入首页，确认导航、头像、封面和样式正常。手机检查菜单、横向溢出和深色模式。
2. **直接在新标签打开**文章完整地址，再刷新，确认静态页面可独立访问。
3. 搜索 Linux 等实际存在的内容，切换范围，再输入不存在的关键词，确认结果与空状态。
4. 在音乐页手动播放，跳转到文章、返回首页，确认播放不中断；刷新后应停止自动播放，再手动播放可恢复进度。
5. 访问 `/Astro/rss.xml`、`/Astro/sitemap-index.xml` 和一个不存在的站内地址，确认订阅、Sitemap 和 404 正常。其他项目仓库应将 `/Astro` 替换为实际 `/仓库名`；用户根站点不加这一前缀。
6. 添加一份草稿，确认没有文章页面、搜索项和 RSS 项；然后改成正式发布并重新推送，检查新文章出现。
7. 手动运行 **Lighthouse audit**，下载报告，再按实际结果优化。没有文章时审计首页与音乐页，有文章时额外选择一篇公开文章。

## 常见部署问题

| 现象                             | 处理方法                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Actions 中没有工作流             | 检查仓库根目录是否有 `.github/workflows/deploy.yml`，不要把整个项目再套一层目录或只上传 ZIP。                 |
| configure-pages 返回未找到 Pages | 在 Settings → Pages 中将 Source 设为 GitHub Actions，然后重新运行工作流。                                     |
| deploy 被跳过                    | 检查当前是否为 PR 或非 `main` 分支；这是正式发布分支限制。                                                    |
| 页面有内容但 CSS、头像或音乐 404 | 检查仓库变量 `BASE_PATH`。默认无需填写；普通仓库自动使用 `/仓库名/`，用户仓库使用 `/`。注意音乐文件名大小写。 |
| 构建检查失败                     | 打开 Actions 对应失败步骤，先修复明确指出的类型、格式、缺失资源或链接，再推送。不要删除检查步骤绕过。         |
| 发布成功但看到旧页面             | 确认访问 deploy 输出的新网址，等待 Pages 更新后刷新；不要依赖旧标签中的缓存。                                 |
| Git 推送被拒绝                   | 确认远程地址和登录账号；仓库如果已初始化文件，先同步现有提交并解决冲突，不使用强制推送。                      |

源码中的 `draft: true` 只阻止生成网页。**公开仓库仍可查看草稿原文**；私密记录应留在仓库之外。当前示例文章、随记和合成音频均已标记，可删除或替换，不是必须保留的构建依赖。

## 域名与子路径

`scripts/deployment.mjs` 集中决定站点源地址和根路径：

| 场景                    | `site`                                     | `base`                        |
| ----------------------- | ------------------------------------------ | ----------------------------- |
| 本地或手动构建          | `config/deployment.json`，可由环境变量覆盖 | 同左                          |
| `用户名.github.io` 仓库 | 自动推导为用户 Pages 源地址                | `/`                           |
| 普通项目仓库            | 自动推导为用户 Pages 源地址                | `/仓库名/`                    |
| 自定义域名              | 仓库变量 `SITE_URL`                        | 仓库变量 `BASE_PATH` 设为 `/` |

当前 `config/deployment.json` 保留本地根路径 `/` 便于开发和预览。部署到 `xuan511/Astro` 时，Actions 根据 `GITHUB_REPOSITORY` 自动使用源地址 `https://xuan511.github.io` 和子路径 `/Astro/`；无需为了上传代码修改本地默认路径，也无需设置 `BASE_PATH` 仓库变量。若以后改用 `xuan511.github.io` 用户仓库，则自动变为 `/`；迁移自定义域名时再显式配置下面的覆盖值。

`SITE_URL` 只填写协议和域名，不携带目录；目录放在 `BASE_PATH`。所有站内链接、公共资源、搜索索引、歌单、RSS 与 Sitemap 都通过同一套路径规则生成。

`BASE_PATH` 会统一首尾及重复斜杠；`/`、`//`、`///` 都表示根路径，`//blog///` 会规范化为 `/blog/`。路径穿越和无效编码仍会被拒绝。

自定义域名还需要按 GitHub Pages 的说明配置 DNS 与域名设置。需要 CNAME 时，在 `public/CNAME` 放入自己的域名，不要提交示例域名。本项目不预设一个不存在的 CNAME。

手动构建前可复制 `.env.example` 为 `.env`，再填写自己的公开部署信息。部署配置读取器会在 Astro 配置阶段显式读取该文件，Shell / Actions 环境变量优先于 `.env`。`.env` 不进入 Git。站点域名不是密钥，仓库 Actions 使用 Settings → Secrets and variables → Actions → Variables 中的普通变量。

## 本地与服务器

```bash
npm ci
npm run dev
npm run check
npm test
npm run build
npm run test:built
npm run preview
```

开发与预览默认使用端口 4173，请分别运行。Node 要求 >=22.23.4，推荐 Node 24。生产环境把 `dist/` 中的文件交给 Nginx、对象存储静态托管或其他静态服务器即可；服务器不需要运行 Node。给 404 配置 `dist/404.html`，并保留所有目录的 `index.html`。

`astro.config.mjs` 为 Vite 显式指定项目内 `tsconfig.json`。解压目录的上一级即使有另一份配置，也不会干扰本站的内容同步与构建；不要通过修改上级文件或 `node_modules` 解决此类问题。Windows 上若出现 `EXDEV`，确认使用当前的 `verify:pages`，不要将 Astro 的临时输出指定到另一个磁盘。

Astro 的 `_astro/` 资源文件带内容哈希，适合长缓存；HTML、RSS、搜索索引需要重新验证，避免长期缓存旧文章。GitHub Pages 的响应头由平台控制，网站本身不伪造可定制响应头的能力。自己的服务器可设置：哈希资源长期缓存、HTML 使用重新验证。

## Lighthouse

GitHub Actions 中手动运行 **Lighthouse audit**。它会构建根路径的审计版本，对首页、一篇实际发布的文章（如果有）和音乐页各进行三次手机模拟审计，报告保存在运行附件中。删除示例不会破坏审计。警告阈值是目标，不是已经取得的分数。审计构建使用 `.invalid` 测试源地址，不会部署这个版本。

本机装有 Chrome/Chromium 后，可在正常 HTTP 预览上运行：

```bash
npx --yes lighthouse@13.5.0 http://localhost:4173/ --output=html --output-path=./reports/lighthouse.html
```

2026-10-27 已在 Windows 的本机 Chrome 上用 Lighthouse 13.5.0 对生产预览的首页、技术文章和音乐页执行单次手机模拟审计（412×823、模拟节流）。结果见 [阶段验收](ACCEPTANCE.md)。这是本地实验结果，尚未在真实 GitHub Pages 域名测试，也不是多次运行的中位数。构建体积与链接检查不能替代这些指标，实验分数也不代表所有设备的体验。

参考：[Astro 官方 GitHub Pages 部署说明](https://docs.astro.build/en/guides/deploy/github/)、[Astro 客户端导航与状态保持](https://docs.astro.build/en/guides/view-transitions/)。
