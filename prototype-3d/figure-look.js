/* FigureLook: alternative render styles for FigureKit figures, kept apart from the kit so the default look stays as is.

     const look = FigureLook.restyle(THREE, holder, 'toon');   // 'figurine' (the kit's own materials) | 'toon' | 'clay'
     const post = FigureLook.post(THREE, renderer);
     FigureLook.fluff(THREE, holder);                             // optional, after restyle: fluffy hair, fuzzy fabric
     look.sync(); post.render(scene, camera, 'toon');            // every frame, instead of renderer.render

   toon: two-tone cel shading plus ink lines found from depth and normal edges.
   clay: matte plasticine with small dents, plus screen-space ambient occlusion in the creases. */
(function (global) {
  'use strict';

  // ---------- materials ----------
  const CLAY_VERT = `
    vec4 clayW = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      clayW = instanceMatrix * clayW;
    #endif
    vClayP = (uClayRoot * modelMatrix * clayW).xyz;`;
  // Value noise in figure space (so it does not swim while the turntable turns), turned into a bump.
  const CLAY_FRAG_PARS = `
    varying vec3 vClayP;
    uniform float uClayAmp, uClayFreq;
    float clayHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float clayNoise(vec3 x) {
      vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
      return mix(mix(mix(clayHash(i), clayHash(i + vec3(1, 0, 0)), f.x), mix(clayHash(i + vec3(0, 1, 0)), clayHash(i + vec3(1, 1, 0)), f.x), f.y),
                 mix(mix(clayHash(i + vec3(0, 0, 1)), clayHash(i + vec3(1, 0, 1)), f.x), mix(clayHash(i + vec3(0, 1, 1)), clayHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
    }`;
  const CLAY_FRAG = `
    {
      vec3 q = vClayP * uClayFreq;
      float h = clayNoise(q) + .45 * clayNoise(q * 2.7 + 7.);
      vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
      vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
      float det = dot(dpdx, r1);
      vec3 grad = sign(det) * uClayAmp * (dFdx(h) * r1 + dFdy(h) * r2);
      normal = normalize(abs(det) * normal - grad);
    }`;

  let ramp = null;
  function toonRamp(T) {
    if (!ramp) {
      // Shadow side, then lit side; the step sits a little past the terminator so faces stay mostly lit.
      ramp = new T.DataTexture(new Uint8Array([100, 100, 255, 255, 255]), 5, 1, T.RedFormat);
      ramp.minFilter = ramp.magFilter = T.NearestFilter;
      ramp.generateMipmaps = false;
      ramp.needsUpdate = true;
    }
    return ramp;
  }

  function convert(T, m, style, root) {
    const o = {
      color: m.color ? m.color.clone() : undefined, map: m.map, vertexColors: m.vertexColors, side: m.side,
      transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, alphaTest: m.alphaTest, visible: m.visible,
      polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits
    };
    for (const k in o) if (o[k] === undefined) delete o[k];
    if (style === 'toon') return new T.MeshToonMaterial(Object.assign(o, { gradientMap: toonRamp(T) }));
    const glassy = m.transparent && m.opacity < .99;
    const c = new T.MeshStandardMaterial(Object.assign(o, { roughness: glassy ? m.roughness : .9, metalness: 0 }));
    if (!glassy) {
      c.onBeforeCompile = sh => {
        sh.uniforms.uClayRoot = root;
        sh.uniforms.uClayAmp = { value: .0065 };
        sh.uniforms.uClayFreq = { value: 20 };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vClayP;\nuniform mat4 uClayRoot;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>' + CLAY_VERT);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>' + CLAY_FRAG_PARS)
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + CLAY_FRAG);
      };
      c.customProgramCacheKey = () => 'figure-clay';
    }
    return c;
  }

  // Swap every mesh under `root` to the style's materials. The kit keeps changing its own materials (the face texture
  // swaps when blinking), so sync() copies those changes across each frame.
  function restyle(T, root, style) {
    const rootInv = { value: new T.Matrix4() }, pairs = new Map();
    root.traverse(o => {
      if (!o.isMesh || o.userData.furShell) return;
      const orig = o.userData.lookOrig || (o.userData.lookOrig = o.material);
      if (style === 'figurine' || Array.isArray(orig) || !(orig.isMeshStandardMaterial)) { o.material = orig; return; }
      if (!pairs.has(orig)) pairs.set(orig, convert(T, orig, style, rootInv));
      o.material = pairs.get(orig);
    });
    return {
      style,
      sync() {
        root.updateWorldMatrix(true, false);
        rootInv.value.copy(root.matrixWorld).invert();
        for (const [a, b] of pairs) {
          if (a.map !== b.map) { if (!a.map !== !b.map) b.needsUpdate = true; b.map = a.map; }
          b.visible = a.visible;
        }
      },
      dispose() { for (const b of pairs.values()) b.dispose(); }
    };
  }

  // ---------- fluff ----------
  // The cats' shell fur (cat-kit.js), carried over: each furry part gets a child InstancedMesh whose instances are
  // shells pushed out along the normal, with strands carved from cell noise. An instanced part (perm curls) gets
  // every instance repeated once per shell, so `per` instances make one shell.
  const FUR_VERT_PARS = `
    uniform float uFurLen, uShells, uPer;
    uniform vec3 uComb;
    varying float vShell;
    varying vec3 vFurP;
    #ifdef FUR_MASK
      attribute float furMask;
      varying float vFurMask;
    #endif`;
  const FUR_VERT = `
    vShell = (floor(float(gl_InstanceID) / uPer) + 1.) / uShells;
    #ifdef USE_INSTANCING
      float furS = length(instanceMatrix[0].xyz);
      vFurP = (instanceMatrix * vec4(position, 1.)).xyz;
    #else
      float furS = 1.;
      vFurP = position;
    #endif
    float furL = uFurLen * vShell / furS;
    #ifdef FUR_MASK
      furL *= furMask;
      vFurMask = furMask;
    #endif
    transformed += objectNormal * furL + uComb * (furL * vShell);`;
  const FUR_FRAG_PARS = `
    uniform float uDensity, uAO, uTaper, uTipLift;
    varying float vShell;
    varying vec3 vFurP;
    #ifdef FUR_MASK
      varying float vFurMask;
    #endif
    float furHash(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    vec3 furHash3(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
    bool furStrand(vec3 q) {
      vec3 cell = floor(q);
      float t = vShell / mix(.5, 1., furHash(cell));
      vec3 d = fract(q) - (.3 + .4 * furHash3(cell));
      return t <= 1. && length(d) <= .45 * (1. - t * uTaper);
    }`;
  const FUR_FRAG = `
    {
      #ifdef FUR_MASK
        if (vFurMask < .04) discard;
      #endif
      vec3 q = vFurP * uDensity;
      if (!furStrand(q) && !furStrand(mat3(.8, .36, -.48, -.6, .48, -.64, 0., .8, .6) * q + 17.3)) discard;
      diffuseColor.rgb *= mix(uAO, 1., vShell);
      // Tips catch the light, which is most of what makes fur read as soft rather than dark and grainy.
      diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * (1. + uTipLift) + uTipLift * .25, vec3(1.)), vShell * vShell);
    }`;
  const FUR = {
    hair: { len: .036, shells: 14, density: 80, ao: .76, taper: .75, tip: .22, comb: [0, -.45, 0] },
    curls: { len: .032, shells: 14, density: 90, ao: .84, taper: .75, tip: .3, comb: [0, -.2, 0] },
    fabric: { len: .011, shells: 6, density: 220, ao: .98, taper: .55, tip: 0, comb: [0, -.2, 0] }
  };

  // Perm curls are many small bumpy balls; shaded one by one they come out blotchy. Shading each instance as if it
  // sat on one big ball round the parent's origin (the head centre) lights the whole perm like one soft cloud.
  const SMOOTH_VERT = `
    #if defined(USE_INSTANCING) && defined(FUR_SMOOTH)
      transformedNormal = normalize(normalMatrix * instanceMatrix[3].xyz);
    #endif
    #include <normal_vertex>`;
  function smoothShaded(T, base) {
    const m = base.clone();
    m.defines = Object.assign({}, m.defines, { FUR_SMOOTH: '' });
    m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <normal_vertex>', SMOOTH_VERT); };
    m.customProgramCacheKey = () => 'figure-smooth';
    return m;
  }

  function furMaterial(T, base, F, per, masked, smooth) {
    const o = { color: base.color.clone(), map: base.map, vertexColors: base.vertexColors, side: base.side };
    const m = base.isMeshToonMaterial ? new T.MeshToonMaterial(Object.assign(o, { gradientMap: base.gradientMap }))
      : new T.MeshStandardMaterial(Object.assign(o, { roughness: .95, metalness: 0 }));
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, {
        uFurLen: { value: F.len }, uShells: { value: F.shells }, uPer: { value: per }, uComb: { value: new T.Vector3(...F.comb) },
        uDensity: { value: F.density }, uAO: { value: F.ao }, uTaper: { value: F.taper }, uTipLift: { value: F.tip }
      });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>' + FUR_VERT_PARS)
        .replace('#include <normal_vertex>', SMOOTH_VERT)
        .replace('#include <begin_vertex>', '#include <begin_vertex>' + FUR_VERT);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>' + FUR_FRAG_PARS)
        .replace('#include <color_fragment>', '#include <color_fragment>' + FUR_FRAG);
    };
    m.defines = {};
    if (masked) m.defines.FUR_MASK = '';
    if (smooth) m.defines.FUR_SMOOTH = '';
    m.customProgramCacheKey = () => 'figure-fur';
    return m;
  }

  // Where headwear covers the hair: rays from the head centre on a direction grid record how far out the first
  // hat, helmet or headscarf surface is. A hair point with headwear just beyond it is hidden, so it grows no fur
  // (otherwise the fur would poke through the hat).
  function coverTest(T, root, head) {
    const wear = [];
    root.traverse(o => { if (o.isMesh && o.userData.headwear) wear.push(o); });
    if (!head || !wear.length) return null;
    root.updateMatrixWorld(true);
    const C = head.getWorldPosition(new T.Vector3()), NU = 48, NV = 24, far = new Float32Array(NU * NV).fill(Infinity);
    const ray = new T.Raycaster(), d = new T.Vector3();
    for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) {
      const th = (i + .5) / NV * Math.PI, phi = (j + .5) / NU * 2 * Math.PI - Math.PI;
      ray.set(C, d.set(Math.sin(phi) * Math.sin(th), Math.cos(th), Math.cos(phi) * Math.sin(th)));
      const hit = ray.intersectObjects(wear, false)[0];
      if (hit) far[i * NU + j] = hit.distance;
    }
    return p => {
      d.subVectors(p, C);
      const r = d.length(), th = Math.acos(Math.max(-1, Math.min(1, d.y / r))), phi = Math.atan2(d.x, d.z);
      const t = far[Math.min(NV - 1, Math.floor(th / Math.PI * NV)) * NU + Math.floor((phi + Math.PI) / (2 * Math.PI) * NU) % NU];
      return t > r - .01 && t - r < .25;
    };
  }

  // Hair (materials tagged userData.hair in figure-cast.js) grows long fluff. With opts.fabric, fabrics (tagged
  // userData.fabric by the kit) also get a short plush fuzz; it is off by default because clothes are layered only a
  // hair's width apart, so an inner layer's fuzz pokes through the outer one as speckles. Skin, faces and hard props
  // stay smooth. Call after restyle(), since the fur copies whatever material the part wears at that moment.
  // opts.head (the figure's head group) keeps fur from growing under headwear; opts.lengths scales length per kind.
  function fluff(T, root, opts) {
    opts = opts || {};
    const added = [], mats = new Map(), I = new T.Matrix4(), M = new T.Matrix4(), c = new T.Color(), avg = new T.Color(), v = new T.Vector3(), parts = [];
    root.traverse(o => { if (o.isMesh && !o.userData.furShell) parts.push(o); });
    const covered = coverTest(T, root, opts.head);
    for (const o of parts) {
      const tag = (o.userData.lookOrig || o.material).userData || {}, m = o.material;
      if (Array.isArray(m) || m.transparent || !m.color) continue;
      const kind = tag.hair ? (o.isInstancedMesh ? 'curls' : 'hair') : tag.fabric && opts.fabric ? 'fabric' : null;
      if (!kind) continue;
      const F = Object.assign({}, FUR[kind]);
      F.len *= (opts.lengths && opts.lengths[kind]) || 1;
      // Instanced parts: keep the instances that show; plain hair: a per-vertex mask attribute.
      let keep = null, masked = false;
      if (o.isInstancedMesh) {
        keep = [];
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, M);
          if (!covered || !covered(v.setFromMatrixPosition(M).applyMatrix4(o.matrixWorld))) keep.push(i);
        }
        if (!keep.length) continue;
      } else if (covered && kind !== 'fabric') {
        const p = o.geometry.attributes.position, mask = new Float32Array(p.count);
        for (let i = 0; i < p.count; i++) mask[i] = covered(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)) ? 0 : 1;
        if (!mask.some(x => x > 0)) continue;
        o.geometry.setAttribute('furMask', new T.BufferAttribute(mask, 1));
        masked = true;
      }
      const per = keep ? keep.length : 1, key = kind + per + masked;
      if (!mats.has(m)) mats.set(m, new Map());
      if (!mats.get(m).has(key)) mats.get(m).set(key, furMaterial(T, m, F, per, masked, kind === 'curls'));
      const fur = new T.InstancedMesh(o.geometry, mats.get(m).get(key), per * F.shells);
      if (keep) {
        // Curls come in several shades; the fur pulls them toward their average so the perm reads as one soft mass.
        if (o.instanceColor) { avg.setRGB(0, 0, 0); keep.forEach(i => { o.getColorAt(i, c); avg.add(c); }); avg.multiplyScalar(1 / per); }
        keep.forEach((i, n) => {
          o.getMatrixAt(i, M);
          if (o.instanceColor) { o.getColorAt(i, c); c.lerp(avg, .6); }
          for (let s = 0; s < F.shells; s++) { fur.setMatrixAt(s * per + n, M); if (o.instanceColor) fur.setColorAt(s * per + n, c); }
        });
      } else for (let s = 0; s < F.shells; s++) fur.setMatrixAt(s, I);
      fur.frustumCulled = false;
      // Short fuzz takes its shade from the cloth under it; shadow-mapping every shell sprinkles lit dots over shaded cloth.
      fur.receiveShadow = kind !== 'fabric';
      fur.renderOrder = o.renderOrder;
      fur.userData.furShell = true;
      if (kind !== 'fabric') o.userData.flatNormals = true;
      if (kind === 'curls') { o.userData.furBase = o.material; o.material = smoothShaded(T, o.material); }
      o.add(fur);
      added.push(fur);
    }
    return {
      count: added.length,
      dispose() {
        for (const f of added) {
          const o = f.parent;
          if (o.userData.furBase) { o.material.dispose(); o.material = o.userData.furBase; delete o.userData.furBase; }
          delete o.userData.flatNormals;
          o.remove(f);
          f.dispose();
        }
        for (const byKey of mats.values()) for (const m of byKey.values()) m.dispose();
      }
    };
  }

  // ---------- post-processing ----------
  const QUAD_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const SSAO_FRAG = `
    #define N 16
    varying vec2 vUv;
    uniform sampler2D tNormal, tDepth;
    uniform mat4 proj, invProj;
    uniform vec3 kernel[N];
    uniform float radius, bias;
    vec3 viewPos(vec2 uv) { vec4 v = invProj * vec4(vec3(uv, texture2D(tDepth, uv).x) * 2. - 1., 1.); return v.xyz / v.w; }
    void main() {
      if (texture2D(tDepth, vUv).x >= 1.) { gl_FragColor = vec4(1.); return; }
      vec3 P = viewPos(vUv), Nn = normalize(texture2D(tNormal, vUv).xyz * 2. - 1.);
      vec2 cell = mod(floor(gl_FragCoord.xy), 4.);
      float a = (cell.x + cell.y * 4.) * .3927;
      vec3 rnd = vec3(cos(a), sin(a), 0.);
      vec3 Tn = normalize(rnd - Nn * dot(rnd, Nn));
      mat3 TBN = mat3(Tn, cross(Nn, Tn), Nn);
      float occ = 0.;
      for (int i = 0; i < N; i++) {
        vec3 s = P + TBN * kernel[i] * radius;
        vec4 o = proj * vec4(s, 1.);
        vec2 suv = clamp(o.xy / o.w * .5 + .5, 0., 1.);
        float sz = viewPos(suv).z;
        occ += step(s.z + bias, sz) * smoothstep(0., 1., radius / abs(P.z - sz));
      }
      gl_FragColor = vec4(vec3(1. - occ / float(N)), 1.);
    }`;
  const BLUR_FRAG = `
    varying vec2 vUv;
    uniform sampler2D tAO;
    uniform vec2 texel;
    void main() {
      float s = 0.;
      for (int x = -2; x < 2; x++) for (int y = -2; y < 2; y++) s += texture2D(tAO, vUv + (vec2(x, y) + .5) * texel).r;
      gl_FragColor = vec4(vec3(s / 16.), 1.);
    }`;
  const FINAL_FRAG = `
    #include <packing>
    varying vec2 vUv;
    uniform sampler2D tColor, tNormal, tDepth, tAO;
    uniform vec2 texel;
    uniform float near, far, lineW, aoAmt, fogNear, fogFar;
    uniform vec3 ink, bg;
    uniform int mode;
    float depthAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
    vec3 normalAt(vec2 uv) { return texture2D(tNormal, uv).xyz * 2. - 1.; }
    void main() {
      // Empty background keeps its exact colour, as it does when rendering straight to the canvas.
      if (texture2D(tDepth, vUv).x >= 1.) { gl_FragColor = vec4(bg, 1.);
        #include <colorspace_fragment>
        return;
      }
      vec3 c = texture2D(tColor, vUv).rgb;
      if (mode == 1) {
        float z = depthAt(vUv), e = 0.;
        vec3 n = normalAt(vUv);
        for (int i = 0; i < 8; i++) {
          float a = float(i) * .7854;
          vec2 uv = vUv + vec2(cos(a), sin(a)) * lineW * texel;
          float zz = depthAt(uv), dz = (zz - z) / z;
          e = max(e, smoothstep(.035, .08, dz));
          e = max(e, smoothstep(.45, .7, 1. - dot(n, normalAt(uv))) * (1. - smoothstep(.02, .05, abs(dz))));
        }
        e *= 1. - smoothstep(9., 14., z);
        c = mix(c, c * ink, e);
      } else if (mode == 2) {
        // Far floor is left alone: depth there is too coarse for the occlusion test.
        c *= mix(1., texture2D(tAO, vUv).r, aoAmt * (1. - smoothstep(9., 14., -perspectiveDepthToViewZ(texture2D(tDepth, vUv).x, near, far))));
      }
      gl_FragColor = vec4(c, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      // Fog last, in display colours, the same order three.js uses, so the far floor melts into the backdrop.
      gl_FragColor.rgb = mix(gl_FragColor.rgb, linearToOutputTexel(vec4(bg, 1.)).rgb, smoothstep(fogNear, fogFar, depthAt(vUv)));
    }`;

  function post(T, renderer) {
    const rt = {}, size = new T.Vector2(-1, -1), cur = new T.Vector2();
    const normalMat = new T.MeshNormalMaterial({ side: T.DoubleSide }), flatMat = new T.MeshBasicMaterial({ color: new T.Color(.5, .5, 1), side: T.DoubleSide });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2)), quadScene = new T.Scene(), quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad.frustumCulled = false;
    quadScene.add(quad);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const kernel = Array.from({ length: 16 }, (_, i) => {
      const v = new T.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * .9 + .1).normalize(), s = i / 16;
      return v.multiplyScalar(.15 + .85 * s * s);
    });
    const shader = (frag, uniforms) => new T.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    const ssao = shader(SSAO_FRAG, { tNormal: { value: null }, tDepth: { value: null }, proj: { value: new T.Matrix4() }, invProj: { value: new T.Matrix4() }, kernel: { value: kernel }, radius: { value: .2 }, bias: { value: .004 } });
    const blur = shader(BLUR_FRAG, { tAO: { value: null }, texel: { value: new T.Vector2() } });
    const final = shader(FINAL_FRAG, {
      tColor: { value: null }, tNormal: { value: null }, tDepth: { value: null }, tAO: { value: null }, texel: { value: new T.Vector2() },
      near: { value: .1 }, far: { value: 80 }, lineW: { value: 1.5 }, aoAmt: { value: 1 }, ink: { value: new T.Color(.2, .14, .16) }, bg: { value: new T.Color() }, fogNear: { value: 0 }, fogFar: { value: 1e9 }, mode: { value: 0 }
    });
    ssao.toneMapped = blur.toneMapped = false;

    function resize() {
      renderer.getDrawingBufferSize(cur);
      if (cur.equals(size)) return;
      size.copy(cur);
      for (const k in rt) rt[k].dispose();
      const w = size.x, h = size.y;
      rt.color = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, samples: 4 });
      rt.geo = new T.WebGLRenderTarget(w, h, { depthTexture: new T.DepthTexture(w, h) });
      rt.ao = new T.WebGLRenderTarget(w, h);
      rt.blur = new T.WebGLRenderTarget(w, h);
    }
    function pass(m, target) {
      quad.material = m;
      renderer.setRenderTarget(target);
      renderer.render(quadScene, quadCam);
    }
    const hidden = [], swapped = [];
    function render(scene, camera, style) {
      if (style !== 'toon' && style !== 'clay') { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
      resize();
      // View-space normals and depth. See-through parts (visors) and fur shells are left out so lines and shade follow
      // what is behind them; fluffed hair writes one flat normal, so only its outline gets ink, not every curl under the fur.
      const bg = scene.background, fog = scene.fog;
      scene.background = null; scene.fog = null;
      scene.traverseVisible(o => {
        if (!o.isMesh) return;
        if (o.userData.furShell || (o.material.transparent && o.material.opacity < .99)) { hidden.push(o); return; }
        swapped.push(o, o.material);
        o.material = o.userData.flatNormals ? flatMat : normalMat;
      });
      hidden.forEach(o => { o.visible = false; });
      renderer.setRenderTarget(rt.geo);
      renderer.render(scene, camera);
      hidden.forEach(o => { o.visible = true; });
      for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
      hidden.length = swapped.length = 0;
      scene.background = bg; scene.fog = fog;

      scene.fog = null;
      renderer.setRenderTarget(rt.color);
      renderer.render(scene, camera);
      scene.fog = fog;

      const U = final.uniforms;
      if (style === 'clay') {
        ssao.uniforms.tNormal.value = rt.geo.texture;
        ssao.uniforms.tDepth.value = rt.geo.depthTexture;
        ssao.uniforms.proj.value.copy(camera.projectionMatrix);
        ssao.uniforms.invProj.value.copy(camera.projectionMatrixInverse);
        pass(ssao, rt.ao);
        blur.uniforms.tAO.value = rt.ao.texture;
        blur.uniforms.texel.value.set(1 / size.x, 1 / size.y);
        pass(blur, rt.blur);
        U.tAO.value = rt.blur.texture;
      }
      U.tColor.value = rt.color.texture;
      U.tNormal.value = rt.geo.texture;
      U.tDepth.value = rt.geo.depthTexture;
      U.texel.value.set(1 / size.x, 1 / size.y);
      U.near.value = camera.near; U.far.value = camera.far;
      U.lineW.value = Math.max(1, renderer.getPixelRatio() * 1.6);
      if (bg && bg.isColor) U.bg.value.copy(bg);
      U.fogNear.value = fog && fog.isFog ? fog.near : 0;
      U.fogFar.value = fog && fog.isFog ? fog.far : 1e9;
      U.mode.value = style === 'toon' ? 1 : 2;
      pass(final, null);
    }
    return {
      render, settings: { ssao: ssao.uniforms, final: final.uniforms },
      dispose() { for (const k in rt) rt[k].dispose(); [normalMat, flatMat, ssao, blur, final].forEach(m => m.dispose()); quad.geometry.dispose(); }
    };
  }

  global.FigureLook = { restyle, fluff, post };
})(typeof window !== 'undefined' ? window : globalThis);
