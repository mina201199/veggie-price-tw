import importlib.util
from pathlib import Path
import unittest
from waitress.proxy_headers import proxy_headers_middleware
ROOT = Path(__file__).resolve().parents[2]
class ProxyTests(unittest.TestCase):
    def config(self):
        spec = importlib.util.spec_from_file_location('proxy_config', ROOT / 'deploy/proxy_config.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    def test_only_fixed_proxy_can_supply_client_address_and_https(self):
        options = self.config().proxy_options({'WAITRESS_TRUSTED_PROXY': '172.30.88.10'})
        observed = []
        def app(environ, start_response):
            observed.append(environ.copy())
            return []
        middleware = proxy_headers_middleware(app, trusted_proxy=options['trusted_proxy'], trusted_proxy_count=options['trusted_proxy_count'], trusted_proxy_headers=options['trusted_proxy_headers'], clear_untrusted=options['clear_untrusted_proxy_headers'])
        for peer in ('172.30.88.10', '172.30.88.20'):
            middleware({'REMOTE_ADDR':peer,'HTTP_X_FORWARDED_FOR':'198.51.100.8','HTTP_X_FORWARDED_PROTO':'https','wsgi.url_scheme':'http','SERVER_PORT':'8878'}, lambda *args: None)
        self.assertEqual(observed[0]['REMOTE_ADDR'], '198.51.100.8')
        self.assertEqual(observed[0]['wsgi.url_scheme'], 'https')
        self.assertEqual(observed[1]['REMOTE_ADDR'], '172.30.88.20')
        self.assertEqual(observed[1]['wsgi.url_scheme'], 'http')
        self.assertNotIn('HTTP_X_FORWARDED_FOR', observed[1])
    def test_wildcard_or_missing_proxy_rejected(self):
        for env in ({}, {'WAITRESS_TRUSTED_PROXY':'*'}):
            with self.assertRaises(ValueError):
                self.config().proxy_options(env)
