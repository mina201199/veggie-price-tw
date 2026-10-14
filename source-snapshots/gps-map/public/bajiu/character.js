/* Approved Bajiu v4. Embedded GLB works on file:// as well as hosted pages.
   Character geometry stays static until a proper animation rig is authored. */
(function (global) {
  'use strict';
  let pending;
  function load(T) {
    if (!pending) pending = new Promise((resolve, reject) => {
      if (!T.GLTFLoader || !global.BAJIU_GLB) return reject(new Error('Bajiu loader or embedded model is missing'));
      const raw = atob(global.BAJIU_GLB), bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      new T.GLTFLoader().parse(bytes.buffer, '', gltf => resolve(gltf.scene), reject);
    });
    return pending;
  }
  global.BajiuCharacter = { load };
  const FK = global.FigureKit;
  if (!FK) return;
  const original = FK.create;
  if (FK.cast.taike) FK.cast.taike.name = '八酒';
  if (FK.cast.taike) FK.cast.taike.items = ['西瓜頭', '粗金項鍊', '彩色龍／鯉魚刺青', '窄版刷破牛仔褲', '藍色夾腳拖'];
  FK.create = function (T, id, opts) {
    if (id !== 'taike') return original(T, id, opts);
    opts = opts || {};
    const stand = original(T, id, opts), root = new T.Group(), target = stand.height();
    root.name = id; root.add(stand.root);
    let disposed = false, standIn = stand;
    const fig = {
      id, root, name: stand.name, spec: stand.spec,
      height() { root.updateMatrixWorld(true); return new T.Box3().setFromObject(root).max.y; },
      update(dt, ctx) { if (!disposed && standIn) standIn.update(dt, ctx); },
      dispose() { if (disposed) return; disposed = true; if (standIn) { standIn.dispose(); standIn = null; } root.clear(); }
    };
    fig.ready = load(T).then(scene => {
      if (disposed) return fig;
      const model = scene.clone(true); model.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(model), h = box.max.y - box.min.y;
      if (!Number.isFinite(h) || h <= 0) throw new Error('Bajiu model has invalid bounds');
      const holder = new T.Group(); holder.scale.setScalar(target / h); model.position.y -= box.min.y;
      model.traverse(o => { if (o.isMesh) { o.castShadow = !!opts.castShadow; o.receiveShadow = true; } });
      holder.add(model); root.remove(stand.root); stand.dispose(); standIn = null; root.add(holder);
      root.userData.modelSource = 'bajiu-v4';
      return fig;
    }).catch(err => { console.warn('Bajiu keeps fallback:', err.message); return fig; });
    return fig;
  };
})(typeof window !== 'undefined' ? window : globalThis);
