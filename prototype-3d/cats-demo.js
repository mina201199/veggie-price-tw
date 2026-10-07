/* 貓咪帶路: a 3D cat guide for 這菜貴不貴. The cats come from cat-kit.js. */
(function () {
  'use strict';
  const T = window.THREE, Kit = window.CatKit;
  const $ = id => document.getElementById(id);
  const app = $('app'), stage = $('stage'), card = $('card'), bubble = $('bubble');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Snapshot of site/data.json as of 2026-09-30: wholesale NT$/kg, and r = price ÷ the 5-year same-period median.
  const VEG = [
    { id: 'corn', name: '玉米', cur: 17.8, base: 25.6, r: .696 },
    { id: 'tomato', name: '番茄', cur: 82.3, base: 88.6, r: .929 },
    { id: 'cabbage', name: '高麗菜', cur: 33.7, base: 32.3, r: 1.043 },
    { id: 'carrot', name: '紅蘿蔔', cur: 20.3, base: 18.2, r: 1.118 },
    { id: 'eggplant', name: '茄子', cur: 48.4, base: 40.7, r: 1.19 },
    { id: 'pumpkin', name: '南瓜', cur: 53.2, base: 33.8, r: 1.576 }
  ];
  // Same thresholds as 這菜貴不貴 (README: 便宜 ≤ 0.88, 正常 ≤ 1.12, 偏貴 ≤ 1.35).
  const verdict = r => r <= .88 ? { label: '便宜', tone: 'good' } : r <= 1.12 ? { label: '正常', tone: 'ok' } : r <= 1.35 ? { label: '偏貴', tone: 'warn' } : { label: '很貴', tone: 'bad' };
  const pctText = r => {
    const p = Math.round((r - 1) * 100);
    return p === 0 ? '和往年同期差不多' : `比往年同期${p > 0 ? '貴' : '便宜'} ${Math.abs(p)}%`;
  };

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    $('loading').hidden = true;
    $('error').hidden = false;
    return;
  }
  let pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, .1, 80);
  const tok = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Lights ride with the camera so the fur always gets a key light from the front and a rim from behind.
  scene.add(new T.HemisphereLight(0xfffaf0, 0xc3cdb9, 1.6));
  const keyLight = new T.DirectionalLight(0xfff0d8, 2.3);
  const rimLight = new T.DirectionalLight(0xeaf1ff, 2.6);
  const fillLight = new T.DirectionalLight(0xffffff, .55);
  const lightTarget = new T.Object3D();
  scene.add(lightTarget);
  for (const l of [keyLight, rimLight, fillLight]) { l.target = lightTarget; scene.add(l); }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  const tileTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
  });
  tileTex.wrapS = tileTex.wrapT = T.RepeatWrapping;
  tileTex.repeat.set(30, 30);
  tileTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const groundMat = new T.MeshStandardMaterial({ roughness: 1, map: tileTex });
  const ground = new T.Mesh(new T.CircleGeometry(30, 72), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const shadowTex = canvasTex(128, 128, g => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(20,30,22,.5)'); grd.addColorStop(.55, 'rgba(20,30,22,.22)'); grd.addColorStop(1, 'rgba(20,30,22,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  });
  function blob(w, d, opacity) {
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w, d, 1);
    m.position.y = .012;
    scene.add(m);
    return m;
  }

  // ---- Baskets of vegetables, all procedural ----
  const mats = {};
  const M = (color, o) => {
    const k = color + JSON.stringify(o || {});
    return mats[k] || (mats[k] = new T.MeshStandardMaterial(Object.assign({ color, roughness: .7 }, o)));
  };
  function mesh(geo, mat, parent, x, y, z) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function ell(rx, ry, rz, seg) {
    seg = seg || 20;
    const g = new T.SphereGeometry(1, seg, Math.round(seg * .7));
    g.scale(rx, ry, rz);
    return g;
  }
  const wickerTex = canvasTex(128, 64, g => {
    g.fillStyle = '#b98a52'; g.fillRect(0, 0, 128, 64);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 9; x++) {
      g.fillStyle = (x + y) % 2 ? '#dcb47c' : '#c99c63';
      g.beginPath(); g.ellipse(x * 16 + (y % 2) * 8, y * 16 + 8, 7.5, 6, 0, 0, Math.PI * 2); g.fill();
    }
  });
  wickerTex.wrapS = wickerTex.wrapT = T.RepeatWrapping;
  wickerTex.repeat.set(7, 1.4);
  const wickerMat = new T.MeshStandardMaterial({ map: wickerTex, roughness: .9, side: T.DoubleSide });
  const cornTex = canvasTex(64, 128, g => {
    g.fillStyle = '#d9a52e'; g.fillRect(0, 0, 64, 128);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x * 7 + y * 3) % 5 ? '#f6cf55' : '#fadf7c';
      g.beginPath(); g.ellipse(x * 8 + 4, y * 8 + 4, 3.4, 3.4, 0, 0, Math.PI * 2); g.fill();
    }
  });
  const cornMat = new T.MeshStandardMaterial({ map: cornTex, roughness: .55 });

  function basket() {
    const g = new T.Group(), rimM = M('#a87a48', { roughness: .85 });
    mesh(new T.CylinderGeometry(.6, .48, .36, 32, 1, true), wickerMat, g, 0, .18, 0);
    mesh(new T.CircleGeometry(.48, 32), wickerMat, g, 0, .01, 0).rotation.x = -Math.PI / 2;
    mesh(new T.TorusGeometry(.6, .05, 10, 40), rimM, g, 0, .36, 0).rotation.x = Math.PI / 2;
    mesh(new T.TorusGeometry(.5, .025, 6, 40), rimM, g, 0, .04, 0).rotation.x = Math.PI / 2;
    mesh(new T.CircleGeometry(.57, 32), M('#e3cf9f', { roughness: 1 }), g, 0, .3, 0).rotation.x = -Math.PI / 2;
    return g;
  }
  const BUILD = {
    cabbage(g) {
      mesh(ell(.34, .31, .34, 28), M('#bfe08e', { roughness: .6 }), g, 0, .58, 0);
      const leafM = M('#8cc062', { roughness: .65, side: T.DoubleSide });
      for (let i = 0; i < 6; i++) {
        const leaf = mesh(new T.SphereGeometry(.39, 22, 14, 0, 1.7, .55, 1.75), leafM, g, 0, .56, 0);
        leaf.rotation.set(i % 2 ? .12 : -.08, i * 1.05, (i % 3 - 1) * .1);
      }
    },
    tomato(g) {
      const red = M('#e4483a', { roughness: .32 }), green = M('#5f9a3c', { roughness: .7 });
      for (const [x, y, z, s] of [[-.2, .47, .1, 1], [.2, .46, .12, .95], [0, .48, -.2, 1.05], [.02, .72, 0, .9]]) {
        const t = new T.Group();
        t.position.set(x, y, z); t.scale.setScalar(s); t.rotation.z = x * .6;
        g.add(t);
        mesh(ell(.21, .17, .21, 26), red, t, 0, 0, 0);
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2, leaf = mesh(ell(.075, .012, .026, 10), green, t, Math.cos(a) * .055, .163, Math.sin(a) * .055);
          leaf.rotation.y = -a;
        }
        mesh(new T.CylinderGeometry(.012, .016, .07, 8), green, t, 0, .2, 0);
      }
    },
    corn(g) {
      const husk = M('#a9c977', { roughness: .8, side: T.DoubleSide });
      for (const [x, y, z, ry] of [[-.15, .42, .05, .5], [.16, .42, -.02, -.4], [0, .63, .02, .05]]) {
        const c = new T.Group();
        c.position.set(x, y, z); c.rotation.set(0, ry, Math.PI / 2);
        g.add(c);
        mesh(new T.CapsuleGeometry(.11, .38, 8, 16), cornMat, c, 0, 0, 0);
        for (const s of [0, Math.PI]) {
          const h = mesh(new T.SphereGeometry(.14, 16, 10, 0, 1.7, .4, 2.3), husk, c, 0, -.2, 0);
          h.scale.set(1, 1.9, 1); h.rotation.y = s;
        }
      }
    },
    carrot(g) {
      const orange = M('#ef8a2c', { roughness: .6 }), leaf = M('#6aa84f', { roughness: .8 });
      const geo = new T.LatheGeometry([[0, 0], [.03, .04], [.055, .16], [.075, .32], [.085, .42], [.075, .46], [0, .48]].map(p => new T.Vector2(p[0], p[1])), 18);
      for (let i = 0; i < 4; i++) {
        const c = new T.Group(), a = -.9 + i * .6;
        c.rotation.order = 'YXZ';
        c.position.set(Math.sin(a) * .06, .4 + (i % 2) * .06, Math.cos(a) * .06 - .05);
        c.rotation.set(1.35, a, 0);
        g.add(c);
        mesh(geo, orange, c, 0, -.25, 0);
        for (let j = -1; j <= 1; j++) mesh(new T.ConeGeometry(.025, .3, 6), leaf, c, j * .02, .36, 0).rotation.z = j * .35;
      }
    },
    eggplant(g) {
      const purple = new T.MeshPhysicalMaterial({ color: '#56357a', roughness: .3, clearcoat: .8, clearcoatRoughness: .2 });
      const cap = M('#6c9748', { roughness: .7 });
      const geo = new T.LatheGeometry([[0, 0], [.1, .02], [.14, .1], [.145, .2], [.12, .3], [.085, .4], [.06, .48], [.045, .52], [0, .53]].map(p => new T.Vector2(p[0], p[1])), 22);
      for (const [x, y, z, ry, rz] of [[-.14, .45, .02, .3, 1.45], [.16, .45, .04, -.4, -1.45], [0, .66, -.08, 1.5, 1.4]]) {
        const e = new T.Group();
        e.position.set(x, y, z); e.rotation.set(0, ry, rz);
        g.add(e);
        mesh(geo, purple, e, 0, -.27, 0);
        mesh(new T.ConeGeometry(.075, .1, 6), cap, e, 0, .25, 0).rotation.x = Math.PI;
        mesh(new T.CylinderGeometry(.015, .02, .09, 6), cap, e, 0, .33, 0);
      }
    },
    pumpkin(g) {
      const orange = M('#ec8b2f', { roughness: .55 }), stem = M('#6f7d3c', { roughness: .8 });
      const p = new T.Group();
      p.position.y = .52;
      g.add(p);
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2, lobe = mesh(ell(.17, .22, .13, 18), orange, p, Math.cos(a) * .2, 0, Math.sin(a) * .2);
        lobe.rotation.y = -a;
      }
      mesh(ell(.22, .2, .22), orange, p, 0, 0, 0);
      mesh(new T.CylinderGeometry(.03, .045, .16, 8), stem, p, 0, .24, 0).rotation.z = .25;
    }
  };

  const CAM0 = { az: .45, pol: 1.08, dist: 6.6 };
  const LABEL_FONT = '"Huninn", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  const stalls = VEG.map((v, i) => {
    const a = CAM0.az + Math.PI / 6 + i * Math.PI / 3, pos = new T.Vector3(Math.sin(a) * 2.8, 0, Math.cos(a) * 2.8);
    const group = basket();
    BUILD[v.id](group);
    group.position.copy(pos);
    group.rotation.y = a + Math.PI;
    scene.add(group);
    blob(1.7, 1.7, .7).position.set(pos.x, .012, pos.z);
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const label = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    label.scale.set(1.5, .375, 1);
    label.position.set(pos.x, 1.22, pos.z);
    scene.add(label);
    return Object.assign({}, v, { pos, hitPoint: pos.clone().setY(.55), canvas: c, tex, label });
  });
  function pill(g, x, y, w, h) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2); else g.rect(x, y, w, h);
  }
  function drawLabel(s) {
    const g = s.canvas.getContext('2d'), W = s.canvas.width, H = s.canvas.height, v = verdict(s.r);
    g.clearRect(0, 0, W, H);
    g.font = `52px ${LABEL_FONT}`;
    const nameW = g.measureText(s.name).width;
    g.font = `700 34px ${LABEL_FONT}`;
    const chipW = g.measureText(v.label).width + 30, total = 28 + nameW + 14 + chipW + 18, x0 = (W - total) / 2;
    g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 12; g.shadowOffsetY = 3;
    g.fillStyle = tok('--surface'); pill(g, x0, H / 2 - 40, total, 80); g.fill();
    g.shadowColor = 'transparent';
    g.textBaseline = 'middle';
    g.fillStyle = tok('--ink'); g.font = `52px ${LABEL_FONT}`; g.fillText(s.name, x0 + 28, H / 2 + 2);
    const cx = x0 + 28 + nameW + 14;
    g.fillStyle = tok('--' + v.tone + '-bg'); pill(g, cx, H / 2 - 24, chipW, 48); g.fill();
    g.fillStyle = tok('--' + v.tone); g.font = `700 34px ${LABEL_FONT}`; g.fillText(v.label, cx + 15, H / 2 + 1);
    s.tex.needsUpdate = true;
  }

  const marker = new T.Mesh(new T.RingGeometry(.16, .24, 36), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = .016;
  scene.add(marker);

  function applyTheme() {
    const sky = new T.Color(tok('--scene-sky'));
    scene.background = sky;
    scene.fog = new T.Fog(sky, 10, 24);
    groundMat.color.set(tok('--scene-ground'));
    marker.material.color.set(tok('--accent'));
    stalls.forEach(drawLabel);
  }
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (document.fonts) document.fonts.ready.then(() => stalls.forEach(drawLabel));

  // ---- Cats ----
  const cache = {}, catsEl = $('cats');
  let cat = null, poof = 1;
  const getCat = id => cache[id] || (cache[id] = Kit.create(T, id, { shells: coarse ? 12 : 20 }));
  const catShadow = blob(1.5, 2.2, .75);
  const me = { pos: new T.Vector3(), vel: new T.Vector3(), heading: CAM0.az, target: null, stall: null, face: null, announce: false, idle: 0, speed: 0 };

  Kit.styles.forEach(s => {
    const b = document.createElement('button');
    b.className = 'cat-chip';
    b.setAttribute('role', 'radio');
    b.dataset.id = s.id;
    b.innerHTML = `<i style="background:${s.swatch}"></i>${s.name}`;
    b.onclick = () => switchCat(s.id);
    catsEl.appendChild(b);
  });
  function switchCat(id) {
    const next = getCat(id);
    if (next === cat) return;
    if (cat) { scene.remove(cat.root); next.setState(cat.state); }
    cat = next;
    scene.add(cat.root);
    poof = 0;
    catsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.id === id)));
    try { localStorage.setItem('veggie-cat-demo', id); } catch (_) { /* storage blocked: still works for this visit */ }
    syncButtons();
  }

  // Latin names like Mochi get a space before the Chinese that follows.
  const catName = () => cat.style.name + (/[A-Za-z]$/.test(cat.style.name) ? ' ' : '');

  function syncButtons() {
    if (!cat) return;
    const s = cat.state;
    $('sit').setAttribute('aria-pressed', String(s === 'sit'));
    $('sit').textContent = s === 'sit' ? '站起來' : '坐下';
    $('roll').setAttribute('aria-pressed', String(s === 'roll'));
    $('roll').textContent = s === 'roll' ? '翻回來' : '翻肚';
  }
  let bubbleT = 0, toastT = 0, markerT = 0, petCount = 0;
  function say(text) { bubble.textContent = text; bubble.hidden = false; bubbleT = 1.8; }
  function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); toastT = 3.4; }
  function pet() { cat.meow(); say(['喵～', '呼嚕呼嚕…', '再摸一下嘛'][petCount++ % 3]); }
  function flashMarker(p) { marker.position.set(p.x, .016, p.z); markerT = 1; }
  function stopWalking() { me.target = null; me.stall = null; me.face = null; }
  function walkTo(p) { stopWalking(); me.target = p.clone().setY(0); flashMarker(me.target); }
  function goToStall(s, announce) {
    const away = me.pos.clone().sub(s.pos).setY(0);
    if (away.lengthSq() < .01) away.set(0, 0, 1);
    me.target = s.pos.clone().addScaledVector(away.normalize(), 1.2);
    me.stall = s; me.face = null; me.announce = announce;
    flashMarker(me.target);
  }
  function arrive() {
    me.target = null;
    me.vel.set(0, 0, 0);
    if (!me.stall) return;
    me.face = me.stall.pos.clone();
    cat.setState('sit');
    syncButtons();
    if (me.announce) { cat.meow(); say(`喵！${me.stall.name}今天${verdict(me.stall.r).label}`); }
    me.stall = null;
  }

  const keys = new Set();
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (k) { keys.add(k); e.preventDefault(); } });
  addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  addEventListener('blur', () => keys.clear());

  const joy = { x: 0, y: 0, id: null }, joyEl = $('joy'), knob = $('knob');
  function moveJoy(e) {
    const r = joyEl.getBoundingClientRect(), max = r.width / 2 - 18;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const L = Math.hypot(dx, dy);
    if (L > max) { dx *= max / L; dy *= max / L; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joy.x = dx / max; joy.y = dy / max;
  }
  function endJoy(e) {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.x = joy.y = 0;
    knob.style.transform = '';
  }
  joyEl.addEventListener('pointerdown', e => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); moveJoy(e); e.preventDefault(); });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) moveJoy(e); });
  joyEl.addEventListener('pointerup', endJoy);
  joyEl.addEventListener('pointercancel', endJoy);

  // ---- Camera orbit, pinch zoom and tap-to-walk ----
  const cam = { az: CAM0.az, pol: CAM0.pol, dist: CAM0.dist, target: new T.Vector3(0, .55, 0), spin: false };
  function setSpin(on) { cam.spin = on; $('spin').setAttribute('aria-pressed', String(on)); }
  $('spin').onclick = () => setSpin(!cam.spin);
  $('recenter').onclick = () => { cam.az = me.heading; cam.pol = CAM0.pol; cam.dist = CAM0.dist; setSpin(false); };

  const pts = new Map();
  let drag = null, pinch = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: cam.dist };
      if (drag) drag.moved = true;
    }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      cam.dist = clamp(pinch.dist * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 3.6, 12);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    if (drag.moved) { cam.az -= dx * .009; cam.pol = clamp(cam.pol - dy * .006, .45, 1.42); setSpin(false); }
  });
  function pointerEnd(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (e.type === 'pointerup' && drag && !drag.moved && pts.size === 0 && performance.now() - drag.t < 450) tap(e.clientX, e.clientY);
    if (pts.size === 0) { drag = null; pinch = null; }
    else { const [p] = [...pts.values()]; drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, t: 0, moved: true }; pinch = null; }
  }
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .001), 3.6, 12); }, { passive: false });

  const ray = new T.Raycaster(), ndc = new T.Vector2(), floor = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const hit = new T.Vector3(), tmp = new T.Vector3(), want = new T.Vector3(), proj = new T.Vector3();
  function tap(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.distanceToPoint(tmp.copy(me.pos).setY(.9)) < .7) { pet(); return; }
    let best = null, bestD = .75;
    for (const s of stalls) {
      const d = ray.ray.distanceToPoint(s.hitPoint);
      if (d < bestD) { best = s; bestD = d; }
    }
    if (best) { goToStall(best, false); return; }
    if (ray.ray.intersectPlane(floor, hit)) {
      if (hit.length() > 7.5) hit.setLength(7.5);
      walkTo(hit);
    }
  }

  $('sit').onclick = () => { stopWalking(); cat.setState(cat.state === 'sit' ? 'stand' : 'sit'); me.idle = 0; syncButtons(); };
  $('roll').onclick = () => {
    stopWalking();
    cat.setState(cat.state === 'roll' ? 'stand' : 'roll');
    me.idle = 0;
    syncButtons();
    if (cat.state === 'roll') say('露肚肚！');
  };
  $('pet').onclick = pet;
  $('cheap').onclick = () => {
    const s = stalls.reduce((a, b) => (a.r < b.r ? a : b));
    goToStall(s, true);
    toast(`${catName()}帶你去看${s.name}：${pctText(s.r)}`);
  };

  function stepCat(dt) {
    const ix = joy.x + (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const iy = joy.y + (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    let mag = Math.min(1, Math.hypot(ix, iy));
    want.set(0, 0, 0);
    if (mag > .12) {
      // Camera-relative: up on the stick walks away from the camera.
      stopWalking();
      const s = Math.sin(cam.az), c = Math.cos(cam.az);
      want.set(c * ix + s * iy, 0, -s * ix + c * iy).normalize();
    } else if (me.target) {
      tmp.copy(me.target).sub(me.pos).setY(0);
      const L = tmp.length();
      if (L < .06) { arrive(); mag = 0; } else { want.copy(tmp).divideScalar(L); mag = Math.max(.12, Math.min(1, L / .7)); }
    } else mag = 0;
    me.vel.lerp(want.multiplyScalar(1.6 * mag), 1 - Math.exp(-dt * 7));
    me.pos.addScaledVector(me.vel, dt);
    for (const s of stalls) {
      tmp.copy(me.pos).sub(s.pos).setY(0);
      const L = tmp.length();
      if (L < .85) me.pos.copy(s.pos).addScaledVector(tmp.divideScalar(L || 1), .85).setY(0);
    }
    if (me.pos.length() > 7.5) me.pos.setLength(7.5);
    me.speed = me.vel.length();

    let goal = null;
    if (me.speed > .05) goal = Math.atan2(me.vel.x, me.vel.z);
    else if (me.face) goal = Math.atan2(me.face.x - me.pos.x, me.face.z - me.pos.z);
    if (goal !== null) me.heading += Math.atan2(Math.sin(goal - me.heading), Math.cos(goal - me.heading)) * Math.min(1, dt * 7);

    if (mag > 0 && me.speed > .05) {
      me.idle = 0;
      if (cat.state !== 'stand') { cat.setState('stand'); syncButtons(); }
    } else me.idle += dt;
    if (me.idle > 6 && cat.state === 'stand') { cat.setState('sit'); syncButtons(); }

    cat.root.position.copy(me.pos);
    cat.root.rotation.y = me.heading;
    cat.update(dt, { speed: me.speed, look: camera.position });
    catShadow.position.set(me.pos.x, .012, me.pos.z);
    catShadow.rotation.z = me.heading;
  }

  function placeCamera(dt) {
    cam.target.lerp(tmp.set(me.pos.x, .55, me.pos.z), 1 - Math.exp(-dt * 4));
    if (cam.spin) cam.az += dt * .5;
    const sp = Math.sin(cam.pol), s = Math.sin(cam.az), c = Math.cos(cam.az), t = cam.target;
    camera.position.set(t.x + cam.dist * sp * s, t.y + cam.dist * Math.cos(cam.pol), t.z + cam.dist * sp * c);
    camera.lookAt(t);
    lightTarget.position.copy(t);
    keyLight.position.set(t.x + s * 5 - c * 4, 7, t.z + c * 5 + s * 4);
    rimLight.position.set(t.x - s * 6 + c * 3, 4.5, t.z - c * 6 - s * 3);
    fillLight.position.set(t.x + s * 4 + c * 5, 2, t.z + c * 4 - s * 5);
  }

  function toScreen(p) {
    proj.copy(p).project(camera);
    return { x: (proj.x + 1) / 2 * app.clientWidth, y: (1 - proj.y) / 2 * app.clientHeight, behind: proj.z > 1 };
  }
  let cardStall = null;
  function fillCard(s) {
    const v = verdict(s.r);
    $('pcName').textContent = s.name;
    $('pcChip').textContent = v.label;
    $('pcChip').className = 'chip ' + v.tone;
    $('pcPrice').textContent = s.cur.toFixed(1);
    $('pcMeta').textContent = `批發價・${pctText(s.r)}`;
  }
  function updateOverlays() {
    let near = null, nd = 1.75;
    for (const s of stalls) {
      const d = s.pos.distanceTo(me.pos);
      if (d < nd) { near = s; nd = d; }
    }
    if (near !== cardStall) {
      cardStall = near;
      if (near) fillCard(near);
    }
    // Hide a label when it is the open card, or when the camera swings right up against it.
    for (const s of stalls) s.label.visible = s !== near && camera.position.distanceTo(s.label.position) > 2.6;
    card.hidden = !near;
    if (!bubble.hidden) {
      const p = toScreen(tmp.copy(me.pos).setY(cat.state === 'roll' ? 1.4 : 2.3));
      bubble.style.left = p.x + 'px';
      bubble.style.top = p.y + 'px';
    }
  }

  function resize() {
    const w = app.clientWidth, h = app.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < .7 ? 40 : 32;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(app);
  resize();

  let saved = 'blackcat';
  try { saved = localStorage.getItem('veggie-cat-demo') || saved; } catch (_) { /* default cat */ }
  switchCat(Kit.styles.some(s => s.id === saved) ? saved : 'blackcat');

  const clock = new T.Clock();
  let frames = 0, slowTime = 0, started = false;
  function frame(raw) {
    const dt = Math.min(raw, .05);
    stepCat(dt);
    placeCamera(dt);
    if (poof < 1) {
      poof = Math.min(1, poof + dt * 3.2);
      const k = 1 + 2.4 * Math.pow(poof - 1, 3) + 1.4 * Math.pow(poof - 1, 2);  // ease-out-back
      cat.root.scale.setScalar(Math.max(.01, k));
    }
    if (markerT > 0) {
      markerT = Math.max(0, markerT - dt * 1.4);
      marker.material.opacity = markerT * .9;
      marker.scale.setScalar(1 + (1 - markerT) * .8);
    }
    if (bubbleT > 0 && (bubbleT -= dt) <= 0) bubble.hidden = true;
    if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
    updateOverlays();
    renderer.render(scene, camera);

    if (!started) {
      started = true;
      $('loading').hidden = true;
      setTimeout(() => toast(`點一籃菜，${catName()}就會走過去看價格`), 500);
      // Build the other cat in the background so switching is instant.
      setTimeout(() => Kit.styles.forEach(s => getCat(s.id)), 1500);
    }
    // Drop resolution on slow devices rather than stutter.
    if (frames++ > 30 && pixelRatio > 1) {
      slowTime = raw > 1 / 28 ? slowTime + raw : Math.max(0, slowTime - raw * .5);
      if (slowTime > 1.5) { pixelRatio = Math.max(1, pixelRatio - .5); renderer.setPixelRatio(pixelRatio); resize(); slowTime = 0; }
    }
  }
  renderer.setAnimationLoop(() => frame(clock.getDelta()));
  // Local inspection only: cats-demo.html?debug exposes the scene so frames can be stepped and captured from the console.
  if (/[?&]debug\b/.test(location.search)) window.catDemo = { renderer, scene, camera, cam, me, stalls, frame, switchCat, resize, get cat() { return cat; } };
})();
