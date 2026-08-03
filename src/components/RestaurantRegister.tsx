import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, getDocs } from '../firebase';
import { Restaurant, City } from '../types';
import Logo from './Logo';
import { CheckCircle, Store, Mail, Phone, MapPin, Clock, Globe, ShieldCheck, Upload, Check } from 'lucide-react';
import { compressImageFile } from '../utils/imageUtils';

export default function RestaurantRegister() {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Restaurantes🍽️');
  const [hours, setHours] = useState('11:00 - 22:00');
  const [deliveryZone, setDeliveryZone] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [plan, setPlan] = useState<'BASIC' | 'PREMIUM' | 'ENTERPRISE'>('BASIC');
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
    if (!name.trim() || !address.trim() || !phone.trim() || !email.trim() || !selectedCity) {
      alert('Por favor completa todos los campos requeridos (*), incluyendo la selección de tu ciudad.');
      return;
    }

    setLoading(true);
    
    const newRest: Omit<Restaurant, 'id'> = {
      name,
      logo: logo.trim() || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
      address,
      phone,
      email,
      category,
      hours,
      deliveryZone: deliveryZone || 'Área local 5km',
      city: selectedCity,
      socials: {
        facebook: facebook.trim() || undefined,
        instagram: instagram.trim() || undefined
      },
      status: 'PENDING',
      plan: 'BASIC',
      remainingDays: 30,
      remainingDaysUpdatedAt: Date.now(),
      rating: 5.0,
      reviewsCount: 0,
      deliveryTime: '25-40 min',
      deliveryFee: 0
    };

    try {
      await addDoc(collection(db, 'restaurants'), newRest);
      setSubmitted(true);
    } catch (err) {
      console.error('Error adding restaurant to Firestore:', err);
      alert('Hubo un error al registrar el restaurante. Intente de nuevo.');
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
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">¡Registro Recibido!</h2>
        <p className="text-slate-500 mt-3 text-base">
          El restaurante <strong>{name}</strong> ha sido registrado en nuestro sistema en estado <strong>Pendiente de Aprobación</strong>.
        </p>
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 my-6 text-left text-sm space-y-2">
          <h4 className="font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider text-xs">
            <ShieldCheck className="w-4 h-4 text-brand-primary" /> Próximos Pasos:
          </h4>
          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
            <li>Un Administrador General de Mesa 22 revisará tus datos.</li>
            <li>Se validará que la zona de reparto y el menú digital estén alineados.</li>
            <li>Recibirás un correo electrónico de confirmación con tus credenciales de acceso una vez aprobado.</li>
          </ol>
        </div>
        <button 
          onClick={() => {
            setSubmitted(false);
            setName('');
            setLogo('');
            setAddress('');
            setPhone('');
            setEmail('');
            setCategory('Tacos');
            setHours('11:00 - 22:00');
            setDeliveryZone('');
            setFacebook('');
            setInstagram('');
            setPlan('BASIC');
          }}
          className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold px-6 py-3 rounded-xl transition duration-150"
        >
          Registrar otro restaurante
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto my-8 px-4">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        {/* Banner */}
        <div className="bg-linear-to-r from-brand-primary to-orange-500 p-8 text-white relative">
          <div className="bg-white/95 p-3 rounded-2xl inline-block mb-4 shadow-sm">
            <Logo size="md" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Une tu restaurante a la plataforma</h1>
          <p className="text-orange-100 mt-2 text-sm max-w-lg">
            Suma tu negocio a la red de pedidos líder. Atrae más comensales, optimiza tu POS de mesa, automatiza inventarios y cocina en tiempo real.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Store className="w-5 h-5 text-brand-primary" /> Información del Negocio
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Restaurante *</label>
              <input 
                type="text" 
                required
                placeholder="Ej. Tacos El Torito"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
              />
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
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary bg-white font-bold"
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
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría del Establecimiento *</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary bg-white cursor-pointer font-medium text-slate-800"
              >
                <option value="Restaurantes🍽️">Restaurantes🍽️</option>
                <option value="Cafeterías☕/postres🍰">Cafeterías☕/postres🍰</option>
                <option value="Bares🍺">Bares🍺</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Logo del Restaurante (Subir desde dispositivo, Máx 10 MB)
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 hover:bg-slate-100/70 transition text-center relative cursor-pointer group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const compressedDataUrl = await compressImageFile(file, 500, 500, 0.82, 15);
                      setLogo(compressedDataUrl);
                    } catch (err: any) {
                      alert(err.message || 'Error al procesar la imagen del logo.');
                    }
                    e.target.value = '';
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="p-2 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-xl group-hover:scale-105 transition">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 block">
                      Haz clic para elegir el logo desde tu dispositivo
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                      Máximo 10 MB • Formatos: PNG, JPG, SVG, WEBP
                    </span>
                  </div>
                  {logo && (
                    <div className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[11px] font-extrabold">
                      <Check className="w-3 h-3 text-emerald-600" /> Logo cargado correctamente
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección Física *</label>
              <input 
                type="text" 
                required
                placeholder="Calle Hidalgo 450, Centro"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono de Atención *</label>
              <input 
                type="tel" 
                required
                placeholder="Ej. 55-1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Electrónico *</label>
              <input 
                type="email" 
                required
                placeholder="contacto@restaurante.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
              />
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 pt-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-primary" /> Operación y Entrega
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Horarios de Atención *</label>
              <input 
                type="text" 
                required
                placeholder="Ej. 12:00 - 23:00"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Zona de Reparto</label>
              <input 
                type="text" 
                placeholder="Ej. Cobertura 5km a la redonda"
                value={deliveryZone}
                onChange={(e) => setDeliveryZone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
              />
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 pt-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-primary" /> Redes Sociales
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Facebook URL</label>
              <input 
                type="url" 
                placeholder="https://facebook.com/tunegocio"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Instagram URL</label>
              <input 
                type="url" 
                placeholder="https://instagram.com/tunegocio"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
              />
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold py-4 rounded-2xl shadow-md transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Enviar Registro'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
