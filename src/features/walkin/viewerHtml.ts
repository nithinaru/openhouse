// Builds the self-contained HTML page for "Walk in": three.js + Spark (World
// Labs' open-source Gaussian-splat renderer, sparkjs.dev) inside
// react-native-webview. Spark auto-detects .ply (Apple SHARP output) and .spz.
//
// Look: "a memory, not a scan". The scene renders into a small render target
// that is upscaled with nearest-neighbour, then one post pass adds chromatic
// aberration, ordered (Bayer) dithering into the trip palette, a heavy radial
// vignette into fog, and film grain. The camera drifts slowly and gyro tilt
// nudges it. Each node opens up from its flat photo.
//
// Walk mode: several nodes (one splat per photo). Floor arrows point to the
// next node, turned by the change in compass heading. Tap / swipe up or left
// goes forward, swipe down or right goes back, long-press toggles the flat
// photo. The next two splats preload.
//
// Versions are pinned to the pair Spark's README documents:
//   three@0.180.0 (Spark 2.x peer dep is three >=0.180.0), @sparkjsdev/spark@2.4.0
// Spark's module imports both "three" and "three/addons/...", so the import
// map provides both.

export const THREE_VERSION = '0.180.0';
export const SPARK_VERSION = '2.4.0';

export type ViewerNode = {
  splatUrl?: string; // .ply or .spz; a node without one shows its photo flat
  photoUri?: string; // the 2D photo the splat opens up from
  headingDeg?: number; // EXIF compass heading, used to turn the floor arrows
};

export type ViewerOptions = {
  nodes: ViewerNode[];
  startIndex?: number;
  palette?: string[]; // trip palette, hex
  // SHARP and Marble splats use the OpenCV frame (y down, z forward); rotate
  // 180 degrees about X for three.js, as Spark's examples do. Default true.
  flipX?: boolean;
  // Splat placement. SHARP puts the photo's camera at the origin, so the
  // default (origin) lines the 3D view up with the photo.
  position?: [number, number, number];
  fovDeg?: number; // vertical FOV; default 60
  pixelSize?: number; // CSS px per internal pixel; default 3
  fogColor?: string;
  arrowColor?: string;
  textColor?: string;
  post?: boolean; // false renders straight to the canvas (debug); default true
};

// Messages posted back to React Native via window.ReactNativeWebView.
export type ViewerMessage =
  | { type: 'loaded'; index: number }
  | { type: 'node'; index: number }
  | { type: 'flat'; flat: boolean }
  | { type: 'error'; message: string; index?: number };

// JS RN can inject into the page (webview.injectJavaScript).
export const injectGyro = (beta: number, gamma: number) =>
  `window.__gyro && window.__gyro(${beta.toFixed(4)}, ${gamma.toFixed(4)}); true;`;
export const injectStep = (delta: 1 | -1) => `window.__go && window.__go(${delta}); true;`;

