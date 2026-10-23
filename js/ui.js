// Interfaz: panel con pestañas, fichas, recorridos, guías, modales y controles del mapa.
import { on, emit } from './bus.js';
import { esc, safeUrl } from './util.js';
import { CATS, ICONS, catIcon, catInfo } from './icons.js';

const TABS = [
  { id: 'lugares', label: 'Lugares' },
  { id: 'pie', label: 'A pie' },
  { id: 'auto', label: 'En auto' },
  { id: 'guias', label: 'Guías' },
];

const MODE_LABEL = { walk: 'A pie', car: 'En auto' };

export function initUI({ meta, places, tours, guides, nav, labels, controls, hasGL }) {
  const root = document.getElementById('ui');
  const byId = new Map(places.map((p) => [p.id, p]));
  const state = { tab: 'lugares', cat: null, placeId: null, tourId: null, step: 0 };

  // ---------- Esqueleto ----------
  root.innerHTML = `
    <aside class="panel" id="panel" aria-label="Guía de ${esc(meta.town)}">
      <header class="panel__head">
        <p class="panel__over">${esc(meta.town)}</p>
        <h1 class="panel__title">${esc(meta.title?.[0] || meta.town)} <em>${esc(meta.title?.[1] || '')}</em></h1>
        <p class="panel__tag">${esc(meta.tagline)}</p>
      </header>
      <div class="tabs" role="tablist" aria-label="Secciones">
        ${TABS.map((t) => `<button class="tab" role="tab" id="tab-${t.id}" data-tab="${t.id}" aria-controls="body" aria-selected="false" tabindex="-1">${t.label}</button>`).join('')}
      </div>
      <div class="panel__body" id="body" role="tabpanel" aria-live="polite"></div>
      <div class="notice"><span><strong>Son sugerencias</strong> · idea personal, sin fines de lucro · <button type="button" data-open="legal">Aviso importante</button></span></div>
    </aside>
    <div class="fab-stack">
      <button class="fab fab--text" id="btn-list" type="button" aria-controls="panel" aria-expanded="true">Mapa</button>
      <button class="fab fab--compass" id="btn-north" type="button" aria-label="Orientar el mapa al norte" title="Norte">
        <span class="compass-n" aria-hidden="true">N</span>
        <span class="compass-needle" id="needle" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l4 9h-8z" fill="#e0a53a"/><path d="M12 21l-4-9h8z" fill="#8892a0"/></svg></span>
      </button>
      <button class="fab" id="btn-help" type="button" aria-label="Ayuda y créditos" aria-haspopup="dialog">?</button>
    </div>
    <p class="coords-hint">Arrastrá para moverte · rueda o pellizco para acercar · clic derecho o ⌥ + arrastrar para girar<br>Versión ${esc(meta.version)} · ${esc(meta.date)}</p>
    <div id="modal-root"></div>
  `;

  const panel = root.querySelector('#panel');
  const body = root.querySelector('#body');
  const btnList = root.querySelector('#btn-list');
  const needle = root.querySelector('#needle');
  const modalRoot = root.querySelector('#modal-root');

  if (!hasGL) document.body.classList.add('no-gl');

  // ---------- Render ----------
  const demoNote = () =>
    meta.demoContent
      ? `<div class="tip"><b>Contenido de ejemplo</b>Los lugares, recorridos y el mapa que ves son de demostración. Reemplazá los archivos de la carpeta <code>data/</code> por los reales.</div>`
      : '';

  function placeItem(p) {
    const info = catInfo(p.category);
    return `<li><button class="item" type="button" data-place="${esc(p.id)}" style="--pin:${info.color}">
      <span class="item__ico">${catIcon(p.category)}</span>
      <span><span class="item__name">${esc(p.name)}</span><span class="item__sub">${esc(info.label)}${p.address && !/a completar/i.test(p.address) ? ' · ' + esc(p.address) : ''}</span></span>
    </button></li>`;
  }

  function renderPlaces() {
    const list = places.filter((p) => !state.cat || p.category === state.cat);
    return `${demoNote()}
      <div class="chips" role="group" aria-label="Filtrar por tipo">
        <button class="chip" type="button" data-cat="" aria-pressed="${!state.cat}">Todos</button>
        ${CATS.map((c) => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${state.cat === c.id}">${ICONS[c.id] || ''}${c.label}</button>`).join('')}
      </div>
      ${list.length ? `<ul class="list">${list.map(placeItem).join('')}</ul>` : '<p class="empty">No hay lugares en esta categoría todavía.</p>'}`;
  }

  function renderPlaceDetail(p) {
    const info = catInfo(p.category);
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
    const reviews = safeUrl(p.reviewsUrl) || safeUrl(p.googleMapsUrl) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${meta.town}`)}`;
    const web = safeUrl(p.web);
    const rows = [];
    if (p.address) rows.push(['Dirección', esc(p.address)]);
    if (p.hours) rows.push(['Horarios', esc(p.hours)]);
    if (p.phone) rows.push(['Teléfono', `<a href="tel:${esc(String(p.phone).replace(/[^+\d]/g, ''))}">${esc(p.phone)}</a>`]);
    if (web) rows.push(['Web', `<a href="${esc(web)}" target="_blank" rel="noopener noreferrer">${esc(web.replace(/^https?:\/\/(www\.)?/, ''))}</a>`]);
    return `<button class="back" type="button" data-action="back">${ICONS.back}Volver</button>
      <article class="card" style="--pin:${info.color}">
        <span class="card__cat">${catIcon(p.category)}${esc(info.label)}${p.demo ? '<span class="demo-badge">Ejemplo</span>' : ''}</span>
        <h3>${esc(p.name)}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ''}
        ${p.localTip ? `<div class="tip"><b>Dato de local</b>${esc(p.localTip)}</div>` : ''}
        ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
        <div class="actions">
          <a class="btn btn--primary" href="${esc(dir)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>
          <a class="btn" href="${esc(reviews)}" target="_blank" rel="noopener noreferrer">★ Ver reseñas en Google</a>
        </div>
        ${p.source ? `<p class="link" style="color:var(--muted)">Fuente: ${esc(p.source)}${p.updated ? ` · actualizado ${esc(p.updated)}` : ''}</p>` : ''}
      </article>`;
  }

  function renderTourList(mode) {
    const list = tours.filter((t) => t.mode === mode);
    if (!list.length) return `<p class="empty">Todavía no hay recorridos ${mode === 'walk' ? 'a pie' : 'en auto'}.</p>`;
    return `${demoNote()}<ul class="list">${list
      .map(
        (t) => `<li><button class="item" type="button" data-tour="${esc(t.id)}" style="--pin:#e0a53a">
        <span class="item__ico">${ICONS[t.mode] || ICONS.pin}</span>
        <span><span class="item__name">${esc(t.title)}</span><span class="item__sub">${t.stops.length} paradas${t.durationMin ? ` · ${t.durationMin} min` : ''}</span></span>
      </button></li>`,
      )
      .join('')}</ul>`;
  }

  function renderTour(t) {
    const stops = t.stops.map((s, i) => ({ ...s, place: byId.get(s.placeId), i }));
    const last = t.stops.length - 1;
    return `<button class="back" type="button" data-action="tour-exit">${ICONS.back}Todos los recorridos</button>
      <div class="tour-head">
        <h3>${esc(t.title)}</h3>
        <p class="tour-meta">${esc(MODE_LABEL[t.mode] || '')}${t.durationMin ? ` · ${t.durationMin} min` : ''} · parada ${state.step + 1} de ${t.stops.length}</p>
        ${t.intro ? `<p class="tour-meta">${esc(t.intro)}</p>` : ''}
      </div>
      <ol class="steps">${stops
        .map(
          (s) => `<li><button type="button" data-step="${s.i}" ${s.i === state.step ? 'aria-current="step"' : ''}>
          <span><b>${esc(s.place?.name || 'Parada')}</b><small>${esc(s.note || '')}${s.tip ? ` · <i>${esc(s.tip)}</i>` : ''}</small></span>
        </button></li>`,
        )
        .join('')}</ol>
      <div class="actions">
        <button class="btn" type="button" data-action="prev" ${state.step === 0 ? 'disabled' : ''}>Anterior</button>
        <button class="btn btn--primary" type="button" data-action="${state.step === last ? 'tour-exit' : 'next'}">${state.step === last ? 'Terminar' : 'Siguiente'}</button>
      </div>`;
  }

  function renderGuides() {
    if (!guides.length) {
      return `<p class="empty">Todavía no hay guías de turismo cargados. Cuando haya, van a aparecer acá para que los contactes. Se publican solo con el consentimiento de cada guía.</p>`;
    }
    return guides
      .map((g) => {
        const c = String(g.contact || '');
        const href = /^\+?[\d\s()-]{6,}$/.test(c) ? `https://wa.me/${c.replace(/\D/g, '')}` : /@/.test(c) ? `mailto:${esc(c)}` : safeUrl(c);
        return `<div class="guide"><b>${esc(g.name)}</b>${g.languages?.length ? `<span>Idiomas: ${esc(g.languages.join(', '))}</span>` : ''}${g.notes ? `<span>${esc(g.notes)}</span>` : ''}${href ? `<a class="btn" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Contactar</a>` : ''}</div>`;
      })
      .join('');
  }

  function render() {
    root.querySelectorAll('.tab').forEach((b) => {
      const sel = b.dataset.tab === state.tab;
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
    });
    body.setAttribute('aria-labelledby', `tab-${state.tab}`);
    let html = '';
    if (state.tab === 'lugares') {
      const p = state.placeId && byId.get(state.placeId);
      html = p ? renderPlaceDetail(p) : renderPlaces();
    } else if (state.tab === 'pie' || state.tab === 'auto') {
      const t = state.tourId && tours.find((x) => x.id === state.tourId);
      html = t ? renderTour(t) : renderTourList(state.tab === 'pie' ? 'walk' : 'car');
    } else html = renderGuides();
    body.innerHTML = html;
  }

  // ---------- Acciones ----------
  function setTab(id, { keepState = false } = {}) {
    if (!keepState) {
      if (state.tourId) nav.stopTour();
      state.tourId = null;
      state.placeId = null;
      labels.highlight(null);
    }
    state.tab = id;
    labels.setFilter(id === 'lugares' ? state.cat : null);
    render();
    body.scrollTop = 0;
  }

  function selectPlace(id) {
    const p = byId.get(id);
    if (!p) return;
    if (state.tourId) {
      nav.stopTour();
      state.tourId = null;
    }
    state.tab = 'lugares';
    state.placeId = id;
    labels.setFilter(state.cat);
    labels.highlight(id);
    nav.focusPlace(id);
    showPanel(true);
    render();
    body.scrollTop = 0;
  }

  function showPanel(visible) {
    panel.classList.toggle('is-collapsed', !visible);
    btnList.setAttribute('aria-expanded', String(visible));
    btnList.textContent = visible ? 'Mapa' : 'Lista';
  }

  root.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) setTab(b.dataset.tab);
  });
  root.querySelector('.tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.findIndex((t) => t.id === state.tab);
    const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setTab(n.id);
    root.querySelector(`#tab-${n.id}`).focus();
  });

  body.addEventListener('click', (e) => {
    const t = e.target;
    const place = t.closest('[data-place]');
    if (place) return selectPlace(place.dataset.place);
    const cat = t.closest('[data-cat]');
    if (cat) {
      state.cat = cat.dataset.cat || null;
      labels.setFilter(state.cat);
      return render();
    }
    const tour = t.closest('[data-tour]');
    if (tour) {
      state.tourId = tour.dataset.tour;
      state.step = 0;
      nav.startTour(state.tourId);
      showPanel(true);
      return render();
    }
    const step = t.closest('[data-step]');
    if (step) return nav.goStep(Number(step.dataset.step));
    const action = t.closest('[data-action]')?.dataset.action;
    if (action === 'back') {
      state.placeId = null;
      labels.highlight(null);
      render();
    } else if (action === 'tour-exit') {
      nav.stopTour();
      state.tourId = null;
      labels.highlight(null);
      render();
    } else if (action === 'next') nav.next();
    else if (action === 'prev') nav.prev();
  });

  on('place:select', selectPlace);
  on('tour:step', ({ tour, step, place }) => {
    state.tourId = tour.id;
    state.step = step;
    labels.highlight(place?.id ?? null);
    if (state.tab !== (tour.mode === 'car' ? 'auto' : 'pie')) state.tab = tour.mode === 'car' ? 'auto' : 'pie';
    render();
  });

  btnList.addEventListener('click', () => showPanel(panel.classList.contains('is-collapsed')));
  root.querySelector('#btn-north').addEventListener('click', () => nav.resetNorth());

  // ---------- Modales ----------
  let lastFocus = null;
  function closeModal() {
    modalRoot.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    lastFocus?.focus?.();
  }
  function onKey(e) {
    if (e.key === 'Escape') closeModal();
  }
  function openModal(title, html) {
    lastFocus = document.activeElement;
    modalRoot.innerHTML = `<div class="modal" role="presentation"><div class="modal__box" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="btn modal__close" type="button" data-close>Cerrar</button>
      <h2 id="modal-title">${esc(title)}</h2>${html}</div></div>`;
    modalRoot.querySelector('[data-close]').focus();
    modalRoot.querySelector('.modal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal') || e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', onKey);
  }

  const creditsHtml = () => `
    <h3>Créditos</h3>
    <ul>
      <li>Mapa: © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> (licencia ODbL).</li>
      ${meta.satellite ? '<li>Imagen satelital de los alrededores: <a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">Sentinel-2 cloudless</a> de EOX IT Services GmbH (contiene datos Copernicus Sentinel modificados; CC BY 4.0).</li>' : ''}
      <li>Motor 3D: <a href="https://threejs.org" target="_blank" rel="noopener noreferrer">three.js</a> (MIT). Tipografías: Fraunces e Inter (SIL OFL).</li>
      <li>Maqueta estilizada: las alturas están exageradas.</li>
    </ul>
    <p class="modal__foot">Versión ${esc(meta.version)} · ${esc(meta.date)}</p>`;

  function openLegal() {
    openModal('Aviso importante', `${(meta.legal || []).map((t) => `<p>${esc(t)}</p>`).join('')}${creditsHtml()}`);
  }
  function openHelp() {
    openModal(
      'Cómo moverse',
      `<h3>Con mouse</h3><ul><li><b>Arrastrá</b> para moverte</li><li><b>Rueda</b> o pellizco del trackpad para acercar</li><li><b>Clic derecho</b> o <b>⌥ + arrastrar</b> para girar e inclinar</li></ul>
       <h3>Con el celular</h3><ul><li><b>Un dedo</b> para moverte</li><li><b>Dos dedos</b> para acercar y girar</li></ul>
       <p>Tocá un pin para ver el lugar. En <b>A pie</b> y <b>En auto</b> hay recorridos armados, parada por parada, y en <b>Guías</b>, los guías de turismo del pueblo para contactar.</p>
       <h3>Emergencias</h3><ul>${(meta.emergency || []).map((e) => `<li>${esc(e.label)}: <a href="tel:${esc(e.number)}"><b>${esc(e.number)}</b></a></li>`).join('')}</ul>
       ${creditsHtml()}`,
    );
  }
  root.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o?.dataset.open === 'legal') openLegal();
  });
  root.querySelector('#btn-help').addEventListener('click', openHelp);

  // ---------- Inicio ----------
  render();
  setTab('lugares');
  if (matchMedia('(max-width: 819px)').matches && hasGL) showPanel(true);

  return {
    update() {
      if (!hasGL || !controls) return;
      needle.style.transform = `rotate(${-controls.getAzimuthalAngle()}rad)`;
    },
    emit,
  };
}
