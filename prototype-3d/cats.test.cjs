const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const T = require('./vendor/three.min.js');
const ctx = { window: {}, Math };
vm.createContext(ctx);
for (const f of ['cat-kit.js', 'cats.js']) vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8'), ctx);
assert.equal(typeof ctx.window.createCityCat, 'function');
assert.equal(ctx.window.cityCatStyles.map(s => s.name).join(), '歐巴,波妞');
for (const s of ctx.window.cityCatStyles) {
  const c = ctx.window.createCityCat(T, s);
  // The wardrobe moves root.children into the avatar, so the CatKit rig must be the single child.
  assert.equal(c.root.children.length, 1);
  assert.equal(c.root.children[0], c.kit.root);
  // Spare joints absorb the city's biped walk cycle and must stay out of the scene.
  assert.equal(c.arms.length, 2); assert.equal(c.legs.length, 2);
  assert.ok([...c.arms, ...c.legs].every(j => !j.parent));
  c.root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(c.root);
  assert.ok(box.min.y > -.05 && box.min.y < .1, `${s.name} stands on the street (minY ${box.min.y})`);
  assert.ok(box.max.y > 2.2 && box.max.y < 3, `${s.name} is about as tall as the other characters (maxY ${box.max.y})`);
  let proxies = 0;
  c.root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.castShadow) proxies++; });
  assert.ok(proxies > 20, 'fur parts cast shadows in the city through stand-ins');
  // Nested inside a moved, turned avatar, the head still turns toward a target in front of the avatar.
  const avatar = new T.Group(), body = new T.Group();
  avatar.position.set(-1, 0, 9); avatar.rotation.y = Math.PI; avatar.add(body); body.add(c.kit.root);
  avatar.updateMatrixWorld(true);
  const ahead = new T.Vector3(-1 + 6, 1.5, 9 - 20);  // in front of the avatar and to its left
  for (let i = 0; i < 90; i++) { c.kit.update(1 / 30, { speed: 0, look: ahead }); avatar.updateMatrixWorld(true); }
  const neck = c.kit.root.children[0].children[2];
  assert.ok(Math.abs(neck.rotation.y) > .1 && Math.abs(neck.rotation.y) <= .6, `head turns toward the camera (yaw ${neck.rotation.y})`);
  console.log(s.name, 'PASS');
}
