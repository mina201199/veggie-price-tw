"""Publish only validated government price data; a failed run leaves the published snapshot unchanged."""
import argparse
import datetime as dt
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent

def publish_snapshot(source, destination):
    data = json.loads(source.read_text(encoding='utf-8'))
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    if data.get('schema') != 1 or not isinstance(data.get('items'), list) or not data['items']:
        raise ValueError('Empty or unsupported snapshot')
    if dt.date.fromisoformat(data['latest']) > today or dt.date.fromisoformat(data['asOf']) > today:
        raise ValueError('Snapshot contains a future date')
    if destination.exists():
        previous = json.loads(destination.read_text(encoding='utf-8'))
        if previous.get('latest', '') > data['latest']:
            raise ValueError('Refusing an older snapshot')
    destination.parent.mkdir(exist_ok=True)
    staged = destination.with_suffix('.tmp')
    staged.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    staged.replace(destination)
    return {'latest': data['latest'], 'items': len(data['items']), 'generatedAt': data['generatedAt']}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--skip-fetch', action='store_true');args=parser.parse_args()
    (ROOT/'prototype-3d').mkdir(exist_ok=True)
    if not args.skip_fetch:
        subprocess.run([sys.executable, str(ROOT/'tools/fetch.py'), '--days', '10'], cwd=ROOT, check=True)
        # Retail outage keeps the prior monthly source, matching the existing workflow.
        result=subprocess.run([sys.executable, str(ROOT/'tools/fetch_retail.py')], cwd=ROOT)
        if result.returncode: print('Retail refresh failed; retaining the previous source', file=sys.stderr)
    subprocess.run([sys.executable, str(ROOT/'tools/build_prices.py')], cwd=ROOT, check=True)
    print(json.dumps(publish_snapshot(ROOT/'prototype-3d/prices-data.json', ROOT/'dist/prices-data.json')))

if __name__=='__main__':main()
