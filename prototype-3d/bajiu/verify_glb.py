import bpy,json,struct
from pathlib import Path
p=Path(__file__).parent
b=p.joinpath('bajiu.glb').read_bytes();magic,version,length=struct.unpack_from('<4sII',b);assert magic==b'glTF' and version==2 and length==len(b)
n,t=struct.unpack_from('<II',b,12);j=json.loads(b[20:20+n]);assert len(j['images'])==3 and all('bufferView' in x for x in j['images'])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=str(p/'bajiu.glb'));meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)>150; assert any("Dense bowl haircut" in o.name for o in meshes); assert not any("Hair strand" in o.name for o in meshes)
assert not j.get('skins')
print('GLB_VERIFIED',len(meshes),'meshes',len(j['images']),'embedded textures',round(len(b)/1048576,2),'MB')
