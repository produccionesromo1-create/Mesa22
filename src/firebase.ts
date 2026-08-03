import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection as firestoreCollection, 
  getDocs as firestoreGetDocs, 
  getDoc as firestoreGetDoc,
  setDoc as firestoreSetDoc, 
  doc as firestoreDoc, 
  query as firestoreQuery, 
  where as firestoreWhere,
  addDoc as firestoreAddDoc,
  updateDoc as firestoreUpdateDoc,
  deleteDoc as firestoreDeleteDoc,
  onSnapshot as firestoreOnSnapshot,
  limit as firestoreLimit,
  orderBy as firestoreOrderBy,
  deleteField as firestoreDeleteField
} from 'firebase/firestore';
export const deleteField = firestoreDeleteField;
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Restaurant, Product, Driver, Ingredient, Supplier, City } from './types';
import { 
  localGetDocs, 
  localGetDoc, 
  localAddDoc, 
  localSetDoc, 
  localUpdateDoc, 
  localDeleteDoc 
} from './localDb';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = (firebaseConfig as any).firestoreDatabaseId 
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

// Global Quota Tracker State
let globalQuotaExceeded = false;

export function setGlobalQuotaExceeded(val: boolean) {
  globalQuotaExceeded = val;
  if (typeof window !== 'undefined') {
    localStorage.setItem('m22_quota_exceeded', val ? 'true' : 'false');
    // Dispatch a custom event to notify components of the state change
    window.dispatchEvent(new Event('m22_quota_state_changed'));
  }
}

export function isGlobalQuotaExceeded(): boolean {
  if (globalQuotaExceeded) return true;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('m22_quota_exceeded') === 'true';
  }
  return false;
}

// Check if error is due to Firebase Firestore Quota Limit, connectivity issues, or unavailable status
function isQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || err.toString() || '').toLowerCase();
  const code = err.code || '';
  return (
    code === 'resource-exhausted' ||
    code === 'unavailable' ||
    msg.includes('quota') ||
    msg.includes('limit exceeded') ||
    msg.includes('exhausted') ||
    msg.includes('unavailable') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('connection failed') ||
    msg.includes('permission-denied') // Sometimes custom security rules or exhausted status block it as permission-denied
  );
}

// --- MOCK SNAPSHOT COMPATIBILITY LAYERS ---

class MockQuerySnapshot {
  constructor(private rawItems: any[]) {}
  get empty() {
    return this.rawItems.length === 0;
  }
  get size() {
    return this.rawItems.length;
  }
  get docs() {
    return this.rawItems.map(item => new MockQueryDocumentSnapshot(item));
  }
  forEach(callback: (doc: any) => void) {
    this.docs.forEach(callback);
  }
}

class MockQueryDocumentSnapshot {
  constructor(private item: any) {}
  get id() {
    return this.item.id;
  }
  data() {
    const { id, ...data } = this.item;
    return data;
  }
  exists() {
    return true;
  }
}

class MockDocumentSnapshot {
  constructor(private item: any | null) {}
  exists() {
    return this.item !== null && this.item !== undefined;
  }
  get id() {
    return this.item ? this.item.id : '';
  }
  data() {
    if (!this.item) return undefined;
    const { id, ...data } = this.item;
    return data;
  }
}

// Execute query on local database
function runLocalGetDocs(q: any): MockQuerySnapshot {
  const colPath = q.collectionPath || q.path || '';
  const filters = q.filters || [];
  const limitVal = q.limitVal;
  const orderBys = q.orderBys;

  const items = localGetDocs(colPath, filters, limitVal, orderBys);
  return new MockQuerySnapshot(items);
}

// Subscription event listeners for local real-time sync
type ListenerCallback = (snap: any) => void;
const localListeners = new Set<{
  colPath: string;
  isDoc: boolean;
  docId?: string;
  queryRef: any;
  callback: ListenerCallback;
}>();

