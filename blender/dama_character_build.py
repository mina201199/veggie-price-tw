"""A separate, expressive market auntie study. Keeps the original Dama untouched."""
import importlib.util
import os
import math
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('dama_base', os.path.join(HERE, 'dama_build.py'))
D = importlib.util.module_from_spec(spec)
spec.loader.exec_module(D)
OUT = os.path.join(os.path.dirname(HERE), 'prototype-3d', 'dama-character')
os.makedirs(OUT, exist_ok=True)
D.G.TEX_DIR = os.path.join(OUT, 'textures')
D.G.PREVIEW_DIR = OUT
D.G.BACKDROP = '#e8e0d5'

def expressive_head():
    skin = D.material('AuntieSkin', D.SKIN, rough=.68)
    rows = [[D.HEAD_C + D.head_offset(D.dir_of(-math.pi + 2*math.pi*j/64, -math.pi/2 + math.pi*i/40)) for j in range(64)] for i in range(41)]
    D.grid('Head', rows, us=[j/64 for j in range(65)], vs=[i/40 for i in range(41)], mat=skin, part='head')
    ivory = D.material('EyeIvory', '#fff5df', rough=.42)
    iris = D.material('BrownIris', '#633c27', rough=.28)
    pupil = D.material('DarkPupil', '#211813', rough=.25)
    brow = D.material('SculptedBrows', '#493027', rough=.8)
    white = D.material('Catchlight', '#ffffff', rough=.18)
    for s in (-1, 1):
        side = 'L' if s>0 else 'R'
        phi, el = s*.34, -.045
        p, n = D.head_frame(phi, el)
        R = Matrix.Rotation(phi, 4, 'Z') @ Matrix.Rotation(-el, 4, 'X')
        c = p+n*.008
        def eye_piece(name, radii, offset, mat):
            return D.ellipsoid(name+'.'+side, radii, matrix=Matrix.Translation(c+(R@Vector((*offset,0))).to_3d())@R, mat=mat, part='head')
        eye_piece('EyeWhite', (.086,.038,.048), (0,0,0), ivory)
        eye_piece('Iris', (.026,.012,.034), (-.024,-.034,-.003), iris)
        eye_piece('Pupil', (.014,.007,.024), (-.025,-.046,-.003), pupil)
        eye_piece('EyeSpark', (.007,.004,.008), (-.032,-.054,.012), white)
        # Heavy upper lids, one eye narrowed further: an appraising sideways glance.
        eye_piece('UpperLid', (.093,.040,.029), (0,-.002,.038 if s<0 else .025), skin)
        eye_piece('LowerLid', (.087,.029,.014), (0,-.002,-.044), skin)
        path=[]
        for ph, elevation in [(s*.15,.16),(s*.28,.20 if s<0 else .12),(s*.43,.18 if s<0 else .10),(s*.52,.13 if s<0 else .09)]:
            bp,bn=D.head_frame(ph,elevation)
            path.append(bp+bn*.019)
        D.tube('RaisedBrow.'+side,path,[.013,.021,.019,.009],n=5,seg=10,mat=brow,part='head')
        # Small cheek folds visible just above the mask, without painted linework.
        path=[]
        for ph,elevation in [(s*.51,-.10),(s*.57,-.135),(s*.62,-.16)]:
            bp,bn=D.head_frame(ph,elevation);path.append(bp+bn*.005)
        D.tube('CheekFold.'+side,path,[.008,.010,.004],n=4,seg=8,mat=skin,part='head')

