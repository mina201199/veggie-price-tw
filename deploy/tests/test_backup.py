from contextlib import closing
import importlib.util
import pathlib
import sqlite3
import tempfile
import unittest
import zipfile
ROOT = pathlib.Path(__file__).resolve().parents[2]
class BackupTests(unittest.TestCase):
    def archive(self):
        spec = importlib.util.spec_from_file_location('archive', ROOT / 'backend/ledger/management/commands/_archive.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    def test_full_sqlite_and_photo_round_trip(self):
        archive = self.archive()
        with tempfile.TemporaryDirectory() as directory:
            folder = pathlib.Path(directory)
            data = folder / 'data'
            (data / 'photos').mkdir(parents=True)
            db = data / 'db.sqlite3'
            with closing(sqlite3.connect(db)) as connection, connection:
                connection.execute('create table records (amount text)')
                connection.execute("insert into records values ('123.45')")
            (data / 'photos/a.jpg').write_bytes(b'photo')
            archive.backup_sqlite(db, data / 'photos', folder / 'backup.zip')
            (data / 'photos/a.jpg').unlink()
            with closing(sqlite3.connect(db)) as connection, connection:
                connection.execute('delete from records')
            archive.restore_sqlite(db, data / 'photos', folder / 'backup.zip')
            with closing(sqlite3.connect(db)) as connection, connection:
                self.assertEqual(connection.execute('select amount from records').fetchone()[0], '123.45')
            self.assertEqual((data / 'photos/a.jpg').read_bytes(), b'photo')
    def test_traversal_archive_rejected_without_modifying_database(self):
        archive = self.archive()
        with tempfile.TemporaryDirectory() as directory:
            folder = pathlib.Path(directory)
            db = folder / 'db.sqlite3'
            db.write_bytes(b'original')
            with zipfile.ZipFile(folder / 'bad.zip', 'w') as package:
                package.writestr('../escaped', 'bad')
            with self.assertRaises(ValueError):
                archive.restore_sqlite(db, folder / 'photos', folder / 'bad.zip')
            self.assertEqual(db.read_bytes(), b'original')
            self.assertFalse((folder.parent / 'escaped').exists())
