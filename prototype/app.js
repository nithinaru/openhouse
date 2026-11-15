// wish you were here — clickable browser prototype (controlled demo, nothing is sent anywhere)
const $ = (s, el = document) => el.querySelector(s);
const phone = $('#phone');
const ORDER = ['splash', 'photos', 'map', 'house', 'build', 'video'];
let current = 'splash';
let speed = new URLSearchParams(location.search).has('fast') ? 4 : 1;

/* ---------------- fit the phone to the window ---------------- */
function fit() {
  if (innerWidth <= 500) { phone.style.transform = ''; return; }
  const s = Math.min(1, (innerHeight - 60) / 870, (innerWidth - 40) / 410);
  phone.style.transform = `scale(${s})`;
}
addEventListener('resize', fit); fit();

/* ---------------- navigation ---------------- */
function go(name, { instant = false } = {}) {
  if (name === current) return;
  const from = $('#s-' + current), to = $('#s-' + name);
  if (instant) { from.classList.add('instant'); to.classList.add('instant'); }
  from.classList.remove('active');
  // restart CSS entrance animations
  to.classList.remove('active'); void to.offsetWidth; to.classList.add('active');
  if (instant) requestAnimationFrame(() => { from.classList.remove('instant'); to.classList.remove('instant'); });
  current = name;
  phone.classList.toggle('dark-ui', name === 'video');
  onEnter[name]?.();
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go]');
  if (t) go(t.dataset.go);
});
addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') { speed = speed === 1 ? 4 : 1; return; }
  const i = ORDER.indexOf(current);
  if (e.key === 'ArrowRight') {
    if (current === 'build' && !build.done) { build.skip(); return; }
    if (current === 'house' && !$('#s-house').classList.contains('sheet-open')) { openSheet(); return; }
    if (current === 'house') { pickDefaults(); startBuild(); return; }
    if (current === 'photos') { finishPermission(); return; }
    if (current === 'map') { dive(); return; }
    if (i < ORDER.length - 1) go(ORDER[i + 1]);
  }
  if (e.key === 'ArrowLeft' && i > 0) { closeSheet(); go(ORDER[i - 1]); }
});

const onEnter = {
  map() { mapBusy = false; $('#map-cam').getAnimations().forEach((a) => a.cancel()); },
  video() { const v = $('#video'); $('#video-end').hidden = true; v.currentTime = 0; v.play().catch(() => {}); },
};

/* ---------------- 2 · photo permission ---------------- */
$('#allow-btn').addEventListener('click', () => { $('#ios-alert').hidden = false; });
$('#dont-allow').addEventListener('click', () => { $('#ios-alert').hidden = true; });
$('#allow-full').addEventListener('click', finishPermission);
$('#ios-alert .ios-btn').addEventListener('click', finishPermission); // "limit access" also continues in the demo
function finishPermission() {
  $('#ios-alert').hidden = true;
  const scan = $('#scan'), txt = $('#scan-text');
  scan.hidden = false;
  const steps = ['reading your camera roll…', 'grouping 2,310 photos into nights…', 'found a night with 38 photos 🎃'];
  steps.forEach((s, i) => setTimeout(() => (txt.textContent = s), i * 750));
  setTimeout(() => { scan.hidden = true; txt.textContent = steps[0]; go('map'); }, steps.length * 750 + 250);
}

