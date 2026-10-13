"""Private full SQLite backup; never used to import user-supplied note JSON."""
from pathlib import Path, PurePosixPath
from contextlib import closing
import json
import os
import shutil
import sqlite3
import tempfile
import zipfile

FORMAT = 'household-ledger-sqlite-v1'
MAX_BYTES = 2 * 1024 * 1024 * 1024

def backup_sqlite(database, photos, output):
    database, photos, output = map(lambda path: Path(path).resolve(), (database, photos, output))
    if not database.is_file():
        raise ValueError('Database does not exist; run migrations first.')
    if output == database or output.is_relative_to(photos):
        raise ValueError('Backup output must be outside the database and photo directory.')
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise ValueError('Backup output already exists; choose a new filename.')
    with tempfile.TemporaryDirectory(dir=output.parent) as temporary:
        folder = Path(temporary)
        snapshot = folder / 'db.sqlite3'
        with closing(sqlite3.connect(f'file:{database.as_posix()}?mode=ro', uri=True)) as source, closing(sqlite3.connect(snapshot)) as target:
            source.backup(target)
        package = folder / 'backup.zip'
        with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('manifest.json', json.dumps({'format': FORMAT}))
            archive.write(snapshot, 'db.sqlite3')
            if photos.exists():
                for photo in photos.rglob('*'):
                    if photo.is_symlink():
                        raise ValueError('Photo directory contains a symbolic link.')
                    if photo.is_file():
                        archive.write(photo, 'photos/' + photo.relative_to(photos).as_posix())
        # Exclusive creation avoids overwriting a backup created by another process.
        with output.open('xb') as destination, package.open('rb') as source:
            shutil.copyfileobj(source, destination)

def restore_sqlite(database, photos, source):
    database, photos, source = map(lambda path: Path(path).resolve(), (database, photos, source))
    database.parent.mkdir(parents=True, exist_ok=True)
    if photos.parent != database.parent:
        raise ValueError('Database and photos must share the private data directory.')
    with tempfile.TemporaryDirectory(dir=database.parent) as temporary:
        folder = Path(temporary)
        staged_photos = folder / 'photos'
        staged_photos.mkdir()
        with zipfile.ZipFile(source) as archive:
            entries = archive.infolist()
            if sum(entry.file_size for entry in entries) > MAX_BYTES or len(entries) > 100000:
                raise ValueError('Backup is too large.')
            names = set()
            for entry in entries:
                name = entry.filename
                path = PurePosixPath(name)
                if name in names or '\\' in name or ':' in name or path.is_absolute() or '..' in path.parts:
                    raise ValueError('Invalid backup path.')
                names.add(name)
                if name not in ('manifest.json', 'db.sqlite3') and not name.startswith('photos/'):
                    raise ValueError('Unexpected backup file.')
                if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                    raise ValueError('Backup symbolic links are not allowed.')
            if json.loads(archive.read('manifest.json')).get('format') != FORMAT:
                raise ValueError('Unsupported backup format.')
            if 'db.sqlite3' not in names:
                raise ValueError('Backup has no database.')
            for entry in entries:
                target = folder / entry.filename
                if entry.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(entry) as incoming, target.open('wb') as outgoing:
                        shutil.copyfileobj(incoming, outgoing)
        staged_db = folder / 'db.sqlite3'
        with closing(sqlite3.connect(staged_db)) as connection:
            if connection.execute('pragma integrity_check').fetchone() != ('ok',):
                raise ValueError('Backup database failed integrity check.')
        # Server must be stopped: active SQLite WAL files cannot be restored safely.
        if Path(str(database) + '-wal').exists() or Path(str(database) + '-shm').exists():
            raise ValueError('Stop the backend and close all SQLite connections before restoring.')
        old_db, old_photos = folder / 'previous.sqlite3', folder / 'previous-photos'
        moved_db = moved_photos = installed_db = installed_photos = False
        try:
            if database.exists():
                os.replace(database, old_db)
                moved_db = True
            if photos.exists():
                os.replace(photos, old_photos)
                moved_photos = True
            os.replace(staged_db, database)
            installed_db = True
            os.replace(staged_photos, photos)
            installed_photos = True
        except BaseException:
            if installed_db:
                database.unlink()
            if installed_photos:
                shutil.rmtree(photos)
            if moved_db:
                os.replace(old_db, database)
            if moved_photos:
                os.replace(old_photos, photos)
            raise
