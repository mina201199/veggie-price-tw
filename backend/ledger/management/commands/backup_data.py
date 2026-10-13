from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from ._archive import backup_sqlite

class Command(BaseCommand):
    help = 'Back up the complete local SQLite database and private photos to a new ZIP.'
    def add_arguments(self, parser):
        parser.add_argument('--output', required=True)
    def handle(self, *args, **options):
        if connection.vendor != 'sqlite':
            raise CommandError('For PostgreSQL use pg_dump plus the private photo volume; see BACKEND-README.md.')
        try:
            backup_sqlite(Path(connection.settings_dict['NAME']), Path(settings.MEDIA_ROOT), Path(options['output']))
        except Exception as error:
            raise CommandError(str(error)) from error
        self.stdout.write(self.style.SUCCESS('Private database and photos backed up. Protect this archive.'))
