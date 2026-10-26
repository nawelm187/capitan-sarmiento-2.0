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

  let filter = null;
  let activeId = null;
  const apply = () => {
    items.forEach(({ obj, place }) => {
      obj.visible = !filter || place.category === filter;
    });
  };

  return {
    setFilter(cat) {
      filter = cat || null;
      apply();
    },
    highlight(id) {
      activeId = id;
      items.forEach(({ el }, k) => el.classList.toggle('is-on', k === id));
    },
    /** Oculta los nombres cuando la cámara está lejos (queda solo el punto). */
    update(camera) {
      const far = camera.position.length() > 700;
      items.forEach(({ el }, id) => el.classList.toggle('is-far', far && id !== activeId));
    },
  };
}
