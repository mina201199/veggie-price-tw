"""Seven distinct expressive local Blender character studies, exported for a review gallery."""
import os, math, random, importlib.util, json
import bpy
import numpy as np
from mathutils import Vector, Matrix

HERE=os.path.dirname(os.path.abspath(__file__))
spec=importlib.util.spec_from_file_location('dama_helpers',os.path.join(HERE,'dama_build.py'))
D=importlib.util.module_from_spec(spec);spec.loader.exec_module(D)
G=D.G;G.COL='CharacterStudy';G.TEX_DIR=os.path.join(HERE,'study-textures')
OUT=os.path.join(os.path.dirname(HERE),'prototype-3d','market-character-studies')
os.makedirs(OUT,exist_ok=True)
G.PREVIEW_DIR=OUT;G.BACKDROP='#e8e0d5'
ell,tube,lathe,mat=G.ellipsoid,G.tube,G.lathe,G.material
CONFIG={
 'grandma':dict(name='買菜阿嬤',quote='這把蔥順便送我啦。',shirt='#ad85c2',pants='#443939',hair='#a5a09b',skin='#ebc1a6',width=.35,expr='cheeky',tilt=-.10),
 'chief':dict(name='里長伯',quote='來來來！大家聽我講一下！',shirt='#bd2d37',pants='#484e59',hair='#39312d',skin='#e8b99b',width=.34,expr='announce',tilt=.06),
 'grandpa':dict(name='散步阿公',quote='我只是經過，順便聊兩個鐘頭。',shirt='#d8c8a9',pants='#80634c',hair='#bebbb3',skin='#dfb394',width=.30,expr='knowing',tilt=.10),
 'uncle':dict(name='汗衫阿伯',quote='天氣有夠熱，先喝一口茶。',shirt='#f4eee2',pants='#33477c',hair='#48403b',skin='#d5a17e',width=.43,expr='sleepy',tilt=-.06),
 'housewife':dict(name='家庭主婦',quote='誰又把地板踩髒？',shirt='#dc8273',pants='#555966',hair='#65432e',skin='#edc4ab',width=.31,expr='judging',tilt=-.13),
 'kid':dict(name='幼稚園小朋友',quote='那個西瓜比我的頭還大欸！',shirt='#84acd4',pants='#304774',hair='#30231c',skin='#f0c8ae',width=.29,expr='excited',tilt=.08),
 'taike':dict(name='八酒',quote='老闆，飲料冰一點。',shirt='#262625',pants='#426482',hair='#24201e',skin='#d3a17c',width=.34,expr='smirk',tilt=-.07),
}

def box(name,size,loc,m,bevel=.035):return G.box(name,size,loc,bevel=bevel,mat=m)
def ring(name,c,rx,rz,m,r=.01):
 p=[(c[0]+rx*math.cos(i*math.tau/48),c[1],c[2]+rz*math.sin(i*math.tau/48)) for i in range(49)]
 return tube(name,p,[r]*len(p),n=1,seg=8,mat=m)
def hand(name,p,m,scale=1,point=False):
 ell(name+'Palm',(.063*scale,.043*scale,.080*scale),loc=p,mat=m)
 for j in range(4):
  x=p[0]+(j-1.5)*.026*scale
  length=(.10 if point and j==0 else .042)*scale
  ell(name+'Finger'+str(j),(.015*scale,.022*scale,length),loc=(x,p[1]-.009,p[2]-.055*scale),mat=m,seg=12,rings=8)
 ell(name+'Thumb',(.025*scale,.03*scale,.05*scale),loc=(p[0]+.063*scale,p[1]-.015,p[2]+.009),rot=(0,.5,0),mat=m)

