import json
from pathlib import Path
base=Path(__file__).parent
data=json.loads((base/'xinyi-osm.json').read_text(encoding='utf-8'))
roads=[];buildings=[]
for e in data['elements']:
    t=e.get('tags',{});g=e.get('geometry',[])
    if e['type']!='way' or len(g)<2: continue
    points=[[p['lat'],p['lon']] for p in g]
    if 'highway' in t and t['highway'] not in ['steps','construction','proposed'] and t.get('access')!='private':
        roads.append(dict(id=e['id'],name=t.get('name','巷弄'),kind=t['highway'],points=points))
    if 'building' in t and len(g)>3:
        buildings.append(dict(id=e['id'],points=points,levels=t.get('building:levels',3),name=t.get('name','')))
streets=dict(source='© OpenStreetMap contributors, ODbL; Overpass snapshot 2026-10-12',bounds=[25.027,121.557,25.052,121.582],roads=roads,buildings=buildings)
(base/'xinyi-streets.js').write_text('window.XinyiStreets='+json.dumps(streets,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
pois=json.loads((base/'xinyi-pois.json').read_text(encoding='utf-8'))
addresses={'永春市場':'臺北市信義區松山路294號','永吉市場':'臺北市信義區永吉路278巷1弄30號','光復市場':'臺北市信義區光復南路419巷146號'}
venues=[]
for name in ['永春市場','永吉市場','光復市場']:
    p=next(p for p in pois if p['tags']['name']==name)
    venues.append(dict(id='xinyi-'+str(p['id']),name=name,kind='market',lat=p['lat'],lng=p['lng'],address=addresses[name],hours='營業時間請依市場現場公告',sourceName='OpenStreetMap 地點資料',sourceUrl='https://www.openstreetmap.org/way/'+str(p['id']),coordinateSource='https://www.openstreetmap.org/way/'+str(p['id'])))
places=dict(venues=venues,center=[25.039,121.572],checkedDate='2026-10-12',coverage='首批試玩範圍：永春、永吉與光復市場及信義商圈周邊道路；尚未涵蓋信義區全部地點。')
(base/'xinyi-places.js').write_text('window.XinyiPlaces='+json.dumps(places,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(len(roads),'roads;',len(buildings),'building footprints;',len(venues),'markets')
