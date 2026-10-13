import { Restaurant, Product, Driver, Ingredient, City } from './types';

// Default Seed Data
const defaultRestaurants: Restaurant[] = [
  {
    id: 'rest_1',
    name: 'Tacos El Patrón',
    logo: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=200',
    address: 'Av. Revolución 123, Ciudad de México',
    phone: '55-1234-5678',
    email: 'contacto@tacoselpatron.com',
    category: 'Tacos',
    hours: '12:00 - 23:00',
    deliveryZone: 'Zona Centro y Norte',
    socials: { facebook: 'https://facebook.com/tacoselpatron', instagram: 'https://instagram.com/tacoselpatron' },
    status: 'APPROVED',
    plan: 'PREMIUM',
    rating: 4.8,
    reviewsCount: 154,
    deliveryTime: '20-30 min',
    deliveryFee: 0,
    featured: true,
    customCategories: ['Tacos Tradicionales', 'Especialidades al Pastor', 'Bebidas y Aguas Frescas', 'Postres']
  },
  {
    id: 'rest_2',
    name: 'Bella Italia Pizzas',
    logo: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=200',
    address: 'Calle Roma 456, Guadalajara',
    phone: '33-9876-5432',
    email: 'admin@bellaitalia.com',
    category: 'Pizza',
    hours: '13:00 - 22:30',
    deliveryZone: 'Zona Poniente',
    socials: { instagram: 'https://instagram.com/bellaitaliapizza' },
    status: 'APPROVED',
    plan: 'ENTERPRISE',
    rating: 4.6,
    reviewsCount: 98,
    deliveryTime: '30-45 min',
    deliveryFee: 0,
    featured: true,
    customCategories: ['Pizzas Clásicas', 'Pizzas Especiales', 'Pastas', 'Bebidas']
  },
  {
    id: 'rest_3',
    name: 'Sushi Zen Master',
    logo: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=200',
    address: 'Paseo de la Reforma 789, Ciudad de México',
    phone: '55-5555-4444',
    email: 'contacto@sushizen.com',
    category: 'Sushi',
    hours: '13:00 - 22:00',
    deliveryZone: 'Polanco y Reforma',
    socials: { facebook: 'https://facebook.com/sushizen' },
    status: 'APPROVED',
    plan: 'BASIC',
    rating: 4.9,
    reviewsCount: 210,
    deliveryTime: '25-40 min',
    deliveryFee: 0,
    featured: true,
    customCategories: ['Rolls Tradicionales', 'Rolls Especiales', 'Entradas Japonesas', 'Bebidas']
  },
  {
    id: 'rest_4',
    name: 'Burgers & Shakes 22',
    logo: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=200',
    address: 'Blvd. de los Héroes 22, Monterrey',
    phone: '81-2222-3333',
    email: 'contacto@burgers22.com',
    category: 'Hamburguesas',
    hours: '11:00 - 23:00',
    deliveryZone: 'Toda la ciudad',
    socials: { instagram: 'https://instagram.com/burgersandshakes22' },
    status: 'APPROVED',
    plan: 'PREMIUM',
    rating: 4.7,
    reviewsCount: 85,
    deliveryTime: '15-25 min',
    deliveryFee: 0,
    customCategories: ['Hamburguesas Gigantes', 'Snacks y Acompañamientos', 'Malteadas y Bebidas']
  },
  {
    id: 'rest_5',
    name: 'Cafetería El Grano de Oro',
    logo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=200',
    address: 'Av. Juarez 505, Puebla',
    phone: '222-345-6789',
    email: 'puebla@granodeoro.com',
    category: 'Cafeterías',
    hours: '08:00 - 20:00',
    deliveryZone: 'Zona Histórica',
    socials: {},
    status: 'PENDING',
    plan: 'BASIC',
    rating: 4.5,
    reviewsCount: 12,
    deliveryTime: '15-30 min',
    deliveryFee: 0,
    customCategories: ['Café Caliente', 'Bebidas Frías', 'Repostería y Panadería']
  }
];

