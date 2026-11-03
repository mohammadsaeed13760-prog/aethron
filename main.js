// AETHRON — page behaviour (no 3D here; the 3D scene is lazy-loaded from scene.js)
const doc = document.documentElement;
doc.classList.add('js');

const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const reduce = reduceMQ.matches;
const isTouch = matchMedia('(pointer: coarse)').matches;
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

/* ---- reveal on scroll ---- */
const reveals = document.querySelectorAll('.reveal');
if (reduce || !('IntersectionObserver' in window)) {
  reveals.forEach(el => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach(el => io.observe(el));
}

/* ---- nav state, progress bar, blurred-logo parallax ---- */
const nav = document.getElementById('nav');
const progress = document.getElementById('progress');
const bgLogo = document.getElementById('bgLogo');
let mx = 0, my = 0, smx = 0, smy = 0, lastY = -1, ticking = false;

/* ---- hero composition: the blurred logo is laid out so its wordmark sits behind the
   crisp AETHRON heading and its A sits where the 3D A floats (scene.js reads __heroA) ---- */
const wordmark = document.querySelector('.wordmark');
// lockup image = crop (150,300)-(1104,920) of the original 1254px logo
const IMG = { x0: 150, y0: 300, w: 954, wordCx: 626, wordCy: 797, wordW: 868, aCx: 633.5, aCy: 526.5, aH: 357 };
let lastW = 0;
function layoutHero(force) {
  if (!wordmark || !bgLogo) return;
  const vw = innerWidth, vh = innerHeight;
  if (!force && vw === lastW) return;
  lastW = vw;
  const prevT = bgLogo.style.transform; bgLogo.style.transform = 'none';
  const r = wordmark.getBoundingClientRect();
  const ls = parseFloat(getComputedStyle(wordmark).letterSpacing) || 0;
  const textW = r.width - ls;                // the box carries one trailing letter-space
  const cx = r.left + textW / 2, cy = r.top + window.scrollY + r.height * 0.5;
  const mobile = vw < 700;
  const minA = mobile ? Math.min(vh * 0.3, vw * 0.62) : 0;
  const s = Math.max(textW / IMG.wordW, minA / IMG.aH);
  const left = cx - (IMG.wordCx - IMG.x0) * s;
  const top = cy - (IMG.wordCy - IMG.y0) * s;
  bgLogo.style.setProperty('--bx', left.toFixed(1) + 'px');
  bgLogo.style.setProperty('--by', top.toFixed(1) + 'px');
  bgLogo.style.setProperty('--bw', (IMG.w * s).toFixed(1) + 'px');
  bgLogo.style.transform = prevT;
  const poster = document.getElementById('poster');
  if (poster) { const ph = IMG.aH * s; poster.style.cssText = `left:${(left + (IMG.aCx - IMG.x0) * s).toFixed(1)}px;top:${(top + (IMG.aCy - IMG.y0) * s).toFixed(1)}px;width:${(ph * 659 / 580).toFixed(1)}px`; }
  window.__heroA = { x: left + (IMG.aCx - IMG.x0) * s, y: top + (IMG.aCy - IMG.y0) * s, h: IMG.aH * s, vw, vh };
  window.dispatchEvent(new Event('aethron:hero'));
}
layoutHero(true);
if (wordmark) wordmark.addEventListener('animationend', () => layoutHero(true));
addEventListener('resize', () => layoutHero(false), { passive: true });
document.fonts && document.fonts.ready.then(() => layoutHero(true));

function frame() {
  ticking = false;
  const y = window.scrollY;
  const vh = window.innerHeight;
  const max = Math.max(1, doc.scrollHeight - vh);
  if (y !== lastY) {
    nav.classList.toggle('scrolled', y > 24);
    progress.style.transform = `scaleX(${(y / max).toFixed(4)})`;
    lastY = y;
  }
  if (!reduce && bgLogo) {
    smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;
    const k = Math.min(1, y / (vh * 1.1));
    const ty = -y * 0.18;
    const sc = 1 + k * 0.18;
    bgLogo.style.transform = `translate3d(${(smx * -18).toFixed(2)}px, ${(ty + smy * -12).toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
    bgLogo.style.opacity = String(((innerWidth < 700 ? 0.3 : 0.38) * (1 - k * 0.85)).toFixed(3));
    if (Math.abs(mx - smx) > 0.001 || Math.abs(my - smy) > 0.001) requestTick();
  }
}
function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
addEventListener('scroll', requestTick, { passive: true });
addEventListener('resize', requestTick, { passive: true });
addEventListener('pointermove', (e) => {
  mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1;
  window.__aethronPointer = { x: mx, y: my };
  requestTick();
}, { passive: true });
requestTick();

/* ---- product card spotlight ---- */
if (!isTouch) document.querySelectorAll('.prod').forEach(card => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

/* ---- mobile menu ---- */
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
function setMenu(open) {
  menuBtn.setAttribute('aria-expanded', String(open));
  if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('open')); document.body.style.overflow = 'hidden'; }
  else { menu.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => { if (menuBtn.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 350); }
}
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); } });

/* ---- lazy 3D ---- */
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function start3D() {
  if (reduce || new URLSearchParams(location.search).has('static')) return;
  import('./scene.js').then(m => m.init({ canvas: document.getElementById('stage'), poster: document.getElementById('poster') }))
    .catch(err => { console.warn('3D unavailable, showing the static version.', err); });
}
const kick = () => ('requestIdleCallback' in window) ? requestIdleCallback(start3D, { timeout: 1200 }) : setTimeout(start3D, 200);
if (document.readyState === 'complete') kick(); else addEventListener('load', kick, { once: true });
