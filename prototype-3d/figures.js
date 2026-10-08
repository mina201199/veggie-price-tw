/* Market Folk gallery: one figurine at a time on a white display base (a turntable you can drag), or all twelve in a
   two-row lineup. Figures are built one by one after the first appears; each gets a thumbnail for its card. */
(function () {
  'use strict';
  const T = window.THREE, FK = window.FigureKit, $ = id => document.getElementById(id);
  const stage = $('stage'), ids = Object.keys(FK.cast), BASE_H = .1;
  const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    $('loading').innerHTML = '<b>3D 展示台無法啟動</b>請換用支援 WebGL 的瀏覽器，或開啟硬體加速。';
    return;
  }
  const coarse = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.75 : 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);
  const canvas = renderer.domElement;

  // ---- studio ----
  function studio(scene, withShadow) {
    scene.add(new T.HemisphereLight(0xfff6f2, 0xd8b6bf, 1.3));
    const key = new T.DirectionalLight(0xfff3e8, 2.1);
    key.position.set(-3.5, 7, 6);
    if (withShadow) {
      key.castShadow = true;
      key.shadow.mapSize.set(1536, 1536);
      Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -3, near: 1, far: 25 });
      key.shadow.bias = -.0004;
      key.shadow.radius = 5;
    }
    const fill = new T.DirectionalLight(0xffe6ee, .75);
    fill.position.set(5, 3, 4);
    const rim = new T.DirectionalLight(0xffffff, 1.5);
    rim.position.set(1.5, 5, -6);
    scene.add(key, fill, rim);
    const env = new T.Scene(), dome = new T.SphereGeometry(10, 32, 16), col = [], p = dome.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = (p.getY(i) / 10 + 1) / 2; col.push(.6 + .4 * k, .52 + .4 * k, .55 + .4 * k); }
    dome.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    env.add(new T.Mesh(dome, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    for (const [x, y, z] of [[-5, 5, 4], [5, 3, -4]]) { const panel = new T.Mesh(new T.PlaneGeometry(4, 3), new T.MeshBasicMaterial({ color: 0xffffff })); panel.position.set(x, y, z); panel.lookAt(0, 0, 0); env.add(panel); }
    return env;
  }
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(28, 1, .1, 80);
  {
    const env = studio(scene, true), pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, .04).texture;
    scene.environmentIntensity = .55;
    pm.dispose();
  }
  const floor = new T.Mesh(new T.CircleGeometry(40, 64), new T.MeshStandardMaterial({ roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  function theme() {
    const bg = new T.Color(tok('--stage'));
    scene.background = bg;
    scene.fog = new T.Fog(bg, 14, 34);
    floor.material.color.set(tok('--stage-floor'));
  }
  theme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme);
  new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // The white display base: a short disc with a rounded edge.
  const baseGeo = new T.LatheGeometry([[0, 0], [.74, 0], [.775, .012], [.79, .045], [.78, .08], [.75, .097], [.7, .1], [0, .1]].map(([x, y]) => new T.Vector2(x, y)), 72);
  const baseMat = new T.MeshStandardMaterial({ color: '#fbf8f5', roughness: .32 });

  // ---- figures ----
  const figs = {};
  function get(id) {
    if (!figs[id]) {
      const f = FK.create(T, id, { castShadow: true });
      f.root.traverse(o => { if (o.isMesh && !(o.material && o.material.transparent)) o.castShadow = true; });
      // Refresh the card after an embedded character has replaced its placeholder.
      if (f.ready) f.ready.then(() => { thumbnail(id); if (next >= ids.length) releaseThumbs(); });
      const holder = new T.Group(), base = new T.Mesh(baseGeo, baseMat);
      base.receiveShadow = true; base.castShadow = true;
      holder.add(base);
      f.root.position.y = BASE_H;
      holder.add(f.root);
      holder.userData.id = id;
      figs[id] = { f, holder, h: f.height() + BASE_H };
    }
    return figs[id];
  }

  // ---- cards ----
  const grid = $('grid');
  ids.forEach((id, i) => {
    const s = FK.cast[id], b = document.createElement('button');
    b.className = 'card'; b.dataset.id = id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="thumb"><span>${String(i + 1).padStart(2, '0')}</span></span><small>No.${String(i + 1).padStart(2, '0')}</small><b>${s.name}</b>`;
    b.onclick = () => select(id);
    grid.appendChild(b);
  });

  // Thumbnails: a small second renderer used while the figures are first built, then released.
  let thumbR = null, thumbScene = null, thumbCam = null;
  function thumbnail(id) {
    try {
      if (!thumbR) {
        thumbR = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
        thumbR.setSize(200, 240);
        thumbR.outputColorSpace = T.SRGBColorSpace;
        thumbR.toneMapping = T.ACESFilmicToneMapping;
        thumbScene = new T.Scene();
        studio(thumbScene, false);
        thumbCam = new T.PerspectiveCamera(24, 200 / 240, .1, 30);
      }
    } catch (e) { return; }
    const F = figs[id], parent = F.holder.parent, rot = F.holder.rotation.y, pos = F.holder.position.clone();
    thumbScene.add(F.holder);
    F.holder.position.set(0, 0, 0);
    F.holder.rotation.y = .42;
    const h = F.h;
    thumbCam.position.set(0, h * .62, h * 2.35);
    thumbCam.lookAt(0, h * .5, 0);
    thumbR.render(thumbScene, thumbCam);
    const url = thumbR.domElement.toDataURL('image/png');
    F.holder.rotation.y = rot;
    F.holder.position.copy(pos);
    if (parent) parent.add(F.holder); else thumbScene.remove(F.holder);
    const slot = grid.querySelector(`[data-id="${id}"] .thumb`);
    if (slot) slot.innerHTML = `<img alt="" src="${url}">`;
  }
  function releaseThumbs() {
    if (!thumbR) return;
    thumbR.dispose();
    thumbR.forceContextLoss();
    thumbR = null;
  }

  // ---- view state ----
  const view = { yaw: .35, goal: null, spin: !matchMedia('(prefers-reduced-motion: reduce)').matches, pol: .2, dist: 1, lineup: false };
  let current = null;
  function setSpin(on) { view.spin = on; $('spin').setAttribute('aria-pressed', String(on)); }
  setSpin(view.spin);
  function select(id) {
    if (view.lineup) setLineup(false);
    const F = get(id);
    if (current && current !== F) scene.remove(current.holder);
    current = F;
    scene.add(F.holder);
    F.holder.position.set(0, 0, 0);
    F.holder.rotation.y = view.yaw;
    view.dist = 1;
    const i = ids.indexOf(id), s = FK.cast[id];
    $('no').textContent = 'No.' + String(i + 1).padStart(2, '0');
    $('name').textContent = s.name;
    $('role').textContent = s.role;
    $('items').innerHTML = (s.items || []).map(t => `<li>${t}</li>`).join('');
    grid.querySelectorAll('.card').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
    if (!grid.querySelector(`[data-id="${id}"] img`)) thumbnail(id);
  }
  const LINEUP = ids.map((id, i) => { const row = i < 6 ? 0 : 1, c = i % 6; return [(c - 2.5) * 1.62 + (row ? .81 : 0), row ? -1.9 : 0, row ? .62 : 0]; });
  const riser = new T.Mesh(new T.BoxGeometry(11.2, .62, 1.9), baseMat);
  riser.position.set(.4, .31, -1.9);
  riser.receiveShadow = true; riser.castShadow = true;
  function setLineup(on) {
    view.lineup = on;
    $('all').setAttribute('aria-pressed', String(on));
    document.querySelector('.views').hidden = on;
    if (on) {
      ids.forEach((id, i) => { const F = get(id); F.holder.position.set(LINEUP[i][0], LINEUP[i][2], LINEUP[i][1]); F.holder.rotation.y = 0; scene.add(F.holder); });
      scene.add(riser);
    } else {
      scene.remove(riser);
      ids.forEach(id => { if (figs[id] && figs[id] !== current) scene.remove(figs[id].holder); });
      if (current) { current.holder.position.set(0, 0, 0); scene.add(current.holder); }
    }
  }
  $('spin').onclick = () => setSpin(!view.spin);
  $('all').onclick = () => setLineup(!view.lineup);
  document.querySelectorAll('.views button').forEach(b => {
    b.onclick = () => {
      setSpin(false);
      const want = +b.dataset.yaw, cur = view.yaw;
      view.goal = cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      document.querySelectorAll('.views button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    };
  });

  // ---- input: drag to turn, wheel / pinch to zoom, tap a figure in the lineup to pick it ----
  const pts = new Map();
  let drag = null, pinch = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: view.dist }; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; view.dist = clamp(pinch.dist * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), .45, 1.6); return; }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
    if (!drag.moved) return;
    view.yaw += dx * .012;
    view.pol = clamp(view.pol + dy * .004, -.05, .7);
    view.goal = null;
    setSpin(false);
    document.querySelectorAll('.views button').forEach(x => x.setAttribute('aria-pressed', 'false'));
  });
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function end(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (e.type === 'pointerup' && drag && !drag.moved && view.lineup) {
      const r = canvas.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(ids.map(id => figs[id] && figs[id].holder).filter(Boolean), true)[0];
      if (hit) { let o = hit.object; while (o && !o.userData.id) o = o.parent; if (o) select(o.userData.id); }
    }
    if (!pts.size) { drag = null; pinch = null; }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.dist = clamp(view.dist * Math.exp(e.deltaY * .001), .45, 1.6); }, { passive: false });

  // ---- frame ----
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  const tan = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
  function place() {
    let target, dist;
    if (view.lineup) {
      const halfW = 5.4, halfH = 1.75, fit = Math.max(halfW / (tan * camera.aspect), halfH / tan);
      target = new T.Vector3(.2, 1.45, -1); dist = fit * 1.06 * view.dist;
    } else {
      const h = current ? current.h : 2.3, fit = Math.max((h * .62) / tan, (1.0) / (tan * camera.aspect));
      target = new T.Vector3(0, h * .5, 0); dist = fit * 1.1 * view.dist;
    }
    camera.position.set(target.x, target.y + Math.sin(view.pol) * dist, target.z + Math.cos(view.pol) * dist);
    camera.lookAt(target);
  }
  const clock = new T.Clock();
  let started = false;
  function frame() {
    const dt = Math.min(clock.getDelta(), .05);
    if (!view.lineup && current) {
      if (view.goal !== null) { view.yaw += (view.goal - view.yaw) * (1 - Math.exp(-dt * 7)); if (Math.abs(view.goal - view.yaw) < .002) { view.yaw = view.goal; view.goal = null; } }
      else if (view.spin && !drag) view.yaw += dt * .45;
      current.holder.rotation.y = view.yaw;
      current.f.update(dt);
    } else if (view.lineup) ids.forEach(id => figs[id] && figs[id].f.update(dt));
    place();
    renderer.render(scene, camera);
    if (!started) { started = true; $('loading').hidden = true; }
  }

  select(ids[0]);
  renderer.setAnimationLoop(frame);
  // Build the rest in the background, one per tick, so each card gets its picture.
  let next = 1;
  (function buildNext() {
    if (next >= ids.length) { releaseThumbs(); return; }
    const id = ids[next++];
    get(id);
    thumbnail(id);
    setTimeout(buildNext, 30);
  })();

  // Local inspection only: figures.html?debug exposes the stage.
  if (/[?&]debug\b/.test(location.search)) window.figDemo = { renderer, scene, camera, view, figs, get, select, setLineup, frame, place, resize };
})();
