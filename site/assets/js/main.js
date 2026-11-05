import * as THREE from './three.module.min.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth <= 820;
const clamp01 = v => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

/* Smooth scroll */
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const t = document.querySelector(a.getAttribute('href'));
  if (!t) return;
  e.preventDefault();
  document.body.classList.remove('menu-open');
  lenis ? lenis.scrollTo(t, { offset: -60 }) : t.scrollIntoView({ behavior: 'smooth' });
}));

/* Mobile menu */
document.querySelector('.nav-burger').addEventListener('click', () => document.body.classList.toggle('menu-open'));

/* Loader */
const loader = document.querySelector('.loader');
const count = { v: 0 };
lenis?.stop();
// safety net if animation frames are throttled (background tab)
setTimeout(() => { if (loader.isConnected) { loader.remove(); lenis?.start(); } }, 2600);
gsap.to(count, {
  v: 100, duration: reduced ? .2 : 1.1, ease: 'power2.inOut',
  onUpdate: () => loader.querySelector('.loader-count').textContent = Math.round(count.v),
  onComplete: () => {
    gsap.to(loader, { opacity: 0, duration: .6, onComplete: () => { loader.remove(); lenis?.start(); } });
    gsap.from('.hero-l, .hero-r, .hero-media, .hero-sub', { opacity: 0, y: 30, duration: 1, stagger: .08, ease: 'power3.out', delay: .1 });
    gsap.from('.nav', { opacity: 0, duration: .8, delay: .3 });
  }
});

/* Nav state */
const nav = document.querySelector('.nav');
ScrollTrigger.create({ trigger: '.statement', start: 'top 80px', onEnter: () => nav.classList.add('is-solid'), onLeaveBack: () => nav.classList.remove('is-solid') });

/* Hero: image opens to full screen */
ScrollTrigger.matchMedia({
  '(min-width: 821px)': () => heroTl(true),
  '(max-width: 820px)': () => heroTl(false),
});
function heroTl(desk) {
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: true } });
  tl.to('.hero-sub', { opacity: 0, duration: .15 }, 0)
    .to('.hero-media', { width: '100vw', height: '100vh', borderRadius: 0, ease: 'power2.inOut', duration: 1 }, 0)
    .to('.hero-media img', { scale: 1, ease: 'none', duration: 1 }, 0)
    .to('.hero-l', desk ? { xPercent: -60, opacity: 0, duration: .7 } : { yPercent: -120, opacity: 0, duration: .5 }, 0)
    .to('.hero-r', desk ? { xPercent: 60, opacity: 0, duration: .7 } : { yPercent: 120, opacity: 0, duration: .5 }, 0)
    .to({}, { duration: .25 });
  return () => tl.kill();
}

/* Statement: gray to black */
const fill = document.querySelector('.fill-text');
fill.innerHTML = fill.textContent.trim().split(/\s+/).map(w => `<span class="w${/zadovoljstvo|kakovost|dostava/i.test(w) ? ' accent' : ''}">${w}</span>`).join(' ');
const words = fill.querySelectorAll('.w');
ScrollTrigger.create({
  trigger: '.statement', start: 'top 75%', end: 'bottom 55%', scrub: true,
  onUpdate: s => { const n = Math.round(s.progress * words.length); words.forEach((w, i) => w.classList.toggle('on', i < n)); }
});

