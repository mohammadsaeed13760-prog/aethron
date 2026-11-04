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


/* ===================== FX layer (Nov 4): text reveals, 3D tilt, glow, aurora, dividers ===================== */
(() => {
  if (reduce) return;
  doc.classList.add('fx-on');
  const $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const coarse = isTouch;

  /* headings: split words for the blur + 3D flip reveal */
  $$('.h2.reveal').forEach(h => {
    h.setAttribute('aria-label', h.textContent.trim().replace(/\s+/g, ' '));
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i++); s.setAttribute('aria-hidden', 'true'); s.textContent = part; frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(h);
  });

  /* tagline: decrypt effect */
  const tag = document.querySelector('.tagline span:nth-child(2)');
  if (tag) {
    const final = tag.textContent, GL = 'AETHRON01<>/#*+=';
    const r = tag.getBoundingClientRect();
    tag.style.cssText = `display:inline-block;width:${Math.ceil(r.width)}px;height:${Math.ceil(r.height)}px;overflow:hidden;vertical-align:middle`;
    tag.parentElement.setAttribute('aria-label', final);
    const due = [...final].map((ch, i) => 520 + i * 22 + Math.random() * 380);
    const t0 = performance.now(); let last = 0;
    const step = (now) => {
      const el = now - t0;
      if (now - last > 45) {
        last = now; let out = '', done = true;
        for (let i = 0; i < final.length; i++) {
          const ch = final[i];
          if (ch === ' ' || el >= due[i]) out += ch.replace('&', '&amp;');
          else { done = false; out += el < 380 ? '<span class="scr" style="opacity:0">·</span>' : `<span class="scr">${GL[(Math.random() * GL.length) | 0]}</span>`; }
        }
        tag.innerHTML = out;
        if (done) { tag.textContent = final; tag.style.cssText = ''; return; }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* decorations: aurora fields, light dividers, product border beams */
  $$('.products, .mission, .leadership, .outro').forEach(s => {
    const a = document.createElement('div'); a.className = 'aurora'; a.setAttribute('aria-hidden', 'true');
    a.innerHTML = '<i></i><i></i><i></i>'; s.prepend(a);
  });
  $$('main .section').forEach(s => { const d = document.createElement('div'); d.className = 'fx-div'; d.setAttribute('aria-hidden', 'true'); s.prepend(d); });
  $$('.prod').forEach(el => { const b = document.createElement('span'); b.className = 'beam-edge'; b.setAttribute('aria-hidden', 'true'); el.appendChild(b); });

  /* pause every CSS loop in a section while it is off screen */
  if ('IntersectionObserver' in window) {
    const pio = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('fx-paused', !e.isIntersecting)), { rootMargin: '120px 0px' });
    $$('main > section').forEach(s => pio.observe(s));
  }

  /* 3D tilt + glow borders */
  const tilts = $$('.prod, .founder, .team-group, .mv-block, .media-card');
  const glows = tilts.concat($$('.div-card'));
  tilts.forEach(el => el.classList.add('tilt'));
  glows.forEach(el => el.classList.add('glow'));
  const settle = (el) => setTimeout(() => el.classList.add('settled'), 1500 + (parseFloat(el.style.getPropertyValue('--d')) || 0));
  const vis = new Set();
  const sio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { vis.add(e.target); if (!e.target.dataset.s) { e.target.dataset.s = 1; settle(e.target); } }
    else { vis.delete(e.target); e.target.classList.remove('lit'); }
  }), { rootMargin: '40px 0px' });
  glows.forEach(el => sio.observe(el));

  if (!coarse) {
    glows.forEach(el => {
      const isTilt = el.classList.contains('tilt');
      const max = el.classList.contains('prod') || el.classList.contains('media-card') ? 7 : 3.5;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`); el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        if (isTilt && el.classList.contains('settled')) {
          el.style.setProperty('--ry', `${((x - 0.5) * 2 * max).toFixed(2)}deg`); el.style.setProperty('--rx', `${(-(y - 0.5) * 2 * max).toFixed(2)}deg`);
          el.classList.add('hot');
        }
        el.classList.add('lit');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.classList.remove('hot', 'lit'); });
    });
    /* soft spotlight that follows the cursor */
    const spot = document.createElement('div'); spot.className = 'spot'; spot.setAttribute('aria-hidden', 'true'); document.body.appendChild(spot);
    let sx = 0, sy = 0, queued = false;
    addEventListener('pointermove', e => {
      sx = e.clientX; sy = e.clientY;
      if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; spot.style.transform = `translate3d(${sx}px,${sy}px,0)`; spot.classList.add('on'); }); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => spot.classList.remove('on'));
  } else {
    /* phones: cards lean and catch light as they scroll through the screen */
    let queued = false;
    const run = () => {
      queued = false;
      const vh = innerHeight;
      vis.forEach(el => {
        const r = el.getBoundingClientRect();
        const p = Math.max(-1, Math.min(1, ((r.top + r.height / 2) - vh / 2) / (vh / 2)));
        el.style.setProperty('--mx', `${(50 - p * 45).toFixed(1)}%`); el.style.setProperty('--my', '0%');
        el.classList.toggle('lit', Math.abs(p) < 0.55);
        if (el.classList.contains('tilt') && el.classList.contains('settled')) {
          el.classList.add('hot');
          el.style.setProperty('--rx', `${(p * 7).toFixed(2)}deg`);
        }
      });
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(run); } }, { passive: true });
  }
})();
