// Tipos de lugar: cada uno con su nombre, su categoría y su ícono de Google (Material Symbols).
// Puro (sin DOM ni three): lo usan la web y las herramientas (npm run lugares).
//
//   TYPES[tipo] = { label, cat, mi }   mi = nombre del ícono en https://fonts.google.com/icons
//   classify(tags de OpenStreetMap) → tipo (o null si no interesa)

export const TYPES = {
  // Comer
  restaurante: { label: 'Restaurante', cat: 'comer', mi: 'restaurant' },
  parrilla: { label: 'Parrilla', cat: 'comer', mi: 'outdoor_grill' },
  pizzeria: { label: 'Pizzería', cat: 'comer', mi: 'local_pizza' },
  cafe: { label: 'Café', cat: 'comer', mi: 'local_cafe' },
  bar: { label: 'Bar', cat: 'comer', mi: 'local_bar' },
  comida_rapida: { label: 'Comida al paso', cat: 'comer', mi: 'fastfood' },
  heladeria: { label: 'Heladería', cat: 'comer', mi: 'icecream' },
  panaderia: { label: 'Panadería', cat: 'comer', mi: 'bakery_dining' },
  carniceria: { label: 'Carnicería', cat: 'comer', mi: 'kebab_dining' },
  verduleria: { label: 'Verdulería', cat: 'comer', mi: 'nutrition' },
  // Dormir
  hotel: { label: 'Hotel', cat: 'dormir', mi: 'hotel' },
  hospedaje: { label: 'Hospedaje', cat: 'dormir', mi: 'bed' },
  camping: { label: 'Camping', cat: 'dormir', mi: 'camping' },
  // Qué ver
  iglesia: { label: 'Iglesia', cat: 'ver', mi: 'church' },
  museo: { label: 'Museo', cat: 'ver', mi: 'museum' },
  cultura: { label: 'Cultura', cat: 'ver', mi: 'theater_comedy' },
  biblioteca: { label: 'Biblioteca', cat: 'ver', mi: 'local_library' },
  plaza: { label: 'Plaza', cat: 'ver', mi: 'park' },
  monumento: { label: 'Monumento', cat: 'ver', mi: 'flag' },
  estacion: { label: 'Estación de tren', cat: 'ver', mi: 'train' },
  mirador: { label: 'Mirador', cat: 'ver', mi: 'landscape' },
  atractivo: { label: 'Atractivo', cat: 'ver', mi: 'attractions' },
  club: { label: 'Club', cat: 'ver', mi: 'sports_soccer' },
  gimnasio: { label: 'Gimnasio', cat: 'ver', mi: 'fitness_center' },
  cine: { label: 'Cine', cat: 'ver', mi: 'movie' },
  tanque: { label: 'Tanque de agua', cat: 'ver', mi: 'water_drop' },
  silo: { label: 'Silos', cat: 'ver', mi: 'agriculture' },
  // Compras
  ferreteria: { label: 'Ferretería', cat: 'compras', mi: 'hardware' },
  supermercado: { label: 'Supermercado', cat: 'compras', mi: 'shopping_cart' },
  almacen: { label: 'Almacén', cat: 'compras', mi: 'storefront' },
  kiosco: { label: 'Kiosco', cat: 'compras', mi: 'local_convenience_store' },
  ropa: { label: 'Ropa y calzado', cat: 'compras', mi: 'checkroom' },
  libreria: { label: 'Librería', cat: 'compras', mi: 'menu_book' },
  jugueteria: { label: 'Juguetería', cat: 'compras', mi: 'toys' },
  muebleria: { label: 'Mueblería', cat: 'compras', mi: 'chair' },
  electro: { label: 'Electro y tecnología', cat: 'compras', mi: 'devices' },
  celulares: { label: 'Celulares', cat: 'compras', mi: 'smartphone' },
  pinturas: { label: 'Pinturería', cat: 'compras', mi: 'format_paint' },
  materiales: { label: 'Materiales de construcción', cat: 'compras', mi: 'construction' },
  agro: { label: 'Agro y veterinaria', cat: 'compras', mi: 'grass' },
  florista: { label: 'Florería y vivero', cat: 'compras', mi: 'local_florist' },
  regaleria: { label: 'Regalería', cat: 'compras', mi: 'redeem' },
  optica: { label: 'Óptica', cat: 'compras', mi: 'visibility' },
  joyeria: { label: 'Joyería', cat: 'compras', mi: 'diamond' },
  mascotas: { label: 'Mascotas', cat: 'compras', mi: 'pets' },
  perfumeria: { label: 'Perfumería', cat: 'compras', mi: 'spa' },
  bebidas: { label: 'Bebidas', cat: 'compras', mi: 'liquor' },
  tienda: { label: 'Comercio', cat: 'compras', mi: 'shopping_bag' },
  // Salud
  hospital: { label: 'Hospital', cat: 'salud', mi: 'local_hospital' },
  clinica: { label: 'Clínica / consultorio', cat: 'salud', mi: 'medical_services' },
  farmacia: { label: 'Farmacia', cat: 'salud', mi: 'local_pharmacy' },
  dentista: { label: 'Odontología', cat: 'salud', mi: 'dentistry' },
  veterinaria: { label: 'Veterinaria', cat: 'salud', mi: 'pets' },
  // Servicios
  municipalidad: { label: 'Municipalidad', cat: 'servicios', mi: 'account_balance' },
  policia: { label: 'Policía', cat: 'servicios', mi: 'local_police' },
  bomberos: { label: 'Bomberos', cat: 'servicios', mi: 'fire_truck' },
  banco: { label: 'Banco', cat: 'servicios', mi: 'payments' },
  cajero: { label: 'Cajero automático', cat: 'servicios', mi: 'atm' },
  correo: { label: 'Correo', cat: 'servicios', mi: 'local_post_office' },
  combustible: { label: 'Estación de servicio', cat: 'servicios', mi: 'local_gas_station' },
  escuela: { label: 'Escuela', cat: 'servicios', mi: 'school' },
  jardin: { label: 'Jardín de infantes', cat: 'servicios', mi: 'child_care' },
  taller: { label: 'Taller y gomería', cat: 'servicios', mi: 'car_repair' },
  lavadero: { label: 'Lavadero', cat: 'servicios', mi: 'local_laundry_service' },
  peluqueria: { label: 'Peluquería y estética', cat: 'servicios', mi: 'content_cut' },
  inmobiliaria: { label: 'Inmobiliaria', cat: 'servicios', mi: 'real_estate_agent' },
  seguros: { label: 'Seguros', cat: 'servicios', mi: 'shield' },
  estudio: { label: 'Estudio / oficina', cat: 'servicios', mi: 'gavel' },
  cooperativa: { label: 'Cooperativa', cat: 'servicios', mi: 'handshake' },
  terminal: { label: 'Terminal de ómnibus', cat: 'servicios', mi: 'directions_bus' },
  taxi: { label: 'Taxi / remís', cat: 'servicios', mi: 'local_taxi' },
  turismo: { label: 'Turismo', cat: 'servicios', mi: 'info' },
  servicio: { label: 'Servicio', cat: 'servicios', mi: 'build' },
};

