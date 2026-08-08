import { useState, useEffect } from 'react';
import { 
  db,
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  getDoc,
  setDoc,
  addDoc,
  where
} from '../firebase';
import { Restaurant, Driver, Order, City } from '../types';
import Logo from './Logo';
import { 
  LayoutDashboard, 
  Store, 
  Truck, 
  ShoppingBag, 
  DollarSign, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Award,
  CreditCard,
  Layers,
  MapPin,
  Megaphone,
  Upload,
  Image as ImageIcon,
  Trash2,
  Plus,
  Clock,
  AlertTriangle,
  Check,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bell,
  Send,
  X
} from 'lucide-react';

export function getRemainingDays(rest: Restaurant | null): number {
  if (!rest) return 0;
  if (rest.remainingDays === undefined || rest.remainingDays === null) return 0;
  if (!rest.remainingDaysUpdatedAt) return rest.remainingDays;
  const elapsedDays = Math.floor((Date.now() - rest.remainingDaysUpdatedAt) / (1000 * 60 * 60 * 24));
  return rest.remainingDays - elapsedDays;
}

function RemainingDaysCell({ rest, onSave }: { rest: Restaurant; onSave: (days: number) => void }) {
  const currentDaysLeft = getRemainingDays(rest);
  const [editingDays, setEditingDays] = useState<number | string>(currentDaysLeft);

  useEffect(() => {
    setEditingDays(currentDaysLeft);
  }, [rest.remainingDays, rest.remainingDaysUpdatedAt, currentDaysLeft]);

  const handleSave = () => {
    const num = parseInt(String(editingDays));
    onSave(isNaN(num) ? 0 : num);
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[190px]">
      <div className="flex items-center gap-1.5">
        {currentDaysLeft > 0 ? (
          <span className="bg-emerald-100 text-emerald-800 font-extrabold text-xs px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            {currentDaysLeft} {currentDaysLeft === 1 ? 'día restante' : 'días restantes'}
          </span>
        ) : (
          <span className="bg-rose-100 text-rose-800 font-extrabold text-xs px-2.5 py-1 rounded-full flex items-center gap-1 border border-rose-200 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            {currentDaysLeft} {currentDaysLeft === -1 ? 'día' : 'días'} (Donación requerida)
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <input
          type="number"
          value={editingDays}
          onChange={(e) => setEditingDays(e.target.value)}
          placeholder="Días"
          className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
        <button
          type="button"
          onClick={handleSave}
          className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
          title="Guardar días restantes"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Guardar</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => { setEditingDays(30); onSave(30); }}
          className="text-[10px] font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer transition border border-slate-200"
        >
          30 días
        </button>
        <button
          type="button"
          onClick={() => { setEditingDays(15); onSave(15); }}
          className="text-[10px] font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer transition border border-slate-200"
        >
          15 días
        </button>
        <button
          type="button"
          onClick={() => { setEditingDays(0); onSave(0); }}
          className="text-[10px] font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-0.5 rounded cursor-pointer transition border border-rose-200"
        >
          0 días
        </button>
      </div>
    </div>
  );
}

export default function SuperAdminPortal() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [newCityName, setNewCityName] = useState('');
  const [restaurantSearchTerm, setRestaurantSearchTerm] = useState('');
  const [daysSortOrder, setDaysSortOrder] = useState<'none' | 'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'restaurants' | 'drivers' | 'orders' | 'ads' | 'announcements' | 'cities'>('dashboard');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Broadcast Announcement States
  const [broadcastForm, setBroadcastForm] = useState({
    imageUrl: '',
    title: 'Aviso Importante de la Red'
  });
  const [currentBroadcast, setCurrentBroadcast] = useState<{
    id: string;
    imageUrl: string;
    title: string;
    sentAt: number;
    active: boolean;
  } | null>(null);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Advertising States
  const [adSettings, setAdSettings] = useState({
    imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=800',
    intervalSeconds: 10,
    enabled: true
  });
  const [adForm, setAdForm] = useState({
    imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=800',
    intervalSeconds: 10,
    enabled: true
  });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Restaurants
      const restSnap = await getDocs(collection(db, 'restaurants'));
      const restList: Restaurant[] = [];
      restSnap.forEach((d) => {
        restList.push({ id: d.id, ...d.data() } as Restaurant);
      });
      setRestaurants(restList);

      // Fetch Drivers
      const driverSnap = await getDocs(collection(db, 'drivers'));
      const driverList: Driver[] = [];
      driverSnap.forEach((d) => {
        driverList.push({ id: d.id, ...d.data() } as Driver);
      });
      setDrivers(driverList);

      // Fetch Orders
      const orderSnap = await getDocs(collection(db, 'orders'));
      const orderList: Order[] = [];
      orderSnap.forEach((d) => {
        orderList.push({ id: d.id, ...d.data() } as Order);
      });
      setOrders(orderList);

      // Fetch Cities
      try {
        const citiesSnap = await getDocs(collection(db, 'cities'));
        const citiesList: City[] = [];
        citiesSnap.forEach((d) => {
          citiesList.push({ 
            id: d.id, 
            name: d.data().name || '', 
            createdAt: d.data().createdAt || 0,
            topRestaurants: d.data().topRestaurants || []
          } as City);
        });
        citiesList.sort((a, b) => a.name.localeCompare(b.name));
        setCities(citiesList);
      } catch (cityErr) {
        console.error('Error fetching cities:', cityErr);
      }

      // Fetch Ad Settings
      try {
        const adSnap = await getDoc(doc(db, 'settings', 'ads'));
        if (adSnap.exists()) {
          const data = adSnap.data();
          let finalImageUrl = data.imageUrl || 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=800';
          if (data.imageUrl === 'chunked') {
            try {
              const numChunks = data.numChunks || 0;
              const chunkPromises = [];
              for (let i = 0; i < numChunks; i++) {
                chunkPromises.push(getDoc(doc(db, 'settings', 'ads', 'chunks', `chunk_${i}`)));
              }
              const chunkSnaps = await Promise.all(chunkPromises);
              const chunkData = chunkSnaps.map(s => s.exists() ? s.data()?.data : '').join('');
              if (chunkData) {
                finalImageUrl = chunkData;
              }
            } catch (err) {
              console.error('Error loading chunked image in admin:', err);
            }
          }
          const loaded = {
            imageUrl: finalImageUrl,
            intervalSeconds: data.intervalSeconds !== undefined ? Number(data.intervalSeconds) : 10,
            enabled: data.enabled !== false
          };
          setAdSettings(loaded);
          setAdForm(loaded);
        } else {
          // Document doesn't exist yet, seed it with default
          const defaultAds = {
            imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=800',
            intervalSeconds: 10,
            enabled: true
          };
          await setDoc(doc(db, 'settings', 'ads'), defaultAds);
          setAdSettings(defaultAds);
          setAdForm(defaultAds);
        }
      } catch (adErr) {
        console.error('Error fetching ad settings:', adErr);
      }

      // Fetch Broadcast Announcement
      try {
        const bSnap = await getDoc(doc(db, 'settings', 'broadcast_announcement'));
        if (bSnap.exists()) {
          const bData = bSnap.data();
          let bImageUrl = bData.imageUrl || '';
          if (bData.imageUrl === 'chunked') {
            try {
              const numChunks = bData.numChunks || 0;
              const chunkPromises = [];
              for (let i = 0; i < numChunks; i++) {
                chunkPromises.push(getDoc(doc(db, 'settings', 'broadcast_announcement', 'chunks', `chunk_${i}`)));
              }
              const chunkSnaps = await Promise.all(chunkPromises);
              const chunkData = chunkSnaps.map(s => s.exists() ? s.data()?.data : '').join('');
              if (chunkData) bImageUrl = chunkData;
            } catch (err) {
              console.error('Error reassembling chunked broadcast image:', err);
            }
          }
          setCurrentBroadcast({
            id: bData.id || '',
            imageUrl: bImageUrl,
            title: bData.title || 'Aviso Importante',
            sentAt: Number(bData.sentAt || 0),
            active: bData.active !== false
          });
          if (bImageUrl) {
            setBroadcastForm(prev => ({
              ...prev,
              imageUrl: bImageUrl,
              title: bData.title || 'Aviso Importante'
            }));
          }
        }
      } catch (bErr) {
        console.error('Error fetching broadcast announcement settings:', bErr);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
      showNotification('Error al cargar datos del servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Restaurant Actions
  const handleUpdateRestaurantStatus = async (restId: string, newStatus: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => {
    try {
      const docRef = doc(db, 'restaurants', restId);
      await updateDoc(docRef, { status: newStatus });
      
      const statusLabel = newStatus === 'APPROVED' ? 'Aprobado' : newStatus === 'SUSPENDED' ? 'Suspendido' : 'Rechazado';
      showNotification(`Restaurante marcado como ${statusLabel} correctamente`, 'success');
      
      fetchData(); // Reload
    } catch (err) {
      console.error(err);
      showNotification('Error al actualizar el estado del restaurante', 'error');
    }
  };

  const handleUpdateRestaurantRemainingDays = async (restId: string, days: number) => {
    try {
      const docRef = doc(db, 'restaurants', restId);
      await updateDoc(docRef, { 
        remainingDays: days,
        remainingDaysUpdatedAt: Date.now()
      });
      showNotification(`Días restantes actualizados a ${days} días correctamente`, 'success');
      fetchData(); // Reload
    } catch (err) {
      console.error(err);
      showNotification('Error al actualizar los días restantes del restaurante', 'error');
    }
  };

  const handleDeleteRestaurant = async (restId: string, restName: string) => {
    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el restaurante "${restName}"? Esta acción borrará TODOS los registros asociados en la base de datos (empleados, productos, pedidos, sesiones de caja, ingredientes, proveedores y compras). Esta acción es irreversible.`);
    if (!confirmDelete) return;

    try {
      setLoading(true);
      const collectionsToDelete = [
        'employees',
        'products',
        'orders',
        'ingredients',
        'suppliers',
        'cashSessions',
        'purchases'
      ];

      for (const colName of collectionsToDelete) {
        try {
          const q = query(collection(db, colName), where('restaurantId', '==', restId));
          const snapshot = await getDocs(q);
          if (snapshot && snapshot.docs && snapshot.docs.length > 0) {
            const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, colName, d.id)));
            await Promise.all(deletePromises);
          }
        } catch (colErr) {
          console.error(`Error deleting associated documents from ${colName}:`, colErr);
        }
      }

      // Cleanup topRestaurants in cities if present
      try {
        const citiesSnapshot = await getDocs(collection(db, 'cities'));
        if (citiesSnapshot && citiesSnapshot.docs) {
          for (const cityDoc of citiesSnapshot.docs) {
            const cityData = typeof cityDoc.data === 'function' ? cityDoc.data() : cityDoc;
            if (cityData?.topRestaurants && Array.isArray(cityData.topRestaurants)) {
              if (cityData.topRestaurants.includes(restId)) {
                const updatedTops = cityData.topRestaurants.map((id: string) => id === restId ? '' : id);
                await updateDoc(doc(db, 'cities', cityDoc.id), { topRestaurants: updatedTops });
              }
            }
          }
        }
      } catch (cityErr) {
        console.error('Error cleaning up topRestaurants from cities:', cityErr);
      }

      await deleteDoc(doc(db, 'restaurants', restId));
      showNotification(`Restaurante "${restName}" y todos sus registros asociados han sido eliminados.`, 'success');
      await fetchData();
    } catch (err) {
      console.error('Error deleting restaurant:', err);
      showNotification('Error al eliminar el restaurante y sus registros', 'error');
    } finally {
      setLoading(false);
    }
  };

  // City Actions
  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCityName.trim();
    if (!cleanName) return;

    if (cities.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      showNotification('Esta ciudad ya existe en el sistema', 'error');
      return;
    }

    try {
      setLoading(true);
      const citiesRef = collection(db, 'cities');
      await addDoc(citiesRef, {
        name: cleanName,
        createdAt: Date.now()
      });
      setNewCityName('');
      showNotification(`Ciudad "${cleanName}" agregada con éxito`, 'success');
      await fetchData();
    } catch (err) {
      console.error(err);
      showNotification('Error al agregar la ciudad', 'error');
    } finally {
      setLoading(false);
    }
  };

  const [editingTopCity, setEditingTopCity] = useState<City | null>(null);
  const [topRest1, setTopRest1] = useState('');
  const [topRest2, setTopRest2] = useState('');
  const [topRest3, setTopRest3] = useState('');
  const [isSavingTopRests, setIsSavingTopRests] = useState(false);

  const handleSaveTopRestaurants = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopCity) return;
    try {
      setIsSavingTopRests(true);
      const updatedTops = [topRest1.trim(), topRest2.trim(), topRest3.trim()];
      await updateDoc(doc(db, 'cities', editingTopCity.id), {
        topRestaurants: updatedTops
      });
      showNotification(`Los 3 mejores restaurantes de ${editingTopCity.name} actualizados con éxito`, 'success');
      setEditingTopCity(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      showNotification('Error al actualizar los 3 mejores restaurantes', 'error');
    } finally {
      setIsSavingTopRests(false);
    }
  };

  const handleDeleteCity = async (cityId: string, cityName: string) => {
    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la ciudad "${cityName}"?`);
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, 'cities', cityId));
      showNotification(`Ciudad "${cityName}" eliminada con éxito`, 'success');
      await fetchData();
    } catch (err) {
      console.error(err);
      showNotification('Error al eliminar la ciudad', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Driver Actions
  const handleUpdateDriverStatus = async (driverId: string, newStatus: 'AVAILABLE' | 'OFFLINE' | 'SUSPENDED') => {
    try {
      const docRef = doc(db, 'drivers', driverId);
      await updateDoc(docRef, { status: newStatus });
      
      const statusLabel = newStatus === 'AVAILABLE' ? 'Disponible' : newStatus === 'SUSPENDED' ? 'Suspendido' : 'Inactivo';
      showNotification(`Repartidor actualizado a ${statusLabel} correctamente`, 'success');
      
      fetchData(); // Reload
    } catch (err) {
      console.error(err);
      showNotification('Error al actualizar el estado del repartidor', 'error');
    }
  };

  // Calculations
  const totalSales = orders
    .filter(o => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + o.total, 0);

  const pendingRestaurants = restaurants.filter(r => r.status === 'PENDING').length;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary mx-auto mb-4"></div>
        <p className="text-slate-500 font-semibold">Cargando Panel de Administración...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" id="super_admin_portal_container">
      {/* Toast Notification */}
      {notification && (
        <div 
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-black transition-all duration-300 animate-scale-in ${
            notification.type === 'success' 
              ? 'bg-emerald-500 border-emerald-400 text-white' 
              : 'bg-rose-500 border-rose-400 text-white'
          }`}
          id="admin_toast_notification"
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Super Admin Top Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2.5 rounded-2xl">
            <Logo size="md" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">Super Admin</h1>
            <p className="text-slate-400 text-xs mt-0.5">SaaS Multi-Restaurante - Panel de control e ingresos globales</p>
          </div>
        </div>
        <button 
          onClick={fetchData}
          className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Recargar Datos
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'dashboard' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Resumen Global
        </button>
        <button
          onClick={() => setActiveTab('restaurants')}
          className={`pb-4 px-4 font-bold text-sm border-b-2 transition relative whitespace-nowrap ${
            activeTab === 'restaurants' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Restaurantes
          {pendingRestaurants > 0 && (
            <span className="ml-1.5 bg-brand-primary text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {pendingRestaurants}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          className={`pb-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'drivers' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Repartidores
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'orders' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Pedidos Globales
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={`pb-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'ads' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4 text-orange-500" /> Patrocinios y Mensajes
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`pb-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'announcements' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4 text-rose-500" /> Avisos Red (4:4)
        </button>
        <button
          onClick={() => setActiveTab('cities')}
          className={`pb-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'cities' 
              ? 'border-brand-primary text-brand-primary' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4 text-emerald-500" /> Ciudades
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Key Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold uppercase tracking-wider">Ventas Totales</span>
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="mt-4">
                <span className="text-2xl md:text-3xl font-black text-slate-800">${totalSales}</span>
                <span className="text-emerald-500 text-xs font-bold block mt-1">↑ 100% de efectividad</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold uppercase tracking-wider">Restaurantes</span>
                <Store className="w-5 h-5 text-brand-primary" />
              </div>
              <div className="mt-4">
                <span className="text-2xl md:text-3xl font-black text-slate-800">{restaurants.length}</span>
                <span className="text-slate-500 text-xs block mt-1">Aprobados: {restaurants.filter(r => r.status === 'APPROVED').length}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold uppercase tracking-wider">Repartidores Activos</span>
                <Truck className="w-5 h-5 text-blue-500" />
              </div>
              <div className="mt-4">
                <span className="text-2xl md:text-3xl font-black text-slate-800">{drivers.length}</span>
                <span className="text-emerald-500 text-xs font-bold block mt-1">Disponibles: {drivers.filter(d => d.status === 'AVAILABLE').length}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-xs font-bold uppercase tracking-wider">Pedidos Realizados</span>
                <ShoppingBag className="w-5 h-5 text-purple-500" />
              </div>
              <div className="mt-4">
                <span className="text-2xl md:text-3xl font-black text-slate-800">{orders.length}</span>
                <span className="text-slate-500 text-xs block mt-1">Pendientes: {orders.filter(o => o.status === 'PENDING').length}</span>
              </div>
            </div>
          </div>

          {/* Quick Approvals / Subscriptions list */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6">
              <h3 className="font-extrabold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <Store className="w-5 h-5 text-brand-primary" />
                Registros Pendientes de Restaurantes ({pendingRestaurants})
              </h3>
              
              {restaurants.filter(r => r.status === 'PENDING').length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm font-semibold">
                  No hay solicitudes de restaurantes pendientes.
                </div>
              ) : (
                <div className="space-y-4">
                  {restaurants.filter(r => r.status === 'PENDING').map((rest) => (
                    <div key={rest.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <h4 className="font-bold text-slate-800">{rest.name}</h4>
                        <p className="text-xs text-slate-500">{rest.address}</p>
                        <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase mt-2 inline-block">
                          Plan: {rest.plan}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateRestaurantStatus(rest.id, 'REJECTED')}
                          className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                        >
                          Rechazar
                        </button>
                        <button
                          onClick={() => handleUpdateRestaurantStatus(rest.id, 'APPROVED')}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition"
                        >
                          Aprobar y Activar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6">
              <h3 className="font-extrabold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                Estado de Donaciones y Días Restantes
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-200 text-emerald-700 rounded-lg"><Clock className="w-5 h-5" /></div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Con Días Restantes Activos</h4>
                      <p className="text-xs text-emerald-600">Restaurantes operando sin interrupción</p>
                    </div>
                  </div>
                  <span className="font-black text-emerald-700">{restaurants.filter(r => getRemainingDays(r) > 0).length} cuentas</span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-200 text-rose-700 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Expirados (Publicidad Cada Minuto)</h4>
                      <p className="text-xs text-rose-600">Solicitando donación voluntaria cada 1 min</p>
                    </div>
                  </div>
                  <span className="font-black text-rose-700">{restaurants.filter(r => getRemainingDays(r) <= 0).length} cuentas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'restaurants' && (() => {
        const filteredRestaurants = restaurants.filter((rest) => {
          if (!restaurantSearchTerm.trim()) return true;
          const term = restaurantSearchTerm.toLowerCase().trim();
          const email = (rest.email || '').toLowerCase();
          const ownerEmail = ((rest as any).ownerEmail || '').toLowerCase();
          const name = (rest.name || '').toLowerCase();
          const city = (rest.city || '').toLowerCase();
          const phone = (rest.phone || '').toLowerCase();

          return (
            email.includes(term) ||
            ownerEmail.includes(term) ||
            name.includes(term) ||
            city.includes(term) ||
            phone.includes(term)
          );
        });

        const sortedRestaurants = [...filteredRestaurants].sort((a, b) => {
          if (daysSortOrder === 'asc') {
            return getRemainingDays(a) - getRemainingDays(b);
          }
          if (daysSortOrder === 'desc') {
            return getRemainingDays(b) - getRemainingDays(a);
          }
          return 0;
        });

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
            <div className="p-6 border-b border-slate-150 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg">Catálogo de Restaurantes Registrados ({sortedRestaurants.length} de {restaurants.length})</h3>
                <p className="text-xs text-slate-500 mt-0.5">Busca por correo electrónico del propietario o nombre del restaurante</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Sort Selector */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <label className="text-xs font-extrabold text-slate-600 whitespace-nowrap flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-brand-primary" /> Ordenar por Días:
                  </label>
                  <select
                    value={daysSortOrder}
                    onChange={(e) => setDaysSortOrder(e.target.value as 'none' | 'asc' | 'desc')}
                    className="bg-transparent text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="asc">Menor a mayor (negativos primero)</option>
                    <option value="desc">Mayor a menor (positivos primero)</option>
                    <option value="none">Sin orden especial</option>
                  </select>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={restaurantSearchTerm}
                    onChange={(e) => setRestaurantSearchTerm(e.target.value)}
                    placeholder="Buscar por correo o restaurante..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-8 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white transition"
                  />
                  {restaurantSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setRestaurantSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black p-1 cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              {sortedRestaurants.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-600">No se encontraron restaurantes</p>
                  <p className="text-xs text-slate-400 mt-1">Ningún restaurante coincide con "{restaurantSearchTerm}"</p>
                  <button
                    onClick={() => setRestaurantSearchTerm('')}
                    className="mt-3 text-xs font-bold text-brand-primary hover:underline"
                  >
                    Limpiar búsqueda
                  </button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                      <th className="p-4">Logo & Restaurante</th>
                      <th className="p-4">Contacto / Correo Propietario</th>
                      <th className="p-4">Ciudad</th>
                      <th className="p-4">Categoría</th>
                      <th className="p-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (daysSortOrder === 'asc') setDaysSortOrder('desc');
                            else if (daysSortOrder === 'desc') setDaysSortOrder('none');
                            else setDaysSortOrder('asc');
                          }}
                          className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-brand-primary transition cursor-pointer select-none"
                          title="Clic para cambiar el orden por Días Restantes"
                        >
                          <span>Días Restantes</span>
                          {daysSortOrder === 'asc' && (
                            <span className="bg-brand-primary text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-extrabold shadow-2xs">
                              <ArrowUp className="w-3 h-3" /> Menor a Mayor
                            </span>
                          )}
                          {daysSortOrder === 'desc' && (
                            <span className="bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-extrabold shadow-2xs">
                              <ArrowDown className="w-3 h-3" /> Mayor a Menor
                            </span>
                          )}
                          {daysSortOrder === 'none' && (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th className="p-4">Estado</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedRestaurants.map((rest) => (
                      <tr key={rest.id} className="hover:bg-slate-50 transition">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={rest.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200'} 
                              alt={rest.name} 
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" 
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200';
                              }}
                            />
                            <div>
                              <span className="font-bold text-slate-800 block">{rest.name}</span>
                              <span className="text-[11px] text-slate-400 font-medium">{rest.address}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-xs">
                            <span className="block font-semibold text-slate-700">{rest.phone}</span>
                            <span className="text-brand-primary font-bold block mt-0.5">{rest.email || (rest as any).ownerEmail || 'Sin correo'}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            {rest.city || <span className="text-slate-400 font-normal italic">Sin asignar</span>}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold">
                            {rest.category}
                          </span>
                        </td>
                        <td className="p-4">
                          <RemainingDaysCell
                            rest={rest}
                            onSave={(days) => handleUpdateRestaurantRemainingDays(rest.id, days)}
                          />
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${
                            rest.status === 'APPROVED' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : rest.status === 'PENDING'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {rest.status === 'APPROVED' 
                              ? 'Aprobado / Activo' 
                              : rest.status === 'PENDING' 
                              ? 'Pendiente' 
                              : rest.status === 'SUSPENDED'
                              ? 'Suspendido'
                              : 'Inactivo'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            {rest.status !== 'APPROVED' ? (
                              <button
                                onClick={() => handleUpdateRestaurantStatus(rest.id, 'APPROVED')}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold p-1.5 rounded-lg text-xs transition"
                                title="Aprobar / Reactivar"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateRestaurantStatus(rest.id, 'SUSPENDED')}
                                className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold p-1.5 rounded-lg text-xs transition"
                                title="Suspender / Desactivar"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteRestaurant(rest.id, rest.name)}
                              className="bg-red-500 hover:bg-red-600 text-white font-bold p-1.5 rounded-lg text-xs transition"
                              title="Eliminar Restaurante"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === 'drivers' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-150">
            <h3 className="font-extrabold text-slate-800 text-lg">Control de Repartidores Registrados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                  <th className="p-4">Repartidor</th>
                  <th className="p-4">Ciudad</th>
                  <th className="p-4">Medio de Transporte</th>
                  <th className="p-4">Zona</th>
                  <th className="p-4">Teléfono & Correo</th>
                  <th className="p-4">Calificación</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-slate-50 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={(!driver.photo || driver.photo.includes('unsplash.com') || driver.photo.includes('photo-15')) ? '/driver-silhouette.svg' : driver.photo} 
                          alt={driver.name} 
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 bg-white" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => { (e.target as HTMLImageElement).src = '/driver-silhouette.svg'; }}
                        />
                        <span className="font-bold text-slate-800">{driver.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {driver.city || <span className="text-slate-400 font-normal italic">Sin asignar</span>}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">
                        {driver.vehicle === 'Motorcycle' ? '🛵 Motocicleta' : driver.vehicle === 'Bicycle' ? '🚲 Bicicleta' : driver.vehicle === 'Car' ? '🚗 Auto' : '🛴 Otro'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-600 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {driver.workingZone}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-xs">
                        <span className="block font-semibold text-slate-700">{driver.phone}</span>
                        <span className="text-slate-400">{driver.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-amber-500">⭐ {driver.rating}</span>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${
                        driver.status === 'AVAILABLE' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : driver.status === 'DELIVERING'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {driver.status === 'AVAILABLE' ? 'Disponible' : driver.status === 'DELIVERING' ? 'Entregando' : 'Suspendido'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {driver.status !== 'SUSPENDED' ? (
                          <button
                            onClick={() => handleUpdateDriverStatus(driver.id, 'SUSPENDED')}
                            className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold p-1.5 rounded-lg text-xs transition"
                            title="Suspender Repartidor"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateDriverStatus(driver.id, 'AVAILABLE')}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold p-1.5 rounded-lg text-xs transition"
                            title="Reactivar"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
          <div className="p-6 border-b border-slate-150">
            <h3 className="font-extrabold text-slate-800 text-lg">Historial de Pedidos Globales</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                  <th className="p-4">ID Pedido</th>
                  <th className="p-4">Restaurante</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Tipo & Pago</th>
                  <th className="p-4">Repartidor Asignado</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono text-xs font-bold text-slate-500">
                      #{order.id.slice(0, 8)}
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      {order.restaurantName}
                    </td>
                    <td className="p-4 font-medium text-slate-600">
                      {order.customerName}
                    </td>
                    <td className="p-4">
                      <div className="text-xs">
                        <span className="font-bold text-slate-700 block">
                          {order.deliveryType === 'DELIVERY' ? '🏍️ Domicilio' : order.deliveryType === 'PICKUP' ? '🛍️ Sucursal' : '🍽️ Mesa'}
                        </span>
                        <span className="text-slate-400">
                          {order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Efectivo contra entrega' : 'Efectivo al recoger'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {order.driverName ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700">{order.driverName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No requiere o por asignar</span>
                      )}
                    </td>
                    <td className="p-4 font-black text-slate-800">
                      ${order.total}
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${
                        order.status === 'DELIVERED' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : order.status === 'CANCELLED'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ads' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="super_admin_ads_management">
          {/* Form Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-150 p-6 md:p-8 shadow-sm space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-orange-100 text-brand-primary p-1.5 rounded-xl">
                  <Megaphone className="w-5 h-5" />
                </span>
                <h3 className="font-extrabold text-slate-800 text-lg">Configurar Patrocinios y Soporte</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Controla los mensajes o imágenes de patrocinadores que se muestran periódicamente en la interfaz de los restaurantes para incentivar las donaciones voluntarias y el soporte continuo de la plataforma.
              </p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const docRef = doc(db, 'settings', 'ads');
                const imageVal = adForm.imageUrl || '';
                
                if (imageVal.startsWith('data:')) {
                  // Chunk the base64 string to bypass Firestore 1MB document size limit
                  const chunkSize = 600000; // ~600KB per chunk
                  const numChunks = Math.ceil(imageVal.length / chunkSize);
                  
                  // Save main settings first
                  const mainSettings = {
                    imageUrl: 'chunked',
                    intervalSeconds: adForm.intervalSeconds,
                    enabled: adForm.enabled,
                    numChunks: numChunks,
                    updatedAt: Date.now()
                  };
                  await setDoc(docRef, mainSettings);
                  
                  // Save each chunk
                  for (let i = 0; i < numChunks; i++) {
                    const chunkData = imageVal.slice(i * chunkSize, (i + 1) * chunkSize);
                    await setDoc(doc(db, 'settings', 'ads', 'chunks', `chunk_${i}`), {
                      data: chunkData
                    });
                  }
                } else {
                  // It's a standard URL, save normally
                  const mainSettings = {
                    imageUrl: imageVal,
                    intervalSeconds: adForm.intervalSeconds,
                    enabled: adForm.enabled,
                    numChunks: 0,
                    updatedAt: Date.now()
                  };
                  await setDoc(docRef, mainSettings);
                }

                setAdSettings(adForm);
                showNotification('¡Patrocinio configurado con éxito!', 'success');
              } catch (err) {
                console.error(err);
                showNotification('Error al guardar el patrocinio en Firestore', 'error');
              }
            }} className="space-y-6">
              
              {/* Toggle Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div>
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Patrocinio Activo</h4>
                  <p className="text-[11px] text-slate-400 font-bold mt-0.5">Habilita o deshabilita los mensajes emergentes de patrocinador para los usuarios colaboradores</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 outline-none cursor-pointer ${
                    adForm.enabled ? 'bg-brand-primary justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-md"></span>
                </button>
              </div>

              {/* Frecuencia en segundos */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">
                  Intervalo de Aparición (Segundos)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={5}
                    max={600}
                    required
                    value={adForm.intervalSeconds}
                    onChange={(e) => setAdForm(prev => ({ ...prev, intervalSeconds: Math.max(5, Number(e.target.value)) }))}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-2xl p-3.5 text-xs focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                    placeholder="Ej: 10"
                  />
                  <span className="bg-slate-100 border border-slate-200 text-slate-500 font-bold text-xs px-4 rounded-2xl flex items-center justify-center">
                    segundos
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                  Se recomienda mínimo 10 segundos para no bloquear totalmente la operatividad y permitir que interactúen fluidamente.
                </span>
              </div>

              {/* Image Input Options */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block mb-1.5">
                    Imagen de Patrocinio / Mensaje Comunitario
                  </label>
                  
                  {/* File Upload / Drag and Drop Area */}
                  <div className="border-2 border-dashed border-slate-200 rounded-3xl p-6 bg-slate-50 text-center relative hover:bg-slate-100/50 transition duration-300">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 15 * 1024 * 1024) {
                          showNotification('La imagen supera el límite de 10MB.', 'error');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setAdForm(prev => ({ ...prev, imageUrl: event.target!.result as string }));
                            showNotification('Imagen cargada correctamente', 'success');
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-2.5 bg-white border border-slate-150 text-slate-500 rounded-2xl shadow-2xs">
                        <Upload className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-700 block">Sube un archivo de imagen</span>
                        <span className="text-[10px] text-slate-400 font-bold mt-1 block">PNG, JPG, WEBP (Máx. 10 MB)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-150"></div>
                  <span className="flex-shrink mx-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">O pega una URL</span>
                  <div className="flex-grow border-t border-slate-150"></div>
                </div>

                {/* Direct URL Input */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <ImageIcon className="w-4 h-4" />
                    </span>
                    <input
                      type="url"
                      value={adForm.imageUrl.startsWith('data:') ? '' : adForm.imageUrl}
                      onChange={(e) => setAdForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition"
                      placeholder="https://ejemplo.com/publicidad.jpg"
                    />
                  </div>
                </div>

                {/* Preset Templates */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">
                    Plantillas de Mensajes Listas
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { 
                        name: 'Refresco Cola', 
                        url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=600',
                        desc: 'Refresco helado para acompañar platillos'
                      },
                      { 
                        name: 'Hamburguesa XXL', 
                        url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600',
                        desc: 'Promoción de combo hamburguesa del mes'
                      },
                      { 
                        name: 'Postres del Día', 
                        url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&q=80&w=600',
                        desc: 'Incentiva a ordenar repostería'
                      },
                      { 
                        name: 'Soporte Comunitario', 
                        url: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&q=80&w=600',
                        desc: 'Imagen incentivadora de apoyo voluntario'
                      }
                    ].map((tpl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setAdForm(prev => ({ ...prev, imageUrl: tpl.url }));
                          showNotification(`Seleccionada la plantilla "${tpl.name}"`, 'success');
                        }}
                        className={`group relative h-16 rounded-2xl overflow-hidden border transition cursor-pointer flex flex-col justify-end ${
                          adForm.imageUrl === tpl.url ? 'border-brand-primary ring-2 ring-brand-primary/30' : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <img
                          src={tpl.url}
                          alt={tpl.name}
                          className="absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 flex flex-col justify-end p-2 text-left">
                          <span className="text-[9px] text-white font-black uppercase tracking-wide leading-tight truncate">{tpl.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-850 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Guardar Configuración de Patrocinio
              </button>
            </form>
          </div>

          {/* Real-time Preview Column */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Vista Previa Interactiva
                </h4>
                <p className="text-[11px] text-slate-400 font-bold mt-1 leading-relaxed">
                  Así es como le aparecerá de manera emergente a los usuarios colaboradores cada <span className="text-white font-black">{adForm.intervalSeconds}</span> segundos.
                </p>
              </div>

              {/* Simulated Tablet Mockup with Popup Ad */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 relative aspect-video shadow-2xl flex flex-col">
                {/* Header bar mockup */}
                <div className="bg-slate-950 px-3 py-1.5 flex items-center justify-between border-b border-slate-850">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-[9px] text-slate-500 font-mono font-bold ml-1">Mesa 22 Portal</span>
                  </div>
                </div>

                {/* Dashboard content blurry preview */}
                <div className="flex-1 p-4 space-y-3 filter blur-xs select-none pointer-events-none">
                  <div className="h-6 bg-slate-800 rounded-lg w-1/3"></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-10 bg-slate-800 rounded-xl"></div>
                    <div className="h-10 bg-slate-800 rounded-xl"></div>
                    <div className="h-10 bg-slate-800 rounded-xl"></div>
                  </div>
                  <div className="h-16 bg-slate-800 rounded-2xl w-full"></div>
                </div>

                {/* Simulated popup ad overlay */}
                {adForm.enabled ? (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-3xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-[240px] overflow-hidden shadow-2xl border border-slate-100 flex flex-col relative animate-scale-in text-slate-800">
                      
                      {/* Close button indicator */}
                      <span className="absolute top-2 right-2 h-5 w-5 bg-black/60 rounded-full flex items-center justify-center text-white text-[9px] font-black cursor-pointer hover:bg-black/80 transition">
                        ✕
                      </span>

                      {/* Header */}
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 py-1.5 px-3 text-white text-[8px] font-black uppercase tracking-wider flex items-center justify-between">
                        <span>Soporte de Patrocinador</span>
                        <span className="text-emerald-100">Mesa 22</span>
                      </div>

                      {/* Image */}
                      <div className="aspect-video bg-slate-100 relative">
                        {adForm.imageUrl ? (
                          <img
                            src={adForm.imageUrl}
                            alt="Publicidad"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2">
                            <ImageIcon className="w-6 h-6 mb-1 text-slate-300" />
                            <span className="text-[8px] font-bold">Sin imagen cargada</span>
                          </div>
                        )}
                      </div>

                      {/* Footer CTA */}
                      <div className="p-2 bg-slate-50 border-t border-slate-100 text-center flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-800 leading-tight">Mensaje configurable globalmente</span>
                        <button
                          type="button"
                          className="bg-brand-primary text-white text-[8px] font-black uppercase py-1 rounded-md tracking-wider cursor-default shadow-xs"
                        >
                          Saber más
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                    <span className="bg-slate-950/80 text-orange-400 font-bold text-xs py-2 px-3.5 rounded-full border border-slate-800">
                      Patrocinio Desactivado
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Explanatory widget */}
            <div className="bg-orange-50 border border-orange-150 rounded-3xl p-5 text-orange-950 text-xs font-semibold leading-relaxed space-y-2">
              <h4 className="font-extrabold uppercase tracking-wider text-brand-primary text-[10px] flex items-center gap-1">
                📌 Beneficios del Flujo de Patrocinios
              </h4>
              <ul className="list-disc pl-4 space-y-1">
                <li><span className="font-extrabold">Incentivo de Apoyo:</span> Invita amablemente a los usuarios a realizar una donación voluntaria para dar soporte continuo a la plataforma.</li>
                <li><span className="font-extrabold">Frecuencia Dinámica:</span> El temporizador lee el intervalo configurado por ti en tiempo real desde Firestore, adaptándose de inmediato.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="super_admin_broadcast_announcements">
          {/* Form Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-150 p-6 md:p-8 shadow-sm space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-rose-100 text-rose-600 p-1.5 rounded-xl">
                  <Bell className="w-5 h-5" />
                </span>
                <h3 className="font-extrabold text-slate-800 text-lg">Enviar Aviso Importante a la Red</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Sube una imagen en formato cuadrado (4:4 / 1:1) con el aviso o comunicado importante. Al dar clic en <strong>Enviar Aviso</strong>, se abrirá instantáneamente una ventana emergente en la pantalla de todos los dueños de restaurantes, cocineros, meseros y cajeros. Desaparecerá al hacer clic en <strong>Cerrar</strong> y no volverá a mostrarse hasta que envíes un nuevo aviso.
              </p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!broadcastForm.imageUrl) {
                showNotification('Por favor selecciona o sube una imagen para el aviso.', 'error');
                return;
              }
              setSendingBroadcast(true);
              try {
                const docRef = doc(db, 'settings', 'broadcast_announcement');
                const imageVal = broadcastForm.imageUrl;
                const newId = `broadcast_${Date.now()}`;
                const newTitle = broadcastForm.title || 'Aviso Importante';

                if (imageVal.startsWith('data:')) {
                  const chunkSize = 600000;
                  const numChunks = Math.ceil(imageVal.length / chunkSize);

                  await setDoc(docRef, {
                    id: newId,
                    imageUrl: 'chunked',
                    title: newTitle,
                    sentAt: Date.now(),
                    numChunks: numChunks,
                    active: true
                  });

                  for (let i = 0; i < numChunks; i++) {
                    const chunkData = imageVal.slice(i * chunkSize, (i + 1) * chunkSize);
                    await setDoc(doc(db, 'settings', 'broadcast_announcement', 'chunks', `chunk_${i}`), {
                      data: chunkData
                    });
                  }
                } else {
                  await setDoc(docRef, {
                    id: newId,
                    imageUrl: imageVal,
                    title: newTitle,
                    sentAt: Date.now(),
                    numChunks: 0,
                    active: true
                  });
                }

                setCurrentBroadcast({
                  id: newId,
                  imageUrl: imageVal,
                  title: newTitle,
                  sentAt: Date.now(),
                  active: true
                });
                showNotification('¡Aviso enviado con éxito a todos los usuarios de la red!', 'success');
              } catch (err) {
                console.error(err);
                showNotification('Error al enviar el aviso', 'error');
              } finally {
                setSendingBroadcast(false);
              }
            }} className="space-y-6">

              {/* Título o Encabezado Opcional */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">
                  Encabezado / Título del Aviso
                </label>
                <input
                  type="text"
                  value={broadcastForm.title}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-2xl p-3.5 text-xs focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                  placeholder="Ej: Aviso Importante, Mantenimiento Programado, etc."
                />
              </div>

              {/* Upload Square Image */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block mb-1.5">
                    Imagen del Aviso (Formato Cuadrado 4:4 / 1:1) *
                  </label>
                  
                  {/* File Upload / Drag and Drop Area */}
                  <div className="border-2 border-dashed border-slate-200 rounded-3xl p-6 bg-slate-50 text-center relative hover:bg-slate-100/50 transition duration-300">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 15 * 1024 * 1024) {
                          showNotification('La imagen supera el límite de 10MB.', 'error');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setBroadcastForm(prev => ({ ...prev, imageUrl: event.target!.result as string }));
                            showNotification('Imagen del aviso cargada correctamente', 'success');
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 bg-rose-50 border border-rose-150 text-rose-600 rounded-2xl shadow-2xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-700 block">Sube tu imagen de aviso (4:4)</span>
                        <span className="text-[10px] text-slate-400 font-bold mt-1 block">PNG, JPG, WEBP (Se recomienda dimensión cuadrada 1:1)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-150"></div>
                  <span className="flex-shrink mx-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">O pega una URL</span>
                  <div className="flex-grow border-t border-slate-150"></div>
                </div>

                {/* Direct URL Input */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <ImageIcon className="w-4 h-4" />
                    </span>
                    <input
                      type="url"
                      value={broadcastForm.imageUrl.startsWith('data:') ? '' : broadcastForm.imageUrl}
                      onChange={(e) => setBroadcastForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="w-full pl-10 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-2xl p-3.5 text-xs focus:bg-white focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
                      placeholder="https://ejemplo.com/mi-aviso-cuadrado.jpg"
                    />
                  </div>
                </div>
              </div>

              {/* Submit / Send Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={sendingBroadcast}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4.5 h-4.5" />
                  {sendingBroadcast ? 'Enviando a la Red...' : 'Enviar Aviso a Todos los Restaurantes'}
                </button>

                {currentBroadcast && currentBroadcast.active && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const docRef = doc(db, 'settings', 'broadcast_announcement');
                        await updateDoc(docRef, { active: false, updatedAt: Date.now() });
                        setCurrentBroadcast({ ...currentBroadcast, active: false });
                        showNotification('Aviso desactivado correctamente.', 'success');
                      } catch (err) {
                        console.error(err);
                        showNotification('Error al desactivar el aviso.', 'error');
                      }
                    }}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    Desactivar / Ocultar Aviso Actual
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Real-time Preview Column */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                  Vista Previa en Pantalla (Formato Cuadrado 4:4)
                </h4>
                <p className="text-[11px] text-slate-400 font-bold mt-1 leading-relaxed">
                  Así aparecerá la ventana emergente en la pantalla de los dueños, cocineros, meseros y cajeros al momento de presionar "Enviar Aviso":
                </p>
              </div>

              {/* Simulated Popup Preview */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-4 relative">
                <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200 flex flex-col text-slate-800 max-w-xs mx-auto">
                  {/* Top Bar */}
                  <div className="bg-slate-950 px-3 py-2 flex items-center justify-between border-b border-slate-900">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                      <span className="text-[9px] text-slate-300 font-black uppercase tracking-wider font-mono">AVISO IMPORTANTE DE LA RED</span>
                    </div>
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </div>

                  {/* Square Image 1:1 Container */}
                  <div className="relative aspect-square w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                    {broadcastForm.imageUrl ? (
                      <img
                        src={broadcastForm.imageUrl}
                        alt="Vista Previa de Aviso"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-center p-6 text-slate-400 flex flex-col items-center gap-2">
                        <Bell className="w-8 h-8 text-rose-500 animate-bounce" />
                        <span className="text-xs font-black text-slate-300">Selecciona o sube una imagen 4:4</span>
                      </div>
                    )}
                  </div>

                  {/* Content & Action */}
                  <div className="p-4 space-y-3">
                    <h5 className="font-black text-slate-850 text-xs text-center">
                      {broadcastForm.title || 'Aviso Importante'}
                    </h5>
                    <button
                      type="button"
                      className="w-full bg-brand-primary text-white font-black py-2.5 rounded-xl text-[10px] uppercase tracking-wider cursor-default shadow-xs text-center"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>

              {currentBroadcast && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 text-xs space-y-1 text-slate-300 font-medium">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Estado del Último Aviso:</span>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white">{currentBroadcast.title}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${currentBroadcast.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                      {currentBroadcast.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  {currentBroadcast.sentAt > 0 && (
                    <span className="text-[10px] text-slate-400 block">
                      Enviado el: {new Date(currentBroadcast.sentAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cities' && (
        <div className="space-y-8 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Form Column */}
            <div className="lg:col-span-5 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm h-fit">
              <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-500" />
                Dar de Alta Nueva Ciudad
              </h3>
              <p className="text-slate-500 text-xs font-medium leading-relaxed mb-6">
                Las ciudades registradas aquí estarán inmediatamente disponibles para la selección de nuevos restaurantes, repartidores y clientes durante su registro.
              </p>

              <form onSubmit={handleAddCity} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block mb-1">
                    Nombre de la Ciudad *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 text-slate-400 w-4.5 h-4.5" />
                    <input
                      type="text"
                      required
                      value={newCityName}
                      onChange={(e) => setNewCityName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition"
                      placeholder="Ej. Monterrey, Guadalajara, etc."
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-850 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Agregar Ciudad
                </button>
              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-7 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
              <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-500" />
                Ciudades Activas ({cities.length})
              </h3>

              {cities.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl">
                  No hay ciudades dadas de alta todavía. Comienza agregando una arriba.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-3xs">
                  <table className="w-full border-collapse text-left text-xs text-slate-500">
                    <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 tracking-wider border-b border-slate-150">
                      <tr>
                        <th className="py-4 px-6 font-bold">Ciudad</th>
                        <th className="py-4 px-6 font-bold">3 Mejores Restaurantes ("Lo Mejor de la Ciudad")</th>
                        <th className="py-4 px-6 font-bold">Fecha de Registro</th>
                        <th className="py-4 px-6 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {cities.map((city) => {
                        const topIds = city.topRestaurants || [];
                        const top1Rest = restaurants.find(r => r.id === topIds[0]);
                        const top2Rest = restaurants.find(r => r.id === topIds[1]);
                        const top3Rest = restaurants.find(r => r.id === topIds[2]);

                        return (
                          <tr key={city.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-4 px-6 font-extrabold text-slate-800 flex items-center gap-2.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                              {city.name}
                            </td>
                            <td className="py-4 px-6">
                              <div className="space-y-1 text-xs font-semibold text-slate-700">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">🥇 #1</span>
                                  <span className="font-bold">{top1Rest ? top1Rest.name : topIds[0] ? `ID: ${topIds[0]}` : <span className="text-slate-300 italic">Sin asignar</span>}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">🥈 #2</span>
                                  <span className="font-bold">{top2Rest ? top2Rest.name : topIds[1] ? `ID: ${topIds[1]}` : <span className="text-slate-300 italic">Sin asignar</span>}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-black bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded">🥉 #3</span>
                                  <span className="font-bold">{top3Rest ? top3Rest.name : topIds[2] ? `ID: ${topIds[2]}` : <span className="text-slate-300 italic">Sin asignar</span>}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 font-medium text-slate-400">
                              {city.createdAt ? new Date(city.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingTopCity(city);
                                    setTopRest1(city.topRestaurants?.[0] || '');
                                    setTopRest2(city.topRestaurants?.[1] || '');
                                    setTopRest3(city.topRestaurants?.[2] || '');
                                  }}
                                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-extrabold px-3 py-2 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                                  title="Configurar los 3 mejores restaurantes"
                                >
                                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span>Asignar Top 3</span>
                                </button>

                                <button
                                  onClick={() => handleDeleteCity(city.id, city.name)}
                                  className="bg-red-50 hover:bg-red-100 text-red-500 font-bold p-2 rounded-xl text-xs transition cursor-pointer inline-flex items-center justify-center border border-red-100"
                                  title="Eliminar Ciudad"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Modal to configure Top 3 Restaurants for a City */}
          {editingTopCity && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6 relative">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2.5 bg-amber-100 rounded-2xl text-amber-600">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-lg">Lo Mejor de {editingTopCity.name}</h3>
                      <p className="text-slate-500 text-xs font-medium">Asigna los 3 mejores restaurantes que verán los clientes de esta ciudad.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingTopCity(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveTopRestaurants} className="space-y-5">
                  {/* Helper Notice */}
                  <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl p-3.5 text-xs text-amber-900">
                    <p className="font-bold mb-1 flex items-center gap-1.5">
                      <span>📍 Configuración de los mejores restaurantes para {editingTopCity.name}</span>
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Ingresa o pega el ID exacto del restaurante para asignar la posición correspondiente.
                    </p>
                  </div>

                  {/* Top 1 */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <label className="text-xs font-black text-amber-800 flex items-center gap-1.5 uppercase">
                      <span>🥇 #1 Primer Lugar (Lo Mejor)</span>
                    </label>
                    <div>
                      <input
                        type="text"
                        value={topRest1}
                        onChange={(e) => setTopRest1(e.target.value)}
                        placeholder="Pegar ID del Restaurante #1"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Top 2 */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
                      <span>🥈 #2 Segundo Lugar</span>
                    </label>
                    <div>
                      <input
                        type="text"
                        value={topRest2}
                        onChange={(e) => setTopRest2(e.target.value)}
                        placeholder="Pegar ID del Restaurante #2"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Top 3 */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <label className="text-xs font-black text-amber-900 flex items-center gap-1.5 uppercase">
                      <span>🥉 #3 Tercer Lugar</span>
                    </label>
                    <div>
                      <input
                        type="text"
                        value={topRest3}
                        onChange={(e) => setTopRest3(e.target.value)}
                        placeholder="Pegar ID del Restaurante #3"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingTopCity(null)}
                      className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingTopRests}
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-xs transition cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isSavingTopRests ? 'Guardando...' : 'Guardar Top 3'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
