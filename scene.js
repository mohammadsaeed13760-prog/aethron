// AETHRON — 3D stage (three.js), lazy-loaded by main.js
import * as THREE from './assets/vendor/three.module.min.js';

const A_SHAPES = [[[0.0235, 1.2], [1.2874, -1.2], [0.7832, -1.2], [0.0101, 0.2857], [-0.4336, -0.4941], [-0.9311, -0.4941]], [[-1.2874, -1.2], [0.0639, -1.2], [0.3462, -0.6891], [-0.9849, -0.6891]]]; // traced from Mohammad's official logo (units: A height = 2.4)

export function init({ canvas, poster }) {
  const ua = navigator.userAgent;
  const mobile = matchMedia('(max-width: 820px)').matches || /Android|iPhone|iPad|Mobile/i.test(ua);
  const lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const tier = mobile ? (lowMem ? 0 : 1) : 2; // 0 low phone, 1 phone, 2 desktop

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: tier >= 1, alpha: true, powerPreference: 'high-performance', stencil: false });
  } catch (e) { console.warn('WebGL failed', e); return; }

  const DPR_CAP = [1, 1.35, 1.75][tier];
  let dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(mobile ? 42 : 34, 1, 0.1, 80);
  camera.position.set(0, 0, 7);

  /* ---------- studio environment: black room with soft light strips ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x050506);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const strip = (w, h, d, x, y, z, I, ry = 0) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(I, I, I) });
    const mesh = new THREE.Mesh(box, m); mesh.scale.set(w, h, d); mesh.position.set(x, y, z); mesh.rotation.y = ry; env.add(mesh);
  };
  strip(0.5, 9, 3, -7, 1, 2, 9);       // tall key strip, left
  strip(0.4, 7, 2.2, 7, 0, -2, 4.5);   // rim strip, right back
  strip(9, 0.35, 3, 0, 7, 0, 6);       // top bar
  strip(9, 2.4, 0.3, 0, 4.5, 9, 3.2);   // wide front softbox, high
  strip(0.6, 6, 0.3, -2.6, 0, 9, 5.5);  // front vertical strips: flash across the face as it turns
  strip(0.3, 6, 0.3, 2.2, 0, 9, 3.5);
  strip(14, 9, 0.3, 0, 0, 10, 0.55);   // broad dim front wall so the face reads silver, not black
  strip(6, 0.25, 1.6, 0, -6, 2, 1.2);  // floor bounce
  const envTex = pmrem.fromScene(env, 0.035).texture;
  scene.environment = envTex;
  env.traverse(o => { if (o.material) o.material.dispose(); });

  /* ---------- the A ---------- */
  const aGroup = new THREE.Group();
  scene.add(aGroup);
  const shapes = A_SHAPES.map(pts => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: 0.34, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.03, bevelSegments: tier === 0 ? 1 : 3, curveSegments: 1,
  });
  geo.center();
  geo.computeVertexNormals();

  const sweep = { value: -10 };
  const aiU = { value: 1 };
  const matOpts = { color: 0xdfe2e8, metalness: 1.0, roughness: 0.2, envMapIntensity: 1.15 };
  const aMat = tier === 2
    ? new THREE.MeshPhysicalMaterial({ ...matOpts, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.06 })
    : new THREE.MeshStandardMaterial(matOpts);
  aMat.onBeforeCompile = (sh) => {
    sh.uniforms.uSweep = sweep; sh.uniforms.uAi = aiU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSweepPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSweepPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSweepPos;\nuniform float uSweep;\nuniform float uAi;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float sd = dot(vSweepPos, normalize(vec3(1.0, 0.55, 0.25))) - uSweep;
        float band = exp(-sd * sd * 9.0) * 0.55 + exp(-sd * sd * 90.0) * 0.6;
        gl_FragColor.rgb += vec3(band) * vec3(0.95, 0.97, 1.0) * uAi;`);
  };
  const baseColor = new THREE.Color(0xdfe2e8);
  const aMesh = new THREE.Mesh(geo, aMat);
  aGroup.add(aMesh);

  // soft halo behind the A
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.35, 'rgba(200,210,255,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.32, toneMapped: false }));
  halo.position.z = -1.2; aGroup.add(halo);

  /* ---------- particle field + neural network ---------- */
  const field = new THREE.Group();
  scene.add(field);
  const rand = (a, b) => a + Math.random() * (b - a);
  const accent = new THREE.Color(0x9dbcff);

  const pointVS = `
    attribute float aSize; attribute float aPhase; attribute float aTint;
    uniform float uTime; uniform float uPx; uniform float uFog;
    varying float vAlpha; varying float vTint;
    void main(){
      vec3 p = position;
      p.y += sin(uTime * 0.15 + aPhase * 6.28) * 0.12;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float d = -mv.z;
      gl_PointSize = clamp(aSize * uPx * 30.0 / max(d, 0.5), 1.0, 7.0 * uPx);
      float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0);
      float fog = exp(-uFog * uFog * d * d);
      vAlpha = tw * fog * smoothstep(0.4, 1.6, d);
      vTint = aTint;
      gl_Position = projectionMatrix * mv;
    }`;
  const pointFS = `
    uniform vec3 uAccent; varying float vAlpha; varying float vTint;
    void main(){
      vec2 c = gl_PointCoord - 0.5; float r = length(c);
      float a = smoothstep(0.5, 0.0, r); a *= a;
      vec3 col = mix(vec3(1.0), uAccent, vTint);
      gl_FragColor = vec4(col, a * vAlpha);
    }`;
  const uniforms = { uTime: { value: 0 }, uPx: { value: dpr }, uFog: { value: 0.075 }, uAccent: { value: accent } };

  function pointCloud(positions, sizeRange, tintChance) {
    const n = positions.length / 3;
    const g = new THREE.BufferGeometry();
    const size = new Float32Array(n), phase = new Float32Array(n), tint = new Float32Array(n);
    for (let i = 0; i < n; i++) { size[i] = rand(sizeRange[0], sizeRange[1]); phase[i] = Math.random(); tint[i] = Math.random() < tintChance ? 1 : 0; }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    const m = new THREE.ShaderMaterial({ uniforms, vertexShader: pointVS, fragmentShader: pointFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return new THREE.Points(g, m);
  }

  // dust: deep volume
  const DUST = [700, 1200, 2400][tier];
  const dust = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dust[i * 3] = rand(-16, 16); dust[i * 3 + 1] = rand(-10, 10); dust[i * 3 + 2] = rand(-22, 3);
  }
  const dustPts = pointCloud(dust, [0.25, 0.9], 0.08);
  field.add(dustPts);

  // neural nodes on a loose shell around the A
  const NODES = [180, 260, 420][tier];
  const nodes = new Float32Array(NODES * 3);
  const nv = [];
  for (let i = 0; i < NODES; i++) {
    const u = Math.random() * Math.PI * 2, v = Math.acos(rand(-1, 1)), r = rand(3.2, 8.5);
    const x = r * Math.sin(v) * Math.cos(u) * 1.35, y = r * Math.cos(v) * 0.75, z = r * Math.sin(v) * Math.sin(u) - 2.5;
    nodes.set([x, y, z], i * 3); nv.push(new THREE.Vector3(x, y, z));
  }
  const nodePts = pointCloud(nodes, [1.2, 2.4], 0.18);
  field.add(nodePts);

  // connections: each node to its nearest neighbours
  const segs = [], tAttr = [], offAttr = [];
  const MAXD = 2.1;
  for (let i = 0; i < NODES; i++) {
    const near = [];
    for (let j = i + 1; j < NODES; j++) { const d = nv[i].distanceTo(nv[j]); if (d < MAXD) near.push([d, j]); }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, j] of near.slice(0, 2)) {
      segs.push(nv[i].x, nv[i].y, nv[i].z, nv[j].x, nv[j].y, nv[j].z);
      const o = Math.random() * 10; tAttr.push(0, 1); offAttr.push(o, o);
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  lg.setAttribute('aT', new THREE.Float32BufferAttribute(tAttr, 1));
  lg.setAttribute('aOff', new THREE.Float32BufferAttribute(offAttr, 1));
  const lineMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aT; attribute float aOff; uniform float uFog; varying float vT; varying float vOff; varying float vFog;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float d=-mv.z; vFog = exp(-uFog*uFog*d*d); vT=aT; vOff=aOff; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uAccent; varying float vT; varying float vOff; varying float vFog;
      void main(){ float p = fract(uTime*0.22 + vOff*0.1); float pulse = smoothstep(0.09,0.0,abs(vT-p)) * step(0.55, fract(vOff));
        vec3 col = mix(vec3(1.0), uAccent, pulse*0.7);
        gl_FragColor = vec4(col, (0.07 + pulse*0.75) * vFog); }`,
  });
  const lines = new THREE.LineSegments(lg, lineMat);
  field.add(lines);

  /* ---------- scroll choreography ---------- */
  // per-section keyframes: camera position, look target, A position, A extra yaw, A scale, exposure
  const K = mobile ? {
    hero:       { cam: [0, 0, 8.6], look: [0, 0, 0], a: [0, 1.4, 0], yaw: 0, s: 0.92, ex: 1.0, ai: 1 },
    name:       { cam: [0, -0.4, 8.5], look: [0, 0.6, 0], a: [2.6, 3.8, -7], yaw: -0.6, s: 0.9, ex: 0.8, ai: 0.3 },
    about:      { cam: [1.2, 0.4, 7.5], look: [0, 0, -1], a: [1.7, 2.6, -5], yaw: 0.9, s: 1, ex: 0.8, ai: 0.5 },
    products:   { cam: [-0.8, 0.6, 4.2], look: [0, 0, -3], a: [-2.5, 3, -9], yaw: 1.4, s: 1, ex: 0.8, ai: 0.5 },
    divisions:  { cam: [0.8, -0.6, 5.5], look: [0, 0, -2], a: [2, -3, -8], yaw: -0.6, s: 1, ex: 0.8, ai: 0.5 },
    research:   { cam: [0, 2.4, 6.5], look: [0, 0, -2], a: [2.4, 4.6, -8], yaw: 0.3, s: 0.8, ex: 0.8, ai: 0.3 },
    mission:    { cam: [0, 0, 6], look: [0, 0, -2], a: [-2.6, -3.8, -8], yaw: -0.4, s: 0.9, ex: 0.8, ai: 0.3 },
    leadership: { cam: [-1, 0, 7], look: [0, 0, -2], a: [-1.9, 2.8, -6], yaw: 0.8, s: 0.9, ex: 0.8, ai: 0.5 },
    media:      { cam: [0, 0, 8], look: [0, 0, 0], a: [2.6, -4.4, -7], yaw: -0.3, s: 0.9, ex: 0.85, ai: 0.35 },
    outro:      { cam: [0, 0, 8.6], look: [0, 0, 0], a: [0, 1.55, 0], yaw: 0, s: 0.7, ex: 1.0, ai: 1 },
  } : {
    hero:       { cam: [0, 0, 7.2], look: [0, 0, 0], a: [0, 0.9, 0], yaw: 0, s: 1, ex: 1.0, ai: 1 },
    name:       { cam: [0, -0.6, 8.2], look: [0, 0.4, 0], a: [7.6, 3.6, -9], yaw: -0.7, s: 1, ex: 0.75, ai: 0.6 },
    about:      { cam: [-0.4, 0.2, 6.6], look: [0.9, 0, 0], a: [2.75, 0.15, 0], yaw: -0.5, s: 0.95, ex: 1.0, ai: 1 },
    products:   { cam: [-1.6, 0.8, 4.2], look: [0, 0, -3], a: [6.4, 2.1, -10], yaw: -0.9, s: 0.9, ex: 0.85, ai: 0.8 },
    divisions:  { cam: [1.4, -0.4, 5.2], look: [0, 0, -1.5], a: [-7.2, -2.4, -7], yaw: 0.9, s: 1, ex: 0.8, ai: 0.8 },
    research:   { cam: [0.2, 2.2, 6.6], look: [0, 0, -3], a: [0.1, 0.4, -15], yaw: 0.6, s: 0.9, ex: 0.85, ai: 0.9 },
    mission:    { cam: [0, 0, 6.6], look: [0, 0, -1], a: [5.6, -2.6, -8], yaw: -0.6, s: 0.9, ex: 0.8, ai: 0.9 },
    leadership: { cam: [-1.2, 0.3, 7.4], look: [0, 0, -1], a: [6.2, 0.8, -4], yaw: -0.7, s: 0.95, ex: 0.85, ai: 0.8 },
    media:      { cam: [0.6, 0, 7.6], look: [0, 0, 0], a: [4.3, -0.9, -2], yaw: -0.5, s: 0.9, ex: 0.9, ai: 0.9 },
    outro:      { cam: [0, 0, 7.4], look: [0, 0.5, 0], a: [0, 1.3, 0], yaw: 0, s: 0.75, ex: 1.0, ai: 1 },
  };
  function heroFromDom() {
    const h = window.__heroA; if (!h || !H) return;
    const k = K.hero, Z = k.cam[2];
    const vH = 2 * Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    k.a = [(h.x / W - 0.5) * vH * (W / H), (0.5 - h.y / H) * vH, 0];
    k.s = (h.h / H) * vH / 2.4;
    k.look = [0, 0, 0];
  }
  addEventListener('aethron:hero', () => { heroFromDom(); });
  const sections = [...document.querySelectorAll('[data-scene]')].filter(s => K[s.dataset.scene]);
  let anchors = [];
  function measure() {
    const vh = innerHeight;
    anchors = sections.map(s => {
      const top = s.getBoundingClientRect().top + scrollY;
      return { y: Math.max(0, top + Math.min(s.offsetHeight, vh) * 0.5 - vh * 0.5), k: K[s.dataset.scene] };
    });
    anchors[0].y = 0;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  function target(y) {
    if (y <= anchors[0].y) return anchors[0].k;
    for (let i = 0; i < anchors.length - 1; i++) {
      const A0 = anchors[i], A1 = anchors[i + 1];
      if (y < A1.y) {
        const t = ease((y - A0.y) / Math.max(1, A1.y - A0.y));
        const o = {};
        for (const key of Object.keys(A0.k)) {
          const v0 = A0.k[key], v1 = A1.k[key];
          o[key] = Array.isArray(v0) ? v0.map((v, j) => lerp(v, v1[j], t)) : lerp(v0, v1, t);
        }
        return o;
      }
    }
    return anchors[anchors.length - 1].k;
  }
  let cur = null;

  /* ---------- input ---------- */
  let px = 0, py = 0, spx = 0, spy = 0;
  addEventListener('pointermove', e => { px = (e.clientX / innerWidth) * 2 - 1; py = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  if (mobile && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      px = Math.max(-1, Math.min(1, e.gamma / 30)); py = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    }, { passive: true });
  }

  /* ---------- sizing ---------- */
  let W = 0, H = 0;
  function resize(force) {
    // the backdrop is sized to the largest viewport (100lvh), so the URL bar never opens a gap
    const w = innerWidth, h = canvas.parentElement.clientHeight || innerHeight;
    if (!force && w === W && Math.abs(h - H) < 2) return;
    W = w; H = h;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    heroFromDom();
    measure();
  }
  addEventListener('resize', () => resize(false), { passive: true });
  addEventListener('load', () => measure());
  setTimeout(measure, 1500);
  resize(true);

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let running = true, t = 0, frames = 0, slowAcc = 0, firstFrame = true;
  const look = new THREE.Vector3();
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { clock.getDelta(); requestAnimationFrame(loop); }
  });

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    // adaptive resolution: if frames are slow, step the pixel ratio down
    frames++;
    if (frames > 20) {
      slowAcc = slowAcc * 0.95 + (dt > 0.024 ? 1 : 0) * 0.05;
      if (slowAcc > 0.6 && dpr > 0.75) {
        dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
        uniforms.uPx.value = dpr; slowAcc = 0; frames = 0;
      }
    }

    const tg = target(scrollY);
    if (!cur) cur = JSON.parse(JSON.stringify(tg));
    const k = 1 - Math.exp(-dt * 3.2);
    for (const key of Object.keys(cur)) {
      if (Array.isArray(cur[key])) cur[key] = cur[key].map((v, j) => v + (tg[key][j] - v) * k);
      else cur[key] += (tg[key] - cur[key]) * k;
    }
    spx += (px - spx) * (1 - Math.exp(-dt * 2.5));
    spy += (py - spy) * (1 - Math.exp(-dt * 2.5));

    camera.position.set(cur.cam[0] + spx * 0.35, cur.cam[1] - spy * 0.22, cur.cam[2]);
    look.set(cur.look[0], cur.look[1], cur.look[2]);
    camera.lookAt(look);

    aGroup.position.set(cur.a[0], cur.a[1] + Math.sin(t * 0.6) * 0.05, cur.a[2]);
    aGroup.scale.setScalar(cur.s);
    aMesh.rotation.y = window.__aethronStill ? 0.32 : Math.sin(t * 0.22) * 0.45 + cur.yaw + spx * 0.45;
    aMesh.rotation.x = window.__aethronStill ? 0.02 : Math.sin(t * 0.17) * 0.06 + spy * 0.22;
    halo.lookAt(camera.position);

    // light sweep: crosses the A every ~7 s
    const cyc = window.__aethronStill ? 0.2 : (t % 7.0) / 7.0;
    sweep.value = cur.a[0] * 0.9 + cur.a[1] * 0.5 + lerp(-3.2, 3.2, Math.min(1, cyc / 0.45)) + (cyc > 0.45 ? 10 : 0);

    field.rotation.y = t * 0.018 + spx * 0.06;
    field.rotation.x = -spy * 0.03;
    uniforms.uTime.value = t;
    renderer.toneMappingExposure = cur.ex;
    aiU.value = cur.ai; aMat.envMapIntensity = 1.15 * cur.ai; aMat.color.copy(baseColor).multiplyScalar(0.3 + 0.7 * cur.ai); halo.material.opacity = 0.32 * cur.ai;

    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      canvas.classList.add('on');
      if (poster) poster.classList.add('off');
      window.__aethron3d = { tier, dpr: () => dpr };
    }
  }
  // ?still renders a clean frame of the A alone (used to make the static poster image)
  if (new URLSearchParams(location.search).has('still')) { field.visible = false; halo.visible = false; window.__aethronStill = true; }
  requestAnimationFrame(loop);
}