/* ---------------- 3 · map → GTA-style dive ---------------- */
let mapBusy = false;
$('#pin').addEventListener('click', dive);
$('#event').addEventListener('click', dive);
function dive() {
  if (mapBusy) return; mapBusy = true;
  const cam = $('#map-cam');
  // zoom origin = the pin's spot on screen (map is 476 wide, offset -43; pin at 56% / 50%)
  cam.style.transformOrigin = `${-43 + 0.56 * 476}px ${0.5 * 844 - 30}px`;
  const D = 1500;
  cam.animate([
    { transform: 'scale(1)', filter: 'blur(0) brightness(1)' },
    { transform: 'scale(.86)', filter: 'blur(0) brightness(1)', offset: .22, easing: 'cubic-bezier(.6,0,.95,.5)' },
    { transform: 'scale(11)', filter: 'blur(7px) brightness(1.5)' },
  ], { duration: D, fill: 'forwards', easing: 'ease-in-out' });
  $('#speed').animate([{ opacity: 0, transform: 'scale(1.3) rotate(0)' }, { opacity: 0, offset: .3 }, { opacity: 1, transform: 'scale(.9) rotate(4deg)' }],
    { duration: D, fill: 'forwards', easing: 'ease-in' });
  $('#map-hint').animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(60px)' }], { duration: 300, fill: 'forwards' });
  $('#flash').animate([{ opacity: 0 }, { opacity: 0, offset: .78 }, { opacity: 1 }], { duration: D, fill: 'forwards' });
  setTimeout(() => {
    go('house', { instant: true });
    $('#house-dio').animate([
      { transform: 'scale(2.6) translateY(40px)', filter: 'blur(10px)' },
      { transform: 'scale(1) translateY(0)', filter: 'blur(0)' },
    ], { duration: 1100, easing: 'cubic-bezier(.15,.85,.25,1)' });
    $('#s-house').animate([{ opacity: 1 }, { opacity: 1 }], { duration: 10 });
    const fl = document.createElement('div'); fl.className = 'flash'; fl.style.zIndex = 30; $('#s-house').append(fl);
    fl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' }).onfinish = () => fl.remove();
    // reset the map for next time
    setTimeout(() => ['#map-cam', '#speed', '#map-hint', '#flash'].forEach((s) => $(s).getAnimations().forEach((a) => a.cancel())), 600);
  }, D);
}

/* ---------------- 4 · house + invite sheet ---------------- */
const PEOPLE = [
  { id: 'maya', name: 'maya', why: 'in 21 of your photos that night' },
  { id: 'theo', name: 'theo', why: 'in 14 of your photos that night' },
  { id: 'ines', name: 'ines', why: 'in 12 of your photos that night' },
  { id: 'sol', name: 'sol', why: 'in 9 of your photos that night' },
  { id: 'nico', name: 'nico', why: 'in 6 of your photos that night' },
  { id: 'priya', name: 'priya', why: 'in 4 of your photos that night' },
  { id: 'jules', name: 'jules', why: 'was nearby at 11:40pm' },
  { id: 'ben', name: 'ben', why: 'contact' },
];
const picked = new Set();
const list = $('#contacts');
PEOPLE.forEach((p) => {
  const b = document.createElement('button');
  b.className = 'contact'; b.dataset.id = p.id;
  b.innerHTML = `<img src="assets/av-${p.id}.jpg" alt=""><span class="who"><b>${p.name}</b><small>${p.why}</small></span><span class="check"></span>`;
  b.addEventListener('click', () => { picked.has(p.id) ? picked.delete(p.id) : picked.add(p.id); syncPicked(); });
  list.append(b);
});
function syncPicked() {
  list.querySelectorAll('.contact').forEach((c) => c.classList.toggle('on', picked.has(c.dataset.id)));
  $('#picked').textContent = `${picked.size} picked`;
  const send = $('#send');
  send.disabled = picked.size === 0;
  send.innerHTML = picked.size ? `send link to ${picked.size} <span>💌</span>` : 'send link <span>💌</span>';
}
function pickDefaults() { if (!picked.size) ['maya', 'theo', 'ines', 'sol'].forEach((id) => picked.add(id)); syncPicked(); }
function openSheet() { $('#s-house').classList.add('sheet-open'); }
function closeSheet() { $('#s-house').classList.remove('sheet-open'); }
$('#house-next').addEventListener('click', openSheet);
$('#sheet-dim').addEventListener('click', closeSheet);
$('#send').addEventListener('click', () => {
  const send = $('#send');
  send.disabled = true;
  send.innerHTML = '<span class="spinner"></span> sending…';
  setTimeout(startBuild, 1100);
});

