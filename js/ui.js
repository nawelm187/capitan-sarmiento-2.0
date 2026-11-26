// Interfaz: panel con pestañas, fichas, recorridos, guías, modales y controles del mapa.
import { on, emit } from './bus.js';
import { esc, safeUrl } from './util.js';
import { ICONS, catInfo, placeIcon, placeLabel } from './icons.js';
import { openNow, estadoHorario, aEspanol } from './hours.js';
import { fetchPronostico, SMN } from './avisos.js';
import { searchStreets } from './streets.js';
import { soportado as hayVoz, hablar as hablar0, callar, estaHablando, setIdiomaVoz, codigoIdioma } from './voz.js';
import { cargarLang, guardarLang, getLang, aplicarIdioma, tr, consultaES, sugerirIngles } from './i18n.js';
// En inglés, lo que se lee en voz alta también se traduce (frase por frase).
const hablar = (t, cb) => hablar0(getLang() === 'en' ? String(t).split(/(?<=[.!?])\s+/).map(tr).join(' ') : t, cb);
import { masCercanos, textoDistancia, metros, minutosAPie, minutosAuto, textoMinutos } from './cerca.js';
import { toLocal, toLngLat } from './geo.js';
import { loadPrefs, savePrefs, applyPrefs } from './prefs.js';
import { qrSvg } from './qr.js';
import { instalada, plataforma, puedeInstalarDirecto, instalar, pasos } from './instalar.js';
import { mensajeComercio, linkContacto } from './comercio.js';
import { vigentes, diasDesde, textoHace, mensajePerdido, linkWhatsApp } from './perdidos.js';
import { armarDia, INTERESES } from './midia.js';
import { createAnim } from './anim.js';
import { iniciarVisitas, contar } from './visitas.js';
import { panoOk, verPanorama } from './panorama.js';
import { leerFavoritos, esFavorito, alternarFavorito } from './favoritos.js';
import { temporadaActual } from './temporada.js';
import { armarFinde } from './finde.js';
import { resumen as resumenOpiniones, estrellas, mensajeOpinion } from './opiniones.js';
import { sugerir } from './buscador.js';
import { iniciarIntro } from './intro.js';
import { fetchClima, resumenClima, textoVozClima, uvTexto } from './clima.js';
import { lugaresSegunClima, planDelDia } from './finde.js';
import { enlacesTelefono, filtrarOficios, agruparOficios } from './oficios.js';
import { escuchar, soportadoEscuchar } from './escuchar.js';
import { interpretar } from './comandos.js';
import { comandoTour, AYUDA_MANOS } from './manoslibres.js';
import { cuentaRegresiva, urlGoogleCalendar, ics } from './calendario.js';
import { TIPOS as TIPOS_ERROR, mensajeError } from './reporte.js';
import { describirLlegada } from './llegando.js';
import { ordenarHistoria, fotoHistoriaOk } from './historia.js';
import { lluviaPronto } from './clima.js';
import { describirCamino, ordenarCaminos, actividadesDelDia, semanaCompleta, fetchPesca, condicionesPesca, faseLunar } from './rural.js';
import { LAYERS, defaultLayers, isEssential, isVisible, layerOf, layerOfType, loadLayers, saveLayers } from './layers.js';

const TABS = [
  { id: 'lugares', label: 'Lugares' },
  { id: 'pie', label: 'A pie' },
  { id: 'auto', label: 'En auto' },
  { id: 'guias', label: 'Guías' },
];

const MODE_LABEL = { walk: 'A pie', car: 'En auto' };