/* Shared texture helpers */
function kraftCanvas(w, h, base = '#c99d68', fibers = 1800) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < fibers; i++) {
    x.strokeStyle = Math.random() > .5 ? 'rgba(255,240,215,.10)' : 'rgba(90,55,20,.08)';
    x.lineWidth = Math.random() * 1.4 + .3;
    const px = Math.random() * w, py = Math.random() * h, a = Math.random() * Math.PI, l = Math.random() * 14 + 4;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return { c, x };
}
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  return r;
}
function fit(renderer, camera, canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

/* FOLD SCENE: die-cut blank folds into a box */
(async function foldScene() {
  const canvas = document.querySelector('.fold-canvas');
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe8dccb, 1.5));
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.4);
  sun.position.set(4, 7, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  sun.shadow.radius = 6; sun.shadow.bias = -0.0005;
  scene.add(sun);

  const L = 1.6, W = 1.1, H = 1.0, T = 0.024, F = W / 2;
  const logo = await loadImg('assets/img/pakline-logo.png');

  const outBase = kraftCanvas(512, 512).c;
  const inBase = kraftCanvas(512, 512, '#dcc29c', 900).c;
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xa97c4a, roughness: .95 });
  const outMat = new THREE.MeshStandardMaterial({ map: tex(outBase), roughness: .9 });
  const inMat = new THREE.MeshStandardMaterial({ map: tex(inBase), roughness: .95 });

  // printed panel: original logo + handling marks, multiplied onto kraft
  const pc = kraftCanvas(1024, 640);
  if (logo) {
    pc.x.globalCompositeOperation = 'multiply';
    const lw = 520, lh = lw * logo.height / logo.width;
    pc.x.drawImage(logo, (1024 - lw) / 2, (640 - lh) / 2 - 20, lw, lh);
    pc.x.globalCompositeOperation = 'source-over';
  }
  const printMat = new THREE.MeshStandardMaterial({ map: tex(pc.c), roughness: .9 });
  const mc = kraftCanvas(700, 640);
  mc.x.strokeStyle = '#2a1d10'; mc.x.lineWidth = 7; mc.x.lineCap = 'round';
  [[230, 470], [330, 470]].forEach(([cx, cy]) => {
    mc.x.strokeRect(cx - 42, cy - 52, 84, 104);
    mc.x.beginPath(); mc.x.moveTo(cx, cy + 32); mc.x.lineTo(cx, cy - 30); mc.x.moveTo(cx - 16, cy - 12); mc.x.lineTo(cx, cy - 30); mc.x.lineTo(cx + 16, cy - 12); mc.x.stroke();
  });
  mc.x.strokeRect(388, 418, 84, 104);
  mc.x.beginPath(); mc.x.moveTo(410, 438); mc.x.lineTo(450, 438); mc.x.lineTo(444, 470); mc.x.quadraticCurveTo(430, 482, 416, 470); mc.x.closePath(); mc.x.moveTo(430, 480); mc.x.lineTo(430, 505); mc.x.moveTo(416, 505); mc.x.lineTo(444, 505); mc.x.stroke();
  const markMat = new THREE.MeshStandardMaterial({ map: tex(mc.c), roughness: .9 });

  function board(w, h, face = outMat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, T), [edgeMat, edgeMat, edgeMat, edgeMat, face, inMat]);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  const hinges = { side: [], top: [], bottom: [] };
  function panel(parent, w, face, major) {
    const p = board(w - .004, H, face); p.position.x = w / 2; parent.add(p);
    const lift = major ? T * 1.05 : 0;
    const top = new THREE.Group(); top.position.set(0, H / 2 + lift, 0); parent.add(top);
    const ft = board(w - .012, F); ft.position.set(w / 2, F / 2, 0); top.add(ft);
    const bot = new THREE.Group(); bot.position.set(0, -H / 2 - lift, 0); parent.add(bot);
    const fb = board(w - .012, F); fb.position.set(w / 2, -F / 2, 0); bot.add(fb);
    hinges.top.push({ g: top, major }); hinges.bottom.push({ g: bot, major });
  }

  const root = new THREE.Group(); scene.add(root);
  const blank = new THREE.Group(); root.add(blank);
  const g0 = new THREE.Group(); blank.add(g0); panel(g0, L, printMat, true);
  const h1 = new THREE.Group(); h1.position.x = L; g0.add(h1); panel(h1, W, markMat, false);
  const h2 = new THREE.Group(); h2.position.x = W; h1.add(h2); panel(h2, L, printMat, true);
  const h3 = new THREE.Group(); h3.position.x = L; h2.add(h3); panel(h3, W, markMat, false);
  const h4 = new THREE.Group(); h4.position.x = W; h3.add(h4);
  const glue = board(.14, H - .14); glue.position.x = .07; h4.add(glue);
  hinges.side = [h1, h2, h3, h4];

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: .14 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -H / 2 - F - .01; ground.receiveShadow = true;
  scene.add(ground);

  const steps = document.querySelectorAll('.fold-step');
  const bar = document.querySelector('.fold-bar span');
  let progress = 0, dirty = true, visible = false;

  function apply(p) {
    const sides = [seg(p, .06, .32), seg(p, .12, .38), seg(p, .18, .44), seg(p, .26, .46)];
    hinges.side.forEach((h, i) => h.rotation.y = ease(sides[i]) * Math.PI / 2);
    const bMin = ease(seg(p, .46, .54)), bMaj = ease(seg(p, .52, .6));
    const tMin = ease(seg(p, .62, .72)), tMaj = ease(seg(p, .7, .84));
    hinges.bottom.forEach(h => h.g.rotation.x = (h.major ? bMaj : bMin) * Math.PI / 2);
    hinges.top.forEach(h => h.g.rotation.x = -(h.major ? tMaj : tMin) * Math.PI / 2);

    const s = ease(seg(p, .06, .46));
    blank.position.set(-lerp(L + W + .07, L / 2, s), 0, lerp(0, W / 2, s));
    root.position.y = lerp(0, -F, ease(seg(p, .46, .6)));
    root.rotation.y = lerp(0, -.5, ease(seg(p, .2, .9))) + p * .25;

    const c = ease(seg(p, 0, .7));
    // fit the flat blank (≈5.6 wide) at the start, the closed box at the end
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const d0 = Math.max(3.1 / tanH, 8), d1 = Math.max(1.7 / tanH, 5.6);
    camera.position.set(lerp(0, 3.4, c), lerp(.2, 2.8, c), lerp(d0, 4.4, c));
    const len = camera.position.length(); camera.position.multiplyScalar(lerp(d0, d1, c) / len);
    camera.lookAt(0, lerp(0, -.35, c), 0);

    const step = p < .4 ? 0 : p < .66 ? 1 : 2;
    steps.forEach((el, i) => el.classList.toggle('is-active', i === step));
    bar.style.transform = `scaleX(${p})`;
  }

  ScrollTrigger.create({ trigger: '.fold', start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: s => { progress = s.progress; dirty = true; } });
  new IntersectionObserver(e => { visible = e[0].isIntersecting; dirty = true; }).observe(canvas);
  const onResize = () => { fit(renderer, camera, canvas); dirty = true; };
  addEventListener('resize', onResize); onResize();
  let shown = 0;
  gsap.ticker.add(() => {
    if (!visible) return;
    shown += (progress - shown) * .12;
    if (Math.abs(progress - shown) > .0005) dirty = true;
    if (!dirty) return;
    apply(shown); renderer.render(scene, camera); dirty = false;
  });
})();