/* ---------------- 5 · live build: the house is generated from the photos ---------------- */
const IMG = {};
['house.jpg', 'build-empty.jpg'].forEach((f) => { const i = new Image(); i.src = 'assets/' + f; IMG[f] = i; });
const PHOTOS = Array.from({ length: 18 }, (_, i) => `assets/photos/p${String(i).padStart(2, '0')}.jpg`);

const BUILD_T = 40; // seconds, real time at speed 1
// areas of the house that get generated as photos arrive, in image coords (1024 square).
// room: 0 living, 1 kitchen, 2 upstairs, -1 floor/shell
const BLOBS = [
  [200, 450, 230, 0, 7.0], [330, 550, 240, 0, 9.0], [260, 260, 210, 0, 11.0], [140, 640, 200, 0, 13.0], [420, 660, 210, 0, 15.0],
  [470, 270, 200, 1, 14.5], [590, 250, 190, 1, 17.0], [450, 400, 190, 1, 19.0], [610, 390, 180, 1, 21.5],
  [300, 800, 230, -1, 18.0], [560, 560, 220, -1, 20.0],
  [770, 300, 200, 2, 22.5], [900, 330, 210, 2, 24.5], [760, 530, 200, 2, 26.5], [890, 570, 200, 2, 28.5], [720, 720, 210, 2, 30.5],
  [600, 810, 250, -1, 29.5], [870, 790, 210, -1, 32.0],
].map(([x, y, r, room, t0]) => ({ x, y, r, room, t0, spawned: false, burst: false }));
// each area passes through three stages: noisy mosaic → soft blur → sharp
const STAGES = [{ off: 0, dur: 2.4 }, { off: 1.4, dur: 2.6 }, { off: 3.0, dur: 3.2 }];

const canvas = $('#build'), ctx = canvas.getContext('2d');
const N = canvas.width; // 768
const S = N / 1024;
const mkCanvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const masks = STAGES.map(() => mkCanvas(192));
const comp = mkCanvas(N), cctx = comp.getContext('2d');
let LOW, MID, PIX; // mosaic + blur versions of the house, pixel data for particle colours
const NOISE = [0, 1, 2, 3].map(() => {
  const c = mkCanvas(160), g = c.getContext('2d'), d = g.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return c;
});

function prepHouse() {
  const h = IMG['house.jpg'];
  LOW = mkCanvas(28); LOW.getContext('2d').drawImage(h, 0, 0, 28, 28);
  MID = mkCanvas(110); MID.getContext('2d').drawImage(h, 0, 0, 110, 110);
  const full = mkCanvas(256), g = full.getContext('2d'); g.drawImage(h, 0, 0, 256, 256);
  PIX = g.getImageData(0, 0, 256, 256).data;
}
if (IMG['house.jpg'].complete) prepHouse(); else IMG['house.jpg'].addEventListener('load', prepHouse);

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const build = { t: 0, running: false, done: false, last: 0, skip() { this.t = Math.max(this.t, BUILD_T - 2); } };
let friendState = [];
let particles = [], rings = [];

function burst(b, ox, oy, t) {
  // photo lands → shatters into points that fly to where they belong in the house
  rings.push({ x: ox, y: oy, t0: t });
  if (!PIX) return;
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * b.r * .85;
    const tx = Math.min(1023, Math.max(0, b.x + Math.cos(a) * rr)), ty = Math.min(1023, Math.max(0, b.y + Math.sin(a) * rr));
    const pi = ((ty >> 2) * 256 + (tx >> 2)) * 4;
    particles.push({
      x0: ox, y0: oy, x1: tx * S, y1: ty * S,
      cx: ox + (Math.random() - .5) * 260, cy: oy - 60 - Math.random() * 140,
      c: `rgb(${PIX[pi]},${PIX[pi + 1]},${PIX[pi + 2]})`, t0: t + Math.random() * .5, dur: .9 + Math.random() * .8,
      s: 1.5 + Math.random() * 2.5, spark: Math.random() < .18,
    });
  }
}

