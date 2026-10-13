const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const T = require('./vendor/three.min.js');

// 1. The GLB that blender/grandma_build.py exports has what figure-glb.js drives.
const glb = fs.readFileSync(__dirname + '/models/grandma.glb');
assert.equal(glb.toString('ascii', 0, 4), 'glTF', 'grandma.glb is a binary glTF');
const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
const node = n => json.nodes.find(x => x.name === n), kids = n => (node(n).children || []).map(i => json.nodes[i].name);
assert.deepEqual(json.scenes[0].nodes.map(i => json.nodes[i].name), ['grandma'], 'one root node');
for (const n of ['head_pivot', 'hip_L', 'hip_R', 'shoulder_L', 'shoulder_R', 'trolley']) assert.ok(kids('grandma').includes(n), `grandma -> ${n}`);
assert.ok(kids('hip_L').includes('Leg.L') && kids('hip_L').includes('Shoe.L'), 'left leg and shoe hang off hip_L');
assert.ok(kids('head_pivot').includes('Hair') && kids('head_pivot').includes('Hat'), 'hair and hat ride on the head');
assert.equal(node('Hair').extras.hair, true, 'hair is tagged for FigureLook.fluff');
assert.ok(json.images.length >= 3 && json.images.every(im => im.bufferView !== undefined), 'textures are embedded');
console.log(`grandma.glb: ${(glb.length / 1e6).toFixed(2)} MB, ${json.nodes.length} nodes, ${json.images.length} images`);

// 2. The adapter, with a stand-in loader: a scene shaped like the export (pivots by name), or a failure.
function sceneLike() {
  const box = (w, h, d, y) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d)); m.position.y = y; return m; };
  const g = new T.Group(); g.name = 'grandma';
  g.add(box(.6, .8, .5, .8));
  for (const [n, x] of [['hip_L', .13], ['hip_R', -.13]]) { const p = new T.Group(); p.name = n; p.position.set(x, .4, 0); p.add(box(.2, .4, .2, -.2)); g.add(p); }
  const sh = new T.Group(); sh.name = 'shoulder_L'; sh.position.set(.25, .9, 0); sh.add(box(.1, .4, .1, -.2)); g.add(sh);
  const hp = new T.Group(); hp.name = 'head_pivot'; hp.position.y = 1.0; hp.rotation.x = .07; hp.add(box(.9, .9, .8, .45)); g.add(hp);
  return g;
}
function world(loader) {
  const warns = [], ctx = { window: {}, Math, console: { ...console, warn: (...a) => warns.push(a.join(' ')) } };
  vm.createContext(ctx);
  for (const f of ['figure-kit.js', 'figure-cast.js', 'figure-glb.js']) vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8'), ctx);
  const TT = Object.assign({}, T, loader ? { GLTFLoader: loader } : {});
  return { GLB: ctx.window.FigureGLB, TT, warns };
}
const loads = ok => class { load(url, onLoad, _, onError) { setTimeout(() => ok ? onLoad({ scene: sceneLike() }) : onError(new Error(`404 ${url}`))); } };
const height = r => { r.updateMatrixWorld(true); return new T.Box3().setFromObject(r).max.y; };

(async () => {
  {
    const { GLB, TT, warns } = world(loads(true));
    for (const id of ['grandma', 'chief', 'grandpa', 'auntie', 'uncle', 'housewife', 'kid']) {
      assert.ok(GLB.has(id), `${id} uses the approved Blender model`);
    }
    assert.ok(!GLB.has('taike'), 'Bajiu keeps its original separate loader');
    for (const [id, path] of Object.entries(GLB.models)) {
      const bytes = fs.readFileSync(__dirname + '/' + path);
      const doc = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
      const names = new Set(doc.nodes.map(n => n.name));
      for (const joint of ['hip_L', 'hip_R', 'head_pivot']) assert.ok(names.has(joint), `${id} exports ${joint}`);
      if (id !== 'auntie') assert.ok(!doc.nodes.some(n => /^Cheek(?:\.|-?\d)/.test(n.name)), `${id} has no separate ball cheeks`);
      assert.ok((doc.images || []).every(im => im.bufferView !== undefined), `${id} embeds its textures`);
    }
    const fig = GLB.create(TT, 'grandma', { castShadow: true });
    const before = fig.height();
    assert.ok(before > 1.6, 'the code-built grandma stands in while loading');
    assert.equal(await fig.ready, fig);
    assert.ok(fig.root.getObjectByName('hip_L'), 'the GLB is in');
    assert.ok(Math.abs(fig.height() - before) < .01 * before, `same height after the swap (${before.toFixed(3)} -> ${fig.height().toFixed(3)})`);
    let swing = 0, low = 9;
    for (let i = 0; i < 90; i++) {
      fig.update(1 / 30, { speed: 3.5 });
      swing = Math.max(swing, Math.abs(fig.root.getObjectByName('hip_L').rotation.x));
      low = Math.min(low, new T.Box3().setFromObject(fig.root).min.y);
    }
    assert.ok(swing > .2, `legs swing when walking (${swing.toFixed(2)})`);
    for (let i = 0; i < 60; i++) fig.update(1 / 30, { speed: 0 });
    assert.ok(Math.abs(fig.root.getObjectByName('hip_L').rotation.x) < .02, 'legs settle when she stops');
    let shadows = true;
    fig.root.traverse(o => { if (o.isMesh) shadows = shadows && o.castShadow; });
    assert.ok(shadows, 'GLB meshes cast shadows when asked');
    const twin = GLB.create(TT, 'grandma');
    await twin.ready;
    assert.notEqual(twin.root.getObjectByName('hip_L'), fig.root.getObjectByName('hip_L'), 'each copy animates its own pivots');
    assert.equal(warns.length, 0, warns.join('\n'));
  }
  for (const [label, loader] of [['load fails', loads(false)], ['no GLTFLoader', null]]) {
    const { GLB, TT, warns } = world(loader);
    const fig = GLB.create(TT, 'grandma');
    await fig.ready;
    assert.ok(!fig.root.getObjectByName('hip_L') && height(fig.root) > 1.6, `${label}: the code-built grandma stays`);
    fig.update(1 / 30, { speed: 3.5 });
    assert.equal(warns.length, 1, `${label}: one warning`);
  }
  console.log('FigureGLB: PASS');
})().catch(e => { console.error(e); process.exit(1); });
