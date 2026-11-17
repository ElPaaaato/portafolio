/* ============================================================
   PATRICIO VARELA — PORTAFOLIO — main.js
   ============================================================ */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     SOUND ENGINE (Web Audio API — sin archivos externos)
  --------------------------------------------------------- */
  const Sound = (() => {
    let ctx = null;
    let enabled = true; // siempre con sonido: ya no hay botón para apagarlos

    function ensureCtx() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone({ freq = 440, dur = 0.09, type = 'sine', gain = 0.05, glideTo = null, delay = 0 }) {
      if (!enabled) return;
      const c = ensureCtx();
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const amp = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(amp).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    return {
      hover: () => tone({ freq: 740, dur: 0.06, type: 'sine', gain: 0.035, glideTo: 900 }),
      click: () => tone({ freq: 220, dur: 0.11, type: 'triangle', gain: 0.06, glideTo: 440 }),
      open:  () => { tone({ freq: 300, dur: 0.14, type: 'sine', gain: 0.05, glideTo: 620 }); tone({ freq: 500, dur: 0.16, type: 'sine', gain: 0.03, glideTo: 780, delay: 0.05 }); },
      close: () => tone({ freq: 500, dur: 0.1, type: 'sine', gain: 0.04, glideTo: 240 }),
      toggle:() => tone({ freq: 500, dur: 0.08, type: 'square', gain: 0.03, glideTo: 700 }),
      isEnabled: () => enabled,
      setEnabled(v){ enabled = v; localStorage.setItem('pv_sound', JSON.stringify(v)); }
    };
  })();

  // Trébol: duplica cada columna para que el desplazamiento infinito no tenga corte
  document.querySelectorAll('.cas-track').forEach(t => t.append(...[...t.children].map(n => {
    const c = n.cloneNode(true); c.tabIndex = -1; c.setAttribute('aria-hidden', 'true'); return c;
  })));

  /* ---------------------------------------------------------
     CUSTOM CURSOR
  --------------------------------------------------------- */
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (dot && ring && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`; });
    (function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('a,button,.hoverable').forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('is-active'));
      el.addEventListener('mouseleave', () => ring.classList.remove('is-active'));
    });
  }

  /* ---------------------------------------------------------
     HOVER / CLICK SOUND ON INTERACTIVE ELEMENTS
  --------------------------------------------------------- */
  function wireSounds(root = document) {
    root.querySelectorAll('a,button,.filter-btn,.project-card:not(.static-view)').forEach(el => {
      if (el.dataset.soundWired) return;
      el.dataset.soundWired = '1';
      el.addEventListener('mouseenter', () => Sound.hover());
      el.addEventListener('click', () => Sound.click());
    });
  }
  wireSounds();

  /* ---------------------------------------------------------
     SOUND TOGGLE BUTTON
  --------------------------------------------------------- */
  const soundBtn = document.getElementById('sound-toggle');
  const iconOn = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7M19 6a9 9 0 010 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const iconOff = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  function paintSoundBtn() { soundBtn.innerHTML = Sound.isEnabled() ? iconOn : iconOff; }
  if (soundBtn) {
    paintSoundBtn();
    soundBtn.addEventListener('click', () => {
      Sound.setEnabled(!Sound.isEnabled());
      paintSoundBtn();
      Sound.toggle();
      showToast(Sound.isEnabled() ? 'Sonido activado' : 'Sonido silenciado');
    });
  }

  /* ---------------------------------------------------------
     TOAST
  --------------------------------------------------------- */
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }
  window.PVshowToast = showToast;

  /* ---------------------------------------------------------
     SCROLL PROGRESS + NAVBAR STATE + BACK TO TOP
  --------------------------------------------------------- */
  const progressBar = document.getElementById('scroll-progress');
  const navbar = document.getElementById('navbar');
  const backTop = document.getElementById('back-to-top');
  function onScroll() {
    const h = document.documentElement;
    const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
    if (progressBar) progressBar.style.width = scrolled + '%';
    if (navbar) navbar.classList.toggle('scrolled', h.scrollTop > 40);
    if (backTop) backTop.classList.toggle('visible', h.scrollTop > 700);
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (backTop) backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------------------------------------------------------
     MOBILE MENU
  --------------------------------------------------------- */
  const navToggle = document.getElementById('nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('open');
      mobileMenu.classList.toggle('open');
      Sound.click();
    });
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      navToggle.classList.remove('open');
      mobileMenu.classList.remove('open');
    }));
  }

  /* ---------------------------------------------------------
     SCROLL REVEAL
  --------------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => io.observe(el));

  /* ---------------------------------------------------------
     SKILL BARS ANIMATE ON VIEW
  --------------------------------------------------------- */
  const skillFills = document.querySelectorAll('.skill-fill');
  const skillIo = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.style.width = el.dataset.pct + '%';
        skillIo.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  skillFills.forEach(el => skillIo.observe(el));

  /* ---------------------------------------------------------
     HERO ROLE CYCLE (typewriter)
  --------------------------------------------------------- */
  const roles = ['Diseño Gráfico', 'Edición de Video', 'Motion Graphics', 'Desarrollo Web', 'Automatización con IA', 'Social Media'];
  const roleEl = document.getElementById('role-cycle');
  if (roleEl) {
    let ri = 0, ci = 0, deleting = false;
    const textSpan = document.createElement('span');
    roleEl.prepend(textSpan);
    function tick() {
      const word = roles[ri];
      if (!deleting) {
        ci++;
        textSpan.textContent = word.slice(0, ci);
        if (ci === word.length) { deleting = true; setTimeout(tick, 1500); return; }
      } else {
        ci--;
        textSpan.textContent = word.slice(0, ci);
        if (ci === 0) { deleting = false; ri = (ri + 1) % roles.length; }
      }
      setTimeout(tick, deleting ? 35 : 65);
    }
    tick();
  }

  // Videos: el contador de tiempo de la línea de edición corre a 24 cuadros por segundo
  const tcEl = document.getElementById('tl-tc');
  if (tcEl && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let fr = 0;
    const p2 = n => String(n).padStart(2, '0');
    setInterval(() => { fr++; tcEl.textContent = `00:${p2(Math.floor(fr / 1440) % 60)}:${p2(Math.floor(fr / 24) % 60)}:${p2(fr % 24)}`; }, 1000 / 24);
  }

  /* ---------------------------------------------------------
     VIDEOS: fila tipo Reels + reproductor en grande con sonido
  --------------------------------------------------------- */
  const tiles = [...document.querySelectorAll('.reel-tile')];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const canHover = matchMedia('(hover:hover) and (pointer:fine)').matches;
  tiles.forEach((t, i) => {
    t.innerHTML = `<img src="${esc(t.dataset.poster)}" alt="" loading="lazy">` +
      `<span class="reel-tile-play" aria-hidden="true">▶</span>` +
      `<span class="reel-tile-txt"><b>${esc(t.dataset.title)}</b><span>${esc(t.dataset.tag)}</span></span>`;
    t.setAttribute('aria-label', `Ver video: ${t.dataset.title}`);
    if (canHover) {   // vista previa muda al pasar el mouse; el video se carga solo hasta entonces
      t.addEventListener('mouseenter', () => {
        let v = t.querySelector('video');
        if (!v) {
          v = document.createElement('video');
          Object.assign(v, { src: t.dataset.video, muted: true, loop: true, playsInline: true, preload: 'auto' });
          t.insertBefore(v, t.children[1]);
        }
        v.play().then(() => t.classList.add('preview')).catch(() => {});
      });
      t.addEventListener('mouseleave', () => {
        const v = t.querySelector('video');
        t.classList.remove('preview');
        if (v) { v.pause(); v.currentTime = 0; }
      });
    }
    t.addEventListener('click', () => openPlayer(i));
  });

  const player = document.getElementById('player');
  const pVideo = document.getElementById('player-video');
  let pIndex = 0, touchX = null;
  function showVideo(i) {
    pIndex = (i + tiles.length) % tiles.length;
    const t = tiles[pIndex];
    pVideo.src = t.dataset.video;
    pVideo.poster = t.dataset.poster;
    document.getElementById('player-title').textContent = t.dataset.title;
    document.getElementById('player-tag').textContent = t.dataset.tag;
    document.getElementById('player-count').textContent = `${pIndex + 1} / ${tiles.length}`;
    pVideo.play().catch(() => {});
  }
  function openPlayer(i) {
    if (!player) return;
    tiles.forEach(t => t.querySelector('video')?.pause());
    player.hidden = false;
    document.body.style.overflow = 'hidden';
    Sound.open();
    showVideo(i);
    document.getElementById('player-close').focus();
  }
  function closePlayer() {
    if (!player || player.hidden) return;
    pVideo.pause();
    pVideo.removeAttribute('src'); pVideo.load();
    player.hidden = true;
    document.body.style.overflow = '';
    Sound.close();
    tiles[pIndex]?.focus();
  }
  document.getElementById('player-close')?.addEventListener('click', closePlayer);
  document.getElementById('player-prev')?.addEventListener('click', () => showVideo(pIndex - 1));
  document.getElementById('player-next')?.addEventListener('click', () => showVideo(pIndex + 1));
  player?.addEventListener('click', e => { if (e.target === player) closePlayer(); });
  pVideo?.addEventListener('ended', () => showVideo(pIndex + 1));   // al terminar pasa al siguiente, como los Reels
  player?.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  player?.addEventListener('touchend', e => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) showVideo(pIndex + (dx < 0 ? 1 : -1));
    touchX = null;
  });
  document.addEventListener('keydown', e => {
    if (!player || player.hidden) return;
    if (e.key === 'ArrowRight') showVideo(pIndex + 1);
    else if (e.key === 'ArrowLeft') showVideo(pIndex - 1);
    else if (e.key === 'Escape') closePlayer();
  });

  /* ---------------------------------------------------------
     VISOR DE DISEÑOS: una imagen completa a la vez + tira de miniaturas
  --------------------------------------------------------- */
  const gal = document.getElementById('gal');
  const galImg = document.getElementById('gal-img');
  const galThumbs = document.getElementById('gal-thumbs');
  const galCount = document.getElementById('gal-count');
  let galList = [], galI = 0, galOpener = null, galX = null;

  function galShow(i) {
    galI = (i + galList.length) % galList.length;
    galImg.classList.remove('in');
    galImg.src = galList[galI];
    galCount.textContent = `${String(galI + 1).padStart(2, '0')} / ${String(galList.length).padStart(2, '0')}`;
    [...galThumbs.children].forEach((b, k) => b.classList.toggle('on', k === galI));
    galThumbs.children[galI]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    [1, -1].forEach(d => { new Image().src = galList[(galI + d + galList.length) % galList.length]; });
  }
  function galOpen(src, btn = src, start = 0) {
    if (!gal) return;
    galList = src.dataset.gallery.split(',').filter(Boolean);
    galThumbs.innerHTML = galList.map((src, k) =>
      `<button type="button" aria-label="Ver diseño ${k + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('');
    [...galThumbs.children].forEach((b, k) => b.addEventListener('click', () => galShow(k)));
    galOpener = btn;
    gal.hidden = false;
    document.body.style.overflow = 'hidden';
    Sound.open();
    galShow(+start || 0);
    document.getElementById('gal-close').focus();
  }
  function galClose() {
    if (!gal || gal.hidden) return;
    gal.hidden = true;
    galImg.removeAttribute('src');
    document.body.style.overflow = '';
    Sound.close();
    galOpener?.focus();
  }
  galImg?.addEventListener('load', () => galImg.classList.add('in'));
  // Un contenedor con data-gallery abre en la pieza tocada (data-start); un botón con data-gallery abre en la primera
  document.querySelectorAll('[data-gallery]').forEach(el => el.addEventListener('click', e => {
    const tile = e.target.closest('[data-start]');
    if (tile && el.contains(tile)) galOpen(el, tile, tile.dataset.start);
    else if (el.matches('button')) galOpen(el);
  }));
  document.getElementById('gal-close')?.addEventListener('click', galClose);
  document.getElementById('gal-prev')?.addEventListener('click', () => galShow(galI - 1));
  document.getElementById('gal-next')?.addEventListener('click', () => galShow(galI + 1));
  document.getElementById('gal-stage')?.addEventListener('click', e => { if (e.target.id === 'gal-stage') galClose(); });
  gal?.addEventListener('touchstart', e => { galX = e.touches[0].clientX; }, { passive: true });
  gal?.addEventListener('touchend', e => {
    if (galX == null) return;
    const dx = e.changedTouches[0].clientX - galX;
    if (Math.abs(dx) > 50) galShow(galI + (dx < 0 ? 1 : -1));
    galX = null;
  });
  document.addEventListener('keydown', e => {
    if (!gal || gal.hidden) return;
    if (e.key === 'ArrowRight') galShow(galI + 1);
    else if (e.key === 'ArrowLeft') galShow(galI - 1);
    else if (e.key === 'Escape') galClose();
  });

  /* ---------------------------------------------------------
     COPY EMAIL
  --------------------------------------------------------- */
  const copyBtn = document.getElementById('copy-email');
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = copyBtn.dataset.email;
      const label = copyBtn.querySelector('.mail-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(email) : Promise.reject()).then(() => {
        showToast('Correo copiado: ' + email);
        Sound.click();
        copyBtn.classList.add('copied');
        if (label) label.textContent = '¡Copiado!';
        setTimeout(() => { copyBtn.classList.remove('copied'); if (label) label.textContent = 'Copiar'; }, 2200);
      }).catch(() => { window.location.href = 'mailto:' + email; });
    });
  }

  // El botón de "subir" cambia a negro cuando está encima de la sección amarilla del final
  const thanksSec = document.getElementById('contacto');
  if (thanksSec) new IntersectionObserver(([en]) => document.body.classList.toggle('on-yellow', en.isIntersecting),
    { rootMargin: '-85% 0px 0px 0px' }).observe(thanksSec);

  /* ---------------------------------------------------------
     CURRENT YEAR
  --------------------------------------------------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();
