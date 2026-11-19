# 文章评论与点赞

Astro 在构建时生成文章。Django API 单独运行，SQLite 保存账号、登录令牌摘要、文章索引、评论和点赞。游客能阅读，注册或登录后可发表评论、点赞和取消点赞。每个账号对每篇文章最多一赞。讨论按 Astro 的文章 ID 关联，改标题不影响历史。更改文件名导致 ID 改变时，需要迁移关联数据。

## 本地运行

需要 Python 3.12 和项目要求的 Node.js。从仓库根目录运行，以下命令适用于 Bash 或 WSL。

```bash
npm ci
npm run build
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export DJANGO_DEBUG=1
python backend/manage.py migrate
python backend/manage.py sync_articles dist/search.json
python backend/manage.py runserver localhost:8000
```

在第二个终端运行 `npm run dev`，用 `http://localhost:4173` 打开任意已发布文章，下滑到「文章讨论」。开发模式默认访问 `http://localhost:8000/api/`。若端口或主机名不同，在后端设置 `FRONTEND_ORIGINS`，前端设置 `PUBLIC_COMMUNITY_API`。可用 `DJANGO_DEBUG=1 python backend/manage.py test community` 在独立的测试数据库中验证接口。

## GitHub Pages 与独立后端

1. 在可运行 Python 的服务器安装依赖，并给 SQLite 准备持久化目录。把 `DATABASE_PATH` 设成该目录下的绝对文件名，例如 `/var/lib/shijian/community.sqlite3`。运行服务的用户需有目录读写权限，定期备份数据库。
2. 保持 `DJANGO_DEBUG` 关闭。设置随机生成的 `DJANGO_SECRET_KEY`、API 主机名 `DJANGO_ALLOWED_HOSTS`（如 `api.example.com`）和前端来源 `FRONTEND_ORIGINS=https://xuan511.github.io`（来源只含协议与主机，不含 `/Astro/`）。密钥仅保存在后端。可用 `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` 在服务器生成。
3. 用上述生产环境变量运行 `python backend/manage.py migrate`，再将该版本构建产物中的 `dist/search.json` 交给 `sync_articles`。每次发布、撤下文章或更改文章 ID 后重新同步。撤下的讨论会隐藏，数据库记录会保留。发布系统应在索引同步成功后开放新文章的互动。
4. 在持久服务管理器中运行 `gunicorn --chdir backend community.wsgi:application --bind 127.0.0.1:8000`。由 HTTPS 反向代理把 `/api/` 转发给 Gunicorn。只对外暴露 HTTPS，限制请求体大小和注册、登录接口的请求频率。若只有一层可信代理、它会覆盖转发地址且外部无法直连 Gunicorn，可设 `TRUSTED_PROXY_COUNT=1`，使应用按客户端 IP 限流。
5. 在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 设置 `PUBLIC_COMMUNITY_API=https://api.example.com/api/`，替换为实际地址，重新运行 Pages 部署。该变量为空时，生产页面只显示静态文章。已启用的 API 暂时离线时，文章仍能读，讨论区会显示重试按钮。

登录使用有效期 12 小时、可在退出时撤销的 Bearer 令牌。前端将令牌保存在当前标签页的 sessionStorage，以便刷新或切换文章后继续使用。GitHub Pages 同一主机的其他项目共享浏览器来源，应只在该来源运行受信任的脚本。正式环境通过 HTTPS 传输密码和令牌。

## API

以下路径以 `/api/` 为前缀。正文使用 JSON，登录后的请求带 `Authorization: Bearer <token>`。文章 ID 的各路径段分别进行 URL 编码。

| 方法         | 路径                           | 作用                                                                       |
| ------------ | ------------------------------ | -------------------------------------------------------------------------- |
| POST         | `register/`、`login/`          | 提交 `username`、`password`，成功后返回用户名和令牌                        |
| POST         | `logout/`                      | 撤销当前令牌                                                               |
| GET          | `discussion/<文章 ID>/`        | 返回点赞数、个人点赞状态和最新 20 条评论。用返回的 `before` 查询更早的评论 |
| POST         | `articles/<文章 ID>/comments/` | 提交 `body`（1 至 2000 字符）                                              |
| PUT / DELETE | `articles/<文章 ID>/like/`     | 点赞或取消。重复请求保持相同结果                                           |