def head(cfg):
 start=set(bpy.data.collections[G.COL].objects)
 skin=mat('Skin',cfg['skin'],rough=.64);hair=mat('Hair',cfg['hair'],rough=.78)
 center=Vector((0,0,1.98));rx,ry,rz=.36,.315,.39
 if cfg['expr']=='excited':rx,ry,rz=.39,.33,.40
 ell('SculptedHead',(rx,ry,rz),loc=center,mat=skin,seg=48,rings=32)
 for s in (-1,1):
  ell('Ear'+str(s),(.062,.046,.103),loc=(s*(rx+.014),-.01,1.97),mat=skin)
  ell('EarFold'+str(s),(.024,.012,.046),loc=(s*(rx+.027),-.051,1.97),mat=mat('EarPink','#c58d76'))
 ell('NoseBridge',(.041,.049,.09),loc=(0,-.304,1.98),mat=skin)
 ell('NoseTip',(.065,.053,.032),loc=(0,-.352,1.92),mat=skin)
 ivory=mat('EyeWhite','#fff5df',rough=.42);iris=mat('Iris','#62402c',rough=.3);dark=mat('Dark','#28201a',rough=.4)
 lid_heights={'cheeky':(.023,.040),'announce':(.055,.055),'knowing':(.024,.027),'sleepy':(.016,.016),'judging':(.029,.020),'excited':(.064,.064),'smirk':(.019,.027)}[cfg['expr']]
 gaze={'cheeky':-.018,'announce':0,'knowing':.012,'sleepy':0,'judging':-.024,'excited':0,'smirk':.02}[cfg['expr']]
 for j,s in enumerate((-1,1)):
  x=s*.135;y=-.285;z=2.035
  h=lid_heights[j]
  ell('EyeWhite'+str(s),(.085,.035,h),loc=(x,y,z),mat=ivory)
  ell('Iris'+str(s),(.024,.010,min(.029,h*.85)),loc=(x+gaze,y-.034,z-.002),mat=iris)
  ell('Pupil'+str(s),(.012,.006,min(.020,h*.65)),loc=(x+gaze,y-.044,z-.002),mat=dark)
  ell('EyeSpark'+str(s),(.006,.003,.007),loc=(x+gaze-.006,y-.05,z+.006),mat=mat('Spark','#ffffff'))
  ell('UpperLid'+str(s),(.092,.036,.018),loc=(x,y-.002,z+h+.006),mat=skin)
  ell('LowerLid'+str(s),(.085,.027,.012),loc=(x,y-.003,z-h-.008),mat=skin)
  bz=2.135+(.02 if j==0 and cfg['expr'] in ('judging','cheeky','smirk') else 0)
  tube('Eyebrow'+str(s),[(x-.08,-.277,bz),(x,-.297,bz+(.025 if cfg['expr']!='judging' else -.012)),(x+.075,-.28,bz-.008)],[.011,.019,.01],n=5,seg=10,mat=hair)
 lip=mat('Lips','#ae7963',rough=.8)
 if cfg['expr'] in ('announce','excited'):
  ell('OpenSmile',(.082,.023,.050),loc=(0,-.278,1.785),mat=mat('MouthInside','#5b3030'))
  box('UpperTeeth',(.115,.011,.018),(0,-.303,1.807),mat('Teeth','#fff1d8'),bevel=.007)
 else:
  corner=.033 if cfg['expr']!='judging' else -.008
  tube('Smile',[(-.094,-.273,1.80+corner),(0,-.274,1.775),(.094,-.273,1.80+corner+(.015 if cfg['expr']=='smirk' else 0))],[.008,.011,.008],n=7,seg=10,mat=lip)
 # Hair silhouettes differ in age, volume and grooming.
 if cfg['expr'] in ('cheeky','judging'):
  ell('HairCap',(.375,.326,.24),loc=(0,.012,2.175),mat=hair)
  if cfg['expr']=='cheeky':
   for s in (-1,1):
    for i in range(9):ell('Curl',(.065,.065,.065),loc=(s*(.32+.024*math.sin(i)),.16-.04*i,2.20-.025*i),mat=hair)
  else:
   ell('HairBun',(.15,.14,.14),loc=(.09,.28,2.26),mat=hair)
   clip=mat('HairClip','#8c5548')
   for i in range(5):box('ClipTooth',(.03,.07,.075),(.025+i*.026,.33,2.24),clip,.008)
 elif cfg['expr']=='sleepy':
  for s in (-1,1):ell('SideHair',(.077,.255,.16),loc=(s*.305,.058,2.14),mat=hair)
  for i in range(6):tube('CombOver',[(-.22+i*.02,.03,2.26),(-.05+i*.02,-.06,2.38),(.18+i*.012,-.04,2.32)],[.009,.013,.006],mat=hair)
 elif cfg['expr']=='knowing':
  ell('BackHair',(.345,.295,.23),loc=(0,.065,2.17),mat=hair)
  for i in range(9):ell('SweptSilverHair',(.06,.18,.072),loc=(-.25+i*.06,.008,2.27+.065*math.sin(i/8*math.pi)),rot=(.25,0,-.2),mat=hair)
 else:
  ell('HairDome',(.375,.325,.205),loc=(0,.02,2.22),mat=hair)
  if cfg['expr']=='excited':
   for i in range(7):ell('Fringe',(.055,.032,.09),loc=(-.23+i*.075,-.262,2.18),rot=(0,.15,0),mat=hair)
  elif cfg['expr']=='announce':
   for i in range(8):ell('CombedQuiff',(.067,.19,.075),loc=(-.24+i*.065,-.035,2.31+.03*math.sin(i)),rot=(.1,.12,-.12),mat=hair)
 # Rotate all face parts together, keeping facial expression coherent.
 pivot=bpy.data.objects.new('HeadPose',None);bpy.data.collections[G.COL].objects.link(pivot);pivot.location=(0,0,1.65)
 bpy.context.view_layer.update()
 for ob in set(bpy.data.collections[G.COL].objects)-start-{pivot}:
  mw=ob.matrix_world.copy();ob.parent=pivot;ob.matrix_world=mw
 return pivot,skin,hair

