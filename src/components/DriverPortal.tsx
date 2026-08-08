import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { 
  auth, 
  db,
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc,
  onSnapshot, 
  query, 
  where,
  getDoc
} from '../firebase';
import AuthModal from './AuthModal';
import Logo from './Logo';
import { Driver, Order, City } from '../types';
import { notificationService } from '../utils/notificationService';
import { sendDriverNewOrderEmail } from '../utils/emailService';
import { 
  Truck, 
  MapPin, 
  Phone, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  Navigation, 
  User, 
  AlertTriangle,
  BellRing,
  ShoppingBag,
  Power,
  RefreshCw,
  LogOut,
  UserCheck,
  Lock,
  Edit3,
  Camera,
  Upload,
  X,
  ChevronDown
} from 'lucide-react';

interface DriverPortalProps {
  onAudioAlert: () => void;
}

export default function DriverPortal({ onAudioAlert }: DriverPortalProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [unpaidDeliveredOrders, setUnpaidDeliveredOrders] = useState<Order[]>([]);
  const [availableDeliveries, setAvailableDeliveries] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Cities array for driver city selection
  const [cities, setCities] = useState<City[]>([]);

  // Real-time map of restaurantId -> restaurantCity
  const [restaurantCityMap, setRestaurantCityMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'restaurants'), (snap) => {
      const map: Record<string, string> = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.city) {
          map[docSnap.id] = data.city;
        }
      });
      setRestaurantCityMap(map);
    });
    return () => unsubscribe();
  }, []);

  // Edit Driver Profile Modal States
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editVehicle, setEditVehicle] = useState<'Bicycle' | 'Motorcycle' | 'Car' | 'Other'>('Motorcycle');
  const [editLicense, setEditLicense] = useState('');
  const [editWorkingZone, setEditWorkingZone] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Fetch Cities from Super Admin Firestore
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const snap = await getDocs(collection(db, 'cities'));
        const list: City[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as City);
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCities(list);
      } catch (err) {
        console.error('Error fetching cities in DriverPortal:', err);
      }
    };
    fetchCities();
  }, []);

  const handleOpenEditProfileModal = () => {
    if (!selectedDriver) return;
    setEditName(selectedDriver.name || '');
    setEditPhone(selectedDriver.phone || '');
    setEditCity(selectedDriver.city || (cities[0]?.name || 'Ciudad de México'));
    setEditVehicle(selectedDriver.vehicle || 'Motorcycle');
    setEditLicense(selectedDriver.licenseNumber || '');
    setEditWorkingZone(selectedDriver.workingZone || '');
    setEditPhoto(selectedDriver.photo || '/driver-silhouette.jpg');
    setIsEditProfileModalOpen(true);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Por favor elige una imagen menor a 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setEditPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDriverProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) return;

    if (!editName.trim() || !editPhone.trim() || !editCity.trim()) {
      alert('Por favor completa los campos requeridos: Nombre, Teléfono y Ciudad.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedData = {
        name: editName.trim(),
        phone: editPhone.trim(),
        city: editCity.trim(),
        vehicle: editVehicle,
        licenseNumber: editLicense.trim() || '',
        workingZone: editWorkingZone.trim() || 'Zona Central',
        photo: editPhoto.trim() || '/driver-silhouette.jpg',
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'drivers', selectedDriver.id), updatedData, { merge: true });

      const mergedDriver = {
        ...selectedDriver,
        ...updatedData
      };

      setSelectedDriver(mergedDriver);
      setUserProfile(mergedDriver);
      setIsEditProfileModalOpen(false);
      alert('¡Perfil de repartidor actualizado con éxito! 🏍️');
    } catch (err) {
      console.error('Error actualizando perfil del repartidor:', err);
      alert('Ocurrió un error al actualizar los datos. Inténtalo de nuevo.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Auth States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<Driver | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalRegisterMode, setAuthModalRegisterMode] = useState(false);

  const DEFAULT_DRIVER_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23fff7ed"/><path d="M50 22c-9.9 0-18 8.1-18 18 0 7.3 4.4 13.6 10.7 16.3C30.6 59.8 22 71.8 22 86h56c0-14.2-8.6-26.2-20.7-29.7C63.6 53.6 68 47.3 68 40c0-9.9-8.1-18-18-18z" fill="%23ea580c"/><path d="M34 35c0-7.5 7.2-11 16-11s16 3.5 16 11c0 2-14 3.5-32 0z" fill="%239a3412"/></svg>`;

  const getDriverPhotoUrl = (photo?: string) => {
    if (!photo || photo === '/driver-silhouette.jpg' || photo.includes('silhouette') || photo.includes('unsplash.com') || photo.includes('photo-15')) {
      return DEFAULT_DRIVER_AVATAR;
    }
    return photo;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const profileDoc = await getDoc(doc(db, 'drivers', user.uid));
          if (profileDoc.exists()) {
            const data = { id: profileDoc.id, ...profileDoc.data() } as Driver;
            if (!data.photo || data.photo.includes('unsplash.com') || data.photo.includes('photo-15')) {
              data.photo = '/driver-silhouette.jpg';
              try {
                await updateDoc(doc(db, 'drivers', user.uid), { photo: '/driver-silhouette.jpg' });
              } catch (e) {
                console.error("Error updating driver avatar photo:", e);
              }
            }
            setUserProfile(data);
            setSelectedDriver(data); // Auto lock to logged-in driver
          } else {
            setUserProfile(null);
          }
        } catch (err) {
          console.error('Error fetching driver profile:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        setSelectedDriver(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);
  
  // Realtime order notifications
  const [lastNotifiedOrderCount, setLastNotifiedOrderCount] = useState(0);
  const [showNotification, setShowNotification] = useState<Order | null>(null);
  const lastNotifiedOrderIdRef = useRef<string | null>(null);

  // Set up real-time listener for driver document status, "READY" orders and orders assigned to the current driver
  useEffect(() => {
    if (!selectedDriver?.id) {
      setAvailableDeliveries([]);
      setActiveOrders([]);
      setUnpaidDeliveredOrders([]);
      setShowNotification(null);
      return;
    }

    // 1. Listen to selected driver's document to keep status, rating etc synchronized in real-time
    const unsubscribeDriver = onSnapshot(
      doc(db, 'drivers', selectedDriver.id),
      (docSnap) => {
        if (docSnap.exists()) {
          const dData = { id: docSnap.id, ...docSnap.data() } as Driver;
          if (!dData.photo || dData.photo.includes('unsplash.com') || dData.photo.includes('photo-15')) {
            dData.photo = '/driver-silhouette.jpg';
          }
          setSelectedDriver(dData);
        }
      },
      (err) => {
        console.error("Error listening to driver document:", err);
      }
    );

    // If driver is OFFLINE, we should not listen to available deliveries or their deliveries, and we should clear the lists!
    if (selectedDriver.status === 'OFFLINE') {
      setAvailableDeliveries([]);
      setActiveOrders([]);
      setUnpaidDeliveredOrders([]);
      setShowNotification(null);
      return () => {
        unsubscribeDriver();
      };
    }

    // 2. Listen for available deliveries ("READY" to pick up, and no driver assigned yet)
    const qAvailable = query(
      collection(db, 'orders'), 
      where('status', '==', 'READY'),
      where('deliveryType', '==', 'DELIVERY')
    );
    
    const unsubscribeAvailable = onSnapshot(
      qAvailable, 
      (snapshot) => {
        const list: Order[] = [];
        const driverCity = selectedDriver.city?.trim().toLowerCase();

        snapshot.forEach((docSnap) => {
          const ord = { id: docSnap.id, ...docSnap.data() } as Order;
          if (!ord.driverId) {
            // Get order city or fallback to restaurant city from map
            const orderCity = (ord.city || restaurantCityMap[ord.restaurantId])?.trim().toLowerCase();
            
            // Only include order if driver has no city set or if order/restaurant city matches driver's city
            if (!driverCity || !orderCity || orderCity === driverCity) {
              list.push(ord);
            }
          }
        });
        setAvailableDeliveries(list);

        // Trigger pop-up notification & email if a new order becomes available (ONLY if driver is online/AVAILABLE)
        if (list.length > 0 && selectedDriver.status === 'AVAILABLE') {
          const lastOrder = list[list.length - 1];
          
          if (lastNotifiedOrderIdRef.current !== lastOrder.id) {
            lastNotifiedOrderIdRef.current = lastOrder.id;

            // Dispatch email notification to drivers
            sendDriverNewOrderEmail(lastOrder, db).catch(err => {
              console.error('Error sending driver notification email:', err);
            });

            // Trigger push notification with sound alert for driver
            notificationService.sendPushNotification({
              title: `🏍️ ¡Nuevo Pedido Disponible en ${lastOrder.restaurantName}!`,
              body: `Dirección de entrega: ${(lastOrder as any).deliveryAddress || 'Domicilio del cliente'}. Pago: $${lastOrder.driverPaymentRate ?? 10}`,
              icon: '/favicon.ico',
              tag: lastOrder.id,
              soundType: 'new_order',
              type: 'order'
            });
            onAudioAlert();
            setShowNotification(lastOrder);
          }
        } else {
          lastNotifiedOrderIdRef.current = null;
          setShowNotification(null);
        }
      },
      (err) => {
        console.error("Error listening to available orders:", err);
      }
    );

    // 3. Listen for orders assigned to this driver that are not yet finished
    const qMyDeliveries = query(
      collection(db, 'orders'),
      where('driverId', '==', selectedDriver.id)
    );

    const unsubscribeMyDeliveries = onSnapshot(
      qMyDeliveries, 
      (snapshot) => {
        const actives: Order[] = [];
        const unpaids: Order[] = [];
        snapshot.forEach((docSnap) => {
          const ord = { id: docSnap.id, ...docSnap.data() } as Order;
          if (ord.status !== 'DELIVERED' && ord.status !== 'CANCELLED') {
            actives.push(ord);
          } else if (ord.status === 'DELIVERED' && ord.cashierPaid !== true) {
            unpaids.push(ord);
          }
        });
        setActiveOrders(actives);
        setUnpaidDeliveredOrders(unpaids);
      },
      (err) => {
        console.error("Error listening to driver deliveries:", err);
      }
    );

    return () => {
      unsubscribeDriver();
      unsubscribeAvailable();
      unsubscribeMyDeliveries();
    };
  }, [selectedDriver?.id, selectedDriver?.status, selectedDriver?.city, restaurantCityMap]);

  // Accept a Delivery
  const handleAcceptDelivery = async (orderId: string) => {
    if (!selectedDriver) return;

    // Check: Limit of 3 combined UNPAID orders (unpaid active + unpaid delivered)
    const unpaidActiveOrders = activeOrders.filter(o => o.cashierPaid !== true);
    const totalDriverCount = unpaidActiveOrders.length + unpaidDeliveredOrders.length;

    if (totalDriverCount >= 3) {
      alert(
        `⚠️ Límite Alcanzado (3/3): No puedes asignarte más pedidos.\n\n` +
        `Tienes ${unpaidActiveOrders.length} pedido(s) activo(s) sin pagar en caja y ${unpaidDeliveredOrders.length} pedido(s) entregado(s) pendiente(s) de liquidar.\n\n` +
        `💡 Para liberar espacio en tu carga (3/3), entrega el pago en efectivo a la cajera del restaurante para que lo registre en su sistema.`
      );
      return;
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'ASSIGNED',
        driverId: selectedDriver.id,
        driverName: selectedDriver.name,
        driverPhone: selectedDriver.phone,
        updatedAt: Date.now()
      });
      
      // Update driver status in db
      const driverRef = doc(db, 'drivers', selectedDriver.id);
      await updateDoc(driverRef, { status: 'DELIVERING' });
      
      setSelectedDriver({
        ...selectedDriver,
        status: 'DELIVERING'
      });
      
      setShowNotification(null);
      alert('¡Pedido aceptado con éxito! Ve al restaurante por los productos.');
    } catch (err) {
      console.error('Error accepting order:', err);
      alert('Este pedido ya fue tomado por otro repartidor o hubo un error.');
    }
  };

  // Change Order Status
  const handleUpdateStatus = async (orderId: string, nextStatus: 'SHIPPED' | 'DELIVERED') => {
    if (!selectedDriver) return;
    const currentOrder = activeOrders.find(o => o.id === orderId);

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: nextStatus,
        updatedAt: Date.now()
      });

      if (nextStatus === 'DELIVERED') {
        // Change driver status back to AVAILABLE
        const driverRef = doc(db, 'drivers', selectedDriver.id);
        await updateDoc(driverRef, { status: 'AVAILABLE' });
        setSelectedDriver({
          ...selectedDriver,
          status: 'AVAILABLE'
        });
        alert('¡Felicidades! Pedido marcado como ENTREGADO con éxito.');
      } else if (nextStatus === 'SHIPPED') {
        alert('📦 Pedido marcado como Recogido y en Camino.');
      }
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-4"></div>
        <p className="text-slate-500 font-semibold">Cargando Repartidores...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-6 bg-white min-h-[85vh] rounded-[36px] border border-gray-200 shadow-md overflow-hidden flex flex-col justify-between" id="driver_phone_simulator">
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialRole="driver" 
        onAuthSuccess={() => {}} 
        initialRegister={authModalRegisterMode}
      />

      {/* Edit Driver Profile Modal */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 my-auto text-left">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-orange-100 text-brand-primary rounded-2xl shadow-2xs">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">Editar Perfil de Repartidor</h3>
                  <p className="text-xs text-slate-500 font-medium">Actualiza tu ciudad, foto y datos de contacto</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsEditProfileModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDriverProfile} className="space-y-4">
              {/* Photo Upload / Selection */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Foto de Perfil
                </label>
                <div className="relative w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-brand-primary shadow-sm group bg-white mb-3">
                  <img 
                    src={getDriverPhotoUrl(editPhoto)} 
                    alt="Foto Repartidor" 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_DRIVER_AVATAR; }}
                  />
                  <label 
                    htmlFor="driver-photo-upload" 
                    className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer text-white"
                    title="Cambiar foto"
                  >
                    <Camera className="w-6 h-6" />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <label 
                    htmlFor="driver-photo-upload" 
                    className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir Foto
                  </label>
                  <input 
                    id="driver-photo-upload" 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageFileUpload} 
                    className="hidden" 
                  />
                  {editPhoto !== '/driver-silhouette.jpg' && (
                    <button
                      type="button"
                      onClick={() => setEditPhoto('/driver-silhouette.jpg')}
                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-xl transition cursor-pointer"
                    >
                      Silueta Predeterminada
                    </button>
                  )}
                </div>
              </div>

              {/* City Selection Dropdown (Super Admin Cities) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ciudad Perteneciente *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-primary">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <select
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    required
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 font-extrabold text-sm rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition cursor-pointer appearance-none"
                  >
                    <option value="" disabled>-- Selecciona una ciudad --</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.name} className="py-2 font-bold text-slate-800">
                        {c.name}
                      </option>
                    ))}
                    {cities.length === 0 && (
                      <>
                        <option value="Ciudad de México">Ciudad de México</option>
                        <option value="Guadalajara">Guadalajara</option>
                        <option value="Monterrey">Monterrey</option>
                        <option value="Puebla">Puebla</option>
                      </>
                    )}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  Ciudades dadas de alta en el sistema por el Super Administrador
                </p>
              </div>

              {/* Driver Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre Completo *
                </label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  placeholder="Tu nombre completo"
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-slate-800 font-bold text-sm rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Número de Teléfono *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input 
                    type="tel" 
                    value={editPhone} 
                    onChange={(e) => setEditPhone(e.target.value)}
                    required
                    placeholder="Ej. 5512345678"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 focus:bg-white text-slate-800 font-bold text-sm rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
                  />
                </div>
              </div>

              {/* Vehicle Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Vehículo
                  </label>
                  <select
                    value={editVehicle}
                    onChange={(e) => setEditVehicle(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 focus:border-brand-primary transition"
                  >
                    <option value="Motorcycle">Motocicleta</option>
                    <option value="Bicycle">Bicicleta</option>
                    <option value="Car">Automóvil</option>
                    <option value="Other">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Placas / Licencia
                  </label>
                  <input 
                    type="text" 
                    value={editLicense} 
                    onChange={(e) => setEditLicense(e.target.value)}
                    placeholder="Ej. ABC-123"
                    className="w-full px-3 py-2.5 bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 focus:border-brand-primary transition"
                  />
                </div>
              </div>

              {/* Working Zone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Zona de Trabajo
                </label>
                <input 
                  type="text" 
                  value={editWorkingZone} 
                  onChange={(e) => setEditWorkingZone(e.target.value)}
                  placeholder="Ej. Zona Centro, Col. Roma, Norte"
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white text-slate-800 font-bold text-sm rounded-xl border border-slate-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold rounded-2xl text-xs transition shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingProfile ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver login/simulation selection */}
      <div className="bg-gradient-to-br from-brand-primary via-orange-600 to-orange-700 p-5 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-white/95 px-3 py-1.5 rounded-2xl text-slate-900 shadow-sm">
            <Logo size="sm" />
          </div>
          <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
            Repartidores
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 border border-white shrink-0 flex items-center justify-center">
              {selectedDriver ? (
                <img 
                  src={getDriverPhotoUrl(selectedDriver.photo)} 
                  alt={selectedDriver.name} 
                  className="w-full h-full object-cover bg-white" 
                  referrerPolicy="no-referrer" 
                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_DRIVER_AVATAR; }}
                />
              ) : (
                <User className="w-5 h-5 text-white/80" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {currentUser && userProfile ? (
                <div>
                  <label className="block text-[10px] text-orange-200 uppercase font-black flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-orange-200 shrink-0" /> Cuenta Protegida:
                  </label>
                  <div className="font-extrabold text-white text-sm mt-0.5 truncate">
                    {selectedDriver?.name}
                  </div>
                  {selectedDriver?.city && (
                    <div className="text-[10px] text-orange-100 font-bold flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5 text-orange-200 shrink-0" />
                      <span className="truncate">{selectedDriver.city}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] text-orange-100 uppercase font-black">Acceso de Repartidor</label>
                  <div className="text-white text-xs font-semibold mt-0.5">
                    Inicia sesión o crea tu cuenta
                  </div>
                </div>
              )}
            </div>
          </div>

          {currentUser && userProfile && selectedDriver && (
            <button
              type="button"
              onClick={handleOpenEditProfileModal}
              className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase px-2.5 py-1.5 rounded-xl border border-white/30 backdrop-blur-xs transition cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs hover:scale-105 active:scale-95"
              title="Editar mi perfil, ciudad, foto y teléfono"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar Perfil
            </button>
          )}
        </div>

        {/* Driver Auth Buttons */}
        <div className="mt-3.5 pt-3.5 border-t border-orange-500/30 flex justify-between items-center">
          {currentUser && userProfile ? (
            <button
              onClick={async () => {
                if (selectedDriver) {
                  try {
                    await updateDoc(doc(db, 'drivers', selectedDriver.id), { status: 'OFFLINE' });
                  } catch (e) {
                    console.error("Error setting driver offline on logout:", e);
                  }
                }
                signOut(auth);
              }}
              className="w-full py-1.5 bg-orange-900/40 hover:bg-orange-900/60 text-white rounded-lg text-[10px] font-black uppercase transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3 h-3 text-orange-200" /> Cerrar Sesión Privada
            </button>
          ) : (
            <div className="w-full flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setAuthModalRegisterMode(false);
                  setIsAuthModalOpen(true);
                }}
                className="flex-1 py-1.5 bg-white text-brand-primary hover:bg-orange-50 rounded-lg text-[10px] font-black uppercase shadow-xs transition cursor-pointer text-center"
              >
                Inicia Sesión
              </button>
              <button
                onClick={() => {
                  setAuthModalRegisterMode(true);
                  setIsAuthModalOpen(true);
                }}
                className="flex-1 py-1.5 bg-orange-950/40 hover:bg-orange-950/60 text-white border border-orange-400/30 rounded-lg text-[10px] font-black uppercase transition cursor-pointer text-center"
              >
                Crear Cuenta
              </button>
            </div>
          )}
        </div>

        {selectedDriver && (
          <div className={`mt-3 flex justify-between items-center rounded-xl px-3 py-2 text-xs transition-colors duration-250 border ${
            selectedDriver.status === 'AVAILABLE' 
              ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-200' 
              : selectedDriver.status === 'DELIVERING'
                ? 'bg-blue-950/40 border-blue-500/20 text-blue-200'
                : selectedDriver.status === 'SUSPENDED'
                  ? 'bg-rose-950/40 border-rose-500/20 text-rose-200'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${
                selectedDriver.status === 'AVAILABLE' 
                  ? 'bg-emerald-400 animate-pulse' 
                  : selectedDriver.status === 'DELIVERING'
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-slate-400'
              }`}></span>
              <span className="text-white font-extrabold flex items-center gap-1.5">
                {selectedDriver.status === 'AVAILABLE' ? (
                  'Disponible para pedidos'
                ) : selectedDriver.status === 'DELIVERING' ? (
                  'En Ruta de Entrega'
                ) : selectedDriver.status === 'SUSPENDED' ? (
                  'Cuenta Suspendida'
                ) : (
                  'Sesión Cerrada (Inactivo)'
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedDriver.status !== 'DELIVERING' && selectedDriver.status !== 'SUSPENDED' && (
                <button
                  onClick={async () => {
                    try {
                      const nextStatus = selectedDriver.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
                      await updateDoc(doc(db, 'drivers', selectedDriver.id), {
                        status: nextStatus
                      });
                      setSelectedDriver(prev => prev ? { ...prev, status: nextStatus } : null);
                    } catch (e) {
                      console.error("Error toggling driver session:", e);
                    }
                  }}
                  className={`text-[10px] font-black uppercase px-2 py-1 rounded-md transition cursor-pointer select-none ${
                    selectedDriver.status === 'AVAILABLE'
                      ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/30'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {selectedDriver.status === 'AVAILABLE' ? 'Desconectar' : 'Conectar'}
                </button>
              )}
              <span className="text-white font-mono bg-orange-700/60 px-1.5 py-0.5 rounded text-[10px] font-bold">
                ⭐ {selectedDriver.rating}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Panel Body */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${(!selectedDriver || selectedDriver.status === 'OFFLINE') ? 'flex flex-col items-center justify-center' : ''}`}>
        {!selectedDriver ? (
          <div className="py-12 flex flex-col items-center max-w-[280px] text-center animate-fadeIn">
            <div className="h-16 w-16 rounded-full bg-orange-50 flex items-center justify-center text-brand-primary mb-4 animate-pulse">
              <Lock className="w-8 h-8" />
            </div>
            <h4 className="font-extrabold text-slate-700 text-sm uppercase tracking-wider">Sesión Cerrada</h4>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              Inicia sesión o regístrate con una cuenta nueva de repartidor para comenzar a realizar entregas.
            </p>
            <button
              onClick={() => {
                setAuthModalRegisterMode(false);
                setIsAuthModalOpen(true);
              }}
              className="mt-6 w-full py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold rounded-xl shadow-md transition text-xs cursor-pointer"
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => {
                setAuthModalRegisterMode(true);
                setIsAuthModalOpen(true);
              }}
              className="mt-2.5 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl border border-slate-250 transition text-xs cursor-pointer"
            >
              Crear Cuenta Nueva
            </button>
          </div>
        ) : selectedDriver.status === 'OFFLINE' ? (
          <div className="py-12 flex flex-col items-center max-w-[280px] text-center animate-fadeIn">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 animate-pulse">
              <Power className="w-8 h-8" />
            </div>
            <h4 className="font-extrabold text-slate-700 text-sm uppercase tracking-wider">Tu sesión está cerrada</h4>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              No recibirás alertas de nuevos pedidos ni podrás realizar entregas hasta que te conectes.
            </p>
            <button
              onClick={async () => {
                try {
                  await updateDoc(doc(db, 'drivers', selectedDriver.id), {
                    status: 'AVAILABLE'
                  });
                  setSelectedDriver(prev => prev ? { ...prev, status: 'AVAILABLE' } : null);
                } catch (e) {
                  console.error("Error connecting driver:", e);
                }
              }}
              className="mt-6 w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl shadow-md transition text-xs cursor-pointer"
            >
              Conectarse (Disponible)
            </button>
          </div>
        ) : (
          <>
            {/* Driver Debt status alert */}
            {selectedDriver && (() => {
              const unpaidActiveOrders = activeOrders.filter(o => o.cashierPaid !== true);
              const paidActiveOrders = activeOrders.filter(o => o.cashierPaid === true);
              const totalDriverCount = unpaidActiveOrders.length + unpaidDeliveredOrders.length;
              const totalDeliveredDebt = unpaidDeliveredOrders.reduce((sum, o) => sum + o.total, 0);

              if (totalDriverCount === 0 && paidActiveOrders.length === 0) return null;

              return (
                <div className={`p-4 rounded-2xl border flex flex-col gap-2 animate-fadeIn ${
                  totalDriverCount >= 3 
                    ? 'bg-rose-50 border-rose-200 text-rose-900' 
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  <div className="flex items-center justify-between font-extrabold text-xs uppercase tracking-wide">
                    <span className="flex items-center gap-1.5">
                      <span className="text-base">⚠️</span> 
                      {totalDriverCount >= 3 ? 'LÍMITE ALCANZADO (3/3 PEDIDOS)' : 'ESTADO DE CARGA Y PAGOS'}
                    </span>
                    <span className="bg-white/80 px-2 py-0.5 rounded-full font-mono text-[11px] font-black border border-current">
                      Carga: {totalDriverCount}/3
                    </span>
                  </div>
                  <p className="text-xs">
                    Carga sin pagar: <strong className="font-black">{unpaidActiveOrders.length}</strong> activo(s) y <strong className="font-black">{unpaidDeliveredOrders.length}</strong> entregado(s).
                    {paidActiveOrders.length > 0 && (
                      <span className="text-emerald-700 font-extrabold block mt-0.5">
                        ✅ {paidActiveOrders.length} pedido(s) activo(s) pagado(s) por adelantado en caja (espacio liberado).
                      </span>
                    )}
                  </p>
                  {totalDeliveredDebt > 0 && (
                    <div className="flex justify-between items-center mt-1 pt-2 border-t border-dashed border-current text-xs">
                      <span className="font-semibold">Monto entregado pendiente de liquidar en caja:</span>
                      <span className="font-black text-sm">${totalDeliveredDebt}</span>
                    </div>
                  )}
                  {totalDriverCount >= 3 ? (
                    <p className="text-[10px] text-rose-600 font-extrabold mt-1">
                      ❌ Límite alcanzado (3/3). Paga a la cajera por adelantado tus pedidos activos o liquida los entregados para liberar espacios.
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-700 font-bold mt-1">
                      💡 Límite: Máximo 3 pedidos pendientes de pago en caja. Al pagar tus pedidos activos a la cajera, se libera espacio al instante.
                    </p>
                  )}
                </div>
              );
            })()}
            
            {/* Realtime Pop-Up Notification Alert */}
            {showNotification && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 shadow-lg animate-bounce flex flex-col gap-3">
                <div className="flex items-center justify-between text-amber-800">
                  <div className="flex items-center gap-1.5 font-extrabold text-sm uppercase tracking-wide">
                    <BellRing className="w-4 h-4 animate-swing text-brand-primary" />
                    ¡Nueva Entrega Disponible!
                  </div>
                  <span className="bg-amber-200 text-amber-800 text-[10px] font-black px-1.5 py-0.5 rounded">
                    Listo para Recoger
                  </span>
                </div>
                
                <div>
                  <h4 className="font-extrabold text-slate-800 text-base">{showNotification.restaurantName}</h4>
                  <p className="text-slate-600 text-xs mt-1 flex items-center">
                    <MapPin className="w-3.5 h-3.5 text-brand-primary mr-1" />
                    {(showNotification as any).deliveryAddress || 'Dirección de entrega'}
                  </p>
                  <div className="mt-3 flex justify-between items-center text-xs">
                    <span className="text-slate-500">Pago contra entrega</span>
                    <span className="text-emerald-600 font-bold text-sm">Ganas: ${showNotification.driverPaymentRate ?? 10}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNotification(null)}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 rounded-xl text-xs transition"
                  >
                    Ignorar
                  </button>
                  <button
                    onClick={() => handleAcceptDelivery(showNotification.id)}
                    className="flex-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1"
                  >
                    Aceptar Pedido <Truck className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* My Current Delivery (Active Orders) */}
            <div>
              <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">
                Mis Entregas Activas ({activeOrders.length})
              </h3>
              
              {activeOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-150 p-8 text-center text-slate-400">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">No tienes ningún pedido en curso.</p>
                  <p className="text-[10px] mt-1 text-slate-400">Los pedidos listos aparecerán aquí para ser tomados.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeOrders.map((order) => {
                    const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
                    return (
                      <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              order.status === 'ASSIGNED' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {order.status === 'ASSIGNED' ? 'ASIGNADO - Ir al local' : 'EN CAMINO'}
                            </span>
                            <h4 className="font-bold text-slate-800 text-base mt-2">{order.restaurantName}</h4>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-mono">ID: {order.id.slice(0, 5)}</span>
                            <span className="font-black text-emerald-600 text-sm">Ganas: ${order.driverPaymentRate ?? 10}</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2 border border-slate-100">
                          <div>
                            <strong className="text-slate-500 block uppercase text-[9px] font-bold">Cliente</strong>
                            <span className="font-bold text-slate-700">{order.customerName}</span>
                          </div>
                          <div>
                            <strong className="text-slate-500 block uppercase text-[9px] font-bold">Teléfono</strong>
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" /> {order.customerPhone}
                            </span>
                          </div>
                          <div>
                            <strong className="text-slate-500 block uppercase text-[9px] font-bold">Dirección de Entrega</strong>
                            <span className="font-bold text-slate-700 flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-brand-primary shrink-0" />
                              {(order as any).deliveryAddress || 'Dirección de Entrega'}
                            </span>
                          </div>
                          {order.notes && (
                            <div>
                              <strong className="text-slate-500 block uppercase text-[9px] font-bold">Instrucciones Especiales</strong>
                              <span className="text-slate-600 italic">"{order.notes}"</span>
                            </div>
                          )}

                          <div className="border-t border-slate-100 pt-2.5 mt-2">
                            <strong className="text-orange-800 block uppercase text-[9px] font-black tracking-wider mb-1">📋 Platillos en este Pedido:</strong>
                            <div className="space-y-1.5 mt-1 bg-white p-2.5 rounded-xl border border-slate-200">
                              {order.items.map((it, idx) => (
                                <div key={idx} className="text-xs text-slate-700 flex flex-col border-b border-slate-100 pb-1.5 last:border-none last:pb-0">
                                  <div className="flex justify-between items-start font-bold">
                                    <span>
                                      <span className="text-brand-primary font-extrabold">{it.quantity}x</span> {it.name}
                                    </span>
                                    <span className="font-mono text-slate-500 text-[11px]">${it.price * it.quantity}</span>
                                  </div>
                                  {it.notes && (
                                    <span className="text-[10px] text-amber-600 italic bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 border border-amber-100/30">
                                      Especificación: "{it.notes}"
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between items-center">
                            <div>
                              <strong className="text-slate-500 block uppercase text-[9px] font-bold">Monto a Cobrar al Cliente</strong>
                              <span className="font-black text-slate-800 text-sm">${order.total} (Efectivo)</span>
                            </div>
                            <div className="text-right">
                              <strong className="text-slate-500 block uppercase text-[9px] font-bold">Tu Ganancia</strong>
                              <span className="font-black text-emerald-600 text-sm">${order.driverPaymentRate ?? 10}</span>
                            </div>
                          </div>

                          {/* Cashier Payment Status Info (Exclusive to cashier role) */}
                          <div className="pt-2 border-t border-slate-200">
                            {order.cashierPaid ? (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-emerald-800 text-[11px] font-bold flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>Pagado a Cajera por Adelantado</span>
                                </span>
                                <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Espacio Liberado
                                </span>
                              </div>
                            ) : (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-900 text-[11px] font-medium space-y-1">
                                <div className="font-extrabold text-amber-800 flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Pendiente de Pago en Caja</span>
                                  </span>
                                  <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                                    Neto: ${Math.max(0, order.total - (order.driverPaymentRate ?? 10))}
                                  </span>
                                </div>
                                <p className="text-[10px] text-amber-700 leading-tight">
                                  💡 Si entregas ${Math.max(0, order.total - (order.driverPaymentRate ?? 10))} en efectivo a la cajera, ella registrará el pago en su pantalla y liberará 1 espacio de tu carga (3/3).
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons based on current state */}
                        {order.status === 'ASSIGNED' ? (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'SHIPPED')}
                            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs animate-pulse cursor-pointer"
                          >
                            <Navigation className="w-4 h-4" /> Marcar: Recogido y En Camino
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" /> Marcar como ENTREGADO y Cobrado
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Nearby / Available orders to take list */}
            <div>
              {(() => {
                const unpaidActiveOrders = activeOrders.filter(o => o.cashierPaid !== true);
                const totalDriverCount = unpaidActiveOrders.length + unpaidDeliveredOrders.length;
                const isLimitReached = totalDriverCount >= 3;

                return (
                  <>
                    <div className="mb-3">
                      <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center justify-between">
                        <span>Pedidos para Recoger Disponibles ({availableDeliveries.length})</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          isLimitReached
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          Carga: {totalDriverCount}/3
                        </span>
                      </h3>
                      {selectedDriver.city && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span>Ciudad activa: <strong className="text-slate-800">{selectedDriver.city}</strong> (Solo ves pedidos de tu ciudad)</span>
                        </div>
                      )}
                    </div>

                    {availableDeliveries.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-slate-400 text-xs">
                        <RefreshCw className="w-5 h-5 mx-auto mb-2 text-slate-300 animate-spin" />
                        Esperando que los restaurantes {selectedDriver.city ? `de ${selectedDriver.city}` : ''} terminen de preparar pedidos...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availableDeliveries.map((order) => {
                          return (
                            <div key={order.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex justify-between items-center gap-4">
                              <div className="flex-1">
                                <h5 className="font-bold text-slate-800 text-sm">{order.restaurantName}</h5>
                                <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">{(order as any).deliveryAddress || 'Domicilio'}</p>
                                <span className="text-[10px] text-emerald-600 font-extrabold mt-1 block">Pago: ${order.driverPaymentRate ?? 10}</span>
                              </div>
                              <button
                                onClick={() => handleAcceptDelivery(order.id)}
                                className={`font-extrabold px-3 py-1.5 rounded-lg text-xs transition shrink-0 shadow-xs cursor-pointer ${
                                  isLimitReached
                                    ? 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                                }`}
                              >
                                {isLimitReached ? 'Límite 3/3' : 'Tomar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* Driver Footer Stats info */}
      <div className="bg-white border-t border-slate-200 p-4 shrink-0 flex items-center justify-between text-xs text-slate-500 font-semibold">
        <span>Mesa 22 Delivery v1.0</span>
        <span className="flex items-center gap-1 text-emerald-500">
          <CheckCircle className="w-4 h-4" /> Conectado en Tiempo Real
        </span>
      </div>
    </div>
  );
}
