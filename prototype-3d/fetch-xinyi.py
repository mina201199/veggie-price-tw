import json, urllib.request, urllib.parse
from pathlib import Path
query='''[out:json][timeout:90];(way[highway](25.027,121.557,25.052,121.582);way[building](25.027,121.557,25.052,121.582);nwr[name~"永春市場|虎林市場|吳興市場|福德市場|臺北101|台北101"](25.027,121.557,25.052,121.582););out tags center geom;'''
for endpoint in ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']:
    try:
        request=urllib.request.Request(endpoint,data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'MarketWalkPrototype/1.0'})
        data=json.load(urllib.request.urlopen(request,timeout=120))
        Path(__file__).with_name('xinyi-osm.json').write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
        print('Downloaded',len(data['elements']),'elements')
        break
    except Exception as error:
        print(type(error).__name__,str(error),flush=True)
else:
    raise RuntimeError('OSM download failed')