// JSON for inline <script>: escape "<" so a URL can never close the tag.
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildViewerHtml(options: ViewerOptions): string {
  const config = {
    nodes: options.nodes,
    startIndex: options.startIndex ?? 0,
    palette: options.palette ?? [],
    flipX: options.flipX ?? true,
    position: options.position ?? [0, 0, 0],
    fovDeg: options.fovDeg ?? 60,
    pixelSize: options.pixelSize ?? 3,
    fogColor: options.fogColor ?? '#0E1116',
    arrowColor: options.arrowColor ?? '#D9A441',
    post: options.post ?? true,
  };
  const textColor = options.textColor ?? '#F2EEE6';
  const threeBase = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;
  const sparkUrl = `https://cdn.jsdelivr.net/npm/@sparkjsdev/spark@${SPARK_VERSION}/dist/spark.module.js`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: ${config.fogColor}; overflow: hidden; overscroll-behavior: none;
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  canvas { position: fixed; inset: 0; display: block; width: 100vw; height: 100vh; touch-action: none; }
  #photo { position: fixed; inset: 0; width: 100vw; height: 100vh; object-fit: cover; pointer-events: none;
    opacity: 1; transform: scale(1); transform-origin: 50% 50%;
    transition: opacity 1.8s ease, transform 2.4s cubic-bezier(.2,.7,.2,1);
    -webkit-mask-image: radial-gradient(ellipse 75% 65% at 50% 50%, #000 45%, transparent 100%);
            mask-image: radial-gradient(ellipse 75% 65% at 50% 50%, #000 45%, transparent 100%);
    filter: saturate(0.85) contrast(1.05) blur(0.4px); }
  #photo.gone { opacity: 0; transform: scale(1.07); }
  #photo.hidden { display: none; }
  #status { position: fixed; left: 0; right: 0; top: 50%; transform: translateY(-50%); padding: 0 32px;
    text-align: center; color: ${textColor}; font: 15px -apple-system, system-ui, sans-serif;
    opacity: 0.85; pointer-events: none; text-shadow: 0 1px 8px rgba(0,0,0,.6); transition: opacity .6s; }
  #status.off { opacity: 0; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "${threeBase}/build/three.module.js",
    "three/addons/": "${threeBase}/examples/jsm/",
    "@sparkjsdev/spark": "${sparkUrl}"
  }
}
</script>
</head>
<body>
<img id="photo" alt="" />
<div id="status">Walking in…</div>
<script>
  // Classic script: catches failures before or during module loading
  // (blocked CDN, no import-map support, syntax errors).
  window.__post = function (msg) {
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
  };
  window.__status = function (text) {
    var el = document.getElementById('status');
    if (!el) return;
    if (text) { el.textContent = text; el.className = ''; } else { el.className = 'off'; }
  };
  window.__fail = function (message, index) {
    window.__status("Couldn't open this place in 3D. " + message);
    window.__post({ type: 'error', message: String(message), index: index });
  };
  window.addEventListener('error', function (e) { window.__fail(e.message || 'Script error'); });
  window.addEventListener('unhandledrejection', function (e) {
    window.__fail((e.reason && e.reason.message) || String(e.reason));
  });
  (function () {
    var cfg = ${inlineJson(config)};
    var n = cfg.nodes[cfg.startIndex];
    if (n && n.photoUri) document.getElementById('photo').src = n.photoUri;
  })();
  setTimeout(function () { if (!window.__booted) window.__fail('The 3D viewer did not start.'); }, 20000);