/** Tipo de edificio especial (modelo 3D) para cada tipo de lugar. */
export const LANDMARK_OF = {
  iglesia: 'iglesia', municipalidad: 'municipalidad', cultura: 'cultura', museo: 'museo', biblioteca: 'biblioteca',
  escuela: 'escuela', jardin: 'escuela', hospital: 'hospital', bomberos: 'bomberos', policia: 'policia',
  estacion: 'estacion', monumento: 'monumento', plaza: 'plaza', tanque: 'tanque', silo: 'silo',
};

const SHOP = {
  hardware: 'ferreteria', doityourself: 'ferreteria', supermarket: 'supermercado', convenience: 'kiosco', kiosk: 'kiosco',
  general: 'almacen', variety_store: 'almacen', department_store: 'almacen', bakery: 'panaderia', pastry: 'panaderia',
  butcher: 'carniceria', greengrocer: 'verduleria', farm: 'verduleria', clothes: 'ropa', shoes: 'ropa', boutique: 'ropa',
  fashion: 'ropa', bag: 'ropa', fabric: 'ropa', books: 'libreria', stationery: 'libreria', copyshop: 'libreria',
  toys: 'jugueteria', furniture: 'muebleria', bed: 'muebleria', kitchen: 'muebleria', electronics: 'electro',
  appliance: 'electro', computer: 'electro', hifi: 'electro', mobile_phone: 'celulares', telecommunication: 'celulares',
  paint: 'pinturas', trade: 'materiales', building_materials: 'materiales', doors: 'materiales', glaze: 'materiales',
  tiles: 'materiales', flooring: 'materiales', electrical: 'materiales', lighting: 'materiales', plumbing: 'materiales',
  agrarian: 'agro', farm_supplies: 'agro', garden_centre: 'florista', florist: 'florista', gift: 'regaleria',
  souvenir: 'regaleria', party: 'regaleria', optician: 'optica', jewelry: 'joyeria', watches: 'joyeria', pet: 'mascotas',
  car_parts: 'taller', tyres: 'taller', car_repair: 'taller', motorcycle: 'taller', motorcycle_repair: 'taller',
  car: 'taller', bicycle: 'taller', hairdresser: 'peluqueria', beauty: 'peluqueria', barber: 'peluqueria',
  laundry: 'lavadero', dry_cleaning: 'lavadero', chemist: 'perfumeria', cosmetics: 'perfumeria', perfumery: 'perfumeria',
  alcohol: 'bebidas', beverages: 'bebidas', wine: 'bebidas', ice_cream: 'heladeria', deli: 'almacen', confectionery: 'kiosco',
  frozen_food: 'almacen', health_food: 'almacen', medical_supply: 'clinica', tattoo: 'peluqueria', photo: 'electro',
};