def outfit(cid,cfg,skin):
 w=cfg['width'];shirt=mat('Shirt',cfg['shirt'],rough=.85);pants=mat('Pants',cfg['pants'],rough=.86)
 short=cid in ('uncle','kid')
 ell('Pelvis',(w*.83,.21,.16),loc=(0,0,.78),mat=pants)
 for s in (-1,1):
  x=s*.16;footx=x+s*.025
  tube('TrouserLeg',[(x,0,.8),(x+s*.015,-.01,.48 if short else .43),(footx,-.015,.43 if short else .12)],[.135,.125,.13 if short else .10],mat=pants)
  if short:tube('BareCalf',[(footx,0,.45),(footx,-.012,.13)],[.087,.073],n=4,mat=skin)
  shoe=mat('Shoe','#62433a' if cid=='chief' else '#403832')
  if cid in ('uncle','taike'):
   ell('Foot',(.087,.14,.05),loc=(footx,-.09,.065),mat=skin)
   ell('BlueWhiteSole',(.108,.18,.025),loc=(footx,-.09,.025),mat=mat('Rubber','#385c9a'))
   tube('FlipFlopStrap',[(footx-.073,-.07,.098),(footx,-.20,.105),(footx+.073,-.07,.098)],[.018,.018,.018],mat=mat('BlueStrap','#f4efdf'))
  else:
   ell('Shoe',(.11,.18,.070),loc=(footx,-.09,.074),mat=shoe if cid!='kid' else mat('KidShoes','#f1eee7'))
   ell('Sole',(.115,.185,.025),loc=(footx,-.09,.025),mat=mat('Sole','#ece4d5'))
   if cid=='kid':
    for z in (.09,.13):box('Velcro',(.14,.025,.018),(footx,-.205,z),mat('BlueVelcro','#5481b4'),.006)
 tube('Neck',[(0,0,1.48),(0,0,1.69)],[.125,.135],mat=skin)
 # Smooth continuous shirt silhouette, broadest over the belly.
 prof=[(0,.72),(w*.76,.72),(w*.95,.78),(w*1.05,.96),(w*1.07,1.11),(w*.98,1.3),(w*.84,1.44),(w*.58,1.51),(.13,1.53)]
 shirt_ob=lathe('Torso',[tuple(p) for p in G.catmull(prof,4)],seg=64,ys=.73,mat=shirt)
 if cid=='grandma':
  shirt_ob.data.materials.clear();shirt_ob.data.materials.append(mat('FloralShirt',rough=.85,image=D.floral_texture('granny_floral','#a989b9','#f4d8dc','#e2b5cf','#68567c','#edd8ac',n=23,size=(.05,.085),seed=22)))
  shirt=shirt_ob.data.materials[0]
 if cid!='uncle':
  collar=mat('Collar',cfg['shirt'])
  for s in (-1,1):box('CollarPoint',(.10,.032,.14),(s*.086,-.14,1.45),collar,.018).rotation_euler.y=s*.38
  for z in (1.02,1.16,1.30):ell('Button',(.014,.008,.014),loc=(0,-w*.75-.004,z),mat=mat('Buttons','#f1dfcc'),seg=12,rings=8)
 # Poses are specific to each character. Right arm is on the viewer's left.
 poses={
  'grandma': [((-.32,0,1.39),(-.48,-.10,1.08),(-.64,-.20,1.05)),((.32,0,1.39),(.44,-.06,1.05),(.25,-.27,1.02))],
  'chief': [((-.31,0,1.40),(-.47,-.13,1.62),(-.57,-.18,1.91)),((.31,0,1.40),(.48,-.09,1.16),(.20,-.40,1.44))],
  'grandpa': [((-.29,0,1.39),(-.42,-.08,1.14),(-.54,-.23,1.07)),((.29,0,1.39),(.39,-.10,1.12),(.21,-.29,.98))],
  'uncle': [((-.36,0,1.38),(-.52,-.06,1.08),(-.43,-.30,1.00)),((.36,0,1.38),(.56,-.12,1.20),(.25,-.40,1.65))],
  'housewife': [((-.29,0,1.40),(-.50,-.10,1.18),(-.42,-.33,1.19)),((.29,0,1.40),(.41,-.02,1.12),(.24,-.23,.99))],
  'kid': [((-.29,0,1.39),(-.45,-.05,1.65),(-.51,-.15,1.83)),((.29,0,1.39),(.44,-.02,1.17),(.46,-.16,.98))],
  'taike': [((-.31,0,1.4),(-.42,-.04,1.05),(-.33,-.24,.93)),((.31,0,1.4),(.46,-.10,1.19),(.39,-.32,1.22))]
 }
 for i,(sh,el,wr) in enumerate(poses[cid]):
  if cid!='uncle':
   ell('ShoulderCap',(.125,.115,.115),loc=sh,mat=shirt)
   mid=Vector(sh).lerp(Vector(el),.50);tube('ShortSleeve',[sh,tuple(mid)],[.125,.115],n=3,mat=shirt)
   begin=tuple(Vector(sh).lerp(Vector(el),.42))
  else:begin=sh
  arm_mat=skin
  if cid=='taike':
   image=bpy.data.images.load(os.path.join(os.path.dirname(HERE),'prototype-3d','bajiu','dragon.png' if i==0 else 'koi.png'),check_existing=True)
   arm_mat=mat('DragonTattoo' if i==0 else 'KoiTattoo',rough=.7,image=image)
  tube('Arm',[begin,el,wr],[.10,.086,.061],mat=arm_mat)
  hand('Hand'+str(i),wr,skin,point=cid in ('chief','kid') and i==0)
 return shirt,pants,poses[cid]