function triggerLocalListeners(colPath: string) {
  localListeners.forEach((listener) => {
    if (listener.colPath === colPath) {
      if (listener.isDoc && listener.docId) {
        const item = localGetDoc(colPath, listener.docId);
        listener.callback(new MockDocumentSnapshot(item));
      } else {
        const snap = runLocalGetDocs(listener.queryRef);
        listener.callback(snap);
      }
    }
  });
}

// --- WRAPPED FIREBASE FIRESTORE FUNCTIONS ---

export function collection(dbRef: any, path: string): any {
  return {
    type: 'collection',
    path,
    collectionPath: path,
    realRef: firestoreCollection(dbRef, path)
  };
}

export function doc(first: any, second?: any, ...more: any[]): any {
  let segments: string[] = [];
  let realRef: any;

  if (typeof first === 'object' && (first.type === 'collection' || first.type === 'doc')) {
    segments = [first.path, second, ...more].filter(s => typeof s === 'string');
    realRef = firestoreDoc(first.realRef, second, ...more);
  } else {
    segments = [second, ...more].filter(s => typeof s === 'string');
    realRef = firestoreDoc(first, second, ...more);
  }

  const fullPath = segments.join('/');
  const lastSlashIndex = fullPath.lastIndexOf('/');
  const docId = lastSlashIndex !== -1 ? fullPath.substring(lastSlashIndex + 1) : fullPath;
  const collectionPath = lastSlashIndex !== -1 ? fullPath.substring(0, lastSlashIndex) : '';

  return {
    type: 'doc',
    path: fullPath,
    id: docId,
    collectionPath,
    realRef
  };
}

export function query(colRef: any, ...constraints: any[]): any {
  const realConstraints = constraints.map(c => c.real).filter(Boolean);
  return {
    type: 'query',
    path: colRef.path,
    collectionPath: colRef.collectionPath,
    realRef: firestoreQuery(colRef.realRef, ...realConstraints),
    filters: constraints.filter(c => c.type === 'where'),
    limitVal: constraints.find(c => c.type === 'limit')?.val,
    orderBys: constraints.filter(c => c.type === 'orderBy')
  };
}

export function where(field: string, op: any, val: any): any {
  return {
    type: 'where',
    field,
    op,
    val,
    real: firestoreWhere(field, op, val)
  };
}

export function limit(val: number): any {
  return {
    type: 'limit',
    val,
    real: firestoreLimit(val)
  };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): any {
  return {
    type: 'orderBy',
    field,
    dir,
    real: firestoreOrderBy(field, dir)
  };
}

export async function getDocs(q: any): Promise<any> {
  if (isGlobalQuotaExceeded()) {
    return runLocalGetDocs(q);
  }

  try {
    const realRef = q.realRef !== undefined ? q.realRef : q;
    const snap = await firestoreGetDocs(realRef);
    return snap;
  } catch (err: any) {
    console.warn('getDocs failed, evaluating local fallback:', err);
    if (isQuotaError(err)) {
      setGlobalQuotaExceeded(true);
      return runLocalGetDocs(q);
    }
    throw err;
  }
}

export async function getDoc(docRef: any): Promise<any> {
  const colPath = docRef.collectionPath;
  const docId = docRef.id;

  if (isGlobalQuotaExceeded()) {
    const item = localGetDoc(colPath, docId);
    return new MockDocumentSnapshot(item);
  }

  try {
    const realRef = docRef.realRef !== undefined ? docRef.realRef : docRef;
    const snap = await firestoreGetDoc(realRef);
    return snap;
  } catch (err: any) {
    console.warn('getDoc failed, evaluating local fallback:', err);
    if (isQuotaError(err)) {
      setGlobalQuotaExceeded(true);
      const item = localGetDoc(colPath, docId);
      return new MockDocumentSnapshot(item);
    }
    throw err;
  }
}