const AMENITY = {
  cafe: 'cafe', bar: 'bar', pub: 'bar', biergarten: 'bar', fast_food: 'comida_rapida', ice_cream: 'heladeria', food_court: 'comida_rapida',
  pharmacy: 'farmacia', hospital: 'hospital', clinic: 'clinica', doctors: 'clinica', dentist: 'dentista', veterinary: 'veterinaria',
  bank: 'banco', atm: 'cajero', post_office: 'correo', fuel: 'combustible', police: 'policia', fire_station: 'bomberos',
  townhall: 'municipalidad', school: 'escuela', kindergarten: 'jardin', college: 'escuela', university: 'escuela', library: 'biblioteca',
  arts_centre: 'cultura', theatre: 'cultura', community_centre: 'cultura', cinema: 'cine', place_of_worship: 'iglesia',
  marketplace: 'almacen', bus_station: 'terminal', taxi: 'taxi', car_wash: 'lavadero', courthouse: 'estudio', social_facility: 'servicio',
  car_rental: 'taller', driving_school: 'servicio', language_school: 'escuela', music_school: 'escuela', nightclub: 'bar',
  public_building: 'municipalidad', coworking_space: 'estudio', events_venue: 'cultura', clinic_dental: 'dentista',
};

const OFFICE = {
  government: 'municipalidad', estate_agent: 'inmobiliaria', insurance: 'seguros', lawyer: 'estudio', accountant: 'estudio',
  notary: 'estudio', company: 'estudio', cooperative: 'cooperativa', association: 'cooperativa', ngo: 'servicio', it: 'estudio',
  financial: 'banco', tax_advisor: 'estudio', employment_agency: 'estudio', architect: 'estudio', physician: 'clinica',
};