function drawMask(m, t, st, fin) {
  const g = m.getContext('2d'), w = m.width, h = w / 1024;
  g.clearRect(0, 0, w, w);
  for (const b of BLOBS) {
    const p = ease(clamp01((t - b.t0 - st.off) / st.dur));
    if (p <= 0) continue;
    const r = b.r * h * (0.3 + 0.9 * p);
    const gr = g.createRadialGradient(b.x * h, b.y * h, 0, b.x * h, b.y * h, r);
    gr.addColorStop(0, `rgba(0,0,0,${p})`); gr.addColorStop(.55, `rgba(0,0,0,${p})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(b.x * h, b.y * h, r, 0, Math.PI * 2); g.fill();
  }
  if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, w, w); }
}

function layer(src, mask, smooth, jitter = 0) {
  cctx.globalCompositeOperation = 'source-over';
  cctx.clearRect(0, 0, N, N);
  cctx.imageSmoothingEnabled = smooth;
  cctx.drawImage(src, jitter, 0, N, N);
  cctx.imageSmoothingEnabled = true;
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(mask, 0, 0, N, N);
  ctx.drawImage(comp, 0, 0);
}

function draw(t) {
  ctx.clearRect(0, 0, N, N);
  if (IMG['build-empty.jpg'].complete) ctx.drawImage(IMG['build-empty.jpg'], 0, 0, N, N);
  if (!LOW) return [0, 0, 0];
  const fin = ease(clamp01((t - 36) / 3));
  STAGES.forEach((st, i) => drawMask(masks[i], t, st, fin));
  // 1 · blocky mosaic, shimmering while it "thinks"
  layer(LOW, masks[0], false, Math.sin(t * 9) * 2);
  // 2 · soft blur
  layer(MID, masks[1], true);
  // 3 · sharp
  layer(IMG['house.jpg'], masks[2], true);
  // grain over everything still generating (stage 1 done, stage 3 not yet)
  cctx.globalCompositeOperation = 'source-over';
  cctx.clearRect(0, 0, N, N);
  cctx.fillStyle = cctx.createPattern(NOISE[(t * 20 | 0) % 4], 'repeat');
  cctx.fillRect(0, 0, N, N);
  cctx.globalCompositeOperation = 'destination-in'; cctx.drawImage(masks[0], 0, 0, N, N);
  cctx.globalCompositeOperation = 'destination-out'; cctx.drawImage(masks[2], 0, 0, N, N);
  ctx.globalAlpha = .22; ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(comp, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  // rings where photos land
  rings = rings.filter((r) => t - r.t0 < 1);
  for (const r of rings) {
    const p = (t - r.t0);
    ctx.strokeStyle = `rgba(255,255,255,${.8 * (1 - p)})`; ctx.lineWidth = 3 * (1 - p) + .5;
    ctx.beginPath(); ctx.arc(r.x, r.y, 10 + p * 120, 0, Math.PI * 2); ctx.stroke();
  }
  // particles
  particles = particles.filter((q) => t - q.t0 < q.dur + .35);
  for (const q of particles) {
    const raw = (t - q.t0) / q.dur; if (raw < 0) continue;
    const u = ease(Math.min(1, raw)), v = 1 - u;
    const x = v * v * q.x0 + 2 * v * u * q.cx + u * u * q.x1, y = v * v * q.y0 + 2 * v * u * q.cy + u * u * q.y1;
    const a = raw < 1 ? 1 : 1 - (raw - 1) * q.dur / .35;
    ctx.globalAlpha = Math.max(0, a);
    if (q.spark) { ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8; }
    else { ctx.fillStyle = q.c; ctx.shadowBlur = 0; }
    ctx.fillRect(x - q.s / 2, y - q.s / 2, q.s, q.s);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  const roomP = [[0, 0], [0, 0], [0, 0]];
  const last = STAGES[2];
  for (const b of BLOBS) if (b.room >= 0) { roomP[b.room][0] += ease(clamp01((t - b.t0) / (last.off + last.dur))); roomP[b.room][1]++; }
  return roomP.map(([s, n]) => (fin >= 1 ? 1 : s / n));
}

function startBuild() {
  closeSheet();
  setTimeout(() => { const s = $('#send'); s.innerHTML = 'send link <span>💌</span>'; syncPicked(); }, 600);
  if (!picked.size) pickDefaults();
  go('build');
  const sec = $('#s-build');
  sec.classList.remove('done');
  $('#step-in').hidden = true;
  ['t-living', 't-kitchen', 't-stairs'].forEach((id) => $('#' + id).classList.remove('show'));
  BLOBS.forEach((b) => { b.spawned = false; b.burst = false; });
  particles = []; rings = [];
  // friends panel: you + picked friends (max 5 rows shown)
  const chosen = PEOPLE.filter((p) => picked.has(p.id));
  const shown = chosen.slice(0, 5);
  const totals = [21, 17, 14, 11, 9, 6, 8, 5];
  friendState = shown.map((p, i) => ({
    ...p, el: null, total: totals[PEOPLE.indexOf(p)] + 6,
    open: 2.2 + i * 1.9, pull: 4.6 + i * 2.1, finish: 13 + i * 4.2, shown: -1, count: 0,
  }));
  const box = $('#friends'); box.innerHTML = '';
  const me = document.createElement('div'); me.className = 'friend';
  me.innerHTML = `<span class="round pink" style="width:26px;height:26px;font-size:12px;flex-shrink:0">r</span><span class="fn">you</span><span class="st done">38 ✓</span>`;
  box.append(me);
  friendState.forEach((f) => {
    const d = document.createElement('div'); d.className = 'friend';
    d.innerHTML = `<img src="assets/av-${f.id}.jpg" alt=""><span class="fn">${f.name}</span><span class="st">link sent</span>`;
    f.el = d; box.append(d);
  });
  if (chosen.length > shown.length) {
    const more = document.createElement('div'); more.className = 'friend';
    more.innerHTML = `<span class="fn" style="padding-left:4px">+${chosen.length - shown.length} more</span><span class="st">link sent</span>`;
    box.append(more);
  }
  build.t = 0; build.done = false; build.last = performance.now();
  if (!build.running) { build.running = true; requestAnimationFrame(tick); }
}

function setStatus(f, cls, text) {
  const st = f.el.querySelector('.st');
  if (st.textContent === text) return;
  st.className = 'st ' + cls; st.textContent = text;
  f.el.classList.remove('ping'); void f.el.offsetWidth; f.el.classList.add('ping');
}

function flyPhoto(toX, toY) {
  const wrap = $('#flyers');
  const el = document.createElement('div'); el.className = 'fly';
  el.innerHTML = `<img src="${PHOTOS[(Math.random() * PHOTOS.length) | 0]}" alt="">`;
  wrap.append(el);
  // start from the friends panel (below the canvas)
  const sx = 40 + Math.random() * 350, sy = 500 + Math.random() * 40;
  const rot = (Math.random() - .5) * 40;
  const midX = (sx + toX) / 2 + (Math.random() - .5) * 120, midY = Math.min(sy, toY) - 80;
  el.animate([
    { transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(.6)`, opacity: 0 },
    { transform: `translate(${sx}px, ${sy - 30}px) rotate(${rot}deg) scale(1)`, opacity: 1, offset: .15 },
    { transform: `translate(${midX}px, ${midY}px) rotate(${-rot}deg) scale(1.05)`, opacity: 1, offset: .55 },
    { transform: `translate(${toX - 21}px, ${toY - 26}px) rotate(0deg) scale(.25)`, opacity: 0 },
  ], { duration: 1500 / Math.sqrt(speed), easing: 'cubic-bezier(.35,.1,.3,1)' }).onfinish = () => el.remove();
}

