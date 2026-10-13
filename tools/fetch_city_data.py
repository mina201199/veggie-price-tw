"""Fetch bounded OSM city snapshots; normalize using the browser's exact converter.

Primary query/geometry documentation:
https://dev.overpass-api.de/overpass-doc/en/targets/formats.html
https://wiki.openstreetmap.org/wiki/Overpass_API (POST request examples).
https://dev.overpass-api.de/command_line.html (browser CORS contract).
No POIs, roads or buildings are invented. Missing OSM coverage stays missing.
"""
import argparse
import datetime
import json
from pathlib import Path
import subprocess
import sys
import urllib.parse
import urllib.request

AREAS = {
    "dayuan": [25.043, 121.177, 25.084, 121.224],
    "zhongli": [24.93, 121.199, 24.981, 121.255],
}

def fetch(area, endpoint):
    bounds = AREAS[area]
    box = ','.join(map(str, bounds))
    query = (f'[out:json][timeout:90][maxsize:134217728];('
             f'way[highway]({box});way[building]({box});'
             f'nwr[shop=supermarket]({box});nwr[amenity=marketplace]({box}););out geom;')
    request = urllib.request.Request(endpoint,
        data=urllib.parse.urlencode({'data': query}).encode(),
        headers={'User-Agent': 'MarketCityMap/1.0 OSM bounded snapshot'})
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = json.load(response)
        print('CORS:', response.headers.get('Access-Control-Allow-Origin'))
    if raw.get('remark'):
        raise RuntimeError(raw['remark'])
    raw['checkedDate'] = datetime.date.today().isoformat()
    root = Path(__file__).resolve().parents[1]
    folder = root / 'prototype-3d' / 'city-data'
    folder.mkdir(exist_ok=True)
    raw_path = folder / f'{area}-osm.json'
    raw_path.write_text(json.dumps(raw, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    script = "const fs=require('fs');const c=require('./prototype-3d/city-data.js');const raw=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));fs.writeFileSync(process.argv[2],JSON.stringify(c.normalize(raw,JSON.parse(process.argv[3]))));"
    subprocess.run(['node', '-e', script, str(raw_path), str(folder / f'{area}.json'), json.dumps(bounds)], cwd=root, check=True)
    result = json.loads((folder / f'{area}.json').read_text(encoding='utf-8'))
    print(area, {key: len(result[key]) for key in ('roads', 'buildings', 'venues')})
    for venue in result['venues']:
        print(venue['id'], venue['name'], venue['kind'], venue['lat'], venue['lng'])

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--area', choices=AREAS)
    parser.add_argument('--endpoint', default='https://overpass-api.de/api/interpreter')
    args = parser.parse_args()
    for area in ([args.area] if args.area else AREAS):
        fetch(area, args.endpoint)
