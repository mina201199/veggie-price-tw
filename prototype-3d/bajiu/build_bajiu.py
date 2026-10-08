import bpy, math, random, json, base64
from pathlib import Path
from mathutils import Vector
P=Path(__file__).parent; random.seed(89)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.55,tex=None):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
 if tex:
  t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(P/tex));t.image.pack();m.node_tree.links.new(t.outputs['Color'],b.inputs['Base Color'])
 return m
skin=mat('Warm skin',(.69,.38,.19),rough=.43);skinlight=mat('Skin highlights',(.76,.46,.25),rough=.43);hair=mat('Black bowl haircut',(.018,.015,.014),rough=.46);strand=mat('Hair ridges',(.033,.028,.025),rough=.4)
shirt=mat('Charcoal cotton',(.022,.022,.024),rough=.92);seam=mat('Cotton seams',(.04,.04,.042),rough=.85)
denim=mat('Washed indigo denim',(.1,.2,.35),rough=.9,tex='denim.png');stitch=mat('Denim stitching',(.26,.28,.24));fray=mat('White denim fraying',(.69,.72,.72))
gold=mat('Gold chain',(.83,.52,.13),metal=.8,rough=.23);sole=mat('Blue rubber',(.018,.054,.13),rough=.78);strap=mat('Blue straps',(.032,.12,.25),rough=.65)
white=mat('Eye whites',(.89,.82,.68));iris=mat('Brown irises',(.105,.052,.019));black=mat('Pupils',(.008,.005,.003));lip=mat('Lips',(.40,.19,.1));tattoo=[mat('Dragon sleeve',(.6,.45,.3),tex='dragon.png'),mat('Koi sleeve',(.6,.45,.3),tex='koi.png')]
model=[]
def finish(o,name,m):
 o.name=name;o.data.materials.append(m);model.append(o)
 if o.type=='MESH':
  for f in o.data.polygons:f.use_smooth=True
 return o

def ell(name,loc,scale,m,seg=40):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=24,location=loc);o=bpy.context.object;o.scale=scale;return finish(o,name,m)
def curve(name,pts,r,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=4;c.bevel_depth=r;c.bevel_resolution=2
 s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for b,p in zip(s.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);return finish(o,name,m)
def loft(name,rings,m,N=48):
 vs=[];faces=[]
 for x,y,z,rx,ry in rings:
  for i in range(N):a=i*math.tau/N;vs.append((x+rx*math.cos(a),y+ry*math.sin(a),z))
 for j in range(len(rings)-1):
  for i in range(N):faces.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
 faces += [tuple(reversed(range(N))),tuple((len(rings)-1)*N+i for i in range(N))]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,m)
 uv=mesh.uv_layers.new()
 for poly in mesh.polygons:
  for li in poly.loop_indices:
   idx=mesh.loops[li].vertex_index;i=idx%N;j=idx//N
   u=i/N
   if i==0 and any(mesh.loops[l].vertex_index%N==N-1 for l in poly.loop_indices):u=1
   uv.data[li].uv=(u,j/(len(rings)-1))
 if name in ['Fitted shirt','Rolled T-shirt sleeve','Head sculpt','Color tattoo sleeve','Slim jeans leg','Rolled denim cuff','Sleeve hem']:
  sub=o.modifiers.new('Soft cloth silhouette','SUBSURF');sub.levels=2;sub.render_levels=2
 return o
