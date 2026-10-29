/* Market folk modelled in Blender (blender/*_build.py, exported as GLB), driven like FigureKit figures.
   FigureGLB.create(T, id, opts) returns what FigureKit.create returns — { id, root, name, spec, height(), update(dt, ctx),
   dispose() } — plus `ready`, a promise for when the model is in. Until then, and for good if the GLB can't load (opened
   from file://, no GLTFLoader), the code-built FigureKit figure stands in. The GLB is scaled to that figure's height so
   cameras framed on height() stay right after the swap. Needs vendor/GLTFLoader.js and figure-kit.js + figure-cast.js. */
(function (global) {
  'use strict';
  const MODELS = { grandma: 'models/grandma.glb' };
  const scenes = {};  // url -> Promise of the loaded scene; every figure gets its own clone (meshes are shared)

  function load(T, url) {
    if (!scenes[url]) scenes[url] = new Promise((resolve, reject) => {
      if (!T.GLTFLoader) { reject(new Error('vendor/GLTFLoader.js is not loaded')); return; }
      new T.GLTFLoader().load(url, gltf => resolve(gltf.scene), undefined, reject);
    });
    return scenes[url];
  }

  // Walk cycle on the pivots grandma_build.py exports: hip_L / hip_R swing the legs, shoulder_L the free arm
  // (the right hand stays on the trolley handle), head_pivot drifts a little like the FigureKit heads.
  function animate(T, scene, opts) {
    const node = n => scene.getObjectByName(n);
    const hips = [[1, node('hip_L')], [-1, node('hip_R')]].filter(([, h]) => h), arm = node('shoulder_L'), head = node('head_pivot');
    const head0 = head ? head.rotation.clone() : null;
    scene.traverse(o => { if (o.isMesh) o.castShadow = !!opts.castShadow; });
    let time = Math.random() * 10, ph = 0, W = 0;
    return function update(dt, ctx) {
      dt = Math.min(dt || 0, .05);
      time += dt;
      const speed = (ctx && ctx.speed) || 0;
      W += ((speed > .05 ? 1 : 0) - W) * (1 - Math.exp(-dt * 8));
      ph += dt * (4 + speed * 2.8);
      for (const [s, hip] of hips) hip.rotation.x = -.42 * Math.sin(ph + (s > 0 ? Math.PI : 0)) * W;
      if (arm) arm.rotation.x = .35 * Math.sin(ph) * W + .025 * Math.sin(time * 1.1);
      scene.position.y = .025 * (Math.abs(Math.cos(ph)) - .5) * W;
      if (head) head.rotation.set(head0.x + .025 * Math.sin(time * .6), head0.y + .04 * Math.sin(time * .37), head0.z + .03 * Math.sin(time * .5));
    };
  }

  function create(T, id, opts) {
    opts = opts || {};
    const stand = global.FigureKit.create(T, id, opts);
    const root = new T.Group();
    root.name = id;
    root.add(stand.root);
    let update = stand.update, standIn = stand;
    const height = () => { root.updateMatrixWorld(true); return new T.Box3().setFromObject(root).max.y; };
    const fig = {
      id, root, name: stand.name, spec: stand.spec, height,
      update: (dt, ctx) => update(dt, ctx),
      dispose() { if (standIn) standIn.dispose(); }  // the GLB meshes are shared between copies and kept
    };
    fig.ready = load(T, MODELS[id]).then(scene => {
      const target = height(), model = scene.clone(true);
      model.updateMatrixWorld(true);
      const h = new T.Box3().setFromObject(model).max.y;
      const holder = new T.Group();
      holder.scale.setScalar(target / h);
      holder.add(model);
      update = animate(T, model, opts);
      update(0);
      root.remove(stand.root);
      stand.dispose();
      standIn = null;
      root.add(holder);
      return fig;
    }).catch(err => {
      console.warn(`FigureGLB: ${id} stays code-built (${err && err.message || err})`);
      return fig;
    });
    return fig;
  }

  global.FigureGLB = { create, has: id => id in MODELS, models: MODELS };
})(typeof window !== 'undefined' ? window : globalThis);
