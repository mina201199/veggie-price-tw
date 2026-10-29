const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const T = require('./vendor/three.min.js');
const ctx = { window: {}, Math };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/cat-kit.js', 'utf8'), ctx);
const Kit = ctx.window.CatKit;
assert.equal(typeof Kit.create, 'function');
assert.equal(Kit.styles.map(s => s.id).join(), 'blackcat,mochi,ginger');
assert.equal(Kit.styles.map(s => s.name).join(), '歐巴,波妞,小橘');
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

// A style override previews new colours on one cat without touching the shared style.
const hexes = cat => { const s = new Set(); cat.root.traverse(o => { if (o.isMesh && o.material.color) s.add(o.material.color.getHexString()); }); return s; };
const preview = Kit.create(T, 'mochi', { shells: 4, style: { pupil: '#11130F', whisker: '#F6F2EA', palette: { white: '#F7F3EA', shade: '#E8E2D9', grey: '#B8B3B0', light: '#D5D1CD', dark: '#686361' } } });
assert.ok(hexes(preview).has('11130f') && hexes(preview).has('f6f2ea'), 'override reaches the pupils and whiskers');
preview.root.traverse(o => { if (o.isInstancedMesh) assert.ok([...o.geometry.attributes.color.array].every(c => Number.isFinite(c) && c >= 0 && c <= 1.2), 'preview fur colours finite'); });
assert.ok(!hexes(Kit.create(T, 'mochi', { shells: 4 })).has('11130f'), 'the shared mochi style is unchanged');
// whiteGain lifts 波妞's white fur a little past 1 so it still reads as white after tone mapping; colours stay within budget.
const bright = Kit.create(T, 'mochi', { shells: 4, style: { whiteGain: 1.12, palette: { white: '#FFFFFF', grey: '#B8B3B0', dark: '#686361' } } });
let top = 0;
bright.root.traverse(o => { if (o.isInstancedMesh) for (const c of o.geometry.attributes.color.array) { assert.ok(c <= 1.2, 'gain stays within the colour budget'); top = Math.max(top, c); } });
assert.ok(top > 1.05, `white gain brightens the white fur (max ${top})`);
// palette.belly: a pink patch on the underside, only where the fur faces the floor (seen when she rolls over).
const pinkish = cat => { let n = 0; cat.root.traverse(o => { if (!o.isInstancedMesh) return; const a = o.geometry.attributes.color.array; for (let i = 0; i < a.length; i += 3) if (a[i] - a[i + 1] > .15) n++; }); return n; };
const pink = Kit.create(T, 'mochi', { shells: 4, style: { palette: { white: '#FFFFFF', grey: '#B8B3B0', dark: '#686361', belly: '#EFA3A0' } } });
assert.ok(pinkish(pink) > 50, `pink belly patch (${pinkish(pink)} pink vertices)`);
assert.equal(pinkish(Kit.create(T, 'blackcat', { shells: 4 })), 0, 'no pink without palette.belly');
// style.eye: rounder pupils and eyes turned further forward, so they read as circles from the front.
const pupilShape = cat => { let r = null; cat.root.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHexString() === '07080b') { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; r = (b.max.x - b.min.x) / (b.max.y - b.min.y); } }); return r; };
const eyeYaw = cat => { let q = null; cat.root.traverse(o => { if (!q && o.isGroup && o.children.some(m => m.isMesh && m.material.color && m.material.color.getHexString() === '07080b')) q = Math.abs(new T.Euler().setFromQuaternion(o.quaternion, 'YXZ').y); }); return q; };
const roundEyes = Kit.create(T, 'blackcat', { shells: 4, style: { eye: { pupil: [.082, .086], forward: 1 } } }), usual = Kit.create(T, 'blackcat', { shells: 4 });
assert.ok(pupilShape(roundEyes) > .93 && pupilShape(usual) < .8, `rounder pupil (${pupilShape(roundEyes)} vs ${pupilShape(usual)})`);
assert.ok(eyeYaw(roundEyes) < eyeYaw(usual) - .05, `eyes face further forward (${eyeYaw(roundEyes)} vs ${eyeYaw(usual)})`);
// 波妞 as agreed on 2026-10-08: the user's fur colours, the whitest white, a pink tummy, round pupils, today's eye colours.
const bonnie = Kit.create(T, 'mochi', { shells: 4 });
assert.ok(pinkish(bonnie) > 50, '波妞 has a pink tummy');
assert.ok(pupilShape(bonnie) > .93, '波妞 has round pupils');
let brightest = 0;
bonnie.root.traverse(o => { if (o.isInstancedMesh) for (const c of o.geometry.attributes.color.array) brightest = Math.max(brightest, c); });
assert.ok(brightest > 1.05, '波妞 white fur is lifted past pure white');
for (const hex of ['efa3a0', 'ebc0bb', 'f6f2ea', 'dfa4a3']) assert.ok(hexes(bonnie).has(hex), `波妞 uses #${hex}`);
// style.brows: a pale tuft above each eye (歐巴's white eyebrows), and white nowhere else.
const browMarks = cat => {
  cat.root.updateMatrixWorld(true);
  let n = 0, short = 0, stray = 0;
  const v = new T.Vector3();
  cat.root.traverse(o => {
    if (!o.isInstancedMesh) return;
    const c = o.geometry.attributes.color.array, m = o.geometry.attributes.furMask.array, p = o.geometry.attributes.position;
    for (let i = 0; i < m.length; i++) if (c[i * 3] > .6 && c[i * 3 + 2] > .6) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (v.y > 1.35 && Math.abs(v.x) < .4 && v.z > .5) { n++; if (m[i] < .8) short++; } else stray++;
    }
  });
  return { n, short, stray };
};
const browed = browMarks(Kit.create(T, 'blackcat', { shells: 2, style: { brows: { color: '#F2EEEA', fur: .03 } } }));
assert.ok(browed.n > 40 && browed.stray === 0, `white brows above the eyes only (${JSON.stringify(browed)})`);
assert.equal(browMarks(Kit.create(T, 'blackcat', { shells: 2, style: { brows: null } })).n, 0, 'no brows without style.brows');
// 歐巴 as agreed on 2026-10-08: two short, sparse brows just a shade lighter than the coat.
const furParts = cat => { let n = 0; cat.root.traverse(o => { if (o.isInstancedMesh) n++; }); return n; };
assert.equal(furParts(Kit.create(T, 'blackcat', { shells: 2 })), furParts(Kit.create(T, 'blackcat', { shells: 2, style: { brows: null } })) + 2, '歐巴 has two brow tufts');
console.log('style override: PASS');
