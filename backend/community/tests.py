import json
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from django.utils import timezone
from knox.models import AuthToken
from rest_framework.test import APITestCase

from .models import Article, Comment, Like


class CommunityTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.key = "技术/first"
        Article.objects.create(key=self.key)
        self.detail = f"/api/discussion/{self.key}/"
        self.write = f"/api/articles/{self.key}/"
        self.account = {"username": "reader", "password": "book-Shelf!49261"}

    def register(self):
        response = self.client.post("/api/register/", self.account, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        token = response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return token

    def test_full_account_lifecycle_and_persistence(self):
        self.assertIsNone(self.client.get(self.detail).data["username"])
        self.assertEqual(self.client.post(self.write + "comments/", {"body": "hi"}, format="json").status_code, 401)
        self.assertEqual(self.client.put(self.write + "like/").status_code, 401)
        token = self.register()
        self.assertTrue(get_user_model().objects.get().check_password(self.account["password"]))
        self.assertNotEqual(AuthToken.objects.get().digest, token)
        response = self.client.post(self.write + "comments/", {"body": "  <b>你好</b>  ", "author": "someone"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual((response.data["author"], response.data["body"]), ("reader", "<b>你好</b>"))
        for _ in range(2):
            self.assertEqual(self.client.put(self.write + "like/").data, {"likes": 1, "liked": True})
        self.assertEqual(self.client.post("/api/logout/").status_code, 204)
        self.assertEqual(self.client.get(self.detail).status_code, 401)
        self.client.credentials()
        public = self.client.get(self.detail).data
        self.assertEqual((public["likes"], public["liked"], len(public["comments"])), (1, False, 1))
        response = self.client.post("/api/login/", self.account, format="json")
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["token"])
        self.assertTrue(self.client.get(self.detail).data["liked"])
        for _ in range(2):
            self.assertEqual(self.client.delete(self.write + "like/").data["likes"], 0)

    def test_validation_expiry_and_user_isolation(self):
        self.assertEqual(self.client.post("/api/register/", {**self.account, "password": "123"}, format="json").status_code, 400)
        self.register()
        self.assertEqual(self.client.post("/api/register/", self.account, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/login/", {**self.account, "password": "wrong"}, format="json").status_code, 400)
        for body in ["  ", "x" * 2001, 42]:
            self.assertEqual(self.client.post(self.write + "comments/", {"body": body}, format="json").status_code, 400)
        self.client.put(self.write + "like/")
        self.account["username"] = "another"
        self.register()
        self.assertFalse(self.client.get(self.detail).data["liked"])
        self.assertEqual(self.client.delete(self.write + "like/").data["likes"], 1)
        AuthToken.objects.update(expiry=timezone.now())
        self.assertEqual(self.client.put(self.write + "like/").status_code, 401)

    def test_pagination_article_boundaries(self):
        self.register()
        user = get_user_model().objects.get()
        other = Article.objects.create(key="another")
        Comment.objects.create(article=other, author=user, body="other article")
        Comment.objects.bulk_create([Comment(article_id=self.key, author=user, body=str(i)) for i in range(21)])
        page = self.client.get(self.detail).data
        self.assertEqual([c["body"] for c in page["comments"]], list(map(str, range(20, 0, -1))))
        last = self.client.get(self.detail, {"before": page["before"]}).data
        self.assertEqual([c["body"] for c in last["comments"]], ["0"])
        self.assertIsNone(last["before"])
        self.assertEqual(self.client.get(self.detail, {"before": "-1"}).status_code, 400)
        Article.objects.filter(pk=self.key).update(published=False)
        self.assertEqual(self.client.get(self.detail).status_code, 404)
        self.assertEqual(self.client.put(self.write + "like/").status_code, 404)
        self.assertEqual(self.client.get("/api/discussion/unknown/").status_code, 404)

    def test_sync_preserves_history_and_rejects_invalid_index(self):
        user = get_user_model().objects.create_user("old")
        Like.objects.create(article_id=self.key, user=user)
        with TemporaryDirectory() as folder:
            path = Path(folder) / "search.json"
            path.write_text(json.dumps([{"id": "new", "kind": "life"}, {"id": "skip", "kind": "project"}]))
            call_command("sync_articles", path)
            self.assertEqual(list(Article.objects.filter(published=True).values_list("key", flat=True)), ["new"])
            path.write_text("null")
            with self.assertRaises(CommandError):
                call_command("sync_articles", path)
            self.assertTrue(Article.objects.get(pk="new").published)
            path.write_text(json.dumps([{"id": self.key, "kind": "tech"}]))
            call_command("sync_articles", path)
            self.assertEqual(self.client.get(self.detail).data["likes"], 1)

    @override_settings(CORS_ALLOWED_ORIGINS=["https://xuan511.github.io"])
    def test_cross_origin_preflight(self):
        headers = {"HTTP_ACCESS_CONTROL_REQUEST_METHOD": "PUT", "HTTP_ACCESS_CONTROL_REQUEST_HEADERS": "authorization"}
        resp = self.client.options(self.write + "like/", HTTP_ORIGIN="https://xuan511.github.io", **headers)
        self.assertEqual(resp["Access-Control-Allow-Origin"], "https://xuan511.github.io")
        self.assertIn("authorization", resp["Access-Control-Allow-Headers"].lower())
        resp = self.client.options(self.write + "like/", HTTP_ORIGIN="https://other.example", **headers)
        self.assertNotIn("Access-Control-Allow-Origin", resp)
