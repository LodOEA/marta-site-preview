(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Налаштування комфорту (запамʼятовуються на пристрої) ---------- */
  const KEY = 'marta-comfort';
  const sysReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canVibrate = 'vibrate' in navigator && window.matchMedia('(pointer: coarse)').matches;
  const prefs = { haptic: false, motion: !sysReduce, big: false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    // Read only supported preferences; legacy sound:true must never enable audio.
    Object.keys(prefs).forEach((key) => {
      if (typeof saved?.[key] === 'boolean') prefs[key] = saved[key];
    });
  } catch (e) { /* no-op */ }
  const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* no-op */ } };
  const applyPrefs = () => {
    root.classList.toggle('no-motion', !prefs.motion);
    root.classList.toggle('big', prefs.big);
    $$('.cb-tile[data-pref]').forEach((b) => b.setAttribute('aria-pressed', String(!!prefs[b.dataset.pref])));
  };
  if (!canVibrate) $$('.cb-tile[data-pref="haptic"]').forEach((b) => { b.hidden = true; });
  applyPrefs();

  /* ---------- Лише дотик: синтез звуку прибрано ---------- */
  const buzz = (p) => { if (prefs.haptic && canVibrate) try { navigator.vibrate(p); } catch (e) { /* no-op */ } };
  const sfx = {
    tap: () => buzz(8),
    select: () => buzz(12),
    on: () => buzz(12),
    off: () => buzz(8),
    open: () => buzz(6),
    close: () => {},
    inhale: () => buzz(30),
    exhale: () => buzz([12, 120, 12]),
    done: () => buzz([10, 80, 10]),
  };

  /* ---------- Блок «Комфорт»: плитки-перемикачі ---------- */
  $$('.cb-tile[data-pref]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.pref; if (!(k in prefs)) return; prefs[k] = !prefs[k]; savePrefs(); applyPrefs();
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
     Нічого не рухається саме: лише разом із прокруткою людини. У no-motion вимкнено. */
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

  /* ---------- Адаптивна кнопка запису ---------- */
  const floatingCta = $('.floating-cta'), headerCta = $('.header-cta'), heroCta = $('.hero-cta .btn, .hero-txt > .btn');
  if (floatingCta && heroCta) {
    const blockers = $$('.cta-band, .site-footer, #dyhannya');
    const mobile = window.matchMedia('(max-width: 960px)');
    const phone = window.matchMedia('(max-width: 600px)');
    const updateCta = () => {
      const headerBottom = $('.site-header').getBoundingClientRect().bottom;
      const blocked = blockers.some((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      });
      // Only show after passing the hero button, never while it is below the fold.
      const visible = mobile.matches && heroCta.getBoundingClientRect().bottom <= headerBottom && !blocked;
      for (const [cta, active] of [[headerCta, visible && phone.matches], [floatingCta, visible && !phone.matches]]) {
        cta.classList.toggle('is-visible', active);
        cta.setAttribute('aria-hidden', String(!active));
        cta.tabIndex = active ? 0 : -1;
      }
      document.body.classList.toggle('has-floating-cta', visible && !phone.matches);
    };
    let pending = false;
    const scheduleCta = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; updateCta(); });
    };
    window.addEventListener('scroll', scheduleCta, { passive: true });
    window.addEventListener('resize', scheduleCta, { passive: true });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(scheduleCta);
      [heroCta, ...blockers].forEach((el) => observer.observe(el));
    }
    updateCta();
  }
  [floatingCta, headerCta].filter(Boolean).forEach(el => el.addEventListener('pointerdown', () => sfx.tap()));

  /* ---------- Темна тема лише за ?theme=dark (для перегляду) ---------- */
  try { if (new URLSearchParams(location.search).get('theme') === 'dark') root.setAttribute('data-theme', 'dark'); } catch (e) { /* no-op */ }
})();
