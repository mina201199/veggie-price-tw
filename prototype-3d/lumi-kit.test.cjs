const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const T = require('./vendor/three.min.js');
const ctx = { window: {}, Math };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/lumi-kit.js', 'utf8'), ctx);
const Kit = ctx.window.LumiKit;
// Hana comes in all three sheet styles; Lumi only as the app mascot.
const HEIGHT = { chibi: [1.9, 2.3], mascot: [2.5, 2.9], semi: [2.5, 2.9] };
for (const [look, style] of [['lumi', 'mascot'], ['hana', 'chibi'], ['hana', 'mascot'], ['hana', 'semi']]) {
  const girl = Kit.create(T, { look, style }), [lo, hi] = HEIGHT[style];
  assert.equal(girl.style, style);
  let tris = 0;
  girl.root.traverse(o => {
    if (!o.isMesh) return;
    assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite), `${look}: finite geometry`);
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  for (const pose of girl.poses) {
    girl.setPose(pose);
    for (let i = 0; i < 150; i++) girl.update(1 / 30, {});
    girl.root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(girl.root);
    console.log(look, style, pose, 'minY', box.min.y.toFixed(3), 'maxY', box.max.y.toFixed(3));
    assert.ok(box.min.y > -.05 && box.min.y < .03, `${look} ${style} ${pose}: feet on the floor (minY ${box.min.y})`);
    assert.ok(box.max.y > lo && box.max.y < hi, `${look} ${style} ${pose}: height ${box.max.y}`);
  }
  // Walking moves the legs and keeps her grounded.
  girl.setPose('idle');
  let minY = 9;
  for (let i = 0; i < 90; i++) { girl.update(1 / 30, { speed: 1.4 }); girl.root.updateMatrixWorld(true); minY = Math.min(minY, new T.Box3().setFromObject(girl.root).min.y); }
  assert.ok(minY > -.06, `${look} ${style}: walk keeps feet above the floor`);
  console.log(look, style, Math.round(tris), 'triangles: PASS');
}
// An unknown look falls back to Lumi, an unknown style to the mascot.
assert.equal(Kit.create(T, { look: 'nobody' }).root.name, 'lumi');
assert.equal(Kit.create(T, { look: 'hana', style: 'nobody' }).style, 'mascot');