def hat(pivot,color,kind='bucket'):
 m=mat('Hat',color,rough=.83)
 before=set(bpy.data.collections[G.COL].objects)
 lathe('HatCrown',[tuple(p) for p in G.catmull([(.365,2.20),(.355,2.30),(.29,2.43),(.14,2.48),(0,2.49)],4)],seg=64,ys=.9,mat=m)
 lathe('HatBrim',[(.36,2.22),(.40,2.22),(.46,2.17),(.48,2.14)],seg=64,ys=.91,mat=m)
 lathe('HatBand',[(.364,2.24),(.359,2.28)],seg=64,ys=.90,mat=mat('HatBand','#876296' if kind=='bucket' else '#d8a329'))
 for ob in set(bpy.data.collections[G.COL].objects)-before:
  mw=ob.matrix_world.copy();ob.parent=pivot;ob.matrix_world=mw

def props(cid,cfg,pivot,skin,poses):
 wood=mat('Wood','#715038');metal=mat('Metal','#525963',metallic=.65,rough=.4)
 if cid=='grandma':
  hat(pivot,'#ad85c7')
  x=-.65
  box('TrolleyBag',(.35,.24,.49),(x,-.09,.48),mat('TartanBag','#63744d'),.05)
  line=mat('TartanLines','#d3c3a3')
  for dx in (-.14,-.07,0,.07,.14):box('TartanVertical',(.011,.008,.43),(x+dx,-.215,.48),line,.002)
  for z in (.3,.38,.46,.54,.62,.70):box('TartanHorizontal',(.33,.008,.01),(x,-.222,z),line,.002)
  tube('TrolleyFrame',[(x-.14,0,.15),(x-.14,0,1.05),(x+.14,0,1.05),(x+.14,0,.15)],[.014]*4,n=3,mat=metal)
  for s in (-1,1):ell('Wheel',(.053,.086,.086),loc=(x+s*.21,.03,.086),mat=mat('Tire','#272726'))
  green=mat('Greens','#508343')
  for i in range(5):ell('CabbageLeaf',(.055,.035,.14),loc=(x+(i-2)*.046,-.065,.80),rot=(0,(i-2)*.18,0),mat=green)
  # Tiny flowers embroidered on the shoes.
  for s in (-1,1):
   for j in range(5):ell('ShoeFlower',(.011,.009,.016),loc=(s*.185+.019*math.sin(j*math.tau/5),-.26,.095+.019*math.cos(j*math.tau/5)),mat=mat('Embroidery','#dd91a3'),seg=10,rings=6)
 if cid=='chief':
  blue=mat('PoloBlue','#93b1ce')
  box('VestOpening',(.14,.014,.54),(0,-.26,1.13),blue,.022)
  for s in (-1,1):tube('WhiteVestPiping',[(s*.11,-.18,1.45),(s*.12,-.27,1.25),(s*.12,-.265,.82)],[.011]*3,mat=mat('Piping','#f0e3cc'))
  for s in (-1,1):ring('Glasses',(s*.135,-.338,2.037),.103,.079,wood,.009)
  tube('GlassesBridge',[(-.03,-.344,2.055),(.03,-.344,2.055)],[.008,.008],n=1,mat=wood)
  # Glasses follow the head pose.
  for ob in list(bpy.data.collections[G.COL].objects):
   if ob.name.startswith('Glasses'):
    mw=ob.matrix_world.copy();ob.parent=pivot;ob.matrix_world=mw
  p=Vector(poses[1][2]);tube('MicHandle',[p+Vector((0,-.01,-.04)),p+Vector((0,-.02,.16))],[.031,.035],mat=metal)
  ell('MicHead',(.062,.054,.07),loc=p+Vector((0,-.02,.20)),mat=mat('MicMesh','#363739'))
  rosette=mat('Rosette','#e9b24b')
  for i in range(10):ell('RibbonPetal',(.028,.013,.047),loc=(-.20+.043*math.sin(i*math.tau/10),-.235,1.30+.043*math.cos(i*math.tau/10)),rot=(0,i*math.tau/10,0),mat=rosette)
  box('WaistPouch',(.23,.09,.11),(.19,-.24,.83),mat('Pouch','#263c59'))
 if cid=='grandpa':
  p=Vector(poses[0][2]);tube('Cane',[(-.57,-.23,.04),(-.57,-.23,1.10),(-.51,-.23,1.12),(-.48,-.23,1.08)],[.023]*4,mat=wood)
  box('ShirtPocket',(.11,.016,.13),(.19,-.235,1.23),mat('Pocket',cfg['shirt']),.015)
  bead=mat('PrayerBeads','#8d3940')
  wr=Vector(poses[1][2])
  for i in range(12):ell('PrayerBead',(.018,.018,.018),loc=wr+Vector((.075*math.cos(i*math.tau/12),.065*math.sin(i*math.tau/12),.065)),mat=bead,seg=12,rings=8)
 if cid=='uncle':
  # Rounded undershirt straps, sweat towel, and tea bottle raised near his face.
  for s in (-1,1):tube('TankStrap',[(s*.19,-.24,1.32),(s*.23,-.11,1.48),(s*.23,.08,1.42)],[.032]*3,mat=mat('TankWhite',cfg['shirt']))
  towel=mat('Towel','#eee6cf');stripe=mat('TowelStripe','#5675a4')
  for s in (-1,1):
   box('TowelEnd',(.09,.04,.29),(s*.145,-.278,1.25),towel,.015)
   for z in (1.12,1.15):box('TowelStripe',(.09,.012,.009),(s*.145,-.303,z),stripe,.003)
  p=Vector(poses[1][2]);bottle=lathe('TeaThermos',[(.054,0),(.07,.02),(.07,.28),(.055,.30)],seg=32,mat=mat('Thermos','#6a807b',metallic=.3))
  bottle.location=p+Vector((0,-.025,-.03));bottle.rotation_euler.x=-.36
  ell('ThermosLid',(.072,.072,.024),loc=p+Vector((0,.08,.25)),mat=metal)
 if cid=='housewife':
  apron=mat('GinghamApron','#d6ddc9');line=mat('ApronCheck','#718678')
  box('ApronBib',(.35,.025,.43),(0,-.246,1.16),apron,.035)
  box('ApronSkirt',(.54,.035,.39),(0,-.25,.80),apron,.035)
  for x in (-.20,-.12,-.04,.04,.12,.20):box('ApronVertical',(.017,.008,.35),(x,-.273,.80),line,.003)
  for z in (.65,.73,.81,.89,.97):box('ApronHorizontal',(.49,.008,.017),(0,-.279,z),line,.003)
  box('ApronPocket',(.17,.018,.10),(.08,-.29,.87),apron,.015)
  p=Vector(poses[0][2]);tube('DusterHandle',[p+Vector((0,-.04,-.13)),p+Vector((0,-.04,.44))],[.013,.014],mat=wood)
  for i in range(17):
   a=i*2.4;r=.075*(.3+.7*(i%4)/3)
   ell('Feather',(.027,.025,.13),loc=p+Vector((r*math.sin(a),-.04+r*math.cos(a),.43+(i%3)*.045)),rot=(.18*math.cos(a),.35*math.sin(a),0),mat=mat('Feather'+str(i%3),['#9b694c','#d7b589','#76564c'][i%3]))
  box('FloralTote',(.25,.12,.28),(.49,-.12,.70),mat('FloralTote',rough=.85,image=D.floral_texture('tote_flowers','#e2b5ac','#dd927b','#fff0c9','#946260','#f3d09e',n=12,size=(.08,.1),seed=42)))
  tube('ToteLoop',[(.40,-.16,.84),(.47,-.16,1.02),(.59,-.16,.85)],[.013]*3,mat=wood)
 if cid=='kid':
  hat(pivot,'#e9bf44','school')
  box('SchoolBag',(.37,.16,.41),(0,.27,1.12),mat('SchoolNavy','#33486d'),.07)
  bear=mat('Bear','#d4a15c')
  ell('BearFace',(.10,.025,.10),loc=(0,.365,1.16),mat=bear)
  for s in (-1,1):ell('BearEar',(.041,.025,.041),loc=(s*.085,.368,1.24),mat=bear)
  for s in (-1,1):ell('BearEye',(.012,.008,.016),loc=(s*.035,.394,1.18),mat=mat('BearDark','#44312b'),seg=12,rings=8)
  for s in (-1,1):tube('BackpackStrap',[(s*.16,.3,1.29),(s*.22,-.02,1.47),(s*.21,-.24,1.13)],[.023]*3,mat=mat('PackYellow','#e4b842'))
  p=Vector(poses[1][2]);bag=mat('DrawstringBag','#e8c759');ell('DrawstringBag',(.09,.075,.14),loc=p+Vector((.01,0,-.19)),mat=bag)
  tube('DrawstringLoop',[p,p+Vector((-.05,0,-.08)),p+Vector((.05,0,-.08)),p],[.006]*4,mat=wood)
 if cid=='taike':
  gold=mat('Gold','#c7993c',metallic=.8,rough=.25)
  for i in range(19):
   a=-1.25+2.5*i/18;ring('ChainLink',(.24*math.sin(a),-.21-.08*math.cos(a),1.49-.16*math.cos(a)),.026,.034,gold,.008)
  ring('Earring',(-.38,-.03,1.93),.020,.029,gold,.008)
  for s in (-1,1):
   box('DenimKneeRip',(.18,.013,.055),(s*.17,-.14,.44),skin,.013)
   for j in range(3):tube('FrayedThread',[(s*.17-.085,-.151,.43+j*.009),(s*.17+.085,-.151,.43+j*.009)],[.003,.003],n=1,mat=mat('Fray','#dddbcb'))
  p=Vector(poses[1][2]);cup=lathe('IcedDrink',[(.04,0),(.06,.15),(.068,.18)],seg=32,mat=mat('TeaCup','#c19c68'));cup.location=p+Vector((0,-.015,-.05))
  ell('DrinkLid',(.073,.073,.014),loc=p+Vector((0,-.015,.14)),mat=mat('CupLid','#f0e5ce'))
  tube('Straw',[p+Vector((0,-.015,.14)),p+Vector((0,-.015,.33))],[.006,.006],n=1,mat=mat('Straw','#2d2926'))

