const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const T = require('./vendor/three.min.js');
const context = { window: {} };
vm.createContext(context);
if (fs.existsSync(__dirname + '/dolls.js')) vm.runInContext(fs.readFileSync(__dirname + '/dolls.js','utf8'),context);
assert.equal(typeof context.window.createCityDoll, 'function', 'New dolls must provide the wardrobe-compatible model builder');
for (const style of context.window.cityDollStyles) {
  const doll = context.window.createCityDoll(T, style);
  assert.equal(doll.arms.length, 2);
  assert.equal(doll.legs.length, 2);
  for(const limb of [...doll.arms,...doll.legs]) assert.equal(limb.parent,doll.root,'Walking joints must remain direct body children');
  const bounds = new T.Box3().setFromObject(doll.root);
  const lowerFaceRay=new T.Raycaster(new T.Vector3(.1,2.3,2),new T.Vector3(0,0,-1));
  assert.ok(lowerFaceRay.intersectObject(doll.root,true)[0].point.z<.37,'Lower face must not have a separate protruding muzzle/chin');
  const smileRay=new T.Raycaster(new T.Vector3(0,2.28,2),new T.Vector3(0,0,-1));
  assert.equal(smileRay.intersectObject(doll.root,true)[0].object.material.color.getHexString(),'b86969','Smile must be visible in front of the face, not buried inside the chin');
  for(const x of [-.25,.25]){
    const rearRay=new T.Raycaster(new T.Vector3(x,2.55,-2),new T.Vector3(0,0,1));
    assert.notEqual(rearRay.intersectObject(doll.root,true)[0].object.material.color.getHexString(),safecolor(style.skin),'Both sides of the rear head must be covered with hair');
  }
  assert.ok(bounds.min.y >= -.05 && bounds.max.y < 3.6,'Doll must fit the ground plane and wardrobe camera');
  let triangles=0;
  doll.root.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position;assert.ok([...p.array].every(Number.isFinite));triangles+=(o.geometry.index?.count||p.count)/3;}});
  assert.ok(triangles < 65000,'Keep each doll lightweight enough for this mobile prototype');
  const before=new T.Box3().setFromObject(doll.legs[0]);
  doll.legs[0].rotation.x=.5;
  assert.notEqual(new T.Box3().setFromObject(doll.legs[0]).min.z,before.min.z,'Walking must move the foot');
  console.log(style.id, Math.round(triangles), 'triangles: PASS');
}
function safecolor(value){return new T.Color(value).getHexString();}