function tick(now) {
  const dt = Math.min(.1, (now - build.last) / 1000); build.last = now;
  if (current !== 'build' && current !== 'video') { build.running = false; return; }
  if (!build.done) build.t = Math.min(BUILD_T, build.t + dt * speed);
  const t = build.t;
  const rooms = draw(t);
  rooms.forEach((p, i) => ($('#bar-' + i).style.width = (p * 100).toFixed(1) + '%'));
  if (rooms[0] >= .999) $('#t-living').classList.add('show');
  if (rooms[1] >= .999) $('#t-kitchen').classList.add('show');
  if (rooms[2] >= .999) $('#t-stairs').classList.add('show');

  // photos fly in from friends, land above an area and burst into the points that generate it
  const s = 430 / 1024;
  for (const b of BLOBS) {
    if (!b.spawned && t >= b.t0 - 1.5) { b.spawned = true; b.lx = b.x + (Math.random() - .5) * 60; b.ly = b.y - 40; flyPhoto(b.lx * s, b.ly * s); }
    if (!b.burst && t >= b.t0 - .2) { b.burst = true; burst(b, b.lx * S, b.ly * S, t); }
  }
  // clouds part as the first photos arrive
  const cp = ease(clamp01((t - 4) / 5));
  const cl = $('#build-clouds');
  cl.style.opacity = 1 - cp; cl.style.transform = `scale(${1 + cp * .6})`;

  // friends: link sent → opened → adding photos → added ✓
  let photos = 38;
  for (const f of friendState) {
    if (t >= f.finish) { f.count = f.total; setStatus(f, 'done', `added ${f.total} ✓`); }
    else if (t >= f.pull) { f.count = Math.floor(f.total * clamp01((t - f.pull) / (f.finish - f.pull))); setStatus(f, 'pull', `adding ${f.count}…`); }
    else if (t >= f.open) setStatus(f, 'open', 'opened 👀');
    photos += f.count;
  }
  const built = rooms.filter((p) => p >= .999).length;
  if (!build.done) $('#b-sub').textContent = `${photos} photos in · ${built} of 3 rooms built`;
  const title = t < 2 ? 'sending links…' : t < 7.5 ? 'friends are opening it 👀' : t < 31 ? 'your house is going up 🏗️' : t < BUILD_T ? 'almost there…' : 'your house is ready ✨';
  if ($('#b-title').textContent !== title) $('#b-title').textContent = title;

  if (t >= BUILD_T && !build.done) {
    build.done = true;
    friendState.forEach((f) => setStatus(f, 'done', `added ${f.total} ✓`));
    
    $('#s-build').classList.add('done');
    $('#b-sub').textContent = `3 rooms · ${photos} photos · ${friendState.length + 1} of you`;
    $('#step-in').hidden = false;
  }
  requestAnimationFrame(tick);
}

$('#step-in').addEventListener('click', () => go('video'));

/* ---------------- 6 · step inside ---------------- */
const video = $('#video');
video.addEventListener('ended', () => { $('#video-end').hidden = false; });
$('#replay').addEventListener('click', () => { $('#video-end').hidden = true; video.currentTime = 0; video.play(); });
$('#video-close').addEventListener('click', () => { video.pause(); go('build'); build.last = performance.now(); if (!build.running) { build.running = true; requestAnimationFrame(tick); } });
$('#restart').addEventListener('click', () => { video.pause(); picked.clear(); syncPicked(); go('splash'); });
