/* FigureKit: chibi market-folk figurines built from code after the user's approved character sheets.
   Everyone shares one rig (about three heads tall) and a painted face; each character in figure-cast.js
   dresses itself through the builder `k` handed to its build(k):

     k.body({...}) is done for you from spec.build; then k.face(), k.top(), k.pants(), k.shoes(), k.pose(), k.hold() ...

   const fig = FigureKit.create(THREE, 'grandma');
   scene.add(fig.root);
   fig.update(dt);   // idle: breathing, blinking, a little sway */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rand = s => { const h = Math.sin(s * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); };
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

  // ---------- geometry helpers ----------
  function spline(T, pts, n) {
    const c = new T.SplineCurve(pts.map(p => new T.Vector2(p[0], p[1])));
    return c.getPoints(n).map(v => [v.x, v.y]);
  }
  // Surface of revolution round Y from a profile [[r, y], ...] listed bottom to top. Angle 0 faces +z (front) and grows
  // toward +x. opt.range(y) -> [a0, a1] limits the arc (open fronts, aprons); opt.rad(phi, y, r) reshapes it (bellies,
  // pleats); opt.zs squashes front to back. UVs are in world units / opt.period, so prints keep one scale on every part.
  function lathe(T, prof, opt) {
    opt = opt || {};
    const seg = opt.seg || 40, zs = opt.zs || 1, P = opt.period || .25, rows = prof.length;
    const pos = [], uv = [], idx = [];
    let v = 0;
    for (let i = 0; i < rows; i++) {
      const [r0, y] = prof[i];
      if (i) v += Math.hypot(r0 - prof[i - 1][0], y - prof[i - 1][1]);
      const [a0, a1] = opt.range ? opt.range(y) : [0, TAU];
      for (let j = 0; j <= seg; j++) {
        const phi = a0 + (a1 - a0) * j / seg, r = opt.rad ? opt.rad(phi, y, r0) : r0;
        pos.push(Math.sin(phi) * r, y, Math.cos(phi) * r * zs);
        uv.push(phi * r0 / P, v / P);
      }
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  // A tapered ribbon-like tube along a curve; its thin axis faces away from axis(p). Hair clumps, towels, straps.
  function strand(T, points, o) {
    const curve = new T.CatmullRomCurve3(points, !!o.closed, 'catmullrom', .5);
    const segs = o.segs || 24, radial = o.radial || 8;
    const pos = [], nor = [], uv = [], col = [], idx = [];
    const P = new T.Vector3(), Tn = new T.Vector3(), O = new T.Vector3(), S = new T.Vector3(), V = new T.Vector3(), N = new T.Vector3();
    const c0 = new T.Color(o.colors ? o.colors[0] : '#ffffff'), c1 = new T.Color(o.colors ? o.colors[1] || o.colors[0] : '#ffffff'), c = new T.Color();
    const axis = o.axis || (() => new T.Vector3());
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      curve.getPointAt(t, P);
      curve.getTangentAt(t, Tn);
      if (o.up) O.copy(o.up(P, t)); else O.copy(P).sub(axis(P));
      O.addScaledVector(Tn, -O.dot(Tn));
      if (O.lengthSq() < 1e-8) O.set(0, 0, 1);
      O.normalize();
      S.crossVectors(Tn, O).normalize();
      const k = o.taper ? o.taper(t) : 1, w = o.width * k, th = o.thick * k;
      c.copy(c0).lerp(c1, t).multiplyScalar(o.shade || 1);
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * TAU, ca = Math.cos(a), sa = Math.sin(a);
        V.copy(P).addScaledVector(S, ca * w).addScaledVector(O, sa * th);
        N.copy(S).multiplyScalar(ca / Math.max(w, 1e-4)).addScaledVector(O, sa / Math.max(th, 1e-4)).normalize();
        pos.push(V.x, V.y, V.z); nor.push(N.x, N.y, N.z); uv.push(t, j / radial); col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }
  // A rounded-rectangle slab in XY, extruded along +z by depth: pockets, bags, boxes, soles.
  function roundRect(T, w, h, r, depth, bevel) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    bevel = bevel === undefined ? Math.min(.01, depth * .4) : bevel;
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
    g.translate(0, 0, -depth / 2);
    return g;
  }

  // ---------- printed fabrics, drawn once per figure on small tiling canvases ----------
  function petals(g, x, y, r, n, fill, center, rot) {
    g.fillStyle = fill;
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * TAU;
      g.beginPath(); g.ellipse(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .55, r * .36, a, 0, TAU); g.fill();
    }
    if (center) { g.fillStyle = center; g.beginPath(); g.arc(x, y, r * .26, 0, TAU); g.fill(); }
  }
  function tiled(g, S, x, y, draw) { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) draw(x + dx, y + dy); }
  const PATTERNS = {
    weave: (g, S) => {
      g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 1600; i++) { const v = 214 + Math.floor(rand(i) * 41); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rand(i + .3) * S, rand(i + .7) * S, 1 + rand(i + .1) * 3, 1); }
    },
    floralPurple: (g, S) => {
      g.fillStyle = '#6a3f8e'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) tiled(g, S, rand(i + 5) * S, rand(i + 9) * S, (x, y) => { g.fillStyle = 'rgba(176,150,214,.75)'; g.beginPath(); g.ellipse(x, y, 9, 4, rand(i) * 3, 0, TAU); g.fill(); });
      for (let i = 0; i < 9; i++) tiled(g, S, rand(i + 1) * S, rand(i + 2) * S, (x, y) => petals(g, x, y, 20 + rand(i + 3) * 8, 5, i % 3 ? '#e0405a' : '#f18aa0', '#f5d27a', rand(i) * 3));
      for (let i = 0; i < 10; i++) tiled(g, S, rand(i + 40) * S, rand(i + 41) * S, (x, y) => petals(g, x, y, 8, 5, '#c9a8e8', '#f3d0e0', rand(i)));
    },
    hibiscus: (g, S) => {
      g.fillStyle = '#d8473b'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 16; i++) tiled(g, S, rand(i + 70) * S, rand(i + 71) * S, (x, y) => { g.fillStyle = '#4e8a46'; g.beginPath(); g.ellipse(x, y, 14, 6, rand(i) * 3, 0, TAU); g.fill(); });
      for (let i = 0; i < 8; i++) tiled(g, S, rand(i + 11) * S, rand(i + 12) * S, (x, y) => petals(g, x, y, 26 + rand(i) * 8, 5, i % 2 ? '#f7b487' : '#f28c55', '#c4402f', rand(i + 2) * 3));
    },
    tartan: (g, S) => {
      g.fillStyle = '#a8263c'; g.fillRect(0, 0, S, S);
      const band = (p, w, c, vert) => { g.fillStyle = c; if (vert) g.fillRect(p, 0, w, S); else g.fillRect(0, p, S, w); };
      for (const vert of [false, true]) {
        band(S * .1, S * .22, 'rgba(70,14,30,.55)', vert); band(S * .6, S * .22, 'rgba(70,14,30,.55)', vert);
        band(S * .05, 3, 'rgba(20,10,14,.85)', vert); band(S * .38, 4, 'rgba(20,10,14,.85)', vert); band(S * .86, 3, 'rgba(20,10,14,.85)', vert);
        band(S * .47, 2, 'rgba(255,255,255,.9)', vert);
      }
    },
    gingham: (g, S) => {
      g.fillStyle = '#f2f1e8'; g.fillRect(0, 0, S, S);
      const n = 8, w = S / n;
      g.fillStyle = 'rgba(132,186,152,.55)';
      for (let i = 0; i < n; i += 2) { g.fillRect(i * w, 0, w, S); g.fillRect(0, i * w, S, w); }
    },
    pinstripe: (g, S) => {
      g.fillStyle = '#bcbac2'; g.fillRect(0, 0, S, S);
      g.fillStyle = '#f4f3f6';
      for (let i = 0; i < 8; i++) g.fillRect(i * S / 8, 0, S / 26, S);
    },
    floralCream: (g, S) => {
      g.fillStyle = '#f3ecdf'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 10; i++) tiled(g, S, rand(i + 80) * S, rand(i + 81) * S, (x, y) => { g.fillStyle = '#7fa06d'; g.beginPath(); g.ellipse(x + 10, y + 12, 8, 4, .7, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x - 9, y + 13, 8, 4, -.7, 0, TAU); g.fill(); petals(g, x, y, 14, 5, '#ec8f9c', '#f7d58b', rand(i)); });
    },
    bandana: (g, S) => {
      g.fillStyle = '#a3243a'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 12; i++) tiled(g, S, rand(i + 21) * S, rand(i + 22) * S, (x, y) => petals(g, x, y, 11 + rand(i) * 6, 5, '#f6e9e6', '#a3243a', rand(i)));
      g.fillStyle = 'rgba(255,240,236,.8)';
      for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rand(i + 90) * S, rand(i + 91) * S, 1.6, 0, TAU); g.fill(); }
    },
    bearPrint: (g, S) => {
      g.fillStyle = '#f3ece0'; g.fillRect(0, 0, S, S);
      const dots = ['#f0a24a', '#8fbf5a', '#f2cf54', '#e9776a'];
      for (let i = 0; i < 18; i++) tiled(g, S, rand(i + 31) * S, rand(i + 32) * S, (x, y) => { g.fillStyle = dots[i % 4]; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); });
      for (let i = 0; i < 4; i++) tiled(g, S, (i % 2 + .25 + (i > 1 ? .5 : 0)) * S / 2, (i > 1 ? .72 : .25) * S, (x, y) => {
        g.fillStyle = '#9b6a44';
        for (const sx of [-1, 1]) { g.beginPath(); g.arc(x + sx * 17, y - 16, 9, 0, TAU); g.fill(); }
        g.beginPath(); g.arc(x, y, 22, 0, TAU); g.fill();
        g.fillStyle = '#e3c39c'; g.beginPath(); g.ellipse(x, y + 7, 10, 8, 0, 0, TAU); g.fill();
        g.fillStyle = '#2b1d16'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(x + sx * 8, y - 4, 2.6, 0, TAU); g.fill(); }
        g.beginPath(); g.arc(x, y + 4, 3, 0, TAU); g.fill();
      });
    },
    denim: (g, S) => {
      g.fillStyle = '#7d9cc2'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 2400; i++) { const v = rand(i + .5); g.fillStyle = v > .5 ? 'rgba(220,232,246,.25)' : 'rgba(40,62,100,.22)'; g.fillRect(rand(i) * S, rand(i + .2) * S, 3, 1); }
    },
    coverall: (g, S) => {
      g.fillStyle = '#3f5c70'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 1800; i++) { const v = rand(i + .5); g.fillStyle = v > .5 ? 'rgba(120,150,170,.18)' : 'rgba(18,30,40,.16)'; g.fillRect(rand(i) * S, rand(i + .2) * S, 2, 1); }
    },
    rib: (g, S) => {
      for (let x = 0; x < S; x++) { const v = 222 + 33 * Math.cos(x / S * TAU * 12); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, S); }
    },
    tribal: (g, S) => {
      g.clearRect(0, 0, S, S);
      g.fillStyle = '#2a2622';
      g.fillRect(0, S * .08, S, S * .06); g.fillRect(0, S * .86, S, S * .06);
      for (let i = 0; i < 8; i++) {
        const x = i * S / 8;
        g.beginPath(); g.moveTo(x, S * .2); g.lineTo(x + S / 16, S * .45); g.lineTo(x + S / 8, S * .2); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(x, S * .8); g.lineTo(x + S / 16, S * .55); g.lineTo(x + S / 8, S * .8); g.closePath(); g.fill();
      }
    },
    smudge: (g, S) => {
      g.clearRect(0, 0, S, S);
      for (let i = 0; i < 4; i++) tiled(g, S, rand(i + 50) * S, rand(i + 51) * S, (x, y) => { const r = 22 + rand(i) * 20, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(60,48,40,.38)'); gr.addColorStop(1, 'rgba(40,32,26,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); });
    }
  };

  // ---------- the painted chibi face ----------
  const FACE = { size: 512, half: .36 };
  function drawFace(g, F, blink) {
    const S = FACE.size, U = S / (2 * FACE.half), X = x => S / 2 + x * U, Y = y => S / 2 - y * U;
    g.clearRect(0, 0, S, S);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // cheeks
    for (const s of [-1, 1]) {
      const bx = X(s * F.blushX), by = Y(F.blushY);
      if (F.blushLines) {
        g.strokeStyle = `rgba(214,104,96,${.55 * F.blush})`; g.lineWidth = 4;
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(bx - 14 + i * 9, by + 8); g.lineTo(bx - 4 + i * 9, by - 8); g.stroke(); }
      }
      const r = g.createRadialGradient(bx, by, 0, bx, by, 34);
      r.addColorStop(0, `rgba(240,128,124,${.42 * F.blush})`); r.addColorStop(1, 'rgba(240,128,124,0)');
      g.fillStyle = r; g.fillRect(bx - 40, by - 40, 80, 80);
    }
    // age lines: forehead, crow's feet, smile folds
    if (F.wrinkles) {
      g.strokeStyle = 'rgba(150,96,74,.45)'; g.lineWidth = 3;
      for (let i = 0; i < F.wrinkles + 1; i++) { const y = Y(.24 + i * .035); g.beginPath(); g.moveTo(X(-.13 + i * .02), y + 4); g.quadraticCurveTo(X(0), y - 6, X(.13 - i * .02), y + 4); g.stroke(); }
      for (const s of [-1, 1]) {
        const ex = X(s * (F.eyeX + F.eyeRx + .02)), ey = Y(F.eyeY);
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(ex, ey + i * 7); g.lineTo(ex + s * 12, ey + i * 11); g.stroke(); }
        g.beginPath(); g.moveTo(X(s * .055), Y(-.1)); g.quadraticCurveTo(X(s * .1), Y(-.16), X(s * .085), Y(-.21)); g.stroke();
        g.beginPath(); g.moveTo(X(s * (F.eyeX - .05)), Y(F.eyeY - F.eyeRy - .025)); g.quadraticCurveTo(X(s * F.eyeX), Y(F.eyeY - F.eyeRy - .04), X(s * (F.eyeX + .05)), Y(F.eyeY - F.eyeRy - .022)); g.stroke();
      }
    }
    if (F.dirt) for (const [x, y, r] of [[.17, -.1, 26], [.21, -.05, 16], [-.04, -.27, 14]]) {
      const gr = g.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), r);
      gr.addColorStop(0, 'rgba(70,58,50,.55)'); gr.addColorStop(1, 'rgba(70,58,50,0)'); g.fillStyle = gr; g.fillRect(X(x) - r, Y(y) - r, 2 * r, 2 * r);
    }
    if (F.stubble) {
      g.fillStyle = `rgba(52,40,34,${.55 * F.stubble})`;
      for (let i = 0; i < 260; i++) {
        const a = rand(i + 7) * Math.PI, rr = .18 + rand(i + 9) * .14, x = Math.cos(a) * rr * 1.05, y = -.13 - Math.sin(a) * rr * .72;
        if (y > -.2 && Math.abs(x) < .09) continue;   // keep the lips clear
        if (Math.abs(x) > .25) continue;
        g.beginPath(); g.arc(X(x), Y(y), 1.4, 0, TAU); g.fill();
      }
    }
    // brows
    for (const s of [-1, 1]) {
      const bx = X(s * F.eyeX), by = Y(F.browY), w = F.browLen * U;
      g.strokeStyle = F.brow; g.lineWidth = F.browW;
      g.beginPath();
      if (F.browShape === 'flat') { g.moveTo(bx - s * w * .55, by + 2); g.quadraticCurveTo(bx, by - 6, bx + s * w * .55, by + 4); }
      else { g.moveTo(bx - s * w * .55, by + 6); g.quadraticCurveTo(bx + s * w * .05, by - 14, bx + s * w * .55, by + 2); }
      g.stroke();
      if (F.browSlit && s > 0) {   // a shaved slit through the outer end of the left brow
        g.save(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(bx + w * .22, by - 14); g.lineTo(bx + w * .14, by + 12); g.stroke(); g.restore();
      }
      if (F.browW > 14) { g.lineWidth = F.browW * .45; g.beginPath(); g.moveTo(bx - s * w * .62, by + 9); g.lineTo(bx - s * w * .5, by + 2); g.stroke(); }
    }
    // eyes
    for (const s of [-1, 1]) {
      const ex = X(s * F.eyeX), ey = Y(F.eyeY), rx = F.eyeRx * U, ry = F.eyeRy * U;
      g.strokeStyle = '#2a1a12';
      if (blink || F.eyes === 'closed') {
        g.lineWidth = 7; g.beginPath(); g.moveTo(ex - rx, ey); g.quadraticCurveTo(ex, ey + ry * .55, ex + rx, ey); g.stroke();
        continue;
      }
      g.save();
      g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, TAU); g.fillStyle = '#fffdfa'; g.fill(); g.clip();
      const ix = ex - s * rx * .04, iy = ey + ry * .1, ir = Math.min(rx, ry) * .92;
      let gr = g.createRadialGradient(ix, iy + ir * .45, ir * .1, ix, iy, ir);
      gr.addColorStop(0, F.iris[0]); gr.addColorStop(.6, F.iris[1]); gr.addColorStop(1, F.iris[2]);
      g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, ir * .92, ir, 0, 0, TAU); g.fill();
      g.fillStyle = '#120905'; g.beginPath(); g.ellipse(ix, iy, ir * .42, ir * .46, 0, 0, TAU); g.fill();
      gr = g.createLinearGradient(0, ey - ry, 0, ey - ry * .2);
      gr.addColorStop(0, 'rgba(60,34,22,.45)'); gr.addColorStop(1, 'rgba(60,34,22,0)'); g.fillStyle = gr; g.fillRect(ex - rx, ey - ry, 2 * rx, ry);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(ix + s * ir * .32, iy - ir * .4, ir * .3, ir * .34, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(ix - s * ir * .34, iy + ir * .4, ir * .12, 0, TAU); g.fill();
      g.restore();
      g.lineWidth = 6;
      g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      if (F.lashes) { g.lineWidth = 4; g.beginPath(); g.moveTo(ex + s * rx * .9, ey - ry * .35); g.lineTo(ex + s * rx * 1.25, ey - ry * .6); g.stroke(); }
    }
    // mouth
    const mx = X(0), my = Y(F.mouthY), mw = F.mouthW * U;
    if (F.mouth === 'open') {
      g.beginPath(); g.moveTo(mx - mw, my - 4); g.quadraticCurveTo(mx, my + 4, mx + mw, my - 4); g.quadraticCurveTo(mx + mw * .6, my + mw * 1.1, mx, my + mw * 1.1);
      g.quadraticCurveTo(mx - mw * .6, my + mw * 1.1, mx - mw, my - 4); g.closePath();
      g.fillStyle = '#8f3438'; g.fill();
      g.save(); g.clip();
      g.fillStyle = '#e5717a'; g.beginPath(); g.ellipse(mx, my + mw * 1.05, mw * .55, mw * .42, 0, 0, TAU); g.fill();
      g.restore();
    } else {
      g.strokeStyle = F.lip || '#8b4a40'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(mx - mw, my - 3); g.quadraticCurveTo(mx, my + mw * .55, mx + mw, my - 3); g.stroke();
    }
  }

  // ---------- poses ----------
  // Per arm: pitch (forward), abd (outward), twist, bend (elbow), wrist [x, y, z], curl (fingers 0..1.6), thumb (0..1).
  const ARM0 = { pitch: .08, abd: .16, twist: 0, bend: .18, wrist: [0, 0, 0], curl: .35, thumb: 0 };

  const CAST = {};
  function define(id, spec) { spec.id = id; CAST[id] = spec; }

  function create(T, id, opts) {
    opts = opts || {};
    const spec = CAST[id];
    if (!spec) throw new Error('FigureKit: no character ' + id);
    const root = new T.Group();
    root.name = id;
    const body = new T.Group();
    body.scale.setScalar(spec.scale || 1);
    root.add(body);
    const BASE = { girth: 1.12, head: 1.16, arm: 1.22, leg: 1.16, hand: 1.15, legs: .94, shoulders: 1.04, hipW: 1.1 };
    const B = Object.assign({ belly: 0 }, BASE);
    for (const [key, v] of Object.entries(spec.build || {})) B[key] = key === 'belly' ? v : (BASE[key] || 1) * v;
    // opts.build reshapes everyone the same way on top of their own build (e.g. a rounder chibi body); belly adds.
    for (const [key, v] of Object.entries(opts.build || {})) B[key] = key === 'belly' ? B.belly + v : (B[key] || 1) * v;
    const mats = new Map(), textures = [];

    // ---------- materials ----------
    function canvas(w, h, draw) {
      if (typeof document === 'undefined') return null;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      textures.push(t);
      return t;
    }
    const patternCache = {};
    function pattern(name) {
      if (!(name in patternCache)) {
        const t = canvas(256, 256, (g, S) => PATTERNS[name](g, S));
        if (t) { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; }
        patternCache[name] = t;
      }
      return patternCache[name];
    }
    // mat('#color' | {pattern}, extra): fabrics get the weave texture under their colour unless they have a print.
    function mat(c, extra) {
      extra = extra || {};
      const key = JSON.stringify([c, extra]);
      if (!mats.has(key)) {
        const o = Object.assign({ roughness: .8, side: T.DoubleSide }, extra);
        for (const key in o) if (o[key] === undefined) delete o[key];
        if (typeof c === 'string') o.color = new T.Color(c); else if (c && c.pattern) { o.map = pattern(c.pattern); o.color = new T.Color(c.tint || '#ffffff'); }
        const fabric = !!(o.weave || (c && c.pattern));
        if (o.weave) { if (!o.map) o.map = pattern('weave'); delete o.weave; }
        const physical = o.sheen !== undefined || o.clearcoat !== undefined || o.transmission !== undefined;
        const m = new (physical ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)(o);
        if (fabric) m.userData.fabric = true;  // FigureLook.fluff gives fabrics a short fuzz
        mats.set(key, m);
      }
      return mats.get(key);
    }
    const cloth = (c, extra) => mat(c, Object.assign({ roughness: .9, weave: typeof c === 'string' }, extra));
    function add(geo, m, parent, x, y, z) {
      const o = new T.Mesh(geo, m);
      o.position.set(x || 0, y || 0, z || 0);
      if (opts.castShadow) o.castShadow = true;
      (parent || body).add(o);
      return o;
    }
    const G = (parent, x, y, z) => { const g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; };
    const ell = (rx, ry, rz, w, h) => new T.SphereGeometry(1, w || 24, h || 16).scale(rx, ry, rz);

    // ---------- rig ----------
    const TL = .33 * B.legs, SL = .3 * B.legs, AH = .11, HIP_Y = TL + SL + AH;
    const NECK_Y = .66, UL = .25 * (B.armLen || 1), FL = .24 * (B.armLen || 1);
    const pelvis = G(body, 0, HIP_Y, 0), spine = G(pelvis);
    const headPivot = G(spine, 0, NECK_Y, 0);
    headPivot.scale.setScalar(B.head);
    const HR = new T.Vector3(.4, .37, .37);
    const head = G(headPivot, 0, .34, .01);
    const skin = spec.skin || '#f4cfb8';
    const skinMat = mat(skin, { roughness: .6, side: T.FrontSide });

    // Torso: one profile in spine space that every top, vest and apron follows. Bellies push the front out.
    const TP = spline(T, [[.19, -.14], [.226, -.05], [.236, .05], [.232, .17], [.238, .3], [.246, .42], [.238, .52], [.2, .59], [.12, .645], [.075, .675]], 44);
    const TZ = .8;
    function torsoR(y) {
      let r = TP[0][0];
      for (let i = 1; i < TP.length; i++) if (TP[i][1] >= y) { const [r0, y0] = TP[i - 1], [r1, y1] = TP[i]; r = r0 + (r1 - r0) * (y - y0) / (y1 - y0 || 1); break; } else r = TP[i][0];
      return r * (1 + (B.girth - 1) * (1 - smooth(.44, .62, y)));
    }
    const bellyF = (phi, y) => 1 + B.belly * .34 * Math.exp(-Math.pow(wrapA(phi) / 1.15, 2)) * Math.exp(-Math.pow((y - .14) / .21, 2));
    const torsoProf = (y0, y1, off) => TP.filter(([, y]) => y >= y0 && y <= y1).map(([, y]) => [torsoR(y) + (off || 0), y]);
    const torsoRad = off => (phi, y) => torsoR(y) * bellyF(phi, y) + (off || 0);
    function torsoPoint(phi, y, off) {
      const r = torsoR(y) * bellyF(phi, y) + (off || 0);
      return new T.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r * TZ);
    }
    // Skin under the clothes (shows at necklines and tank-top armholes) and the neck.
    add(lathe(T, torsoProf(-.14, .675, -.004), { seg: 40, zs: TZ, rad: torsoRad(-.004) }), skinMat, spine);
    add(new T.CylinderGeometry(.07, .082, .16, 18), skinMat, spine, 0, .68, -.005);

    // Head, painted face, nose and ears.
    function headShape(v) {
      if (v.y < 0) { const k = Math.pow(-v.y, 1.5); v.x *= 1 - .16 * k; v.z *= 1 - .07 * k; }
      v.x *= 1 + .05 * Math.exp(-Math.pow((v.y + .35) / .3, 2));
      return v;
    }
    function shapedHead(scale, args) {
      const g = new T.SphereGeometry(1, ...args), p = g.attributes.position, v = new T.Vector3();
      for (let i = 0; i < p.count; i++) { headShape(v.fromBufferAttribute(p, i)); p.setXYZ(i, v.x * HR.x * scale, v.y * HR.y * scale, v.z * HR.z * scale); }
      g.computeVertexNormals();
      return g;
    }
    add(shapedHead(1, [48, 36]), skinMat, head);
    function surf(x, y, z, lift) {
      const v = headShape(new T.Vector3(x, y, z).normalize());
      v.set(v.x * HR.x, v.y * HR.y, v.z * HR.z);
      return v.multiplyScalar(1 + (lift || 0) / v.length());
    }
    const faceGeo = shapedHead(1.004, [48, 40, Math.PI / 2 - 1, 2, .5, 2.2]);
    {
      const p = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * FACE.half) + .5, p.getY(i) / (2 * FACE.half) + .5);
    }
    const faceMat = new T.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: .55, polygonOffset: true, polygonOffsetFactor: -2 });
    add(faceGeo, faceMat, head).renderOrder = 2;
    const faceTex = {};
    add(new T.SphereGeometry(.048, 16, 12), mat(spec.nose || skin, { roughness: .55, side: T.FrontSide }), head, 0, -.07, surf(0, -.19, 1).z - .012).scale.set(1.15, .9, .8);
    for (const s of [-1, 1]) {
      const ear = add(ell(.05, .085, .035), skinMat, head, s * HR.x * .985, -.04, -.02);
      ear.rotation.y = s * .35;
      add(ell(.026, .05, .012), mat(spec.earIn || '#e8ad9a', { roughness: .7 }), ear, s * .01, 0, .028);
    }

    // Arms: shoulder -> elbow -> wrist groups. `grip` is the centre of a closed fist; a rod held there runs along local z.
    const arms = {};
    for (const [name, s] of [['L', 1], ['R', -1]]) {
      const sh = G(spine, s * .232 * B.shoulders * (1 + (B.girth - 1) * .45), .52, 0);
      const ar = .066 * B.arm;
      add(new T.SphereGeometry(ar * 1.02, 16, 12), skinMat, sh);
      add(lathe(T, [[ar * .9, -UL], [ar, -UL * .45], [ar, 0]], { seg: 18 }), skinMat, sh);
      const el = G(sh, 0, -UL, 0);
      add(new T.SphereGeometry(ar * .92, 14, 10), skinMat, el);
      add(lathe(T, [[ar * .78, -FL], [ar * .9, -FL * .4], [ar * .92, 0]], { seg: 18 }), skinMat, el);
      const wr = G(el, 0, -FL, 0);
      const hand = G(wr);
      hand.scale.setScalar(B.hand || 1);
      add(ell(.036, .064, .056, 18, 12), skinMat, hand, 0, -.06, 0);
      const fingers = G(hand, 0, -.1, 0);
      const knuckles = [-.036, -.012, .012, .036].map((z, k) => {
        const kn = G(fingers, 0, 0, z);
        add(new T.CapsuleGeometry(.0185, .03 - (k === 0 ? .008 : 0), 4, 8), skinMat, kn, 0, -.025, 0);
        return kn;
      });
      const thumb = G(hand, -s * .012, -.035, .045);
      add(new T.CapsuleGeometry(.02, .026, 4, 8), skinMat, thumb, 0, -.024, 0);
      const grip = G(hand, -s * .012, -.098, 0);
      arms[name] = { s, sh, el, wr, hand, fingers, knuckles, thumb, grip, ar, pose: Object.assign({}, ARM0), anchored: false };
    }
    // Legs: hip -> knee -> ankle; the ankle sits AH above the floor.
    const legs = {};
    for (const [name, s] of [['L', 1], ['R', -1]]) {
      const lr = .108 * B.leg;
      const hip = G(pelvis, s * .112 * B.hipW, 0, 0);
      add(lathe(T, [[lr * .8, -TL], [lr * .9, -TL * .5], [lr, 0], [lr * .9, .06]], { seg: 20 }), skinMat, hip);
      const knee = G(hip, 0, -TL, 0);
      add(new T.SphereGeometry(lr * .8, 14, 10), skinMat, knee);
      add(lathe(T, [[lr * .55, -SL], [lr * .72, -SL * .55], [lr * .8, 0]], { seg: 20 }), skinMat, knee);
      const ankle = G(knee, 0, -SL, 0);
      legs[name] = { s, hip, knee, ankle, lr };
    }

    // ---------- the builder handed to each character ----------
    const k = {
      T, spec, root, body, pelvis, spine, headPivot, head, arms, legs, HR, B, skin, skinMat,
      dims: { TL, SL, AH, HIP_Y, NECK_Y, UL, FL, TZ },
      mat, cloth, add, G, ell, pattern, canvas, surf, headShape, torsoR, torsoPoint, torsoProf, torsoRad,
      lathe: (prof, o) => lathe(T, prof, o), spline: (pts, n) => spline(T, pts, n), strand: (pts, o) => strand(T, pts, o),
      roundRect: (w, h, r, d, b) => roundRect(T, w, h, r, d, b), rand, smooth, V: (x, y, z) => new T.Vector3(x, y, z),
      faceSpec: null, idle: { sway: 1 },
      track: m => { textures.push(m); return m; }   // hand-made materials and textures to free with the figure
    };

    // Face settings; drawn into an open-eyed and a blinking texture.
    k.face = function (f) {
      k.faceSpec = Object.assign({
        eyeX: .145, eyeY: -.02, eyeRx: .076, eyeRy: .088, iris: ['#9a6440', '#4f2c1a', '#1c0e07'], lashes: false,
        browY: .135, browLen: .11, browW: 12, brow: '#3b2a22', browShape: 'arch',
        mouth: 'smile', mouthW: .055, mouthY: -.185, blush: 1, blushX: .215, blushY: -.105, blushLines: false,
        wrinkles: 0, stubble: 0, dirt: 0
      }, f);
    };

    // A top over the torso. o: { m: material, y0, y1, off, open: half-angle(y) or number, sleeves: 'short'|'long'|'none',
    //   sleeveM, sleeveLen (fraction of the upper arm), cuff: { m, h }, hem: { m, h } }
    k.top = function (o) {
      const off = o.off === undefined ? .028 : o.off, y0 = o.y0 === undefined ? -.12 : o.y0, y1 = o.y1 === undefined ? .675 : o.y1;
      const open = typeof o.open === 'function' ? o.open : o.open ? () => o.open : null;
      const range = open ? y => [open(y), TAU - open(y)] : null;
      const m = o.m;
      add(lathe(T, torsoProf(y0, y1, 0), { seg: 56, zs: TZ, rad: torsoRad(off), range }), m, spine);
      if (o.hem) add(lathe(T, [[0, y0 - o.hem.h], [0, y0 + .005]], { seg: 56, zs: TZ, rad: (phi, y) => torsoR(y0) * bellyF(phi, y0) + off + .008, range }), o.hem.m, spine);
      if (o.sleeves && o.sleeves !== 'none') k.sleeves(Object.assign({ m: o.sleeveM || m }, o));
      return { off, open, range };
    };
    k.sleeves = function (o) {
      const len = o.sleeves === 'long' ? 1 : o.sleeveLen || .6, m = o.sleeveM || o.m, flare = o.flare === undefined ? .02 : o.flare;
      for (const a of Object.values(arms)) {
        const r = a.ar + .016;
        add(new T.SphereGeometry(r + .004, 18, 12), m, a.sh);
        if (o.sleeves === 'long') {
          add(lathe(T, [[r * .96, -UL - .01], [r, -UL * .5], [r + .004, .02]], { seg: 22 }), m, a.sh);
          add(new T.SphereGeometry(r * .95, 14, 10), m, a.el);
          add(lathe(T, [[r * .86, -FL + .02], [r * .95, -FL * .5], [r * .95, 0]], { seg: 22 }), m, a.el);
          if (o.cuff) add(lathe(T, [[r * .8, -FL - .012], [r * .84, -FL + o.cuff.h]], { seg: 22 }), o.cuff.m, a.el);
        } else {
          add(lathe(T, [[r + flare, -UL * len], [r + flare * .5, -UL * len * .6], [r + .004, .02]], { seg: 22 }), m, a.sh);
          if (o.cuff) add(lathe(T, [[r + flare + .006, -UL * len - .004], [r + flare + .008, -UL * len + o.cuff.h]], { seg: 22 }), o.cuff.m, a.sh);
        }
      }
    };
    // Collars. 'shirt': two points that fold down; 'polo': smaller points; 'crew' / 'band': a ring; 'open': lapels for an open shirt.
    k.collar = function (type, m, o) {
      o = o || {};
      if (type === 'crew' || type === 'band') {
        const ring = add(new T.TorusGeometry(.098, type === 'band' ? .016 : .011, 8, 40), m, spine, 0, .655, -.004);
        ring.rotation.x = Math.PI / 2; ring.scale.y = .86;
        return;
      }
      const open = o.open || .32, dip = type === 'polo' ? .06 : .1, rOut = type === 'polo' ? .175 : .2, segU = 40, segV = 6, pos = [], idx = [];
      for (let i = 0; i <= segV; i++) for (let j = 0; j <= segU; j++) {
        const v = i / segV, phi = open + (TAU - 2 * open) * j / segU, front = Math.exp(-Math.pow(Math.min(phi, TAU - phi) / (type === 'open' ? .9 : .6), 2));
        const r = .1 + (rOut - .1) * v, y = .672 + .012 * (1 - v) - (.05 + dip * front) * v;
        pos.push(Math.sin(phi) * r, y + .015 * Math.sin(v * Math.PI), Math.cos(phi) * r * .9);
      }
      for (let i = 0; i < segV; i++) for (let j = 0; j < segU; j++) { const a = i * (segU + 1) + j, b = a + segU + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      add(g, m, spine);
    };
    // Buttons down the front (or down one edge of an opening at angle a).
    k.buttons = function (n, color, y0, y1, o) {
      o = o || {};
      const bm = mat(color, { roughness: .35 }), r = o.r || .013;
      for (let i = 0; i < n; i++) {
        const y = y0 + (y1 - y0) * (n === 1 ? .5 : i / (n - 1)), p = torsoPoint(o.a || 0, y, (o.off || .014) + .004);
        const b = add(new T.CylinderGeometry(r, r, .006, 14), bm, spine, p.x, p.y, p.z);
        b.rotation.set(Math.PI / 2, (o.a || 0), 0);
      }
    };
    // A patch (pocket, badge) laid on the torso at angle a, height y.
    k.onTorso = function (obj, a, y, off, tilt) {
      const p = torsoPoint(a, y, off);
      obj.position.copy(p);
      obj.rotation.set(-(tilt || 0), a * .9, 0);
      spine.add(obj);
      return obj;
    };
    k.pocket = function (m, a, y, w, h, o) {
      o = o || {};
      const g = new T.Group();
      add(roundRect(T, w, h, .012, .008), m, g);
      if (o.flap) add(roundRect(T, w + .006, h * .32, .01, .01), o.flapM || m, g, 0, h * .36, .006);
      if (o.trim) {
        const t = add(new T.TorusGeometry(1, .004, 4, 40), mat(o.trim, { roughness: .6 }), g);
        t.scale.set(w * .5, h * .5, 1); t.position.z = .005;
      }
      return k.onTorso(g, a, y, (o.off || .02), o.tilt);
    };

    // Trousers. o: { m, length: 'long'|'capri'|'shorts'|'knee', loose, cuff: { m, h }, stripe: color, waist }
    k.pants = function (o) {
      const m = o.m, loose = o.loose || 1, waist = o.waist === undefined ? .14 : o.waist;
      const hipR = y => torsoR(Math.max(y, -.14));
      add(lathe(T, [[.205 * loose * B.hipW, -.2], [.218 * loose, -.14], ...torsoProf(-.13, waist, 0)], { seg: 48, zs: TZ, rad: (phi, y, r) => (y > -.14 ? torsoR(y) * bellyF(phi, y) : r) + .016 }), m, spine);
      add(lathe(T, [[0, waist], [0, waist + .03]], { seg: 48, zs: TZ, rad: (phi, y) => torsoR(waist) * bellyF(phi, waist) + .022 }), o.band || m, spine);
      const hem = { long: SL - .02, capri: SL * .5, knee: .02, shorts: -TL * .3 }[o.length || 'long'];
      for (const l of Object.values(legs)) {
        const r = l.lr + .022 * loose, rb = (o.taper ? .85 : 1) * r;
        add(lathe(T, [[r * 1.02, -TL - .01], [r * 1.06, -TL * .5], [r * 1.1, .07]], { seg: 24 }), m, l.hip);
        if (o.length === 'shorts') {
          add(lathe(T, [[r * 1.1 + .006, -TL * .7], [r * 1.1 + .004, -TL * .45]], { seg: 24 }), m, l.hip);
          if (o.stripe) add(lathe(T, [[r * 1.1 + .008, -TL * .7], [r * 1.1 + .008, -.0]], { seg: 24, range: () => [l.s * Math.PI / 2 - .08, l.s * Math.PI / 2 + .08] }), mat(o.stripe), l.hip);
          continue;
        }
        add(new T.SphereGeometry(r, 16, 10), m, l.knee);
        if (hem > 0) add(lathe(T, [[rb, -hem], [r * .96, -hem * .5], [r, .02]], { seg: 24 }), m, l.knee);
        if (o.cuff) {
          const y = hem > 0 ? -hem : -TL * .1;
          add(lathe(T, [[rb + .012, y - .006], [rb + .014, y + o.cuff.h]], { seg: 24 }), o.cuff.m || m, hem > 0 ? l.knee : l.hip);
        }
        if (o.stripe) add(lathe(T, [[r * 1.1 + .006, -TL], [r * 1.1 + .006, .05]], { seg: 24, range: () => [l.s * Math.PI / 2 - .07, l.s * Math.PI / 2 + .07] }), mat(o.stripe), l.hip);
      }
    };

    // Shoes and bare feet, built in each ankle group (the floor is at y = -AH there; toes point to +z).
    function bareFoot(a, w) {
      add(ell(.058 * w, .045, .11, 18, 12), skinMat, a.ankle, 0, -AH + .05, .05);
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * .021 * w * a.s, big = i === 0 ? 1.25 : 1;   // i = 0 is the big toe, on the inside of each foot
        add(new T.SphereGeometry(.014 * big, 10, 8), skinMat, a.ankle, x, -AH + .035, .15 - Math.abs(i - 2) * .007);
      }
    }
    k.shoes = function (o) {
      const type = o.type, c = o.color, sole = o.sole || '#f5f2ec';
      for (const l of Object.values(legs)) {
        const a = { ankle: l.ankle, s: l.s };
        const soleShape = (w, len, h, m, y, z) => { const g = add(roundRect(T, w, len, w * .48, h, .008), m, l.ankle, 0, y, z); g.rotation.x = -Math.PI / 2; return g; };
        if (type === 'flipflop' || type === 'slide' || type === 'sandal') {
          bareFoot(a, 1);
          soleShape(.13, .29, .02, mat(sole, { roughness: .7 }), -AH + .01, .05);
          if (o.sole2) soleShape(.13, .29, .012, mat(o.sole2, { roughness: .7 }), -AH + .027, .05);
          const sm = mat(c, { roughness: o.fuzzy ? 1 : .6 });
          if (type === 'flipflop') {
            for (const sx of [-1, 1]) add(strand(T, [k.V(sx * .055, -AH + .03, .02), k.V(sx * .03, -AH + .07, .08), k.V(0, -AH + .05, .125)], { width: .009, thick: .006, segs: 10 }), sm, l.ankle);
          } else if (type === 'slide') {
            const strap = add(lathe(T, [[.066, -.02], [.07, .03]], { seg: 24, range: () => [-1.5, 1.5], zs: .7 }), sm, l.ankle, 0, -AH + .05, .06);
            strap.scale.set(1, 1, 1);
          } else {
            for (const z of [.03, .1]) add(lathe(T, [[.064, -.012], [.066, .012]], { seg: 24, range: () => [-1.45, 1.45], zs: .55 }), sm, l.ankle, 0, -AH + .055, z);
          }
          continue;
        }
        const um = mat(c, { roughness: o.shiny ? .35 : .65, clearcoat: o.shiny ? .6 : undefined });
        const len = o.len || 1, wide = o.wide || 1;
        soleShape(.14 * wide, .3 * len, o.soleH || .03, mat(sole, { roughness: .75 }), -AH + .012, .045);
        add(ell(.07 * wide, .06, .135 * len, 22, 14), um, l.ankle, 0, -AH + .055, .07);
        add(ell(.065 * wide, .065, .08, 20, 12), um, l.ankle, 0, -AH + .07, -.02);
        if (type === 'boot' || type === 'sneaker') add(new T.CylinderGeometry(.066 * wide, .07 * wide, type === 'boot' ? .12 : .06, 20), um, l.ankle, 0, type === 'boot' ? -AH + .13 : -AH + .1, -.01);
        if (o.laces) for (let i = 0; i < 3; i++) add(new T.BoxGeometry(.05, .007, .01), mat(o.laces, { roughness: .6 }), l.ankle, 0, -AH + .1 - i * .012, .07 + i * .03).rotation.x = -.6;
        if (o.accent) add(strand(T, [k.V(-.073 * wide, -AH + .05, .0), k.V(-.075 * wide, -AH + .07, .08), k.V(-.06 * wide, -AH + .06, .15)], { width: .014, thick: .004, segs: 12, axis: () => k.V(0, -AH + .06, .06) }), mat(o.accent, { roughness: .6 }), l.ankle);
        if (o.accent) add(strand(T, [k.V(.073 * wide, -AH + .05, .0), k.V(.075 * wide, -AH + .07, .08), k.V(.06 * wide, -AH + .06, .15)], { width: .014, thick: .004, segs: 12, axis: () => k.V(0, -AH + .06, .06) }), mat(o.accent, { roughness: .6 }), l.ankle);
        if (o.holes) for (let i = 0; i < 7; i++) {
          const ang = -1 + i * .33, p = k.V(Math.sin(ang) * .066 * wide, -AH + .085, .08 + Math.cos(ang) * .09 * len);
          const hgeo = add(new T.CircleGeometry(.008, 10), mat('#1d2230', { roughness: .9 }), l.ankle, p.x, p.y, p.z);
          hgeo.lookAt(p.x * 3, p.y + .2, p.z + .08);
        }
        if (o.flower) {
          const fl = new T.Group();
          for (let i = 0; i < 5; i++) { const pt = add(new T.SphereGeometry(.012, 8, 6), mat(o.flower, { roughness: .6 }), fl, Math.cos(i / 5 * TAU) * .014, Math.sin(i / 5 * TAU) * .014, 0); pt.scale.z = .4; }
          add(new T.SphereGeometry(.007, 8, 6), mat('#f3cf6a'), fl);
          for (const sx of [-1, 1]) { const lf = add(new T.SphereGeometry(.009, 8, 6), mat('#7aa16a'), fl, sx * .026, -.012, 0); lf.scale.set(1.6, .7, .4); }
          fl.position.set(0, -AH + .1, .125); fl.rotation.x = -1.05; l.ankle.add(fl);
        }
      }
    };

    // Towel: 'neck' drapes round the back of the neck with both ends down the chest; 'L'/'R' hangs over one shoulder.
    k.towel = function (where, o) {
      o = o || {};
      const tex = canvas(64, 256, (g, w, h) => {
        g.fillStyle = '#f7f5f0'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(200,196,188,.5)'; g.fillRect(rand(i) * w, rand(i + .4) * h, 2, 2); }
        if (o.stripe) { g.fillStyle = o.stripe; for (const t of [.08, .12, .88, .92]) g.fillRect(0, t * h, w, h * .018); }
      });
      if (tex) { tex.wrapS = T.ClampToEdgeWrapping; tex.repeat.set(1, 1); tex.rotation = Math.PI / 2; tex.center.set(.5, .5); }
      const m = new T.MeshStandardMaterial({ map: tex, roughness: 1, side: T.DoubleSide });
      textures.push(m);
      const P = (phi, y, off) => torsoPoint(phi, y, off);
      let pts;
      if (where === 'neck') pts = [P(.42, .3, .04), P(.5, .5, .045), k.V(.15, .66, -.02), k.V(0, .68, -.11), k.V(-.15, .66, -.02), P(-.5, .5, .045), P(-.42, .3, .04)];
      else {
        const s = where === 'L' ? 1 : -1;
        pts = [P(s * .55, .3, .04), P(s * .6, .5, .05), k.V(s * .2, .66, .02), k.V(s * .21, .64, -.12), P(s * (Math.PI - .55), .52, .045), P(s * (Math.PI - .5), .3, .04)];
      }
      const g = strand(T, pts, { width: o.width || .062, thick: .016, segs: 40, axis: p => k.V(0, p.y, 0), taper: t => .9 + .1 * Math.sin(t * Math.PI) });
      // Sort UVs along the length so the stripes land at the ends.
      add(g, m, spine);
    };
    k.belt = function (color, buckle, y) {
      y = y === undefined ? .14 : y;
      add(lathe(T, [[0, y - .016], [0, y + .016]], { seg: 56, zs: TZ, rad: (phi, yy) => torsoR(y) * bellyF(phi, y) + .03 }), mat(color, { roughness: .5 }), spine);
      if (buckle) { const p = torsoPoint(0, y, .036); add(roundRect(T, .05, .036, .006, .008), mat(buckle, { metalness: .8, roughness: .3 }), spine, p.x, p.y, p.z); }
    };
    k.beads = function (side, color, n) {
      const a = arms[side], bm = mat(color, { roughness: .3 });
      n = n || 12;
      for (let i = 0; i < n; i++) { const ang = i / n * TAU; add(new T.SphereGeometry(.014, 10, 8), bm, a.el, Math.sin(ang) * a.ar * .9, -FL + .035, Math.cos(ang) * a.ar * .9); }
    };

    // Static pose for the showcase. arms: { L: {...}, R: {...} } partial overrides of ARM0; head: [x, y, z].
    k.pose = function (p) {
      for (const n of ['L', 'R']) if (p[n]) Object.assign(arms[n].pose, p[n]);
      if (p.head) k.headTilt = p.head;
      if (p.legs) k.legSpread = p.legs;
      applyPose(0);
    };
    k.hold = function (side, obj, at, rot) {
      const a = arms[side];
      a.grip.add(obj);
      if (at) obj.position.set(...at);
      if (rot) obj.rotation.set(...rot);
      if (a.pose.curl < 1.1) a.pose.curl = 1.25;
      a.pose.thumb = Math.max(a.pose.thumb, .7);
      applyPose(0);
      return obj;
    };
    // Where the fist is, in body space (for props that stand on the floor, like a cane or a trolley).
    k.gripPoint = function (side) {
      applyPose(0);
      body.updateMatrixWorld(true);
      const v = new T.Vector3();
      arms[side].grip.getWorldPosition(v);
      return body.worldToLocal(v);
    };

    // ph / W: walk-cycle phase and weight (0 standing, 1 walking). Arms that hold something on the floor stay put.
    function applyPose(t, ph, W) {
      ph = ph || 0; W = W || 0;
      for (const a of Object.values(arms)) {
        const p = a.pose, s = a.s, sw = a.anchored ? 0 : .025 * Math.sin(t * 1.1 + s) * k.idle.sway + W * .38 * Math.sin(ph + (s > 0 ? 0 : Math.PI));
        a.sh.rotation.set(-p.pitch + sw, s * p.twist, s * p.abd);
        a.el.rotation.set(-p.bend, 0, 0);
        a.wr.rotation.set(p.wrist[0], s * p.wrist[1], s * p.wrist[2]);
        a.knuckles.forEach(kn => kn.rotation.set(kn.position.z * 2, 0, -s * p.curl * 1.2));
        a.thumb.rotation.set(-.5 + .7 * p.thumb, 0, s * (.25 - .75 * p.thumb));
      }
      const sp = k.legSpread || .04;
      for (const l of Object.values(legs)) {
        const lp = ph + (l.s > 0 ? Math.PI : 0), hip = -.48 * Math.sin(lp) * W, knee = .75 * Math.max(0, Math.cos(lp)) * W;
        l.hip.rotation.set(hip, 0, l.s * sp);
        l.knee.rotation.x = knee;
        l.ankle.rotation.set(-(hip + knee) * .7, 0, -l.s * sp);
      }
      pelvis.position.y = HIP_Y + .03 * (Math.abs(Math.cos(ph)) - .5) * W;
      spine.rotation.y = .07 * Math.sin(ph) * W;
    }

    spec.build(k);
    if (!k.faceSpec) k.face({});
    for (const [n, blink] of [['open', false], ['blink', true]]) {
      faceTex[n] = canvas(FACE.size, FACE.size, g => drawFace(g, k.faceSpec, blink));
      if (faceTex[n]) faceTex[n].anisotropy = 4;
    }
    faceMat.map = faceTex.open || null;
    if (!faceMat.map) faceMat.visible = false;
    applyPose(0);

    let time = rand(id.length) * 10, blinkT = -1, walkPh = 0, walkW = 0;
    let blinkAt = time + 1.5 + rand(id.length + 3) * 2;
    const tilt = k.headTilt || [0, 0, 0];
    // ctx.speed (world units per second) drives the walk cycle; 0 or nothing means standing.
    function update(dt, ctx) {
      dt = Math.min(dt || 0, .05);
      time += dt;
      const speed = (ctx && ctx.speed) || 0;
      walkW += ((speed > .05 ? 1 : 0) - walkW) * (1 - Math.exp(-dt * 8));
      walkPh += dt * (4 + speed * 2.8 / (spec.scale || 1));
      spine.scale.set(1 + .006 * Math.sin(time * 1.7), 1 + .01 * Math.sin(time * 1.7), 1 + .006 * Math.sin(time * 1.7));
      headPivot.rotation.set(tilt[0] + .025 * Math.sin(time * .6), tilt[1] + .04 * Math.sin(time * .37), tilt[2] + .03 * Math.sin(time * .5));
      applyPose(time, walkPh, walkW);
      if (time > blinkAt) { blinkT = 0; blinkAt = time + 2.5 + Math.random() * 3; }
      let shut = false;
      if (blinkT >= 0) { blinkT += dt; shut = blinkT < .12; if (!shut) blinkT = -1; }
      const want = shut && k.faceSpec.eyes !== 'closed' ? faceTex.blink : faceTex.open;
      if (want && faceMat.map !== want) { faceMat.map = want; faceMat.needsUpdate = true; }
      if (k.onUpdate) k.onUpdate(time, dt);
    }
    update(0);

    return {
      id, root, head, name: spec.name, spec,
      height: () => { root.updateMatrixWorld(true); return new T.Box3().setFromObject(root).max.y; },
      update,
      dispose() {
        root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        for (const m of mats.values()) m.dispose();
        faceMat.dispose();
        for (const t of textures) t.dispose();
      }
    };
  }

  global.FigureKit = { create, define, cast: CAST, patterns: Object.keys(PATTERNS) };
})(typeof window !== 'undefined' ? window : globalThis);
