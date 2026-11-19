import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from community.models import Article


class Command(BaseCommand):
    help = "Sync published Astro article IDs from the built dist/search.json."

    def add_arguments(self, parser):
        parser.add_argument("index", type=Path)

    def handle(self, index, **options):
        try:
            rows = json.loads(index.read_text(encoding="utf-8"))
            if not isinstance(rows, list):
                raise ValueError("Expected an array.")
            keys = set()
            for row in rows:
                key, kind = row["id"], row["kind"]
                if not isinstance(key, str) or not 0 < len(key) <= 512 or kind not in ("tech", "life", "project"):
                    raise ValueError("Invalid search entry.")
                if kind != "project":
                    keys.add(key)
        except (OSError, ValueError, KeyError, TypeError) as error:
            raise CommandError(str(error)) from error
        with transaction.atomic():
            Article.objects.update(published=False)
            Article.objects.bulk_create(
                [Article(key=key, published=True) for key in keys],
                update_conflicts=True, update_fields=["published"], unique_fields=["key"],
            )
        self.stdout.write(f"Published articles: {len(keys)}")
