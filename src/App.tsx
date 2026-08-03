import { useState, useEffect } from 'react';
import { seedDatabase, auth, isGlobalQuotaExceeded, setGlobalQuotaExceeded } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import CustomerPortal from './components/CustomerPortal';
import RestaurantRegister from './components/RestaurantRegister';
import DriverRegister from './components/DriverRegister';
import DriverPortal from './components/DriverPortal';
import SuperAdminPortal from './components/SuperAdminPortal';
import RestaurantPortal from './components/RestaurantPortal';
import ErrorBoundary from './components/ErrorBoundary';
import PushNotificationBanner from './components/PushNotificationBanner';
import { notificationService } from './utils/notificationService';
import Logo from './components/Logo';
import { 
  Store, 
  Truck, 
  ShoppingBag, 
  Settings, 
  Award, 
  Bell, 
  HelpCircle,
  Menu,
  ChevronRight,
  UserPlus,
  Lock,
  LogOut
} from 'lucide-react';

type UserRole = 'customer' | 'restaurant_portal' | 'driver_portal' | 'super_admin' | 'register_restaurant' | 'register_driver';

export default function App() {
  const [activeRole, setActiveRole] = useState<UserRole>('customer');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  
  // Super Admin Login States
  const [isSuperAdminLoggedIn, setIsSuperAdminLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('isSuperAdminLoggedIn') === 'true';
  });

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(() => isGlobalQuotaExceeded());

  // Listen to Firestore Quota State changes
  useEffect(() => {
    const handleQuotaChange = () => {
      setIsQuotaExceeded(isGlobalQuotaExceeded());
    };
    window.addEventListener('m22_quota_state_changed', handleQuotaChange);
    // Periodically sync too
    const timer = setInterval(() => {
      setIsQuotaExceeded(isGlobalQuotaExceeded());
    }, 3000);
    return () => {
      window.removeEventListener('m22_quota_state_changed', handleQuotaChange);
      clearInterval(timer);
    };
  }, []);

  // Sync client/customer login state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);
  
  // Initialize and Seed database with mock restaurants & menus if Firestore is empty
  useEffect(() => {
    async function initialize() {
      try {
        await seedDatabase();
      } catch (err) {
        console.error('Error auto-seeding database', err);
      }
    }
    initialize();
  }, []);

  // Trigger a visual sound alert simulation
  const triggerAudioAlert = () => {
    notificationService.sendPushNotification({
      title: '🔔 ¡Mesa 22 Alerta!',
      body: 'Nuevo pedido listo para recoger en la cocina.',
      soundType: 'new_order',
      type: 'order'
    });
    setNotification('🔔 ¡Mesa 22 Alerta: Nuevo pedido listo para recoger!');
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  const handleNotifyOrderPlaced = () => {
    notificationService.sendPushNotification({
      title: '📝 ¡Nuevo Pedido Recibido!',
      body: 'Un cliente o mesero acaba de ingresar un pedido en la comanda.',
      soundType: 'new_order',
      type: 'order'
    });
    setNotification('📝 ¡Mesa 22 Alerta: Nuevo pedido recibido en la comanda!');
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between font-sans text-slate-950" id="app_root_layout">
      
      {/* GLOBAL PUSH NOTIFICATION SYSTEM */}
      <PushNotificationBanner />
      
      {isQuotaExceeded && (
        <div className="bg-amber-500 text-white text-xs font-bold px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between shadow-xs border-b border-amber-600/10 shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-white animate-pulse shrink-0"></span>
            <span>
              <strong>Modo de Simulación Local Activo:</strong> Se ha alcanzado la cuota de lectura diaria de Firebase de este proyecto. Mesa 22 guardará todos tus restaurantes, pedidos y configuraciones localmente en tu navegador para que puedas seguir probando todo.
            </span>
          </div>
          <button 
            onClick={() => {
              setGlobalQuotaExceeded(false);
              window.location.reload();
            }}
            className="bg-white/20 hover:bg-white/35 text-white px-2.5 py-1 rounded-md font-bold transition text-[10px] uppercase cursor-pointer shrink-0"
          >
            Reintentar Conexión
          </button>
        </div>
      )}

      {/* 1. STUDIO SIMULATOR HEADER CONTROL */}
      <header className="bg-white text-slate-900 shrink-0 shadow-xs border-b border-gray-200 sticky top-0 z-40 h-16 flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6 flex justify-between items-center gap-4">
          
          {/* Logo brand */}
          <div className="flex items-center gap-3">
            <Logo size="md" showSubtext={true} />
          </div>

          {/* Quick simulator info alerts */}
          {notification && (
            <div className="bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl animate-bounce shadow-sm flex items-center gap-1.5 border border-orange-500/20">
              <span className="flex h-2 w-2 rounded-full bg-white animate-pulse"></span>
              <span>{notification}</span>
            </div>
          )}

          {/* Simulation View Switcher Controls */}
          <nav className="hidden lg:flex items-center gap-1 bg-gray-100 p-1.5 rounded-full border border-gray-200 text-[11px] font-bold text-gray-600">
            <button
              onClick={() => { setActiveRole('customer'); setMobileMenuOpen(false); }}
              className={`px-3.5 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                activeRole === 'customer' ? 'bg-brand-primary text-white shadow-xs' : 'hover:text-slate-900 hover:bg-gray-200/65'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Portal Clientes
            </button>
            <button
              onClick={() => { setActiveRole('restaurant_portal'); setMobileMenuOpen(false); }}
              className={`px-3.5 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                activeRole === 'restaurant_portal' ? 'bg-brand-primary text-white shadow-xs' : 'hover:text-slate-900 hover:bg-gray-200/65'
              }`}
            >
              <Store className="w-3.5 h-3.5" /> Portal Restaurantes (POS)
            </button>
            <button
              onClick={() => { setActiveRole('driver_portal'); setMobileMenuOpen(false); }}
              className={`px-3.5 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                activeRole === 'driver_portal' ? 'bg-brand-primary text-white shadow-xs' : 'hover:text-slate-900 hover:bg-gray-200/65'
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Portal Repartidores
            </button>
            {isSuperAdminLoggedIn && (
              <>
                <button
                  onClick={() => { setActiveRole('super_admin'); setMobileMenuOpen(false); }}
                  className={`px-3.5 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                    activeRole === 'super_admin' ? 'bg-brand-primary text-white shadow-xs' : 'hover:text-slate-900 hover:bg-gray-200/65'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" /> Super Admin
                </button>
                <div className="h-4 w-px bg-gray-300 mx-1"></div>
                <button
                  onClick={() => {
                    setIsSuperAdminLoggedIn(false);
                    localStorage.removeItem('isSuperAdminLoggedIn');
                    if (activeRole === 'super_admin') {
                      setActiveRole('customer');
                    }
                  }}
                  className="px-3 py-1.5 rounded-full hover:bg-red-50 text-red-600 transition cursor-pointer flex items-center gap-1 hover:text-red-700"
                  title="Cerrar Sesión Super Admin"
                >
                  <LogOut className="w-3.5 h-3.5" /> Salir Admin
                </button>
              </>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-600 hover:text-slate-900"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white p-4 border-t border-gray-200 space-y-1.5 absolute top-16 left-0 right-0 shadow-lg z-50">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block px-3 mb-1">Simular Vista</span>
            <button
              onClick={() => { setActiveRole('customer'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 ${
                activeRole === 'customer' ? 'bg-brand-primary text-white' : 'text-slate-700 hover:bg-gray-50'
              }`}
            >
              <ShoppingBag className="w-4 h-4" /> Portal Clientes
            </button>
            <button
              onClick={() => { setActiveRole('restaurant_portal'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 ${
                activeRole === 'restaurant_portal' ? 'bg-brand-primary text-white' : 'text-slate-700 hover:bg-gray-50'
              }`}
            >
              <Store className="w-4 h-4" /> Portal Restaurantes (POS)
            </button>
            <button
              onClick={() => { setActiveRole('driver_portal'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 ${
                activeRole === 'driver_portal' ? 'bg-brand-primary text-white' : 'text-slate-700 hover:bg-gray-50'
              }`}
            >
              <Truck className="w-4 h-4" /> Portal Repartidores
            </button>
            {isSuperAdminLoggedIn && (
              <>
                <button
                  onClick={() => { setActiveRole('super_admin'); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 ${
                    activeRole === 'super_admin' ? 'bg-brand-primary text-white' : 'text-slate-700 hover:bg-gray-50'
                  }`}
                >
                  <Settings className="w-4 h-4" /> Super Admin
                </button>
                <button
                  onClick={() => {
                    setIsSuperAdminLoggedIn(false);
                    localStorage.removeItem('isSuperAdminLoggedIn');
                    setMobileMenuOpen(false);
                    if (activeRole === 'super_admin') {
                      setActiveRole('customer');
                    }
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Cerrar Sesión Admin
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {/* 2. SIMULATOR CONTEXT BAR NOTIFICATION */}
      {activeRole === 'customer' && !currentUser && (
        <div className="bg-orange-50 border-b border-orange-100 text-brand-primary py-2.5 text-xs font-extrabold shrink-0 overflow-hidden relative w-full flex items-center select-none">
          <div className="animate-marquee-custom whitespace-nowrap uppercase tracking-wider text-[11px] w-full">
            Inicia sesión o registrate para mostrarte solamente los restaurantes de tu ciudad
          </div>
        </div>
      )}

      {/* 3. MAIN PORTAL SWITCHBOARD AREA */}
      <main className="flex-1">
        <ErrorBoundary>
          {activeRole === 'customer' && (
            <CustomerPortal onNotifyOrderPlaced={handleNotifyOrderPlaced} />
          )}
          
          {activeRole === 'restaurant_portal' && (
            <RestaurantPortal 
              onSuperAdminLogin={() => {
                setIsSuperAdminLoggedIn(true);
                localStorage.setItem('isSuperAdminLoggedIn', 'true');
                setActiveRole('super_admin');
              }} 
            />
          )}

          {activeRole === 'driver_portal' && (
            <DriverPortal onAudioAlert={triggerAudioAlert} />
          )}

          {activeRole === 'super_admin' && (
            <SuperAdminPortal />
          )}

          {activeRole === 'register_restaurant' && (
            <RestaurantRegister />
          )}

          {activeRole === 'register_driver' && (
            <DriverRegister />
          )}
        </ErrorBoundary>
      </main>

      {/* 4. FOOTER */}
      <footer className="bg-white text-gray-500 py-8 px-6 text-center text-xs font-semibold shrink-0 border-t border-gray-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-800 text-sm">Mesa 22 SaaS</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-400 font-medium">Plataforma Operativa Todo-En-Uno</span>
          </div>
          <div className="flex gap-4 text-gray-400">
            {isSuperAdminLoggedIn && (
              <button 
                onClick={() => {
                  setIsSuperAdminLoggedIn(false);
                  localStorage.removeItem('isSuperAdminLoggedIn');
                  if (activeRole === 'super_admin') {
                    setActiveRole('customer');
                  }
                }} 
                className="hover:text-red-600 transition cursor-pointer"
              >
                Cerrar Sesión Admin
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
