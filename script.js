(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Налаштування комфорту (запамʼятовуються на пристрої) ---------- */
  const KEY = 'marta-comfort';
  const sysReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canVibrate = 'vibrate' in navigator && window.matchMedia('(pointer: coarse)').matches;
  let prefs = { sound: false, haptic: false, motion: !sysReduce, big: false };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* no-op */ }
  const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* no-op */ } };
  const applyPrefs = () => {
    root.classList.toggle('no-motion', !prefs.motion);
    root.classList.toggle('big', prefs.big);
    $$('.cb-tile[data-pref]').forEach((b) => b.setAttribute('aria-pressed', String(!!prefs[b.dataset.pref])));
  };
  if (!canVibrate) $$('.cb-tile[data-pref="haptic"]').forEach((b) => { b.hidden = true; });
  applyPrefs();

  /* ---------- Звуки: мʼякі, але чіткі — як натиснути клавішу, обтягнуту фетром ----------
     Кожен «дотик» = короткий приглушений клац (шум через низькочастотний фільтр, 12 мс)
     + теплий низький тон із миттєвою атакою і коротким згасанням. Жодних дзвінких частот
     вище ~1,6 кГц, гучність дуже низька. Звучать лише після явного ввімкнення. */
  let ac = null, noise = null, master = null;
  const audio = () => {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = .9;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 3;
      master.connect(comp); comp.connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate * .05, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  const felt = (t, vol = .05, cutoff = 900) => {       // приглушений «тук»
    const c = ac, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise; f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = .7;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .045);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + .05);
  };
  const body = (t, freq, dur = .22, vol = .06, type = 'triangle', glide = null) => {   // теплий тон
    const c = ac, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    f.type = 'lowpass'; f.frequency.value = 1600;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  };
  const pad = (from, to, dur, vol = .035) => {          // дихання: мʼякий «повітряний» тон
    const c = ac, t = c.currentTime, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(to > from ? 1100 : 450, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .35); g.gain.linearRampToValueAtTime(0, t + dur);
    [0, 4].forEach((det) => { const o = c.createOscillator(); o.type = 'sine'; o.detune.value = det;
      o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur); o.connect(f); o.start(t); o.stop(t + dur + .05); });
    f.connect(g); g.connect(master);
  };
  const buzz = (p) => { if (prefs.haptic && canVibrate) try { navigator.vibrate(p); } catch (e) { /* no-op */ } };
  const play = (fn) => { if (!prefs.sound) return; try { audio(); fn(ac.currentTime); } catch (e) { /* no-op */ } };
  const sfx = {
    tap:    () => { play((t) => { felt(t, .05); body(t, 196, .14, .045); }); buzz(8); },
    select: () => { play((t) => { felt(t, .06); body(t, 220, .2, .05); body(t + .07, 330, .28, .035, 'sine'); }); buzz(12); },
    on:     () => { play((t) => { felt(t, .06); body(t, 262, .18, .05, 'triangle', 330); }); buzz(12); },
    off:    () => { play((t) => { felt(t, .05); body(t, 262, .18, .04, 'triangle', 196); }); buzz(8); },
    open:   () => { play((t) => { felt(t, .04, 700); body(t, 247, .22, .04, 'sine', 294); }); buzz(6); },
    close:  () => { play((t) => { felt(t, .035, 600); body(t, 247, .2, .035, 'sine', 208); }); },
    inhale: () => { play(() => pad(174.6, 261.6, 4)); buzz(30); },
    exhale: () => { play(() => pad(261.6, 164.8, 6)); buzz([12, 120, 12]); },
    done:   () => { play((t) => [196, 247, 294].forEach((f, i) => body(t + i * .16, f, .9, .035, 'sine'))); buzz([10, 80, 10]); },
  };

  /* ---------- Блок «Комфорт»: плитки-перемикачі ---------- */
  $$('.cb-tile[data-pref]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.pref; prefs[k] = !prefs[k]; savePrefs(); applyPrefs();
    prefs[k] ? sfx.on() : sfx.off(); motion.update();
  }));

  /* ---------- Мобільне меню ---------- */
  const toggle = $('#navToggle'), menu = $('#mobileMenu');
  if (toggle && menu) {
    const setMenu = (open) => { menu.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню'); document.body.classList.toggle('menu-open', open); };
    toggle.addEventListener('click', () => { const open = menu.hidden; setMenu(open); open ? sfx.open() : sfx.close(); });
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); toggle.focus(); } });
    window.addEventListener('resize', () => { if (window.innerWidth > 960 && !menu.hidden) setMenu(false); });
  }

  /* ---------- Рух від прокрутки: фото ледь зсуваються, стрічка станів пливе ----------
     Нічого не рухається саме — лише разом із прокруткою людини. У no-motion вимкнено. */
  const pars = $$('[data-par]'), ticker = $('[data-ticker]');
  const motion = {
    update() {
      if (root.classList.contains('no-motion')) return;
      const vh = window.innerHeight;
      pars.forEach((f) => {
        const r = f.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const k = (r.top + r.height / 2 - vh / 2) / vh;          // −1…1 відносно центру екрана
        f.style.setProperty('--par', `${(k * -5).toFixed(2)}%`);
      });
      if (ticker) {
        const half = ticker.scrollWidth / 2;
        ticker.style.setProperty('--tx', `${-((window.scrollY * .35) % half).toFixed(1)}px`);
      }
    },
  };
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { motion.update(); ticking = false; });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ---------- Хвилина дихання ---------- */
  const bBtn = $('#breatheBtn'), ring = $('#breatheRing'), label = $('#breatheLabel'), sr = $('#breatheSr');
  if (bBtn && ring) {
    const ROUNDS = 6; let timer = null, round = 0;
    const setLabel = (big, small) => { label.innerHTML = big + (small ? `<small>${small}</small>` : ''); };
    const phase = (p) => { ring.classList.remove('inhale', 'exhale'); if (p) ring.classList.add(p); };
    const stop = (finished) => {
      clearTimeout(timer); timer = null; phase(null);
      bBtn.setAttribute('aria-pressed', 'false'); bBtn.textContent = finished ? 'Ще раз' : 'Почати';
      setLabel(finished ? 'Дякую, що приділили собі хвилину' : 'Коли будете готові');
      if (finished) { sr.textContent = 'Вправу завершено'; sfx.done(); }
    };
    const inhale = () => { round++; phase('inhale'); setLabel('Вдих…', `${round} з ${ROUNDS}`); sr.textContent = 'Вдих'; sfx.inhale(); timer = setTimeout(exhale, 4000); };
    const exhale = () => { phase('exhale'); setLabel('Повільний видих…', `${round} з ${ROUNDS}`); sr.textContent = 'Видих'; sfx.exhale(); timer = setTimeout(() => (round >= ROUNDS ? stop(true) : inhale()), 6000); };
    bBtn.addEventListener('click', () => {
      if (timer) { stop(false); sfx.close(); return; }
      round = 0; bBtn.setAttribute('aria-pressed', 'true'); bBtn.textContent = 'Зупинити';
      setLabel('Сядьте зручно', 'починаємо за мить'); sfx.tap(); timer = setTimeout(inhale, 1200);
    });
  }

  /* ---------- FAQ ---------- */
  $$('.faq-list details').forEach((d) => d.addEventListener('toggle', () => (d.open ? sfx.open() : sfx.close())));

  /* ---------- Тихий «тук» на кнопках і посиланнях запису ---------- */
  $$('.btn, .more, .call').forEach((el) => el.addEventListener('pointerdown', () => sfx.tap()));

  /* ---------- Плаваюча кнопка запису на мобільному ---------- */
  /* показується, коли кнопки запису першого екрана не видно (зокрема одразу, якщо вона нижче згину) */
  const floatingCta = $('.floating-cta'), heroCta = $('.hero-cta .btn, .hero-txt > .btn');
  if (floatingCta && heroCta && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => floatingCta.classList.toggle('is-visible', !en.isIntersecting)).observe(heroCta);
  } else if (floatingCta) floatingCta.classList.add('is-visible');
  if (floatingCta) floatingCta.addEventListener('pointerdown', () => sfx.tap());

  /* ---------- Темна тема лише за ?theme=dark (для перегляду) ---------- */
  try { if (new URLSearchParams(location.search).get('theme') === 'dark') root.setAttribute('data-theme', 'dark'); } catch (e) { /* no-op */ }
})();
