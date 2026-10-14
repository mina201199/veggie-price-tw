import datetime as dt
import json
import pathlib
import tempfile
import unittest
from update_prices import publish_snapshot

class SnapshotTests(unittest.TestCase):
    def test_invalid_and_older_updates_preserve_last_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            source=pathlib.Path(tmp)/'candidate.json';dest=pathlib.Path(tmp)/'prices-data.json'
            day=dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat()
            good={'schema':1,'latest':day,'asOf':day,'items':[{'name':'菜'}],'generatedAt':day+'T00:00:00Z'}
            source.write_text(json.dumps(good));publish_snapshot(source,dest);before=dest.read_bytes()
            for change in [{'items':[]},{'latest':'2020-01-01'},{'latest':'2099-01-01'},{'schema':2}]:
                source.write_text(json.dumps({**good,**change}))
                with self.assertRaises(ValueError):publish_snapshot(source,dest)
                self.assertEqual(dest.read_bytes(),before)

if __name__=='__main__':unittest.main()
