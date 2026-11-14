// Pines de lugares como etiquetas HTML (CSS2DRenderer).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { v3 } from './scene-utils.js';
import { placeIcon, placeLabel, catInfo } from './icons.js';
import { emit } from './bus.js';
import { esc } from './util.js';
import { defaultLayers, isVisible } from './layers.js';

export function initLabels(scene, places) {
  const group = new THREE.Group();
  group.name = 'labels';
  scene.add(group);
  const items = new Map(); // solo los pines que están dibujados ahora (se crean y se sacan según las capas activas)
  const byId = new Map(places.map((p) => [p.id, p]));

  // Con muchos lugares, de lejos se muestran solo los importantes (así se entiende el mapa y el navegador trabaja menos).
  const IMPORTANT = new Set(['iglesia', 'municipalidad', 'museo', 'cultura', 'biblioteca', 'escuela', 'hospital', 'bomberos', 'policia', 'estacion', 'plaza', 'monumento', 'hotel', 'hospedaje', 'camping', 'club', 'turismo', 'mirador', 'atractivo', 'tanque', 'silo', 'terminal', 'farmacia', 'combustible', 'banco']);
  const important = (p) => !p.icon || IMPORTANT.has(p.icon) || Boolean(p.roofH);
  let layers = defaultLayers();
  let extra = new Set(); // lugares que se muestran siempre (las paradas del recorrido abierto)
  let activeId = null;
  let level = 0; // 0 cerca (todo con nombre) · 1 media (solo punto) · 2 lejos (solo importantes)

  function make(p) {
    const info = catInfo(p.category);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pin';
    el.dataset.cat = p.category;
    el.style.setProperty('--pin', info.color);
    el.style.setProperty('--pin-ink', info.ink || '#fff');
    el.setAttribute('aria-label', `${p.name}, ${placeLabel(p)}`);
    el.innerHTML = `<span class="pin__dot">${placeIcon(p)}</span><span class="pin__name">${esc(p.name)}</span>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      emit('place:select', p.id);
    });
    // CSS2DRenderer pisa el `transform` del elemento que recibe: por eso el pin va dentro de un
    // ancla de tamaño cero y se acomoda con CSS (la punta del pin queda sobre el punto exacto).
    const anchor = document.createElement('div');
    anchor.className = 'pin-anchor';
    anchor.append(el);
    const obj = new CSS2DObject(anchor);
    const pos = v3(p.lng, p.lat, (p.roofH || 0) + 4); // la punta del pin queda sobre el techo
    obj.position.copy(pos);
    group.add(obj);
    return { obj, el, anchor, place: p, pos };
  }

  const wanted = (p) => p.id === activeId || extra.has(p.id) || isVisible(p, layers);

  const apply = () => {
    // 1) crear los que faltan y sacar los que sobran (los pines de las capas apagadas no existen: ni objeto ni elemento)
    for (const p of places) {
      const want = wanted(p);
      const it = items.get(p.id);
      if (want && !it) items.set(p.id, make(p));
      else if (!want && it) {
        group.remove(it.obj);
        it.anchor.remove();
        items.delete(p.id);
      }
    }
    // 2) detalle según la distancia de la cámara
    items.forEach(({ obj, el, place }, id) => {
      const on = id === activeId;
      obj.visible = level < 2 || on || extra.has(id) || important(place) || items.size < 60;
      el.classList.toggle('is-far', level >= 1 && !on);
      el.classList.toggle('is-on', on);
    });
  };
  apply();

  return {
    /** Capas activas (Set de ids de layers.js). */
    setLayers(set) {
      layers = new Set(set);
      apply();
    },
    /** Lugares que se muestran aunque su capa esté apagada (paradas de un recorrido). */
    setExtra(ids) {
      extra = new Set(ids || []);
      apply();
    },
    highlight(id) {
      activeId = id && byId.has(id) ? id : null;
      apply();
    },
    /** Cantidad de pines dibujados ahora. */
    count: () => items.size,
    /** Según la distancia de la cámara: nombres (cerca), solo puntos (medio) o solo lugares importantes (lejos). */
    update(camera) {
      const d = camera.position.length();
      const lv = d > 1100 ? 2 : d > 600 ? 1 : 0;
      if (lv === level) return; // casi todos los cuadros no hay nada que hacer
      level = lv;
      apply();
    },
  };
}