def render(cid):
 G.setup_preview();scene=bpy.context.scene;scene.view_settings.exposure=-.7
 for ob in bpy.data.collections[G.PREVIEW].objects:
  if ob.type=='LIGHT':ob.data.energy*=.7
 scene.render.resolution_x=520;scene.render.resolution_y=700;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
 direction=Vector((.36,-1,.12)).normalized();target=Vector((-.07,0,1.24))
 data=bpy.data.cameras.new('PreviewCamera');data.type='ORTHO';data.ortho_scale=3.05
 cam=bpy.data.objects.new('PreviewCamera',data);bpy.data.collections[G.PREVIEW].objects.link(cam)
 cam.location=target+direction*8;cam.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler();scene.camera=cam
 path=os.path.join(OUT,cid+'.png');scene.render.filepath=path;bpy.ops.render.render(write_still=True)
 image=bpy.data.images.load(path,check_existing=False);w,h=image.size
 arr=np.empty(w*h*4,np.float32);image.pixels.foreach_get(arr);arr=arr.reshape(h,w,4)
 pink=np.array([*G.hex_rgb(G.BACKDROP),1],np.float32);arr=arr*arr[...,3:]+pink*(1-arr[...,3:]);arr[...,3]=1
 image.pixels.foreach_set(arr.ravel());image.save();bpy.data.images.remove(image)
 return arr

