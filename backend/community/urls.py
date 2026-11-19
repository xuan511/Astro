from django.urls import path
from knox.views import LogoutView

from .views import Account, AddComment, ArticleLike, Discussion

urlpatterns = [
    path("api/register/", Account.as_view(register=True)),
    path("api/login/", Account.as_view()),
    path("api/logout/", LogoutView.as_view()),
    path("api/articles/<path:key>/comments/", AddComment.as_view()),
    path("api/articles/<path:key>/like/", ArticleLike.as_view()),
    path("api/discussion/<path:key>/", Discussion.as_view()),
]
