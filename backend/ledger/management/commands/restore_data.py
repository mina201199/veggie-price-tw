from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, connection
from ._archive import restore_sqlite

class Command(BaseCommand):
    help = 'Replace local SQLite data from a trusted full backup. Stop the backend first.'
    def add_arguments(self, parser):
        parser.add_argument('archive')
        parser.add_argument('--confirm', action='store_true')
    def handle(self, *args, **options):
        if not options['confirm']:
            raise CommandError('Restore replaces all users, records and photos. Stop the backend, create a fresh backup, then use --confirm.')
        if connection.vendor != 'sqlite':
            raise CommandError('For PostgreSQL use pg_restore plus the private photo volume; see BACKEND-README.md.')
        database = Path(connection.settings_dict['NAME'])
        connections.close_all()
        try:
            restore_sqlite(database, Path(settings.MEDIA_ROOT), Path(options['archive']))
        except Exception as error:
            raise CommandError(str(error)) from error
        self.stdout.write(self.style.SUCCESS('Restored database and photos. Run migrations before restarting.'))