</script>
<script type="module">
  import * as THREE from 'three';
  import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
  window.__booted = true;

  const cfg = ${inlineJson(config)};
  const photoEl = document.getElementById('photo');
  const status = window.__status;

  if (!document.createElement('canvas').getContext('webgl2')) {
    throw new Error('This device does not support WebGL2.');
  }

  // ---------- renderer, scene, low-res target ----------
  const fogColor = new THREE.Color(cfg.fogColor);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(fogColor, 1);
  document.body.insertBefore(renderer.domElement, photoEl);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(cfg.fovDeg, innerWidth / innerHeight, 0.01, 1000);
  camera.rotation.order = 'YXZ';
  const spark = new SparkRenderer({ renderer });
  scene.add(spark);

  const lowSize = () => [Math.max(64, Math.round(innerWidth / cfg.pixelSize)), Math.max(64, Math.round(innerHeight / cfg.pixelSize))];
  let [lw, lh] = lowSize();
  const rt = new THREE.WebGLRenderTarget(lw, lh, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
  });

  // ---------- palette ramp (dark -> light) ----------
  const lum = (c) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  const ramp = cfg.palette.map((h) => new THREE.Color(h)).filter((c) => !isNaN(c.r));
  ramp.push(fogColor.clone().multiplyScalar(0.6), new THREE.Color('#F2EEE6'));
  ramp.sort((a, b) => lum(a) - lum(b));
  const MAXP = 8;
  while (ramp.length > MAXP) ramp.splice(Math.floor(ramp.length / 2), 1);
  const palUniform = Array.from({ length: MAXP }, (_, i) => ramp[Math.min(i, ramp.length - 1)].clone());

  // ---------- post pass ----------
  const post = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      tScene: { value: rt.texture },
      uLow: { value: new THREE.Vector2(lw, lh) },
      uTime: { value: 0 },
      uFog: { value: 1 },
      uFogColor: { value: fogColor },
      uPal: { value: palUniform },
      uPalCount: { value: ramp.length },
      uPalMix: { value: 0.42 },
      uVignette: { value: 0.95 },
      uGrain: { value: 0.07 },
      uAberration: { value: 0.006 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: \`
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tScene;
      uniform vec2 uLow;
      uniform float uTime, uFog, uPalMix, uVignette, uGrain, uAberration;
      uniform vec3 uFogColor;
      uniform vec3 uPal[8];
      uniform int uPalCount;

      float bayer4(vec2 p) {
        // 4x4 ordered-dither threshold in [0,1)
        int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
        int i = x + y * 4;
        float m[16];
        m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
        m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
        float v = 0.0;
        for (int k = 0; k < 16; k++) { if (k == i) v = m[k]; }
        return (v + 0.5) / 16.0;
      }
      vec3 pal(float idx) {
        vec3 c = uPal[0];
        for (int k = 0; k < 8; k++) { if (float(k) == idx) c = uPal[k]; }
        return c;
      }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        vec2 uv = vUv;
        vec2 c = uv - 0.5;
        float r = length(c) * 2.0; // elliptical: 1.0 at the screen edges

        // slight chromatic aberration, stronger toward the edges
        vec2 dir = c * uAberration * (0.4 + r);
        vec3 col = vec3(texture2D(tScene, uv + dir).r, texture2D(tScene, uv).g, texture2D(tScene, uv - dir).b);

        // ordered dithering: quantize colour, and map luminance into the trip palette
        vec2 px = floor(uv * uLow);
        float th = bayer4(px);
        vec3 q = floor(col * 6.0 + th) / 6.0;
        float steps = float(uPalCount - 1);
        float l = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0) * steps;
        float idx = floor(l) + (fract(l) > th ? 1.0 : 0.0);
        col = mix(q, pal(min(idx, steps)), uPalMix);

        // heavy vignette that dissolves into fog; no hard borders
        float vig = smoothstep(0.4, 1.02, r);
        col = mix(col, uFogColor, clamp(vig * uVignette, 0.0, 1.0));
        col = mix(col, uFogColor, uFog);

        // film grain at screen resolution
        float g = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 100.0) - 0.5;
        col += g * uGrain;
        gl_FragColor = vec4(col, 1.0);
      }\`,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---------- floor arrows ----------
  const chevron = new THREE.Shape();
  [[0, 0.2], [0.3, -0.1], [0.22, -0.18], [0, 0.04], [-0.22, -0.18], [-0.3, -0.1]]
    .forEach(([x, y], i) => (i ? chevron.lineTo(x, y) : chevron.moveTo(x, y)));
  const chevGeo = new THREE.ShapeGeometry(chevron);
  chevGeo.rotateX(-Math.PI / 2); // lie flat, tip toward -z
  const arrowColor = new THREE.Color(cfg.arrowColor);
  const arrows = new THREE.Group();
  const arrowMats = [];
  for (let i = 0; i < 3; i++) {
    for (const [scale, op] of [[2.2, 0.95], [3.4, 0.25]]) {
      const m = new THREE.MeshBasicMaterial({
        color: arrowColor, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      m.userData = { base: op, step: i };
      arrowMats.push(m);
      const mesh = new THREE.Mesh(chevGeo, m);
      mesh.scale.setScalar(scale);
      mesh.renderOrder = 10;
      mesh.userData.step = i;
      arrows.add(mesh);
    }
  }
  arrows.visible = false;
  scene.add(arrows);
  let arrowsAlpha = 0;
  const FLOOR_Y = -1.0; // kept high enough to sit in the lower third of the view

  function placeArrows(turnRad) {
    for (const mesh of arrows.children) {
      const d = 2.2 + mesh.userData.step * 1.0;
      // the path bends gradually toward the turn
      const a = turnRad * (0.35 + 0.3 * mesh.userData.step);
      mesh.position.set(Math.sin(a) * d, FLOOR_Y, -Math.cos(a) * d);
      mesh.rotation.y = -a;
    }
  }

  // ---------- nodes ----------
  const nodes = cfg.nodes;
  const meshes = new Map(); // index -> { mesh, ready, failed }
  let index = Math.min(Math.max(cfg.startIndex, 0), Math.max(nodes.length - 1, 0));

  function turnTo(i) {
    const a = nodes[i] && nodes[i].headingDeg, b = nodes[i + 1] && nodes[i + 1].headingDeg;
    if (typeof a !== 'number' || typeof b !== 'number') return 0;
    let d = ((b - a + 540) % 360) - 180; // right turn positive
    d = Math.max(-75, Math.min(75, d));
    return (d * Math.PI) / 180;
  }

  function ensure(i) {
    if (i < 0 || i >= nodes.length || meshes.has(i) || !nodes[i].splatUrl) return;
    const entry = { mesh: null, ready: false, failed: false };
    meshes.set(i, entry);
    try {
      const mesh = new SplatMesh({ url: nodes[i].splatUrl });
      if (cfg.flipX) mesh.quaternion.set(1, 0, 0, 0);
      mesh.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);
      mesh.opacity = 0;
      mesh.visible = false;
      scene.add(mesh);
      entry.mesh = mesh;
      mesh.initialized.then(
        () => { entry.ready = true; window.__post({ type: 'loaded', index: i }); },
        (err) => { entry.failed = true; onFail(i, err); },
      );
    } catch (err) { entry.failed = true; onFail(i, err); }
    // preload the photo too
    if (nodes[i].photoUri) { const im = new Image(); im.src = nodes[i].photoUri; }
  }
  function onFail(i, err) {
    const msg = (err && err.message) || 'The 3D file failed to load.';
    if (i === index) { window.__fail(msg, i); showPhoto(true); }
    else window.__post({ type: 'error', message: msg, index: i });
  }
  function prune() {
    for (const [i, e] of meshes) {
      if (i < index - 1 || i > index + 2) {
        if (e.mesh) { scene.remove(e.mesh); try { e.mesh.dispose(); } catch (_) {} }
        meshes.delete(i);
      }
    }
  }
  function preload() { ensure(index); ensure(index + 1); ensure(index + 2); prune(); }

  function showPhoto(on) {
    const n = nodes[index];
    if (n && n.photoUri && photoEl.getAttribute('src') !== n.photoUri) photoEl.src = n.photoUri;
    photoEl.classList.toggle('hidden', !(n && n.photoUri));
    photoEl.classList.toggle('gone', !on);
  }

  // ---------- state ----------
  // phase: 'wait' (splat loading) | 'intro' | 'idle' | 'leave' | 'arrive'
  let phase = 'wait', phaseT = 0, dir = 1, turn = 0, flat = false;
  const ease = (t) => t * t * (3 - 2 * t);
  let dolly = 0, yawOffset = 0, fog = 1, opacity = 0;

  function current() { return meshes.get(index); }
  function setVisible() { for (const [i, e] of meshes) if (e.mesh) e.mesh.visible = i === index; }

  let viaWalk = false;
  function enter(i, fromDir, walked) {
    index = i; dir = fromDir; viaWalk = walked; turn = turnTo(index);
    preload(); setVisible(); placeArrows(turn);
    // first node opens up from its photo; walked-to nodes rise out of fog
    showPhoto(!walked || !nodes[index].splatUrl);
    phase = 'wait'; phaseT = 0;
    window.__post({ type: 'node', index });
  }

  window.__go = function (delta) {
    if (flat) { setFlat(false); return; }
    if (phase === 'leave' || phase === 'arrive') return; // intro can be skipped
    const next = index + delta;
    if (next < 0 || next >= nodes.length) {
      // gentle bump so the gesture still feels answered
      bump = delta * 0.12;
      return;
    }
    dir = delta; phase = 'leave'; phaseT = 0; leaveTo = next;
    if (photoEl && !photoEl.classList.contains('gone')) showPhoto(false);
  };
  let leaveTo = index, bump = 0;
  window.__debug = () => ({ phase, index, flat, loaded: [...meshes].map(([i, e]) => [i, e.ready, e.failed]) });

  function setFlat(on) {
    flat = on;
    showPhoto(on);
    window.__post({ type: 'flat', flat: on });
  }

  // ---------- gestures ----------
  let lookX = 0, lookY = 0, touch = null, longTimer = 0;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    if (touch) return; // ignore extra fingers
    el.setPointerCapture(e.pointerId);
    touch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false, long: false };
    clearTimeout(longTimer);
    longTimer = setTimeout(() => { if (touch && !touch.moved) { touch.long = true; setFlat(!flat); } }, 550);
  });
  el.addEventListener('pointermove', (e) => {
    if (!touch || e.pointerId !== touch.id) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    touch.x = e.clientX; touch.y = e.clientY;
    if (Math.hypot(touch.x - touch.x0, touch.y - touch.y0) > 10) touch.moved = true;
    // small look-around that springs back, never far enough to expose holes
    lookX = Math.max(-0.14, Math.min(0.14, lookX - dx * 0.0015));
    lookY = Math.max(-0.08, Math.min(0.08, lookY - dy * 0.0015));
  });
  function up(e) {
    if (!touch || e.pointerId !== touch.id) return;
    clearTimeout(longTimer);
    const t = touch; touch = null;
    if (t.long) return;
    const dx = t.x - t.x0, dy = t.y - t.y0, dt = performance.now() - t.t0, dist = Math.hypot(dx, dy);
    if (!t.moved && dt < 500) { window.__go(1); return; }
    if (dist > 50 && dt < 700) {
      const fwd = Math.abs(dy) > Math.abs(dx) ? dy < 0 : dx < 0;
      window.__go(fwd ? 1 : -1);
    }
  }
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  // ---------- gyro ----------
  // RN injects window.__gyro(beta, gamma) in radians (expo-sensors DeviceMotion).
  // Fallback: the page's own deviceorientation (works on Android WebView).
  let gyroBase = null, gyroX = 0, gyroY = 0, gx = 0, gy = 0, nativeGyro = false;
  function applyGyro(beta, gamma) {
    if (gyroBase === null) gyroBase = beta;
    gyroX = Math.max(-0.1, Math.min(0.1, -gamma * 0.18));
    gyroY = Math.max(-0.07, Math.min(0.07, (beta - gyroBase) * 0.18));
  }
  window.__gyro = function (beta, gamma) { nativeGyro = true; applyGyro(beta, gamma); };
  addEventListener('deviceorientation', (e) => {
    if (nativeGyro || e.beta == null) return;
    applyGyro((e.beta * Math.PI) / 180, (e.gamma * Math.PI) / 180);
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    [lw, lh] = lowSize();
    rt.setSize(lw, lh);
    post.uniforms.uLow.value.set(lw, lh);
  });

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const LEAVE = 1.2, ARRIVE = 1.0, INTRO = 1.8;
  enter(index, 1, false);

  renderer.setAnimationLoop(() => {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05); // smoothing step
    const t = clock.elapsedTime;
    phaseT += Math.min(raw, 0.25); // transitions run on wall-clock time even at low fps
    const cur = current();

    if (phase === 'wait') {
      if (cur && cur.ready) {
        status('');
        phase = viaWalk ? 'arrive' : 'intro';
        phaseT = 0;
        showPhoto(false);
      } else if (cur && cur.failed) {
        fog = 0; phase = 'idle';
      } else if (!nodes[index].splatUrl) {
        status(''); fog = 0; showPhoto(true); phase = 'idle';
      } else if (phaseT > 0.6) status('Walking in…');
    }
    if (phase === 'intro') {
      // the photo "opens up": it fades and swells while the splat rises out of fog
      const k = ease(Math.min(phaseT / INTRO, 1));
      opacity = k; fog = 0.5 * (1 - k); dolly = 0.25 * (1 - k);
      if (phaseT >= INTRO) phase = 'idle';
    }
    if (phase === 'leave') {
      // dolly into (or back out of) the splat while it dissolves into fog
      const k = ease(Math.min(phaseT / LEAVE, 1));
      opacity = 1 - k; fog = k; dolly = dir > 0 ? -0.9 * k : 0.6 * k;
      if (phaseT >= LEAVE) enter(leaveTo, dir, true);
    }
    if (phase === 'arrive') {
      const k = ease(Math.min(phaseT / ARRIVE, 1));
      opacity = k; fog = 1 - k;
      dolly = (dir > 0 ? 0.4 : -0.4) * (1 - k);
      yawOffset = -turn * 0.5 * (1 - k);
      if (phaseT >= ARRIVE) phase = 'idle';
    }
    if (phase === 'idle') { opacity = 1; fog = 0; dolly *= 0.9; yawOffset *= 0.9; }

    if (cur && cur.mesh) cur.mesh.opacity = flat ? 0 : opacity;
    post.uniforms.uFog.value = fog;

    // arrows: only when idle with a next node
    const wantArrows = phase === 'idle' && !flat && index < nodes.length - 1;
    arrowsAlpha += ((wantArrows ? 1 : 0) - arrowsAlpha) * Math.min(1, dt * 3);
    arrows.visible = arrowsAlpha > 0.01;
    for (const m of arrowMats) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 2.4 - m.userData.step * 0.9);
      m.opacity = m.userData.base * pulse * arrowsAlpha;
    }

    // slow drift + gyro + look, all small
    lookX *= touch ? 1 : 0.92; lookY *= touch ? 1 : 0.92;
    gx += (gyroX - gx) * 0.08; gy += (gyroY - gy) * 0.08;
    bump *= 0.9;
    camera.position.set(
      Math.sin(t * 0.21) * 0.035 + Math.sin(t * 0.077) * 0.02,
      Math.sin(t * 0.17) * 0.02,
      Math.sin(t * 0.11) * 0.05 - 0.03 + dolly - bump,
    );
    camera.rotation.set(
      Math.sin(t * 0.08) * 0.012 + lookY + gy,
      Math.sin(t * 0.06) * 0.025 + lookX + gx + yawOffset,
      Math.sin(t * 0.05) * 0.006,
    );

    post.uniforms.uTime.value = t;
    if (cfg.post) {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    } else {
      renderer.render(scene, camera);
    }
  });
</script>
</body>
</html>`;
}
