/* LumiKit: original stylised 3D girls built from code after the user's character sheets, sharing one rig.
   - 'lumi': long platinum waves, pink cardigan, tweed skirt (poses idle, wave, wink, hug).
   - 'hana': black side-parted bob, pink zip hoodie, pleated skirt (poses idle, wave, peace, chin).
   - Face: a painted decal on the head with swappable expressions (smile, blink, wink, happy, gentle).
   - Hair: tapered ribbon clumps around a scalp cap; the vertex shader swings the ends.
   - Arms: two-bone IK, so every pose is just "where the wrists go", and poses blend smoothly.

   const girl = LumiKit.create(THREE, { look: 'hana' });
   scene.add(girl.root);
   girl.setPose(name);                                  // see LumiKit.looks[look].poses
   girl.update(dt, { speed, look: camera.position });   // every frame
   girl.hugAnchor                                       // parent a cat here for the hug pose */
(function (global) {
  'use strict';

  function smooth(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function rand(seed) {
    const h = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return h - Math.floor(h);
  }

  const LUMI_C = {
    skin: '#f9d3c0', hair: ['#c4a06c', '#e6cf9f', '#f6e9cc'], hairSheen: '#fff2d2',
    top: '#f4efe7', cardigan: '#efd2cc', cardiganRib: '#e8c5bf', skirt: '#e6dccb', skirtBand: '#ddd1bd',
    gold: '#d6b06a', sock: '#fbfaf8', shoe: '#f3ede4', sole: '#fbf9f5', heart: '#eaa2a8', bag: '#f1eadf', bagFlap: '#e9e0d2'
  };
  const HANA_C = Object.assign({}, LUMI_C, {
    skin: '#fad6c8', hair: ['#0e0a09', '#18110f', '#271c18'], hairSheen: '#5e504a',
    top: '#fbf9f6', cardigan: '#ecc3c8', cardiganRib: '#e3b4ba', skirt: '#dccbb0', skirtBand: '#d3c1a5',
    heart: '#ef9fa9', bag: '#f2ebe0', bagFlap: '#eae1d3', drawstring: '#f8f1f2', plush: '#fbf8f4'
  });

  // ---------- geometry helpers ----------
  function smoothProfile(T, pts, n) {
    const curve = new T.SplineCurve(pts.map(p => new T.Vector2(p[0], p[1])));
    return curve.getPoints(n).map(v => [v.x, v.y]);
  }
  // A surface of revolution around Y with an optional front opening (open(y) = half-angle in radians).
  function ringSurface(T, profile, opt) {
    opt = opt || {};
    const segU = opt.segU || 40, zs = opt.zScale || 1, open = opt.open, ripple = opt.ripple;
    const rows = profile.length, pos = [], uv = [], idx = [];
    for (let i = 0; i < rows; i++) {
      const y = profile[i][1], o = open ? open(y) : 0;
      for (let j = 0; j <= segU; j++) {
        const phi = o + (j / segU) * (Math.PI * 2 - 2 * o), r = profile[i][0] * (ripple ? ripple(phi, y) : 1);
        pos.push(Math.sin(phi) * r, y, Math.cos(phi) * r * zs);
        uv.push(j / segU, i / (rows - 1));
      }
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < segU; j++) {
      const a = i * (segU + 1) + j, b = a + segU + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  // A tapered ribbon-like tube along a curve. The thin axis faces away from axisFn(p),
  // so hair clumps lie flat against the head and drape around the body.
  function strandGeometry(T, points, opt) {
    const curve = new T.CatmullRomCurve3(points, false, 'catmullrom', .5);
    const segs = opt.segs || 36, radial = opt.radial || 8;
    const pos = [], nor = [], uv = [], hang = [], col = [], idx = [];
    const P = new T.Vector3(), Tn = new T.Vector3(), O = new T.Vector3(), S = new T.Vector3(), V = new T.Vector3(), N = new T.Vector3();
    const c0 = new T.Color(opt.colors[0]), c1 = new T.Color(opt.colors[1]), c2 = new T.Color(opt.colors[2]), c = new T.Color();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      curve.getPointAt(t, P);
      curve.getTangentAt(t, Tn);
      O.copy(P).sub(opt.axis(P));
      O.addScaledVector(Tn, -O.dot(Tn));
      if (O.lengthSq() < 1e-8) O.set(0, 0, 1);
      O.normalize();
      S.crossVectors(Tn, O).normalize();
      const k = opt.taper(t), w = opt.width * k, th = opt.thick * k;
      if (t < .35) c.copy(c0).lerp(c1, t / .35); else c.copy(c1).lerp(c2, (t - .35) / .65);
      c.multiplyScalar(opt.shade || 1);
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        V.copy(P).addScaledVector(S, ca * w).addScaledVector(O, sa * th);
        N.copy(S).multiplyScalar(ca / Math.max(w, 1e-4)).addScaledVector(O, sa / Math.max(th, 1e-4)).normalize();
        pos.push(V.x, V.y, V.z); nor.push(N.x, N.y, N.z); uv.push(t, j / radial);
        hang.push(t * (opt.hang === undefined ? 1 : opt.hang)); col.push(c.r, c.g, c.b);
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
    g.setAttribute('hang', new T.Float32BufferAttribute(hang, 1));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }

  // ---------- painted face ----------
  const FACE = { size: 1024, half: .38 };   // the decal covers x, y in [-half, half] around the head centre
  const EYE_Y = 540;
  // F: colours from the look, plus layout from the style (eye scale, eyes moved inward, whole face moved down, nose and
  // mouth drop below the eyes, mouth width, and `real` for the semi-real eyes, nose and lips).
  function drawFace(g, expr, F) {
    const S = FACE.size, EYES = [343 + F.eyeX, 681 - F.eyeX];
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(0, F.dy);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const x of EYES) {
      const s = x < S / 2 ? -1 : 1, bx = x + s * 14, by = EYE_Y + 122, r = g.createRadialGradient(bx, by, 0, bx, by, 84);
      const a = (expr === 'happy' || expr === 'wink' ? .5 : .38) * F.blush;
      r.addColorStop(0, `rgba(250,140,140,${a})`); r.addColorStop(1, 'rgba(250,140,140,0)');
      g.fillStyle = r; g.fillRect(bx - 90, by - 90, 180, 180);
      // brows: soft, a little higher on the outer end
      g.strokeStyle = F.brow; g.lineWidth = F.browW;
      g.beginPath(); g.moveTo(x - s * 52, EYE_Y - 124); g.quadraticCurveTo(x + s * 4, EYE_Y - 154, x + s * 64, EYE_Y - 136); g.stroke();
    }
    const eye = (x, kind) => {
      const s = x < S / 2 ? -1 : 1;
      g.save();
      g.translate(x, EYE_Y); g.scale(F.eye, F.eye); g.translate(-x, -EYE_Y);
      g.strokeStyle = '#2b1b15';
      if (kind === 'open' && F.real) {
        // Almond eye: the upper lid covers the top of the iris; a crease above, a soft lower lid.
        const almond = () => {
          g.beginPath(); g.moveTo(x - s * 70, EYE_Y + 6);
          g.bezierCurveTo(x - s * 40, EYE_Y - 52, x + s * 46, EYE_Y - 58, x + s * 74, EYE_Y - 4);
          g.bezierCurveTo(x + s * 44, EYE_Y + 40, x - s * 36, EYE_Y + 44, x - s * 70, EYE_Y + 6); g.closePath();
        };
        g.save();
        almond(); g.fillStyle = '#fbf6f2'; g.fill(); g.clip();
        const ix = x - s * 2, iy = EYE_Y + 2;
        let gr = g.createRadialGradient(ix, iy + 10, 3, ix, iy, 44);
        gr.addColorStop(0, F.iris[0]); gr.addColorStop(.6, F.iris[1]); gr.addColorStop(1, F.iris[2]);
        g.fillStyle = gr; g.beginPath(); g.arc(ix, iy, 44, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(12,6,4,.7)'; g.lineWidth = 4; g.stroke();
        g.fillStyle = '#0d0604'; g.beginPath(); g.arc(ix, iy + 1, 17, 0, Math.PI * 2); g.fill();
        gr = g.createLinearGradient(0, EYE_Y - 50, 0, EYE_Y - 8);
        gr.addColorStop(0, 'rgba(90,55,40,.5)'); gr.addColorStop(1, 'rgba(90,55,40,0)');
        g.fillStyle = gr; g.fillRect(x - 80, EYE_Y - 60, 160, 60);
        g.fillStyle = 'rgba(255,255,255,.95)';
        g.beginPath(); g.ellipse(ix - 14, iy - 14, 9, 10, -.3, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(ix + 15, iy + 15, 4, 0, Math.PI * 2); g.fill();
        g.restore();
        g.strokeStyle = '#2b1b15'; g.lineWidth = 9;
        g.beginPath(); g.moveTo(x - s * 70, EYE_Y + 6); g.bezierCurveTo(x - s * 40, EYE_Y - 52, x + s * 46, EYE_Y - 58, x + s * 76, EYE_Y - 6); g.stroke();
        g.lineWidth = 4;
        for (let k = 0; k < 4; k++) {
          const lx = x + s * (34 + k * 12), ly = EYE_Y - 44 + k * 10;
          g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + s * 12, ly - 12 + k * 3); g.stroke();
        }
        g.strokeStyle = 'rgba(120,76,60,.5)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x - s * 52, EYE_Y + 30); g.quadraticCurveTo(x, EYE_Y + 46, x + s * 58, EYE_Y + 16); g.stroke();
        g.strokeStyle = 'rgba(140,92,74,.5)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x - s * 50, EYE_Y - 52); g.quadraticCurveTo(x, EYE_Y - 82, x + s * 66, EYE_Y - 46); g.stroke();
      } else if (kind === 'open') {
        g.save();
        g.beginPath(); g.ellipse(x, EYE_Y, 64, 74, 0, 0, Math.PI * 2); g.fillStyle = '#fffdfb'; g.fill(); g.clip();
        let gr = g.createLinearGradient(0, EYE_Y - 74, 0, EYE_Y - 10);
        gr.addColorStop(0, 'rgba(150,108,88,.38)'); gr.addColorStop(1, 'rgba(150,108,88,0)');
        g.fillStyle = gr; g.fillRect(x - 70, EYE_Y - 80, 140, 80);
        const ix = x - s * 4, iy = EYE_Y + 8;
        gr = g.createRadialGradient(ix, iy + 16, 4, ix, iy, 60);
        gr.addColorStop(0, F.iris[0]); gr.addColorStop(.55, F.iris[1]); gr.addColorStop(1, F.iris[2]);
        g.fillStyle = gr; g.beginPath(); g.arc(ix, iy, 58, 0, Math.PI * 2); g.fill();
        gr = g.createRadialGradient(ix, iy + 34, 2, ix, iy + 34, 42);
        gr.addColorStop(0, F.glow); gr.addColorStop(1, 'rgba(226,168,116,0)');
        g.fillStyle = gr; g.fillRect(ix - 60, iy - 10, 120, 80);
        g.fillStyle = '#150a05'; g.beginPath(); g.arc(ix, iy + 2, 25, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(ix - 20, iy - 22, 17, 20, -.3, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(ix + 22, iy + 24, 7, 0, Math.PI * 2); g.fill();
        g.restore();
        g.lineWidth = 13;
        g.beginPath(); g.moveTo(x - s * 66, EYE_Y + 4); g.bezierCurveTo(x - s * 52, EYE_Y - 72, x + s * 40, EYE_Y - 86, x + s * 74, EYE_Y - 16); g.stroke();
        g.lineWidth = 7;
        for (let k = 0; k < 3; k++) {
          const lx = x + s * (50 + k * 9), ly = EYE_Y - 60 + k * 17;
          g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + s * 22, ly - 13 + k * 4); g.stroke();
        }
        g.strokeStyle = 'rgba(120,80,60,.55)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x - s * 44, EYE_Y + 62); g.quadraticCurveTo(x, EYE_Y + 80, x + s * 56, EYE_Y + 50); g.stroke();
        g.strokeStyle = 'rgba(150,100,80,.42)';
        g.beginPath(); g.moveTo(x - s * 48, EYE_Y - 76); g.quadraticCurveTo(x, EYE_Y - 104, x + s * 62, EYE_Y - 72); g.stroke();
      } else if (kind === 'happy') {
        // ∩ smiling eye with a couple of lashes
        g.lineWidth = 12;
        g.beginPath(); g.moveTo(x - s * 58, EYE_Y + 22); g.quadraticCurveTo(x, EYE_Y - 46, x + s * 62, EYE_Y + 16); g.stroke();
        g.lineWidth = 6;
        g.beginPath(); g.moveTo(x + s * 56, EYE_Y + 4); g.lineTo(x + s * 76, EYE_Y - 6); g.stroke();
      } else {
        // closed (blink): a soft downward curve with lashes
        g.lineWidth = 11;
        g.beginPath(); g.moveTo(x - s * 60, EYE_Y + 6); g.quadraticCurveTo(x, EYE_Y + 44, x + s * 66, EYE_Y + 2); g.stroke();
        g.lineWidth = 6;
        for (let k = 0; k < 3; k++) {
          const lx = x + s * (20 + k * 18), ly = EYE_Y + 30 - k * 7;
          g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + s * 8, ly + 16); g.stroke();
        }
      }
      g.restore();
    };
    if (expr === 'smile' || expr === 'gentle') { eye(EYES[0], 'open'); eye(EYES[1], 'open'); }
    else if (expr === 'blink') { eye(EYES[0], 'closed'); eye(EYES[1], 'closed'); }
    else if (expr === 'wink') { eye(EYES[0], 'open'); eye(EYES[1], 'happy'); }
    else { eye(EYES[0], 'happy'); eye(EYES[1], 'happy'); }
    // nose: a tiny warm shadow; the semi-real face adds a bridge shadow and nostrils
    const ny = EYE_Y + F.nose;
    if (F.real) {
      const gr = g.createLinearGradient(S / 2 - 30, 0, S / 2 + 10, 0);
      gr.addColorStop(0, 'rgba(196,132,112,0)'); gr.addColorStop(.6, 'rgba(196,132,112,.22)'); gr.addColorStop(1, 'rgba(196,132,112,0)');
      g.fillStyle = gr; g.fillRect(S / 2 - 30, EYE_Y + 20, 40, F.nose - 24);
      g.fillStyle = 'rgba(176,108,92,.5)';
      for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(S / 2 + sd * 15, ny + 2, 8, 5, sd * .35, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(255,240,232,.5)'; g.beginPath(); g.ellipse(S / 2, ny - 12, 7, 9, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = 'rgba(206,140,118,.55)'; g.beginPath(); g.ellipse(S / 2, ny, 10, 6, 0, 0, Math.PI * 2); g.fill();
    }
    // mouth
    const mx = S / 2, my = EYE_Y + F.mouth;
    g.save();
    g.translate(mx, my); g.scale(F.mouthW, F.mouthW); g.translate(-mx, -my);
    if (expr === 'smile' || expr === 'blink') {
      const w = 60, h = 50;
      g.save();
      g.beginPath(); g.moveTo(mx - w, my - 4); g.quadraticCurveTo(mx, my + 12, mx + w, my - 4);
      g.quadraticCurveTo(mx + w * .7, my + h, mx, my + h); g.quadraticCurveTo(mx - w * .7, my + h, mx - w, my - 4); g.closePath();
      g.fillStyle = '#9b3c44'; g.fill(); g.clip();
      g.fillStyle = '#ffffff'; g.fillRect(mx - w, my - 12, w * 2, 22);
      g.fillStyle = '#e57c84'; g.beginPath(); g.ellipse(mx, my + h, w * .55, 24, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      if (F.real) {
        // Lips round the open smile: a full lower lip and a fine upper one.
        g.strokeStyle = 'rgba(212,116,122,.85)'; g.lineWidth = 10;
        g.beginPath(); g.moveTo(mx - w * .92, my + 4); g.quadraticCurveTo(mx - w * .6, my + h + 8, mx, my + h + 8); g.quadraticCurveTo(mx + w * .6, my + h + 8, mx + w * .92, my + 4); g.stroke();
        g.strokeStyle = 'rgba(190,96,104,.8)'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(mx - w, my - 4); g.quadraticCurveTo(mx - w * .4, my - 12, mx, my - 6); g.quadraticCurveTo(mx + w * .4, my - 12, mx + w, my - 4); g.stroke();
      }
      g.strokeStyle = 'rgba(150,70,70,.55)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(mx - w - 6, my - 10); g.quadraticCurveTo(mx - w, my - 2, mx - w + 4, my); g.stroke();
      g.beginPath(); g.moveTo(mx + w + 6, my - 10); g.quadraticCurveTo(mx + w, my - 2, mx + w - 4, my); g.stroke();
    } else if (F.real) {
      // Closed lips: a soft upper lip with a cupid's bow, a fuller lower lip, and the line between them turned up.
      g.fillStyle = 'rgba(206,112,118,.8)';
      g.beginPath(); g.moveTo(mx - 52, my + 4); g.quadraticCurveTo(mx - 24, my - 16, mx - 6, my - 10); g.quadraticCurveTo(mx, my - 6, mx + 6, my - 10);
      g.quadraticCurveTo(mx + 24, my - 16, mx + 52, my + 4); g.quadraticCurveTo(mx, my + 12, mx - 52, my + 4); g.fill();
      g.fillStyle = 'rgba(220,128,132,.78)';
      g.beginPath(); g.moveTo(mx - 48, my + 6); g.quadraticCurveTo(mx, my + 14, mx + 48, my + 6); g.quadraticCurveTo(mx, my + 44, mx - 48, my + 6); g.fill();
      g.fillStyle = 'rgba(255,236,236,.45)'; g.beginPath(); g.ellipse(mx, my + 24, 16, 5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(140,60,64,.75)'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(mx - 56, my); g.quadraticCurveTo(mx, my + 14, mx + 56, my); g.stroke();
    } else {
      g.strokeStyle = '#a5535b'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(mx - 46, my + 2); g.quadraticCurveTo(mx, my + 34, mx + 46, my + 2); g.stroke();
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(mx - 52, my - 6); g.lineTo(mx - 44, my + 4); g.stroke();
      g.beginPath(); g.moveTo(mx + 52, my - 6); g.lineTo(mx + 44, my + 4); g.stroke();
    }
    g.restore();
    g.restore();
  }

  // ---------- poses: wrist targets (spine space) for the IK arms, plus FK for spine, head and legs ----------
  // Lc/Rc curl the whole hand; Lf/Rf (pinky, ring, middle, index) override per finger, Lt/Rt fold the thumb,
  // Lv/Rv open the index and middle fingers into a V.
  const V = (x, y, z) => [x, y, z];
  const POSES = {
    idle: { face: 'smile', L: V(.27, -.25, .04), R: V(-.27, -.25, .04), Lp: V(.4, 0, -1), Rp: V(-.4, 0, -1),
      Lw: V(0, 0, 0), Rw: V(0, 0, 0), Lc: .25, Rc: .25, hx: 0, hy: 0, hz: 0, sx: 0, sz: 0, lh: 0, lk: .04, rh: 0, rk: .04 },
    // Reaching out to greet, left hand on the bag strap (main pose on the sheet).
    wave: { face: 'smile', L: V(.11, .2, .2), R: V(-.44, .32, .5), Lp: V(.6, -1, -.3), Rp: V(-.5, -1, -.1),
      Lw: V(-.3, 0, 0), Rw: V(-.4, 0, .5), Lc: .9, Rc: 0, hx: .02, hy: -.18, hz: .1, sx: .02, sz: -.04, lh: -.14, lk: .26, rh: .04, rk: 0 },
    // Playful: hand on cheek and a wink.
    wink: { face: 'wink', faceHands: 'R', L: V(.28, -.2, .02), R: V(-.15, .58, .2), Lp: V(.4, 0, -1), Rp: V(-.3, -1, .3),
      Lw: V(0, 0, 0), Rw: V(.35, 0, .2), Lc: .3, Rc: .45, hx: .02, hy: -.08, hz: .22, sx: 0, sz: -.05, lh: .02, lk: .05, rh: -.08, rk: .18 },
    // Warm: hugging the cat, eyes closed.
    hug: { face: 'happy', L: V(.11, .03, .34), R: V(-.13, .08, .35), Lp: V(1, -.7, -.3), Rp: V(-1, -.7, -.3),
      Lw: V(0, 0, -.3), Rw: V(0, 0, .3), Lc: .55, Rc: .55, hx: .14, hy: .06, hz: .18, sx: .04, sz: 0, lh: 0, lk: .05, rh: 0, rk: .05 }
  };
  const HANA_POSES = {
    idle: POSES.idle,
    // Hi! Reaching out with an open hand, the other arm relaxed (main pose on her sheet).
    wave: { face: 'smile', L: V(.27, -.22, .08), R: V(-.44, .32, .5), Lp: V(.4, 0, -1), Rp: V(-.5, -1, -.1),
      Lw: V(0, 0, 0), Rw: V(-.4, 0, .5), Lc: .35, Rc: 0, hx: .02, hy: -.18, hz: .1, sx: .02, sz: -.04, lh: -.14, lk: .26, rh: .04, rk: 0 },
    // Playful: a wink and a peace sign beside the cheek.
    peace: { face: 'wink', faceHands: 'L', L: V(.3, .64, .28), R: V(-.27, -.22, .06), Lp: V(.7, -1, .1), Rp: V(-.4, 0, -1),
      Lw: V(0, -1.3, 0), Rw: V(0, 0, 0), Lc: 0, Rc: .3, Lf: [1.6, 1.6, 0, 0], Lt: 1, Lv: .5,
      hx: .02, hy: .06, hz: .16, sx: 0, sz: .04, lh: -.08, lk: .18, rh: .02, rk: .05 },
    // Gentle smile: both fists tucked under the chin.
    chin: { face: 'gentle', faceHands: 'LR', L: V(.075, .4, .27), R: V(-.075, .4, .27), Lp: V(.6, -1, .2), Rp: V(-.6, -1, .2),
      Lw: V(0, .6, 0), Rw: V(0, -.6, 0), Lc: 1.2, Rc: 1.2, Lt: .6, Rt: .6, hx: .14, hy: .04, hz: .12, sx: .08, sz: 0, lh: 0, lk: .05, rh: -.06, rk: .12 }
  };
  const LOOKS = {
    lumi: { C: LUMI_C, poses: POSES, hair: 'long', outfit: 'cardigan', part: -.12,
      face: { iris: ['#8d5d3e', '#4f3021', '#22130b'], glow: 'rgba(226,168,116,.6)', brow: 'rgba(172,132,96,.8)', browW: 9, blush: 1 } },
    hana: { C: HANA_C, poses: HANA_POSES, hair: 'bob', outfit: 'hoodie', part: -.42,
      face: { iris: ['#4e3226', '#24150f', '#0b0605'], glow: 'rgba(176,118,86,.5)', brow: 'rgba(46,32,27,.9)', browW: 12, blush: 1.15 } }
  };

  // Proportions per style, after the "Style options" row on Hana's sheet. head and body are world scales; the head is
  // carried on the neck, so a chibi's big head sits low on her shoulders. legL/legR stretch and thicken the legs,
  // armR/hand the sleeves and hands; chin, tall and wide reshape the skull; hairLen/hairN set bob length and clump count.
  const STYLES = {
    mascot: { head: 1, body: 1, legL: 1, legR: 1, armR: 1, hand: 1, shoe: 1, chin: .28, tall: 1, wide: 1, hairLen: 1, hairN: 1, face: {} },
    chibi: { head: 1.25, body: .73, legL: .62, legR: 1.4, armR: 1.3, hand: 1.4, shoe: 1.3, chin: .16, tall: .96, wide: 1.04, hairLen: .82, hairN: .75,
      face: { eye: 1.34, dy: 34, nose: 96, mouth: 164, mouthW: .78, blush: 1.3 } },
    semi: { head: .6, body: 1.13, legL: 1, legR: 1.1, armR: .74, hand: .95, shoe: .92, chin: .42, tall: 1.07, wide: .94, hairLen: 1.04, hairN: 1.5,
      face: { eye: 1.05, eyeX: 30, dy: -10, nose: 172, mouth: 272, mouthW: .88, blush: .7, real: true } }
  };
  const NECK = [0, .53, 0];   // the head pivot in spine space

  function create(T, opts) {
    opts = opts || {};
    const lookName = LOOKS[opts.look] ? opts.look : 'lumi', look = LOOKS[lookName], C = look.C;
    const styleName = STYLES[opts.style] ? opts.style : 'mascot', ST = STYLES[styleName];
    const B = ST.body, K = ST.head / ST.body;   // body scale, and the head's scale relative to the body
    const F = Object.assign({ eye: 1.1, eyeX: 0, dy: 0, nose: 116, mouth: 196, mouthW: 1, real: false }, look.face, ST.face,
      { blush: look.face.blush * (ST.face.blush || 1) });
    // Every pose carries every key, so poses blend into each other key by key. Hands that go to the face
    // (faceHands) follow the head when a style makes it bigger or smaller.
    const P = {};
    for (const k in look.poses) {
      const p = look.poses[k], q = Object.assign({ Lt: 0, Rt: 0, Lv: 0, Rv: 0 }, p, { Lf: p.Lf || [p.Lc, p.Lc, p.Lc, p.Lc], Rf: p.Rf || [p.Rc, p.Rc, p.Rc, p.Rc] });
      for (const h of p.faceHands || '') q[h] = q[h].map((v, i) => NECK[i] + (v - NECK[i]) * K);
      P[k] = q;
    }
    const root = new T.Group();
    root.name = lookName;
    const mats = new Map(), textures = [];
    function mat(color, extra, physical) {
      const key = color + JSON.stringify(extra || {}) + (physical ? 'p' : '');
      if (!mats.has(key)) mats.set(key, new (physical ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)(Object.assign({ color, roughness: .7 }, extra)));
      return mats.get(key);
    }
    function add(geo, material, parent, x, y, z) {
      const m = new T.Mesh(geo, material);
      m.position.set(x || 0, y || 0, z || 0);
      if (opts.castShadow) m.castShadow = true;
      parent.add(m);
      return m;
    }
    function ell(rx, ry, rz, w, h) {
      const g = new T.SphereGeometry(1, w || 24, h || 16);
      g.scale(rx, ry, rz);
      return g;
    }
    function canvasTex(w, h, draw, repeat) {
      if (typeof document === 'undefined') return null;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping;
      if (repeat) t.repeat.set(repeat[0], repeat[1]);
      textures.push(t);
      return t;
    }
    const ribTex = canvasTex(64, 8, (g, w, h) => {
      for (let x = 0; x < w; x++) { const v = 228 + 27 * Math.cos(x / w * Math.PI * 16); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); }
    }, [3, 1]);
    const tweedTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const v = 200 + Math.floor(rand(i) * 55);
        g.fillStyle = `rgba(${v},${v - 6},${v - 14},.7)`;
        g.fillRect(rand(i + .3) * w, rand(i + .7) * h, 1 + rand(i + .1) * 3, 1);
      }
    }, [4, 2]);
    const hairTex = canvasTex(8, 128, (g, w, h) => {
      for (let y = 0; y < h; y++) { const v = 205 + Math.floor(50 * rand(y * 1.7)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, w, 1); }
    }, [1, 3]);

    const skinMat = mat(C.skin, { roughness: .55, sheen: .4, sheenColor: new T.Color('#ffb4a0'), sheenRoughness: .6 }, true);
    const goldMat = mat(C.gold, { metalness: .8, roughness: .3 });

    // ---------- rig ----------
    const PELVIS_Y = (1.06 * ST.legL + .19 * ST.shoe - .01) * B;   // legs plus shoes, so the soles meet the floor
    const pelvis = new T.Group(); pelvis.position.y = PELVIS_Y; pelvis.scale.setScalar(B); root.add(pelvis);
    const spine = new T.Group(); spine.position.y = .2; pelvis.add(spine);
    const headPivot = new T.Group(); headPivot.position.y = NECK[1]; headPivot.scale.setScalar(K); spine.add(headPivot);
    // A big, cute head: about a quarter of her height.
    const HC = new T.Vector3(0, .3, .01), HR = new T.Vector3(.336 * ST.wide, .353 * ST.tall, .325);

    // Head: a sphere with a softly tapered chin and full cheeks.
    function headShape(v) {
      if (v.y < 0) {
        const k = Math.pow(-v.y, 1.6);
        v.x *= 1 - ST.chin * k; v.z *= 1 - .12 * k; v.y *= 1 + .05 * k;
      }
      v.x *= 1 + .04 * Math.exp(-Math.pow((v.y + .3) / .25, 2));
      return v;
    }
    function shapedSphere(scale, args) {
      const g = new T.SphereGeometry(1, ...args), p = g.attributes.position, v = new T.Vector3();
      for (let i = 0; i < p.count; i++) {
        headShape(v.fromBufferAttribute(p, i));
        p.setXYZ(i, v.x * HR.x * scale, v.y * HR.y * scale, v.z * HR.z * scale);
      }
      g.computeVertexNormals();
      return g;
    }
    add(shapedSphere(1, [48, 36]), skinMat, headPivot, HC.x, HC.y, HC.z);
    // Face decal: the front of the same shape, a hair larger, with planar UVs for the painted features.
    const faceTex = {};
    for (const e of new Set(['smile', 'blink', ...Object.values(P).map(p => p.face)])) {
      faceTex[e] = canvasTex(FACE.size, FACE.size, g => drawFace(g, e, F));
      if (faceTex[e]) { faceTex[e].wrapS = faceTex[e].wrapT = T.ClampToEdgeWrapping; faceTex[e].anisotropy = 4; }
    }
    const faceGeo = shapedSphere(1.004, [48, 40, Math.PI / 2 - .95, 1.9, .55, 2.1]);
    {
      const p = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * FACE.half) + .5, p.getY(i) / (2 * FACE.half) + .5);
    }
    const faceMat = new T.MeshStandardMaterial({ map: faceTex.smile, transparent: true, depthWrite: false, roughness: .5, polygonOffset: true, polygonOffsetFactor: -2 });
    add(faceGeo, faceMat, headPivot, HC.x, HC.y, HC.z).renderOrder = 2;
    for (const s of [-1, 1]) {
      add(ell(.038, .066, .033), skinMat, headPivot, s * HR.x * .967, HC.y - .025, HC.z - .02);
      if (lookName !== 'lumi') continue;   // Lumi's little gold drop earrings
      add(new T.SphereGeometry(.015, 12, 8), goldMat, headPivot, s * .335, HC.y - .1, HC.z);
      add(ell(.01, .018, .01, 10, 8), goldMat, headPivot, s * .335, HC.y - .132, HC.z);
    }

    // ---------- hair ----------
    const hairUniforms = { uSway: { value: new T.Vector3() }, uTime: { value: 0 } };
    const hairMat = new T.MeshPhysicalMaterial({ map: hairTex, vertexColors: true, roughness: .42, sheen: .8, sheenColor: new T.Color(C.hairSheen), sheenRoughness: .4, side: T.DoubleSide });
    hairMat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, hairUniforms);
      shader.vertexShader = 'attribute float hang;\nuniform vec3 uSway;\nuniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float hh = hang * hang;
        transformed += uSway * hh;
        transformed += vec3(sin(uTime * 1.7 + position.y * 4. + position.x * 7.), 0., cos(uTime * 1.3 + position.y * 3. + position.z * 5.)) * .007 * hang;`);
    };
    hairMat.customProgramCacheKey = () => 'lumi-hair-1';
    const hair = new T.Group();
    hair.position.copy(HC);
    headPivot.add(hair);
    const headAxis = () => new T.Vector3(0, 0, 0);
    // A point on the scalp in direction (x, y, z), lifted off the head by `lift`.
    function surf(x, y, z, lift) {
      const v = headShape(new T.Vector3(x, y, z).normalize());
      v.set(v.x * HR.x, v.y * HR.y, v.z * HR.z);
      return v.multiplyScalar(1 + lift / v.length());
    }
    // Scalp cap: low at the nape, up at the forehead hairline.
    {
      const segU = 64, segV = 24, pos = [], uv = [], idx = [], hang = [], col = [];
      const base = new T.Color(C.hair[1]), part = new T.Color(C.hair[0]), shine = new T.Color(C.hair[2]), c = new T.Color(), v = new T.Vector3();
      for (let i = 0; i <= segV; i++) for (let j = 0; j <= segU; j++) {
        const phi = j / segU * Math.PI * 2 - Math.PI, f = Math.abs(phi) / Math.PI;
        const theta = (i / segV) * (.88 + 1.42 * Math.pow(f, .7));
        headShape(v.set(Math.sin(phi) * Math.sin(theta), Math.cos(theta), Math.cos(phi) * Math.sin(theta)));
        pos.push(v.x * (HR.x + .024), v.y * (HR.y + .024), v.z * (HR.z + .024));
        uv.push(i / segV, j / segU * 6); hang.push(0);   // strands run crown to nape, so the streaks vary around
        c.copy(base).lerp(part, Math.exp(-Math.pow((phi - look.part) / .06, 2)) * smooth(.95, .2, theta) * .7);
        c.lerp(shine, Math.exp(-Math.pow((theta - .55) / .14, 2)) * .45);
        c.lerp(part, smooth(.3, .05, theta));   // the crown whorl shows root colour between the clump roots
        col.push(c.r, c.g, c.b);
      }
      for (let i = 0; i < segV; i++) for (let j = 0; j < segU; j++) {
        const a = i * (segU + 1) + j, b = a + segU + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute('hang', new T.Float32BufferAttribute(hang, 1));
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      add(g, hairMat, hair);
    }
    const clumpTaper = t => (.45 + .55 * smooth(0, .12, t)) * (1 - .88 * smooth(.62, 1, t));
    function clump(points, o) {
      add(strandGeometry(T, points, Object.assign({ axis: headAxis, taper: clumpTaper, width: .07, thick: .022, colors: C.hair }, o)), hairMat, hair);
    }
    // Every clump starts at the crown whorl, so the roots close over the top instead of leaving a ring of open ends.
    const crownPts = (sa, ca, lift) => [surf(sa * .025, 1, ca * .025 + .01, lift[0] * .5), surf(sa * .4, 1, ca * .4 + .03, lift[0] + .006),
      surf(sa * .75, .62, ca * .75, lift[1]), surf(sa, .02, ca, lift[2])];
    const bodyAxis = p => p.y > -.05 ? new T.Vector3(0, 0, 0) : new T.Vector3(0, p.y, 0);
    if (look.hair === 'long') {
      // Curtain bangs from a slightly off-centre part, framing the face down to the cheeks.
      for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
        clump([surf(s * (.03 + .04 * k), 1, .3, .02), surf(s * (.28 + .13 * k), .72, .72, .032), surf(s * (.72 + .05 * k), .18, .62, .04),
          surf(s * .9, -.25, .36 - .04 * k, .046), surf(s * .9, -.25, .36 - .04 * k, .05).add(new T.Vector3(s * .02, -.14 - .025 * k, -.02))],
          { width: .05 + .006 * k, thick: .018, hang: .3, shade: 1 + .03 * (k % 2) });
      }
      // Wispy forehead bangs.
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
        clump([surf(s * .04, 1, .25, .02), surf(s * (.12 + .12 * k), .62, .85, .03), surf(s * (.2 + .16 * k), .36, .92, .035)],
          { width: .03, thick: .012, hang: .15, segs: 20 });
      }
      // Long hair: clumps start at the crown, follow the scalp and fall in loose waves to the hips.
      // Around the face they drop in front of the shoulders; elsewhere they fall behind the shoulders and arms.
      function longClump(az, seed, o) {
        const sa = Math.sin(az), ca = Math.cos(az), wa = Math.atan2(sa, ca), side = Math.sign(sa) || 1;
        const tx = ca, tz = -sa, ph = rand(seed) * 6, amp = o.amp * (.7 + .6 * rand(seed + 3)), r = rand(seed + 7);
        // Soft S-waves that grow toward the ends, as on the sheet.
        const wave = (t, k) => Math.sin(t * Math.PI * 3.2 + ph) * amp * k;
        const pts = crownPts(sa, ca, o.lift);
        if (Math.abs(wa) < 1.25) {
          pts.push(surf(sa * 1.05, -.32, ca * .95, o.lift[2] + .01));
          for (const [t, y, z] of [[.25, -.44, .15], [.5, -.62, .17], [.75, -.8, .17], [1, -.97 - .07 * r, .16]]) {
            const w = wave(t, .4 + .6 * t);
            pts.push(new T.Vector3(side * (.21 - .02 * t + .01 * r) + w, y * o.len, z + .01 * r));
          }
        } else {
          const behind = Math.abs(wa) < 1.95 ? -.13 : 0;   // over the shoulder, then behind the arm
          for (const [t, y, rad] of [[.2, -.36, .31], [.45, -.6, .34], [.7, -.85, .37], [1, -1.1 - .14 * r, .4]]) {
            const w = wave(t, t);
            pts.push(new T.Vector3(sa * rad * o.rad + tx * w, y * o.len, (ca * (rad - .04) - .03 + behind) * o.rad + tz * w));
          }
        }
        clump(pts, { axis: bodyAxis, width: o.width * (.85 + .3 * rand(seed + 1)), thick: o.thick, segs: 56, shade: o.shade * (.93 + .12 * rand(seed + 2)) });
      }
      const SPAN = Math.PI * 2 - 1.5;
      for (let i = 0; i < 30; i++) longClump(.75 + (i + .5) / 30 * SPAN, i + 40, { lift: [.012, .03, .05], width: .085, thick: .03, shade: .82, amp: .045, len: .97, rad: .95 });
      for (let i = 0; i < 44; i++) longClump(.75 + i / 43 * SPAN, i + 1, { lift: [.022, .045, .072], width: .09, thick: .032, shade: 1, amp: .06, len: 1, rad: 1 });
    } else {
      // Side-swept fringe: from a part over her right brow, across the forehead to the left temple, stopping above the brows.
      const lerp = (a, b, f) => a + (b - a) * f;
      const HW = Math.pow(ST.hairN, -.6);   // more, finer clumps for the detailed style; fewer, chunkier ones for chibi
      for (const [n0, lift, shade] of [[6, 0, .85], [8, .008, 1]]) for (let k = 0, n = Math.round(n0 * ST.hairN); k < n; k++) {
        const f = k / (n - 1);
        // Short and light near the part, long toward the left temple; every tip flicks on toward her left.
        clump([surf(-.22 + .04 * f, 1, .3 - .12 * f, .02 + lift), surf(lerp(-.25, .4, f), .85, .62, .035 + lift),
          surf(lerp(-.2, .7, f), lerp(.56, .22, f), lerp(.92, .66, f), .045 + lift),
          surf(lerp(-.08, .95, f), lerp(.46, .02, f), lerp(.92, .36, f), .05 + lift)],
          { width: .07 * HW, thick: .02, hang: .15, segs: 28, shade: shade * (.95 + .1 * rand(k + n)), taper: t => (.5 + .5 * smooth(0, .15, t)) * (1 - .92 * smooth(.5, 1, t)) });
      }
      // Bob: falls nearly straight below the ears, then the ends turn under at the jaw. Longer beside the face and at the back.
      const bobTaper = t => (.5 + .5 * smooth(0, .1, t)) * (1 - .6 * smooth(.75, 1, t));
      function bobClump(az, seed, o) {
        const sa = Math.sin(az), ca = Math.cos(az), aw = Math.abs(Math.atan2(sa, ca)), r = rand(seed + 7);
        const front = 1 - smooth(.8, 1.4, aw), back = smooth(2.2, 3, aw), R = .372 * ST.wide * o.rad, zs = 1 - .1 * front;
        const end = (-.44 - .07 * front - .05 * back - .04 * r) * ST.hairLen;
        const pts = crownPts(sa, ca, o.lift);
        pts.push(new T.Vector3(sa * R, -.22 * ST.tall, ca * R * zs), new T.Vector3(sa * R * .96, end + .1, ca * R * zs * .94),
          new T.Vector3(sa * R * .82, end, ca * R * zs * .78));
        clump(pts, { axis: bodyAxis, taper: bobTaper, width: o.width * (.85 + .3 * rand(seed + 1)), thick: o.thick, segs: 40, hang: .45,
          shade: o.shade * (.92 + .14 * rand(seed + 2)) });
      }
      const SPAN = Math.PI * 2 - 1.8;
      const nIn = Math.round(30 * ST.hairN), nOut = Math.round(44 * ST.hairN);
      for (let i = 0; i < nIn; i++) bobClump(.9 + (i + .5) / nIn * SPAN, i + 40, { lift: [.012, .03, .05], width: .09 * HW, thick: .03, shade: .8, rad: .96 });
      for (let i = 0; i < nOut; i++) bobClump(.9 + i / (nOut - 1) * SPAN, i + 1, { lift: [.022, .045, .072], width: .095 * HW, thick: .032, shade: 1, rad: 1 });
    }

    // ---------- torso ----------
    add(new T.CylinderGeometry(.046, .052, .2, 16), skinMat, spine, 0, .49, -.005);
    add(ringSurface(T, smoothProfile(T, [[.118, .3], [.138, .34], [.132, .39], [.105, .43], [.062, .47]], 10), { zScale: .7 }), skinMat, spine);
    const heart = new T.Shape();
    heart.moveTo(0, -.012); heart.bezierCurveTo(-.02, .002, -.012, .016, 0, .007); heart.bezierCurveTo(.012, .016, .02, .002, 0, -.012);
    const heartGeo = new T.ExtrudeGeometry(heart, { depth: .004, bevelEnabled: true, bevelThickness: .002, bevelSize: .002, bevelSegments: 2 });
    let sleeveMat, cuffMat;
    if (look.outfit === 'cardigan') {
      const topMat = mat(C.top, { map: ribTex, roughness: .85 });
      add(ringSurface(T, smoothProfile(T, [[.118, -.06], [.122, 0], [.132, .1], [.148, .2], [.152, .28], [.146, .34], [.141, .37]], 18), { zScale: .72 }), topMat, spine);
      const cardiganMat = mat(C.cardigan, { roughness: .95, sheen: 1, sheenColor: new T.Color('#ffffff'), sheenRoughness: .8, side: T.DoubleSide }, true);
      const ribMat = mat(C.cardiganRib, { map: ribTex, roughness: .95, side: T.DoubleSide });
      const cardOpen = y => .36 + 1.05 * smooth(.18, .47, y);
      add(ringSurface(T, smoothProfile(T, [[.152, .02], [.16, .1], [.172, .2], [.174, .28], [.167, .34], [.152, .39], [.122, .43], [.086, .465], [.066, .48]], 26), { zScale: .74, open: cardOpen, segU: 48 }), cardiganMat, spine);
      add(ringSurface(T, [[.153, -.012], [.154, .03]], { zScale: .74, open: cardOpen, segU: 48 }), ribMat, spine);
      // Placket edges and two gold heart buttons, as on the sheet.
      const edge = s => {
        const pts = [];
        for (let k = 0; k <= 12; k++) {
          const y = -.01 + k * .037, prof = smoothProfile(T, [[.152, .02], [.16, .1], [.172, .2], [.174, .28], [.167, .34], [.152, .39], [.122, .43]], 40);
          let r = prof[0][0];
          for (const [pr, py] of prof) if (py <= y) r = pr;
          const phi = s * cardOpen(y);
          pts.push(new T.Vector3(Math.sin(phi) * (r + .004), y, Math.cos(phi) * (r + .004) * .74));
        }
        return pts;
      };
      for (const s of [-1, 1]) add(new T.TubeGeometry(new T.CatmullRomCurve3(edge(s)), 30, .009, 8, false), cardiganMat, spine);
      for (const y of [.07, .16]) {
        const phi = -(cardOpen(y) + .1), r = y < .15 ? .162 : .172;
        const b = add(heartGeo, goldMat, spine, Math.sin(phi) * (r + .006), y, Math.cos(phi) * (r + .006) * .74);
        b.rotation.y = phi * .6;
      }
      // Necklace with a tiny heart.
      // The arc starts in the XY plane centred on +Y; tipping it forward lays it round the front of the neck.
      const chain = add(new T.TorusGeometry(.09, .0028, 6, 48, Math.PI * 1.05), goldMat, spine, 0, .425, .03);
      chain.rotation.set(Math.PI / 2 + .55, 0, -Math.PI * .025);
      add(heartGeo, goldMat, spine, 0, .362, .112).rotation.x = -.35;
      sleeveMat = cardiganMat; cuffMat = ribMat;
    } else {
      // White crew-neck tee with a little pink heart.
      const teeMat = mat(C.top, { roughness: .8 });
      add(ringSurface(T, smoothProfile(T, [[.118, -.06], [.122, 0], [.132, .1], [.148, .2], [.152, .28], [.146, .34], [.138, .39], [.125, .415]], 18), { zScale: .72 }), teeMat, spine);
      const collar = add(new T.TorusGeometry(.124, .007, 6, 40), teeMat, spine, 0, .414, 0);
      collar.rotation.x = Math.PI / 2; collar.scale.y = .72;
      add(heartGeo, mat(C.heart, { roughness: .6 }), spine, 0, .27, .111).scale.setScalar(1.5);
      // Oversized zip hoodie, worn open, long enough to cover the skirt's waistband.
      sleeveMat = mat(C.cardigan, { roughness: .95, sheen: 1, sheenColor: new T.Color('#ffffff'), sheenRoughness: .8, side: T.DoubleSide }, true);
      cuffMat = mat(C.cardiganRib, { map: ribTex, roughness: .95, side: T.DoubleSide });
      const hoodOpen = y => .42 + .95 * smooth(.24, .47, y), HZ = .78;
      const hoodieProf = [[.218, -.14], [.214, -.06], [.205, .04], [.2, .14], [.198, .24], [.19, .31], [.17, .37], [.138, .42], [.1, .455], [.078, .475]];
      add(ringSurface(T, smoothProfile(T, hoodieProf, 28), { zScale: HZ, open: hoodOpen, segU: 48 }), sleeveMat, spine);
      add(ringSurface(T, [[.222, -.168], [.223, -.13]], { zScale: HZ, open: hoodOpen, segU: 48 }), cuffMat, spine);
      // Zip edges down both sides of the opening.
      const zipProf = smoothProfile(T, hoodieProf, 60);
      const radiusAt = y => { let r = zipProf[0][0]; for (const [pr, py] of zipProf) if (py <= y) r = pr; return r; };
      for (const sd of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 14; k++) {
          const y = -.16 + k * .043, r = radiusAt(Math.max(-.14, y)) + .004, phi = sd * hoodOpen(y);
          pts.push(new T.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r * HZ));
        }
        add(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, .008, 8, false), cuffMat, spine);
      }
      // The hood: a soft roll round the back of the neck, and the hood itself lying between the shoulder blades.
      const arc = Math.PI * 1.25, roll = new T.TorusGeometry(.14, .04, 10, 36, arc);
      roll.rotateZ(Math.PI / 2 - arc / 2); roll.rotateX(-Math.PI / 2); roll.scale(1, 1, .85);
      add(roll, sleeveMat, spine, 0, .43, -.01);
      add(ell(.16, .15, .055, 24, 16), sleeveMat, spine, 0, .31, -.16).rotation.x = -.2;
      // Drawstrings with little aglets.
      const cordMat = mat(C.drawstring, { roughness: .6 });
      for (const sd of [-1, 1]) {
        const cord = new T.CatmullRomCurve3([new T.Vector3(sd * .062, .43, .09), new T.Vector3(sd * .066, .36, .118), new T.Vector3(sd * .062, .25, .126)]);
        add(new T.TubeGeometry(cord, 16, .0045, 6, false), cordMat, spine);
        add(new T.CylinderGeometry(.0065, .0055, .022, 8), cordMat, spine, sd * .062, .238, .126);
      }
    }

    // ---------- skirt ----------
    if (look.outfit === 'cardigan') {
      const skirtMat = mat(C.skirt, { map: tweedTex, roughness: .95, side: T.DoubleSide });
      add(ringSurface(T, smoothProfile(T, [[.265, -.12], [.258, -.09], [.238, -.03], [.205, .05], [.176, .13], [.159, .2], [.157, .225]], 20), { zScale: .8, segU: 48 }), skirtMat, pelvis);
      add(ringSurface(T, [[.16, .2], [.161, .245]], { zScale: .8, segU: 48 }), mat(C.skirtBand, { map: tweedTex, roughness: .95 }), pelvis);
      for (const [y, r] of [[.165, .168], [.095, .197]]) {
        const phi = .36, g = new T.CylinderGeometry(.011, .011, .006, 16).rotateX(Math.PI / 2);
        add(g, goldMat, pelvis, Math.sin(phi) * (r + .004), y, Math.cos(phi) * (r + .004) * .8).rotation.y = phi;
      }
    } else {
      // Pleated skirt: knife pleats that open toward the hem.
      const pleat = (phi, y) => 1 + .05 * smooth(.2, -.14, y) * (Math.abs((phi / (Math.PI * 2) * 18) % 1 * 2 - 1) - .5);
      add(ringSurface(T, smoothProfile(T, [[.3, -.14], [.28, -.09], [.245, -.03], [.2, .04], [.17, .12], [.16, .2], [.158, .245]], 20), { zScale: .8, segU: 108, ripple: pleat }),
        mat(C.skirt, { roughness: .85, side: T.DoubleSide }), pelvis);
    }

    // ---------- legs ----------
    const legs = {};
    for (const [name, s] of [['L', 1], ['R', -1]]) {
      const leg = pts => smoothProfile(T, pts.map(([r, y]) => [r * ST.legR, y * ST.legL]), 18);
      const hip = new T.Group(); hip.position.set(s * (.088 + .05 * (ST.legR - 1)), 0, 0); pelvis.add(hip);
      add(ringSurface(T, leg([[.066, .06], [.092, -.02], [.091, -.12], [.082, -.28], [.067, -.44], [.057, -.545]]), { segU: 20 }), skinMat, hip);
      const knee = new T.Group(); knee.position.y = -.54 * ST.legL; hip.add(knee);
      add(ringSurface(T, leg([[.055, .03], [.06, -.06], [.066, -.16], [.056, -.3], [.042, -.44], [.035, -.53]]), { segU: 20 }), skinMat, knee);
      const ankle = new T.Group(); ankle.position.y = -.52 * ST.legL; ankle.scale.setScalar(ST.shoe); knee.add(ankle);
      add(ringSurface(T, [[.037, -.07], [.041, -.02], [.043, .06], [.045, .1]], { segU: 20 }), mat(C.sock, { map: ribTex, roughness: .9 }), ankle);
      // Chunky sneaker: rounded sole, padded upper, laces and a pink heart.
      const foot = new T.Shape(), fw = .062, b0 = -.085, b1 = .185, fr = .055;
      foot.moveTo(-fw + fr, b0); foot.lineTo(fw - fr, b0); foot.quadraticCurveTo(fw, b0, fw, b0 + fr); foot.lineTo(fw, b1 - fr);
      foot.quadraticCurveTo(fw, b1, fw - fr, b1); foot.lineTo(-fw + fr, b1); foot.quadraticCurveTo(-fw, b1, -fw, b1 - fr);
      foot.lineTo(-fw, b0 + fr); foot.quadraticCurveTo(-fw, b0, -fw + fr, b0);
      // Shape is drawn in XY with the toe toward +Y; turning it about X lays it flat and extrudes it downward.
      const sole = add(new T.ExtrudeGeometry(foot, { depth: .034, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 3, curveSegments: 10 }), mat(C.sole, { roughness: .6 }), ankle, 0, -.146, 0);
      sole.rotation.x = Math.PI / 2;
      const shoeMat = mat(C.shoe, { roughness: .55 });
      add(ell(.058, .06, .118, 24, 16), shoeMat, ankle, 0, -.11, .05);
      add(ell(.05, .045, .06, 20, 12), shoeMat, ankle, 0, -.06, -.02);
      for (let k = 0; k < 3; k++) add(new T.BoxGeometry(.05, .006, .008), mat('#ffffff', { roughness: .5 }), ankle, 0, -.058 + k * -.004, .07 + k * .03).rotation.x = -.5;
      const h = add(heartGeo, mat(C.heart, { roughness: .5 }), ankle, s * .058, -.12, .04);
      h.rotation.y = s * Math.PI / 2; h.scale.setScalar(1.3);
      legs[name] = { hip, knee, ankle };
    }

    // ---------- arms (IK) ----------
    const SL = look.outfit === 'hoodie'
      ? { sh: [.097, .088], up: [[.08, 0], [.097, -.08], [.101, -.18], [.094, -.3], [.078, -.36]], el: .074,
          fore: [[.074, 0], [.09, -.09], [.096, -.2], [.09, -.28], [.08, -.3]], cuff: [[.076, -.29], [.066, -.32], [.06, -.352]] }
      : { sh: [.088, .08], up: [[.075, 0], [.088, -.08], [.091, -.18], [.08, -.3], [.066, -.36]], el: .066,
          fore: [[.066, 0], [.08, -.09], [.084, -.19], [.072, -.26], [.056, -.29]], cuff: [[.054, -.27], [.052, -.3], [.05, -.335]] };
    const arms = {};
    for (const [name, s] of [['L', 1], ['R', -1]]) {
      const fat = pts => pts.map(([r, y]) => [r * ST.armR, y]);
      const sh = new T.Group(); sh.position.set(s * .205, .4, 0); spine.add(sh);
      add(ell(SL.sh[0] * ST.armR, SL.sh[1] * ST.armR, SL.sh[0] * ST.armR), sleeveMat, sh, 0, -.01, 0);
      add(ringSurface(T, smoothProfile(T, fat(SL.up), 16), { segU: 24 }), sleeveMat, sh);
      const el = new T.Group(); el.position.y = -.35; sh.add(el);
      add(new T.SphereGeometry(SL.el * ST.armR, 16, 12), sleeveMat, el);
      add(ringSurface(T, smoothProfile(T, fat(SL.fore), 16), { segU: 24 }), sleeveMat, el);
      add(ringSurface(T, fat(SL.cuff), { segU: 24 }), cuffMat, el);
      const wr = new T.Group(); wr.position.y = -.34; wr.scale.setScalar(ST.hand); el.add(wr);
      // Hand: palm faces the body (-s along X), thumb toward the front. Each finger curls at its own knuckle.
      add(new T.CylinderGeometry(.026, .03, .04, 12), skinMat, wr, 0, .005, 0);
      add(ell(.021, .05, .04, 16, 12), skinMat, wr, 0, -.05, 0);
      const fingers = new T.Group(); fingers.position.y = -.088; wr.add(fingers);
      const knuckles = [-.027, -.009, .009, .026].map((z, k) => {   // pinky, ring, middle, index
        const kn = new T.Group(); kn.position.z = z; fingers.add(kn);
        add(new T.CapsuleGeometry(.0105, .04 - (k === 0 ? .008 : 0), 4, 8), skinMat, kn, 0, -.028, 0);
        return kn;
      });
      const thumb = new T.Group(); thumb.position.set(-s * .006, -.03, .032); wr.add(thumb);
      add(new T.CapsuleGeometry(.012, .032, 4, 8), skinMat, thumb, 0, -.026, 0);
      arms[name] = { sh, el, wr, knuckles, thumb, s, S: sh.position.clone() };
    }

    // ---------- bag ----------
    const bag = new T.Group(); bag.position.set(.2, -.2, .1); bag.rotation.y = .5; spine.add(bag);
    const rr = new T.Shape(), bw = .08, bh = .06, br = .022;
    rr.moveTo(-bw + br, -bh); rr.lineTo(bw - br, -bh); rr.quadraticCurveTo(bw, -bh, bw, -bh + br); rr.lineTo(bw, bh - br); rr.quadraticCurveTo(bw, bh, bw - br, bh);
    rr.lineTo(-bw + br, bh); rr.quadraticCurveTo(-bw, bh, -bw, bh - br); rr.lineTo(-bw, -bh + br); rr.quadraticCurveTo(-bw, -bh, -bw + br, -bh);
    add(new T.ExtrudeGeometry(rr, { depth: .04, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 3, curveSegments: 8 }), mat(C.bag, { roughness: .45 }), bag, 0, 0, -.02);
    const flap = add(ell(.088, .04, .012, 20, 10), mat(C.bagFlap, { roughness: .45 }), bag, 0, .03, .034);
    flap.rotation.x = .08;
    add(new T.BoxGeometry(.022, .016, .008), goldMat, bag, 0, -.004, .046);
    const strap = new T.CatmullRomCurve3([new T.Vector3(.16, .44, .02), new T.Vector3(.2, .3, .1), new T.Vector3(.21, .05, .12), new T.Vector3(.27, -.15, .1)]);
    add(new T.TubeGeometry(strap, 40, .006, 6, false), mat(C.bag, { roughness: .45 }), spine);

    if (lookName === 'hana') {
      // A little white cat plush dangling from the bag, as on her sheet.
      const plush = new T.Group(); plush.position.set(-.088, -.035, .05); bag.add(plush);
      const plushMat = mat(C.plush, { roughness: .9 }), dark = mat('#2b211d', { roughness: .4 });
      add(new T.TorusGeometry(.009, .0022, 6, 16), goldMat, plush, 0, .04, 0);
      add(new T.SphereGeometry(.026, 16, 12), plushMat, plush);
      add(ell(.02, .022, .018, 14, 10), plushMat, plush, 0, -.036, 0);
      for (const sd of [-1, 1]) {
        add(new T.ConeGeometry(.009, .018, 8), plushMat, plush, sd * .014, .024, 0).rotation.z = -sd * .35;
        add(new T.SphereGeometry(.0036, 8, 6), dark, plush, sd * .009, .002, .024);
      }
      add(new T.SphereGeometry(.003, 8, 6), mat(C.heart, { roughness: .5 }), plush, 0, -.006, .025);
    }

    const hugAnchor = new T.Object3D();
    hugAnchor.position.set(.02, -.06, .26);
    spine.add(hugAnchor);

    // ---------- animation ----------
    const pose = JSON.parse(JSON.stringify(P.idle));
    let state = 'idle', time = 0, phase = 0, walkW = 0, blinkAt = 2, blinkT = -1, lookYaw = 0;
    const sway = new T.Vector3(), swayVel = new T.Vector3(), lookLocal = new T.Vector3();
    const tmp = {
      u: new T.Vector3(), w: new T.Vector3(), E: new T.Vector3(), du: new T.Vector3(), df: new T.Vector3(), H: new T.Vector3(),
      X: new T.Vector3(), Y: new T.Vector3(), Z: new T.Vector3(), m: new T.Matrix4(), P: new T.Vector3(), Hc: new T.Vector3()
    };
    const UPPER = .35, FORE = .34;
    // Place the wrist at H (spine space) with the elbow pushed toward `pole`.
    function solveArm(arm, H, pole) {
      const S = arm.S, t = tmp;
      t.u.subVectors(H, S);
      let d = t.u.length();
      t.u.divideScalar(d || 1);
      d = Math.min(UPPER + FORE - 1e-3, Math.max(Math.abs(UPPER - FORE) + 1e-3, d));
      const cosA = (UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      t.w.copy(pole).addScaledVector(t.u, -pole.dot(t.u)).normalize();
      t.E.copy(S).addScaledVector(t.u, UPPER * cosA).addScaledVector(t.w, UPPER * sinA);
      t.Hc.copy(S).addScaledVector(t.u, d);
      t.du.subVectors(t.E, S).normalize();
      t.df.subVectors(t.Hc, t.E).normalize();
      t.Y.copy(t.du).negate();
      t.Z.copy(t.df).addScaledVector(t.du, -t.df.dot(t.du));
      if (t.Z.lengthSq() < 1e-6) t.Z.copy(t.w).negate();
      t.Z.normalize();
      t.X.crossVectors(t.Y, t.Z).normalize();
      t.m.makeBasis(t.X, t.Y, t.Z);
      arm.sh.quaternion.setFromRotationMatrix(t.m);
      arm.el.rotation.set(-Math.acos(Math.min(1, Math.max(-1, t.du.dot(t.df)))), 0, 0);
    }

    function lerpPose(goal, a) {
      for (const k in goal) {
        if (k === 'face' || k === 'faceHands') continue;
        if (Array.isArray(goal[k])) for (let i = 0; i < goal[k].length; i++) pose[k][i] += (goal[k][i] - pose[k][i]) * a;
        else pose[k] += (goal[k] - pose[k]) * a;
      }
    }
    let currentFace = 'smile';
    function setFace(e) {
      if (e === currentFace || !faceTex[e]) return;
      currentFace = e;
      faceMat.map = faceTex[e];
      faceMat.needsUpdate = true;
    }

    function update(dt, ctx) {
      ctx = ctx || {};
      dt = Math.min(dt, .05);
      time += dt;
      const speed = ctx.speed || 0, moving = speed > .05, goal = P[moving ? 'idle' : state];
      lerpPose(goal, 1 - Math.exp(-dt * (moving ? 9 : 5)));
      walkW += (Math.min(1, speed / 1.2) - walkW) * (1 - Math.exp(-dt * 8));
      phase += dt * (3 + speed * 4.2 / (B * ST.legL));   // shorter legs take quicker steps
      const sw = Math.sin(phase), cw = Math.cos(phase), W = walkW;

      // Body: hip bob, twist and a gentle idle sway.
      pelvis.position.y = PELVIS_Y + (.018 * Math.cos(phase * 2) * W - .012 * (1 - W) * Math.abs(pose.lk - pose.rk)) * B;
      pelvis.rotation.set(0, .09 * sw * W, .02 * Math.sin(time * .9) * (1 - W));
      spine.rotation.set(pose.sx + .03 * W, -.12 * sw * W, pose.sz + .015 * Math.sin(time * 1.1) * (1 - W));
      spine.scale.y = 1 + .006 * Math.sin(time * 2.2);

      // Head: glance toward the camera when standing.
      let yawGoal = 0;
      if (ctx.look && state === 'idle') {
        const l = root.worldToLocal(lookLocal.copy(ctx.look)), a = Math.atan2(l.x, l.z);
        if (Math.abs(a) < 2) yawGoal = Math.max(-.5, Math.min(.5, a)) * (1 - W * .7);
      }
      lookYaw += (yawGoal - lookYaw) * (1 - Math.exp(-dt * 3));
      headPivot.rotation.set(pose.hx - .03 * Math.cos(phase * 2) * W, pose.hy + lookYaw, pose.hz + .02 * Math.sin(time * .8));

      // Legs: walk cycle on top of the pose's stance; the stance foot stays flat.
      for (const [L, sgn, h, k] of [[legs.L, 1, pose.lh, pose.lk], [legs.R, -1, pose.rh, pose.rk]]) {
        const swing = .42 * Math.sin(phase + (sgn > 0 ? 0 : Math.PI)) * W, c = Math.cos(phase + (sgn > 0 ? 0 : Math.PI));
        const knee = k + .75 * Math.max(0, -c) * W + .08 * W;
        L.hip.rotation.set(h + swing, 0, sgn * .015);
        L.knee.rotation.x = knee;
        L.ankle.rotation.x = -(h + swing + knee) * (1 - .4 * W) + .15 * Math.max(0, -c) * W;
      }

      // Arms: IK to the pose's wrist targets, with a swing when walking.
      for (const arm of [arms.L, arms.R]) {
        const isL = arm.s > 0, tgt = isL ? pose.L : pose.R, pl = isL ? pose.Lp : pose.Rp, wr = isL ? pose.Lw : pose.Rw;
        const swing = -.15 * Math.sin(phase + (isL ? Math.PI : 0)) * W;
        tmp.H.set(tgt[0], tgt[1] + Math.abs(swing) * .2, tgt[2] + swing);
        tmp.P.set(pl[0], pl[1], pl[2]);
        solveArm(arm, tmp.H, tmp.P);
        let wz = wr[2];
        if (!isL && state === 'wave' && !moving) wz += Math.sin(time * 7) * .28;   // a little wave of the hand
        arm.wr.rotation.set(wr[0], wr[1], wz);
        const curl = isL ? pose.Lf : pose.Rf, vee = isL ? pose.Lv : pose.Rv, fold = isL ? pose.Lt : pose.Rt;
        arm.knuckles.forEach((kn, k) => kn.rotation.set(kn.position.z * 2 + (k === 3 ? -vee : k === 2 ? vee : 0) / 2, 0, -arm.s * curl[k] * 1.2));
        arm.thumb.rotation.set(-.6 + .8 * fold, 0, arm.s * (.2 - .8 * fold));
      }

      // Hair: a damped spring trails the long ends behind the motion.
      const target = tmp.P.set(Math.sin(time * .7) * .006, -.012 * Math.abs(Math.cos(phase)) * W, -.07 * W);
      swayVel.addScaledVector(target.sub(sway), 60 * dt);
      swayVel.multiplyScalar(Math.exp(-dt * 6));
      sway.addScaledVector(swayVel, dt);
      hairUniforms.uSway.value.copy(sway);
      hairUniforms.uTime.value = time;

      // Face: pose expression, with blinks while smiling.
      if (time > blinkAt) { blinkT = 0; blinkAt = time + 2.5 + Math.random() * 3; }
      let face = goal.face;
      if (blinkT >= 0) { blinkT += dt; if (blinkT < .13 && face === 'smile') face = 'blink'; else if (blinkT >= .13) blinkT = -1; }
      setFace(face);
    }
    update(0, {});

    return {
      root, hugAnchor, style: styleName,
      get state() { return state; },
      setPose(s) { if (P[s]) state = s; },
      poses: Object.keys(P),
      update,
      dispose() {
        root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        for (const m of [...mats.values(), hairMat, faceMat]) m.dispose();
        for (const t of textures) t.dispose();
      }
    };
  }

  global.LumiKit = { create, poses: POSES, looks: LOOKS, styles: STYLES };
})(typeof window !== 'undefined' ? window : globalThis);