/* ANATOMY SCENE: exploded corrugated board */
(function anatomyScene() {
  const canvas = document.querySelector('.anatomy-canvas');
  const labelsEl = document.querySelector('.anatomy-labels');
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3128, 1.6));
  const key = new THREE.DirectionalLight(0xfff1de, 2.6); key.position.set(-3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2bd, 1.2); rim.position.set(5, 2, -4); scene.add(rim);

  const SX = 3.2, SZ = 2.2, LT = .03;
  const outMat = new THREE.MeshStandardMaterial({ map: tex(kraftCanvas(512, 512).c), roughness: .9 });
  const inMat = new THREE.MeshStandardMaterial({ map: tex(kraftCanvas(512, 512, '#e6d2b2', 900).c), roughness: .95 });
  const fluteMat = new THREE.MeshStandardMaterial({ color: 0xc2955f, roughness: .85, side: THREE.DoubleSide });
  const edge = new THREE.MeshStandardMaterial({ color: 0xa97c4a, roughness: .95 });

  const FL = {
    E: { mm: '1,5 mm', text: 'Tanek val za natančen tisk in komercialno embalažo.', w: [[.16, .045]] },
    B: { mm: '3 mm', text: 'Najpogostejša izbira za transportne škatle.', w: [[.26, .09]] },
    C: { mm: '4 mm', text: 'Več blažilnosti za občutljivejše izdelke.', w: [[.34, .13]] },
    BC: { mm: '7 mm', text: 'Dvoslojni karton za težke in krhke tovore.', w: [[.26, .09], [.34, .13]] },
  };
  const group = new THREE.Group(); scene.add(group);
  let layers = [];
  let explode = 0, rot = 0, dirty = true, visible = false;

  function liner(mat) { return new THREE.Mesh(new THREE.BoxGeometry(SX, LT, SZ), [edge, edge, mat, mat, edge, edge]); }
  function flute(lambda, amp) {
    const g = new THREE.PlaneGeometry(SX, SZ, 700, 1); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(pos.getX(i) / lambda * Math.PI * 2) * amp);
    g.computeVertexNormals();
    return new THREE.Mesh(g, fluteMat);
  }
  function build(key) {
    layers.forEach(l => group.remove(l.mesh)); layers = [];
    const waves = FL[key].w;
    layers.push({ mesh: liner(outMat), h: LT, name: 'Zunanji papir' });
    waves.forEach((w, i) => {
      layers.push({ mesh: flute(w[0], w[1]), h: w[1] * 2, name: waves.length > 1 ? (i ? 'Spodnji val' : 'Zgornji val') : 'Valoviti sloj' });
      if (i < waves.length - 1) layers.push({ mesh: liner(inMat), h: LT, name: 'Vmesni papir' });
    });
    layers.push({ mesh: liner(inMat), h: LT, name: 'Notranji papir' });
    layers.forEach(l => group.add(l.mesh));
    labelsEl.innerHTML = layers.map(l => `<div class="alabel">${l.name}</div>`).join('');
    dirty = true;
  }
  function layout() {
    const gap = lerp(0, (isMobile() ? .42 : .55) * 2 / (layers.length - 1), ease(explode)) * (layers.length > 3 ? 1.25 : 1);
    const total = layers.reduce((s, l) => s + l.h, 0) + gap * (layers.length - 1);
    let y = total / 2;
    layers.forEach(l => { l.mesh.position.y = y - l.h / 2; l.y = l.mesh.position.y; y -= l.h + gap; });
    group.rotation.y = lerp(-.55, .15, rot);
    group.rotation.x = lerp(.05, 0, rot);
  }
  const v = new THREE.Vector3();
  function placeLabels() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const op = clamp01((explode - .55) / .3);
    [...labelsEl.children].forEach((el, i) => {
      const l = layers[i];
      // anchor on whichever corner of the layer sits furthest right on screen
      let best = null;
      for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        v.set(cx * SX / 2, l.y, cz * SZ / 2).applyMatrix4(group.matrixWorld).project(camera);
        if (!best || v.x > best.x) best = v.clone();
      }
      const x = Math.min((best.x * .5 + .5) * w + 22, w - el.offsetWidth - 12);
      el.style.transform = `translate(${x}px, ${(-best.y * .5 + .5) * h - 10}px)`;
      el.style.opacity = op;
    });
  }

  const mmEl = document.querySelector('.flute-mm'), txtEl = document.querySelector('.flute-text');
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('is-active', x === t));
    const k = t.dataset.flute;
    gsap.fromTo([mmEl, txtEl], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .5, stagger: .05 });
    mmEl.textContent = FL[k].mm; txtEl.textContent = FL[k].text;
    build(k);
  }));
  build('B');

  ScrollTrigger.create({ trigger: '.anatomy', start: 'top 60%', end: 'bottom bottom', scrub: true, onUpdate: s => { explode = seg(s.progress, .1, .55); rot = s.progress; dirty = true; } });
  new IntersectionObserver(e => { visible = e[0].isIntersecting; dirty = true; }).observe(canvas);
  const onResize = () => {
    fit(renderer, camera, canvas);
    const mob = isMobile();
    camera.position.set(mob ? 6.4 : 5.6, mob ? 5 : 4.1, mob ? 9 : 6.6);
    camera.lookAt(mob ? 1.35 : .7, -.1, mob ? -.45 : 0);
    dirty = true;
  };
  addEventListener('resize', onResize); onResize();
  gsap.ticker.add(() => {
    if (!visible || !dirty) return;
    layout(); group.updateMatrixWorld(); renderer.render(scene, camera); placeLabels(); dirty = false;
  });
})();

