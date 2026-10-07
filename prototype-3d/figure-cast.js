/* The twelve market folk, after the user's turnaround sheets. Each define() dresses the shared FigureKit rig;
   hair, hats and props that only one character needs live here. Sides follow the character: L is her/his left (+x). */
(function (global) {
  'use strict';
  const FK = global.FigureKit, TAU = Math.PI * 2;
  // Linear table lookup by |angle from the front|: [[angle, value], ...].
  const byAngle = tab => phi => {
    const a = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)));
    for (let i = 1; i < tab.length; i++) if (a <= tab[i][0]) { const [a0, v0] = tab[i - 1], [a1, v1] = tab[i]; return v0 + (v1 - v0) * (a - a0) / (a1 - a0); }
    return tab[tab.length - 1][1];
  };

  // ---------- hair ----------
  function hairMats(k) {
    if (!k._hair) {
      const streak = k.canvas(128, 8, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 196 + Math.floor(59 * k.rand(x * 1.37)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); } });
      if (streak) streak.wrapS = streak.wrapT = k.T.RepeatWrapping;
      k._hair = {
        cap: k.track(new k.T.MeshStandardMaterial({ vertexColors: true, roughness: .62, map: streak })),
        strand: k.track(new k.T.MeshStandardMaterial({ vertexColors: true, roughness: .55, side: k.T.DoubleSide }))
      };
    }
    return k._hair;
  }
  // A shell over the skull down to a hairline: edge(phi) is the hairline's angle from the crown, color(phi, theta) its colour.
  function scalp(k, o) {
    const T = k.T, segU = 72, segV = 24, pos = [], col = [], uv = [], idx = [], v = new T.Vector3(), c = new T.Color();
    for (let i = 0; i <= segV; i++) for (let j = 0; j <= segU; j++) {
      const phi = j / segU * TAU - Math.PI, th = i / segV * o.edge(phi);
      k.headShape(v.set(Math.sin(phi) * Math.sin(th), Math.cos(th), Math.cos(phi) * Math.sin(th)));
      const L = typeof o.lift === 'function' ? o.lift(phi, th) : o.lift === undefined ? .018 : o.lift;
      pos.push(v.x * (k.HR.x + L), v.y * (k.HR.y + L), v.z * (k.HR.z + L));
      c.set(typeof o.color === 'function' ? o.color(phi, th) : o.color); col.push(c.r, c.g, c.b);
      uv.push(j / segU * 10, i / segV);
    }
    for (let i = 0; i < segV; i++) for (let j = 0; j < segU; j++) { const a = i * (segU + 1) + j, b = a + segU + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return k.add(g, hairMats(k).cap, o.parent || k.head);
  }
  const clumpTaper = t => (.6 + .4 * Math.min(1, t / .15)) * (1 - .85 * Math.max(0, (t - .55) / .45));
  function clump(k, pts, o) {
    return k.add(k.strand(pts, Object.assign({ width: .05, thick: .02, segs: 16, taper: clumpTaper }, o)), hairMats(k).strand, o.parent || k.head);
  }
  const dirOf = (k, phi, th) => k.V(Math.sin(phi) * Math.sin(th), Math.cos(th), Math.cos(phi) * Math.sin(th));
  // A point on the scalp at (phi, theta), lifted.
  const at = (k, phi, th, lift) => { const d = dirOf(k, phi, th); return k.surf(d.x, d.y, d.z, lift); };
  // Spiky clumps: each grows from the scalp at (phi, theta) and bends toward `dir`.
  function spikes(k, list, o) {
    for (const s of list) {
      const p0 = at(k, s[0], s[1], .01), n = p0.clone().normalize(), d = s[2] ? s[2].clone().normalize() : n;
      const len = s[3] || .14, p1 = p0.clone().addScaledVector(n, len * .45).addScaledVector(d, len * .2), p2 = p0.clone().addScaledVector(n, len * .5).addScaledVector(d, len * .75);
      clump(k, [p0, p1, p2], Object.assign({ width: .045, thick: .022, segs: 10, taper: t => 1 - .92 * t }, o, { colors: s[4] || o.colors }));
    }
  }
  // Perm curls: bumpy balls scattered over a band of the head.
  function curls(k, o) {
    const T = k.T, pts = [], N = o.N || 600;
    for (let i = 0; i < N; i++) {
      const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      const phi = Math.atan2(Math.sin(a) * r, Math.cos(a) * r), th = Math.acos(y);
      if (o.keep(phi, th)) pts.push({ phi, th, i });
    }
    const geo = new T.SphereGeometry(1, 9, 6), p = geo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + .13 * Math.sin(v.x * 7) * Math.sin(v.y * 7 + 1) * Math.sin(v.z * 7 + 2)); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const im = new T.InstancedMesh(geo, k.track(new T.MeshStandardMaterial({ roughness: .7 })), pts.length);
    const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), Sc = new T.Vector3(), c = new T.Color();
    pts.forEach((q, n) => {
      const rr = o.r[0] + (o.r[1] - o.r[0]) * k.rand(q.i + 3), lift = o.lift[0] + (o.lift[1] - o.lift[0]) * k.rand(q.i + 5);
      const pos = at(k, q.phi, q.th, (o.liftF ? o.liftF(q.phi, q.th) : 1) * lift);
      Q.setFromEuler(E.set(k.rand(q.i) * 6, k.rand(q.i + 1) * 6, 0));
      M.compose(pos, Q, Sc.set(rr, rr * .92, rr));
      im.setMatrixAt(n, M);
      im.setColorAt(n, c.set(o.colors[Math.floor(k.rand(q.i + 9) * o.colors.length)]));
    });
    (o.parent || k.head).add(im);
    return im;
  }
  function sweptBack(k, o) {
    const n = o.n || 15, L = o.lift || [.035, .085, .07, .045, .03];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1) * 2 - 1, sx = x * (o.spread || .62), edge = 1 - Math.abs(x) * .3;
      const dirs = [[sx * .6, .81, .58], [sx * .72, 1, .16], [sx * .78, .85, -.5], [sx * .72, .35, -.93], [sx * .55, -.12 - .1 * k.rand(i + 30), -1]];
      const pts = dirs.map(([dx, dy, dz], j) => k.surf(dx, dy, dz, j > 0 && j < 3 ? L[j] * edge : L[j]));
      clump(k, pts, { width: o.width || .075, thick: .03, segs: 26, colors: o.colors, taper: t => (.75 + .25 * Math.min(1, t / .1)) * (1 - .75 * Math.pow(t, 1.6)) });
    }
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const y = .48 - i * .12;
      clump(k, [k.surf(s * .72, y + .04, .52, .018), k.surf(s, y - .02, -.05, .018), k.surf(s * .85, y - .06, -.5, .018)], { width: .045, thick: .014, segs: 16, colors: o.side || o.colors, taper: t => 1 - .6 * t });
    }
  }
  // Standard short-hair hairline: forehead, temple, over the ear, nape.
  const shortEdge = (front, temple, ear, nape) => byAngle([[0, front], [.75, front + .1], [1.05, temple], [1.57, ear], [2.3, nape], [Math.PI, nape + .05]]);

  // ---------- headwear ----------
  // Bucket hat: a domed crown, a band and a brim all round. In head space; y/tilt lift and tip it back.
  function bucketHat(k, o) {
    const T = k.T, hat = k.G(k.head, 0, o.y || 0, o.z || 0);
    hat.rotation.x = o.tilt || 0;
    const m = k.cloth(o.color, { roughness: .95 }), rIn = o.r || .45, zs = .93;
    const crown = o.dome ? [[rIn, .1], [rIn * .98, .18], [rIn * .9, .27], [rIn * .74, .36], [rIn * .5, .42], [rIn * .25, .45], [0, .455]]
      : [[rIn, .1], [rIn + .006, .2], [rIn - .02, .32], [rIn - .08, .42], [rIn - .18, .49], [rIn - .32, .525], [0, .535]];
    k.add(k.lathe(crown.map(([r, y]) => [Math.max(r, 0), y]), { seg: 48, zs }), m, hat);
    if (o.band) k.add(k.lathe([[rIn + .01, .1], [rIn + .014, .16]], { seg: 48, zs }), k.cloth(o.band), hat);
    const out = o.brim || .2, drop = o.drop === undefined ? .07 : o.drop;
    k.add(k.lathe([[rIn + out, .1 - drop], [rIn + out * .55, .1 - drop * .4], [rIn, .1]], { seg: 48, zs }), m, hat);
    k.add(k.lathe([[rIn + out, .1 - drop - .012], [rIn + out + .006, .1 - drop]], { seg: 48, zs }), m, hat);
    if (o.seams) {
      const sm = k.cloth(o.seams);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU, pts = [];
        for (const [r, yy] of crown) pts.push(k.V(Math.sin(a) * (r + .006), yy + .002, Math.cos(a) * (r + .006) * zs));
        k.add(k.strand(pts, { width: .006, thick: .004, segs: 16, radial: 6 }), sm, hat);
      }
      k.add(new T.SphereGeometry(.035, 14, 10), m, hat, 0, crown[crown.length - 1][1], 0).scale.y = .6;
    }
    if (o.strap) {
      const sm = k.mat(o.strap, { roughness: .6 });
      for (const s of [-1, 1]) k.add(k.strand([k.V(s * .43, .08, .03), k.V(s * .38, -.2, .12), k.V(s * .12, -.38, .25), k.V(0, -.43, .26)], { width: .006, thick: .006, segs: 18, radial: 6 }), sm, hat);
      k.add(new T.SphereGeometry(.022, 12, 10), sm, hat, 0, -.45, .265);
      k.add(k.strand([k.V(0, -.45, .265), k.V(0, -.52, .27), k.V(0, -.58, .26)], { width: .005, thick: .005, segs: 8, radial: 6 }), sm, hat);
      k.add(new T.SphereGeometry(.016, 10, 8), sm, hat, 0, -.6, .26);
    }
    return hat;
  }
  // Scooter helmet: a glossy shell down to the brow, a dark rim, a clear visor, side snaps and a chin strap.
  function helmet(k, o) {
    const T = k.T, edge = byAngle([[0, 1.02], [.9, 1.2], [1.57, 1.72], [2.4, 1.9], [Math.PI, 1.9]]);
    const shellM = k.mat(o.color, { roughness: .35, clearcoat: .8, clearcoatRoughness: .25 }), dark = k.mat('#26292b', { roughness: .6 });
    const make = (lift, m) => {
      const segU = 64, segV = 22, pos = [], idx = [], v = new T.Vector3();
      for (let i = 0; i <= segV; i++) for (let j = 0; j <= segU; j++) {
        const phi = j / segU * TAU - Math.PI, th = i / segV * edge(phi);
        k.headShape(v.set(Math.sin(phi) * Math.sin(th), Math.cos(th), Math.cos(phi) * Math.sin(th)));
        pos.push(v.x * (k.HR.x + lift), v.y * (k.HR.y + lift) + .02, v.z * (k.HR.z + lift));
      }
      for (let i = 0; i < segV; i++) for (let j = 0; j < segU; j++) { const a = i * (segU + 1) + j, b = a + segU + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return k.add(g, m, k.head);
    };
    make(.085, shellM); make(.05, dark);
    const rim = [];
    for (let j = 0; j <= 64; j++) { const phi = j / 64 * TAU - Math.PI, d = dirOf(k, phi, edge(phi)), p = k.surf(d.x, d.y, d.z, .068); p.y += .02; rim.push(p); }
    k.add(k.strand(rim, { width: .02, thick: .02, segs: 96, radial: 8, closed: true }), dark, k.head);
    const visor = k.add(k.lathe([[.52, .1], [.5, .2], [.47, .27]], { seg: 32, zs: .98, range: () => [-1.05, 1.05] }), k.track(new T.MeshPhysicalMaterial({ color: '#cfd8dc', transparent: true, opacity: .35, roughness: .1, side: T.DoubleSide, depthWrite: false })), k.head);
    visor.renderOrder = 3;
    const silver = k.mat('#c9cdd2', { metalness: .9, roughness: .25 });
    for (const s of [-1, 1]) {
      k.add(new T.SphereGeometry(.026, 14, 10), silver, k.head, s * .47, .15, .14).scale.set(.5, 1, 1);
      k.add(new T.SphereGeometry(.02, 12, 8), silver, k.head, s * .45, .3, -.05).scale.set(.5, 1, 1);
      k.add(k.strand([k.V(s * .4, -.05, -.02), k.V(s * .33, -.3, .08), k.V(s * .1, -.43, .2), k.V(0, -.44, .22)], { width: .012, thick: .005, segs: 16, radial: 6 }), dark, k.head);
    }
    k.add(k.roundRect(.05, .03, .008, .012), k.mat('#c6403a', { roughness: .5 }), k.head, -.22, -.38, .2).rotation.y = -.5;
  }
  // A headscarf tied at the back: a shell over the crown, the knot and two tails.
  function bandana(k, o) {
    const T = k.T, m = typeof o.color === 'string' ? k.cloth(o.color) : k.mat({ pattern: o.pattern }, { roughness: .9 });
    const edge = byAngle([[0, o.front || .98], [1.0, 1.15], [1.57, 1.42], [2.4, 1.7], [Math.PI, 1.78]]);
    const segU = 64, segV = 20, pos = [], uv = [], idx = [], v = new T.Vector3();
    for (let i = 0; i <= segV; i++) for (let j = 0; j <= segU; j++) {
      const phi = j / segU * TAU - Math.PI, th = i / segV * edge(phi);
      k.headShape(v.set(Math.sin(phi) * Math.sin(th), Math.cos(th), Math.cos(phi) * Math.sin(th)));
      const L = .045 + .015 * Math.sin(i / segV * Math.PI) + (o.puff || 0) * Math.sin(i / segV * Math.PI);
      pos.push(v.x * (k.HR.x + L), v.y * (k.HR.y + L), v.z * (k.HR.z + L)); uv.push(j / segU * 6, i / segV * 2);
    }
    for (let i = 0; i < segV; i++) for (let j = 0; j < segU; j++) { const a = i * (segU + 1) + j, b = a + segU + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    k.add(g, m, k.head);
    const kn = k.add(new T.SphereGeometry(.07, 16, 12), m, k.head, 0, -.02, -.43); kn.scale.set(1.1, .9, .8);
    for (const s of [-1, 1]) {
      k.add(k.strand([k.V(s * .02, -.02, -.45), k.V(s * .12, -.06, -.5), k.V(s * .2, -.03 - (o.tailDrop || 0), -.46)], { width: .055, thick: .012, segs: 12, taper: t => 1 - .5 * t, up: () => k.V(0, 0, -1) }), m, k.head);
      k.add(new T.SphereGeometry(.05, 12, 10), m, k.head, s * .06, .0, -.44).scale.set(1.3, .8, .6);
    }
    return m;
  }

  // ---------- props ----------
  const steel = k => k.mat('#c5c9cf', { metalness: .85, roughness: .28 });
  function mic(k) {
    const T = k.T, g = new T.Group();
    k.add(new T.CylinderGeometry(.022, .016, .2, 16), k.mat('#1f1f23', { roughness: .45 }), g, 0, .02, 0);
    k.add(new T.CylinderGeometry(.027, .023, .028, 16), steel(k), g, 0, .13, 0);
    const dots = k.canvas(64, 64, (c, w, h) => { c.fillStyle = '#3a3b3f'; c.fillRect(0, 0, w, h); c.fillStyle = '#16171a'; for (let y = 2; y < h; y += 6) for (let x = 2; x < w; x += 6) { c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill(); } });
    if (dots) { dots.wrapS = dots.wrapT = T.RepeatWrapping; dots.repeat.set(3, 2); }
    k.add(new T.SphereGeometry(.044, 20, 14), k.track(new T.MeshStandardMaterial({ map: dots, roughness: .6, metalness: .3 })), g, 0, .175, 0);
    return g;
  }
  function wrench(k) {
    const T = k.T, g = new T.Group(), st = steel(k);
    k.add(k.roundRect(.044, .16, .02, .022), k.mat('#c62e2e', { roughness: .5 }), g, 0, -.01, 0);
    k.add(k.roundRect(.03, .12, .012, .012), st, g, 0, .11, 0);
    k.add(k.roundRect(.095, .062, .022, .018), st, g, .012, .2, 0);
    k.add(k.roundRect(.026, .055, .008, .016), st, g, .05, .25, 0);
    k.add(k.roundRect(.026, .042, .008, .016), st, g, -.026, .246, 0);
    k.add(new T.CylinderGeometry(.012, .012, .045, 12), k.mat('#9aa0a8', { metalness: .8, roughness: .35 }), g, .005, .175, 0).rotation.z = Math.PI / 2;
    return g;
  }
  function tongs(k) {
    const T = k.T, g = new T.Group(), st = steel(k);
    k.add(new T.TorusGeometry(.022, .008, 8, 16), st, g, 0, .13, 0);
    for (const s of [-1, 1]) {
      const arm = k.add(k.roundRect(.018, .34, .006, .006, .002), st, g, s * .016, -.03, 0);
      arm.rotation.z = -s * .07;
      k.add(k.roundRect(.03, .04, .01, .008, .002), st, g, s * .03, -.19, 0).rotation.z = -s * .07;
    }
    return g;
  }
  function spatula(k) {
    const T = k.T, g = new T.Group(), st = steel(k);
    k.add(new T.CylinderGeometry(.016, .014, .15, 12), k.mat('#232223', { roughness: .5 }), g, 0, 0, 0);
    k.add(k.roundRect(.016, .1, .004, .006, .002), st, g, 0, .12, 0);
    const blade = k.add(k.roundRect(.1, .12, .015, .008, .002), st, g, 0, .22, 0);
    blade.rotation.x = -.2;
    for (const x of [-.025, 0, .025]) k.add(k.roundRect(.008, .07, .004, .01, 0), k.mat('#3a3c40'), g, x, .225, .002).rotation.x = -.2;
    return g;
  }
  function fan(k) {
    const T = k.T, g = new T.Group(), straw = '#d4b07a';
    const weave = k.canvas(128, 128, (c, w, h) => {
      c.fillStyle = straw; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(140,100,50,.55)'; c.lineWidth = 2;
      for (let r = 6; r < 64; r += 7) { c.beginPath(); c.arc(64, 64, r, 0, TAU); c.stroke(); }
      for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.cos(a) * 64, 64 + Math.sin(a) * 64); c.stroke(); }
    });
    const disc = k.add(new T.CylinderGeometry(.13, .13, .008, 40), k.track(new T.MeshStandardMaterial({ map: weave, roughness: .9 })), g, 0, .2, 0);
    disc.rotation.x = Math.PI / 2;
    k.add(new T.TorusGeometry(.13, .008, 6, 48), k.mat('#a77b45', { roughness: .8 }), g, 0, .2, 0);
    k.add(new T.CylinderGeometry(.012, .012, .2, 10), k.mat('#a77b45', { roughness: .7 }), g, 0, .02, 0);
    return g;
  }
  function duster(k) {
    const T = k.T, g = new T.Group();
    k.add(new T.CylinderGeometry(.014, .016, .2, 12), k.mat('#6d4529', { roughness: .45 }), g, 0, -.02, 0);
    k.add(new T.SphereGeometry(.03, 12, 10), k.mat('#6d4529', { roughness: .45 }), g, 0, .09, 0);
    const n = 46, geo = new T.SphereGeometry(1, 10, 8), im = new T.InstancedMesh(geo, k.track(new T.MeshStandardMaterial({ roughness: 1 })), n);
    const M = new T.Matrix4(), Q = new T.Quaternion(), c = new T.Color(), cols = ['#8a6a52', '#b39a86', '#e6dacb', '#6e5442'];
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, r = Math.sqrt(i / n), dir = k.V(Math.cos(a) * r * .9, 1, Math.sin(a) * r * .9).normalize();
      const len = .1 + k.rand(i) * .05, pos = k.V(0, .1, 0).addScaledVector(dir, len * .9);
      Q.setFromUnitVectors(k.V(0, 1, 0), dir);
      M.compose(pos, Q, k.V(.024, len, .012)); im.setMatrixAt(i, M); im.setColorAt(i, c.set(cols[i % 4]));
    }
    g.add(im);
    return g;
  }
  function thermos(k) {
    const T = k.T, g = new T.Group(), black = k.mat('#202022', { roughness: .45 }), metal = k.mat('#c3c7cc', { metalness: .9, roughness: .22 });
    const loop = k.add(new T.TorusGeometry(.045, .011, 8, 20, Math.PI), black, g, 0, -.045, 0); loop.rotation.y = -Math.PI / 2;
    k.add(new T.CylinderGeometry(.05, .052, .04, 20), black, g, 0, -.06, 0);
    k.add(k.lathe([[0, -.3], [.05, -.298], [.058, -.28], [.058, -.1], [.052, -.08]], { seg: 28 }), metal, g);
    const side = k.add(new T.TorusGeometry(.04, .012, 8, 16, Math.PI), black, g, 0, -.17, .058); side.rotation.set(0, Math.PI / 2, -Math.PI / 2);
    return g;
  }
  function basket(k) {
    const T = k.T, g = new T.Group(), green = '#3f8f52';
    const grid = k.canvas(64, 64, (c, w, h) => { c.fillStyle = green; c.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) c.clearRect(x * 16 + 4, y * 16 + 4, 9, 9); });
    if (grid) { grid.wrapS = grid.wrapT = T.RepeatWrapping; }
    const gm = k.track(new T.MeshStandardMaterial({ map: grid, alphaTest: .5, side: T.DoubleSide, roughness: .5 }));
    if (grid) grid.repeat.set(1, 1);
    k.add(k.lathe([[.115, -.38], [.13, -.36], [.145, -.2]], { seg: 32, zs: 1.3, period: .04 }), gm, g);
    const solid = k.mat(green, { roughness: .5 });
    k.add(new T.CircleGeometry(.115, 24), solid, g, 0, -.379, 0).rotation.x = -Math.PI / 2;
    const rim = k.add(new T.TorusGeometry(.145, .01, 8, 32), solid, g, 0, -.2, 0); rim.rotation.x = Math.PI / 2; rim.scale.y = 1.3;
    const handle = k.add(new T.TorusGeometry(.188, .012, 8, 24, Math.PI), solid, g, 0, -.2, 0); handle.rotation.y = -Math.PI / 2;
    const white = k.mat('#f3f1e6', { roughness: .6 }), leek = k.mat('#4f9a3c', { roughness: .6 }), leaf = k.mat('#5ea546', { roughness: .7 });
    for (let i = 0; i < 4; i++) {
      const s = k.G(g, (i - 1.5) * .025, -.3, -.06 + i * .02);
      s.rotation.set(-.25 + i * .05, 0, (i - 1.5) * .12);
      k.add(new T.CylinderGeometry(.014, .016, .16, 10), white, s, 0, .05, 0);
      k.add(new T.CylinderGeometry(.012, .014, .2, 10), leek, s, 0, .23, 0);
      k.add(new T.CylinderGeometry(.005, .012, .08, 8), leek, s, .01, .36, 0).rotation.z = -.2;
    }
    for (let i = 0; i < 5; i++) { const b = k.add(new T.SphereGeometry(.05, 12, 10), leaf, g, (k.rand(i) - .5) * .12, -.2 + k.rand(i + 1) * .03, .04 + (k.rand(i + 2) - .5) * .14); b.scale.set(1, .8, 1); }
    k.add(new T.ConeGeometry(.02, .1, 10), k.mat('#ec7f2e', { roughness: .6 }), g, .06, -.2, .1).rotation.set(.5, 0, -.9);
    return g;
  }
  function tote(k) {
    const T = k.T, g = new T.Group(), m = k.mat({ pattern: 'floralCream' }, { roughness: .9 }), strap = k.mat('#7d9a64', { roughness: .7 });
    const bag = k.add(k.roundRect(.26, .25, .02, .07), m, g, 0, -.3, 0);
    bag.rotation.y = Math.PI / 2;
    for (const z of [-.08, .08]) for (const x of [-.03, .03]) k.add(k.strand([k.V(x, -.175, z), k.V(x * .5, -.06, z * .7), k.V(x * .3, 0, z * .1)], { width: .012, thick: .004, segs: 10, radial: 6 }), strap, g);
    return g;
  }
  function drawstringBag(k) {
    const T = k.T, g = new T.Group(), m = k.mat({ pattern: 'bearPrint' }, { roughness: .9 }), navy = k.mat('#2c3b75', { roughness: .7 });
    k.add(k.lathe([[0, -.27], [.08, -.265], [.1, -.22], [.098, -.15], [.075, -.11], [.06, -.1]], { seg: 28, period: .14 }), m, g);
    const top = k.add(k.lathe([[.06, -.1], [.075, -.085], [.06, -.075]], { seg: 28 }), m, g);
    for (const s of [-1, 1]) k.add(k.strand([k.V(0, -.1, s * .06), k.V(0, -.03, s * .05), k.V(0, 0, 0)], { width: .008, thick: .004, segs: 8, radial: 6 }), navy, g);
    k.add(new T.SphereGeometry(.012, 10, 8), navy, g, .05, -.115, .04);
    return g;
  }
  // Shopping trolley, standing on the floor with its handlebar at height h (origin on the floor under the bar).
  function trolley(k, h) {
    const T = k.T, g = new T.Group(), st = steel(k), black = k.mat('#1f1f22', { roughness: .5 });
    const plaid = k.mat({ pattern: 'tartan' }, { roughness: .9 }), dark = k.mat('#541623', { roughness: .8 });
    k.add(new T.CylinderGeometry(.022, .022, .2, 12), black, g, 0, h, 0).rotation.z = Math.PI / 2;
    for (const x of [-.085, .085]) k.add(k.strand([k.V(x, h, 0), k.V(x, h * .6, -.03), k.V(x, .12, -.06), k.V(x, .05, .02), k.V(x, .03, .14)], { width: .011, thick: .011, segs: 30, radial: 8 }), st, g);
    k.add(new T.CylinderGeometry(.009, .009, .2, 8), st, g, 0, .03, .14).rotation.z = Math.PI / 2;
    const bag = k.add(k.roundRect(.27, .5, .035, .2), plaid, g, 0, .4, .07);
    const flap = k.add(k.roundRect(.275, .15, .03, .025), plaid, g, 0, .6, .17); flap.rotation.x = -.06;
    k.add(k.roundRect(.275, .014, .004, .025), dark, g, 0, .528, .182);
    for (const x of [-.15, .15]) {
      const wheel = k.add(new T.CylinderGeometry(.08, .08, .04, 22), black, g, x, .08, -.06); wheel.rotation.z = Math.PI / 2;
      k.add(new T.CylinderGeometry(.04, .04, .043, 16), k.mat('#b9bdc3', { roughness: .4 }), g, x, .08, -.06).rotation.z = Math.PI / 2;
    }
    k.add(new T.CylinderGeometry(.01, .01, .32, 8), st, g, 0, .08, -.06).rotation.z = Math.PI / 2;
    return g;
  }
  // Walking stick from the floor to the fist, the crook under the hand.
  function cane(k, h) {
    const T = k.T, g = new T.Group(), wood = k.mat('#6a3f23', { roughness: .4, clearcoat: .4 });
    const crook = k.add(new T.TorusGeometry(.045, .017, 10, 20, Math.PI), wood, g, 0, h - .045, .045); crook.rotation.y = -Math.PI / 2;
    k.add(new T.CylinderGeometry(.017, .019, h - .045, 12), wood, g, 0, (h - .045) / 2, 0);
    k.add(new T.CylinderGeometry(.021, .021, .04, 12), k.mat('#2a2421', { roughness: .8 }), g, 0, .02, 0);
    k.add(new T.SphereGeometry(.018, 10, 8), wood, g, 0, h - .045, .09);
    return g;
  }

  // ---------- garments only one or two characters wear ----------
  // Bib apron: o { m, top, bottom, w (half-angle), pocket: { m, w, h, y }, ties: 'bow' | 'cross', strap }
  function apron(k, o) {
    const T = k.T, TZ = k.dims.TZ, w = o.w || .95, off = .036;
    const prof = [];
    for (let y = o.bottom; y <= .12 + 1e-6; y += .02) prof.push([y, y]);
    const below = y => Math.max(k.torsoR(-.14), .238) + (-.14 - y) * .12;
    k.add(k.lathe(prof.map(([, y]) => [0, y]), { seg: 30, zs: TZ, range: () => [-w, w], rad: (phi, y) => (y > -.14 ? k.torsoRad(off)(phi, y) : below(y) + off + .012) }), o.m, k.spine);
    const bw = o.bibW || .5;
    k.add(k.lathe(k.torsoProf(.1, o.top, 0), { seg: 22, zs: TZ, range: y => { const ww = bw + (w - bw) * (1 - Math.min(1, (y - .1) / .12)); return [-ww, ww]; }, rad: k.torsoRad(off) }), o.m, k.spine);
    const strapM = o.strapM || o.m;
    const tr = k.torsoPoint(bw * .9, o.top, off), tl = k.torsoPoint(-bw * .9, o.top, off);
    if (o.ties === 'cross') {
      for (const s of [-1, 1]) k.add(k.strand([s > 0 ? tr : tl, k.V(s * .16, .64, .02), k.V(s * .17, .62, -.12), k.torsoPoint(s * (Math.PI - .25), .4, .03), k.torsoPoint(-s * (Math.PI - .55), .12, .03)], { width: .028, thick: .006, segs: 30, axis: p => k.V(0, p.y, 0) }), strapM, k.spine);
    } else {
      k.add(k.strand([tl, k.V(-.11, .66, .03), k.V(0, .7, -.08), k.V(.11, .66, .03), tr], { width: .018, thick: .005, segs: 30, axis: p => k.V(0, p.y - .1, 0) }), strapM, k.spine);
    }
    k.add(k.lathe([[0, .1], [0, .135]], { seg: 48, zs: TZ, rad: k.torsoRad(off + .006), range: () => [w - .1, TAU - w + .1] }), strapM, k.spine);
    const back = k.torsoPoint(Math.PI, .12, off + .02);
    for (const s of [-1, 1]) {
      const loop = k.add(new T.TorusGeometry(.04, .012, 8, 16), strapM, k.spine, back.x + s * .045, back.y + .01, back.z - .01); loop.scale.set(1.2, .7, .5); loop.rotation.z = s * .4;
      k.add(k.strand([k.V(back.x + s * .01, back.y, back.z - .01), k.V(back.x + s * .04, back.y - .08, back.z - .015), k.V(back.x + s * .06, back.y - .16, back.z - .01)], { width: .02, thick: .005, segs: 10, up: () => k.V(0, 0, -1) }), strapM, k.spine);
    }
    k.add(new T.SphereGeometry(.018, 10, 8), strapM, k.spine, back.x, back.y + .01, back.z - .012);
    if (o.pocket) {
      const p = o.pocket;
      k.pocket(p.m || o.m, 0, p.y, p.w, p.h, { off: off + .012 });
    }
  }
  // Red quilted vest with white piping, zipped, two lower pockets.
  function vest(k, o) {
    const T = k.T, TZ = k.dims.TZ, off = .036, y0 = -.12, y1 = .6;
    k.add(k.lathe(k.torsoProf(y0, y1, 0), { seg: 56, zs: TZ, rad: k.torsoRad(off) }), o.m, k.spine);
    const trim = o.trim;
    k.add(k.lathe([[0, y0 - .012], [0, y0 + .008]], { seg: 56, zs: TZ, rad: (phi, y) => k.torsoRad(off + .006)(phi, y0) }), trim, k.spine);
    k.add(k.lathe([[0, y1 - .02], [0, y1 + .015]], { seg: 56, zs: TZ, rad: (phi, y) => k.torsoR(y1) + off + .004 }), trim, k.spine);
    const zip = []; for (let y = y0; y <= y1 + 1e-6; y += .04) zip.push(k.torsoPoint(0, y, off + .004));
    k.add(k.strand(zip, { width: .007, thick: .005, segs: 30, radial: 6, axis: p => k.V(0, p.y, 0) }), k.mat('#e9ecef', { metalness: .6, roughness: .3 }), k.spine);
    for (const a of Object.values(k.arms)) { const t = k.add(new T.TorusGeometry(a.ar + .03, .009, 8, 28), trim, a.sh, 0, -.02, 0); t.rotation.z = Math.PI / 2; t.rotation.y = Math.PI / 2; }
    for (const s of [-1, 1]) k.pocket(o.m, s * .45, -.0, .12, .085, { trim: '#f3efe7', off: off + .01 });
  }
  function rosette(k, a, y) {
    const T = k.T, g = new T.Group(), red = k.mat('#d42c34', { roughness: .6 }), white = k.mat('#f7f3ec', { roughness: .5 });
    for (let i = 0; i < 14; i++) { const ang = i / 14 * TAU, p = k.add(new T.SphereGeometry(.018, 8, 6), red, g, Math.cos(ang) * .036, Math.sin(ang) * .036, 0); p.scale.set(1, 1.4, .4); p.rotation.z = ang + Math.PI / 2; }
    k.add(new T.CylinderGeometry(.024, .024, .01, 18), white, g, 0, 0, .006).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const t = k.add(k.roundRect(.022, .07, .004, .004, .001), red, g, s * .016, -.06, -.002); t.rotation.z = s * .2; }
    return k.onTorso(g, a, y, .05);
  }
  function waistPouch(k, a, y, color) {
    const T = k.T, g = new T.Group(), m = k.mat(color, { roughness: .6 });
    k.add(k.roundRect(.15, .09, .03, .055), m, g);
    k.add(k.roundRect(.13, .006, .002, .004, 0), k.mat('#b48a3c', { metalness: .7, roughness: .35 }), g, 0, .022, .03);
    k.add(new T.BoxGeometry(.012, .02, .006), k.mat('#b48a3c', { metalness: .7, roughness: .35 }), g, .05, .015, .034);
    return k.onTorso(g, a, y, .075);
  }
  function glasses(k, color) {
    const T = k.T, m = k.mat(color, { roughness: .35 }), z0 = .385;
    for (const s of [-1, 1]) {
      const cx = s * .135, w = .11, h = .085, r = .03, pts = [];
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const x = Math.sign(ca) * Math.min(Math.abs(ca) * w * 1.25, w) , y = Math.sign(sa) * Math.min(Math.abs(sa) * h * 1.3, h);
        pts.push(k.V(cx + x, -.005 + y, z0 - Math.abs(x + cx) * .25));
      }
      k.add(k.strand(pts, { width: .011, thick: .008, segs: 60, radial: 6, closed: true, up: () => k.V(0, 0, 1) }), m, k.head);
      k.add(k.strand([k.V(cx + s * w, .02, z0 - .07), k.V(s * .36, .03, .16), k.V(s * .4, .02, -.02)], { width: .008, thick: .006, segs: 14, radial: 6 }), m, k.head);
    }
    k.add(k.strand([k.V(-.03, .025, z0 + .005), k.V(0, .04, z0 + .01), k.V(.03, .025, z0 + .005)], { width: .007, thick: .006, segs: 8, radial: 6 }), m, k.head);
  }
  // A thin overlay lathe on a forearm, for tattoos and grime.
  function sleeveDecal(k, side, map, from, to, period) {
    const a = k.arms[side], T = k.T, FL = k.dims.FL;
    const m = k.track(new T.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: .6, polygonOffset: true, polygonOffsetFactor: -1 }));
    const r0 = a.ar * .8, r1 = a.ar * .93;
    return k.add(k.lathe([[r0 + .004, -FL * to], [r1 + .004, -FL * from]], { seg: 24, period: period || .12 }), m, a.el);
  }
  function gloves(k, color) {
    const m = k.mat(color, { roughness: .7 }), T = k.T;
    for (const a of Object.values(k.arms)) {
      k.add(k.ell(.04, .068, .06, 18, 12), m, a.hand, 0, -.058, 0);
      k.add(new T.CylinderGeometry(.034, .036, .03, 16), m, a.hand, 0, .002, 0);
      for (const kn of a.knuckles) k.add(new T.CapsuleGeometry(.021, .006, 4, 8), m, kn, 0, -.004, 0);
      k.add(new T.CapsuleGeometry(.023, .006, 4, 8), m, a.thumb, 0, -.006, 0);
    }
  }
  function socks(k, color, h) {
    const T = k.T, m = k.cloth(color);
    for (const l of Object.values(k.legs)) k.add(k.lathe([[l.lr * .6, -k.dims.SL - .02], [l.lr * .64, -k.dims.SL + h]], { seg: 20 }), m, l.knee);
  }
  // Short-sleeve rolled cuffs and similar rings at the end of a sleeve.
  function goldChain(k) {
    const T = k.T, m = k.mat('#e0b23c', { metalness: .9, roughness: .22 }), n = 30, geo = new T.TorusGeometry(.017, .007, 6, 12);
    const im = new T.InstancedMesh(geo, m, n), M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler();
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, dip = Math.pow(Math.max(0, Math.cos(a)), 2) * .06;
      const p = k.V(Math.sin(a) * .15, .64 - dip, Math.cos(a) * .14 - .005 + Math.max(0, Math.cos(a)) * .05);
      Q.setFromEuler(E.set(Math.PI / 2 - Math.max(0, Math.cos(a)) * .6, a, i % 2 ? Math.PI / 2 : 0));
      M.compose(p, Q, k.V(1, 1, 1)); im.setMatrixAt(i, M);
    }
    k.spine.add(im);
  }

  // ---------- the cast ----------
  FK.define('grandma', {
    name: '買菜阿嬤', role: '推著菜籃車的常客', skin: '#f3cdb8', build: { girth: 1.1, belly: .45 },
    items: ['紫色漁夫帽', '碎花襯衫', '格紋菜籃車', '繡花包鞋'],
    build(k) {
      k.face({ brow: '#8a837e', browW: 11, wrinkles: 1, mouthW: .05, blush: 1.1 });
      const shirt = k.mat({ pattern: 'floralPurple' }, { roughness: .85 });
      k.top({ m: shirt, y0: -.17, sleeves: 'short', sleeveLen: .55 });
      k.collar('shirt', shirt);
      k.buttons(4, '#4a2a68', .02, .52, { off: .016 });
      k.pants({ m: k.cloth('#2a2524'), length: 'capri' });
      k.shoes({ type: 'slipon', color: '#7a2537', sole: '#ece5da', flower: '#ee5b72' });
      const greys = ['#77736f', '#9b9693', '#bdb8b4'];
      scalp(k, { edge: shortEdge(.7, .9, 1.5, 2.05), color: '#8a8582', lift: .01 });
      curls(k, { N: 1300, keep: (phi, th) => th > .55 && th < (Math.abs(phi) < .8 ? .95 : 2.15) && !(Math.abs(phi) < .55 && th > .85), r: [.033, .05], lift: [.025, .055], colors: greys });
      bucketHat(k, { color: '#b99fd6', band: '#8b64b5', strap: '#7b55a6', y: .07, tilt: -.12, brim: .2, drop: .06 });
      k.pose({ R: { pitch: .22, abd: .34, bend: .18, wrist: [0, 1.45, 0], curl: 1.3, thumb: .8 }, L: { pitch: .04, abd: .2, bend: .25, curl: .5 } });
      k.arms.R.anchored = true;
      const p = k.gripPoint('R'), t = trolley(k, p.y);
      t.position.set(p.x, 0, p.z);
      k.body.add(t);
    }
  });

  FK.define('chief', {
    name: '里長伯', role: '拿著麥克風廣播的里長', skin: '#f2cdb4', build: { girth: 1.06, belly: .3 },
    items: ['紅色背心', '彩帶胸花', '麥克風', '圓框眼鏡'],
    build(k) {
      k.face({ brow: '#2b221e', browW: 16, browShape: 'flat', mouthW: .055, browY: .15 });
      const polo = k.cloth('#a8c6ea');
      k.top({ m: polo, sleeves: 'short', sleeveLen: .62 });
      k.collar('polo', polo);
      vest(k, { m: k.cloth('#d6262f', { roughness: .95 }), trim: k.mat('#f3efe7', { roughness: .7 }) });
      rosette(k, -.42, .38);
      waistPouch(k, .62, -.02, '#26345a');
      k.pants({ m: k.cloth('#474a54'), length: 'long', loose: 1.05 });
      k.shoes({ type: 'leather', color: '#7b4a2a', sole: '#3a2a20', laces: '#5a3520', shiny: true });
      const dark = '#2e2826', grey = '#8e8a86';
      scalp(k, { edge: shortEdge(.62, .95, 1.42, 2.0), lift: .03, color: (phi, th) => Math.abs(Math.sin(phi)) > .62 && Math.abs(phi) < 2.1 && th > 1.0 ? grey : dark });
      sweptBack(k, { colors: [dark, '#3d3532'], side: [grey, '#a29e9a'], lift: [.035, .09, .075, .045, .03] });
      glasses(k, '#3b2a24');
      k.pose({ R: { pitch: .7, abd: .5, bend: .45, twist: .2, wrist: [0, 1.5, 0], curl: .12, thumb: 0 }, L: { pitch: .18, abd: .2, bend: .45 } });
      k.hold('L', mic(k), [0, 0, 0], [Math.PI / 2 + 1.6, 0, 0]);
    }
  });

  FK.define('mechanic', {
    name: '修車師傅', role: '機車行的黑手', skin: '#ebbb9a', build: { girth: 1.06, belly: .2 },
    items: ['連身工作服', '肩上毛巾', '活動扳手', '工具腰包'],
    build(k) {
      k.face({ brow: '#221a16', browW: 16, browShape: 'flat', stubble: 1, dirt: 1, mouthW: .055 });
      const cov = k.mat({ pattern: 'coverall' }, { roughness: .9 }), roll = k.cloth('#8994a0');
      k.top({ m: k.cloth('#8f9195'), y0: .3, off: .008 });
      k.top({ m: cov, y0: -.14, off: .03, open: y => .4 * k.smooth(.38, .62, y), sleeves: 'short', sleeveLen: .6, cuff: { m: roll, h: .04 } });
      k.collar('shirt', cov, { open: .55 });
      for (const s of [-1, 1]) k.pocket(cov, s * .5, .33, .1, .1, { flap: true, off: .03 });
      k.pants({ m: cov, length: 'long', loose: 1.1, cuff: { m: roll, h: .05 } });
      k.belt('#3d5a6c', null, .12);
      const knot = k.torsoPoint(.1, .12, .05);
      k.add(new k.T.SphereGeometry(.03, 12, 10), cov, k.spine, knot.x, knot.y, knot.z).scale.set(1.3, .8, .7);
      for (const s of [-1, 1]) k.add(k.strand([knot.clone(), k.V(knot.x + s * .03, knot.y - .06, knot.z + .01), k.V(knot.x + s * .02, knot.y - .12, knot.z)], { width: .022, thick: .006, segs: 8, up: () => k.V(0, 0, 1) }), cov, k.spine);
      for (const l of Object.values(k.legs)) { const pk = k.add(k.roundRect(.09, .1, .015, .025), cov, l.hip, l.s * .118, -.2, 0); pk.rotation.y = l.s * Math.PI / 2; }
      k.shoes({ type: 'boot', color: '#2a2522', sole: '#171514', laces: '#3a3330', soleH: .04, wide: 1.06 });
      k.towel('R', {});
      const smudge = k.pattern('smudge');
      for (const s of ['L', 'R']) sleeveDecal(k, s, smudge, .05, .95, .4);
      scalp(k, { edge: shortEdge(.6, .95, 1.45, 2.0), lift: .025, color: '#251f1c' });
      const sp = [], dk = ['#211b18', '#342c28'], gr = ['#6f6a66', '#8f8a86'];
      for (let i = 0; i < 50; i++) {
        const phi = (k.rand(i) * 2 - 1) * Math.PI, th = .05 + k.rand(i + 1) * (Math.abs(phi) < 1 ? .6 : .95), out = dirOf(k, phi, th);
        sp.push([phi, th, k.V(out.x * .5 + (k.rand(i + 5) - .5) * .6, .8 + k.rand(i + 6) * .4, out.z * .4 - .25 + (k.rand(i + 7) - .5) * .5), .09 + k.rand(i + 2) * .06, k.rand(i + 3) > .82 ? gr : dk]);
      }
      for (let i = 0; i < 6; i++) sp.push([(i - 2.5) * .22, .55, k.V((i - 2.5) * .15, -.55, 1), .13, dk]);
      spikes(k, sp, { width: .085, thick: .042, taper: t => 1 - .7 * t });
      const pouch = k.G(k.spine);
      k.add(k.roundRect(.12, .14, .02, .05), k.mat('#7a5233', { roughness: .7 }), pouch);
      for (const [x, c, hgt] of [[-.03, '#c62e2e', .07], [.0, '#d8b23a', .09], [.03, '#c62e2e', .06]]) k.add(new k.T.CylinderGeometry(.009, .009, hgt, 8), k.mat(c, { roughness: .5 }), pouch, x, .07 + hgt / 2 - .02, 0);
      k.add(new k.T.CylinderGeometry(.004, .004, .07, 6), steel(k), pouch, .015, .1, 0);
      k.onTorso(pouch, 1.25, -.06, .09);
      k.pose({ R: { pitch: .12, abd: .24, bend: .35, curl: 1.3 }, L: { pitch: .04, abd: .22, bend: .25, curl: .6 } });
      k.hold('R', wrench(k), [0, 0, 0], [Math.PI / 2 + .9, 0, -.3]);
    }
  });

  FK.define('grandpa', {
    name: '散步阿公', role: '拄著拐杖逛市場', skin: '#f1ccb4', build: { girth: 1.03, belly: .25 },
    items: ['米色襯衫', '木頭拐杖', '紅色佛珠', '黑布鞋'],
    build(k) {
      k.face({ brow: '#a7a29d', browW: 17, wrinkles: 2, mouthW: .05 });
      const beige = k.cloth('#e9dfcd');
      k.top({ m: k.cloth('#f6f4ee'), y0: .04, off: .012 });
      k.top({ m: beige, y0: .04, off: .03, open: y => .2 + .26 * k.smooth(.25, .62, y), sleeves: 'short', sleeveLen: .62 });
      k.collar('open', beige, { open: .5 });
      k.pocket(beige, .62, .36, .085, .085, { off: .038 });
      k.belt('#4b3325', '#a9acb1', .1);
      const brown = k.cloth('#7b5c45');
      k.pants({ m: brown, length: 'long', waist: .11, cuff: { m: brown, h: .04 } });
      k.shoes({ type: 'slipon', color: '#24201e', sole: '#efebe3' });
      k.beads('L', '#8b1f2a', 13);
      const g1 = '#9d9995', g2 = '#c9c6c2';
      scalp(k, { edge: shortEdge(.66, .98, 1.45, 2.0), lift: .03, color: (phi, th) => th > 1.1 ? '#a8a5a1' : g1 });
      sweptBack(k, { colors: [g2, g1], side: ['#aeaaa6', g1], lift: [.035, .11, .09, .05, .032], width: .08 });
      k.pose({ R: { pitch: .22, abd: .3, bend: .25, wrist: [0, 1.5, 0], curl: 1.3, thumb: .8 }, L: { pitch: .05, abd: .2, bend: .35, curl: .55 }, head: [.04, 0, 0] });
      k.arms.R.anchored = true;
      const p = k.gripPoint('R'), c = cane(k, p.y + .03);
      c.position.set(p.x, 0, p.z);
      k.body.add(c);
    }
  });

  FK.define('courier', {
    name: '外送員', role: '騎車送餐的外送小姐', skin: '#f6d3bf', build: { girth: .98 },
    items: ['青綠安全帽', '黃色連帽外套', '外送保溫箱', '露指手套'],
    build(k) {
      k.face({ brow: '#5a3b2c', browW: 10, lashes: true, mouthW: .045 });
      const yellow = k.cloth('#e9b53c'), rib = k.mat({ pattern: 'rib', tint: '#e2a92f' }, { roughness: .9 });
      k.top({ m: k.cloth('#f7f5f0'), y0: .25, off: .008 });
      k.top({ m: yellow, y0: -.16, off: .034, open: y => .22 * k.smooth(.3, .6, y), sleeves: 'long', cuff: { m: rib, h: .05 }, hem: { m: rib, h: .045 } });
      const zip = []; for (let y = -.2; y <= .5; y += .05) zip.push(k.torsoPoint(.03, y, .04));
      k.add(k.strand(zip, { width: .005, thick: .004, segs: 20, radial: 6, axis: p => k.V(0, p.y, 0) }), k.mat('#f0f0f0', { metalness: .5, roughness: .3 }), k.spine);
      const hood = k.add(new k.T.TorusGeometry(.15, .045, 10, 36, Math.PI * 1.25), yellow, k.spine, 0, .62, -.02);
      hood.geometry.rotateZ(Math.PI / 2 - Math.PI * .625); hood.geometry.rotateX(-Math.PI / 2); hood.scale.set(1, 1, .9);
      const black = k.cloth('#2c2a2b');
      k.pants({ m: black, length: 'long', taper: true, cuff: { m: black, h: .05 } });
      for (const l of Object.values(k.legs)) { const pk = k.add(k.roundRect(.08, .1, .015, .025), black, l.hip, l.s * .12, -.2, 0); pk.rotation.y = l.s * Math.PI / 2; }
      k.shoes({ type: 'sneaker', color: '#f0efed', sole: '#d6d6d6', accent: '#9a9a9a', laces: '#ffffff' });
      gloves(k, '#232222');
      const hair = ['#5f3c2a', '#7a5038'];
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) clump(k, [at(k, s * (.55 + i * .17), 1.0, .04), at(k, s * (.62 + i * .18), 1.3, .05), at(k, s * (.66 + i * .2), 1.62 + i * .05, .04)], { width: .05, thick: .018, segs: 14, colors: hair });
      for (let i = 0; i < 5; i++) clump(k, [at(k, -.3 + i * .15, 1.0, .04), at(k, -.32 + i * .16, 1.1, .05)], { width: .05, thick: .018, segs: 8, colors: hair });
      const tail = k.V(0, -.13, -.46);
      for (let i = 0; i < 7; i++) {
        const o = (i - 3) * .016;
        clump(k, [tail.clone(), k.V(o, -.19, -.56), k.V(o * 1.4 + .02, -.36, -.58), k.V(o + .03, -.56 + k.rand(i) * .05, -.52)], { width: .052, thick: .028, segs: 20, colors: hair, taper: t => .9 - .7 * t });
      }
      k.add(new k.T.TorusGeometry(.035, .014, 8, 16), k.mat('#2a2a2a'), k.head, 0, -.15, -.5).rotation.x = .9;
      helmet(k, { color: '#2e9c95' });
      // Insulated delivery box on the back, with straps over the shoulders and a phone harness in front.
      const box = k.G(k.spine, 0, .32, -.47), coral = k.mat('#f2806e', { roughness: .8 }), edgeM = k.mat('#a8453f', { roughness: .8 }), refl = k.mat('#eef0f3', { roughness: .25, metalness: .3, emissive: '#6d7178' });
      k.add(k.roundRect(.6, .54, .06, .36, .018), coral, box);
      for (const y of [-.16, .16]) k.add(k.roundRect(.652, .042, .004, .4, .002), refl, box, 0, y, 0);
      for (const x of [-.322, .322]) k.add(k.roundRect(.016, .57, .006, .4, .002), edgeM, box, x, 0, 0);
      const strapM = k.mat('#7a2a2e', { roughness: .7 });
      for (const s of [-1, 1]) k.add(k.strand([k.V(s * .14, .56, -.29), k.V(s * .17, .67, -.05), k.V(s * .2, .61, .15), k.torsoPoint(s * .72, .45, .045), k.torsoPoint(s * 1.35, .32, .045)], { width: .03, thick: .008, segs: 24, axis: p => k.V(0, p.y, 0) }), strapM, k.spine);
      k.add(k.lathe([[0, .29], [0, .325]], { seg: 48, zs: k.dims.TZ, rad: k.torsoRad(.045), range: () => [-1.1, 1.1] }), k.mat('#1d1d1f', { roughness: .7 }), k.spine);
      const phone = k.G(k.spine), pm = k.mat('#1b1b1d', { roughness: .4 });
      k.add(k.roundRect(.09, .15, .015, .02), pm, phone);
      k.add(k.roundRect(.1, .05, .01, .03), k.mat('#2c2c2e', { roughness: .6 }), phone, 0, -.04, -.012);
      k.onTorso(phone, 0, .31, .075);
      k.pose({ R: { pitch: .04, abd: .42, bend: .12, curl: .45 }, L: { pitch: .04, abd: .42, bend: .12, curl: .45 } });
    }
  });

  FK.define('auntie', {
    name: '菜市場阿姨', role: '提著菜籃的老主顧', skin: '#f2c8b0', build: { girth: 1.16, belly: .55 },
    items: ['捲捲燙髮', '透明遮陽帽', '花襯衫', '綠色菜籃'],
    build(k) {
      k.face({ brow: '#3a2620', browW: 13, lashes: true, mouthW: .06, blush: 1.2 });
      const shirt = k.mat({ pattern: 'hibiscus' }, { roughness: .85 });
      k.top({ m: shirt, y0: -.16, open: y => .3 * k.smooth(.45, .64, y), sleeves: 'short', sleeveLen: .55 });
      k.collar('shirt', shirt, { open: .5 });
      k.buttons(3, '#b8382c', .05, .4, { off: .016 });
      k.towel('neck', { stripe: '#d9666b' });
      const brown = k.cloth('#3b2c27');
      k.pants({ m: brown, length: 'capri', cuff: { m: brown, h: .045 } });
      k.shoes({ type: 'sandal', color: '#d23f40', sole: '#c4373a' });
      const browns = ['#3a241e', '#4d3027', '#2d1b16'];
      scalp(k, { edge: shortEdge(.75, 1.0, 1.6, 2.15), color: '#3a241e', lift: .02 });
      curls(k, { N: 1450, keep: (phi, th) => th < (Math.abs(phi) < .7 ? .86 : 2.2), r: [.034, .05], lift: [.012, .035], liftF: (phi, th) => 1 + .35 * Math.sin(Math.min(th, 1.8) / 1.8 * Math.PI) * (Math.abs(phi) > .6 ? 1 : .2), colors: browns });
      // Headband and a clear pink sun visor.
      const red = k.mat('#d24a52', { roughness: .5 }), band = [];
      for (let j = 0; j <= 48; j++) { const phi = j / 48 * TAU - Math.PI, f = Math.abs(phi) / Math.PI, d = dirOf(k, phi, .98 - .25 * f), p = k.surf(d.x, d.y, d.z, .03 + .07 * Math.min(1, f * 2.2)); band.push(p); }
      k.add(k.strand(band, { width: .028, thick: .012, segs: 64, radial: 6, closed: true, axis: () => k.V(0, .1, 0) }), red, k.head);
      const vis = k.add(k.lathe([[.66, .2], [.57, .24], [.48, .265]], { seg: 32, zs: 1.04, range: () => [-.85, .85] }), k.track(new k.T.MeshPhysicalMaterial({ color: '#ee7f97', transparent: true, opacity: .55, roughness: .12, side: k.T.DoubleSide, depthWrite: false })), k.head);
      const visEdge = []; for (let j = 0; j <= 24; j++) { const a = -.85 + 1.7 * j / 24; visEdge.push(k.V(Math.sin(a) * .66, .2, Math.cos(a) * .66 * 1.04)); }
      k.add(k.strand(visEdge, { width: .006, thick: .006, segs: 30, radial: 6 }), k.track(new k.T.MeshStandardMaterial({ color: '#e46a84', transparent: true, opacity: .8, roughness: .2 })), k.head);
      vis.renderOrder = 3;
      k.pose({ R: { pitch: .08, abd: .28, bend: .2, curl: 1.3 }, L: { pitch: .04, abd: .24, bend: .25, curl: .55 } });
      k.hold('R', basket(k), [0, 0, 0], [0, 0, -.15]);
    }
  });

  FK.define('uncle', {
    name: '汗衫阿伯', role: '提著水壺散步的阿伯', skin: '#e8b893', build: { girth: 1.24, belly: 1 },
    items: ['白色汗衫', '藍條毛巾', '保溫水壺', '藍白拖'],
    build(k) {
      k.face({ brow: '#3b3634', browW: 15, browShape: 'flat', blushLines: true, mouthW: .06, blush: 1.1 });
      const white = k.cloth('#f5f3ee');
      k.top({ m: white, y0: -.16, y1: .47 });
      for (const s of [-1, 1]) k.add(k.strand([k.torsoPoint(s * .52, .46, .016), k.V(s * .19, .62, .06), k.V(s * .2, .63, -.06), k.torsoPoint(s * (Math.PI - .52), .46, .016)], { width: .035, thick: .006, segs: 20, axis: p => k.V(0, p.y - .2, 0) }), white, k.spine);
      k.towel('neck', { stripe: '#4d63b8' });
      k.pants({ m: k.cloth('#2c3c74'), length: 'shorts', stripe: '#f2f2f2', loose: 1.1 });
      k.shoes({ type: 'flipflop', color: '#2f4ea3', sole: '#f0f0f0', sole2: '#3654a8' });
      const c1 = '#3f3a3b', c2 = '#5d5859';
      scalp(k, { edge: shortEdge(.6, .92, 1.42, 2.0), lift: .022, color: (phi, th) => th > 1.15 ? c2 : c1 });
      const sp = [];
      for (let i = 0; i < 95; i++) { const phi = (k.rand(i + 11) * 2 - 1) * Math.PI, th = .04 + k.rand(i + 12) * (Math.abs(phi) < 1 ? .62 : 1.0), out = dirOf(k, phi, th); sp.push([phi, th, k.V(out.x * .5, 1, out.z * .5 - .15), .05 + k.rand(i) * .035, k.rand(i + 4) > .7 ? [c2, '#777273'] : [c1, c2]]); }
      spikes(k, sp, { width: .05, thick: .03, taper: t => 1 - .7 * t });
      k.pose({ L: { pitch: .06, abd: .3, bend: .25, curl: 1.3 }, R: { pitch: .04, abd: .28, bend: .2, curl: .55 } });
      k.hold('L', thermos(k), [0, 0, 0], [0, 0, .1]);
    }
  });

  FK.define('housewife', {
    name: '家庭主婦', role: '打掃完順路來買菜', skin: '#f6d6c4', build: { girth: 1 },
    items: ['格紋圍裙', '包包頭鯊魚夾', '雞毛撢子', '花布提袋'],
    build(k) {
      k.face({ brow: '#5b3b2c', browW: 10, lashes: true, mouthW: .05 });
      const coral = k.cloth('#ec8b7d');
      k.top({ m: coral, sleeves: 'short', sleeveLen: .6 });
      k.collar('crew', coral);
      const ging = k.mat({ pattern: 'gingham' }, { roughness: .9 });
      apron(k, { m: ging, top: .44, bottom: -.36, w: .95, bibW: .5, pocket: { y: -.12, w: .2, h: .12 } });
      const tw = k.G(k.spine), tp = k.torsoPoint(-.12, -.06, .07);
      k.add(k.roundRect(.07, .1, .01, .02), k.mat('#efe3d3', { roughness: .9 }), tw);
      for (const y of [-.02, -.035]) k.add(k.roundRect(.072, .006, .002, .022, 0), k.mat('#9b7a62'), tw, 0, y, .001);
      tw.position.copy(tp); tw.rotation.y = -.1;
      const stripe = k.mat({ pattern: 'pinstripe' }, { roughness: .9 });
      k.pants({ m: stripe, length: 'long', loose: 1.08, cuff: { m: stripe, h: .06 } });
      k.shoes({ type: 'slide', color: '#f4a9b8', sole: '#f6b9c4', fuzzy: true });
      const hc = ['#5e3a29', '#6f4632'];
      scalp(k, { edge: shortEdge(.62, .95, 1.2, 1.9), lift: .01, color: (phi, th) => Math.abs(phi) < .03 && th < .6 ? '#3d251a' : hc[0] });
      for (let i = 0; i < 16; i++) { const phi = (i / 15 * 2 - 1) * 2.6; clump(k, [at(k, phi * .3, .62, .025), at(k, phi * .6, .4, .04), at(k, 0, .5, .06).setZ(-.2).setY(.3)], { width: .06, thick: .02, segs: 14, colors: hc }); }
      for (let i = 0; i < 14; i++) { const phi = Math.PI + (i / 13 * 2 - 1) * 1.6; clump(k, [at(k, phi, 1.82, .004), at(k, phi * .98 + (phi > Math.PI ? -.1 : .1), 1.2, .022), k.V(0, .24, -.32)], { width: .06, thick: .016, segs: 14, colors: hc, taper: t => (.25 + .75 * Math.min(1, t / .35)) * (1 - .5 * Math.max(0, t - .7) / .3) }); }
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) clump(k, [at(k, s * (.7 + i * .08), .85, .02), at(k, s * (.78 + i * .08), 1.25, .03), at(k, s * (.76 + i * .1), 1.62, .035).add(k.V(0, 0, .02))], { width: .013, thick: .01, segs: 14, colors: hc, taper: t => 1 - .8 * t });
      const bun = k.G(k.head, 0, .26, -.3);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, b = k.add(new k.T.TorusGeometry(.07, .042, 10, 20, Math.PI * 1.3), k.mat('#6a412f', { roughness: .6 }), bun, 0, 0, 0); b.rotation.set(a, .6, a * .5); }
      k.add(new k.T.SphereGeometry(.09, 16, 12), k.mat('#5e3a29', { roughness: .6 }), bun);
      const clip = k.G(k.head, 0, .2, -.42), cm = k.mat('#e7cba4', { roughness: .4 });
      clip.rotation.x = -.7;
      k.add(k.roundRect(.16, .05, .015, .03), cm, clip);
      for (let i = 0; i < 4; i++) k.add(k.roundRect(.016, .06, .006, .02), cm, clip, -.06 + i * .04, -.04, 0);
      k.pose({ R: { pitch: .1, abd: .3, bend: .3, curl: 1.3 }, L: { pitch: .06, abd: .26, bend: .3, curl: 1.3 } });
      k.hold('R', duster(k), [0, 0, 0], [Math.PI / 2 + 1.25, 0, 0]);
      k.hold('L', tote(k), [0, 0, 0], [0, 0, .12]);
    }
  });

  FK.define('griller', {
    name: '烤肉攤老闆', role: '夜市烤肉攤顧爐的老闆', skin: '#e5b08b', build: { girth: 1.1, belly: .35 },
    items: ['深藍頭巾', '橘色圍裙', '烤肉夾', '竹編扇'],
    build(k) {
      k.face({ brow: '#231b17', browW: 16, browShape: 'flat', mouth: 'open', mouthW: .065, stubble: .9, blush: 1.1 });
      const grey = k.cloth('#a9a8a6');
      k.top({ m: grey, sleeves: 'short', sleeveLen: .65 });
      k.collar('crew', grey);
      apron(k, { m: k.cloth('#c9622d'), top: .42, bottom: -.34, w: .9, bibW: .52, pocket: { y: -.1, w: .2, h: .12 } });
      k.towel('L', { stripe: '#4d63b8' });
      k.pants({ m: k.cloth('#252323'), length: 'shorts', loose: 1.1 });
      k.shoes({ type: 'clog', color: '#2a3045', sole: '#232838', holes: true, wide: 1.08 });
      scalp(k, { edge: shortEdge(.6, .95, 1.5, 2.05), lift: .02, color: '#1f1a18' });
      spikes(k, [-.5, -.3, -.12, .08, .28, .48].map((phi, i) => [phi, 1.0, k.V(phi * .3, -.6, 1), .07, ['#1f1a18', '#2e2724']]), { width: .045, thick: .02 });
      bandana(k, { color: '#2f3658', front: 1.0, tailDrop: .02 });
      k.pose({ R: { pitch: .1, abd: .26, bend: .3, curl: 1.3 }, L: { pitch: .1, abd: .28, bend: .35, curl: 1.3 } });
      k.hold('R', tongs(k), [0, 0, 0], [Math.PI / 2 + 1.25, 0, 0]);
      k.hold('L', fan(k), [0, 0, 0], [.35, 0, .2]);
    }
  });

  FK.define('kid', {
    name: '幼稚園小朋友', role: '放學跟家人來買菜', skin: '#f8d9c7', scale: .86, build: { head: 1.1, legs: .88, girth: .92, arm: .9, leg: .9 },
    items: ['黃色小帽', '小熊後背包', '束口袋', '魔鬼氈球鞋'],
    build(k) {
      k.face({ brow: '#2b211c', browW: 11, eyeRx: .074, eyeRy: .088, mouthW: .045, blush: 1.25 });
      const blue = k.cloth('#8db6ea');
      k.top({ m: blue, y0: -.14, sleeves: 'short', sleeveLen: .62 });
      k.collar('polo', blue);
      k.buttons(3, '#ffffff', .1, .5, { off: .016 });
      k.pocket(blue, .5, .38, .085, .08, { off: .028 });
      k.pants({ m: k.cloth('#2c3a6e'), length: 'shorts', loose: 1.08 });
      socks(k, '#fafaf8', .12);
      k.shoes({ type: 'sneaker', color: '#f6f6f4', sole: '#eceef2', accent: '#6f93d8', wide: 1.04 });
      for (const l of Object.values(k.legs)) for (const z of [.05, .1]) k.add(k.roundRect(.13, .02, .006, .012), k.mat('#6f93d8', { roughness: .6 }), l.ankle, 0, -k.dims.AH + .095, z).rotation.x = -.5;
      const hair = '#1e1816';
      scalp(k, { edge: shortEdge(.95, 1.25, 1.55, 1.95), lift: .028, color: hair });
      for (let i = 0; i < 15; i++) { const phi = (i / 14 * 2 - 1) * 1.05; clump(k, [at(k, phi * .4, .3, .03), at(k, phi, .8, .045), at(k, phi, 1.12 + Math.abs(phi) * .15, .04)], { width: .05, thick: .02, segs: 12, colors: [hair, '#2b2320'], taper: t => 1 - .25 * t }); }
      bucketHat(k, { color: '#f3cd45', y: .05, tilt: -.08, brim: .15, drop: .12, seams: '#dcb22f', r: .44, dome: true });
      const pack = k.G(k.spine, 0, .3, -.33), navy = k.mat('#25336a', { roughness: .7 }), yel = k.mat('#f0c63d', { roughness: .6 });
      k.add(k.roundRect(.36, .38, .06, .16, .02), navy, pack);
      k.add(k.roundRect(.37, .14, .05, .17, .015), yel, pack, 0, .14, 0);
      const bear = k.G(pack, 0, -.02, -.085);
      bear.rotation.y = Math.PI;
      k.add(new k.T.CylinderGeometry(.055, .055, .01, 20), k.mat('#9b6a44'), bear).rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) k.add(new k.T.CylinderGeometry(.022, .022, .01, 14), k.mat('#9b6a44'), bear, s * .045, .045, 0).rotation.x = Math.PI / 2;
      k.add(new k.T.CylinderGeometry(.025, .025, .012, 14), k.mat('#e3c39c'), bear, 0, -.015, .002).rotation.x = Math.PI / 2;
      k.add(k.roundRect(.15, .02, .006, .005), k.mat('#dfe2e6', { roughness: .3 }), pack, 0, -.13, -.085);
      for (const s of [-1, 1]) k.add(k.strand([k.V(s * .12, .5, -.27), k.V(s * .16, .65, -.05), k.V(s * .19, .6, .14), k.torsoPoint(s * .7, .44, .035), k.torsoPoint(s * 1.35, .3, .035)], { width: .032, thick: .008, segs: 24, axis: p => k.V(0, p.y, 0) }), navy, k.spine);
      k.pose({ L: { pitch: .06, abd: .3, bend: .25, curl: 1.3 }, R: { pitch: .04, abd: .28, bend: .2, curl: .55 } });
      k.hold('L', drawstringBag(k), [0, 0, 0], [0, 0, .1]);
    }
  });

  FK.define('taike', {
    name: '台客小哥', role: '穿藍白拖來喝飲料', skin: '#f2ccb3', build: { girth: 1 },
    items: ['油頭推剪', '金項鍊', '黑色胸包', '刺青', '破洞牛仔褲'],
    build(k) {
      k.face({ brow: '#2a201b', browW: 15, browShape: 'flat', browSlit: true, mouthW: .05 });
      const black = k.cloth('#262423');
      k.top({ m: black, y0: -.18, sleeves: 'short', sleeveLen: .72, flare: .03 });
      k.collar('crew', black);
      goldChain(k);
      const denim = k.mat({ pattern: 'denim' }, { roughness: .95 });
      k.pants({ m: denim, length: 'long', taper: true, cuff: { m: denim, h: .06 } });
      for (const l of Object.values(k.legs)) for (let i = 0; i < 3; i++) k.add(k.roundRect(.05 - i * .008, .006, .002, .004, 0), k.mat('#f1f2f4', { roughness: .9 }), l.knee, (k.rand(i) - .5) * .02, .02 - i * .016, l.lr + .03);
      k.shoes({ type: 'flipflop', color: '#2f4ea3', sole: '#f0f0f0', sole2: '#3654a8' });
      const tat = k.pattern('tribal');
      sleeveDecal(k, 'L', tat, .2, .75);
      const bag = k.G(k.spine), bm = k.mat('#1c1b1c', { roughness: .45 });
      k.add(k.roundRect(.2, .1, .04, .07), bm, bag);
      k.add(k.roundRect(.18, .006, .002, .005, 0), k.mat('#4a4a4a', { metalness: .6, roughness: .3 }), bag, 0, .02, .037);
      k.onTorso(bag, .28, .3, .07).rotation.z = -.25;
      k.add(k.strand([k.torsoPoint(.65, .37, .05), k.torsoPoint(.95, .55, .03), k.V(-.17, .62, .05), k.V(-.19, .62, -.08), k.torsoPoint(-2.4, .4, .03), k.torsoPoint(2.4, .1, .03), k.torsoPoint(1.6, .15, .04), k.torsoPoint(.8, .25, .05)], { width: .02, thick: .006, segs: 50, axis: p => k.V(0, p.y, 0) }), bm, k.spine);
      const side = '#3a2d26', top = ['#8d6c57', '#a78670'];
      const skinC = new k.T.Color(k.skin), sideC = new k.T.Color(side), edgeT = shortEdge(.62, .95, 1.45, 2.05);
      scalp(k, { edge: edgeT, lift: (phi, th) => th < .75 ? .02 : .004,
        color: (phi, th) => th < .75 ? '#7a5c4a' : sideC.clone().lerp(skinC, Math.min(.75, Math.max(0, (th - edgeT(phi) + .45) / .45) * .75)) });
      const sp = [];
      for (let i = 0; i < 30; i++) { const phi = (k.rand(i + 21) * 2 - 1) * 2.6, th = .1 + k.rand(i + 22) * .7; sp.push([phi, th, k.V(Math.sin(phi) * .2, .8, .5), .1 + k.rand(i + 23) * .07, top]); }
      for (let i = 0; i < 7; i++) sp.push([(i - 3) * .14, .6, k.V(0, .7, 1), .13, top]);
      spikes(k, sp, { width: .055, thick: .025 });
      k.pose({ L: { pitch: .03, abd: .22, bend: .2, curl: .6 }, R: { pitch: .03, abd: .22, bend: .2, curl: .6 } });
    }
  });

  FK.define('cook', {
    name: '自助餐阿姨', role: '自助餐檯後面打菜', skin: '#f2ccb5', build: { girth: 1.12, belly: .4 },
    items: ['碎花頭巾', '綠色圍裙', '鍋鏟', '夾子'],
    build(k) {
      k.face({ brow: '#3a2620', browW: 12, lashes: true, mouth: 'open', mouthW: .06, blush: 1.15 });
      const yel = k.cloth('#f0dc98');
      k.top({ m: yel, sleeves: 'short', sleeveLen: .62, cuff: { m: k.cloth('#e6cf86'), h: .035 } });
      k.collar('polo', yel);
      apron(k, { m: k.cloth('#2f8f74'), top: .44, bottom: -.3, w: .92, bibW: .5, ties: 'cross', pocket: { y: -.08, w: .2, h: .11 } });
      const black = k.cloth('#2b2827');
      k.pants({ m: black, length: 'capri', loose: 1.05, cuff: { m: black, h: .045 } });
      k.shoes({ type: 'clog', color: '#232120', sole: '#1a1918', wide: 1.06 });
      const hc = ['#3a261f', '#4b3229'];
      scalp(k, { edge: shortEdge(.75, 1.05, 1.6, 2.1), lift: .02, color: hc[0] });
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) clump(k, [at(k, s * (.08 + i * .2), .9, .05), at(k, s * (.4 + i * .2), 1.05, .06), at(k, s * (.85 + i * .12), 1.3 + i * .06, .05)], { width: .05, thick: .02, segs: 14, colors: hc });
      for (const s of [-1, 1]) clump(k, [at(k, s * 1.05, 1.2, .04), at(k, s * 1.1, 1.5, .05), at(k, s * 1.0, 1.8, .06).add(k.V(0, 0, .03))], { width: .022, thick: .012, segs: 12, colors: hc, taper: t => 1 - .8 * t });
      const bun = k.add(new k.T.SphereGeometry(.12, 16, 12), k.mat(hc[0], { roughness: .6 }), k.head, 0, -.17, -.38); bun.scale.set(1.1, .9, .8);
      bandana(k, { pattern: 'bandana', front: .95, puff: .015 });
      k.pose({ R: { pitch: .1, abd: .28, bend: .3, curl: 1.3 }, L: { pitch: .1, abd: .28, bend: .3, curl: 1.3 } });
      k.hold('R', spatula(k), [0, 0, 0], [Math.PI / 2 + 1.25, 0, 0]);
      k.hold('L', tongs(k), [0, 0, 0], [Math.PI / 2 + 1.25, 0, 0]);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
