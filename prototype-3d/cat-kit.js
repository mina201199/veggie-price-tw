/* CatKit: 烏咪 and Mochi as original, code-built chibi kittens.
   Each furry part is a single InstancedMesh. Instance i is fur shell i: the vertex
   shader pushes it out along the normal, and the fragment shader carves strands
   from 3D cell noise. No external models or image textures.

   const cat = CatKit.create(THREE, 'mochi', { shells: 18, castShadow: false });
   scene.add(cat.root);
   cat.setState('sit' | 'stand' | 'roll');
   cat.update(dt, { speed, look: camera.position });   // every frame */
(function (global) {
  'use strict';

  function smooth(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function hash(x, y, z) {
    const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function noise(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const u = smooth(0, 1, x - ix), v = smooth(0, 1, y - iy), w = smooth(0, 1, z - iz);
    let out = 0;
    for (let k = 0; k < 8; k++) {
      const dx = k & 1, dy = (k >> 1) & 1, dz = (k >> 2) & 1;
      out += hash(ix + dx, iy + dy, iz + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    }
    return out;
  }

  const STYLES = {
    blackcat: {
      id: 'blackcat', name: '烏咪', fullName: '黑貓・烏咪', tagline: '金色大眼・捲捲尾巴', swatch: '#2a2529',
      plump: 1, furScale: 1, density: 92, taper: .85, ao: .3, tip: '#3b3237', sheen: '#a49aa8',
      palette: { base: '#231e22', warm: '#3b302d' },
      earInner: '#b38087', iris: ['#fff1a8', '#f3c64e', '#d99a26', '#7a4c0e'], socket: '#110d0f',
      nose: '#2e2528', mouth: '#0c0a0b', pad: '#80595f', whisker: '#e9e3e6',
      tail: { r: .085, len: .15, segs: 9, fur: .095, plume: .15 },
      color(p, n, region, pal) {
        const c = pal.base.clone().multiplyScalar(.8 + .45 * noise(p.x * 9, p.y * 9, p.z * 9));
        if (region === 'chest' || region === 'cheek') c.lerp(pal.warm, .25);
        return c;
      }
    },
    mochi: {
      id: 'mochi', name: 'Mochi', fullName: 'Mochi・麻糬', tagline: '銀灰虎斑・蓬蓬大尾巴', swatch: '#b4b1b8',
      plump: 1.1, furScale: 1.65, density: 100, taper: .8, ao: .66, tip: '#161616', sheen: '#ffffff',
      palette: { white: '#fbf9f6', grey: '#b1aeb4', dark: '#6f6c76' },
      earInner: '#eeb5b8', iris: ['#e6f2b4', '#b7cf78', '#86a64a', '#3f5520'], socket: '#4a4447',
      nose: '#ec9fa7', mouth: '#a47a7e', pad: '#f2a9b1', whisker: '#ffffff',
      tail: { r: .13, len: .15, segs: 8, fur: .16, plume: .45 },
      ruff: true, earTufts: true,
      // Silver tabby on white, after the Mochi reference sheet: grey cap with dark forehead stripes,
      // grey temples, nape, back, haunches and tail; white blaze, muzzle, bib, legs and paws.
      color(p, n, region, pal) {
        const k = noise(p.x * 6, p.y * 6, p.z * 6), ax = Math.abs(p.x);
        let t = 0, s = 0;
        if (region === 'head') {
          const crown = smooth(1.34, 1.46, p.y);
          const temple = smooth(.26, .4, ax) * smooth(1.12, 1.3, p.y);
          const nape = smooth(.36, .2, p.z) * smooth(.95, 1.15, p.y);
          t = Math.max(crown, temple, nape);
          t *= 1 - (1 - smooth(.035, .09, ax)) * (1 - smooth(1.36, 1.46, p.y)) * .85;  // narrow white bridge between the eyes
          s = Math.max(
            smooth(.5, .85, Math.sin(ax * 30 + .6)) * smooth(1.42, 1.52, p.y) * (1 - smooth(.3, .4, ax)),               // forehead stripes
            smooth(.55, .9, Math.sin(p.y * 34 + 1)) * smooth(.3, .42, ax) * smooth(1.12, 1.2, p.y) * (1 - smooth(1.42, 1.5, p.y)),  // lines back from the eye corners
            smooth(.5, .9, Math.sin(p.y * 22)) * nape * .8);
        } else if (region === 'cheek') {
          t = smooth(1.12, 1.26, p.y) * smooth(.28, .45, ax) * .9;
          s = smooth(.55, .9, Math.sin(p.y * 34 + 1)) * t;
        } else if (region === 'ear') t = .95;
        else if (region === 'body') {
          t = smooth(.52, .74, p.y - Math.max(0, p.z) * .8);  // grey saddle down the flanks, white chest and belly
          s = smooth(.5, .88, Math.sin(p.z * 14 + ax * 5 + k * 2.5));
        } else if (region === 'thigh') {
          t = smooth(.4, .62, p.y) * .95;
          s = smooth(.55, .9, Math.sin(p.y * 18 + p.z * 6 + k * 2));
        } else if (region === 'tail') {
          t = .78 + .15 * k;
          s = smooth(.55, .92, Math.sin(p.y * 13 + k * 2));
        }
        const g = pal.grey.clone().lerp(pal.dark, Math.min(1, s));
        return pal.white.clone().lerp(g, Math.min(1, Math.max(0, t + (k - .5) * .2)));
      }
    }
  };

  const FUR_VERT_HEAD = `
attribute float furMask;
uniform float uFurLen;
uniform float uShells;
uniform vec3 uComb;
varying float vShell;
varying vec3 vBase;
varying float vMask;
`;
  const FUR_VERT = `#include <begin_vertex>
  vShell = float(gl_InstanceID) / max(uShells - 1.0, 1.0);
  vBase = position;
  vMask = furMask;
  float furL = uFurLen * furMask * vShell;
  transformed += objectNormal * furL + uComb * (furL * vShell);
`;
  const FUR_FRAG_HEAD = `
uniform float uDensity;
uniform float uAO;
uniform float uTaper;
uniform vec3 uTip;
varying float vShell;
varying vec3 vBase;
varying float vMask;
float furHash(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 furHash3(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
// One strand per lattice cell, at a random offset, with a random length, tapering toward the tip.
bool furStrand(vec3 q) {
  vec3 cell = floor(q);
  float t = vShell / mix(.5, 1., furHash(cell));
  vec3 d = fract(q) - (.3 + .4 * furHash3(cell));
  return t <= 1. && length(d) <= .45 * (1. - t * uTaper);
}
`;
  const FUR_FRAG = `#include <color_fragment>
  if (vShell > .001) {
    if (vMask < .04) discard;
    vec3 q = vBase * uDensity;
    // A second, rotated lattice breaks up the grid pattern a single lattice shows on flat areas like the forehead.
    if (!furStrand(q) && !furStrand(mat3(.8, .36, -.48, -.6, .48, -.64, 0., .8, .6) * q + 17.3)) discard;
  }
  diffuseColor.rgb *= mix(uAO, 1., vShell);
  diffuseColor.rgb += uTip * vShell * vShell;
`;

  function makeFurMaterial(T, S, shells, len, comb) {
    const m = new T.MeshPhysicalMaterial({
      vertexColors: true, roughness: .95, metalness: 0,
      sheen: 1, sheenRoughness: .5, sheenColor: new T.Color(S.sheen)
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uFurLen: { value: len }, uShells: { value: shells }, uComb: { value: comb },
        uDensity: { value: S.density }, uTaper: { value: S.taper }, uAO: { value: S.ao }, uTip: { value: new T.Color(S.tip) }
      });
      shader.vertexShader = FUR_VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', FUR_VERT);
      shader.fragmentShader = FUR_FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', FUR_FRAG);
    };
    m.customProgramCacheKey = () => 'catkit-fur-2';
    return m;
  }

  function makeIrisTexture(T, stops) {
    if (typeof document === 'undefined') return null;
    // The iris sphere's front pole is v = 1, so a vertical gradient becomes concentric rings.
    const c = document.createElement('canvas');
    c.width = 4; c.height = 128;
    const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, stops[0]); grad.addColorStop(.17, stops[1]); grad.addColorStop(.31, stops[2]);
    grad.addColorStop(.43, stops[3]); grad.addColorStop(.5, '#140d06'); grad.addColorStop(1, '#140d06');
    g.fillStyle = grad; g.fillRect(0, 0, 4, 128);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }

  const POSES = {
    stand: { y: .56, pitch: 0, roll: 0, hx: -.06, hz: 0, fl: 0, fr: 0, bl: 0, br: 0, splay: 0, curl: 0, tBase: -.55, tSide: 0, tCurl: .13, tWrap: 0, ny: 0 },
    // Sitting, the tail runs back along the floor and wraps round toward the front paws (tWrap bends it sideways).
    sit: { y: .28, pitch: -.55, roll: 0, hx: .48, hz: .1, fl: .53, fr: .53, bl: -.7, br: -.7, splay: .12, curl: 0, tBase: -1.35, tSide: .35, tCurl: .05, tWrap: .3, ny: 0 },
    // Belly up, head flipped over with the body; ny slides the neck toward the spine so the head rests on the floor.
    roll: { y: .56, pitch: 0, roll: -2.4, hx: 0, hz: .4, fl: -.9, fr: -.55, bl: -.4, br: -.15, splay: .3, curl: -1, tBase: -1.75, tSide: 0, tCurl: -.04, tWrap: 0, ny: -.5 }
  };

  function create(T, styleId, opts) {
    opts = opts || {};
    const S = STYLES[styleId] || STYLES.blackcat;
    const shells = opts.shells || 18, P = S.plump, F = S.furScale;
    const pal = {};
    for (const k in S.palette) pal[k] = new T.Color(S.palette[k]);

    const root = new T.Group();
    root.name = 'catkit-' + S.id;
    const HIP = new T.Vector3(0, .56, -.36);
    const body = new T.Group();
    body.position.copy(HIP);
    root.add(body);
    const at = (x, y, z) => new T.Vector3(x - HIP.x, y - HIP.y, z - HIP.z);  // rest-pose world -> body space

    const parts = [], plainMats = new Map(), furMats = new Map(), identity = new T.Matrix4();
    // Fur shells can't cast sensible shadows, so with castShadow each furry part gets a stand-in that only draws into the shadow map.
    const shadowMat = opts.castShadow ? new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }) : null;
    function ellipsoid(rx, ry, rz, detail) {
      const g = new T.SphereGeometry(1, detail ? 40 : 22, detail ? 28 : 16);
      g.scale(rx, ry, rz);
      return g;
    }
    function plain(color, extra) {
      const key = color + JSON.stringify(extra || {});
      if (!plainMats.has(key)) plainMats.set(key, new T.MeshStandardMaterial(Object.assign({ color, roughness: .6 }, extra)));
      return plainMats.get(key);
    }
    function add(geo, material, parent, x, y, z) {
      const m = new T.Mesh(geo, material);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }
    function tube(points, r, material, parent) {
      const curve = new T.CatmullRomCurve3(points.map(v => new T.Vector3(v[0], v[1], v[2])));
      return add(new T.TubeGeometry(curve, 18, r, 6, false), material, parent, 0, 0, 0);
    }
    function fur(geo, parent, pos, o) {
      const len = o.abs ? o.len : o.len * F, comb = o.comb || [0, -.35, -.55];
      const key = len.toFixed(4) + '|' + comb.join();
      if (!furMats.has(key)) furMats.set(key, makeFurMaterial(T, S, shells, len, new T.Vector3(comb[0], comb[1], comb[2])));
      const count = geo.attributes.position.count;
      geo.setAttribute('furMask', new T.BufferAttribute(new Float32Array(count).fill(1), 1));
      geo.setAttribute('color', new T.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
      const mesh = new T.InstancedMesh(geo, furMats.get(key), shells);
      for (let i = 0; i < shells; i++) mesh.setMatrixAt(i, identity);
      mesh.frustumCulled = false;
      mesh.position.copy(pos);
      parent.add(mesh);
      if (shadowMat) {
        const proxy = new T.Mesh(geo, shadowMat);
        proxy.castShadow = true;
        mesh.add(proxy);
        mesh.receiveShadow = true;
      }
      parts.push({ mesh, region: o.region, mask: o.mask });
      return mesh;
    }

    // Torso: a round kitten bean, with a fluffier chest in front.
    const torso = fur(ellipsoid(.37 * P, .35 * P, .55, true), body, at(0, .64, -.05), { len: .075, region: 'body' });
    fur(ellipsoid(.31 * P, .33 * P, .27, true), body, at(0, .72, .27), { len: .08, comb: [0, -.6, .2], region: 'chest' });

    // Head hangs from a neck pivot so it can nod, turn and tilt.
    const neck = new T.Group();
    neck.position.copy(at(0, .86, .36));
    body.add(neck);
    const neckY = neck.position.y;
    const headC = new T.Vector3(0, .40, .12), headR = new T.Vector3(.5, .44, .45);
    function onHead(x, y) {
      const nx = x / headR.x, ny = (y - headC.y) / headR.y, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      return {
        p: new T.Vector3(x, y, headC.z + nz * headR.z),
        n: new T.Vector3(nx / headR.x, ny / headR.y, nz / headR.z).normalize()
      };
    }
    const eyeSpots = [-1, 1].map(s => onHead(s * .185, .43).p);
    const noseSpot = new T.Vector3(0, .3, .565), mouthSpot = new T.Vector3(0, .235, .59);
    const nearEye = p => Math.min(p.distanceTo(eyeSpots[0]), p.distanceTo(eyeSpots[1]));
    fur(ellipsoid(headR.x, headR.y, headR.z, true), neck, headC, {
      len: .05, comb: [0, -.25, -.5], region: 'head',
      mask: p => Math.min(smooth(.14, .24, nearEye(p)), .25 + .75 * smooth(.05, .16, p.distanceTo(noseSpot)))
    });
    for (const s of [-1, 1]) {
      fur(ellipsoid(.23 * P, .19, .2), neck, new T.Vector3(s * .27 * P, .23, .28), {
        len: .06, comb: [s * .5, -.4, -.2], region: 'cheek', mask: p => smooth(.12, .22, nearEye(p))
      });
      fur(ellipsoid(.092, .072, .075), neck, new T.Vector3(s * .072, .235, .515), {
        len: .022, comb: [s * .3, -.5, .2], region: 'muzzle', mask: p => .3 + .7 * smooth(.03, .08, p.distanceTo(mouthSpot))
      });
    }
    fur(ellipsoid(.075, .055, .065), neck, new T.Vector3(0, .165, .48), { len: .02, region: 'chin' });
    if (S.ruff) {
      // Mochi's white collar of long fur.
      for (const s of [-1, 1]) fur(ellipsoid(.25, .22, .22), neck, new T.Vector3(s * .27, .02, .1), { len: .09, comb: [s * .3, -.8, 0], region: 'ruff' });
      fur(ellipsoid(.3, .24, .2), neck, new T.Vector3(0, -.04, .2), { len: .09, comb: [0, -.9, .2], region: 'ruff' });
    }

    // Eyes: dark rim, ringed iris, big pupil and two glints, oriented along the head surface.
    const irisMat = new T.MeshPhysicalMaterial({ map: makeIrisTexture(T, S.iris), color: '#ffffff', roughness: .2, clearcoat: 1, clearcoatRoughness: .04 });
    const pupilMat = new T.MeshPhysicalMaterial({ color: '#07080b', roughness: .15, clearcoat: 1 });
    const glintMat = new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const eyes = [];
    for (const s of [-1, 1]) {
      const spot = onHead(s * .185, .43), dir = spot.n.clone().add(new T.Vector3(0, 0, .45)).normalize();
      const g = new T.Group();
      g.position.copy(spot.p).addScaledVector(dir, -.042);
      g.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), dir);
      neck.add(g);
      eyes.push(g);
      add(ellipsoid(.148, .152, .05), plain(S.socket, { roughness: .4 }), g, 0, 0, 0);
      const irisGeo = new T.SphereGeometry(1, 32, 24);
      irisGeo.rotateX(Math.PI / 2);
      irisGeo.scale(.13, .135, .045);
      add(irisGeo, irisMat, g, 0, 0, .012);
      // Pupils sit slightly toward the nose so the outward-facing eyes still look ahead.
      add(ellipsoid(.07, .09, .03), pupilMat, g, -s * .014, -.004, .035);
      add(ellipsoid(.034, .038, .012), glintMat, g, -.035 - s * .01, .045, .052);
      add(ellipsoid(.015, .015, .008), glintMat, g, .04 - s * .01, -.045, .05);
    }

    // Nose, ω mouth and whiskers.
    const ns = new T.Shape();
    ns.moveTo(-.055, .022);
    ns.quadraticCurveTo(0, .04, .055, .022);
    ns.quadraticCurveTo(.05, -.005, 0, -.035);
    ns.quadraticCurveTo(-.05, -.005, -.055, .022);
    const nose = add(new T.ExtrudeGeometry(ns, { depth: .025, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, curveSegments: 10 }),
      plain(S.nose, { roughness: .45 }), neck, 0, .305, .565);
    nose.rotation.x = -.2;
    const mouthMat = plain(S.mouth, { roughness: .8 });
    tube([[0, .275, .598], [0, .247, .605]], .006, mouthMat, neck);
    for (const s of [-1, 1]) tube([[0, .247, .605], [s * .025, .229, .607], [s * .05, .235, .6], [s * .064, .25, .592]], .006, mouthMat, neck);
    const whiskerMat = new T.MeshBasicMaterial({ color: S.whisker, transparent: true, opacity: .85 });
    for (const s of [-1, 1]) {
      for (let j = 0; j < 3; j++) tube([[s * .1, .25 - j * .02, .58], [s * .33, .27 - j * .045, .585], [s * .62, .25 - j * .1, .47]], .0045, whiskerMat, neck);
      tube([[s * .19, .56, .5], [s * .3, .7, .47], [s * .42, .79, .36]], .003, whiskerMat, neck);
    }

    // Ears: rounded lathe cones, fur kept off the pink inside.
    const earProfile = [[.17, 0], [.165, .06], [.14, .15], [.1, .24], [.055, .31], [.02, .35], [0, .36]].map(v => new T.Vector2(v[0], v[1]));
    const ears = [], earRest = [], EAR_FOLD = 1.2;
    for (const s of [-1, 1]) {
      const ear = new T.Group();
      ear.position.set(s * .29, .72, .1);
      ear.rotation.set(-.12, s * .28, -s * .3);
      neck.add(ear);
      ears.push(ear);
      earRest.push(ear.rotation.x);
      const outer = new T.LatheGeometry(earProfile, 24);
      outer.scale(1, 1, .5);
      fur(outer, ear, new T.Vector3(), { len: .035, comb: [0, .6, -.2], region: 'ear', mask: (p, n) => 1 - .85 * smooth(.2, .5, n.z) });
      const inner = new T.LatheGeometry(earProfile.map(v => new T.Vector2(v.x * .68, v.y * .8)), 20);
      inner.scale(1, 1, .18);
      add(inner, plain(S.earInner, { roughness: .7 }), ear, 0, .03, .07);
      if (S.earTufts) fur(ellipsoid(.06, .11, .035), ear, new T.Vector3(0, .09, .085), { len: .045, comb: [0, .7, .4], region: 'tuft' });
    }

    // Paws carry pink toe beans underneath, visible when she rolls over.
    const padMat = plain(S.pad, { roughness: .55 });
    function paw(parent, y) {
      const g = new T.Group();
      g.position.set(0, y, .03);
      parent.add(g);
      fur(ellipsoid(.125 * P, .085, .15), g, new T.Vector3(), { len: .028, comb: [0, -.2, .4], region: 'paw', mask: (p, n) => 1 - smooth(-.3, -.7, n.y) });
      add(ellipsoid(.062, .02, .052), padMat, g, 0, -.068, -.015);
      for (const [x, z] of [[-.062, .055], [-.022, .085], [.022, .085], [.062, .055]]) add(ellipsoid(.024, .014, .024), padMat, g, x, -.064, z);
      return g;
    }
    const legs = {};
    for (const [name, x] of [['fl', .17], ['fr', -.17]]) {
      const g = new T.Group();
      g.position.copy(at(x * P, .56, .33));
      body.add(g);
      const upper = fur(ellipsoid(.125 * P, .25, .13), g, new T.Vector3(0, -.22, 0), { len: .04, comb: [0, -1, 0], region: 'frontLeg' });
      g.userData = { upper, paw: paw(g, -.46), front: true };
      legs[name] = g;
    }
    for (const [name, x] of [['bl', .19], ['br', -.19]]) {
      const g = new T.Group();
      g.position.copy(at(x * P, .58, -.42));
      body.add(g);
      fur(ellipsoid(.17 * P, .26, .23), g, new T.Vector3(0, -.1, 0), { len: .065, comb: [0, -.6, -.4], region: 'thigh' });
      fur(ellipsoid(.115 * P, .17, .12), g, new T.Vector3(0, -.32, -.02), { len: .04, comb: [0, -1, 0], region: 'backLeg' });
      g.userData = { paw: paw(g, -.48), front: false };
      legs[name] = g;
    }

    // Tail: a chain of segments so it can curl into a question mark and sway.
    const tail = [], TS = S.tail;
    let lastR = TS.r;
    for (let i = 0; i < TS.segs; i++) {
      const seg = new T.Group(), k = i / (TS.segs - 1);
      if (i === 0) { seg.position.copy(at(0, .78, -.56)); body.add(seg); }
      else { seg.position.set(0, TS.len, 0); tail[i - 1].add(seg); }
      const bulge = 1 + TS.plume * Math.sin(Math.PI * Math.min(1, k * 1.15));
      lastR = TS.r * (1 - .2 * k) * bulge;
      fur(ellipsoid(lastR, TS.len * .78, lastR), seg, new T.Vector3(0, TS.len * .5, 0), {
        abs: true, len: TS.fur * (.85 + .3 * bulge - .3), comb: [0, .9, 0], region: 'tail'
      });
      tail.push(seg);
    }
    fur(ellipsoid(lastR, lastR * 1.2, lastR), tail[tail.length - 1], new T.Vector3(0, TS.len, 0), { abs: true, len: TS.fur, comb: [0, .9, 0], region: 'tail' });

    // Bake colour markings and fur masks in the rest pose.
    root.updateMatrixWorld(true);
    const v = new T.Vector3(), w = new T.Vector3(), n = new T.Vector3(), nl = new T.Vector3(), local = new T.Vector3(), nm = new T.Matrix3();
    for (const part of parts) {
      const geo = part.mesh.geometry, pos = geo.attributes.position, nor = geo.attributes.normal;
      const col = geo.attributes.color, fm = geo.attributes.furMask;
      nm.getNormalMatrix(part.mesh.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        nl.fromBufferAttribute(nor, i);
        w.copy(v).applyMatrix4(part.mesh.matrixWorld);
        n.copy(nl).applyMatrix3(nm).normalize();
        const c = S.color(w, n, part.region, pal);
        col.setXYZ(i, c.r, c.g, c.b);
        if (part.mask) fm.setX(i, part.mask(local.copy(v).add(part.mesh.position), nl));
      }
    }

    // ---- Animation ----
    const pose = Object.assign({}, POSES.stand);
    let state = 'stand', time = Math.random() * 10, phase = 0, walkW = 0;
    let blinkAt = 1.5 + Math.random() * 2, blinkT = -1, twitchAt = 3, twitchT = -1, twitchEar = 0, hopT = -1;
    let lookYaw = 0, lookPitch = 0;
    const lookLocal = new T.Vector3();

    function update(dt, ctx) {
      ctx = ctx || {};
      dt = Math.min(dt, .05);
      time += dt;
      const speed = ctx.speed || 0, moving = speed > .04;
      const goal = POSES[moving ? 'stand' : state];
      const ease = 1 - Math.exp(-dt * (moving ? 8 : 4.5));
      for (const k in pose) pose[k] += (goal[k] - pose[k]) * ease;
      walkW += (Math.min(1, speed / 1.1) - walkW) * (1 - Math.exp(-dt * 10));
      phase += dt * (2 + speed * 6.5);
      const sw = Math.sin(phase), cw = Math.cos(phase), rollW = Math.min(1, Math.abs(pose.roll) / 2.5);

      let hop = 0;
      if (hopT >= 0) {
        hopT += dt;
        hop = Math.sin(Math.min(1, hopT / .45) * Math.PI);
        if (hopT > .45) hopT = -1;
      }
      body.position.y = pose.y + hop * .15 * (1 - rollW) + .02 * Math.cos(phase * 2) * walkW;
      body.rotation.set(pose.pitch + .03 * Math.sin(phase * 2) * walkW, 0, pose.roll + .05 * sw * walkW);
      torso.scale.y = 1 + .02 * Math.sin(time * 2.3) * (1 - walkW);

      // Glance toward whoever is looking (the camera), within what a neck can do.
      let yawGoal = 0, pitchGoal = 0;
      if (ctx.look && rollW < .5) {
        // Work in the cat's own space so this holds when the cat is nested inside a moving, scaled avatar.
        const l = root.worldToLocal(lookLocal.copy(ctx.look)), a = Math.atan2(l.x, l.z);
        if (Math.abs(a) < 2.2) yawGoal = Math.max(-.6, Math.min(.6, a)) * (1 - walkW * .7);
        pitchGoal = -Math.atan2(l.y - 1.3, Math.hypot(l.x, l.z)) * .35;
      }
      const lookEase = 1 - Math.exp(-dt * 3);
      lookYaw += (yawGoal - lookYaw) * lookEase;
      lookPitch += (pitchGoal - lookPitch) * lookEase;
      neck.position.y = neckY + pose.ny;
      neck.rotation.set(pose.hx + lookPitch - .05 * Math.cos(phase * 2) * walkW, lookYaw, pose.hz + hop * .28);

      // Diagonal walking gait: front-left moves with back-right.
      const amp = .55 * walkW;
      const L = legs;
      L.fl.rotation.x = pose.fl - amp * sw; L.br.rotation.x = pose.br - amp * sw;
      L.fr.rotation.x = pose.fr + amp * sw; L.bl.rotation.x = pose.bl + amp * sw;
      L.bl.rotation.z = pose.splay; L.br.rotation.z = -pose.splay;
      L.fl.rotation.z = rollW * .25; L.fr.rotation.z = -rollW * .25;
      // Front legs stretch a little so the paws stay planted when sitting upright.
      const shoulderY = pose.y + .69 * Math.sin(-pose.pitch);
      const stretch = 1 + (Math.max(.545, shoulderY - .015) / .545 - 1) * (1 - rollW);
      for (const [leg, lift, off] of [[L.fl, Math.max(0, cw), 0], [L.fr, Math.max(0, -cw), Math.PI], [L.bl, Math.max(0, -cw), Math.PI], [L.br, Math.max(0, cw), 0]]) {
        const d = leg.userData;
        const flatten = -(pose.pitch + leg.rotation.x) * (1 - rollW) * (d.front ? .6 : 1);
        d.paw.rotation.x = flatten + pose.curl * rollW + Math.sin(time * 5 + off) * .3 * rollW;
        if (d.front) {
          d.upper.scale.y = stretch;
          d.upper.position.y = -.22 * stretch;
          d.paw.position.y = -.46 * stretch + lift * .07 * walkW;
        } else d.paw.position.y = -.48 + lift * .07 * walkW;
      }

      const tailAmp = .07 + .12 * walkW + rollW * .05, tailSpeed = 1.7 + 4 * walkW;
      tail.forEach((seg, i) => {
        const k = i / (tail.length - 1), wave = Math.sin(time * tailSpeed - i * .55) * tailAmp * (.3 + k);
        if (i === 0) seg.rotation.set(pose.tBase + .05 * Math.sin(time * 1.3), 0, pose.tSide + wave);
        else seg.rotation.set(pose.tCurl * (.6 + k * .9), 0, wave + pose.tWrap);
      });

      if (time > blinkAt) { blinkT = 0; blinkAt = time + 2.2 + Math.random() * 3.5; }
      let lid = 1;
      if (blinkT >= 0) {
        blinkT += dt;
        lid = 1 - Math.sin(Math.min(1, blinkT / .16) * Math.PI) * .9;
        if (blinkT > .16) blinkT = -1;
      }
      if (hopT >= 0) lid = Math.min(lid, 1 - hop * .75);  // happy squint
      for (const e of eyes) e.scale.y = lid;

      if (time > twitchAt) { twitchT = 0; twitchEar = Math.random() < .5 ? 0 : 1; twitchAt = time + 3 + Math.random() * 5; }
      let tw = 0;
      if (twitchT >= 0) {
        twitchT += dt;
        tw = Math.sin(Math.min(1, twitchT / .24) * Math.PI * 2) * .35;
        if (twitchT > .24) twitchT = -1;
      }
      // Belly up, the ear against the floor folds back flat instead of poking through it.
      ears.forEach((e, i) => { e.rotation.x = earRest[i] + (i === twitchEar ? tw : 0) - hop * .3 - rollW * (i === 1 ? EAR_FOLD : .25); });
    }

    return {
      root, style: S,
      arms: [legs.fl, legs.fr], legs: [legs.bl, legs.br],
      get state() { return state; },
      setState(s) { if (POSES[s]) state = s; },
      meow() { hopT = 0; },
      update,
      dispose() {
        root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        for (const m of [...plainMats.values(), ...furMats.values(), irisMat, pupilMat, glintMat, whiskerMat, shadowMat]) { if (!m) continue; if (m.map) m.map.dispose(); m.dispose(); }
      }
    };
  }

  global.CatKit = {
    poses: POSES,  // shared pose table, exposed so poses can be tuned live from the console
    styles: Object.values(STYLES).map(s => ({ id: s.id, name: s.name, fullName: s.fullName, tagline: s.tagline, swatch: s.swatch })),
    create
  };
})(typeof window !== 'undefined' ? window : globalThis);
