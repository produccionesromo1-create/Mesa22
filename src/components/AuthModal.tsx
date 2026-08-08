import React, { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth, db, doc, setDoc, getDoc, getDocs, collection } from '../firebase';
import Logo from './Logo';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  MapPin, 
  Store, 
  Clock, 
  Truck, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Sparkles,
  ArrowRight,
  Info,
  MessageCircle
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole: 'customer' | 'restaurant' | 'driver';
  onAuthSuccess: (user: any, role: string, profile: any) => void;
  initialRegister?: boolean;
}

export default function AuthModal({ isOpen, onClose, initialRole, onAuthSuccess, initialRegister }: AuthModalProps) {
  const [role, setRole] = useState<'customer' | 'restaurant' | 'driver'>(initialRole);
  const [isRegister, setIsRegister] = useState(initialRegister || false);

  useEffect(() => {
    if (isOpen) {
      setRole(initialRole);
      setIsRegister(initialRegister || false);
      setErrorMsg(null);
    }
  }, [isOpen, initialRole, initialRegister]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Common Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Restaurant specific
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [category, setCategory] = useState('Restaurantes🍽️');
  const [hours, setHours] = useState('11:00 - 22:00');
  const [openTime, setOpenTime] = useState('11:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [restDay, setRestDay] = useState('Ninguno');

  // Driver specific
  const [vehicle, setVehicle] = useState<'Bicycle' | 'Motorcycle' | 'Car' | 'Other'>('Motorcycle');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [workingZone, setWorkingZone] = useState('');

  // Cities selection
  const [cities, setCities] = useState<any[]>([]);
  const [selectedCity, setSelectedCity] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const fetchCities = async () => {
      try {
        const snap = await getDocs(collection(db, 'cities'));
        const list: any[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCities(list);
        if (list.length > 0) {
          setSelectedCity(list[0].name);
        }
      } catch (err) {
        console.error('Error fetching cities in AuthModal:', err);
      }
    };
    fetchCities();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isRegister) {
        // Validation
        if (role === 'restaurant') {
          if (!email || !password || !restaurantName || !ownerName || !phone || !selectedCity) {
            throw new Error('Por favor completa todos los campos obligatorios (nombre de restaurante, propietario, teléfono, ciudad, correo y contraseña).');
          }
        } else {
          if (!email || !password || !name || !phone || !selectedCity) {
            throw new Error('Por favor completa todos los campos obligatorios, incluyendo la selección de tu ciudad.');
          }
        }

        // 1. Create firebase auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Write profile to Firestore
        let profileData: any = {};
        let collectionName = '';

        if (role === 'customer') {
          collectionName = 'customers';
          profileData = {
            id: user.uid,
            name,
            email,
            phone,
            address,
            city: selectedCity,
            createdAt: Date.now()
          };
        } else if (role === 'restaurant') {
          collectionName = 'restaurants';
          profileData = {
            id: user.uid, // Use uid as document id
            name: restaurantName,
            ownerName,
            logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
            address,
            phone,
            email,
            category,
            hours: hours || `${openTime} - ${closeTime}`,
            openTime: openTime || '11:00',
            closeTime: closeTime || '22:00',
            restDay: restDay || 'Ninguno',
            deliveryZone: 'Área local 5km',
            city: selectedCity,
            socials: {},
            status: 'APPROVED', // Auto approved for demo
            plan: 'BASIC',
            remainingDays: 30,
            remainingDaysUpdatedAt: Date.now(),
            rating: 5.0,
            reviewsCount: 0,
            deliveryTime: '25-40 min',
            deliveryFee: 0,
            createdAt: Date.now()
          };
        } else if (role === 'driver') {
          collectionName = 'drivers';
          profileData = {
            id: user.uid,
            name,
            phone,
            email,
            photo: '/driver-silhouette.jpg',
            vehicle,
            licenseNumber: licenseNumber || '',
            workingZone: workingZone || 'Zona Central',
            city: selectedCity,
            status: 'AVAILABLE',
            rating: 5.0,
            createdAt: Date.now()
          };
        }

        await setDoc(doc(db, collectionName, user.uid), profileData);
        onAuthSuccess(user, role, profileData);
        onClose();
      } else {
        // Sign In
        if (!email || !password) {
          throw new Error('Por favor ingresa correo electrónico y contraseña.');
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Fetch profile
        let collectionName = role === 'customer' ? 'customers' : role === 'restaurant' ? 'restaurants' : 'drivers';
        let profileDoc = await getDoc(doc(db, collectionName, user.uid));
        let profile = profileDoc.exists() ? profileDoc.data() : null;

        // If profile doesn't exist but we are signed in, let's create a default one
        if (!profile) {
          profile = {
            id: user.uid,
            name: user.displayName || email.split('@')[0],
            email: email,
            phone: '55-0000-0000',
            address: '',
          };
          if (role === 'restaurant') {
            profile = {
              ...profile,
              logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
              category: 'Tacos',
              hours: '11:00 - 22:00',
              deliveryZone: 'Área local 5km',
              status: 'APPROVED',
              plan: 'BASIC',
              remainingDays: 30,
              remainingDaysUpdatedAt: Date.now(),
              rating: 5.0,
              reviewsCount: 0,
              deliveryTime: '25-40 min',
              deliveryFee: 0
            };
          } else if (role === 'driver') {
            profile = {
              ...profile,
              photo: '/driver-silhouette.jpg',
              vehicle: 'Motorcycle',
              workingZone: 'Zona Central',
              status: 'AVAILABLE',
              rating: 5.0
            };
          }
          await setDoc(doc(db, collectionName, user.uid), profile);
        }

        onAuthSuccess(user, role, profile);
        onClose();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      // Simplify translation
      let msg = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Credenciales inválidas. Verifica tu correo y contraseña.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Este correo electrónico ya está registrado.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'El inicio de sesión con correo/contraseña no está habilitado en tu Firebase Console.';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Google Login helper
  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Handle profile fetching or creation
      let collectionName = role === 'customer' ? 'customers' : role === 'restaurant' ? 'restaurants' : 'drivers';
      let profileDoc = await getDoc(doc(db, collectionName, user.uid));
      let profile = profileDoc.exists() ? profileDoc.data() : null;

      if (!profile) {
        profile = {
          id: user.uid,
          name: user.displayName || 'Usuario Google',
          email: user.email || '',
          phone: user.phoneNumber || '55-0000-0000',
          address: '',
          createdAt: Date.now()
        };
        if (role === 'restaurant') {
          profile = {
            ...profile,
            logo: user.photoURL || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
            category: 'Otros',
            hours: '11:00 - 22:00',
            deliveryZone: 'Área local 5km',
            status: 'APPROVED',
            plan: 'BASIC',
            remainingDays: 30,
            remainingDaysUpdatedAt: Date.now(),
            rating: 5.0,
            reviewsCount: 0,
            deliveryTime: '25-40 min',
            deliveryFee: 0
          };
        } else if (role === 'driver') {
          profile = {
            ...profile,
            photo: user.photoURL || '/driver-silhouette.jpg',
            vehicle: 'Motorcycle',
            workingZone: 'Zona Central',
            status: 'AVAILABLE',
            rating: 5.0
          };
        }
        await setDoc(doc(db, collectionName, user.uid), profile);
      }

      onAuthSuccess(user, role, profile);
      onClose();
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setErrorMsg(err.message || 'Error al iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  // Demo Accounts Quick Access
  const demoAccounts = {
    customer: [
      { name: 'Juan Pérez (Prueba)', email: 'juan@ejemplo.com', phone: '55-1234-5678', address: 'Av. Juarez 100, CDMX' }
    ],
    restaurant: [
      { name: 'Tacos El Patrón', email: 'contacto@tacoselpatron.com', id: 'rest_1' },
      { name: 'Bella Italia Pizzas', email: 'admin@bellaitalia.com', id: 'rest_2' },
      { name: 'Sushi Zen Master', email: 'contacto@sushizen.com', id: 'rest_3' },
      { name: 'Burgers & Shakes 22', email: 'contacto@burgers22.com', id: 'rest_4' }
    ],
    driver: [
      { name: 'Carlos Mendoza', email: 'carlos.mendoza@mesa22.com', vehicle: 'Motorcycle' },
      { name: 'Lucía Fernández', email: 'lucia.f@mesa22.com', vehicle: 'Bicycle' },
      { name: 'Mario Robles', email: 'mario.robles@mesa22.com', vehicle: 'Car' }
    ]
  };

  const handleQuickDemoLogin = async (demo: any) => {
    setErrorMsg(null);
    setLoading(true);
    const demoPassword = 'Password123!'; // Hardcoded password for seed testing

    try {
      let user;
      try {
        // Try standard sign in first
        const userCredential = await signInWithEmailAndPassword(auth, demo.email, demoPassword);
        user = userCredential.user;
      } catch (signInErr: any) {
        // If user does not exist in Firebase Auth yet, automatically create it!
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
          const userCredential = await createUserWithEmailAndPassword(auth, demo.email, demoPassword);
          user = userCredential.user;
        } else {
          throw signInErr;
        }
      }

      // Check / Create profile in Firestore to ensure it exists
      let collectionName = role === 'customer' ? 'customers' : role === 'restaurant' ? 'restaurants' : 'drivers';
      let profileDoc = await getDoc(doc(db, collectionName, user.uid));
      let profile = profileDoc.exists() ? profileDoc.data() : null;

      if (!profile) {
        // Create matching document based on preset
        if (role === 'customer') {
          profile = {
            id: user.uid,
            name: demo.name,
            email: demo.email,
            phone: demo.phone,
            address: demo.address,
            createdAt: Date.now()
          };
        } else if (role === 'restaurant') {
          // If we matched a seeded restaurant, preserve its seed id or copy its settings
          let seedId = demo.id;
          let seedDoc = await getDoc(doc(db, 'restaurants', seedId));
          if (seedDoc.exists()) {
            profile = { ...seedDoc.data(), id: user.uid }; // migrate/bind to Auth UID
          } else {
            profile = {
              id: user.uid,
              name: demo.name,
              logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
              address: 'Av. Principal 123',
              phone: '55-1234-5678',
              email: demo.email,
              category: 'Tacos',
              hours: '11:00 - 23:00',
              deliveryZone: 'Área local',
              socials: {},
              status: 'APPROVED',
              plan: 'PREMIUM',
              remainingDays: 30,
              remainingDaysUpdatedAt: Date.now(),
              rating: 4.8,
              reviewsCount: 15,
              deliveryTime: '20-30 min',
              deliveryFee: 25
            };
          }
        } else if (role === 'driver') {
          profile = {
            id: user.uid,
            name: demo.name,
            phone: '55-7777-8888',
            email: demo.email,
            photo: '/driver-silhouette.jpg',
            vehicle: demo.vehicle,
            workingZone: 'Zona Centro',
            status: 'AVAILABLE',
            rating: 4.9
          };
        }
        await setDoc(doc(db, collectionName, user.uid), profile);
      }

      onAuthSuccess(user, role, profile);
      onClose();
    } catch (err: any) {
      console.error('Demo auth failed:', err);
      setErrorMsg(`Error en acceso demo: ${err.message}. Recuerda activar Correo/Contraseña en Authentication si usas un proyecto nuevo.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-[32px] border border-gray-200 shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col relative animate-scale-in">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-linear-to-r from-orange-50 to-amber-50/35">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div className="h-6 w-px bg-gray-200"></div>
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight">
                {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                Portal {role === 'customer' ? 'Clientes' : role === 'restaurant' ? 'Restaurantes' : 'Repartidores'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-slate-600 hover:bg-gray-100 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-2.5 text-xs text-rose-600 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}



          <form onSubmit={handleAuth} className="space-y-4">
            {/* Common fields for register */}
            {isRegister && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {role !== 'restaurant' ? (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre Completo *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 text-gray-300 w-4.5 h-4.5" />
                      <input
                        type="text"
                        placeholder="Ej. Juan Pérez"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-brand-primary text-slate-800"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre del Restaurante *</label>
                      <div className="relative">
                        <Store className="absolute left-3.5 top-3.5 text-gray-300 w-4.5 h-4.5" />
                        <input
                          type="text"
                          placeholder="Ej. Tacos El Torito"
                          value={restaurantName}
                          onChange={(e) => setRestaurantName(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-brand-primary text-slate-800"
                          required
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nombre del Administrador / Propietario *</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3.5 text-gray-300 w-4.5 h-4.5" />
                        <input
                          type="text"
                          placeholder="Ej. Juan Pérez"
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-brand-primary text-slate-800"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Teléfono Móvil *</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 text-gray-300 w-4.5 h-4.5" />
                    <input
                      type="text"
                      placeholder="Ej. 5512345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-brand-primary text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Dirección / Zona *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 text-gray-300 w-4.5 h-4.5" />
                    <input
                      type="text"
                      placeholder={role === 'driver' ? 'Ej. Polanco, Roma' : 'Calle, N°, Col, CDMX'}
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (role === 'driver') setWorkingZone(e.target.value);
                      }}
                      className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-brand-primary text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ciudad de Cobertura *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 text-emerald-500 w-4.5 h-4.5 z-10" />
                    {cities.length === 0 ? (
                      <div className="w-full bg-rose-50 text-rose-500 font-bold text-xs p-3.5 border border-rose-100 rounded-xl pl-11">
                        ⚠️ No hay ciudades de cobertura registradas. Contacta al Super Admin.
                      </div>
                    ) : (
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-brand-primary text-slate-800 font-bold"
                        required
                      >
                        <option value="" disabled>Selecciona tu ciudad</option>
                        {cities.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Restaurant specific fields */}
                {role === 'restaurant' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Categoría del Establecimiento *</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-brand-primary text-slate-800 cursor-pointer font-medium"
                      >
                        <option value="Restaurantes🍽️">Restaurantes🍽️</option>
                        <option value="Cafeterías☕/postres🍰">Cafeterías☕/postres🍰</option>
                        <option value="Bares🍺">Bares🍺</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Horario de Atención *</label>
                      <div className="relative">
                        <Clock className="absolute left-3.5 top-3.5 text-gray-300 w-4.5 h-4.5" />
                        <input
                          type="text"
                          placeholder="Ej. 11:00 - 22:00"
                          value={hours}
                          onChange={(e) => {
                            setHours(e.target.value);
                            const parts = e.target.value.split(/[-a]/);
                            if (parts.length >= 2) {
                              setOpenTime(parts[0].trim());
                              setCloseTime(parts[1].trim());
                            }
                          }}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-brand-primary text-slate-800 font-medium"
                          required
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Día de Descanso / Cierre Semanal *</label>
                      <select
                        value={restDay}
                        onChange={(e) => setRestDay(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-brand-primary text-slate-800 font-bold cursor-pointer"
                        required
                      >
                        <option value="Ninguno">Ninguno (Abierto todos los días)</option>
                        <option value="Lunes">Lunes</option>
                        <option value="Martes">Martes</option>
                        <option value="Miércoles">Miércoles</option>
                        <option value="Jueves">Jueves</option>
                        <option value="Viernes">Viernes</option>
                        <option value="Sábado">Sábado</option>
                        <option value="Domingo">Domingo</option>
                      </select>
                      <p className="text-[11px] text-gray-400 mt-1">El sistema mostrará una advertencia a los clientes y no permitirá pedidos a domicilio este día.</p>
                    </div>
                  </>
                )}

                {/* Driver specific fields */}
                {role === 'driver' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Vehículo de Reparto</label>
                      <select
                        value={vehicle}
                        onChange={(e) => setVehicle(e.target.value as any)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-brand-primary text-slate-800"
                      >
                        <option value="Motorcycle">🏍️ Motocicleta</option>
                        <option value="Bicycle">🚲 Bicicleta</option>
                        <option value="Car">🚗 Automóvil</option>
                        <option value="Other">📦 Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Número de Licencia</label>
                      <input
                        type="text"
                        placeholder="Ej. MX-12345"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-brand-primary text-slate-800"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Email field */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 text-gray-300 w-4.5 h-4.5" />
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-brand-primary text-slate-800"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-gray-300 w-4.5 h-4.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl py-3 pl-11 pr-11 text-sm focus:outline-brand-primary text-slate-800"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white py-3.5 rounded-xl font-black text-sm transition shadow-md hover:scale-[1.01] duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Procesando...
                </span>
              ) : isRegister ? (
                'Registrarse y Entrar'
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Social Sign In replaced with WhatsApp Support */}
          {!isRegister && (
            <div className="space-y-4">
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink mx-4 text-[10px] text-gray-300 font-extrabold uppercase tracking-widest">¿Necesitas ayuda?</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>

              <button
                type="button"
                onClick={() => window.open('https://wa.me/523951347469', '_blank')}
                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white py-3.5 rounded-xl font-black text-xs transition shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <MessageCircle className="w-5 h-5 shrink-0" />
                Chatear con soporte
              </button>
            </div>
          )}

          {/* Tip */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start gap-2.5 text-[11px] text-slate-500 font-medium">
            <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-700 block">Autenticación en Tiempo Real</span>
              Tus credenciales se procesan en vivo con Firebase Auth. Los registros nuevos se sincronizan de inmediato con la base de datos de Firestore.
            </div>
          </div>

        </div>

        {/* Footer info / Toggle mode */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 text-center shrink-0 text-xs">
          {isRegister ? (
            <p className="text-gray-500 font-medium">
              ¿Ya tienes cuenta?{' '}
              <button 
                onClick={() => { setIsRegister(false); setErrorMsg(null); }}
                className="text-brand-primary hover:underline font-black cursor-pointer"
              >
                Inicia sesión aquí
              </button>
            </p>
          ) : (
            <p className="text-gray-500 font-medium">
              ¿No tienes cuenta en este portal?{' '}
              <button 
                onClick={() => { setIsRegister(true); setErrorMsg(null); }}
                className="text-brand-primary hover:underline font-black cursor-pointer"
              >
                Regístrate gratis
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