/* Industries: active row + line drawing */
const rows = document.querySelectorAll('.industries-list li');
const arts = document.querySelectorAll('.art');
arts.forEach(svg => svg.querySelectorAll('path, circle').forEach(p => { const l = p.getTotalLength(); p.style.strokeDasharray = l; p.style.strokeDashoffset = l; }));
let activeRow = -1;
function setRow(i) {
  if (i === activeRow) return; activeRow = i;
  rows.forEach((r, k) => r.classList.toggle('is-active', k === i));
  arts.forEach((a, k) => a.classList.toggle('is-active', k === i));
  const paths = arts[i].querySelectorAll('path, circle');
  gsap.killTweensOf(paths);
  paths.forEach(p => p.style.strokeDashoffset = p.style.strokeDasharray);
  gsap.to(paths, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', stagger: .12 });
}
rows.forEach((r, i) => {
  r.addEventListener('mouseenter', () => setRow(i));
  ScrollTrigger.create({ trigger: r, start: 'top 58%', end: 'bottom 58%', onToggle: s => s.isActive && setRow(i) });
});
setRow(0);

/* Solar array */
const solar = document.querySelector('.solar');
const NS = 'http://www.w3.org/2000/svg';
const O = [60, 262], A = [70, -26], B = [46, 30];
const P = (i, j) => [O[0] + i * A[0] + j * B[0], O[1] + i * A[1] + j * B[1]];
const panels = [];
const sunC = document.createElementNS(NS, 'circle'); sunC.setAttribute('cx', 120); sunC.setAttribute('cy', 92); sunC.setAttribute('r', 38); sunC.setAttribute('class', 'sunc'); solar.appendChild(sunC);
for (let k = 0; k < 8; k++) {
  const a = k / 8 * Math.PI * 2, r1 = 52, r2 = 66;
  const ln = document.createElementNS(NS, 'path');
  ln.setAttribute('d', `M${120 + Math.cos(a) * r1} ${92 + Math.sin(a) * r1} L${120 + Math.cos(a) * r2} ${92 + Math.sin(a) * r2}`);
  ln.setAttribute('class', 'sunc'); ln.setAttribute('stroke-linecap', 'round'); solar.appendChild(ln);
}
for (let j = 0; j < 4; j++) for (let i = 0; i < 7; i++) {
  const ins = .06;
  const q = [P(i + ins, j + ins), P(i + 1 - ins, j + ins), P(i + 1 - ins, j + 1 - ins), P(i + ins, j + 1 - ins)];
  const g = document.createElementNS(NS, 'g');
  const poly = document.createElementNS(NS, 'polygon'); poly.setAttribute('points', q.map(p => p.join(',')).join(' ')); poly.setAttribute('class', 'panel');
  const cell = document.createElementNS(NS, 'path');
  const m1 = P(i + .5, j + ins), m2 = P(i + .5, j + 1 - ins), n1 = P(i + ins, j + .5), n2 = P(i + 1 - ins, j + .5);
  cell.setAttribute('d', `M${m1} L${m2} M${n1} L${n2}`); cell.setAttribute('class', 'cell');
  g.append(poly, cell); solar.appendChild(g); panels.push({ poly, order: i + j * 1.6 });
}
panels.sort((a, b) => a.order - b.order);
ScrollTrigger.create({
  trigger: '.sun-body', start: 'top 80%', end: 'bottom 50%', scrub: true,
  onUpdate: s => { const n = Math.round(seg(s.progress, 0, .8) * panels.length); panels.forEach((p, i) => p.poly.classList.toggle('on', i < n)); }
});
document.querySelectorAll('.stat-num').forEach(el => {
  const to = parseFloat(el.dataset.to), dec = +el.dataset.dec, o = { v: 0 };
  const fmt = n => n.toLocaleString('sl-SI', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  el.textContent = fmt(0);
  ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 1.8, ease: 'power3.out', onUpdate: () => el.textContent = fmt(o.v) }) });
});

