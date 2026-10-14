import datetime as dt
import pathlib
import unittest
from unittest.mock import patch

class FetchFailureTests(unittest.TestCase):
    def definitions(self):
        p=pathlib.Path(__file__).parent/'tools/fetch.py';namespace={'__file__':str(p)}
        source=p.read_text(encoding='utf-8').split('# key:')[0]
        with patch('sys.argv',['fetch.py','--days','1']):exec(compile(source,str(p),'exec'),namespace)
        return namespace
    def test_one_exhausted_request_aborts_before_any_raw_write(self):
        n=self.definitions()
        with patch('urllib.request.urlopen',side_effect=OSError('outage')),patch('time.sleep'):
            with self.assertRaises(RuntimeError):n['fetch']('N04',dt.date(2026,10,14),dt.date(2026,10,14))
    def test_single_day_at_api_cap_aborts_instead_of_publishing_truncated_prices(self):
        n=self.definitions();n['CAP']=2;n['fetch']=lambda *args:[{},{}]
        with self.assertRaises(RuntimeError):n['get'](('N04',dt.date(2026,10,14),dt.date(2026,10,14)))

if __name__=='__main__':unittest.main()
