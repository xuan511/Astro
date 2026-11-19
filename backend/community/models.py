from django.conf import settings
from django.db import models


class Article(models.Model):
    key = models.CharField(max_length=512, primary_key=True)
    published = models.BooleanField(default=True)


class Comment(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.CharField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["article", "-id"])]


class Like(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["article", "user"], name="one_article_like")]