/* Reveal */
gsap.utils.toArray('.products-head, .product, .industries h2, .sun-head, .contact-left, .form, .footer-mail').forEach(el => {
  gsap.from(el, { opacity: 0, y: 40, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
});
gsap.utils.toArray('.product-img img').forEach(img => {
  gsap.fromTo(img, { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
});

/* Form */
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => c.classList.toggle('is-on')));
const form = document.querySelector('.form');
form.addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(form);
  let ok = true;
  ['name', 'email'].forEach(n => {
    const input = form.elements[n];
    const bad = !input.value.trim() || (n === 'email' && !/^\S+@\S+\.\S+$/.test(input.value));
    input.parentElement.classList.toggle('invalid', bad); if (bad) ok = false;
  });
  const note = form.querySelector('.form-note');
  if (!ok) { note.textContent = 'Prosimo, vpišite ime in veljaven e-naslov.'; return; }
  const types = [...form.querySelectorAll('.chip.is-on')].map(c => c.textContent).join(', ');
  const body = `Ime: ${f.get('name')}\nPodjetje: ${f.get('company')}\nE-pošta: ${f.get('email')}\nTelefon: ${f.get('phone')}\nVrsta embalaže: ${types}\n\n${f.get('message')}`;
  location.href = `mailto:info@pakline.si?subject=${encodeURIComponent('Povpraševanje: ' + (f.get('company') || f.get('name')))}&body=${encodeURIComponent(body)}`;
  note.textContent = 'Hvala. Odpiramo vaš e-poštni program.';
});

addEventListener('load', () => ScrollTrigger.refresh());