const defaultProducts: Product[] = [
  {
    id: 'prod_1_1',
    restaurantId: 'rest_1',
    name: 'Orden de Tacos al Pastor',
    description: '5 deliciosos tacos con piña, cilantro, cebolla y salsa de la casa.',
    price: 75,
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&q=80&w=300',
    category: 'Tacos Tradicionales',
    prepTime: 8,
    available: true,
    variants: [{ name: 'Tortilla', options: ['Maíz', 'Harina'] }],
    extras: [
      { id: 'mod_1_1', name: 'Queso extra', price: 15, available: true },
      { id: 'mod_1_2', name: 'Aguacate extra', price: 12, available: true },
      { id: 'mod_1_3', name: 'Sin cebolla (Sin costo)', price: 0, available: true },
      { id: 'mod_1_4', name: 'Salsa habanera extra', price: 5, available: false }
    ]
  },
  {
    id: 'prod_1_2',
    restaurantId: 'rest_1',
    name: 'Gringa de Pastor',
    description: 'Tortilla de harina grande con carne al pastor, queso derretido y piña.',
    price: 55,
    image: 'https://images.unsplash.com/photo-1624462966581-bc6d768cbce5?auto=format&fit=crop&q=80&w=300',
    category: 'Especialidades al Pastor',
    prepTime: 10,
    available: true,
    extras: [{ id: 'mod_g1', name: 'Guacamole', price: 15, available: true }]
  },
  {
    id: 'prod_1_3',
    restaurantId: 'rest_1',
    name: 'Volcán de Bistec',
    description: 'Tortilla tostada al carbón con queso fundido y carne de bistec.',
    price: 35,
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=300',
    category: 'Especialidades al Pastor',
    prepTime: 8,
    available: true
  },
  {
    id: 'prod_1_4',
    restaurantId: 'rest_1',
    name: 'Agua Fresca de Horchata (1L)',
    description: 'Receta tradicional con canela fresca, leche y arroz aromatizado.',
    price: 35,
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=300',
    category: 'Bebidas y Aguas Frescas',
    prepTime: 3,
    available: true,
    extras: [{ id: 'mod_w1', name: 'Hielo extra (Sin costo)', price: 0, available: true }]
  },
  {
    id: 'prod_1_5',
    restaurantId: 'rest_1',
    name: 'Flan Casero Napolitano',
    description: 'Receta clásica de la abuela con caramelo dorado y queso crema.',
    price: 45,
    image: 'https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?auto=format&fit=crop&q=80&w=300',
    category: 'Postres',
    prepTime: 2,
    available: true
  },
  {
    id: 'prod_2_1',
    restaurantId: 'rest_2',
    name: 'Pizza Pepperoni Clásica',
    description: 'Salsa de tomate italiana, queso mozzarella fresco y abundante pepperoni.',
    price: 180,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=300',
    category: 'Pizza',
    prepTime: 15,
    available: true,
    variants: [{ name: 'Tamaño', options: ['Mediana', 'Familiar'] }]
  },
  {
    id: 'prod_2_2',
    restaurantId: 'rest_2',
    name: 'Pizza Margherita Especial',
    description: 'Tomate cherry, mozzarella de búfala, albahaca fresca y aceite de oliva virgen extra.',
    price: 195,
    image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&q=80&w=300',
    category: 'Pizza',
    prepTime: 12,
    available: true,
    extras: [{ id: 'mod_p2_1', name: 'Orilla de queso', price: 40, available: true }]
  },
  {
    id: 'prod_3_1',
    restaurantId: 'rest_3',
    name: 'Roll Filadelfia Clásico',
    description: 'Salmón, queso crema y aguacate, cubierto de ajonjolí.',
    price: 120,
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=300',
    category: 'Sushi',
    prepTime: 12,
    available: true,
    extras: [
      { id: 'mod_s3_1', name: 'Queso crema extra', price: 15, available: true },
      { id: 'mod_s3_2', name: 'Salsa Tampico', price: 20, available: true }
    ]
  },
  {
    id: 'prod_3_2',
    restaurantId: 'rest_3',
    name: 'Dragon Roll',
    description: 'Camarón empanizado y queso crema por dentro, aguacate y anguila por fuera.',
    price: 165,
    image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&q=80&w=300',
    category: 'Sushi',
    prepTime: 15,
    available: true
  },
  {
    id: 'prod_4_1',
    restaurantId: 'rest_4',
    name: 'Hamburguesa Triple Mesa 22',
    description: 'Tres carnes de res premium (150g c/u), queso cheddar, tocino ahumado, cebolla caramelizada y aderezo especial.',
    price: 155,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=300',
    category: 'Hamburguesas',
    prepTime: 12,
    available: true,
    variants: [{ name: 'Término', options: ['Medio', 'Tres Cuartos', 'Bien Cocido'] }],
    extras: [
      { id: 'mod_h4_1', name: 'Papas fritas extra', price: 30, available: true },
      { id: 'mod_h4_2', name: 'Huevo estrellado', price: 15, available: true },
      { id: 'mod_h4_3', name: 'Sin aderezo', price: 0, available: true }
    ]
  }
];