# front faces toward negative Y; 4.7 head proportions
loft('Fitted shirt',[(0,0,1.87,.415,.22),(0,-.014,2.0,.485,.265),(0,-.040,2.22,.535,.29),(0,-.014,2.50,.50,.27),(0,0,2.65,.47,.25),(0,0,2.76,.42,.235),(0,0,2.83,.30,.20),(0,0,2.87,.18,.165)],shirt)
loft('Neck',[(0,0,2.76,.17,.15),(0,0,3.08,.18,.155)],skin)
ell('Pelvis',(0,0,1.84),(.43,.245,.28),denim)
for side in [-1,1]:
 x=side*.245
 loft('Slim jeans leg',[(x,0,.18,.125,.13),(x,0,.28,.14,.15),(x,0,.48,.135,.15),(x,0,.73,.155,.16),(x,-.025,.97,.16,.17),(x,-.035,1.11,.175,.185),(x,0,1.4,.20,.21),(x,0,1.72,.215,.23),(x,0,1.90,.21,.21)],denim)
 # fitted cuff and seam
 loft('Rolled denim cuff',[(x,0,.18,.13,.14),(x,0,.25,.143,.15),(x,0,.29,.14,.15)],denim)
 for y in [-.148,.14]:curve('Leg seam',[(x+side*.09,y,.3),(x+side*.13,y,.8),(x+side*.16,y,1.4),(x+side*.16,y,1.85)],.005,stitch)
 # ripped knees: exposed skin opening surrounded by white fray
 ell('Knee rip border',(x,-.194,1.04),(.143,.012,.072),fray)
 ell('Exposed knee',(x,-.21,1.04),(.124,.014,.045),skin)
 for j in range(13):
  xx=x-.13+j*.021
  curve('Rip fibers',[(xx,-.217,1.092),(xx+.014,-.221,1.063),(xx+.026,-.219,1.079)],.0025,fray)
 for j in range(4):curve('Knee threads',[(x-.11,-.227,1.017+j*.015),(x+.11,-.225,1.02+j*.015)],.0015,fray)
 for z,w in [(1.58,.095),(.69,.055)]:
  ell('Denim distress',(x+side*.03,-.22 if z>1 else -.167,z),(w,.008,.023),fray)
 # shirt sleeve and skin arm
 loft('Rolled T-shirt sleeve',[(side*.51,0,2.48,.175,.19),(side*.51,0,2.54,.188,.195),(side*.49,0,2.65,.19,.20),(side*.46,0,2.75,.14,.16),(side*.43,0,2.79,.055,.085)],shirt)
 loft('Sleeve hem',[(side*.51,0,2.475,.179,.196),(side*.51,0,2.53,.184,.198)],seam)
 loft('Color tattoo sleeve',[(side*.64,-.01,1.65,.084,.082),(side*.66,0,1.79,.105,.09),(side*.64,0,2.03,.12,.11),(side*.60,0,2.16,.115,.115),(side*.56,0,2.39,.135,.145),(side*.53,0,2.49,.146,.156)],tattoo[0 if side<0 else 1])
 ell('Tattoo hand',(side*.645,-.012,1.56),(.103,.075,.15),tattoo[0 if side<0 else 1])
 for f in range(4):
  xx=side*.645+(f-1.5)*.044;z=1.40+(abs(f-1.5)*.022)
  ell('Individual finger',(xx,-.013,z),(.023,.048,.095),skin,24)
  curve('Knuckle line',[(xx-.014,-.059,z+.035),(xx+.014,-.06,z+.035)],.0017,lip)
 ell('Thumb',(side*.54,-.045,1.53),(.04,.051,.09),skin,24)
 # feet and flip-flops
 ell('Rubber flip-flop sole',(x,-.07,.057),(.18,.32,.051),sole)
 ell('Foot',(x,-.06,.13),(.14,.245,.08),skinlight)
 for f in range(5):
  xx=x+side*(f-2)*.047
  ell('Toe',(xx,-.263+(f*.014),.121),(.031 if f else .039,.059,.04),skinlight,24)
 curve('Flip-flop left strap',[(x-.143,-.018,.16),(x-.03,-.20,.18),(x,-.238,.153)],.024,strap)
 curve('Flip-flop right strap',[(x+.143,-.015,.16),(x+.03,-.20,.18),(x,-.238,.153)],.024,strap)
 # back pockets and frontal pocket arcs
 curve('Back pocket',[(x-.10,.22,1.85),(x-.095,.238,1.64),(x,.242,1.60),(x+.1,.232,1.65),(x+.10,.22,1.85)],.006,stitch)
 curve('Front pocket',[(x+side*.15,-.17,1.9),(x+side*.10,-.233,1.81),(x,-.241,1.78)],.006,stitch)
curve('Jeans fly',[(0,-.249,1.95),(.025,-.253,1.82),(.02,-.25,1.67)],.005,stitch)
ell('Jeans button',(0,-.259,1.96),(.018,.01,.018),gold,24)
for x in [-.32,-.17,.17,.32]:curve('Belt loop',[(x,-.222,1.94),(x,-.23,1.85)],.012,denim)
# expressive face with a tapered jaw
loft('Head sculpt',[(0,-.045,2.94,.13,.12),(0,-.052,3.00,.23,.18),(0,-.025,3.12,.30,.235),(0,0,3.26,.355,.276),(0,.005,3.44,.38,.293),(0,.018,3.60,.36,.277),(0,.025,3.73,.28,.215),(0,.028,3.80,.07,.06)],skinlight,64)
for s in [-1,1]:
 ell('Ear',(s*.369,.015,3.31),(.064,.053,.10),skin)
 ell('Ear inner',(s*.401,-.03,3.31),(.025,.021,.065),skinlight)
 # narrowed eyes, irises and upper eyelid
 ell('Eye white',(s*.145,-.272,3.415),(.09,.029,.043),white)
 ell('Brown iris',(s*.137,-.296,3.414),(.032,.011,.032),iris,32)
 ell('Pupil',(s*.135,-.306,3.414),(.014,.004,.023),black,24)
 ell('Eye glint',(s*.13-.009,-.31,3.426),(.006,.003,.006),white,16)
 curve('Upper eyelid',[(s*.052,-.281,3.426),(s*.142,-.301,3.45),(s*.23,-.258,3.437)],.01,hair)
 curve('Brow',[(s*.06,-.27,3.508),(s*.14,-.278,3.527),(s*.235,-.243,3.50)],.023,hair)
 curve('Lower eyelid',[(s*.075,-.286,3.395),(s*.14,-.304,3.385),(s*.213,-.271,3.403)],.0035,lip)
