import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, getDocs } from '../firebase';
import { Driver, City } from '../types';
import Logo from './Logo';
import { CheckCircle, Truck, User, Phone, Mail, MapPin, ClipboardList, ShieldCheck } from 'lucide-react';

export default function DriverRegister() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState('');
  const [vehicle, setVehicle] = useState<'Bicycle' | 'Motorcycle' | 'Car' | 'Other'>('Motorcycle');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [workingZone, setWorkingZone] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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
        if (list.length > 0) {
          setSelectedCity(list[0].name);
        }
      } catch (err) {
        console.error('Error fetching cities:', err);
      }
    };
    fetchCities();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim() || !workingZone.trim() || !selectedCity) {
      alert('Por favor completa todos los campos requeridos (*), incluyendo la selección de tu ciudad.');
      return;
    }

    setLoading(true);

    const newDriver: Omit<Driver, 'id'> = {
      name,
      phone,
      email,
      photo: photo.trim() || '/driver-silhouette.jpg',
      vehicle,
      licenseNumber: licenseNumber.trim() || '',
      workingZone,
      city: selectedCity,
      status: 'AVAILABLE', // Starts as available
      rating: 5.0
    };

    try {
      await addDoc(collection(db, 'drivers'), newDriver);
      setSubmitted(true);
    } catch (err) {
      console.error('Error adding driver to Firestore:', err);
      alert('Hubo un error al registrarte como repartidor. Intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl border border-slate-100 shadow-xl p-8 md:p-12 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">¡Registro Completado!</h2>
        <p className="text-slate-500 mt-3 text-base">
          Hola <strong>{name}</strong>, tus datos de repartidor han sido registrados con éxito en Mesa 22.
        </p>
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 my-6 text-left text-sm space-y-2">
          <h4 className="font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider text-xs">
            <ShieldCheck className="w-4 h-4 text-brand-primary" /> ¿Qué sigue ahora?
          </h4>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li>Tu perfil ha sido activado y está listo en la plataforma de entrega móvil.</li>
            <li>Puedes ingresar usando tu nombre en el portal de repartidores para recibir notificaciones de entregas.</li>
            <li>Cuando un restaurante marque un pedido como "Listo para recoger", lo verás aparecer en tiempo real en tu pantalla.</li>
          </ol>
        </div>
        <button 
          onClick={() => {
            setSubmitted(false);
            setName('');
            setPhone('');
            setEmail('');
            setPhoto('');
            setVehicle('Motorcycle');
            setLicenseNumber('');
            setWorkingZone('');
          }}
          className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold px-6 py-3 rounded-xl transition duration-150"
        >
          Registrar otro repartidor
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto my-8 px-4">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        {/* Banner */}
        <div className="bg-linear-to-r from-emerald-500 to-teal-600 p-8 text-white relative">
          <div className="bg-white/95 p-3 rounded-2xl inline-block mb-4 shadow-sm">
            <Logo size="md" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Regístrate como Repartidor</h1>
          <p className="text-emerald-100 mt-2 text-sm max-w-lg">
            ¡Conviértete en tu propio jefe! Reparte pedidos locales con total flexibilidad, usando bicicleta, moto o auto. Obtén ganancias diarias competitivas de inmediato.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-500" /> Información Personal
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo *</label>
              <input 
                type="text" 
                required
                placeholder="Ej. Carlos Mendoza López"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono Móvil *</label>
              <input 
                type="tel" 
                required
                placeholder="Ej. 55-7777-8888"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Electrónico *</label>
              <input 
                type="email" 
                required
                placeholder="carlos@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fotografía URL (Opcional)</label>
              <input 
                type="url" 
                placeholder="https://ejemplo.com/repartidor.jpg"
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-emerald-500"
              />
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 pt-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500" /> Medio de Transporte y Zona
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Medio de Transporte *</label>
              <select 
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value as any)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-emerald-500 bg-white font-medium"
              >
                <option value="Motorcycle">Motocicleta</option>
                <option value="Bicycle">Bicicleta</option>
                <option value="Car">Automóvil</option>
                <option value="Other">Otro / Patín Eléctrico</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ciudad del Sistema *</label>
              {cities.length === 0 ? (
                <div className="text-rose-500 font-bold text-xs p-3 bg-rose-50 border border-rose-100 rounded-xl">
                  ⚠️ No hay ciudades disponibles. Pide al Super Admin que dé de alta una ciudad en el sistema.
                </div>
              ) : (
                <select 
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-emerald-500 bg-white font-bold"
                  required
                >
                  <option value="" disabled>Selecciona una ciudad</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Zona de Trabajo / Cobertura *</label>
              <input 
                type="text" 
                required
                placeholder="Ej. Zona Centro, Polanco, San Pedro, etc."
                value={workingZone}
                onChange={(e) => setWorkingZone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-emerald-500"
              />
            </div>

            {vehicle !== 'Bicycle' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número de Licencia de Conducir (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej. LIC-MX-823472"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-emerald-500"
                />
              </div>
            )}
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-4 rounded-2xl shadow-md transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Registrarse como Repartidor'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