const defaultDrivers: Driver[] = [];

const defaultCities: City[] = [
  { id: 'city_cdmx', name: 'Ciudad de México', createdAt: Date.now() },
  { id: 'city_gdl', name: 'Guadalajara', createdAt: Date.now() },
  { id: 'city_mty', name: 'Monterrey', createdAt: Date.now() },
  { id: 'city_puebla', name: 'Puebla', createdAt: Date.now() }
];

const defaultIngredients: Ingredient[] = [
  { id: 'ing_1_1', restaurantId: 'rest_1', name: 'Carne al Pastor', stock: 25, minStock: 5, unit: 'kg' },
  { id: 'ing_1_2', restaurantId: 'rest_1', name: 'Tortillas de Maíz', stock: 1200, minStock: 300, unit: 'pz' },
  { id: 'ing_1_3', restaurantId: 'rest_1', name: 'Piña Fresca', stock: 8, minStock: 2, unit: 'pz' },
  { id: 'ing_1_4', restaurantId: 'rest_1', name: 'Cilantro', stock: 4, minStock: 1, unit: 'kg' },
  { id: 'ing_1_5', restaurantId: 'rest_1', name: 'Queso Asadero', stock: 12, minStock: 3, unit: 'kg' }
];

// Helper to initialize local storage
function initLocalStorage() {
  const checkAndSet = (key: string, defaultVal: any) => {
    if (!localStorage.getItem(`m22_db_${key}`)) {
      localStorage.setItem(`m22_db_${key}`, JSON.stringify(defaultVal));
    }
  };

  checkAndSet('restaurants', defaultRestaurants);
  checkAndSet('products', defaultProducts);
  checkAndSet('drivers', defaultDrivers);
  checkAndSet('cities', defaultCities);
  checkAndSet('ingredients', defaultIngredients);
  checkAndSet('orders', []);
  checkAndSet('suppliers', []);
  checkAndSet('cashSessions', []);
  checkAndSet('employees', []);
  checkAndSet('purchases', []);
  checkAndSet('settings', { ads: { imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=800', intervalSeconds: 10, enabled: true } });
}

// Initialize on first import
if (typeof window !== 'undefined') {
  initLocalStorage();
}

export function getLocalCollection(colName: string): any[] {
  if (colName.includes('settings')) {
    const key = `m22_db_settings`;
    try {
      const stored = localStorage.getItem(key);
      const settingsObj = stored ? JSON.parse(stored) : {};
      if (colName === 'settings/ads') {
        return settingsObj.ads ? [settingsObj.ads] : [];
      }
      if (colName === 'settings/ads/chunks') {
        const chunks = settingsObj.chunks || {};
        return Object.keys(chunks).map(chunkId => ({
          id: chunkId,
          data: chunks[chunkId]
        }));
      }
      return [settingsObj];
    } catch {
      return [{}];
    }
  }

  const cleanName = colName.split('/')[0];
  const key = `m22_db_${cleanName}`;
  const dataStr = localStorage.getItem(key);
  if (!dataStr) return [];
  try {
    return JSON.parse(dataStr);
  } catch {
    return [];
  }
}

export function saveLocalCollection(colName: string, items: any[]) {
  const cleanName = colName.split('/')[0];
  const key = `m22_db_${cleanName}`;
  localStorage.setItem(key, JSON.stringify(items));
}

export function localGetDocs(
  colPath: string, 
  filters?: { field: string; op: string; val: any }[], 
  limitVal?: number, 
  orderBys?: { field: string; dir: string }[]
): any[] {
  let items = getLocalCollection(colPath);

  // Apply filters
  if (filters && filters.length > 0) {
    items = items.filter((item) => {
      return filters.every(({ field, op, val }) => {
        const itemVal = item[field];
        if (op === '==' || op === 'equal') return itemVal === val;
        if (op === '!=' || op === 'not-equal') return itemVal !== val;
        if (op === '>') return itemVal > val;
        if (op === '>=') return itemVal >= val;
        if (op === '<') return itemVal < val;
        if (op === '<=') return itemVal <= val;
        if (op === 'array-contains') return Array.isArray(itemVal) && itemVal.includes(val);
        if (op === 'in') return Array.isArray(val) && val.includes(itemVal);
        return true;
      });
    });
  }

  // Apply orderBys
  if (orderBys && orderBys.length > 0) {
    items.sort((a, b) => {
      for (const { field, dir } of orderBys) {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal !== bVal) {
          if (dir === 'desc') {
            return aVal > bVal ? -1 : 1;
          } else {
            return aVal < bVal ? -1 : 1;
          }
        }
      }
      return 0;
    });
  }

  // Apply limit
  if (limitVal !== undefined && limitVal !== null) {
    items = items.slice(0, limitVal);
  }

  return items;
}

export function localGetDoc(colPath: string, docId: string): any | null {
  if (colPath === 'settings/ads/chunks') {
    const key = `m22_db_settings`;
    try {
      const stored = localStorage.getItem(key);
      const settingsObj = stored ? JSON.parse(stored) : {};
      const chunkData = settingsObj.chunks?.[docId];
      if (chunkData !== undefined) {
        return { id: docId, data: chunkData };
      }
    } catch {}
    return null;
  }

  // Handle settings specifically
  if (colPath === 'settings' && docId === 'ads') {
    const key = `m22_db_settings`;
    try {
      const stored = localStorage.getItem(key);
      const settingsObj = stored ? JSON.parse(stored) : {};
      return settingsObj.ads || { imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=800', intervalSeconds: 10, enabled: true };
    } catch {
      return { imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=800', intervalSeconds: 10, enabled: true };
    }
  }

  const items = getLocalCollection(colPath);
  const matched = items.find(item => item.id === docId);
  if (matched) return matched;
  return null;
}

export function localAddDoc(colPath: string, data: any): string {
  const items = getLocalCollection(colPath);
  const newId = `${colPath.slice(0, 4)}_${Math.random().toString(36).substr(2, 9)}`;
  const newItem = { id: newId, ...data };
  items.push(newItem);
  saveLocalCollection(colPath, items);
  return newId;
}

export function localSetDoc(colPath: string, docId: string, data: any) {
  if (colPath === 'settings/ads/chunks') {
    const key = `m22_db_settings`;
    try {
      const stored = localStorage.getItem(key);
      const settingsObj = stored ? JSON.parse(stored) : {};
      if (!settingsObj.chunks) {
        settingsObj.chunks = {};
      }
      settingsObj.chunks[docId] = data.data !== undefined ? data.data : data;
      localStorage.setItem(key, JSON.stringify(settingsObj));
    } catch {}
    return;
  }

  if (colPath === 'settings' && docId === 'ads') {
    const key = `m22_db_settings`;
    try {
      const stored = localStorage.getItem(key);
      const settingsObj = stored ? JSON.parse(stored) : {};
      settingsObj.ads = { id: docId, ...data };
      localStorage.setItem(key, JSON.stringify(settingsObj));
    } catch {}
    return;
  }

  const items = getLocalCollection(colPath);
  const index = items.findIndex(item => item.id === docId);
  const newItem = { id: docId, ...data };
  if (index >= 0) {
    items[index] = newItem;
  } else {
    items.push(newItem);
  }
  saveLocalCollection(colPath, items);
}

export function localUpdateDoc(colPath: string, docId: string, data: any) {
  if (colPath === 'settings/ads/chunks') {
    const key = `m22_db_settings`;
    try {
      const stored = localStorage.getItem(key);
      const settingsObj = stored ? JSON.parse(stored) : {};
      if (!settingsObj.chunks) {
        settingsObj.chunks = {};
      }
      settingsObj.chunks[docId] = { ...(settingsObj.chunks[docId] || {}), ...data };
      localStorage.setItem(key, JSON.stringify(settingsObj));
    } catch {}
    return;
  }

  if (colPath === 'settings' && docId === 'ads') {
    const key = `m22_db_settings`;
    try {
      const stored = localStorage.getItem(key);
      const settingsObj = stored ? JSON.parse(stored) : {};
      settingsObj.ads = { ...(settingsObj.ads || {}), ...data };
      localStorage.setItem(key, JSON.stringify(settingsObj));
    } catch {}
    return;
  }

  const items = getLocalCollection(colPath);
  const index = items.findIndex(item => item.id === docId);
  if (index >= 0) {
    const updated = { ...items[index] };
    Object.keys(data).forEach(k => {
      const val = data[k];
      if (val === null || (val && typeof val === 'object' && (val._methodName === 'deleteField' || val.constructor?.name === 'FieldValue'))) {
        delete updated[k];
      } else {
        updated[k] = val;
      }
    });
    items[index] = updated;
    saveLocalCollection(colPath, items);
  }
}

export function localDeleteDoc(colPath: string, docId: string) {
  const items = getLocalCollection(colPath);
  const filtered = items.filter(item => item.id !== docId);
  saveLocalCollection(colPath, filtered);
}