def build_all():
 tiles=[];report=[]
 for cid,cfg in CONFIG.items():
  if cid=='taike':continue
  random.seed(31);G.reset()
  pivot,skin,hair=head(cfg);_,_,poses=outfit(cid,cfg,skin)
  props(cid,cfg,pivot,skin,poses);pivot.rotation_euler=(.025,cfg['tilt'],.06 if cid=='chief' else -.035)
  bpy.context.view_layer.update()
  pivot.name='head_pivot'
  # Pose-preserving leg pivots for the app's existing walk cycle.
  footwear=('TrouserLeg','BareCalf','Shoe','Sole','Foot','BlueWhiteSole','FlipFlopStrap','Velcro','ShoeFlower','DenimKneeRip','FrayedThread')
  for s,side in [(-1,'R'),(1,'L')]:
   hip=bpy.data.objects.new('hip_'+side,None);bpy.data.collections[G.COL].objects.link(hip);hip.location=(s*.16,0,.78)
   bpy.context.view_layer.update()
   for ob in list(bpy.data.collections[G.COL].objects):
    if ob.type=='MESH' and ob.name.startswith(footwear) and ob.matrix_world.translation.x*s>0:
     mw=ob.matrix_world.copy();ob.parent=hip;ob.matrix_world=mw
  if cid=='kid':
   root=bpy.data.objects.new('ChildScale',None);bpy.data.collections[G.COL].objects.link(root)
   for ob in list(bpy.data.collections[G.COL].objects):
    if ob!=root and ob.parent is None:
     mw=ob.matrix_world.copy();ob.parent=root;ob.matrix_world=mw
   root.scale=(.82,.82,.82)
   bpy.context.view_layer.update()
  # Pack textures so each Blender file is portable.
  for image in bpy.data.images:
   if image.source=='FILE' and image.users:image.pack()
  bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,cid+'.blend'))
  for ob in bpy.context.view_layer.objects:ob.select_set(False)
  for ob in bpy.data.collections[G.COL].objects:ob.select_set(True)
  bpy.context.view_layer.objects.active=pivot
  bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,cid+'.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=False)
  triangles=G.triangle_count();report.append(dict(id=cid,triangles=triangles))
  tiles.append(render(cid));print('CHARACTER_READY',cid,triangles,flush=True)
 original_bajiu=bpy.data.images.load(os.path.join(os.path.dirname(OUT),'bajiu','preview.png'),check_existing=False)
 original_bajiu.scale(520,700);original_tile=np.empty(520*700*4,np.float32);original_bajiu.pixels.foreach_get(original_tile);tiles.append(original_tile.reshape(700,520,4));bpy.data.images.remove(original_bajiu)
 dama_image=bpy.data.images.load(os.path.join(os.path.dirname(OUT),'dama-character','dama_three_quarter.png'),check_existing=False)
 dama_image.scale(520,700);dama_tile=np.empty(520*700*4,np.float32);dama_image.pixels.foreach_get(dama_tile);tiles.append(dama_tile.reshape(700,520,4));bpy.data.images.remove(dama_image)
 sheet=np.concatenate([np.concatenate(tiles[:4],axis=1),np.concatenate(tiles[4:],axis=1)],axis=0)
 image=bpy.data.images.new('AllCharacters',sheet.shape[1],sheet.shape[0],alpha=False);image.pixels.foreach_set(sheet.ravel());image.filepath_raw=os.path.join(OUT,'all-characters.png');image.file_format='PNG';image.save()
 with open(os.path.join(OUT,'build-report.json'),'w',encoding='utf-8') as f:json.dump(report,f,indent=2)
 print('ALL_CHARACTERS_READY',flush=True)

if __name__=='__main__':build_all()
