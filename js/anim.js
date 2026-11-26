// Animaciones con GSAP (GreenSock, gratis incluso para uso comercial: https://gsap.com/pricing).
// Se carga en segundo plano DESPUÉS de que la guía ya abrió; si no hay conexión o falla, quedan las animaciones CSS.
// Plugins usados: SplitText (título letra a letra) y ScrollTrigger (las listas largas aparecen al deslizar).
const BASE = (typeof window !== 'undefined' && window.__GSAP_BASE) || 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/';

export function createAnim({ body, modalRoot, titleSel = '.panel__title' }) {
  let gsap = null, SplitText = null, ScrollTrigger = null, loading = null, lastSig = null, pendingTitle = false;
  const quiet = () => document.documentElement.classList.contains('pref-calm') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function load() {
    return (loading ||= (async () => {
      try {
        const [g, s, t] = await Promise.allSettled([import(/* @vite-ignore */ BASE + 'index.js'), import(/* @vite-ignore */ BASE + 'SplitText.js'), import(/* @vite-ignore */ BASE + 'ScrollTrigger.js')]);
        if (g.status !== 'fulfilled') return false;
        gsap = g.value.gsap || g.value.default;
        SplitText = s.status === 'fulfilled' ? s.value.SplitText || s.value.default : null;
        ScrollTrigger = t.status === 'fulfilled' ? t.value.ScrollTrigger || t.value.default : null;
        gsap.registerPlugin(...[SplitText, ScrollTrigger].filter(Boolean));
        document.documentElement.classList.add('gsap-on'); // apaga las animaciones CSS equivalentes
        return true;
      } catch {
        return false;
      }
    })());
  }
  const scrollParent = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 4) return n;
    return null;
  };

  /** Anima el contenido del panel, solo cuando cambia de «pantalla» (no en cada repintado). */
  function view(sig) {
    if (sig === lastSig) return;
    lastSig = sig;
    if (!gsap || quiet()) return;
    try {
      const lists = [...body.querySelectorAll(':scope > ul.list, :scope > ul.perdidos, :scope ul.list, :scope ul.perdidos')];
      const items = [...new Set(lists.flatMap((u) => [...u.children]))];
      const others = [...body.children].filter((c) => !lists.includes(c));
      const first = items.slice(0, 10), rest = items.slice(10);
      gsap.killTweensOf([...others, ...items]);
      if (others.length) gsap.fromTo(others, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', stagger: 0.04, clearProps: 'transform,opacity' });
      if (first.length) gsap.fromTo(first, { y: 18, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)', stagger: 0.045, delay: 0.05, clearProps: 'transform,opacity' });
      const ph = body.querySelector('.card__ph');
      if (ph) gsap.fromTo(ph, { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.3)', clearProps: 'transform,opacity' });
      // Lista larga: el resto aparece al deslizar (si algo falla, se muestra igual a los 1,5 s)
      const sp = rest.length && ScrollTrigger ? scrollParent(body) : null;
      if (sp) {
        gsap.set(rest, { opacity: 0, y: 16 });
        ScrollTrigger.batch(rest, { scroller: sp, start: 'top 95%', once: true, onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.04, clearProps: 'transform,opacity' }) });
        setTimeout(() => rest.forEach((el) => { if (el.isConnected && getComputedStyle(el).opacity === '0') gsap.to(el, { opacity: 1, y: 0, duration: 0.3, clearProps: 'transform,opacity' }); }), 1500);
        ScrollTrigger.refresh();
      }
    } catch { /* si algo falla, el contenido queda visible igual */ }
  }

  function modal() {
    if (!gsap || quiet()) return;
    const box = modalRoot.querySelector('.modal__box');
    if (box) gsap.fromTo(box, { y: 32, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.38, ease: 'back.out(1.6)', clearProps: 'transform,opacity' });
  }

  /** Título de portada: aparece letra por letra. */
  function title() {
    pendingTitle = true;
    if (!gsap || quiet() || !SplitText) return;
    const el = document.querySelector(titleSel);
    if (!el || !pendingTitle) return;
    pendingTitle = false;
    try {
      const split = new SplitText(el, { type: 'chars' });
      gsap.fromTo(split.chars, { y: 22, opacity: 0, rotate: -6 }, { y: 0, opacity: 1, rotate: 0, duration: 0.55, ease: 'back.out(2)', stagger: 0.03, onComplete: () => split.revert() });
    } catch { /* sin efecto */ }
  }

  // Se carga cuando el navegador está libre; al terminar, anima la pantalla que se esté viendo.
  const start = () => load().then((ok) => { if (ok) { title(); lastSig = null; view(`init|${Math.random()}`); } });
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2500 });
  else setTimeout(start, 800);

  return { view, modal, title };
}