export async function addDoc(colRef: any, data: any): Promise<any> {
  const colPath = colRef.collectionPath || colRef.path || '';
  if (isGlobalQuotaExceeded()) {
    const newId = localAddDoc(colPath, data);
    triggerLocalListeners(colPath);
    return { id: newId };
  }

  try {
    const realRef = colRef.realRef !== undefined ? colRef.realRef : colRef;
    const docRef = await firestoreAddDoc(realRef, data);
    localSetDoc(colPath, docRef.id, { id: docRef.id, ...data });
    return docRef;
  } catch (err: any) {
    console.warn('addDoc failed, evaluating local fallback:', err);
    if (isQuotaError(err)) {
      setGlobalQuotaExceeded(true);
      const newId = localAddDoc(colPath, data);
      triggerLocalListeners(colPath);
      return { id: newId };
    }
    throw err;
  }
}

export async function setDoc(docRef: any, data: any, options?: any): Promise<any> {
  const colPath = docRef.collectionPath;
  const docId = docRef.id;

  if (isGlobalQuotaExceeded()) {
    localSetDoc(colPath, docId, data);
    triggerLocalListeners(colPath);
    return;
  }

  try {
    const realRef = docRef.realRef !== undefined ? docRef.realRef : docRef;
    await firestoreSetDoc(realRef, data, options);
    if (options?.merge) {
      localUpdateDoc(colPath, docId, data);
    } else {
      localSetDoc(colPath, docId, data);
    }
  } catch (err: any) {
    console.warn('setDoc failed, evaluating local fallback:', err);
    if (isQuotaError(err)) {
      setGlobalQuotaExceeded(true);
      localSetDoc(colPath, docId, data);
      triggerLocalListeners(colPath);
      return;
    }
    throw err;
  }
}

export async function updateDoc(docRef: any, data: any): Promise<any> {
  const colPath = docRef.collectionPath;
  const docId = docRef.id;

  if (isGlobalQuotaExceeded()) {
    localUpdateDoc(colPath, docId, data);
    triggerLocalListeners(colPath);
    return;
  }

  try {
    const realRef = docRef.realRef !== undefined ? docRef.realRef : docRef;
    await firestoreUpdateDoc(realRef, data);
    localUpdateDoc(colPath, docId, data);
  } catch (err: any) {
    console.warn('updateDoc failed, evaluating local fallback:', err);
    if (isQuotaError(err)) {
      setGlobalQuotaExceeded(true);
      localUpdateDoc(colPath, docId, data);
      triggerLocalListeners(colPath);
      return;
    }
    throw err;
  }
}

export async function deleteDoc(docRef: any): Promise<any> {
  const colPath = docRef.collectionPath;
  const docId = docRef.id;

  if (isGlobalQuotaExceeded()) {
    localDeleteDoc(colPath, docId);
    triggerLocalListeners(colPath);
    return;
  }

  try {
    const realRef = docRef.realRef !== undefined ? docRef.realRef : docRef;
    await firestoreDeleteDoc(realRef);
    // Sync deletion to local storage so fallback and cache don't retain deleted docs
    localDeleteDoc(colPath, docId);
    triggerLocalListeners(colPath);
  } catch (err: any) {
    console.warn('deleteDoc failed, evaluating local fallback:', err);
    if (isQuotaError(err)) {
      setGlobalQuotaExceeded(true);
      localDeleteDoc(colPath, docId);
      triggerLocalListeners(colPath);
      return;
    }
    throw err;
  }
}

