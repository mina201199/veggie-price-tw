const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const T = require('./vendor/three.min.js');
const ctx = { window: {}, Math };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/cat-kit.js', 'utf8'), ctx);
const Kit = ctx.window.CatKit;
assert.equal(typeof Kit.create, 'function');
assert.equal(Kit.styles.map(s => s.id).join(), 'blackcat,mochi');
for (const { id } of Kit.styles) {
  const cat = Kit.create(T, id, { shells: 12 });
  let tris = 0, furParts = 0;
  cat.root.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    assert.ok([...pos.array].every(Number.isFinite), 'finite positions');
    if (o.isInstancedMesh) {
      furParts++;
      const mask = o.geometry.attributes.furMask, col = o.geometry.attributes.color;
      assert.ok(mask && [...mask.array].every(m => m >= 0 && m <= 1), 'fur mask in 0..1');
      assert.ok([...col.array].every(c => Number.isFinite(c) && c >= 0 && c <= 1.2), 'colours finite');
      tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3 * o.count;
    } else tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
  });
  // Every pose keeps the kitten on the floor and roughly upright in size.
  for (const state of ['stand', 'sit', 'roll']) {
    cat.setState(state);
    for (let i = 0; i < 120; i++) cat.update(1 / 30, {});
    cat.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(cat.root);
    console.log(id, state, 'minY', box.min.y.toFixed(3), 'maxY', box.max.y.toFixed(3), 'z', box.min.z.toFixed(2), box.max.z.toFixed(2));
    assert.ok(box.min.y > -0.2 && box.min.y < 0.12, `${id} ${state} should rest on the floor (minY ${box.min.y})`);
    assert.ok(box.max.y < 2.4, 'height budget');
  }
  // Walking cycles the legs.
  cat.setState('stand');
  const before = cat.arms[0].rotation.x;
  for (let i = 0; i < 10; i++) cat.update(1 / 30, { speed: 1.4 });
  assert.notEqual(cat.arms[0].rotation.x, before);
  console.log(id, furParts, 'fur parts,', Math.round(tris), 'triangles @12 shells: PASS');
}
