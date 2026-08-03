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
    featured: true
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
    featured: true
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
    featured: true
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
    deliveryFee: 0
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
    deliveryFee: 0
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
    category: 'Tacos',
    prepTime: 8,
    available: true,
    variants: [{ name: 'Tortilla', options: ['Maíz', 'Harina'] }],
    extras: [
      { name: 'Queso extra', price: 15 },
      { name: 'Aguacate extra', price: 12 }
    ]
  },
  {
    id: 'prod_1_2',
    restaurantId: 'rest_1',
    name: 'Gringa de Pastor',
    description: 'Tortilla de harina grande con carne al pastor, queso derretido y piña.',
    price: 55,
    image: 'https://images.unsplash.com/photo-1624462966581-bc6d768cbce5?auto=format&fit=crop&q=80&w=300',
    category: 'Tacos',
    prepTime: 10,
    available: true,
    extras: [{ name: 'Guacamole', price: 15 }]
  },
  {
    id: 'prod_1_3',
    restaurantId: 'rest_1',
    name: 'Volcán de Bistec',
    description: 'Tortilla tostada al carbón con queso fundido y carne de bistec.',
    price: 35,
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=300',
    category: 'Tacos',
    prepTime: 8,
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
    extras: [{ name: 'Orilla de queso', price: 40 }]
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
    extras: [{ name: 'Queso crema extra', price: 15 }, { name: 'Salsa Tampico', price: 20 }]
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
    extras: [{ name: 'Papas fritas extra', price: 30 }, { name: 'Huevo estrellado', price: 15 }]
  }
];

const defaultDrivers: Driver[] = [
  {
    id: 'driver_1',
    name: 'Carlos Mendoza',
    phone: '55-7777-8888',
    email: 'carlos.mendoza@mesa22.com',
    photo: '/driver-silhouette.jpg',
    vehicle: 'Motorcycle',
    licenseNumber: 'MX-98234-A',
    workingZone: 'Zona Centro y Norte',
    status: 'AVAILABLE',
    rating: 4.9
  },
  {
    id: 'driver_2',
    name: 'Lucía Fernández',
    phone: '55-1111-2222',
    email: 'lucia.f@mesa22.com',
    photo: '/driver-silhouette.jpg',
    vehicle: 'Bicycle',
    workingZone: 'Polanco y Reforma',
    status: 'AVAILABLE',
    rating: 4.8
  },
  {
    id: 'driver_3',
    name: 'Mario Robles',
    phone: '55-4444-9999',
    email: 'mario.robles@mesa22.com',
    photo: '/driver-silhouette.jpg',
    vehicle: 'Car',
    licenseNumber: 'MX-45672-B',
    workingZone: 'Zona Poniente',
    status: 'AVAILABLE',
    rating: 4.7
  }
];

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
