// Chequeo de salud de la guía: qué tan completa está y qué conviene cargar primero.   npm run salud
// (Para cargar lo que falta: npm run datos)
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const leer = async (f, def) => { try { return JSON.parse(await readFile(new URL(f, root), 'utf8')); } catch { return def; } };
const places = await leer('data/places.json', null);
if (!places) { console.log('No encuentro data/places.json. Corré primero: npm run lugares'); process.exit(1); }
const tours = await leer('data/tours.json', []);
const turnos = await leer('data/turnos.json', []);
const opiniones = await leer('data/opiniones.json', []);
const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
const pct = (n) => `${Math.round((n / Math.max(1, places.length)) * 100)}%`;
const vacio = (v) => !v || /a completar/i.test(String(v));

const sinHorario = places.filter((p) => vacio(p.hours));
const sinContacto = places.filter((p) => vacio(p.phone) && vacio(p.whatsapp));
const sinDireccion = places.filter((p) => vacio(p.address));
const sinUbicar = places.filter((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lng));
const ids = new Set(places.map((p) => p.id));
const toursRotos = tours.filter((t) => !t.stops?.length || t.stops.some((s) => !ids.has(s.placeId)));
const turnoHoy = (Array.isArray(turnos) ? turnos : []).some((t) => t.from <= hoy && hoy <= (t.to || t.from));
const importantes = new Set(['comer', 'servicios', 'salud', 'comercios']);
const prioridad = places.filter((p) => (importantes.has(p.category) || /farmacia|panaderia|supermercado|banco|hospital|restaurante|parrilla/.test(p.icon || '')) && (vacio(p.hours) || (vacio(p.phone) && vacio(p.whatsapp))));

const L = [];
L.push(`Salud de la guía · ${hoy} · ${places.length} lugares`, '');
L.push(`🕒 Con horario:   ${places.length - sinHorario.length} (${pct(places.length - sinHorario.length)})`);
L.push(`📞 Con contacto:  ${places.length - sinContacto.length} (${pct(places.length - sinContacto.length)})`);
L.push(`📍 Con dirección: ${places.length - sinDireccion.length} (${pct(places.length - sinDireccion.length)})`);
L.push(`🗺️ Ubicados en el mapa: ${places.length - sinUbicar.length} (${pct(places.length - sinUbicar.length)})`);
L.push(`💬 Opiniones publicadas: ${opiniones.length}`);
L.push(`💊 Farmacia de turno de hoy: ${turnoHoy ? 'cargada' : 'NO está cargada (npm run turnos)'}`);
L.push(`🥾 Recorridos: ${tours.length}${toursRotos.length ? ` · con problemas: ${toursRotos.map((t) => t.title || t.id).join(', ')}` : ' · todos bien'}`);
const completos = places.length - new Set([...sinHorario, ...sinContacto, ...sinDireccion].map((p) => p.id)).size;
L.push('', `Puntaje general: ${Math.round((completos / Math.max(1, places.length)) * 100)}% de los lugares tienen todo completo.`);
if (prioridad.length) { L.push('', 'Cargá primero estos (comercios importantes a los que les falta horario o contacto):'); prioridad.slice(0, 15).forEach((p) => L.push(`  · ${p.name}${vacio(p.hours) ? ' — falta horario' : ''}${vacio(p.phone) && vacio(p.whatsapp) ? ' — falta teléfono' : ''}`)); }
if (sinUbicar.length) { L.push('', 'Sin ubicar en el mapa (usá http://localhost:8080/ubicar):'); sinUbicar.slice(0, 10).forEach((p) => L.push(`  · ${p.name}`)); }
L.push('', 'Para completar datos: npm run datos');
const texto = L.join('\n');
console.log(texto);
await writeFile(new URL('salud.txt', root), texto + '\n');
console.log('\nGuardé una copia en salud.txt');
