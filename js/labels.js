// Pines de lugares como etiquetas HTML (CSS2DRenderer).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { v3 } from './scene-utils.js';
import { placeIcon, placeLabel, catInfo } from './icons.js';
import { emit } from './bus.js';
import { esc } from './util.js';

export function initLabels(scene, places) {
  const group = new THREE.Group();
  group.name = 'labels';
  scene.add(group);
  const items = new Map();

  for (const p of places) {
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
    const pos = v3(p.lng, p.lat, (p.roofH || 0) + 4); // la punta del pin queda sobre el techo (antes flotaba a 16 m y parecía corrido)
    obj.position.copy(pos);
    group.add(obj);
    items.set(p.id, { obj, el, place: p, pos });
  }

  // Con muchos lugares, de lejos se muestran solo los importantes (así se entiende el mapa y el navegador trabaja menos).
  const IMPORTANT = new Set(['iglesia', 'municipalidad', 'museo', 'cultura', 'biblioteca', 'escuela', 'hospital', 'bomberos', 'policia', 'estacion', 'plaza', 'monumento', 'hotel', 'hospedaje', 'camping', 'club', 'turismo', 'mirador', 'atractivo', 'tanque', 'silo', 'terminal', 'farmacia', 'combustible', 'banco']);
  const important = (p) => !p.icon || IMPORTANT.has(p.icon) || Boolean(p.roofH);
  let filter = null;
  let activeId = null;
  let level = 0; // 0 cerca (todo con nombre) · 1 media (solo punto) · 2 lejos (solo importantes)
  const apply = () => {
    items.forEach(({ obj, el, place }, id) => {
      const on = id === activeId;
      obj.visible = (!filter || place.category === filter) && (level < 2 || on || important(place) || Boolean(filter));
      el.classList.toggle('is-far', level >= 1 && !on);
    });
  };
  apply();

  return {
    setFilter(cat) {
      filter = cat || null;
      apply();
    },
    highlight(id) {
      activeId = id;
      items.forEach(({ el }, k) => el.classList.toggle('is-on', k === id));
      apply();
    },
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
