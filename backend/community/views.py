from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.forms import UserCreationForm
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from knox.models import AuthToken
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Article, Comment, Like


@method_decorator(never_cache, name="dispatch")
class Account(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "account"
    register = False

    def post(self, request):
        if not isinstance(request.data, dict):
            raise ValidationError("请输入用户名和密码。")
        username = request.data.get("username")
        password = request.data.get("password")
        if not isinstance(username, str) or not isinstance(password, str):
            raise ValidationError("请输入用户名和密码。")
        if not 0 < len(username) <= 150 or not 0 < len(password) <= 256:
            raise ValidationError("用户名或密码长度不正确。")
        if self.register:
            form = UserCreationForm(data={"username": username, "password1": password, "password2": password})
            if not form.is_valid():
                raise ValidationError(next(iter(form.errors.values()))[0])
            try:
                with transaction.atomic():
                    user = form.save()
                    _, token = AuthToken.objects.create(user=user)
            except IntegrityError:
                raise ValidationError("该用户名已被使用。")
        else:
            user = authenticate(request=request, username=get_user_model().normalize_username(username.strip()), password=password)
            if user is None:
                return Response({"detail": "用户名或密码不正确。"}, status=400)
            user.auth_token_set.filter(expiry__lte=timezone.now()).delete()
            _, token = AuthToken.objects.create(user=user)
        return Response({"username": user.username, "token": token}, status=201 if self.register else 200)


class CommentFields(serializers.Serializer):
    body = serializers.CharField(max_length=2000, allow_blank=False, trim_whitespace=True)

    def validate_body(self, value):
        if not isinstance(self.initial_data.get("body"), str):
            raise serializers.ValidationError("评论须为文本。")
        return value


def comment_data(comment):
    return {"id": comment.pk, "author": comment.author.username,
            "body": comment.body, "created": comment.created_at.isoformat()}


def published_article(key):
    return get_object_or_404(Article, key=key, published=True)


@method_decorator(never_cache, name="dispatch")
class Discussion(APIView):
    permission_classes = [AllowAny]

    def get(self, request, key):
        article = published_article(key)
        comments = article.comments.select_related("author").order_by("-id")
        cursor = request.query_params.get("before")
        if cursor is not None:
            if not cursor.isascii() or not cursor.isdigit() or len(cursor) > 19 or int(cursor) > 2**63 - 1:
                raise ValidationError("无效的分页位置。")
            comments = comments.filter(id__lt=int(cursor))
        page = list(comments[:21])
        user = request.user
        return Response({
            "username": user.username if user.is_authenticated else None,
            "likes": article.likes.count(),
            "liked": user.is_authenticated and article.likes.filter(user=user).exists(),
            "comments": [comment_data(item) for item in page[:20]],
            "before": page[19].pk if len(page) > 20 else None,
        })


class AddComment(APIView):
    throttle_scope = "comment"

    def post(self, request, key):
        article = published_article(key)
        fields = CommentFields(data=request.data)
        fields.is_valid(raise_exception=True)
        comment = Comment.objects.create(article=article, author=request.user, **fields.validated_data)
        return Response(comment_data(comment), status=201)


class ArticleLike(APIView):
    throttle_scope = "like"

    def put(self, request, key):
        return self.set_like(request, key, True)

    def delete(self, request, key):
        return self.set_like(request, key, False)

    @staticmethod
    @transaction.atomic
    def set_like(request, key, liked):
        article = published_article(key)
        if liked:
            Like.objects.get_or_create(article=article, user=request.user)
        else:
            Like.objects.filter(article=article, user=request.user).delete()
        return Response({"liked": liked, "likes": article.likes.count()})