export function initUI({ meta, places, pending = [], turnos = [], agenda = { novedades: [], eventos: [] }, perdidos = [], opiniones = [], historia = [], oficios = [], populares = [], rural = { caminos: [], semanal: [] }, streets = null, tours, guides, nav, labels, controls, hasGL, hasBarrios = false, hasCalles = false }) {
  cargarLang();
  setIdiomaVoz(getLang());
  const root = document.getElementById('ui');
  const byId = new Map(places.map((p) => [p.id, p]));
  const state = { tab: 'lugares', layers: loadLayers(), layersOpen: false, q: '', hit: null, near: null, audio: false, soloAbiertos: false, placeId: null, tourId: null, step: 0 };
  labels.setLayers(state.layers);
  const hoyISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
  const eventosVigentes = (agenda.eventos || []).filter((e) => e.to >= hoyISO);
  const novedades = (agenda.novedades || []).slice(0, 12);
  // La pestaña «Hoy» solo aparece si hay novedades o eventos cargados (npm run agenda).
  // La pestaña «Hoy» siempre está: muestra lo abierto ahora, la farmacia de turno y los eventos.
  const tabs = [TABS[0], { id: 'hoy', label: 'Hoy' }, TABS[1], TABS[2], { id: 'perdidos', label: 'Perdidos' }, TABS[3]];
  const avisosPerdidos = vigentes(perdidos, hoyISO);

  // ---------- Esqueleto ----------
  root.innerHTML = `
    <aside class="panel" id="panel" aria-label="Guía de ${esc(meta.town)}">
      <header class="panel__head">
        <div class="panel__top">
          <p class="panel__over">${esc(meta.town)}</p>
          <button class="panel__lang" id="btn-lang" type="button" data-no-i18n aria-label="Language / Idioma">${getLang() === 'en' ? '🌐 Español' : '🌐 English'}</button>
          <button class="panel__close" id="btn-close" type="button" aria-label="Cerrar la guía y ver el mapa" title="Cerrar y ver el mapa"><span aria-hidden="true">✕</span> Ver mapa</button>
        </div>
        <h1 class="panel__title">${esc(meta.title?.[0] || meta.town)} <em>${esc(meta.title?.[1] || '')}</em></h1>
        <p class="panel__tag">${esc(meta.tagline)}</p>
        <p class="panel__clima" id="clima-chip" hidden></p>
        ${(() => { const tp = temporadaActual(new Date(), meta.temporadas); return tp ? `<p class="panel__temp temp--${esc(tp.id)}"><span aria-hidden="true">${esc(tp.emoji)}</span> ${esc(tp.texto)}</p>` : ''; })()}
      </header>
      <div class="avisos" id="avisos" aria-live="polite"></div>
      <div class="tabs" role="tablist" aria-label="Secciones">
        ${tabs.map((t) => `<button class="tab" role="tab" id="tab-${t.id}" data-tab="${t.id}" aria-controls="body" aria-selected="false" tabindex="-1">${t.label}</button>`).join('')}
      </div>
      <div class="panel__body" id="body" role="tabpanel" aria-live="polite"></div>
      <div class="notice"><span><strong>Son sugerencias</strong> · idea personal, sin fines de lucro · <button type="button" data-open="legal">Aviso importante</button> · <button type="button" data-open="acc">Accesibilidad</button> · <button type="button" data-open="install">Instalar la guía</button> · <button type="button" data-open="qr">Código QR</button></span></div>
    </aside>
    <div class="fab-stack">
      <button class="fab fab--text fab--weather" id="btn-weather" type="button" aria-label="Clima y hora del día" hidden></button>
      <button class="fab fab--text" id="btn-list" type="button" aria-controls="panel" aria-expanded="true">Mapa</button>
${hasCalles ? '<button class="fab fab--text" id="btn-calles" type="button" aria-pressed="true" title="Mostrar u ocultar los nombres de calles y arroyos">Calles</button>' : ''}
${hasBarrios ? '<button class="fab fab--text" id="btn-barrios" type="button" aria-pressed="false" title="Mostrar cómo se dividen los barrios">Barrios</button>' : ''}
      <div class="fab-row">
        <button class="fab fab--compass" id="btn-north" type="button" aria-label="Orientar el mapa al norte" title="Norte">
          <span class="compass-n" aria-hidden="true">N</span>
          <span class="compass-needle" id="needle" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l4 9h-8z" fill="#f0c14b"/><path d="M12 21l-4-9h8z" fill="#9fb0cb"/></svg></span>
        </button>
  
        <button class="fab" id="btn-help" type="button" aria-label="Ayuda y créditos" aria-haspopup="dialog">?</button>
      </div>
    </div>
    <div class="zoom-stack" role="group" aria-label="Acercar o alejar el mapa">
      <button class="fab fab--zoom" id="btn-zin" type="button" aria-label="Acercar" title="Acercar (tecla +)">+</button>
      <button class="fab fab--zoom" id="btn-zout" type="button" aria-label="Alejar" title="Alejar (tecla −)">−</button>
    </div>
    <p class="coords-hint"><span class="hint-3d">Arrastrá para moverte · rueda o pellizco para acercar · clic derecho o ⌥ + arrastrar para girar</span><span class="hint-2d">Arrastrá para moverte · rueda o pellizco para acercar · tocá un punto para ver el lugar</span><br>Versión ${esc(meta.version)} · ${esc(meta.date)}</p>
    <div id="modal-root"></div>
  `;

  const panel = root.querySelector('#panel');
  const body = root.querySelector('#body');
  const btnList = root.querySelector('#btn-list');
  const needle = root.querySelector('#needle');
  const modalRoot = root.querySelector('#modal-root');
  const anim = createAnim({ body, modalRoot });
  iniciarVisitas(meta);
  state.clima = null;
  cargarClima();
  setInterval(cargarClima, 30 * 60 * 1000);

  // ---------- Idioma (español / English) ----------
  const btnLang = root.querySelector('#btn-lang');
  const cambiarIdioma = (l) => {
    guardarLang(l);
    setIdiomaVoz(l);
    callar();
    aplicarIdioma(root);
    if (btnLang) btnLang.textContent = l === 'en' ? '🌐 Español' : '🌐 English';
    render();
  };
  btnLang?.addEventListener('click', () => cambiarIdioma(getLang() === 'en' ? 'es' : 'en'));
  aplicarIdioma(root);
  setTimeout(() => {
    if (!sugerirIngles() || root.querySelector('#aviso-idioma')) return;
    const el = document.createElement('aside');
    el.id = 'aviso-idioma';
    el.className = 'alerta-clima alerta--evento';
    el.setAttribute('data-no-i18n', '');
    el.innerHTML = '<span class="alerta-clima__ico" aria-hidden="true">🌐</span><div class="alerta-clima__txt"><b>Do you prefer English? · ¿Preferís inglés?</b><span class="alerta-clima__btns"><button type="button" class="btn btn--primary" data-idioma="en">English</button><button type="button" class="btn" data-idioma="es">Español</button></span></div>';
    el.addEventListener('click', (e) => { const l = e.target.closest('[data-idioma]')?.dataset.idioma; if (!l) return; el.remove(); cambiarIdioma(l); });
    root.appendChild(el);
  }, 1500);

  // ---------- Sin internet: avisa qué sigue funcionando ----------
  const offEl = document.createElement('div');
  offEl.id = 'offline';
  offEl.className = 'offline';
  offEl.setAttribute('role', 'status');
  offEl.hidden = navigator.onLine !== false;
  offEl.innerHTML = '📴 <b>Sin internet.</b> Podés seguir viendo lugares, recorridos y teléfonos útiles. El clima y lo nuevo se actualizan cuando vuelva la señal.';
  root.appendChild(offEl);
  window.addEventListener('offline', () => { offEl.hidden = false; });
  window.addEventListener('online', () => { offEl.hidden = true; cargarClima(); });

  // ---------- Recordatorio de eventos (hoy o mañana), una sola vez por evento ----------
  function recordatorioEvento() {
    let vistos = [];
    try { vistos = JSON.parse(localStorage.getItem('guia.eventos') || '[]'); } catch { /* nada */ }
    const e = eventosVigentes.find((x) => { const c = cuentaRegresiva(x); return (c.estado === 'pronto' || c.estado === 'hoy' || c.estado === 'curso') && x.from <= new Date(Date.now() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }) && !vistos.includes(`${x.from}|${x.title}`); });
    if (!e || root.querySelector('#aviso-evento')) return;
    const c = cuentaRegresiva(e);
    const el = document.createElement('aside');
    el.id = 'aviso-evento';
    el.className = 'alerta-clima alerta--evento';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="alerta-clima__ico" aria-hidden="true">🎉</span><div class="alerta-clima__txt"><b>${esc(c.texto)}: ${esc(e.title)}</b><small>${esc(fechaLarga(e.from))}${e.time ? ' · ' + esc(e.time) + ' h' : ''}${e.place ? ' · ' + esc(e.place) : ''}</small><span class="alerta-clima__btns"><button type="button" class="btn" data-evt="ver">Ver eventos</button><a class="btn" href="${esc(urlGoogleCalendar(e, meta.town))}" target="_blank" rel="noopener noreferrer">📅 Calendario</a><button type="button" class="btn btn--primary" data-evt="ok">Entendido</button></span></div>`;
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-evt]')?.dataset.evt;
      if (!b) return;
      try { localStorage.setItem('guia.eventos', JSON.stringify([...vistos, `${e.from}|${e.title}`].slice(-30))); } catch { /* nada */ }
      el.remove();
      if (b === 'ver') { state.tab = 'hoy'; state.placeId = null; state.tourId = null; showPanel(true); render(); }
    });
    root.appendChild(el);
  }
  setTimeout(recordatorioEvento, 2500);

  // ---------- Modo fácil por link (?facil=1) ----------
  if (new URLSearchParams(location.search).has('facil')) {
    const pf = { ...loadPrefs(), facil: true, text: 2, calm: true, theme: 'light' };
    savePrefs(pf);
    applyPrefs(pf);
  }

  // ---------- Modo quiosco (?quiosco=1): pantalla completa que vuelve sola al inicio ----------
  const quiosco = new URLSearchParams(location.search).has('quiosco');
  if (quiosco) {
    document.documentElement.classList.add('quiosco');
    state.tab = 'hoy';
    setTimeout(() => { showPanel(true); render(); }, 0);
    let idle = null;
    const volverAlInicio = () => {
      closeModal();
      manosParar();
      callar();
      if (state.tourId) { nav.stopTour(); labels.setExtra([]); }
      Object.assign(state, { tab: 'hoy', tourId: null, placeId: null, q: '', hit: null, near: null });
      labels.setSearchPin(null);
      labels.highlight(null);
      render();
      body.scrollTop = 0;
    };
    const reiniciar = () => { clearTimeout(idle); idle = setTimeout(volverAlInicio, window.__quioscoMs || 90000); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, reiniciar, { passive: true }));
    reiniciar();
    document.addEventListener('pointerdown', () => { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); } catch { /* nada */ } }, { once: true });
    try { navigator.wakeLock?.request('screen').catch(() => {}); } catch { /* nada */ }
  } else {
    // «Estoy llegando» automático: solo si ya dio permiso de ubicación, una vez por día y si viene en camino.
    setTimeout(async () => {
      try {
        const perm = await navigator.permissions?.query({ name: 'geolocation' });
        if (perm?.state !== 'granted' || localStorage.getItem('guia.llegando') === hoyISO) return;
        const centro = meta.focus || meta.center;
        navigator.geolocation.getCurrentPosition((pos) => {
          const d = metros(pos.coords.latitude, pos.coords.longitude, centro.lat, centro.lng);
          if (d > 1200 && d < 40000) { try { localStorage.setItem('guia.llegando', hoyISO); } catch { /* nada */ } if (!modalRoot.querySelector('.modal')) openLlegando(); }
        }, () => {}, { timeout: 8000, maximumAge: 120000 });
      } catch { /* sin permisos API */ }
    }, 7000);
  }
  let lastTrack = '';
  const btnWeather = root.querySelector('#btn-weather');

  if (!hasGL) document.body.classList.add('no-gl');

  // ---------- Render ----------
  const demoNote = () =>
    meta.demoContent
      ? `<div class="tip"><b>Contenido de ejemplo</b>Los lugares, recorridos y el mapa que ves son de demostración. Reemplazá los archivos de la carpeta <code>data/</code> por los reales.</div>`
      : '';

  function placeItem(p) {
    const info = catInfo(p.category);
    return `<li><button class="item" type="button" data-place="${esc(p.id)}" style="--pin:${info.color}">
      <span class="item__ico">${placeIcon(p)}</span>
      <span><span class="item__name">${esc(p.name)}${esFavorito(p.id) ? ' <span class="fav" aria-label="Favorito">❤️</span>' : ''}</span><span class="item__sub">${(() => { const r = resumenOpiniones(opiniones, p.id); return r ? `<b class="stars" aria-label="${r.prom} de 5">★ ${r.prom}</b> · ` : ''; })()}${esc(placeLabel(p))}${p.address && !/a completar/i.test(p.address) ? ' · ' + esc(p.address) : ''}${(() => { const st = openNow(p.hours) === true ? estadoHorario(p.hours) : null; return st ? ` · <b class="open ${st.pronto ? 'open--soon' : 'open--yes'}">Abierto</b>${st.corto ? ` <span class="open__when">${st.corto}</span>` : ''}` : openNow(p.hours) === true ? ' · <b class="open open--yes">Abierto</b>' : ''; })()}</span></span>
    </button></li>`;
  }

  // ---------- Capas (categorías activables) ----------
  const layerCount = {};
  const layerPending = {};
  const essentialCount = places.filter(isEssential).length;
  for (const l of LAYERS) layerCount[l.id] = 0;
  for (const p of places) layerCount[layerOf(p)]++;
  layerCount.esenciales = essentialCount;
  for (const q of pending) {
    const id = layerOfType(q.type);
    layerPending[id] = (layerPending[id] || 0) + 1;
  }
  const setLayers = (set) => {
    state.layers = set;
    saveLayers(set);
    labels.setLayers(set);
  };

  function renderLayers(shown) {
    const on = state.layers;
    const rows = LAYERS.map((l) => {
      const n = layerCount[l.id] || 0;
      const w = 0; // el cartel «sin ubicar» ya no se muestra (lo pendiente se ve con npm run salud y en /ubicar)
      return `<li><label class="layer"><input type="checkbox" data-layer="${l.id}" ${on.has(l.id) ? 'checked' : ''}>
        <span class="layer__name">${esc(l.label)}</span><span class="layer__n">${n}</span>${w ? `<span class="layer__w" title="Todavía sin ubicación exacta: no se dibujan en el mapa">+${w} sin ubicar</span>` : ''}</label></li>`;
    }).join('');
    const totalPending = pending.length;
    return `<details class="layers" ${state.layersOpen ? 'open' : ''}>
      <summary><span>Capas</span><b>${shown} en el mapa</b></summary>
      <div class="layers__acts" role="group" aria-label="Atajos de capas">
        <button class="chip" type="button" data-layers="esenciales">Solo esenciales</button>
        <button class="chip" type="button" data-layers="all">Activar todas</button>
        <button class="chip" type="button" data-layers="none">Desactivar todas</button>
      </div>
      <ul class="layers__list">${rows}</ul>
      ${totalPending ? `<p class="layers__note">${totalPending} lugares figuran en el inventario pero todavía no tienen ubicación exacta confirmada: no se dibujan en el mapa hasta cargarla.</p>` : ''}
    </details>`;
  }

  // ---------- Buscador (sin tildes ni mayúsculas; busca en TODOS los lugares, estén o no en una capa activa) ----------
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const haystack = new Map(places.map((p) => [p.id, norm(`${p.name} ${placeLabel(p)} ${p.address || ''} ${p.description || ''} ${p.category || ''}`)]));
  function searchPlaces(q) {
    const words = norm(consultaES(q)).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return places
      .filter((p) => words.every((w) => haystack.get(p.id).includes(w)))
      .sort((a, b) => Number(norm(b.name).includes(words[0])) - Number(norm(a.name).includes(words[0])) || a.name.localeCompare(b.name, 'es'))
      .slice(0, 60);
  }
  // ---------- «Cerca mío» (usa el GPS solo cuando se toca el botón; la ubicación no se guarda ni se envía) ----------
  function buscarCerca() {
    if (!navigator.geolocation) { state.near = { error: 'Tu navegador no permite usar la ubicación.' }; render(); return; }
    state.near = { cargando: true };
    render();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const centro = meta.focus || meta.center || { lat, lng };
        if (metros(lat, lng, centro.lat, centro.lng) > 20000) state.near = { error: 'Parece que no estás en Capitán Sarmiento (estás a más de 20 km). Esta función sirve cuando estás en el pueblo.' };
        else {
          state.near = { lat, lng, items: masCercanos(places, lat, lng, 12) };
          labels.setSearchPin({ title: 'Estás acá', lat, lng });
          nav.flyTo(lng, lat, { dist: 220 });
        }
        render();
      },
      (err) => {
        state.near = { error: err.code === 1 ? 'No diste permiso para usar tu ubicación. Podés activarlo en el candado de la barra del navegador.' : 'No pude saber dónde estás. Probá de nuevo al aire libre o con el GPS prendido.' };
        render();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }
  function renderNear() {
    const n = state.near;
    const volver = `<button class="back" type="button" data-action="back">${ICONS.back}Volver</button>`;
    if (n.cargando) return `${volver}<p class="empty" role="status">Buscando tu ubicación… (aceptá el permiso si el navegador te lo pide)</p>`;
    if (n.error) return `${volver}<p class="empty" role="status">${esc(n.error)}</p>`;
    return `${volver}<p class="search__n" role="status">Lo más cerca de donde estás</p>
      <ul class="list">${n.items.map(({ place: p, m }) => `<li><button class="item" type="button" data-place="${esc(p.id)}" style="--pin:${catInfo(p.category).color}">
        <span class="item__ico">${placeIcon(p)}</span>
        <span><span class="item__name">${esc(p.name)}</span><span class="item__sub">${esc(textoDistancia(m))} · ${esc(placeLabel(p))}</span></span></button></li>`).join('')}</ul>`;
  }

  let streetHits = [];
  function renderHit(h) {
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`;
    return `<button class="back" type="button" data-action="back">${ICONS.back}Volver</button>
      <article class="card"><span class="card__cat">📍 ${esc(h.sub.split(' (')[0])}</span><h3>${esc(h.title)}</h3>
        ${h.approx ? '<p class="tip"><b>Ojo</b>La ubicación es aproximada: no tengo la numeración oficial de las calles. Sirve para orientarte.</p>' : ''}
        <div class="actions"><a class="btn btn--primary" href="${esc(dir)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a></div></article>`;
  }

  const abiertoOk = (p) => !state.soloAbiertos || openNow(p.hours) === true;
  const sinHorario = () => places.filter((p) => openNow(p.hours) === null).length;
  function renderResults() {
    if (!state.q.trim()) {
      const list = places.filter((p) => isVisible(p, state.layers) && abiertoOk(p));
      const favs = leerFavoritos().map((id) => byId.get(id)).filter(Boolean);
      const favHtml = favs.length ? `<h3 class="agenda__h">❤️ Mis lugares</h3><ul class="list">${favs.map(placeItem).join('')}</ul><h3 class="agenda__h">Todos los lugares</h3>` : '';
      return `${renderTurno()}${favHtml}${renderLayers(list.length)}
        ${list.length ? `<ul class="list">${list.map(placeItem).join('')}</ul>` : '<p class="empty">No hay lugares en las capas activas. Abrí «Capas» y prendé alguna.</p>'}`;
    }
    const found = searchPlaces(state.q).filter(abiertoOk);
    streetHits = streets ? searchStreets(streets, state.q, { toLocal, toLngLat, places }) : [];
    const calles = streetHits.length
      ? `<p class="search__n">Calles y direcciones</p><ul class="list">${streetHits.map((h, i) => `<li><button class="item" type="button" data-street="${i}"><span class="item__ico" aria-hidden="true">📍</span><span><span class="item__name">${esc(h.title)}</span><span class="item__sub">${esc(h.sub)}</span></span></button></li>`).join('')}</ul>`
      : '';
    if (!found.length && !streetHits.length) {
      const q0 = state.q;
      sugerir(places, q0).then((l) => { const box = body.querySelector('#sugerencias'); if (box && state.q === q0 && l.length) box.innerHTML = `<p class="search__n">¿Quisiste decir…?</p><ul class="list">${l.map(placeItem).join('')}</ul>`; });
      return `<p class="empty" role="status">No encontré «${esc(state.q.trim())}». Probá con otra palabra: «farmacia», «pizza», el nombre de una calle («Mármol»), una dirección («Mármol 536») o una esquina («Mármol y Planes»).</p><div id="sugerencias"></div>`;
    }
    return `${calles}${found.length ? `<p class="search__n" role="status">${found.length} lugar${found.length === 1 ? '' : 'es'}</p><ul class="list">${found.map(placeItem).join('')}</ul>` : ''}`;
  }

  // ---------- Farmacia de turno (data/turnos.json, se arma con `npm run turnos`) ----------
  const todayAR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
  const dmy = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
  function renderTurno() {
    const hoy = todayAR();
    const hits = turnos.filter((t) => t.from <= hoy && hoy <= t.to && (byId.has(t.placeId) || t.name));
    if (!hits.length) return '';
    return hits
      .map((t) => {
        const p = byId.get(t.placeId) || { name: t.name, address: t.address || '' };
        const tel = p.phone ? `<a class="btn" href="tel:${esc(String(p.phone).replace(/[^+\d]/g, ''))}">📞 Llamar</a>` : '';
        const ver = byId.has(t.placeId) ? `<button class="btn btn--primary" type="button" data-place="${esc(p.id)}">Ver en el mapa</button>` : `<a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address || ''} ${meta.town}`)}" target="_blank" rel="noopener noreferrer">Ver en Google Maps</a>`;
        return `<section class="turno" aria-label="Farmacia de turno">
          <p class="turno__over">💊 Farmacia de turno hoy</p>
          <p class="turno__name">${esc(p.name)}</p>
          <p class="turno__sub">${p.address && !/a completar/i.test(p.address) ? esc(p.address) + ' · ' : ''}hasta el ${dmy(t.to)}${t.note ? ' · ' + esc(t.note) : ''}</p>
          <div class="actions">${ver}${tel}</div>
        </section>`;
      })
      .join('');
  }

  function renderPlaces() {
    return `${demoNote()}

      <p class="near-row"><button class="btn" type="button" data-action="near">📍 Lugares cerca mío</button></p>
      <p class="near-row"><label class="abiertos"><input type="checkbox" id="solo-abiertos" ${state.soloAbiertos ? 'checked' : ''}> <span>🟢 Mostrar solo lo que está <b>abierto ahora</b></span></label>${state.soloAbiertos ? `<small class="abiertos__n">Hay ${sinHorario()} lugares sin horario cargado que no aparecen.</small>` : ''}</p>
      <form class="search" role="search" onsubmit="return false">
        <label class="sr-only" for="q">Buscar un lugar</label>
        <input id="q" type="search" placeholder="Buscar un lugar: farmacia, pizza, calle…" value="${esc(state.q)}" autocomplete="off" enterkeyhint="search">
        ${soportadoEscuchar ? '<button type="button" class="mic" data-action="mic" aria-label="Buscar hablando" title="Buscar hablando">🎤</button>' : ''}
      </form>
      <p class="voz-msg" id="voz-msg" role="status" aria-live="polite">${esc(state.voz || '')}</p>
      <div id="results">${renderResults()}</div>
      ${meta.contact ? '<p class="owner-cta"><button class="btn" type="button" data-open="owner">🏪 ¿Tenés un comercio? Sumalo o actualizá tus datos</button></p>' : ''}`;
  }

  // «Reportar un dato»: solo si configuraste un contacto (npm run contacto -- --whatsapp=549... o --email=...)
  function reportLink(p) {
    const c = meta.contact || {};
    const text = `Hola, quiero avisar un dato para corregir en la guía: «${p.name}» (${meta.town}). `;
    if (c.whatsapp) return `<a class="btn" href="https://wa.me/${esc(String(c.whatsapp).replace(/\D/g, ''))}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener noreferrer">⚠ Reportar un dato</a>`;
    if (c.email) return `<a class="btn" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Dato a corregir: ' + p.name)}&body=${encodeURIComponent(text)}">⚠ Reportar un dato</a>`;
    return '';
  }

  const fotoOk = (u) => typeof u === 'string' && /^(img\/|\.\/img\/)[\w\-./ áéíóúñ]+\.(jpe?g|png|webp)$/i.test(u);
  // ---------- «Cuánto tardo»: minutos a pie y en auto desde donde estás (el GPS solo se usa al tocar el botón) ----------
  state.eta = {};
  function renderEta(p) {
    const e = state.eta[p.id];
    if (!e) return `<p class="eta"><button class="btn" type="button" data-action="eta" data-id="${esc(p.id)}">🧭 ¿Cuánto tardo desde acá?</button></p>`;
    if (e.cargando) return '<p class="eta eta--msg">Buscando tu ubicación…</p>';
    if (e.error) return `<p class="eta eta--msg">${esc(e.error)}</p>`;
    return `<div class="eta eta--ok"><b>Desde donde estás (${esc(textoDistancia(e.m).replace(/^a /, ''))} en línea recta):</b>
      <span>🚶 ${esc(textoMinutos(minutosAPie(e.m)))} a pie</span><span>🚗 ${esc(textoMinutos(minutosAuto(e.m)))} en auto</span>
      <small>Es una estimación; el botón «Cómo llegar» abre el mapa con el camino real.</small></div>`;
  }
  function calcularEta(id) {
    const p = byId.get(id);
    if (!p) return;
    if (!navigator.geolocation) { state.eta[id] = { error: 'Tu navegador no permite usar la ubicación.' }; render(); return; }
    state.eta[id] = { cargando: true };
    render();
    navigator.geolocation.getCurrentPosition(
      (pos) => { state.eta[id] = { m: metros(pos.coords.latitude, pos.coords.longitude, p.lat, p.lng) }; render(); },
      (err) => { state.eta[id] = { error: err.code === 1 ? 'No diste permiso para usar tu ubicación. Podés activarlo en el candado de la barra del navegador.' : 'No pude saber dónde estás. Probá de nuevo al aire libre.' }; render(); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  function renderPlaceDetail(p) {
    const info = catInfo(p.category);
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
    const reviews = safeUrl(p.reviewsUrl) || safeUrl(p.googleMapsUrl) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${meta.town}`)}`;
    const web = safeUrl(p.web);
    const rows = [];
    if (p.address) rows.push(['Dirección', esc(p.address)]);
    if (p.hours) {
      const st = estadoHorario(p.hours);
      rows.push(['Horarios', `${esc(aEspanol(p.hours))}${st === null ? '' : `<br><span class="open ${st.abierto ? (st.pronto ? 'open--soon' : 'open--yes') : 'open--no'}">${st.abierto ? 'Abierto ahora' : 'Cerrado ahora'}</span>${st.texto ? ` <span class="open__when">${esc(st.texto)}</span>` : ''}`}`]);
    }
    if (p.whatsapp) rows.push(['WhatsApp', `<a href="https://wa.me/${esc(String(p.whatsapp).replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>`]);
    if (p.phone) rows.push(['Teléfono', `<a href="tel:${esc(String(p.phone).replace(/[^+\d]/g, ''))}">${esc(p.phone)}</a>`]);
    if (web) rows.push(['Web', `<a href="${esc(web)}" target="_blank" rel="noopener noreferrer">${esc(web.replace(/^https?:\/\/(www\.)?/, ''))}</a>`]);
    return `<button class="back" type="button" data-action="back">${ICONS.back}Volver</button>
      <article class="card" style="--pin:${info.color}">
        <span class="card__cat">${placeIcon(p)}${esc(placeLabel(p))}${p.demo ? '<span class="demo-badge">Ejemplo</span>' : ''}</span>
        ${fotoOk(p.photo) ? `<div class="card__ph"><img class="card__photo" src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="this.parentNode.remove()">${(() => { const st = p.hours ? estadoHorario(p.hours) : null; return st ? `<span class="card__badge ${st.abierto ? 'card__badge--yes' : 'card__badge--no'}">${st.abierto ? 'Abierto ahora' : 'Cerrado ahora'}</span>` : ''; })()}</div>` : ''}
        <h3>${esc(p.name)}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ''}
        ${p.localTip ? `<div class="tip"><b>Dato de local</b>${esc(p.localTip)}</div>` : ''}
        ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
        ${renderEta(p)}
        ${(() => { const r = resumenOpiniones(opiniones, p.id); const ops = opiniones.filter((o) => o.placeId === p.id && o.comentario).slice(0, 3); return r ? `<div class="opin"><b class="stars">${estrellas(r.prom)} ${r.prom}</b> <small>(${r.n} opinion${r.n === 1 ? '' : 'es'})</small>${ops.map((o) => `<p class="opin__c">«${esc(o.comentario)}»${o.nombre ? ` <small>— ${esc(o.nombre)}</small>` : ''}</p>`).join('')}</div>` : ''; })()}
        <p class="eta"><button class="btn" type="button" data-action="fav" data-id="${esc(p.id)}" aria-pressed="${esFavorito(p.id)}">${esFavorito(p.id) ? '❤️ En mis lugares' : '🤍 Guardar en mis lugares'}</button> <button class="btn" type="button" data-action="opinar" data-id="${esc(p.id)}">⭐ Dejar una opinión</button></p>
        ${panoOk(p.pano) ? `<p class="eta"><button class="btn" type="button" data-action="pano" data-id="${esc(p.id)}">🌐 Ver en 360°</button></p>` : ''}
        <div class="actions">
          <a class="btn btn--primary" href="${esc(dir)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>
          <a class="btn" href="${esc(reviews)}" target="_blank" rel="noopener noreferrer">★ Ver reseñas en Google</a>
          <button class="btn" type="button" data-action="share" data-id="${esc(p.id)}">🔗 Compartir</button>
          <button class="btn" type="button" data-action="qr" data-id="${esc(p.id)}">▦ Código QR</button>
          ${p.phone ? `<a class="btn" href="tel:${esc(String(p.phone).replace(/[^+\d]/g, ''))}">📞 Llamar</a>` : ''}
          ${p.whatsapp ? `<a class="btn" href="https://wa.me/${esc(String(p.whatsapp).replace(/\D/g, ''))}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>` : ''}
          ${hayVoz ? `<button class="btn" type="button" data-action="listen" data-id="${esc(p.id)}">🔊 Escuchar</button>` : ''}
          ${reportLink(p)}
          ${meta.contact ? `<button class="btn" type="button" data-action="owner" data-id="${esc(p.id)}">🏪 Soy el dueño</button>` : ''}
          ${meta.contact ? `<button class="btn" type="button" data-action="gracias" data-id="${esc(p.id)}">🙏 Dar las gracias</button>` : ''}
          ${meta.contact ? `<button class="btn" type="button" data-action="reportar" data-id="${esc(p.id)}">⚠️ Reportar un error</button>` : ''}
        </div>
        <p class="share-msg" id="share-msg" role="status" aria-live="polite"></p>
        ${p.source ? `<p class="link" style="color:var(--muted)">Fuente: ${esc(p.source)}${p.updated ? ` · actualizado ${esc(p.updated)}` : ''}</p>` : ''}
      </article>`;
  }

  function renderTourList(mode) {
    const list = tours.filter((t) => t.mode === mode);
    const miDia = `<p class="midia"><button class="btn btn--primary" type="button" data-open="midia" data-mode="${mode}">✨ Armá «Mi día en Sarmiento»</button><small>Elegís cuánto tiempo tenés y qué te gusta, y te armo el recorrido.</small></p>`;
    if (!list.length) return `${miDia}<p class="empty">Todavía no hay recorridos ${mode === 'walk' ? 'a pie' : 'en auto'}.</p>`;
    return `${miDia}${demoNote()}<ul class="list">${list
      .map(
        (t) => `<li><button class="item" type="button" data-tour="${esc(t.id)}" style="--pin:#f5c400">
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
      <p><button class="btn" type="button" data-action="share-tour" data-id="${esc(t.id)}">🔗 Compartir este recorrido</button> <button class="btn" type="button" data-open="imprimir">🖨 Imprimir</button> <span class="share-msg" id="share-msg"></span></p>
      ${lluviaTour(t)}
      ${renderManos()}
      ${hayVoz ? `<p><button class="btn" type="button" data-action="audio" aria-pressed="${state.audio}">${state.audio ? '🔇 Dejar de leer en voz alta' : '🔊 Escuchar el recorrido'}</button></p>` : ''}
      <div class="actions">
        <button class="btn" type="button" data-action="prev" ${state.step === 0 ? 'disabled' : ''}>Anterior</button>
        <button class="btn btn--primary" type="button" data-action="${state.step === last ? 'tour-exit' : 'next'}">${state.step === last ? 'Terminar' : 'Siguiente'}</button>
      </div>`;
  }

  function techadoCerca(stopPlaceId) {
    const o = byId.get(stopPlaceId);
    const items = lugaresSegunClima(places, 'lluvia', 20).items;
    if (!items.length) return null;
    if (!o?.lat) return items[0];
    return items.slice().sort((a, b) => metros(o.lat, o.lng, a.lat, a.lng) - metros(o.lat, o.lng, b.lat, b.lng))[0];
  }
  function lluviaTour(t) {
    const l = lluviaPronto(state.clima);
    if (!l) return '';
    const sp = techadoCerca(t.stops[state.step]?.placeId);
    return `<p class="tour-lluvia" role="note">☔ Puede llover cerca de las ${esc(l.hora)} (${l.prob}%).${sp ? ` Un lugar techado cerca: <button class="link" type="button" data-place="${esc(sp.id)}">${esc(sp.name)}</button>.` : ''}</p>`;
  }
  function renderManos() {
    if (!soportadoEscuchar || !hayVoz) return '';
    if (state.manos) return `<div class="manos" role="group" aria-label="Modo manos libres"><b>🙌 Manos libres</b><span id="manos-msg" role="status" aria-live="polite">${esc(state.manosMsg || '')}</span><button class="btn" type="button" data-action="manos-off">Parar</button></div>`;
    return `<p><button class="btn btn--primary" type="button" data-action="manos">🙌 Modo manos libres</button><small class="manos__ayuda">Ideal para el auto: la guía te lee cada parada y vos le decís «siguiente», «repetir» o «parar». ${esc(AYUDA_MANOS)}</small></p>`;
  }

  // ---------- Pestaña «Hoy»: farmacia de turno, eventos y novedades (npm run agenda) ----------
  const fechaLarga = (iso) => { const t = new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  function cuando(e) {
    if (e.from <= hoyISO && hoyISO <= e.to) return e.from === e.to ? 'Hoy' : `Hasta el ${dmy(e.to)}`;
    const dias = Math.round((new Date(e.from + 'T12:00:00') - new Date(hoyISO + 'T12:00:00')) / 86400000);
    return dias === 1 ? 'Mañana' : `En ${dias} días`;
  }
  function renderHoy() {
    const ev = eventosVigentes.map((e, i) => `<li class="agenda__item"><span class="agenda__when">${esc(cuando(e))}</span> <span class="agenda__cuenta agenda__cuenta--${cuentaRegresiva(e).estado}">⏳ ${esc(cuentaRegresiva(e).texto)}</span>
        <b>${esc(e.title)}</b>
        <small>${esc(fechaLarga(e.from))}${e.to !== e.from ? ' al ' + esc(fechaLarga(e.to)) : ''}${e.time ? ' · ' + esc(e.time) + ' h' : ''}${e.place ? ' · ' + esc(e.place) : ''}</small>
        ${e.text ? `<p>${esc(e.text)}</p>` : ''}
        <p class="agenda__cal"><a class="btn" href="${esc(urlGoogleCalendar(e, meta.town))}" target="_blank" rel="noopener noreferrer">📅 Google Calendar</a> <button class="btn" type="button" data-action="ev-ics" data-i="${i}">⬇ Agregar al calendario (.ics)</button></p></li>`).join('');
    const nv = novedades.map((n) => `<li class="agenda__item"><b>${esc(n.title)}</b><small>${esc(fechaLarga(n.date))}</small>${n.text ? `<p>${esc(n.text)}</p>` : ''}${safeUrl(n.link) ? `<p><a href="${esc(safeUrl(n.link))}" target="_blank" rel="noopener noreferrer">Más información</a></p>` : ''}</li>`).join('');
    const abiertos = places.filter((p) => openNow(p.hours) === true).sort((a, b) => (a.category === 'comer') - (b.category === 'comer') || a.name.localeCompare(b.name, 'es')).slice(0, 12);
    const abHtml = abiertos.length
      ? `<h3 class="agenda__h">🟢 Abierto ahora</h3><ul class="list">${abiertos.map(placeItem).join('')}</ul>`
      : '<h3 class="agenda__h">🟢 Abierto ahora</h3><p class="empty">Todavía no hay horarios cargados, o no hay nada abierto en este momento.</p>';
    return `${renderTurno()}
      ${renderClima()}
      <p class="near-row quick"><button class="btn" type="button" data-open="utiles">☎ Teléfonos útiles</button> <button class="btn" type="button" data-open="finde">🧳 Fin de semana en ${esc(meta.town)}</button> <button class="btn" type="button" data-open="llegando">📍 Estoy llegando</button> <button class="btn" type="button" data-open="historia">📜 Línea del tiempo</button>${oficios.length ? ' <button class="btn" type="button" data-open="oficios">🛠️ Oficios y servicios</button>' : ''}${(rural.caminos || []).length ? ' <button class="btn" type="button" data-open="caminos">🛣️ Caminos rurales</button>' : ''}${(rural.semanal || []).length ? ' <button class="btn" type="button" data-open="semana">📅 Actividades de la semana</button>' : ''} <button class="btn" type="button" data-open="pesca">🎣 Pesca del día</button>${places.some((x) => x.icon === 'estacionamiento' || x.icon === 'bano') ? ' <button class="btn" type="button" data-open="servicios">🅿️ Estacionamiento y baños</button>' : ''}</p>
      ${(() => { const h = actividadesDelDia(rural.semanal || []); return h.length ? `<h3 class="agenda__h">📅 Hoy hay…</h3><ul class="agenda">${h.map((a) => `<li class="agenda__item"><span class="agenda__when">${esc(a.hora || '')}${a.hora && /^\d{1,2}$/.test(a.hora) ? ' h' : ''}</span> <b>${esc(a.titulo)}</b>${a.lugar ? `<small>${esc(a.lugar)}</small>` : ''}${a.nota ? `<p>${esc(a.nota)}</p>` : ''}</li>`).join('')}</ul>` : ''; })()}
      ${abHtml}
      ${(() => { const top = populares.map((x) => byId.get(x.id)).filter(Boolean).slice(0, 5); return top.length >= 3 ? `<h3 class="agenda__h">🔥 Lo más visto</h3><ul class="list">${top.map(placeItem).join('')}</ul>` : ''; })()}
      ${ev ? `<h3 class="agenda__h">Próximos eventos</h3><ul class="agenda">${ev}</ul>` : ''}
      ${nv ? `<h3 class="agenda__h">Novedades</h3><ul class="agenda">${nv}</ul>` : ''}
      ${!ev && !nv ? '<p class="empty">Por ahora no hay eventos ni novedades cargadas.</p>' : ''}`;
  }

  // ---------- «Perdidos»: mascotas y objetos perdidos o encontrados (npm run perdidos) ----------
  const fotoPerdidoOk = (u) => typeof u === 'string' && /^img\/perdidos\/[\w\-.]+\.(jpe?g|png|webp)$/i.test(u);
  function renderPerdidos() {
    const card = (x) => {
      const wa = linkWhatsApp(x.contacto, `Hola, te escribo por el aviso de ${x.title} en la guía de ${meta.town}.`);
      const tel = /^\+?[\d\s()-]{6,}$/.test(String(x.contacto || '')) ? String(x.contacto).replace(/[^+\d]/g, '') : '';
      return `<li class="perdido perdido--${esc(x.estado)}">
        ${fotoPerdidoOk(x.photo) ? `<img class="perdido__foto" src="${esc(x.photo)}" alt="${esc(x.title)}" loading="lazy" decoding="async" onerror="this.remove()">` : ''}
        <div class="perdido__txt">
          <span class="perdido__tag">${x.estado === 'perdido' ? '🔎 Se perdió' : '✅ Se encontró'} · ${x.tipo === 'mascota' ? '🐾 Mascota' : '🎒 Objeto'}</span>
          <b>${esc(x.title)}</b>
          ${x.descripcion ? `<p>${esc(x.descripcion)}</p>` : ''}
          <small>${x.zona ? esc(x.zona) + ' · ' : ''}${esc(textoHace(diasDesde(x.fecha, hoyISO)))}</small>
          ${x.recompensa ? `<p class="perdido__rec">🎁 Recompensa: <b>${esc(x.recompensa)}</b></p>` : ''}
          ${x.info ? `<p class="perdido__info">${esc(x.info)}</p>` : ''}
          <span class="perdido__btns">${wa ? `<a class="btn btn--primary" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">💬 Tengo información</a>` : ''}${tel ? `<a class="btn" href="tel:${esc(tel)}">📞 Llamar</a>` : ''}${!wa && !tel && x.contacto ? `<span>Contacto: ${esc(x.contacto)}</span>` : ''}</span>
        </div></li>`;
    };
    return `<p class="near-row"><button class="btn btn--primary" type="button" data-open="perdido">➕ Publicar un aviso</button></p>
      ${avisosPerdidos.length ? `<ul class="perdidos">${avisosPerdidos.map(card).join('')}</ul>` : '<p class="empty">No hay avisos en este momento. Si perdiste o encontraste una mascota o un objeto, publicalo acá: lo ve todo el pueblo.</p>'}
      <p class="empty perdidos__nota">Los avisos se borran solos a los 30 días. Si ya apareció, avisanos para sacarlo.</p>`;
  }
  function openPerdido() {
    const field = (name, label, hint = '', type = 'text') => `<label class="owner__f"><span>${label}</span><input name="${name}" type="${type}" autocomplete="off">${hint ? `<small>${hint}</small>` : ''}</label>`;
    openModal('Publicar un aviso', `
      <p>Completá lo que sepas. Se arma un mensaje que me llega por ${meta.contact?.whatsapp ? 'WhatsApp' : 'correo'}; lo reviso y lo publico. <b>Las fotos mandalas en un mensaje aparte.</b></p>
      <form class="owner" id="perdido-form">
        <fieldset class="acc__text"><legend>¿Qué pasó?</legend>
          ${[['perdido', 'Se perdió'], ['encontrado', 'Lo encontré']].map(([v, l], i) => `<label class="acc__chip"><input type="radio" name="estado" value="${v}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        <fieldset class="acc__text"><legend>¿Es una…?</legend>
          ${[['mascota', 'Mascota'], ['objeto', 'Objeto']].map(([v, l], i) => `<label class="acc__chip"><input type="radio" name="tipo" value="${v}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        ${field('nombre', 'Nombre o qué es', 'Ej. Toby, o «Billetera negra»')}
        ${field('descripcion', 'Descripción', 'Color, tamaño, collar, señas particulares…')}
        ${field('zona', 'Zona o barrio donde pasó')}
        ${field('fecha', 'Fecha', 'Si no sabés, dejá vacío', 'date')}
        ${field('contacto', 'Tu teléfono o WhatsApp', 'Con código de país y área, ej. 5493364123456')}
        ${field('recompensa', 'Recompensa (opcional)', 'Solo si querés ofrecer algo por devolverlo o por dar información. Ej. $50.000')}
        ${field('info', 'Más información (opcional)', 'Si es manso, si tiene chip, horarios para llamar…')}
        <button class="btn btn--primary" type="submit">${meta.contact ? 'Enviar' : 'Armar el mensaje'}</button>
      </form>
      <div id="perdido-out"></div>`);
    const form = modalRoot.querySelector('#perdido-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      const out = modalRoot.querySelector('#perdido-out');
      if (!String(d.nombre || '').trim() || !String(d.contacto || '').trim()) { out.innerHTML = '<p class="empty">Escribí qué es y un teléfono de contacto.</p>'; return; }
      const texto = mensajePerdido({ town: meta.town, ...d });
      const href = linkContacto(meta.contact, texto, `Aviso: ${d.nombre}`);
      if (href) { window.open(href, '_blank', 'noopener,noreferrer'); out.innerHTML = '<p class="share-msg">Se abrió tu aplicación con el mensaje listo: tocá enviar. Después mandá las fotos. ¡Gracias!</p>'; return; }
      out.innerHTML = `<p>Copiá este mensaje y mandalo a quien administra la guía:</p><textarea readonly rows="8" style="width:100%">${esc(texto)}</textarea>`;
    });
  }

  // ---------- «Mi día en Sarmiento» ----------
  function openMiDia(modoInicial = 'walk') {
    const home = meta.focus || meta.center;
    openModal('Mi día en Sarmiento', `
      <p>Contame cuánto tiempo tenés y qué te gusta, y te armo un recorrido a tu medida.</p>
      <form class="owner" id="midia-form">
        <fieldset class="acc__text"><legend>¿Cuánto tiempo tenés?</legend>
          ${[['1', '1 hora'], ['2', '2 horas'], ['3', '3 horas'], ['5', 'Medio día']].map(([v, l]) => `<label class="acc__chip"><input type="radio" name="horas" value="${v}" ${v === '2' ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        <fieldset class="acc__text"><legend>¿Cómo te movés?</legend>
          ${[['walk', '🚶 A pie'], ['car', '🚗 En auto']].map(([v, l]) => `<label class="acc__chip"><input type="radio" name="modo" value="${v}" ${v === modoInicial ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        <fieldset class="acc__text"><legend>¿Qué te gusta? (elegí uno o varios)</legend>
          ${Object.entries(INTERESES).map(([k, v]) => `<label class="acc__chip"><input type="checkbox" name="int" value="${k}" ${k === 'historia' || k === 'comer' ? 'checked' : ''}><span>${v.label}</span></label>`).join('')}
        </fieldset>
        <button class="btn btn--primary" type="submit">Armar mi recorrido</button>
      </form>
      <div id="midia-out"></div>`);
    const form = modalRoot.querySelector('#midia-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const tour = armarDia({ places, home, horas: Number(fd.get('horas')), modo: fd.get('modo'), intereses: fd.getAll('int') });
      if (!tour) { modalRoot.querySelector('#midia-out').innerHTML = '<p class="empty">No encontré suficientes lugares con esos gustos. Probá marcando más opciones o cambiando a «En auto».</p>'; return; }
      const i = tours.findIndex((x) => x.id === 'mi-dia');
      if (i >= 0) tours.splice(i, 1);
      tours.unshift(tour);
      closeModal();
      state.tab = tour.mode === 'walk' ? 'pie' : 'auto';
      state.tourId = tour.id;
      state.step = 0;
      nav.startTour(tour.id);
      showPanel(true);
      render();
    });
  }

  function renderGuides() {
    if (!guides.length) {
      const info = places.filter((p) => p.icon === 'turismo' || /turismo/i.test(p.name));
      return `<p class="empty">Todavía no hay guías de turismo cargados. Cuando los haya, van a aparecer acá para que los contactes (se publican solo con el consentimiento de cada guía).</p>${
        info.length ? `<p class="empty">Mientras tanto, para pedir información:</p><ul class="list">${info.map(placeItem).join('')}</ul>` : ''
      }`;
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
    const buildHtml = () => {
    let html = '';
    if (state.tab === 'lugares') {
      const p = state.placeId && byId.get(state.placeId);
      html = p ? renderPlaceDetail(p) : state.hit ? renderHit(state.hit) : state.near ? renderNear() : renderPlaces();
    } else if (state.tab === 'pie' || state.tab === 'auto') {
      const t = state.tourId && tours.find((x) => x.id === state.tourId);
      html = t ? renderTour(t) : renderTourList(state.tab === 'pie' ? 'walk' : 'car');
    } else if (state.tab === 'hoy') html = renderHoy();
    else if (state.tab === 'perdidos') html = renderPerdidos();
    else html = renderGuides();
    return html;
    };
    const sig = [state.tab, state.placeId, state.tourId, state.hit && 'hit', state.near && 'near'].join('|');
    const cambia = sig !== lastTrack;
    const apply = () => { body.innerHTML = buildHtml(); if (cambia) body.scrollTop = 0; anim.view(sig); }; // el HTML se arma al aplicar: así una transición atrasada nunca pisa un repintado más nuevo
    // Transición suave entre pantallas (View Transitions, viene en el navegador); si no existe, se cambia directo.
    if (cambia && lastTrack !== '' && document.startViewTransition && !document.documentElement.classList.contains('pref-calm') && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      try { document.startViewTransition(apply); } catch { apply(); }
    } else apply();
    if (sig !== lastTrack) {
      lastTrack = sig;
      const pl = state.placeId && byId.get(state.placeId);
      if (pl) contar(`lugar/${pl.id}`, `Lugar: ${pl.name}`);
      else if (state.tourId) contar(`recorrido/${state.tourId}`, `Recorrido: ${(tours.find((x) => x.id === state.tourId) || {}).title || state.tourId}`);
      else contar(`pestana/${state.tab}`, `Pestaña: ${state.tab}`);
    }
  }

  // ---------- Acciones ----------
  function setTab(id, { keepState = false } = {}) {
    if (!keepState) {
      if (state.tourId) manosParar();
      if (state.tourId) nav.stopTour();
      if (state.tourId) labels.setExtra([]);
      state.tourId = null;
      state.placeId = null;
      state.hit = null;
      state.near = null;
      labels.setSearchPin(null);
      labels.highlight(null);
      callar();
    }
    state.tab = id;
    if (id !== 'lugares') labels.setExtra([]);
    render();
    body.scrollTop = 0;
  }

  function selectPlace(id) {
    const p = byId.get(id);
    if (!p) return;
    if (state.tourId) {
      manosParar();
      nav.stopTour();
      labels.setExtra([]);
      state.tourId = null;
    }
    state.tab = 'lugares';
    if (!isVisible(p, state.layers)) setLayers(new Set([...state.layers, layerOf(p)])); // para que el pin se vea
    state.placeId = id;
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
    const i = tabs.findIndex((t) => t.id === state.tab);
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    setTab(n.id);
    root.querySelector(`#tab-${n.id}`).focus();
  });

  body.addEventListener('click', (e) => {
    const t = e.target;
    const st = t.closest('[data-street]');
    if (st) {
      const h = streetHits[Number(st.dataset.street)];
      if (h) {
        state.hit = h;
        labels.highlight(null);
        labels.setSearchPin(h);
        nav.flyTo(h.lng, h.lat, { dist: 150 });
        if (window.matchMedia('(max-width: 700px)').matches) showPanel(false);
        render();
      }
      return;
    }
    const place = t.closest('[data-place]');
    if (place) {
      if (place.closest('.modal')) closeModal();
      return selectPlace(place.dataset.place);
    }
    const shortcut = t.closest('[data-layers]')?.dataset.layers;
    if (shortcut) {
      setLayers(shortcut === 'all' ? new Set(LAYERS.map((l) => l.id)) : shortcut === 'none' ? new Set() : defaultLayers());
      state.layersOpen = true;
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
      callar();
      state.placeId = null;
      state.near = null;
      state.hit = null;
      labels.setSearchPin(null);
      labels.highlight(null);
      render();
    } else if (action === 'share') {
      sharePlace(t.closest('[data-action]').dataset.id);
    } else if (action === 'qr') {
      openQR(t.closest('[data-action]').dataset.id);
    } else if (action === 'owner') {
      openOwner(t.closest('[data-action]').dataset.id);
    } else if (action === 'audio') {
      state.audio = !state.audio;
      if (!state.audio) callar();
      else {
        const t = tours.find((x) => x.id === state.tourId);
        const s = t?.stops[state.step];
        if (s) hablar(`Parada ${state.step + 1} de ${t.stops.length}. ${byId.get(s.placeId)?.name || ''}. ${s.note || ''} ${s.tip || ''}`);
      }
      render();
    } else if (action === 'listen') {
      const p = byId.get(t.closest('[data-action]').dataset.id);
      if (p) hablar(`${p.name}. ${placeLabel(p)}. ${p.address && !/a completar/i.test(p.address) ? 'Dirección: ' + p.address + '. ' : ''}${p.description || ''}`);
    } else if (action === 'near') {
      buscarCerca();
    } else if (action === 'ev-ics') {
      bajarIcs(t.closest('[data-action]').dataset.i);
    } else if (action === 'gracias') {
      openGracias(t.closest('[data-action]').dataset.id);
    } else if (action === 'reportar') {
      openReporte(t.closest('[data-action]').dataset.id);
    } else if (action === 'manos') {
      manosEmpezar();
    } else if (action === 'manos-off') {
      manosParar('Listo, terminé el modo manos libres.', true);
    } else if (action === 'mic') {
      dictar();
    } else if (action === 'ir-hoy') {
      state.tab = 'hoy'; state.placeId = null; state.tourId = null; showPanel(true); render();
    } else if (action === 'clima-voz') {
      if (state.clima) hablar(textoVozClima(state.clima));
    } else if (action === 'clima-plan') {
      openPlanClima();
    } else if (action === 'fav') {
      const id = t.closest('[data-action]').dataset.id;
      alternarFavorito(id);
      render();
    } else if (action === 'opinar') {
      openOpinion(t.closest('[data-action]').dataset.id);
    } else if (action === 'share-tour') {
      shareTour(t.closest('[data-action]').dataset.id);
    } else if (action === 'pano') {
      const pl = byId.get(t.closest('[data-action]').dataset.id);
      if (pl) {
        contar(`360/${pl.id}`, `360°: ${pl.name}`);
        openModal(pl.name + ' en 360°', '<div id="pano-box" class="pano"><p class="empty">Cargando…</p></div><p class="empty">Arrastrá con el dedo para mirar alrededor.</p>');
        verPanorama(modalRoot.querySelector('#pano-box'), pl.pano, pl.name).then((ok) => { if (!ok) { const b = modalRoot.querySelector('#pano-box'); if (b) b.innerHTML = '<p class="empty">No pude cargar la foto 360°. Revisá tu conexión e intentá de nuevo.</p>'; } });
      }
    } else if (action === 'eta') {
      calcularEta(t.closest('[data-action]').dataset.id);
    } else if (action === 'tour-exit') {
      manosParar();
      callar();
      state.audio = false;
      nav.stopTour();
      state.tourId = null;
      labels.setExtra([]);
      labels.highlight(null);
      render();
    } else if (action === 'next') nav.next();
    else if (action === 'prev') nav.prev();
  });

  // Buscar mientras se escribe: solo se redibujan los resultados (el cuadro conserva el foco).
  body.addEventListener('input', (e) => {
    if (e.target?.id !== 'q') return;
    state.q = e.target.value;
    const res = body.querySelector('#results');
    if (res) res.innerHTML = renderResults();
  });

  // ---------- Compartir un lugar: link con ?lugar=ID ----------
  async function sharePlace(id) {
    const p = byId.get(id);
    if (!p) return;
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('lugar', id);
    const msg = body.querySelector('#share-msg');
    const say = (t) => { if (msg) msg.textContent = t; };
    try {
      if (navigator.share) {
        await navigator.share({ title: `${p.name} · ${meta.town}`, text: `${p.name} en ${meta.town}`, url: url.href });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url.href);
      say('Link copiado. Pegalo en WhatsApp o donde quieras.');
    } catch {
      say(`Copiá este link: ${url.href}`);
    }
  }

  body.addEventListener('change', (e) => {
    if (e.target?.id === 'solo-abiertos') {
      state.soloAbiertos = e.target.checked;
      render();
      return;
    }
    const id = e.target?.dataset?.layer;
    if (!id) return;
    const next = new Set(state.layers);
    if (e.target.checked) next.add(id);
    else next.delete(id);
    setLayers(next);
    state.layersOpen = true;
    const top = body.scrollTop;
    render();
    body.scrollTop = top;
    body.querySelector(`[data-layer="${id}"]`)?.focus();
  });
  body.addEventListener('toggle', (e) => {
    if (e.target.classList?.contains('layers')) state.layersOpen = e.target.open;
  }, true);

  on('place:select', selectPlace);
  on('tour:step', ({ tour, step, place }) => {
    state.tourId = tour.id;
    state.step = step;
    if (state.manos && place) setTimeout(() => manosLeer(), 0);
    else if (state.audio && place) hablar(`Parada ${step + 1} de ${tour.stops.length}. ${place.name}. ${tour.stops[step]?.note || ''} ${tour.stops[step]?.tip || ''}`);
    labels.setExtra(tour.stops.map((x) => x.placeId));
    labels.highlight(place?.id ?? null);
    if (state.tab !== (tour.mode === 'car' ? 'auto' : 'pie')) state.tab = tour.mode === 'car' ? 'auto' : 'pie';
    render();
  });

  btnList.addEventListener('click', () => showPanel(panel.classList.contains('is-collapsed')));
  root.querySelector('#btn-close')?.addEventListener('click', () => showPanel(false));
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
    anim.modal();
    modalRoot.querySelector('.modal').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal') || e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', onKey);
  }

  // ---------- Código QR, instalar como app y «Soy el dueño» ----------
  function openQR(id) {
    const p = id ? byId.get(id) : null;
    const url = new URL(location.href);
    url.search = ''; url.hash = '';
    if (p) url.searchParams.set('lugar', p.id);
    const svg = qrSvg(url.href, { label: `Código QR de ${p ? p.name : meta.name}` });
    const file = `qr-${(p ? p.name : 'guia').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.svg`;
    openModal(p ? `Código QR · ${p.name}` : 'Código QR de la guía', `
      <div class="qr-box">${svg}</div>
      <p class="qr-hint">Abrí la cámara del celular y apuntá al código: se abre ${p ? 'este lugar' : 'la guía'} en la guía de ${esc(meta.town)}. Podés imprimirlo y pegarlo en el comercio.</p>
      <p><a class="btn" download="${esc(file)}" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">⬇ Descargar el código</a></p>
      <p class="link" style="color:var(--muted);word-break:break-all">${esc(url.href)}</p>`);
  }
  function openInstall() {
    const plat = plataforma();
    if (instalada()) { openModal('Instalar la guía', '<p>¡Ya la tenés instalada! Se abre desde el ícono de tu pantalla de inicio.</p>'); return; }
    openModal('Instalar la guía como app', `
      <p>Con la guía en tu pantalla de inicio se abre más rápido y funciona sin internet (con lo que ya viste).</p>
      ${puedeInstalarDirecto() ? '<p><button class="btn btn--primary" type="button" id="do-install">📲 Instalar ahora</button></p>' : ''}
      <h3>${plat === 'ios' ? 'En iPhone / iPad' : plat === 'android' ? 'En Android' : 'En la computadora'}</h3>
      <ol class="install-steps">${pasos(plat).map((s) => `<li>${s}</li>`).join('')}</ol>`);
    modalRoot.querySelector('#do-install')?.addEventListener('click', async () => { await instalar(); closeModal(); });
  }
  function openOwner(id) {
    const p = id ? byId.get(id) : null;
    const field = (name, label, value = '', hint = '', type = 'text') => `<label class="owner__f"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" autocomplete="off">${hint ? `<small>${hint}</small>` : ''}</label>`;
    openModal(p ? 'Soy el dueño: actualizar mis datos' : 'Sumá o actualizá tu comercio', `
      <p>Completá lo que quieras cambiar. Se arma un mensaje que me llega por ${meta.contact?.whatsapp ? 'WhatsApp' : 'correo'}; reviso los datos y los publico.</p>
      <form class="owner" id="owner-form">
        ${field('nombre', 'Nombre del comercio', p?.name || '')}
        ${field('telefono', 'Teléfono', p?.phone || '')}
        ${field('whatsapp', 'WhatsApp', p?.whatsapp || '', 'Con código de país y área, ej. 5493364123456')}
        ${field('horario', 'Horario', '', 'Escribilo como hablás: Lun a Vie 8 a 12 y 16 a 20; Sáb 9 a 13')}
        ${field('direccion', 'Dirección', p?.address && !/a completar/i.test(p.address) ? p.address : '')}
        ${field('nota', 'Algo más (opcional)')}
        <button class="btn btn--primary" type="submit">${meta.contact ? 'Enviar' : 'Armar el mensaje'}</button>
      </form>
      <div id="owner-out"></div>`);
    const form = modalRoot.querySelector('#owner-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      if (!String(d.nombre || '').trim()) { modalRoot.querySelector('#owner-out').innerHTML = '<p class="empty">Escribí el nombre del comercio.</p>'; return; }
      const texto = mensajeComercio({ town: meta.town, ...d });
      const href = linkContacto(meta.contact, texto, `Datos de mi comercio: ${d.nombre}`);
      if (href) { window.open(href, '_blank', 'noopener,noreferrer'); modalRoot.querySelector('#owner-out').innerHTML = '<p class="share-msg">Se abrió tu aplicación con el mensaje listo: tocá enviar. ¡Gracias!</p>'; return; }
      modalRoot.querySelector('#owner-out').innerHTML = `<p>Copiá este mensaje y mandalo a quien administra la guía:</p><textarea readonly rows="7" style="width:100%">${esc(texto)}</textarea>`;
    });
  }

  const creditsHtml = () => `
    <h3>Créditos</h3>
    <ul>
      <li>Mapa: © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> (licencia ODbL).</li>
      <li>Clima: datos de <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a> (CC BY 4.0). Día y noche calculados con la posición real del sol.</li>
      ${meta.approxBuildings ? '<li>Casas de las calles sin datos: generadas por la guía de forma aproximada; no son las construcciones reales.</li>' : ''}
      ${(meta.buildingSources || []).map((t) => `<li>Edificios: ${esc(t)}.</li>`).join('')}
      ${meta.satellite ? '<li>Imagen satelital de los alrededores: <a href="https://s2maps.eu" target="_blank" rel="noopener noreferrer">Sentinel-2 cloudless</a> de EOX IT Services GmbH (contiene datos Copernicus Sentinel modificados; CC BY 4.0).</li>' : ''}
      <li>Motor 3D: <a href="https://threejs.org" target="_blank" rel="noopener noreferrer">three.js</a> (MIT). Tipografías: Fraunces e Inter (SIL OFL).</li>
      <li>Maqueta estilizada: las alturas están exageradas.</li>
    </ul>
    <p class="modal__foot">Versión ${esc(meta.version)} · ${esc(meta.date)}</p>`;

  function openLegal() {
    openModal('Aviso importante', `${(meta.legal || []).map((t) => `<p>${esc(t)}</p>`).join('')}${creditsHtml()}`);
  }
  // ---------- Clima (Open-Meteo) ----------
  function renderClima() {
    const c = state.clima;
    if (!c) return '<section class="clima clima--vacio" aria-label="Clima"><p class="empty">Consultando el clima…</p></section>';
    const a = c.ahora;
    return `<section class="clima" aria-label="Clima en ${esc(meta.town)}">
      <div class="clima__top"><span class="clima__ico" aria-hidden="true">${a.icono}</span><div><b class="clima__temp">${a.temp}°</b><span class="clima__txt">${esc(a.texto)} · sensación ${a.sensacion}°</span></div></div>
      <p class="clima__det">💨 ${a.viento} km/h del ${esc(a.rumbo)} · 💧 ${a.humedad}% · 🌅 ${esc(c.salida)} · 🌇 ${esc(c.puesta)} · UV ${c.uv} (${uvTexto(c.uv)})</p>
      <p class="clima__consejo"><span aria-hidden="true">${c.consejo.icono}</span> ${esc(c.consejo.texto)}</p>
      ${c.horas.length ? `<ul class="clima__horas" aria-label="Próximas horas">${c.horas.map((h) => `<li><small>${esc(h.hora)}</small><span aria-hidden="true">${h.icono}</span><b>${h.temp}°</b>${h.lluvia >= 20 ? `<small>💧${h.lluvia}%</small>` : '<small>&nbsp;</small>'}</li>`).join('')}</ul>` : ''}
      <ul class="clima__dias" aria-label="Próximos días">${c.dias.map((d) => `<li><small>${esc(d.nombre)}</small><span aria-hidden="true" title="${esc(d.texto)}">${d.icono}</span><b>${d.max}°</b><small>${d.min}°</small>${d.lluvia >= 30 ? `<small>💧${d.lluvia}%</small>` : '<small>&nbsp;</small>'}</li>`).join('')}</ul>
      <div class="actions">${hayVoz ? '<button class="btn" type="button" data-action="clima-voz">🔊 Escuchar el pronóstico</button>' : ''}<button class="btn btn--primary" type="button" data-action="clima-plan">${esc(c.consejo.icono)} Planes para hoy</button></div>
      <small class="clima__fuente">Datos: <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>${c.viejo ? ' · sin conexión: último pronóstico guardado' : ''}. No reemplaza los alertas oficiales del <a href="${esc(SMN)}" target="_blank" rel="noopener noreferrer">SMN</a>.</small>
    </section>`;
  }
  function mostrarAlerta() {
    root.querySelector('#alerta-clima')?.remove();
    const a = state.clima?.alerta;
    if (!a) return;
    let cerrada = null;
    try { cerrada = localStorage.getItem('guia.alerta'); } catch { /* sin almacenamiento */ }
    if (cerrada === a.clave) return;
    const el = document.createElement('aside');
    el.id = 'alerta-clima';
    el.className = `alerta-clima alerta--${a.nivel}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `<span class="alerta-clima__ico" aria-hidden="true">${a.icono}</span>
      <div class="alerta-clima__txt"><b>${esc(a.texto)}</b><small>Aviso automático según el pronóstico; no es una alerta oficial del <a href="${esc(SMN)}" target="_blank" rel="noopener noreferrer">SMN</a>.</small>
      <span class="alerta-clima__btns"><button type="button" class="btn" data-alerta="ver">Ver pronóstico</button>${hayVoz ? '<button type="button" class="btn" data-alerta="voz" aria-label="Escuchar la alerta">🔊</button>' : ''}<button type="button" class="btn btn--primary" data-alerta="ok">Entendido</button></span></div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-alerta]')?.dataset.alerta;
      if (b === 'voz') { hablar(a.texto); return; }
      if (b === 'ver' || b === 'ok') {
        try { localStorage.setItem('guia.alerta', a.clave); } catch { /* nada */ }
        el.remove();
        if (b === 'ver') { state.tab = 'hoy'; state.placeId = null; state.tourId = null; showPanel(true); render(); }
      }
    });
    root.appendChild(el);
  }
  function cargarClima() {
    const c0 = meta.focus || meta.center;
    if (!c0) return;
    fetchClima(c0.lat, c0.lng).then((j) => {
      state.clima = resumenClima(j);
      const chip = root.querySelector('#clima-chip');
      if (chip && state.clima) {
        chip.hidden = false;
        chip.innerHTML = `<button type="button" class="clima__chip" data-action="ir-hoy" aria-label="Clima: ${state.clima.ahora.temp} grados, ${esc(state.clima.ahora.texto)}. Tocá para ver el pronóstico.">${state.clima.ahora.icono} ${state.clima.ahora.temp}° · ${esc(state.clima.ahora.texto)}</button>`;
      }
      mostrarAlerta();
      if (state.tab === 'hoy' && !state.placeId) render();
    });
  }
  function openPlanClima() {
    const c = state.clima;
    if (!c) return;
    const pasos = planDelDia(places, c.consejo.tipo);
    const plan = lugaresSegunClima(places, c.consejo.tipo);
    openModal(plan.titulo, `<p>${esc(c.consejo.texto)}</p>${pasos.length
      ? `<h3>Tu plan para hoy</h3>${pasos.map((s) => `<h4 class="plan__h">${s.icono} ${esc(s.momento)}</h4><ul class="list">${placeItem(s.place)}</ul>`).join('')}`
      : (plan.items.length ? `<ul class="list">${plan.items.map(placeItem).join('')}</ul>` : '<p class="empty">Todavía no hay lugares cargados para este plan.</p>')}
      <p><button class="btn btn--primary" type="button" data-open="midia" data-mode="walk">✨ Armá «Mi día en Sarmiento»</button> <button class="btn" type="button" data-open="imprimir">🖨 Imprimir</button></p>`);
  }


  // ---------- Hablarle a la guía ----------
  const vozMsg = (t) => { state.voz = t; const el = body.querySelector('#voz-msg'); if (el) el.textContent = t; };
  function lugaresAbiertos() {
    return places.filter((p) => openNow(p.hours) === true);
  }
  function nombresHablados(l, max = 4) {
    const n = l.slice(0, max).map((p) => p.name);
    return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0] || '';
  }
  function turnoHablado() {
    const hoy = todayAR();
    const t = turnos.find((x) => x.from <= hoy && hoy <= x.to);
    if (!t) return 'Todavía no tengo cargada la farmacia de turno de hoy.';
    const p = byId.get(t.placeId) || { name: t.name, address: t.address };
    return `La farmacia de turno de hoy es ${p.name}${p.address && !/a completar/i.test(p.address) ? ', en ' + p.address : ''}.`;
  }
  function ejecutarComando(frase) {
    const cmd = interpretar(consultaES(frase));
    const ir = (tab) => { state.tab = tab; state.placeId = null; state.tourId = null; state.hit = null; state.near = false; closeModal(); showPanel(true); render(); };
    switch (cmd.accion) {
      case 'clima': ir('hoy'); if (state.clima) hablar(textoVozClima(state.clima)); else hablar('Todavía estoy consultando el clima, probá de nuevo en un momento.'); break;
      case 'turno': ir('hoy'); hablar(turnoHablado()); break;
      case 'abierto': { ir('hoy'); const l = lugaresAbiertos(); hablar(l.length ? `Hay ${l.length} lugares abiertos ahora, por ejemplo ${nombresHablados(l)}.` : 'No tengo lugares abiertos cargados en este momento.'); break; }
      case 'utiles': openUtiles(); break;
      case 'servicios': openServicios(); break;
      case 'finde': openFinde(); break;
      case 'midia': openMiDia('walk'); break;
      case 'pie': ir('pie'); break;
      case 'auto': ir('auto'); break;
      case 'recorridos': ir('pie'); break;
      case 'perdidos': ir('perdidos'); break;
      case 'cerca': ir('lugares'); buscarCerca(); break;
      case 'favoritos': state.q = ''; ir('lugares'); break;
      case 'ayuda': openHelp(); break;
      case 'buscar': {
        state.q = cmd.texto;
        ir('lugares');
        const found = searchPlaces(state.q);
        const m = found.length ? `Encontré ${found.length} ${found.length === 1 ? 'lugar' : 'lugares'}: ${nombresHablados(found)}.` : `No encontré «${cmd.texto}».`;
        vozMsg(`Escuché: «${frase}». ${m}`);
        hablar(m);
        break;
      }
      default: break;
    }
  }
  // ---------- Modo manos libres (recorridos) ----------
  let manosEsc = 0, manosCancel = null, manosSilencios = 0, manosGps = null;
  const manosAnunciada = new Set();
  let manosLluvia = '';
  const tourActual = () => tours.find((x) => x.id === state.tourId);
  function manosMsg(t) { state.manosMsg = t; const el = root.querySelector('#manos-msg'); if (el) el.textContent = t; }
  function manosParar(msg, hablarMsg = false) {
    if (!state.manos && !msg) return;
    state.manos = false;
    manosEsc++;
    try { manosCancel?.(); } catch { /* nada */ }
    manosCancel = null;
    if (manosGps != null) { try { navigator.geolocation.clearWatch(manosGps); } catch { /* nada */ } manosGps = null; }
    manosAnunciada.clear();
    callar();
    if (msg) { state.manosMsg = msg; if (hablarMsg) hablar(msg); }
    if (state.tourId) render();
  }
  function manosLeer(extra = '') {
    const t = tourActual();
    if (!state.manos || !t) return;
    manosEsc++;
    try { manosCancel?.(); } catch { /* nada */ }
    const s = t.stops[state.step];
    const ll = lluviaPronto(state.clima);
    if (ll && manosLluvia !== `${t.id}|${ll.hora}`) { manosLluvia = `${t.id}|${ll.hora}`; const sp = techadoCerca(s?.placeId); extra += `Ojo: puede llover cerca de las ${ll.hora.replace(':00', '')}. ${sp ? 'Un lugar techado cerca es ' + sp.name + '. ' : ''}`; }
    hablar(`${extra}Parada ${state.step + 1} de ${t.stops.length}. ${byId.get(s?.placeId)?.name || ''}. ${s?.note || ''} ${s?.tip || ''}`, manosEscuchar);
  }
  function manosDecir(texto) { manosEsc++; try { manosCancel?.(); } catch { /* nada */ } hablar(texto, manosEscuchar); }
  function manosEscuchar() {
    if (!state.manos || !tourActual()) return;
    if (estaHablando()) { setTimeout(manosEscuchar, 400); return; }
    const mi = ++manosEsc;
    manosMsg('🎤 Te escucho… ' + AYUDA_MANOS);
    manosCancel = escuchar({
      lang: codigoIdioma(),
      alResultado: (f) => { if (mi !== manosEsc) return; manosSilencios = 0; manosOrden(f); },
      alTerminar: (dijo) => {
        if (mi !== manosEsc || !state.manos) return;
        if (!dijo) {
          if (++manosSilencios >= 8) { manosParar('Dejé de escuchar porque no dijiste nada. Tocá «Modo manos libres» para volver a empezar.'); return; }
          setTimeout(() => { if (mi === manosEsc) manosEscuchar(); }, 300);
        }
      },
      alError: (e) => {
        if (mi !== manosEsc) return;
        if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'no-soportado') manosParar('No tengo permiso para usar el micrófono. Revisá el permiso del navegador.');
      },
    });
  }
  function manosOrden(frase) {
    const t = tourActual();
    if (!t) return;
    const ultima = t.stops.length - 1;
    manosMsg(`Escuché: «${frase}»`);
    switch (comandoTour(frase)) {
      case 'sig': if (state.step < ultima) nav.next(); else manosDecir('Esa era la última parada. Decí «parar» para terminar o «repetir» para escucharla otra vez.'); break;
      case 'ant': if (state.step > 0) nav.prev(); else manosDecir('Estás en la primera parada.'); break;
      case 'rep': manosLeer(); break;
      case 'falta': { const f = ultima - state.step; manosDecir(f ? `Estás en la parada ${state.step + 1} de ${t.stops.length}. Falta${f === 1 ? '' : 'n'} ${f}.` : 'Estás en la última parada.'); break; }
      case 'fin': manosParar('Listo, terminé el modo manos libres.', true); break;
      default: manosDecir('No te entendí. ' + AYUDA_MANOS);
    }
  }
  function manosEmpezar() {
    if (!soportadoEscuchar || !tourActual()) return;
    state.manos = true;
    state.audio = false;
    manosSilencios = 0;
    manosMsg('');
    render();
    manosLeer('Modo manos libres activado. ');
    if (navigator.geolocation && !manosGps) {
      try {
        manosGps = navigator.geolocation.watchPosition((pos) => {
          const t = tourActual();
          const sig = t?.stops[state.step + 1];
          const pl = sig && byId.get(sig.placeId);
          if (!state.manos || !pl || manosAnunciada.has(state.step + 1)) return;
          if (metros(pos.coords.latitude, pos.coords.longitude, pl.lat, pl.lng) < 50) { manosAnunciada.add(state.step + 1); nav.next(); }
        }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
      } catch { /* sin GPS no pasa nada: se maneja por voz */ }
    }
  }

  function dictar() {
    const btn = body.querySelector('.mic');
    if (!soportadoEscuchar) return;
    callar();
    btn?.classList.add('mic--on');
    vozMsg('Te escucho… decime qué buscás.');
    escuchar({
      lang: codigoIdioma(),
      alResultado: (t) => { ejecutarComando(t); if (!state.voz?.startsWith('Escuché')) vozMsg(`Escuché: «${t}»`); },
      alTerminar: (dijo) => { btn?.classList.remove('mic--on'); if (!dijo) vozMsg('No te escuché bien. Tocá el micrófono y probá de nuevo.'); },
      alError: (e) => { btn?.classList.remove('mic--on'); vozMsg(e === 'not-allowed' || e === 'service-not-allowed' ? 'No diste permiso para usar el micrófono.' : e === 'no-speech' ? 'No te escuché. Probá de nuevo.' : 'No pude usar el micrófono ahora.'); },
    });
  }

  // ---------- «Estoy llegando» ----------
  function contenidoLlegada(info) {
    const centro = meta.focus || meta.center;
    const t = tours.find((x) => x.id === 'auto-centro') || tours.find((x) => x.mode === 'walk');
    const abiertos = places.filter((p) => openNow(p.hours) === true).slice(0, 4);
    const c = state.clima;
    return `${info ? `<h3>${esc(info.titulo)}</h3><p>${esc(info.texto)}</p>` : `<p>Bienvenido a ${esc(meta.town)}. Empezá por la plaza y seguí con un recorrido a pie.</p>`}
      ${c ? `<p class="clima__consejo">${c.ahora.icono} Ahora: ${c.ahora.temp}° y ${esc(c.ahora.texto.toLowerCase())}. ${esc(c.consejo.texto)}</p>` : ''}
      ${c?.alerta ? `<p class="tour-lluvia">${c.alerta.icono} ${esc(c.alerta.texto)}</p>` : ''}
      ${t ? `<p><button class="btn btn--primary" type="button" data-start-tour="${esc(t.id)}">▶ Empezar: ${esc(t.title)}</button></p>` : ''}
      ${abiertos.length ? `<h3>Abierto ahora</h3><ul class="list">${abiertos.map(placeItem).join('')}</ul>` : ''}
      <p><button class="btn" type="button" data-open="midia" data-mode="walk">✨ Armá «Mi día en ${esc(meta.town)}»</button> <button class="btn" type="button" data-open="utiles">☎ Teléfonos útiles</button></p>
      ${centro ? `<p><a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${centro.lat},${centro.lng}" target="_blank" rel="noopener noreferrer">🧭 Cómo llegar al centro</a></p>` : ''}`;
  }
  function openLlegando() {
    const centro = meta.focus || meta.center;
    openModal('📍 Estoy llegando', '<div id="llegada-body"><p class="empty">Buscando dónde estás…</p></div>');
    const poner = (info) => { const m = modalRoot.querySelector('#llegada-body'); if (m) m.innerHTML = contenidoLlegada(info); };
    if (!navigator.geolocation || !centro) { poner(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => poner(describirLlegada(metros(pos.coords.latitude, pos.coords.longitude, centro.lat, centro.lng))),
      () => poner(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  // ---------- Línea del tiempo ----------
  function openHistoria() {
    const items = ordenarHistoria(historia);
    const mensaje = encodeURIComponent(`Hola, tengo una foto o un dato histórico de ${meta.town} para la línea del tiempo.`);
    const aporte = meta.contact?.whatsapp ? `<p><a class="btn" href="https://wa.me/${String(meta.contact.whatsapp).replace(/\D/g, '')}?text=${mensaje}" target="_blank" rel="noopener noreferrer">📷 Mandá tu foto o dato</a></p>` : '';
    openModal(`Línea del tiempo de ${meta.town}`, items.length
      ? `<ol class="linea">${items.map((h) => `<li><b class="linea__anio">${esc(h.anio)}</b><div><h3>${esc(h.titulo)}</h3>${h.texto ? `<p>${esc(h.texto)}</p>` : ''}${fotoHistoriaOk(h.foto) ? `<img src="${esc(h.foto)}" alt="${esc(h.titulo)}" loading="lazy" decoding="async">` : ''}</div></li>`).join('')}</ol>${aporte}`
      : `<p>Todavía no hay hechos cargados. Si tenés fotos viejas o datos del pueblo, mandalos y los sumamos.</p>${aporte}`);
  }

  // ---------- Estacionamiento y baños públicos ----------
  function listaServicios(origen) {
    const bloque = (icon, titulo) => {
      const l = places.filter((x) => x.icon === icon && Number.isFinite(x.lat));
      if (origen) l.sort((a, b) => metros(origen.lat, origen.lng, a.lat, a.lng) - metros(origen.lat, origen.lng, b.lat, b.lng));
      return `<h3>${titulo}</h3>${l.length ? `<ul class="list">${l.slice(0, 6).map(placeItem).join('')}</ul>` : '<p class="empty">Todavía no hay cargados.</p>'}`;
    };
    return bloque('estacionamiento', '🅿️ Estacionamiento') + bloque('bano', '🚻 Baños públicos');
  }
  function openServicios() {
    const centro = meta.focus || meta.center;
    openModal('Estacionamiento y baños públicos', `<p>Ordenados desde donde estás (si diste permiso de ubicación) o desde el centro.</p><div id="serv-body">${listaServicios(centro)}</div>`);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => { const el = modalRoot.querySelector('#serv-body'); if (el) el.innerHTML = listaServicios({ lat: pos.coords.latitude, lng: pos.coords.longitude }); }, () => {}, { timeout: 8000, maximumAge: 60000 });
  }

  // ---------- Oficios y servicios ----------
  function listaOficios(q) {
    const g = agruparOficios(filtrarOficios(oficios, q));
    if (!g.length) return '<p class="empty">No encontré nada con eso.</p>';
    return g.map((s) => `<h3>${esc(s.rubro)}</h3><ul class="oficios">${s.lista.map((x) => { const l = enlacesTelefono(x.telefono); return `<li><div><b>${esc(x.nombre)}</b><small>${esc([x.zona, x.nota].filter(Boolean).join(' · '))}</small></div><span class="oficios__btns">${l.tel ? `<a class="btn" href="${esc(l.tel)}">📞 Llamar</a>` : ''}${l.wa ? `<a class="btn" href="${esc(l.wa)}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>` : ''}</span></li>`; }).join('')}</ul>`).join('');
  }
  function openCaminos() {
    const l = ordenarCaminos(rural.caminos || []).map((c) => describirCamino(c));
    openModal('Estado de los caminos rurales', `<p>Informado por vecinos y el municipio. Después de una lluvia fuerte cambia rápido: confirmalo antes de salir.</p>
      <ul class="caminos">${l.map((c) => `<li class="camino camino--${c.clase}"><span aria-hidden="true">${c.icono}</span><div><b>${esc(c.nombre)}</b><small>${esc(c.texto)}</small>${c.nota ? `<small>${esc(c.nota)}</small>` : ''}${c.cuando ? `<small>${esc(c.cuando)}</small>` : ''}${c.aviso ? `<small class="camino__viejo">⚠ ${esc(c.aviso)}</small>` : ''}</div></li>`).join('')}</ul>`);
  }
  function openSemana() {
    const s = semanaCompleta(rural.semanal || []);
    openModal('Actividades de todas las semanas', s.length ? s.map((d) => `<h3 class="agenda__h">${d.hoy ? 'Hoy · ' : ''}${esc(d.dia.charAt(0).toUpperCase() + d.dia.slice(1))}</h3><ul class="agenda">${d.items.map((a) => `<li class="agenda__item"><span class="agenda__when">${esc(a.hora || '')}</span> <b>${esc(a.titulo)}</b>${a.lugar ? `<small>${esc(a.lugar)}</small>` : ''}${a.nota ? `<p>${esc(a.nota)}</p>` : ''}</li>`).join('')}</ul>`).join('') : '<p class="empty">Todavía no hay actividades cargadas.</p>');
  }
  async function openPesca() {
    const c0 = meta.focus || meta.center;
    openModal('Pesca del día', '<p class="empty" id="pesca-body">Consultando presión, viento y luna…</p>');
    const j = await fetchPesca(c0.lat, c0.lng);
    const r = condicionesPesca(j);
    const luna = faseLunar();
    const cerca = places.filter((p) => (p.icon === 'pesca' || p.icon === 'puente') && Number.isFinite(p.lat)).map((p) => ({ p, d: metros(c0.lat, c0.lng, p.lat, p.lng) })).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.p);
    const body = modalRoot.querySelector('#pesca-body'); if (!body) return;
    body.outerHTML = `<div class="pesca">${r ? `<p class="pesca__nivel pesca__nivel--${r.nivel}"><span aria-hidden="true">${r.icono}</span> <b>${esc(r.texto)}</b></p>
      <ul>${r.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <p class="pesca__datos">Presión ${r.presion} hPa · viento ${r.viento} km/h · ${luna.icono} ${esc(luna.nombre)} (${luna.iluminacion}%)</p>
      <p>${esc(r.mejores)}</p>` : `<p>No pude consultar el clima (¿sin internet?). Fase de la luna: ${luna.icono} ${esc(luna.nombre)}.</p>`}
      <small>Es orientativo: se arma con presión, viento, lluvia y luna. Respetá las medidas y vedas vigentes.</small>
      ${cerca.length ? `<h3 class="agenda__h">Dónde pescar</h3><ul class="list">${cerca.map(placeItem).join('')}</ul>` : ''}</div>`;
  }
  function openOficios() {
    openModal('Oficios y servicios', `<p>Tocá para llamar o escribir. Cada persona aceptó que su número se publique.</p>
      <label class="owner__f"><span>Buscar (plomero, remís…)</span><input id="of-q" type="search" autocomplete="off"></label>
      <div id="of-list">${listaOficios('')}</div>`);
    modalRoot.querySelector('#of-q').addEventListener('input', (e) => { modalRoot.querySelector('#of-list').innerHTML = listaOficios(e.target.value); });
  }

  // ---------- Dar las gracias (un toque = opinión de 5 estrellas con una frase) ----------
  const GRACIAS = ['Muy buena atención', 'Rico y bien servido', 'Buen precio', 'Son muy amables', 'Siempre cumplen'];
  function openGracias(id) {
    const p = byId.get(id);
    if (!p) return;
    openModal(`Dar las gracias a ${p.name}`, `<p>Elegí una frase y listo: te abre el mensaje armado para enviar.</p>
      <div class="gracias">${GRACIAS.map((g, i) => `<button class="btn" type="button" data-gracias="${i}">🙏 ${esc(g)}</button>`).join('')}</div><div id="gracias-out"></div>`);
    modalRoot.querySelector('.gracias').addEventListener('click', (e) => {
      const b = e.target.closest('[data-gracias]');
      if (!b) return;
      const texto = mensajeOpinion({ town: meta.town, lugar: p.name, estrellas: 5, comentario: GRACIAS[Number(b.dataset.gracias)] });
      const href = linkContacto(meta.contact, texto, `Gracias a ${p.name}`);
      const out = modalRoot.querySelector('#gracias-out');
      if (href) { window.open(href, '_blank', 'noopener,noreferrer'); out.innerHTML = '<p class="share-msg">Se abrió tu aplicación con el mensaje listo: tocá enviar. ¡Gracias por agradecer!</p>'; return; }
      out.innerHTML = `<p>Copiá este mensaje y mandalo a quien administra la guía:</p><textarea readonly rows="5" style="width:100%">${esc(texto)}</textarea>`;
    });
  }

  // ---------- Reportar un error ----------
  function openReporte(id) {
    const p = byId.get(id);
    if (!p) return;
    openModal(`Reportar un error: ${p.name}`, `<p>Contanos qué está mal; lo revisamos y lo corregimos.</p>
      <form class="owner" id="rep-form">
        <fieldset class="acc__text"><legend>¿Qué pasa?</legend>${TIPOS_ERROR.map(([v, l], i) => `<label class="acc__chip"><input type="radio" name="tipo" value="${v}" ${i === 0 ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</fieldset>
        <label class="owner__f"><span>Detalle (opcional)</span><input name="texto" type="text" autocomplete="off" maxlength="200"></label>
        <button class="btn btn--primary" type="submit">${meta.contact ? 'Enviar' : 'Armar el mensaje'}</button>
      </form><div id="rep-out"></div>`);
    const form = modalRoot.querySelector('#rep-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      const texto = mensajeError({ town: meta.town, lugar: p.name, ...d });
      const href = linkContacto(meta.contact, texto, `Error en ${p.name}`);
      const out = modalRoot.querySelector('#rep-out');
      if (href) { window.open(href, '_blank', 'noopener,noreferrer'); out.innerHTML = '<p class="share-msg">Se abrió tu aplicación con el mensaje listo: tocá enviar. ¡Gracias!</p>'; return; }
      out.innerHTML = `<p>Copiá este mensaje y mandalo a quien administra la guía:</p><textarea readonly rows="5" style="width:100%">${esc(texto)}</textarea>`;
    });
  }
  function bajarIcs(i) {
    const e = eventosVigentes[Number(i)];
    if (!e) return;
    const blob = new Blob([ics(e, meta.town)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${String(e.title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'evento'}.ics`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- Teléfonos útiles (funciona sin internet con lo que ya se cargó) ----------
  function openUtiles() {
    const tel = (n) => String(n || '').replace(/[^+\d]/g, '');
    const grupos = [['hospital', '🏥 Salud'], ['policia', '🚓 Policía'], ['bomberos', '🚒 Bomberos'], ['municipalidad', '🏛️ Municipalidad'], ['farmacia', '💊 Farmacias'], ['remis', '🚕 Remises y taxis'], ['correo', '📮 Correo']];
    const bloques = grupos.map(([icon, titulo]) => {
      const l = places.filter((p) => p.icon === icon);
      return l.length ? `<h3>${titulo}</h3><ul class="util">${l.map((p) => `<li><b>${esc(p.name)}</b>${p.address && !/a completar/i.test(p.address) ? `<small>${esc(p.address)}</small>` : ''}${p.phone ? `<a class="btn" href="tel:${esc(tel(p.phone))}">📞 ${esc(p.phone)}</a>` : `<button class="btn" type="button" data-place="${esc(p.id)}">Ver en el mapa</button>`}</li>`).join('')}</ul>` : '';
    }).join('');
    openModal('Teléfonos útiles', `<h3>🚨 Emergencias</h3><ul class="util">${(meta.emergency || []).map((e) => `<li><b>${esc(e.label)}</b><a class="btn btn--primary" href="tel:${esc(e.number)}">📞 ${esc(e.number)}</a></li>`).join('')}</ul>${bloques}<p class="empty">Los teléfonos que faltan se cargan en fuentes/datos-lugares.txt.</p>`);
  }
  // ---------- Fin de semana ----------
  function openFinde() {
    const secs = armarFinde(places);
    openModal(`Fin de semana en ${meta.town}`, `<p>Lo básico para pasar un fin de semana: dónde dormir, dónde comer y qué hacer, con sol o con lluvia.</p>${secs.length ? secs.map((s) => `<h3>${s.titulo}</h3><ul class="list">${s.items.map(placeItem).join('')}</ul>`).join('') : '<p class="empty">Todavía no hay lugares cargados para armar esta guía.</p>'}<p><button class="btn btn--primary" type="button" data-open="midia" data-mode="walk">✨ Armá «Mi día en Sarmiento»</button></p>`);
  }
  // ---------- Opiniones con estrellas ----------
  function openOpinion(id) {
    const p = byId.get(id);
    if (!p) return;
    openModal(`Tu opinión sobre ${p.name}`, `<p>Tu opinión me llega por ${meta.contact?.whatsapp ? 'WhatsApp' : 'correo'}; la reviso y la publico.</p>
      <form class="owner" id="opin-form">
        <fieldset class="acc__text"><legend>Puntaje</legend>${[5, 4, 3, 2, 1].map((n) => `<label class="acc__chip"><input type="radio" name="estrellas" value="${n}" ${n === 5 ? 'checked' : ''}><span>${'★'.repeat(n)}</span></label>`).join('')}</fieldset>
        <label class="owner__f"><span>Comentario (opcional)</span><input name="comentario" type="text" autocomplete="off" maxlength="200"></label>
        <label class="owner__f"><span>Tu nombre (opcional)</span><input name="nombre" type="text" autocomplete="off" maxlength="40"></label>
        <button class="btn btn--primary" type="submit">${meta.contact ? 'Enviar' : 'Armar el mensaje'}</button>
      </form><div id="opin-out"></div>`);
    const form = modalRoot.querySelector('#opin-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      const texto = mensajeOpinion({ town: meta.town, lugar: p.name, ...d });
      const href = linkContacto(meta.contact, texto, `Opinión: ${p.name}`);
      const out = modalRoot.querySelector('#opin-out');
      if (href) { window.open(href, '_blank', 'noopener,noreferrer'); out.innerHTML = '<p class="share-msg">Se abrió tu aplicación con el mensaje listo: tocá enviar. ¡Gracias!</p>'; return; }
      out.innerHTML = `<p>Copiá este mensaje y mandalo a quien administra la guía:</p><textarea readonly rows="6" style="width:100%">${esc(texto)}</textarea>`;
    });
  }
  // ---------- Compartir un recorrido ----------
  async function shareTour(id) {
    const t = tours.find((x) => x.id === id);
    if (!t) return;
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    const lista = t.stops.map((s, i) => `${i + 1}. ${byId.get(s.placeId)?.name || 'Parada'}`).join('\n');
    const texto = `${t.title} en ${meta.town}${t.durationMin ? ` (${t.durationMin} min)` : ''}\n${lista}\n${url.href}`;
    const msg = body.querySelector('#share-msg');
    const say = (m) => { if (msg) msg.textContent = m; };
    try {
      if (navigator.share) { await navigator.share({ title: `${t.title} · ${meta.town}`, text: texto }); return; }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    try { await navigator.clipboard.writeText(texto); say('Recorrido copiado. Pegalo en WhatsApp.'); } catch { say('No pude copiarlo.'); }
  }

  function openHelp() {
    openModal(
      'Cómo moverse',
      `<h3>Con mouse</h3><ul><li><b>Arrastrá</b> para moverte</li><li><b>Rueda</b> o pellizco del trackpad para acercar</li><li><b>Clic derecho</b> o <b>⌥ + arrastrar</b> para girar e inclinar</li></ul>
       <h3>Con el celular</h3><ul><li><b>Un dedo</b> para moverte</li><li><b>Dos dedos</b> para acercar y girar</li></ul>
       <p>Tocá un pin para ver el lugar. En <b>A pie</b> y <b>En auto</b> hay recorridos armados, parada por parada, y en <b>Guías</b>, los guías de turismo del pueblo para contactar.</p>
       <p><button type="button" class="btn" data-open="acc">♿ Accesibilidad: letra grande, contraste, modo lista</button> <button type="button" class="btn" data-open="intro">👋 Ver la guía de bienvenida</button> <button type="button" class="btn" data-open="utiles">☎ Teléfonos útiles</button></p>
       <h3>Emergencias</h3><ul>${(meta.emergency || []).map((e) => `<li>${esc(e.label)}: <a href="tel:${esc(e.number)}"><b>${esc(e.number)}</b></a></li>`).join('')}</ul>
       ${creditsHtml()}`,
    );
  }
  // ---------- Accesibilidad: letra grande, alto contraste, sin movimiento y modo lista (sin 3D) ----------
  function openAccessibility() {
    const pr = loadPrefs();
    const row = (id, label, hint, checked) => `<label class="acc__row"><input type="checkbox" id="acc-${id}" ${checked ? 'checked' : ''}><span><b>${label}</b><small>${hint}</small></span></label>`;
    openModal(
      'Accesibilidad',
      `${row('facil', '🧓 Modo fácil', 'Letra muy grande, botones grandes y solo lo esencial. Ideal para quien no usa mucho el celular.', pr.facil)}
      <fieldset class="acc__text"><legend>Tamaño de la letra</legend>
        ${[['0', 'Normal'], ['1', 'Grande'], ['2', 'Muy grande']].map(([v, l]) => `<label class="acc__chip"><input type="radio" name="acc-text" value="${v}" ${String(pr.text) === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </fieldset>
      <fieldset class="acc__text"><legend>Colores</legend>
        ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<label class="acc__chip"><input type="radio" name="acc-theme" value="${v}" ${pr.theme === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </fieldset>
      ${row('contrast', 'Alto contraste', 'Colores más fuertes y bordes marcados, para ver mejor.', pr.contrast)}
      ${row('calm', 'Sin movimiento', 'Quita animaciones y transiciones.', pr.calm)}
      ${row('map2d', 'Mapa liviano 2D', 'Un mapa plano (sin 3D) con las calles, casas y lugares: carga rápido y anda en celulares viejos. Se recarga la página.', pr.map2d)}
      ${row('simple', 'Modo lista (sin 3D)', 'Muestra solo la guía en lista, más liviana: ideal para celulares viejos, internet lenta o si el 3D te marea. Se recarga la página.', pr.simple)}`,
    );
    const box = modalRoot;
    const save = () => {
      const next = {
        text: Number(box.querySelector('input[name="acc-text"]:checked')?.value || 0),
        theme: box.querySelector('input[name="acc-theme"]:checked')?.value || 'auto',
        contrast: box.querySelector('#acc-contrast').checked,
        calm: box.querySelector('#acc-calm').checked,
        simple: box.querySelector('#acc-simple').checked,
        facil: box.querySelector('#acc-facil').checked,
        map2d: box.querySelector('#acc-map2d').checked,
      };
      if (next.facil !== pr.facil) {
        Object.assign(next, next.facil ? { text: 2, calm: true, theme: 'light' } : { text: 0, calm: false });
        box.querySelector(`input[name="acc-text"][value="${next.text}"]`).checked = true;
        box.querySelector('#acc-calm').checked = next.calm;
        if (next.facil) box.querySelector('input[name="acc-theme"][value="light"]').checked = true;
      }
      const reload = next.simple !== pr.simple || next.map2d !== pr.map2d;
      savePrefs(next);
      applyPrefs(next);
      Object.assign(pr, next);
      if (reload) location.reload();
    };
    box.querySelectorAll('.acc__row input, .acc__text input').forEach((i) => i.addEventListener('change', save));
  }
  root.addEventListener('click', (e) => {
    const st = e.target.closest('[data-start-tour]');
    if (st) {
      closeModal();
      state.tourId = st.dataset.startTour;
      state.step = 0;
      nav.startTour(state.tourId);
      showPanel(true);
      render();
      return;
    }
    const o = e.target.closest('[data-open]');
    if (o?.dataset.open === 'legal') openLegal();
    else if (o?.dataset.open === 'acc') openAccessibility();
    else if (o?.dataset.open === 'install') openInstall();
    else if (o?.dataset.open === 'qr') openQR(null);
    else if (o?.dataset.open === 'owner') openOwner(null);
    else if (o?.dataset.open === 'perdido') openPerdido();
    else if (o?.dataset.open === 'utiles') openUtiles();
    else if (o?.dataset.open === 'finde') openFinde();
    else if (o?.dataset.open === 'llegando') openLlegando();
    else if (o?.dataset.open === 'historia') openHistoria();
    else if (o?.dataset.open === 'oficios') openOficios();
    else if (o?.dataset.open === 'caminos') openCaminos();
    else if (o?.dataset.open === 'semana') openSemana();
    else if (o?.dataset.open === 'pesca') openPesca();
    else if (o?.dataset.open === 'servicios') openServicios();
    else if (o?.dataset.open === 'imprimir') window.print();
    else if (o?.dataset.open === 'intro') { closeModal(); iniciarIntro({ forzar: true }); }
    else if (o?.dataset.open === 'midia') openMiDia(o.dataset.mode);
  });
  root.querySelector('#btn-help').addEventListener('click', openHelp);
  // Guía de bienvenida: solo la primera vez (y si no hay otra ventana abierta)
  setTimeout(() => { if (!modalRoot.querySelector('.modal') && !window.__noIntro && !new URLSearchParams(location.search).has('quiosco')) iniciarIntro(); }, 3500);

  // ---------- Clima y hora ----------
  const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  function weatherIcon(i) {
    if (i.storm) return '⛈️';
    if (i.rain > 0.05) return '🌧️';
    if (i.snow > 0.05) return '❄️';
    if (i.fog > 0.4) return '🌫️';
    if (i.cloud > 0.75) return '☁️';
    if (i.cloud > 0.35) return i.night ? '☁️' : '⛅';
    return i.night ? '🌙' : '☀️';
  }
  on('weather:update', (i) => {
    if (!btnWeather) return;
    const temp = i.temp != null ? `${Math.round(i.temp)}°` : '';
    const sim = i.simulated ? ` ${hhmm(i.hour)}` : '';
    btnWeather.hidden = false;
    btnWeather.textContent = `${weatherIcon(i)}${temp ? ' ' + temp : ''}${sim}`;
    const desc = `${i.label}${temp ? ', ' + temp.replace('°', ' °C') : ''}`;
    const tip = `${desc}${i.simulated ? ` · simulando las ${hhmm(i.hour)}` : ''}. Tocá para ver el pueblo en otro momento del día.`;
    btnWeather.title = tip;
    btnWeather.setAttribute('aria-label', `Clima: ${tip}`);
  });
  btnWeather?.addEventListener('click', () => emit('sky:cycle'));

  // ---------- Avisos del camino y del tiempo ----------
  // Manuales: fuentes/avisos.txt (npm run agenda). Automáticos: pronóstico de Open-Meteo (no son alertas oficiales).
  const avisosBox = root.querySelector('#avisos');
  let avisosClimaAuto = [];
  const cerrados = (() => { try { return new Set(JSON.parse(sessionStorage.getItem('guia-avisos-cerrados') || '[]')); } catch { return new Set(); } })();
  function renderAvisos() {
    const manuales = (agenda.avisos || []).filter((a) => a.from <= hoyISO && hoyISO <= a.to).map((a) => ({ ...a, nivel: 2, manual: true }));
    const turnoHoy = turnos.filter((t) => t.from <= hoyISO && hoyISO <= t.to).map((t) => { const p = byId.get(t.placeId); const nombre = p?.name || t.name; return nombre ? { tipo: 'turno', nivel: 0, title: `Farmacia de turno: ${nombre}`, text: [p?.address || t.address, t.note].filter((x) => x && !/a completar/i.test(x)).join(' · '), manual: true } : null; }).filter(Boolean);
    const todos = [...turnoHoy, ...manuales, ...avisosClimaAuto.map((a) => ({ ...a, title: a.titulo, text: a.texto }))].filter((a) => !cerrados.has(a.title));
    avisosBox.innerHTML = todos
      .slice(0, 4)
      .map((a, i) => `<div class="aviso aviso--${a.tipo}${a.nivel >= 2 ? ' aviso--alto' : ''}" role="alert">
        <span class="aviso__ico" aria-hidden="true">${a.tipo === 'ruta' ? '🚧' : a.tipo === 'clima' ? '⛈️' : a.tipo === 'turno' ? '💊' : '⚠️'}</span>
        <div><b>${esc(a.title)}</b>${a.text ? `<span>${esc(a.text)}</span>` : ''}${a.manual ? '' : `<small>Aviso automático según el pronóstico. No es una alerta oficial: <a href="${SMN}" target="_blank" rel="noopener noreferrer">ver alertas del Servicio Meteorológico</a>.</small>`}</div>
        <button type="button" class="aviso__x" data-aviso="${esc(a.title)}" aria-label="Cerrar este aviso">✕</button></div>`)
      .join('');
  }
  avisosBox.addEventListener('click', (e) => {
    const x = e.target.closest('[data-aviso]');
    if (!x) return;
    cerrados.add(x.dataset.aviso);
    try { sessionStorage.setItem('guia-avisos-cerrados', JSON.stringify([...cerrados])); } catch { /* sin almacenamiento */ }
    renderAvisos();
  });
  renderAvisos();
  if (meta.center) fetchPronostico(meta.center.lat, meta.center.lng, hoyISO).then((a) => { avisosClimaAuto = a; renderAvisos(); });

  // ---------- Inicio ----------
  render();
  setTab(quiosco ? 'hoy' : 'lugares');
  if (matchMedia('(max-width: 819px)').matches && hasGL) showPanel(true);

  // ---------- Link a un lugar (?lugar=ID) ----------
  try {
    const want = new URLSearchParams(location.search).get('lugar');
    if (want && byId.has(want)) setTimeout(() => selectPlace(want), 400);
  } catch { /* sin URL: se ignora */ }

  // ---------- Nombres de calles y arroyos ----------
  const btnCalles = root.querySelector('#btn-calles');
  if (btnCalles) {
    btnCalles.addEventListener('click', () => emit('calles:toggle'));
    on('calles:state', (v) => btnCalles.setAttribute('aria-pressed', String(Boolean(v))));
  }

  // ---------- Barrios ----------
  const btnBarrios = root.querySelector('#btn-barrios');
  if (btnBarrios) {
    btnBarrios.addEventListener('click', () => emit('barrios:toggle'));
    on('barrios:state', (v) => btnBarrios.setAttribute('aria-pressed', String(Boolean(v))));
  }

  // ---------- Botones + y − (para quien no tiene rueda) ----------
  // Acercan o alejan la cámara hacia el punto que se está mirando. Mantener apretado repite; las teclas + y − hacen lo mismo.
  const zoomBy = (factor) => {
    if (controls?.zoomBy) return controls.zoomBy(factor); // mapa 2D
    if (!controls) return;
    const cam = controls.object;
    const off = cam.position.clone().sub(controls.target);
    const d0 = off.length();
    const d1 = Math.min(controls.maxDistance, Math.max(controls.minDistance, d0 * factor));
    if (Math.abs(d1 - d0) < 0.01) return;
    cam.position.copy(controls.target).add(off.multiplyScalar(d1 / d0));
    controls.update();
  };
  const holdZoom = (btn, factor) => {
    let timer = null;
    const stop = () => { clearInterval(timer); timer = null; };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      e.preventDefault();
      zoomBy(factor);
      stop();
      timer = setInterval(() => zoomBy(factor), 60);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) btn.addEventListener(ev, stop);
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomBy(factor); } });
  };
  holdZoom(root.querySelector('#btn-zin'), 0.88);
  holdZoom(root.querySelector('#btn-zout'), 1 / 0.88);
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(input|textarea|select)$/i.test(e.target?.tagName || '')) return;
    if (e.key === '+' || e.key === '=') zoomBy(0.8);
    else if (e.key === '-' || e.key === '_') zoomBy(1.25);
  });

  return {
    update() {
      if (!hasGL || !controls) return;
      needle.style.transform = `rotate(${-controls.getAzimuthalAngle()}rad)`;
    },
    emit,
  };
}
