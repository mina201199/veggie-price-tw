const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const T = require('./vendor/three.min.js');
const ctx = { window: {}, Math, console };
vm.createContext(ctx);
for (const f of ['figure-kit.js', 'figure-cast.js']) vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8'), ctx);
const Kit = ctx.window.FigureKit, ids = Object.keys(Kit.cast);
assert.deepEqual(ids, ['grandma', 'chief', 'grandpa', 'auntie', 'uncle', 'housewife', 'kid', 'taike'], 'only the eight approved people are registered');
assert.equal(ids.map(id => Kit.cast[id].name).join(), '買菜阿嬤,里長伯,散步阿公,菜市場大媽,汗衫阿伯,家庭主婦,幼稚園小朋友,八酒');
for (const removed of ['mechanic', 'courier', 'griller', 'cook']) assert.throws(() => Kit.create(T, removed), /no character/, 'removed people cannot be created');
for (const id of ids) {
  const fig = Kit.create(T, id);
  let tris = 0, meshes = 0;
  fig.root.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite), `${id}: finite geometry`);
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
  });
  for (let i = 0; i < 60; i++) fig.update(1 / 30);
  fig.root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(fig.root);
  console.log(id.padEnd(10), fig.name.padEnd(8), 'minY', box.min.y.toFixed(3), 'maxY', box.max.y.toFixed(2), 'w', (box.max.x - box.min.x).toFixed(2), 'meshes', meshes, 'tris', Math.round(tris));
  assert.ok(box.min.y > -.02 && box.min.y < .02, `${id}: stands on the floor (minY ${box.min.y})`);
  assert.ok(box.max.y > 1.6 && box.max.y < 2.9, `${id}: height ${box.max.y}`);
  // Walking in 菜市漫遊 (speed 3.5): the feet stay on the floor and the legs actually move.
  let lowest = 9, hipSwing = 0;
  for (let i = 0; i < 90; i++) {
    fig.update(1 / 30, { speed: 3.5 });
    fig.root.updateMatrixWorld(true);
    lowest = Math.min(lowest, new T.Box3().setFromObject(fig.root).min.y);
  }
  fig.root.traverse(o => { if (o.isGroup && o.parent && o.parent.parent && Math.abs(o.rotation.x) > hipSwing && Math.abs(o.rotation.z) > .01 && Math.abs(o.rotation.z) < .2) hipSwing = Math.abs(o.rotation.x); });
  assert.ok(lowest > -.03, `${id}: walking keeps the feet on the floor (${lowest})`);
  assert.ok(hipSwing > .1, `${id}: legs swing when walking`);
  fig.dispose();
}
console.log('FigureKit: PASS');