const NAME_RULES = [
  [/municipalidad|palacio municipal|honorable concejo/i, 'municipalidad'],
  [/museo/i, 'museo'],
  [/biblioteca/i, 'biblioteca'],
  [/casa de la cultura|centro cultural/i, 'cultura'],
  [/bomberos/i, 'bomberos'],
  [/ferreter/i, 'ferreteria'],
  [/farmacia/i, 'farmacia'],
  [/parrilla/i, 'parrilla'],
  [/pizzer/i, 'pizzeria'],
  [/helader/i, 'heladeria'],
  [/panader/i, 'panaderia'],
  [/veterinaria/i, 'veterinaria'],
  [/gomer[ií]a|lubricentro|mec[aá]nic/i, 'taller'],
  [/\bhotel/i, 'hotel'],
  [/hostal|hoster[ií]a|posada|caba[ñn]as|alojamiento|residencial|\bapart|\bhostel\b|\bdepartamentos?\b|complejo tur/i, 'hospedaje'],
  [/camping/i, 'camping'],
  [/parroquia|capilla|iglesia|catedral/i, 'iglesia'],
  [/jard[ií]n (de )?infantes/i, 'jardin'],
  [/escuela|colegio|instituto|centro de educaci[oó]n|universidad/i, 'escuela'],
  [/^club\b|\bclub (atl|social|de |deportivo)/i, 'club'],
  [/^banco\b/i, 'banco'],
  [/supermercado|autoservicio|mayorista/i, 'supermercado'],
  [/carnicer/i, 'carniceria'],
  [/hospital|sala de primeros auxilios|centro de salud/i, 'hospital'],
];

/** Tipo de lugar según las etiquetas de OpenStreetMap. null = no interesa. */
export function classify(t) {
  const name = t.name || '';
  // Lo que dice el nombre manda para los edificios públicos (OSM suele etiquetarlos con otra cosa).
  if (name && !t.shop) for (const [re, type] of NAME_RULES) if (re.test(name) && !(type === 'ferreteria' && t.amenity)) return type;
  if (t.amenity === 'place_of_worship' || /^(church|chapel|cathedral)$/.test(t.building || '')) return 'iglesia';
  if (t.amenity === 'restaurant') {
    if (/pizza|pizzer/i.test(`${t.cuisine || ''} ${name}`)) return 'pizzeria';
    if (/steak|asado|parrilla|argentin/i.test(`${t.cuisine || ''} ${name}`)) return 'parrilla';
    return 'restaurante';
  }
  if (t.amenity && AMENITY[t.amenity]) return AMENITY[t.amenity];
  if (t.shop) return SHOP[t.shop] || 'tienda';
  if (t.office) return OFFICE[t.office] || 'estudio';
  if (t.craft) return 'taller';
  if (t.tourism === 'hotel' || t.tourism === 'motel') return 'hotel';
  if (/^(hostel|guest_house|apartment|chalet)$/.test(t.tourism || '')) return 'hospedaje';
  if (t.tourism === 'camp_site') return 'camping';
  if (t.tourism === 'museum') return 'museo';
  if (t.tourism === 'gallery') return 'cultura';
  if (t.tourism === 'viewpoint') return 'mirador';
  if (t.tourism === 'information') return 'turismo';
  if (/^(attraction|artwork|zoo|theme_park)$/.test(t.tourism || '')) return 'atractivo';
  if (/^(monument|memorial)$/.test(t.historic || '')) return 'monumento';
  if (t.historic) return 'atractivo';
  if (t.railway === 'station' || t.building === 'train_station') return 'estacion';
  if (t.man_made === 'water_tower') return 'tanque';
  if (t.man_made === 'silo' || t.building === 'silo') return 'silo';
  if (t.place === 'square' || (t.leisure === 'park' && /plaza/i.test(name))) return 'plaza';
  if (/^(stadium|sports_centre|pitch|golf_course|swimming_pool)$/.test(t.leisure || '')) return name ? 'club' : null;
  if (t.leisure === 'fitness_centre') return 'gimnasio';
  if (/^(park|garden|playground)$/.test(t.leisure || '')) return name ? 'plaza' : null;
  if (/^(civic|government)$/.test(t.building || '')) return 'municipalidad';
  if (/^(school)$/.test(t.building || '')) return 'escuela';
  if (/^(hospital)$/.test(t.building || '')) return 'hospital';
  return null;
}

/** Nombres de íconos de Google que usan los tipos, ordenados (para pedirlos en una sola tipografía chica). */
export const iconNames = (types = Object.keys(TYPES)) => [...new Set(types.map((k) => TYPES[k]?.mi).filter(Boolean))].sort();
