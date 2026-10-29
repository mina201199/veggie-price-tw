/* A walkable, rotatable showcase for one LumiKit girl, with Mochi (CatKit) tagging along.
   The page picks the girl by defining window.GIRL_DEMO before this script; without it the page shows Lumi. */
(function () {
  'use strict';
  const T = window.THREE;
  const $ = id => document.getElementById(id);
  const app = $('app'), stage = $('stage'), bubble = $('bubble'), mood = $('mood');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

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
  renderer.toneMappingExposure = .95;
  stage.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(36, 1, .1, 80);
  const tok = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Studio lights ride with the camera: soft key from the front-left, warm fill, rim from behind for the hair.
  scene.add(new T.HemisphereLight(0xfff6ec, 0xcdb4a2, 1.1));
  const keyLight = new T.DirectionalLight(0xfff3e6, 2.2), rimLight = new T.DirectionalLight(0xfff0dc, 2.4), fillLight = new T.DirectionalLight(0xffe6dc, .6);
  const lightTarget = new T.Object3D();
  scene.add(lightTarget);
  for (const l of [keyLight, rimLight, fillLight]) { l.target = lightTarget; scene.add(l); }

  // A tiny studio environment (warm gradient dome plus two soft panels) for reflections on gold and hair.
  {
    const env = new T.Scene(), dome = new T.SphereGeometry(10, 32, 16), col = [], p = dome.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = (p.getY(i) / 10 + 1) / 2; col.push(.55 + .45 * k, .5 + .42 * k, .46 + .4 * k); }
    dome.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    env.add(new T.Mesh(dome, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    for (const [x, y, z] of [[-5, 5, 4], [5, 3, -4]]) {
      const panel = new T.Mesh(new T.PlaneGeometry(4, 3), new T.MeshBasicMaterial({ color: 0xffffff }));
      panel.position.set(x, y, z); panel.lookAt(0, 0, 0); env.add(panel);
    }
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, .04).texture;
    scene.environmentIntensity = .6;
    pmrem.dispose();
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  const groundMat = new T.MeshStandardMaterial({ roughness: 1 });
  const ground = new T.Mesh(new T.CircleGeometry(30, 72), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const shadowTex = canvasTex(128, 128, g => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(60,40,30,.42)'); grd.addColorStop(.55, 'rgba(60,40,30,.18)'); grd.addColorStop(1, 'rgba(60,40,30,0)');
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
  // A soft round rug marks the stage.
  const rug = new T.Mesh(new T.CircleGeometry(2.2, 64), new T.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: .55 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = .004;
  scene.add(rug);
  const marker = new T.Mesh(new T.RingGeometry(.16, .24, 36), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = .016;
  scene.add(marker);

  function applyTheme() {
    const sky = new T.Color(tok('--scene-sky'));
    scene.background = sky;
    scene.fog = new T.Fog(sky, 10, 24);
    groundMat.color.set(tok('--scene-ground'));
    rug.material.color.set(tok('--surface'));
    marker.material.color.set(tok('--accent'));
  }
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const CFG = Object.assign({
    look: 'lumi', style: 'mascot', name: 'Lumi', tap: ['wave', 'wink'],
    moods: { idle: 'Hello!', wave: 'Hello ♡', wink: 'Playful', hug: 'Warm' },
    lines: { wave: '一起去買菜吧！', wink: '今天也要開心喔', hug: '最喜歡你了～' }
  }, window.GIRL_DEMO);

  // ---- the girl and Mochi ----
  let lumi = null, girlTop = 2.7;   // girlTop: her height, for the speech bubble, the camera and taps
  const lumiShadow = blob(1.1, 1.1, .8);
  const CAT_SCALE = .42, HUG_SCALE = .34;
  const cat = window.CatKit.create(T, 'mochi', { shells: coarse ? 12 : 18 });
  cat.root.scale.setScalar(CAT_SCALE);
  scene.add(cat.root);
  const catShadow = blob(.65, .9, .7);
  const me = { pos: new T.Vector3(), vel: new T.Vector3(), heading: .35, target: null, speed: 0 };
  const pet = { pos: new T.Vector3(1, 0, -.4), vel: new T.Vector3(), heading: 0, held: false, idle: 0 };

  // Builds the girl in a style (the page's style buttons), keeping her place and pose when switching.
  function buildGirl(style) {
    const pose = lumi ? lumi.state : 'idle';
    if (lumi) {
      if (pet.held) releaseCat();
      scene.remove(lumi.root);
      lumi.dispose();
    }
    lumi = window.LumiKit.create(T, { look: CFG.look, style });
    lumi.root.updateMatrixWorld(true);
    girlTop = new T.Box3().setFromObject(lumi.root).max.y;
    scene.add(lumi.root);
    lumi.setPose(pose);
    if (pose === 'hug') holdCat();
    document.querySelectorAll('[data-style]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === lumi.style)));
    document.querySelectorAll('[data-style-item]').forEach(el => el.setAttribute('aria-current', String(el.dataset.styleItem === lumi.style)));
  }
  buildGirl(CFG.style);
  document.querySelectorAll('[data-style]').forEach(b => {
    b.onclick = () => { if (lumi.style !== b.dataset.style) buildGirl(b.dataset.style); };
  });

  const MOODS = CFG.moods, LINES = CFG.lines;
  let bubbleT = 0;
  function say(text) { bubble.textContent = text; bubble.hidden = false; bubbleT = 2.2; }
  function setPose(p) {
    if (p !== 'hug' && pet.held) releaseCat();
    lumi.setPose(p);
    mood.textContent = MOODS[p];
    document.querySelectorAll('.act').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pose === p)));
    if (p === 'hug') holdCat();
    if (LINES[p]) say(LINES[p]);
  }
  function holdCat() {
    pet.held = true;
    lumi.hugAnchor.add(cat.root);
    cat.root.position.set(0, 0, 0);
    cat.root.rotation.set(0, 0, 0);
    cat.root.scale.setScalar(HUG_SCALE);
    cat.setState('sit');
  }
  function releaseCat() {
    pet.held = false;
    scene.add(cat.root);
    cat.root.scale.setScalar(CAT_SCALE);
    const side = new T.Vector3(.7, 0, .35).applyAxisAngle(new T.Vector3(0, 1, 0), me.heading);
    pet.pos.copy(me.pos).add(side);
    pet.heading = me.heading;
    cat.setState('stand');
    cat.meow();
  }
  document.querySelectorAll('.act').forEach(b => {
    b.onclick = () => setPose(lumi.state === b.dataset.pose ? 'idle' : b.dataset.pose);
  });

  // ---- input ----
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
  function endJoy(e) { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
  joyEl.addEventListener('pointerdown', e => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); moveJoy(e); e.preventDefault(); });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) moveJoy(e); });
  joyEl.addEventListener('pointerup', endJoy);
  joyEl.addEventListener('pointercancel', endJoy);

  const CAM0 = { az: .35, pol: 1.2, dist: 7.6 };
  const cam = { az: CAM0.az, pol: CAM0.pol, dist: CAM0.dist, target: new T.Vector3(0, girlTop * .47, 0), spin: false };
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
      cam.dist = clamp(pinch.dist * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 2.6, 13);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    if (drag.moved) { cam.az -= dx * .009; cam.pol = clamp(cam.pol - dy * .006, .5, 1.5); setSpin(false); }
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
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .001), 2.6, 13); }, { passive: false });

  const ray = new T.Raycaster(), ndc = new T.Vector2(), floor = new T.Plane(new T.Vector3(0, 1, 0), 0);
  const hit = new T.Vector3(), tmp = new T.Vector3(), want = new T.Vector3(), proj = new T.Vector3();
  let markerT = 0;
  function tap(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.distanceToPoint(tmp.copy(me.pos).setY(girlTop * .52)) < .55) { setPose(lumi.state === CFG.tap[0] ? CFG.tap[1] : CFG.tap[0]); return; }
    if (!pet.held && ray.ray.distanceToPoint(tmp.copy(pet.pos).setY(.35)) < .4) { cat.meow(); say('喵～'); return; }
    if (ray.ray.intersectPlane(floor, hit)) {
      if (hit.length() > 7.5) hit.setLength(7.5);
      me.target = hit.clone();
      marker.position.set(hit.x, .016, hit.z);
      markerT = 1;
    }
  }

  // ---- movement ----
  function stepLumi(dt) {
    const ix = joy.x + (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const iy = joy.y + (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    let mag = Math.min(1, Math.hypot(ix, iy));
    want.set(0, 0, 0);
    if (mag > .12) {
      me.target = null;
      const s = Math.sin(cam.az), c = Math.cos(cam.az);
      want.set(c * ix + s * iy, 0, -s * ix + c * iy).normalize();
    } else if (me.target) {
      tmp.copy(me.target).sub(me.pos).setY(0);
      const L = tmp.length();
      if (L < .06) { me.target = null; me.vel.set(0, 0, 0); mag = 0; } else { want.copy(tmp).divideScalar(L); mag = Math.max(.15, Math.min(1, L / .7)); }
    } else mag = 0;
    me.vel.lerp(want.multiplyScalar(1.5 * mag), 1 - Math.exp(-dt * 7));
    me.pos.addScaledVector(me.vel, dt);
    if (me.pos.length() > 7.5) me.pos.setLength(7.5);
    me.speed = me.vel.length();
    if (mag > 0 && me.speed > .05) {
      if (lumi.state !== 'idle') setPose('idle');
      const goal = Math.atan2(me.vel.x, me.vel.z);
      me.heading += Math.atan2(Math.sin(goal - me.heading), Math.cos(goal - me.heading)) * Math.min(1, dt * 8);
    }
    lumi.root.position.copy(me.pos);
    lumi.root.rotation.y = me.heading;
    lumi.update(dt, { speed: me.speed, look: camera.position });
    lumiShadow.position.set(me.pos.x, .012, me.pos.z);
  }
  // Mochi trots after Lumi and settles beside her.
  function stepCat(dt) {
    if (pet.held) { cat.update(dt, { speed: 0, look: camera.position }); catShadow.visible = false; return; }
    catShadow.visible = true;
    const spot = tmp.set(.75, 0, .2).applyAxisAngle(new T.Vector3(0, 1, 0), me.heading).add(me.pos);
    const to = spot.sub(pet.pos).setY(0), L = to.length();
    const wantSpeed = L > .35 ? Math.min(2, (L - .25) * 2.2) : 0;
    pet.vel.lerp(to.normalize().multiplyScalar(wantSpeed), 1 - Math.exp(-dt * 6));
    pet.pos.addScaledVector(pet.vel, dt);
    // keep out of Lumi's feet
    tmp.copy(pet.pos).sub(me.pos).setY(0);
    if (tmp.length() < .45) pet.pos.copy(me.pos).addScaledVector(tmp.normalize(), .45);
    const sp = pet.vel.length();
    let goal = null;
    if (sp > .05) goal = Math.atan2(pet.vel.x, pet.vel.z);
    else goal = Math.atan2(me.pos.x - pet.pos.x, me.pos.z - pet.pos.z) + .9;
    pet.heading += Math.atan2(Math.sin(goal - pet.heading), Math.cos(goal - pet.heading)) * Math.min(1, dt * 6);
    if (sp > .05) { pet.idle = 0; if (cat.state !== 'stand') cat.setState('stand'); } else if ((pet.idle += dt) > 3 && cat.state === 'stand') cat.setState('sit');
    cat.root.position.copy(pet.pos);
    cat.root.rotation.y = pet.heading;
    cat.update(dt, { speed: sp / CAT_SCALE * .55, look: camera.position });
    catShadow.position.set(pet.pos.x, .012, pet.pos.z);
    catShadow.rotation.z = pet.heading;
  }
  const lightPos = (l, x, y, z) => l.position.set(cam.target.x + x, y, cam.target.z + z);
  function placeCamera(dt) {
    cam.target.lerp(tmp.set(me.pos.x, girlTop * .47, me.pos.z), 1 - Math.exp(-dt * 4));
    if (cam.spin) cam.az += dt * .5;
    const sp = Math.sin(cam.pol), s = Math.sin(cam.az), c = Math.cos(cam.az), t = cam.target;
    camera.position.set(t.x + cam.dist * sp * s, t.y + cam.dist * Math.cos(cam.pol), t.z + cam.dist * sp * c);
    camera.lookAt(t);
    lightTarget.position.copy(t);
    lightPos(keyLight, s * 5 - c * 4, 7, c * 5 + s * 4);
    lightPos(rimLight, -s * 6 + c * 3, 5, -c * 6 - s * 3);
    lightPos(fillLight, s * 4 + c * 5, 2, c * 4 - s * 5);
  }
  function toScreen(p) {
    proj.copy(p).project(camera);
    return { x: (proj.x + 1) / 2 * app.clientWidth, y: (1 - proj.y) / 2 * app.clientHeight };
  }
  function resize() {
    const w = app.clientWidth, h = app.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < .7 ? 36 : 30;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(app);
  resize();

  const clock = new T.Clock();
  let frames = 0, slowTime = 0, started = false;
  function frame(raw) {
    const dt = Math.min(raw, .05);
    stepLumi(dt);
    stepCat(dt);
    placeCamera(dt);
    if (markerT > 0) {
      markerT = Math.max(0, markerT - dt * 1.4);
      marker.material.opacity = markerT * .9;
      marker.scale.setScalar(1 + (1 - markerT) * .8);
    }
    if (bubbleT > 0 && (bubbleT -= dt) <= 0) bubble.hidden = true;
    if (!bubble.hidden) {
      const p = toScreen(tmp.copy(me.pos).setY(girlTop + .28));
      bubble.style.left = p.x + 'px';
      bubble.style.top = p.y + 'px';
    }
    renderer.render(scene, camera);
    if (!started) { started = true; $('loading').hidden = true; setTimeout(() => say(`嗨，我是 ${CFG.name}！`), 600); }
    if (frames++ > 30 && pixelRatio > 1) {
      slowTime = raw > 1 / 28 ? slowTime + raw : Math.max(0, slowTime - raw * .5);
      if (slowTime > 1.5) { pixelRatio = Math.max(1, pixelRatio - .5); renderer.setPixelRatio(pixelRatio); resize(); slowTime = 0; }
    }
  }
  renderer.setAnimationLoop(() => frame(clock.getDelta()));
  // Local inspection only: lumi-demo.html?debug exposes the scene so frames can be stepped and captured from the console.
  if (/[?&]debug\b/.test(location.search)) window.lumiDemo = { renderer, scene, camera, cam, me, pet, get lumi() { return lumi; }, cat, frame, setPose, resize, buildGirl };
})();
