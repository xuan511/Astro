"""Exercise a real Astro build and Django via two HTTP origins on loopback.

Build first with PUBLIC_COMMUNITY_API=http://127.0.0.1:8000/api/ BASE_PATH=/.
Requires the Playwright Python package and a Chromium installation.
"""
import json
import os
import subprocess
import sys
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from wsgiref.simple_server import make_server

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist"
sys.path.insert(0, str(ROOT / "backend"))


@contextmanager
def serving(server):
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def exercise():
    from community.wsgi import application

    rows = json.loads((DIST / "search.json").read_text())
    articles = [row for row in rows if row["kind"] in ("tech", "life")]
    page_url = "http://localhost:4173" + articles[0]["url"]
    api = make_server("127.0.0.1", 8000, application)
    web = ThreadingHTTPServer(("127.0.0.1", 4173), partial(SimpleHTTPRequestHandler, directory=DIST))
    with serving(api), serving(web), sync_playwright() as driver:
        browser = driver.chromium.launch(executable_path=os.getenv("CHROMIUM_PATH"))
        page = browser.new_page()
        page.goto(page_url)
        panel = page.locator("blog-discussion")
        field = panel.get_by_label
        button = panel.get_by_role
        expect(panel.get_by_text("还没有评论。")).to_be_visible()
        button("button", name="点赞 · 0").click()
        button("button", name="注册新账号").click()
        field("用户名").fill("browser-reader")
        field("密码").fill("test-pass-8429!")
        button("button", name="创建账号").click()
        field("写评论").fill("跨域测试 <b>纯文本</b>")
        button("button", name="发表评论").click()
        expect(panel.get_by_role("listitem")).to_contain_text("<b>纯文本</b>")
        button("button", name="点赞 · 0").click()
        expect(button("button", name="已赞 · 1")).to_have_attribute("aria-pressed", "true")
        page.reload()
        expect(field("写评论")).to_be_visible()
        button("button", name="已赞 · 1").click()
        expect(button("button", name="点赞 · 0")).to_be_visible()
        button("button", name="退出登录").click()
        expect(field("写评论")).to_be_hidden()
        expect(panel.get_by_role("listitem")).to_be_visible()
        button("button", name="点赞 · 0").click()
        field("用户名").fill("browser-reader")
        field("密码").fill("test-pass-8429!")
        button("button", name="登录", exact=True).click()
        expect(field("写评论")).to_be_visible()

        page.route("**/api/**", lambda route: route.abort())
        page.reload()
        expect(page.locator("#article-content")).to_be_visible()
        expect(button("button", name="重新加载讨论")).to_be_visible()
        page.unroute("**/api/**")
        button("button", name="重新加载讨论").click()
        expect(panel.get_by_role("listitem")).to_be_visible()
        browser.close()


if __name__ == "__main__":
    with TemporaryDirectory() as directory:
        os.environ.update(DATABASE_PATH=str(Path(directory) / "test.sqlite3"), DJANGO_DEBUG="1",
                          FRONTEND_ORIGINS="http://localhost:4173")
        manage = [sys.executable, str(ROOT / "backend" / "manage.py")]
        subprocess.run([*manage, "migrate", "--noinput"], check=True)
        subprocess.run([*manage, "sync_articles", str(DIST / "search.json")], check=True)
        exercise()