def build():
    D.G.reset()
    expressive_head()
    D.build_mask();D.build_hair();D.build_helmet();D.build_body();D.build_bag()
    jacket=bpy.data.materials['Jacket']
    for s in (-1,1):
        D.ellipsoid('SoftShoulder.'+str(s),(.12,.115,.105),loc=(s*.245,0,.855),mat=jacket)
    hair=bpy.data.objects['Hair']
    for modifier in list(hair.modifiers):
        if modifier.type=='DISPLACE':hair.modifiers.remove(modifier)
    polish=hair.modifiers.new('RoundedCurls','SUBSURF');polish.levels=1;polish.render_levels=1
    root=D.assemble()
    col=bpy.data.collections[D.COL]
    # Longer body and broader belly, with a compact head like the Bajiu figure.
    body=Matrix.Diagonal(Vector((1.16,1.10,1.55,1)))
    head=Matrix.Translation(Vector((-.065,0,.55))) @ Matrix.Translation(D.HEAD_C) @ Matrix.Diagonal(Vector((.88,.88,.88,1))) @ Matrix.Translation(-D.HEAD_C)
    pivot=bpy.data.objects['head_pivot'];pivot.rotation_euler=(.06,0,0)
    bpy.context.view_layer.update()
    meshes=[o for o in col.all_objects if o.type=='MESH']
    for ob in meshes:
        mw=ob.matrix_world.copy();ob.parent=None;ob.matrix_world=(head if ob.get('part')=='head' else body)@mw
    for ob in list(col.objects):
        if ob.type=='EMPTY':bpy.data.objects.remove(ob,do_unlink=True)
    root=bpy.data.objects.new('DamaCharacter',None);col.objects.link(root)
    head_pivot=bpy.data.objects.new('AppraisingHead',None);col.objects.link(head_pivot)
    head_pivot.location=(-.065,0,1.83)
    bpy.context.view_layer.update()
    for ob in meshes:
        mw=ob.matrix_world.copy();ob.parent=head_pivot if ob.get('part')=='head' else root;ob.matrix_world=mw
    head_pivot.parent=root
    head_pivot.rotation_euler=(.03,-.12,-.07)
    # A wide, slightly turned-out stance, far more characterful than parallel feet.
    for side,sgn in [('L',1),('R',-1)]:
        pivot=Vector((sgn*.15,0,.03))
        turn=Matrix.Translation(pivot+Vector((sgn*.07,0,0))) @ Matrix.Rotation(sgn*-.20,4,'Z') @ Matrix.Translation(-pivot)
        for name in ('Leg','Shoe','Sole'):
            ob=bpy.data.objects[name+'.'+side];ob.matrix_world=turn@ob.matrix_world
    for ob in meshes:
        if ob.get('part')=='bag':
            # A stuffed shopping bag and a deliberately tall, fanned bundle of scallions.
            center=Vector((.46,-.30,.55))
            ob.matrix_world=Matrix.Translation(center)@Matrix.Diagonal(Vector((1.16,1.16,1.06,1)))@Matrix.Translation(-center)@ob.matrix_world
    bpy.context.view_layer.update()
    head_pivot.name='head_pivot'
    for s,side in [(-1,'R'),(1,'L')]:
        hip=bpy.data.objects.new('hip_'+side,None);col.objects.link(hip);hip.location=(s*.16,0,.74);hip.parent=root
        bpy.context.view_layer.update()
        for ob in meshes:
            if ob.name in ('Leg.'+side,'Shoe.'+side,'Sole.'+side):
                mw=ob.matrix_world.copy();ob.parent=hip;ob.matrix_world=mw
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'dama-character.blend'))
    for ob in bpy.context.view_layer.objects:ob.select_set(False)
    for ob in meshes:ob.select_set(True)
    for ob in col.objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'dama-character.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_animations=False)
    D.VIEWS.update({'front':((0,-1,.04),(0,0,1.24),3.05),'side':((1,0,.04),(0,0,1.24),3.05),'three_quarter':((.55,-1,.12),(0,0,1.24),3.1),'face':((0,-1,.03),(-.065,0,1.80),1.22)})
    original_preview=D.G.setup_preview
    def soft_preview():
        original_preview()
        bpy.context.scene.view_settings.exposure=-.8
        for ob in bpy.data.collections[D.PREVIEW].objects:
            if ob.type=='LIGHT':ob.data.energy*=.7
    D.G.setup_preview=soft_preview
    print(D.render_previews(views=('front','three_quarter','side'),size=(600,800),sheet='character-sheet'))
    print(D.render_previews(views=('face',),size=(700,700),sheet='character-face'))
    print('MODEL_READY',len(meshes),'meshes')

if __name__=='__main__':build()
