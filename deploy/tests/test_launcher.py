import importlib.util
import pathlib
import tempfile
import unittest
ROOT = pathlib.Path(__file__).resolve().parents[2]
class LauncherTests(unittest.TestCase):
    def launcher(self):
        spec = importlib.util.spec_from_file_location('launcher', ROOT / 'start_backend.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    def test_loopback_default_and_explicit_lan_hosts(self):
        launcher = self.launcher()
        with tempfile.TemporaryDirectory() as directory:
            env, urls = launcher.local_environment(pathlib.Path(directory), False, 8878, ['192.168.1.8'], {})
            self.assertEqual(env['DJANGO_ALLOWED_HOSTS'], '127.0.0.1,localhost')
            self.assertEqual(urls, ['http://127.0.0.1:8878/app/'])
            env, urls = launcher.local_environment(pathlib.Path(directory), True, 8878, ['192.168.1.8'], {})
            self.assertIn('192.168.1.8', env['DJANGO_ALLOWED_HOSTS'].split(','))
            self.assertIn('http://192.168.1.8:8878/app/', urls)
            self.assertNotIn('*', env['DJANGO_ALLOWED_HOSTS'])
    def test_secret_survives_restart_and_explicit_hosts_preserved(self):
        launcher = self.launcher()
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            first, _ = launcher.local_environment(path, True, 8878, [], {'DJANGO_ALLOWED_HOSTS': 'home.local'})
            second, _ = launcher.local_environment(path, True, 8878, [], {})
            self.assertEqual(first['DJANGO_SECRET_KEY'], second['DJANGO_SECRET_KEY'])
            self.assertIn('home.local', first['DJANGO_ALLOWED_HOSTS'].split(','))
            self.assertGreaterEqual(len(first['DJANGO_SECRET_KEY']), 50)
    def test_default_route_precedes_virtual_adapters_and_invalid_addresses_are_removed(self):
        launcher = self.launcher()
        actual = launcher.ordered_lan_addresses(['192.168.200.1', '127.0.0.1', 'bad', '8.8.8.8', '169.254.1.1', '::1'], '172.22.32.94')
        self.assertEqual(actual, ['172.22.32.94', '192.168.200.1'])
if __name__ == '__main__':
    unittest.main()