export function onSnapshot(
  ref: any,
  onNext: (snap: any) => void,
  onError?: (err: any) => void
): () => void {
  const isDoc = ref.type === 'doc';
  const colPath = ref.collectionPath;
  const docId = ref.id;

  if (isGlobalQuotaExceeded()) {
    const listenerObj = {
      colPath,
      isDoc,
      docId,
      queryRef: ref,
      callback: onNext
    };
    localListeners.add(listenerObj);

    // Initial load
    if (isDoc && docId) {
      const item = localGetDoc(colPath, docId);
      onNext(new MockDocumentSnapshot(item));
    } else {
      const snap = runLocalGetDocs(ref);
      onNext(snap);
    }

    return () => {
      localListeners.delete(listenerObj);
    };
  }

  try {
    const realRef = ref.realRef !== undefined ? ref.realRef : ref;
    const unsub = firestoreOnSnapshot(
      realRef,
      (snap) => {
        onNext(snap);
      },
      (err) => {
        console.warn('onSnapshot failed, evaluating local fallback:', err);
        if (isQuotaError(err)) {
          setGlobalQuotaExceeded(true);
          // Recursively switch to local listener
          onSnapshot(ref, onNext, onError);
        } else if (onError) {
          onError(err);
        }
      }
    );
    return unsub;
  } catch (err: any) {
    if (isQuotaError(err)) {
      setGlobalQuotaExceeded(true);
      return onSnapshot(ref, onNext, onError);
    }
    if (onError) onError(err);
    return () => {};
  }
}

// Seed initial mock data if the database is empty (or check quota)
export async function seedDatabase() {
  if (isGlobalQuotaExceeded()) {
    console.log('Skipping Firestore seeding because we are in local fallback mode.');
    return;
  }

  try {
    // Check if the system has already completed initial seeding
    const seedFlagSnap = await firestoreGetDoc(firestoreDoc(db, 'system', 'seedInfo'));
    if (seedFlagSnap.exists() || localStorage.getItem('m22_database_seeded_flag') === 'true') {
      console.log('Database was already initialized previously. Skipping auto-seed.');
      return;
    }

    const restaurantsSnapshot = await firestoreGetDocs(firestoreCollection(db, 'restaurants'));
    if (restaurantsSnapshot.empty) {
      console.log('Seeding initial data into Firestore...');

      // 1. Initial Restaurants
      const sampleRestaurants: Restaurant[] = localGetDocs('restaurants');
      for (const rest of sampleRestaurants) {
        await firestoreSetDoc(firestoreDoc(db, 'restaurants', rest.id), rest);
      }

      // 2. Initial Menu Items (Products)
      const sampleProducts: Product[] = localGetDocs('products');
      for (const prod of sampleProducts) {
        await firestoreSetDoc(firestoreDoc(db, 'products', prod.id), prod);
      }

      // 3. Initial Drivers
      const sampleDrivers: Driver[] = localGetDocs('drivers');
      for (const d of sampleDrivers) {
        await firestoreSetDoc(firestoreDoc(db, 'drivers', d.id), d);
      }

      // 4. Seeding sample ingredients and suppliers for rest_1
      const sampleIngredients: Ingredient[] = localGetDocs('ingredients');
      for (const ing of sampleIngredients) {
        await firestoreSetDoc(firestoreDoc(db, 'ingredients', ing.id), ing);
      }

      // 5. Initial Cities
      const sampleCities: City[] = localGetDocs('cities');
      for (const c of sampleCities) {
        await firestoreSetDoc(firestoreDoc(db, 'cities', c.id), c);
      }
      
      // Mark seeding as completed
      await firestoreSetDoc(firestoreDoc(db, 'system', 'seedInfo'), { seeded: true, timestamp: Date.now() });
      localStorage.setItem('m22_database_seeded_flag', 'true');
      console.log('Seeding completed successfully!');
    } else {
      // Database already has restaurants, mark seedInfo so future total deletions won't trigger re-seeding
      await firestoreSetDoc(firestoreDoc(db, 'system', 'seedInfo'), { seeded: true, timestamp: Date.now() });
      localStorage.setItem('m22_database_seeded_flag', 'true');
    }
  } catch (error: any) {
    console.warn('Error seeding database: ', error);
    if (isQuotaError(error)) {
      setGlobalQuotaExceeded(true);
    }
  }
}