ell('Nose bridge',(0,-.281,3.33),(.046,.043,.092),skinlight)
ell('Nose tip',(0,-.326,3.283),(.067,.053,.033),skinlight)
for s in [-1,1]:ell('Nostril',(s*.047,-.352,3.27),(.013,.008,.008),lip,24)
curve('Smirk',[(-.108,-.262,3.168),(-.04,-.291,3.164),(.032,-.29,3.163),(.11,-.262,3.187)],.006,lip)
curve('Lower lip',[(-.065,-.285,3.143),(0,-.294,3.135),(.062,-.283,3.146)],.006,skin)
# Dense smooth bowl silhouette with subtle broad locks, no raised wire strands
ell('Undercut',(0,.055,3.52),(.375,.30,.27),hair)
vs=[];fs=[];N=128;R=32
for j in range(R+1):
 for i in range(N):
  a=i*math.tau/N;front=max(0,-math.sin(a));phi=.003+(j/R)*(1.72+.24*(1-front))
  z=3.61+.30*math.cos(phi)-.027*front*(j/R)**8
  ripple=1+.0018*math.cos(a*22)*(j/R)**2
  vs.append((.422*math.sin(phi)*math.cos(a)*ripple,.03+.343*math.sin(phi)*math.sin(a)*ripple,z))
for j in range(R):
 for i in range(N):fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
# thickness closes the fringe and avoids thin helmet edges
for i in range(N):
 x,y,z=vs[R*N+i];vs.append((x*.962,.03+(y-.03)*.962,z+.025))
for i in range(N):fs.append((R*N+i,R*N+(i+1)%N,(R+1)*N+(i+1)%N,(R+1)*N+i))
me=bpy.data.meshes.new('Dense bowl haircut');me.from_pydata(vs,[],[tuple(reversed(f)) for f in fs]);me.update();o=bpy.data.objects.new('Dense bowl haircut',me);bpy.context.collection.objects.link(o);finish(o,'Dense bowl haircut',hair)
# interlocking heavy gold necklace
for i in range(38):
 a=i*math.tau/38;x=.29*math.cos(a);y=.298*math.sin(a);z=2.89-.255*max(0,-math.sin(a))
 pts=[]
 for j in range(13):
  b=j*math.tau/12;pts.append((x+.043*math.cos(b),y+.017*math.sin(b)*(1 if i%2 else .2),z+.031*math.sin(b)))
 curve('Gold curb link',pts,.0105,gold)
curve('Left hoop earring',[(-.403,-.012+.037*math.sin(j*math.tau/16),3.235+.046*math.cos(j*math.tau/16)) for j in range(17)],.008,gold)
# Bake smooth geometry before a continuous chibi proportion adjustment.
# Legs / torso are shorter; the head is wider and fuller. Hands retain readable fingers.
for obj in model:
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 for v in obj.data.vertices:
  z=v.co.z
  # Rounded oval chest, belly and hips; all Z coordinates remain unchanged.
  bulk=math.exp(-((z-2.13)/.76)**2)*max(0,min(1,(2.94-z)/.32))
  v.co.y*=1+.75*bulk;v.co.x*=1+.11*bulk
  blend=max(0,min(1,(z-2.78)/.22));v.co.x*=1.035+.205*blend;v.co.y*=1+.15*blend
  # Shorten legs by 26% above the ankle, transfer the height to the torso.
  # The head and total stature keep their existing height.
  zz=z
  if .20<z<=1.90:zz=.20+(z-.20)*.74
  elif 1.90<z<2.94:zz=z-.442*(2.94-z)/1.04
  v.co.z=zz*.82 if z<=2.94 else 2.94*.82+(z-2.94)*1.24
 for poly in obj.data.polygons:poly.use_smooth=True
 obj.data.update()
# exports only the character, no studio
bpy.ops.object.select_all(action='DESELECT')
for o in model:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(P/'bajiu.glb'),use_selection=True,export_format='GLB',export_apply=True,export_yup=True)
# Inline the exact GLB for file:// previews and the shared character entry.
(P/'glb-data.js').write_text('window.BAJIU_GLB="'+base64.b64encode((P/'bajiu.glb').read_bytes()).decode()+'";\n',encoding='utf8')
# studio lights and renders
floor=mat('Studio ivory',(.78,.73,.66),rough=1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005));bpy.context.object.data.materials.append(floor)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.65,.59,.51,1);scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.6
for loc,power,size in [((-3,-4,7),600,5),((4,-1,5),400,4),((0,4,6),650,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(5,-9,4.1));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=4.35;scene.camera=cam
scene.render.resolution_x=720;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
for name,loc in [('preview',(4,-9,3.8)),('front',(0,-10,3.1)),('side',(10,0,3.1)),('back',(0,10,3.1))]:
 cam.location=loc;cam.rotation_euler=(Vector((0,0,1.81))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(P/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(P/'bajiu.blend'))
print('BAJIU_OK',len(model),'objects',len(model),'exported parts')
