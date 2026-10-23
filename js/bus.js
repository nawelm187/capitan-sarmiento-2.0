// Bus de eventos mínimo para desacoplar la UI de la escena 3D.
const target = new EventTarget();

export const emit = (name, detail) => target.dispatchEvent(new CustomEvent(name, { detail }));

export function on(name, fn) {
  const h = (e) => fn(e.detail);
  target.addEventListener(name, h);
  return () => target.removeEventListener(name, h);
}
