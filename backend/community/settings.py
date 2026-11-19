import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv("DJANGO_DEBUG") == "1"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or ("local-development-only" if DEBUG else "")
if not SECRET_KEY:
    raise ImproperlyConfigured("Set DJANGO_SECRET_KEY, or DJANGO_DEBUG=1 for local development.")


def env_list(name, fallback=""):
    return [value.strip() for value in os.getenv(name, fallback).split(",") if value.strip()]


ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1" if DEBUG else "")
CORS_ALLOWED_ORIGINS = env_list("FRONTEND_ORIGINS", "http://localhost:4173" if DEBUG else "")
CORS_URLS_REGEX = r"^/api/"
ROOT_URLCONF = "community.urls"
WSGI_APPLICATION = "community.wsgi.application"
INSTALLED_APPS = [
    "django.contrib.auth", "django.contrib.contenttypes", "corsheaders",
    "rest_framework", "knox", "community",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware", "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]
DATABASES = {"default": {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": os.getenv("DATABASE_PATH", str(BASE_DIR / "db.sqlite3")),
    "OPTIONS": {"timeout": 15, "transaction_mode": "IMMEDIATE"},
}}
LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "UTC"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation." + name}
    for name in ("UserAttributeSimilarityValidator", "MinimumLengthValidator",
                 "CommonPasswordValidator", "NumericPasswordValidator")
]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["knox.auth.TokenAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"account": "20/hour", "comment": "12/minute", "like": "60/minute"},
    # Trust the socket peer, never a client-supplied X-Forwarded-For chain.
    "NUM_PROXIES": int(os.getenv("TRUSTED_PROXY_COUNT", "0")),
}
REST_KNOX = {"TOKEN_TTL": timedelta(hours=12), "AUTH_HEADER_PREFIX": "Bearer"}
