import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  auth, 
  db,
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  doc, 
  updateDoc,
  setDoc,
  getDoc,
  onSnapshot
} from '../firebase';
import AuthModal from './AuthModal';
import Logo from './Logo';
import { Restaurant, Product, Order, OrderItem, City } from '../types';
import { checkIsRestaurantOpen } from '../utils/restaurantSchedule';
import { notificationService } from '../utils/notificationService';
import { sendDriverNewOrderEmail, sendRestaurantNewOrderEmail } from '../utils/emailService';
import { 
  Search, 
  MapPin, 
  Star, 
  Clock, 
  DollarSign, 
  SlidersHorizontal, 
  Utensils, 
  CupSoda,
  ShoppingBag, 
  X, 
  Plus, 
  Minus, 
  CheckCircle, 
  ChevronRight,
  Info,
  Facebook,
  Instagram,
  Twitter,
  ArrowLeft,
  User as UserIcon,
  UserCheck,
  LogOut,
  ShieldAlert,
  Bell,
  BellRing,
  Lock,
  Unlock,
  Trophy,
  Award,
  Edit3,
  ChevronDown
} from 'lucide-react';

const CATEGORIES = [
  'Todos',
  'Restaurantes🍽️',
  'Cafeterías☕/postres🍰',
  'Bares🍺'
];

const CATEGORY_EMOJIS: Record<string, string> = {
  'Todos': '🌟',
  'Restaurantes🍽️': '🍽️',
  'Cafeterías☕/postres🍰': '☕',
  'Bares🍺': '🍺'
};

const CATEGORY_COLORS: Record<string, string> = {
  'Todos': 'bg-slate-100 border-slate-200',
  'Restaurantes🍽️': 'bg-orange-50 border-orange-200',
  'Cafeterías☕/postres🍰': 'bg-amber-50 border-amber-200',
  'Bares🍺': 'bg-purple-50 border-purple-200'
};

interface CustomerPortalProps {
  onNotifyOrderPlaced: () => void;
}

export default function CustomerPortal({ onNotifyOrderPlaced }: CustomerPortalProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  
  // Cities State
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('Todas');

  // Fetch Cities from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cities'), (snap) => {
      const list: City[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          name: data.name || '',
          topRestaurants: data.topRestaurants || [],
          createdAt: data.createdAt || Date.now()
        } as City);
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCities(list);
    }, (err) => {
      console.error('Error fetching cities in CustomerPortal:', err);
    });
    return () => unsub();
  }, []);
  
  // Filters
  const [sortBy, setSortBy] = useState<'time' | 'fee' | 'none'>('none');
  const [priceFilter, setPriceFilter] = useState<'all' | 'low' | 'med' | 'high'>('all');
  
  // Navigation
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [restaurantProducts, setRestaurantProducts] = useState<Product[]>([]);
  const [menuTypeFilter, setMenuTypeFilter] = useState<'ALL' | 'FOOD' | 'DRINK'>('ALL');
  const [tableFromQr, setTableFromQr] = useState<string | null>(null);

  // Navigation & Browser History Helpers (Android native back button support)
  const handleSelectRestaurant = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    window.history.pushState({ view: 'restaurant', restaurantId: restaurant.id }, '');
  };

  const handleBackToRestaurants = () => {
    if (window.history.state?.restaurantId || window.history.state?.view === 'restaurant' || window.history.state?.view === 'modal') {
      window.history.back();
    } else {
      setSelectedRestaurant(null);
      setRestaurantProducts([]);
      window.history.replaceState({ view: 'home' }, '');
    }
  };
  const [activeTableOrders, setActiveTableOrders] = useState<Order[]>([]);
  const activeTableOrder = useMemo<Order | null>(() => {
    if (activeTableOrders.length === 0) return null;
    
    // Sort active table orders by createdAt so the oldest/first one acts as primary
    const sortedOrders = [...activeTableOrders].sort((a, b) => a.createdAt - b.createdAt);
    const primaryOrder = sortedOrders[0];
    const newestOrder = sortedOrders[sortedOrders.length - 1];
    
    // Concatenate items from all active orders
    const allItems = activeTableOrders.flatMap(o => o.items);
    
    // Sum subtotals and totals
    const totalSubtotal = activeTableOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const totalTotal = activeTableOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    // Check flags: billRequested, customerBillRequestedFromWaiter
    const isBillRequested = activeTableOrders.some(o => o.billRequested);
    const isCustomerBillRequestedFromWaiter = activeTableOrders.some(o => o.customerBillRequestedFromWaiter);
    
    return {
      ...primaryOrder,
      id: primaryOrder.id,
      items: allItems,
      subtotal: totalSubtotal,
      total: totalTotal,
      billRequested: isBillRequested,
      customerBillRequestedFromWaiter: isCustomerBillRequestedFromWaiter,
      status: newestOrder.status,
    };
  }, [activeTableOrders]);

  const isTableUnlocked = useMemo(() => {
    if (!tableFromQr) return true;

    const mode = selectedRestaurant?.qrOrderingMode || 'AUTOMATIC';
    if (mode === 'ALWAYS_ACTIVE') return true;
    if (mode === 'ALWAYS_DISABLED') return false;

    if (activeTableOrders.length === 0) return false;

    const hasExplicitUnlock = activeTableOrders.some(o => o.qrUnlocked === true);
    const hasExplicitLock = activeTableOrders.some(o => o.qrUnlocked === false);

    if (hasExplicitUnlock) return true;
    if (hasExplicitLock) return false;

    return activeTableOrders.some(o => o.status === 'SERVED');
  }, [tableFromQr, activeTableOrders, selectedRestaurant?.qrOrderingMode]);

  const [isRequestingBill, setIsRequestingBill] = useState(false);
  
  // Shopping Cart
  const [cart, setCart] = useState<{ product: Product; quantity: number; variant?: string; extras?: { name: string; price: number }[]; notes?: string }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping' | 'success'>('cart');
  
  // Checkout Form
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [custAddress, setCustAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Customer notifications list and listener for live updates
  const [customerToasts, setCustomerToasts] = useState<{ id: string; title: string; message: string; type: string }[]>([]);

  // Rating Modal state for Table QR bill request
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingHoverStars, setRatingHoverStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  useEffect(() => {
    if (!placedOrder || !placedOrder.id) return;

    const orderRef = doc(db, 'orders', placedOrder.id);
    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) {
        const updatedData = { id: docSnap.id, ...docSnap.data() } as Order;
        
        // Match status to show a toast if status has changed
        setPlacedOrder((prev) => {
          if (prev && prev.id === updatedData.id && prev.status !== updatedData.status) {
            const isPickup = updatedData.deliveryType === 'PICKUP';

            let label = '';
            let description = '';

            if (isPickup) {
              if (['PENDING', 'CONFIRMED'].includes(updatedData.status)) {
                label = 'Recibido 📥';
                description = `Tu pedido de ${updatedData.restaurantName} ha sido recibido y está registrado.`;
              } else if (updatedData.status === 'PREPARING') {
                label = 'Cocinando 🍳';
                description = `Tu pedido de ${updatedData.restaurantName} se está cocinando.`;
              } else if (updatedData.status === 'READY') {
                label = '¡Tu pedido está listo para que lo recojas! 🛍️';
                description = `¡Atención! Tu pedido de ${updatedData.restaurantName} ya está listo. ¡Puedes pasar por él a la sucursal!`;
              } else if (updatedData.status === 'DELIVERED') {
                label = '¡Entregado! 🎉';
                description = `¡Tu pedido de ${updatedData.restaurantName} ha sido entregado! Gracias por tu compra.`;
              } else if (updatedData.status === 'CANCELLED') {
                label = 'Pedido Cancelado ❌';
                description = `Tu pedido de ${updatedData.restaurantName} ha sido cancelado.`;
              } else {
                label = updatedData.status;
                description = `Estado de pedido actualizado: ${updatedData.status}`;
              }
            } else {
              const statusLabels: Record<string, string> = {
                'PENDING': 'Pedido Recibido 📥',
                'CONFIRMED': 'Pedido Aceptado ✅',
                'PREPARING': 'En Cocina / Preparándose 🍳',
                'READY': '¡Listo para entregar/recoger! 🛍️',
                'SERVED': '¡Servido en mesa! 🍽️',
                'ASSIGNED': 'Asignado a Repartidor 🏍️',
                'SHIPPED': 'En Camino a tu Domicilio 🏍️💨',
                'DELIVERED': '¡Entregado! ¡Buen provecho! 🎉',
                'CANCELLED': 'Pedido Cancelado ❌'
              };

              label = statusLabels[updatedData.status] || updatedData.status;
              description = updatedData.status === 'SHIPPED' 
                ? `El repartidor ${updatedData.driverName || ''} (${updatedData.driverPhone || ''}) va en camino con tu pedido.`
                : `Tu pedido de ${updatedData.restaurantName} ahora está en estado: ${label}.`;
            }

            // Trigger Push Notification & Audio Chime
            notificationService.sendPushNotification({
              title: isPickup && updatedData.status === 'READY'
                ? '🛍️ ¡Tu pedido está listo para que lo recojas!'
                : `🔔 Estado del Pedido: ${label}`,
              body: description,
              soundType: 'status_update',
              type: updatedData.status === 'CANCELLED' ? 'alert' : updatedData.status === 'DELIVERED' || (isPickup && updatedData.status === 'READY') ? 'success' : 'info'
            });

            const toastId = Math.random().toString();
            setCustomerToasts((prevToasts) => [
              ...prevToasts,
              {
                id: toastId,
                title: isPickup && updatedData.status === 'READY' ? '🛍️ ¡Pedido listo para recoger!' : label,
                message: description,
                type: updatedData.status === 'CANCELLED' ? 'error' : updatedData.status === 'DELIVERED' || (isPickup && updatedData.status === 'READY') ? 'success' : 'info'
              }
            ]);

            // Auto-dismiss toast in 10 seconds
            setTimeout(() => {
              setCustomerToasts((currentToasts) => currentToasts.filter(t => t.id !== toastId));
            }, 10000);
          }
          return updatedData;
        });
      }
    });

    return () => unsubscribe();
  }, [placedOrder?.id]);

  // Auth States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Edit City Modal States
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [editingCityValue, setEditingCityValue] = useState('');
  const [isSavingCity, setIsSavingCity] = useState(false);

  // Handle customer saving / updating their primary profile city
  const handleSaveCustomerCity = async (newCityName: string) => {
    if (!currentUser) {
      setSelectedCity(newCityName);
      setIsCityModalOpen(false);
      return;
    }
    setIsSavingCity(true);
    try {
      await setDoc(doc(db, 'customers', currentUser.uid), {
        city: newCityName
      }, { merge: true });

      setUserProfile((prev: any) => ({ ...(prev || {}), city: newCityName }));
      setSelectedCity(newCityName);

      const toastId = Math.random().toString();
      setCustomerToasts((prevToasts) => [
        ...prevToasts,
        {
          id: toastId,
          title: '¡Ciudad Actualizada! 📍',
          message: `Tu ciudad principal se ha cambiado a "${newCityName}".`,
          type: 'success'
        }
      ]);
      setTimeout(() => {
        setCustomerToasts((currentToasts) => currentToasts.filter(t => t.id !== toastId));
      }, 6000);

      setIsCityModalOpen(false);
    } catch (error) {
      console.error('Error al actualizar ciudad del cliente:', error);
      alert('Ocurrió un error al guardar la ciudad. Por favor intenta de nuevo.');
    } finally {
      setIsSavingCity(false);
    }
  };

  // Sync selected city when user profile or auth state changes
  useEffect(() => {
    if (currentUser && userProfile?.city) {
      setSelectedCity(userProfile.city);
    } else if (!currentUser) {
      setSelectedCity('Todas');
    }
  }, [currentUser, userProfile?.city]);

  // Auto-save customer delivery details to localStorage whenever they are modified
  useEffect(() => {
    if (custName || custPhone || custEmail || custAddress || orderNotes) {
      const details = {
        name: custName,
        phone: custPhone,
        email: custEmail,
        address: custAddress,
        deliveryType: deliveryType,
        notes: orderNotes
      };
      try {
        localStorage.setItem('mesa22_last_customer_details', JSON.stringify(details));
      } catch (e) {
        console.error('Error saving customer details to localStorage:', e);
      }
    }
  }, [custName, custPhone, custEmail, custAddress, deliveryType, orderNotes]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      // Helper to read stored details from localStorage
      let storedLocal: any = null;
      try {
        const raw = localStorage.getItem('mesa22_last_customer_details');
        if (raw) storedLocal = JSON.parse(raw);
      } catch (e) {
        console.error('Error parsing stored customer details:', e);
      }

      if (user) {
        try {
          const profileDoc = await getDoc(doc(db, 'customers', user.uid));
          if (profileDoc.exists()) {
            const data = profileDoc.data();
            setUserProfile(data);
            setCustName(data.name || storedLocal?.name || '');
            setCustPhone(data.phone || storedLocal?.phone || '');
            setCustEmail(data.email || user.email || storedLocal?.email || '');
            setCustAddress(data.address || storedLocal?.address || '');
            if (data.deliveryType || storedLocal?.deliveryType) {
              setDeliveryType(data.deliveryType || storedLocal?.deliveryType);
            }
            if (data.notes || storedLocal?.notes) {
              setOrderNotes(data.notes || storedLocal?.notes);
            }
          } else {
            const basicProfile = {
              name: user.displayName || user.email?.split('@')[0] || storedLocal?.name || '',
              email: user.email || storedLocal?.email || ''
            };
            setUserProfile(basicProfile);
            setCustName(basicProfile.name);
            setCustEmail(basicProfile.email);
            if (storedLocal?.phone) setCustPhone(storedLocal.phone);
            if (storedLocal?.address) setCustAddress(storedLocal.address);
            if (storedLocal?.deliveryType) setDeliveryType(storedLocal.deliveryType);
            if (storedLocal?.notes) setOrderNotes(storedLocal.notes);
          }
        } catch (err) {
          console.error('Error fetching customer profile:', err);
        }
      } else {
        setUserProfile(null);
        if (storedLocal) {
          setCustName(storedLocal.name || '');
          setCustPhone(storedLocal.phone || '');
          setCustEmail(storedLocal.email || '');
          setCustAddress(storedLocal.address || '');
          if (storedLocal.deliveryType) setDeliveryType(storedLocal.deliveryType);
          if (storedLocal.notes) setOrderNotes(storedLocal.notes);
        } else {
          setCustName('');
          setCustPhone('');
          setCustEmail('');
          setCustAddress('');
          setOrderNotes('');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Load Approved / Suspended Restaurants in real-time
  useEffect(() => {
    const q = query(collection(db, 'restaurants'), where('status', 'in', ['APPROVED', 'SUSPENDED']));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Restaurant[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Restaurant);
      });
      setRestaurants(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching restaurants in real-time', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to selected restaurant changes in real-time
  useEffect(() => {
    if (!selectedRestaurant?.id) return;
    const unsub = onSnapshot(
      doc(db, 'restaurants', selectedRestaurant.id), 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSelectedRestaurant((prev) => {
            if (!prev) return null;
            return { ...prev, ...data, id: snap.id } as Restaurant;
          });
        }
      },
      (err) => {
        console.error("Error listening to selected restaurant:", err);
      }
    );
    return () => unsub();
  }, [selectedRestaurant?.id]);

  // Listen for browser/Android native back button (popstate)
  useEffect(() => {
    // Set default home state if no history state is set
    if (!window.history.state) {
      window.history.replaceState({ view: 'home' }, '');
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;

      // If state is home, empty, or has no restaurantId -> return to restaurant list
      if (!state || state.view === 'home' || !state.restaurantId) {
        setActiveProduct(null);
        setIsCartOpen(false);
        setIsRatingModalOpen(false);
        setSelectedRestaurant(null);
        setRestaurantProducts([]);
        return;
      }

      // If state is a sub-modal inside restaurant
      if (state.view === 'modal') {
        if (state.modalType !== 'product') setActiveProduct(null);
        if (state.modalType !== 'cart') setIsCartOpen(false);
        if (state.modalType !== 'rating') setIsRatingModalOpen(false);
        return;
      }

      // If state is restaurant view (no modal)
      if (state.view === 'restaurant' || (state.restaurantId && !state.modalType)) {
        setActiveProduct(null);
        setIsCartOpen(false);
        setIsRatingModalOpen(false);

        setSelectedRestaurant((prev) => {
          if (!prev || prev.id !== state.restaurantId) {
            const match = restaurants.find(r => r.id === state.restaurantId);
            return match || null;
          }
          return prev;
        });
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [restaurants]);

  // QR Code & Table session listener
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restId = params.get('restaurantId');
    const tableParam = params.get('table');

    if (restId && restaurants.length > 0 && !selectedRestaurant) {
      const matched = restaurants.find(r => r.id === restId);
      if (matched) {
        if (!window.history.state || window.history.state.view !== 'home') {
          window.history.replaceState({ view: 'home' }, '');
          window.history.pushState({ view: 'restaurant', restaurantId: matched.id }, '');
        }
        setSelectedRestaurant(matched);
      }
    }
    
    if (tableParam) {
      setTableFromQr(tableParam);
    }
  }, [restaurants]);

  // Active table order query
  useEffect(() => {
    if (!selectedRestaurant?.id || !tableFromQr) {
      setActiveTableOrders([]);
      return;
    }
    
    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', selectedRestaurant.id),
      where('tableName', '==', tableFromQr),
      where('deliveryType', '==', 'DINE_IN')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const active: Order[] = [];
      snapshot.forEach((docSnap) => {
        const o = { id: docSnap.id, ...docSnap.data() } as Order;
        if (o.status !== 'DELIVERED' && o.status !== 'CANCELLED') {
          active.push(o);
        }
      });
      setActiveTableOrders(active);
    }, (error) => {
      console.error("Error subscribing to active table orders:", error);
    });
    
    return () => unsubscribe();
  }, [selectedRestaurant?.id, tableFromQr]);

  // Load Menu of Selected Restaurant
  useEffect(() => {
    if (!selectedRestaurant?.id) return;
    async function loadProducts() {
      try {
        const q = query(collection(db, 'products'), where('restaurantId', '==', selectedRestaurant?.id));
        const snap = await getDocs(q);
        const list: Product[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Product);
        });
        setRestaurantProducts(list);
      } catch (err) {
        console.error('Error fetching products', err);
      }
    }
    loadProducts();
  }, [selectedRestaurant?.id]);

  // Handle adding to cart
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [selectedExtras, setSelectedExtras] = useState<{ name: string; price: number }[]>([]);
  const [itemNotes, setItemNotes] = useState('');

  const openProductModal = (product: Product) => {
    setActiveProduct(product);
    setSelectedVariant(product.variants && product.variants[0] ? product.variants[0].options[0] : '');
    setSelectedExtras([]);
    setItemNotes('');
    window.history.pushState({ view: 'modal', modalType: 'product', restaurantId: selectedRestaurant?.id }, '');
  };

  const handleOpenCart = () => {
    setIsCartOpen(true);
    window.history.pushState({ view: 'modal', modalType: 'cart', restaurantId: selectedRestaurant?.id }, '');
  };

  const addToCart = () => {
    if (!activeProduct) return;
    
    // Check if adding from a different restaurant
    if (cart.length > 0 && cart[0].product.restaurantId !== activeProduct.restaurantId) {
      if (confirm('Tienes productos de otro restaurante en tu carrito. ¿Deseas vaciar el carrito y comenzar un nuevo pedido?')) {
        setCart([]);
      } else {
        setActiveProduct(null);
        return;
      }
    }

    setCart([
      ...cart,
      {
        product: activeProduct,
        quantity: 1,
        variant: selectedVariant || null,
        extras: selectedExtras,
        notes: itemNotes
      }
    ]);
    setActiveProduct(null);
  };

  const removeFromCart = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const updateQuantity = (index: number, change: number) => {
    const updated = [...cart];
    const newQty = updated[index].quantity + change;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
    }
    setCart(updated);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => {
    const extrasCost = (item.extras || []).reduce((s, ex) => s + ex.price, 0);
    return sum + (item.product.price + extrasCost) * item.quantity;
  }, 0);

  const deliveryFee = 0; // Se quitó el cobro de envío a los clientes
  const total = subtotal;
  const isRestaurantClosed = selectedRestaurant ? !checkIsRestaurantOpen(selectedRestaurant).isOpen : false;
  const closedReason = selectedRestaurant ? checkIsRestaurantOpen(selectedRestaurant).reason : '';

  const handlePlaceOrder = async () => {
    if (!selectedRestaurant) return;
    if (!custName.trim()) {
      alert('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!custPhone.trim()) {
      alert('Por favor ingresa tu número de teléfono.');
      return;
    }
    const schedStatus = checkIsRestaurantOpen(selectedRestaurant);
    if (!schedStatus.isOpen) {
      alert(`⚠️ RESTAURANTE CERRADO\n\n${selectedRestaurant.name} está fuera de su horario de atención o en su día de descanso.\n\nMotivo: ${schedStatus.reason}\n\nNo es posible realizar pedidos en este momento.`);
      return;
    }

    if (deliveryType === 'DELIVERY' && !custAddress.trim()) {
      alert('Por favor ingresa tu dirección de entrega. Es obligatoria para pedidos a domicilio.');
      return;
    }

    const orderItems: OrderItem[] = cart.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      selectedVariant: item.variant,
      selectedExtras: item.extras,
      notes: item.notes
    }));

    const newOrder: Omit<Order, 'id'> = {
      restaurantId: selectedRestaurant.id,
      restaurantName: selectedRestaurant.name,
      city: selectedRestaurant.city || '',
      customerName: custName,
      customerPhone: custPhone,
      customerEmail: custEmail || '',
      deliveryType: deliveryType,
      status: 'PENDING',
      items: orderItems,
      subtotal: subtotal,
      deliveryFee: 0,
      driverPaymentRate: selectedRestaurant.driverPayment ?? 10,
      total: total,
      paymentMethod: deliveryType === 'DELIVERY' ? 'CASH_ON_DELIVERY' : 'CASH_ON_PICKUP',
      notes: orderNotes || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (deliveryType === 'DELIVERY') {
      (newOrder as any).deliveryAddress = custAddress;
    }

    // Helper to recursively remove undefined fields for Firestore compatibility
    const cleanUndefined = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(v => cleanUndefined(v));
      } else if (obj !== null && typeof obj === 'object') {
        return Object.entries(obj).reduce((acc, [key, val]) => {
          if (val !== undefined) {
            acc[key] = cleanUndefined(val);
          }
          return acc;
        }, {} as any);
      }
      return obj;
    };

    try {
      const sanitizedOrder = cleanUndefined(newOrder);
      const docRef = await addDoc(collection(db, 'orders'), sanitizedOrder);
      const orderId = docRef.id;
      
      const placed: Order = {
        id: orderId,
        ...newOrder
      };
      
      setPlacedOrder(placed);
      setCart([]);
      setCheckoutStep('success');

      // Dispatch email notification to drivers & restaurant owner if order is for delivery
      if (placed.deliveryType === 'DELIVERY') {
        sendDriverNewOrderEmail(placed, db).catch(err => {
          console.error('Error sending driver notification email:', err);
        });
        sendRestaurantNewOrderEmail(placed, db).catch(err => {
          console.error('Error sending restaurant notification email:', err);
        });
      }

      // Save / update customer profile data in Firestore for future orders
      if (currentUser?.uid) {
        try {
          await setDoc(doc(db, 'customers', currentUser.uid), {
            name: custName.trim(),
            phone: custPhone.trim(),
            email: custEmail.trim(),
            address: custAddress.trim(),
            deliveryType: deliveryType,
            notes: orderNotes.trim(),
            updatedAt: Date.now()
          }, { merge: true });
        } catch (err) {
          console.error('Error updating customer profile in Firestore:', err);
        }
      }
      notificationService.sendPushNotification({
        title: '🛍️ ¡Pedido Confirmado!',
        body: `Tu pedido en ${selectedRestaurant?.name || 'Mesa 22'} por $${sanitizedOrder.total} ha sido recibido.`,
        soundType: 'new_order',
        type: 'success'
      });
      onNotifyOrderPlaced();
    } catch (err) {
      console.error('Error creating order in Firestore:', err);
      alert('Hubo un error al procesar tu pedido. Por favor intenta de nuevo.');
    }
  };

  const handleAddToTableComanda = async () => {
    if (!selectedRestaurant?.id || !tableFromQr) return;
    if (cart.length === 0) return;

    if (!isTableUnlocked) {
      if (selectedRestaurant?.qrOrderingMode === 'ALWAYS_DISABLED') {
        alert(`🔒 El restaurante tiene desactivada la opción de realizar pedidos por código QR en mesa.\n\nPor favor, solicita atención a tu mesero para tomar tu pedido.`);
      } else {
        alert(`🔒 La Mesa ${tableFromQr} está bloqueada para realizar pedidos por QR.\n\nPara poder pedir por tu celular, un mesero debe haber entregado al menos un platillo en la mesa. Solicita atención a tu mesero.`);
      }
      return;
    }

    try {
      const cleanUndefined = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(v => cleanUndefined(v));
        } else if (obj !== null && typeof obj === 'object') {
          return Object.entries(obj).reduce((acc, [key, val]) => {
            if (val !== undefined) {
              acc[key] = cleanUndefined(val);
            }
            return acc;
          }, {} as any);
        }
        return obj;
      };

      const newItemsToAdd = cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        selectedVariant: item.variant || null,
        selectedExtras: item.extras || [],
        notes: item.notes || '',
        sentToKitchen: true // Send directly to kitchen
      }));

      // Find if we have an existing name and phone used at this table
      const existingCustomerName = activeTableOrders.length > 0 ? activeTableOrders[0].customerName : '';
      const existingCustomerPhone = activeTableOrders.length > 0 ? activeTableOrders[0].customerPhone : '';

      // Always create a separate order so that the kitchen screen gets a new, independent card with only the new items.
      const newOrder: Omit<Order, 'id'> = {
        restaurantId: selectedRestaurant.id,
        restaurantName: selectedRestaurant.name,
        city: selectedRestaurant.city || '',
        customerName: existingCustomerName || custName || `Mesa ${tableFromQr}`,
        customerPhone: existingCustomerPhone || custPhone || '0000000000',
        deliveryType: 'DINE_IN',
        tableName: tableFromQr,
        status: 'PENDING',
        items: newItemsToAdd,
        subtotal: subtotal,
        deliveryFee: 0,
        total: subtotal,
        paymentMethod: 'CASH_ON_TABLE',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const sanitizedOrder = cleanUndefined(newOrder);
      const docRef = await addDoc(collection(db, 'orders'), sanitizedOrder);
      
      const placed: Order = {
        id: docRef.id,
        ...newOrder
      };
      
      setPlacedOrder(placed);
      
      setCart([]);
      setIsCartOpen(false);

      // Play notification sound
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch (err) {}
      
      const toastId = Math.random().toString();
      setCustomerToasts((prevToasts) => [
        ...prevToasts,
        {
          id: toastId,
          title: 'Enviado a Cocina 🍳',
          message: '¡Tus platillos han sido enviados a preparación directamente!',
          type: 'success'
        }
      ]);
      setTimeout(() => {
        setCustomerToasts((currentToasts) => currentToasts.filter(t => t.id !== toastId));
      }, 5000);

    } catch (err) {
      console.error('Error adding order items to table comanda:', err);
      alert('Hubo un error al guardar tu pedido en la mesa.');
    }
  };

  const handleSendComandaToKitchen = async () => {
    if (activeTableOrders.length === 0) return;
    try {
      for (const order of activeTableOrders) {
        if (order.items.some(item => !item.sentToKitchen)) {
          const updatedItems = order.items.map(item => ({
            ...item,
            sentToKitchen: true
          }));
          await updateDoc(doc(db, 'orders', order.id), {
            items: updatedItems,
            status: 'PENDING',
            updatedAt: Date.now()
          });
        }
      }

      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch (err) {}

      const toastId = Math.random().toString();
      setCustomerToasts((prevToasts) => [
        ...prevToasts,
        {
          id: toastId,
          title: 'Enviado a Cocina 🍳',
          message: '¡Tu comanda ha sido enviada a la cocina para su preparación!',
          type: 'success'
        }
      ]);
      setTimeout(() => {
        setCustomerToasts((currentToasts) => currentToasts.filter(t => t.id !== toastId));
      }, 5000);
      
    } catch (err) {
      console.error('Error sending comanda to kitchen:', err);
      alert('Error al enviar la comanda a la cocina.');
    }
  };

  const handleRequestTableBill = async () => {
    if (activeTableOrders.length === 0) return;
    setIsRequestingBill(true);
    try {
      for (const order of activeTableOrders) {
        await updateDoc(doc(db, 'orders', order.id), {
          customerBillRequestedFromWaiter: true,
          customerBillRequestedFromWaiterAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      
      const toastId = Math.random().toString();
      setCustomerToasts((prevToasts) => [
        ...prevToasts,
        {
          id: toastId,
          title: 'Cuenta Solicitada 🛎️',
          message: 'Hemos notificado al mesero. Se acercará a tu mesa para realizar el corte de tu cuenta.',
          type: 'success'
        }
      ]);
      setTimeout(() => {
        setCustomerToasts((currentToasts) => currentToasts.filter(t => t.id !== toastId));
      }, 5000);
    } catch (err) {
      console.error('Error requesting bill:', err);
      alert('Error al solicitar la cuenta.');
    } finally {
      setIsRequestingBill(false);
    }
  };

  const handleSubmitRatingAndRequestBill = async (skipRating = false) => {
    if (!selectedRestaurant) return;
    setIsSubmittingRating(true);
    try {
      if (!skipRating && ratingStars > 0) {
        const currentRating = selectedRestaurant.rating ?? 5.0;
        const currentReviews = selectedRestaurant.reviewsCount ?? 0;
        const newReviewsCount = currentReviews + 1;
        const rawNewRating = ((currentRating * currentReviews) + ratingStars) / newReviewsCount;
        const newRating = Math.min(5, Math.max(1, Math.round(rawNewRating * 10) / 10));

        // 1. Update restaurant document rating in Firestore
        const restRef = doc(db, 'restaurants', selectedRestaurant.id);
        await updateDoc(restRef, {
          rating: newRating,
          reviewsCount: newReviewsCount
        });

        // 2. Save individual review in Firestore
        await addDoc(collection(db, 'reviews'), {
          restaurantId: selectedRestaurant.id,
          restaurantName: selectedRestaurant.name,
          rating: ratingStars,
          comment: ratingComment.trim(),
          table: tableFromQr || '',
          customerName: custName.trim() || 'Cliente en Mesa',
          createdAt: Date.now()
        });

        // 3. Update local state
        setSelectedRestaurant(prev => prev ? { ...prev, rating: newRating, reviewsCount: newReviewsCount } : null);
        setRestaurants(prev => prev.map(r => r.id === selectedRestaurant.id ? { ...r, rating: newRating, reviewsCount: newReviewsCount } : r));
      }

      await handleRequestTableBill();
      setIsRatingModalOpen(false);
      setRatingStars(5);
      setRatingComment('');
    } catch (err) {
      console.error('Error submitting rating and requesting bill:', err);
      await handleRequestTableBill();
      setIsRatingModalOpen(false);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Active city name for customer or visitor
  const userActiveCityName = useMemo(() => {
    if (selectedCity && selectedCity !== 'Todas') return selectedCity;
    if (userProfile?.city) return userProfile.city;
    return '';
  }, [userProfile?.city, selectedCity]);

  // City object matching customer's active city
  const cityObjForActiveUser = useMemo(() => {
    if (!userActiveCityName) return null;
    return cities.find(c => c.name.toLowerCase() === userActiveCityName.toLowerCase()) || null;
  }, [cities, userActiveCityName]);

  // "Lo mejor de la ciudad" restaurants ordered strictly 1st place to 3rd place
  const bestOfCityRestaurants = useMemo(() => {
    if (!cityObjForActiveUser || !cityObjForActiveUser.topRestaurants) return [];
    const topIds = cityObjForActiveUser.topRestaurants;
    const list: { restaurant: Restaurant; rank: number }[] = [];
    
    topIds.forEach((id, idx) => {
      if (!id || !id.trim()) return;
      const found = restaurants.find(r => r.id.trim() === id.trim() && (r.status === 'APPROVED' || r.status === 'SUSPENDED'));
      if (found && !list.some(item => item.restaurant.id === found.id)) {
        list.push({ restaurant: found, rank: idx + 1 });
      }
    });
    
    return list.sort((a, b) => a.rank - b.rank); // Strictly 1st place, 2nd place, 3rd place
  }, [cityObjForActiveUser, restaurants]);

  // Filter restaurants based on UI selection
  const filteredRestaurants = restaurants.filter((r) => {
    // Multi-city filtering: filter by selectedCity from dropdown or logged-in user profile
    if (selectedCity && selectedCity !== 'Todas') {
      if (!r.city || r.city.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }
    }

    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.address.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesCategory = selectedCategory === 'Todos';
    if (!matchesCategory) {
      if (r.category === selectedCategory) {
        matchesCategory = true;
      } else if (selectedCategory === 'Restaurantes🍽️') {
        const catLower = (r.category || '').toLowerCase();
        matchesCategory = catLower.includes('restaurante') || (!catLower.includes('cafe') && !catLower.includes('bar') && !catLower.includes('postre'));
      } else if (selectedCategory === 'Cafeterías☕/postres🍰') {
        const catLower = (r.category || '').toLowerCase();
        matchesCategory = catLower.includes('cafe') || catLower.includes('café') || catLower.includes('postre');
      } else if (selectedCategory === 'Bares🍺') {
        const catLower = (r.category || '').toLowerCase();
        matchesCategory = catLower.includes('bar') || catLower.includes('bebida') || catLower.includes('pub');
      }
    }
    
    // Simple price tier mock filtering
    let matchesPrice = true;
    if (priceFilter === 'low') matchesPrice = r.deliveryFee <= 20;
    if (priceFilter === 'med') matchesPrice = r.deliveryFee > 20 && r.deliveryFee <= 30;
    if (priceFilter === 'high') matchesPrice = r.deliveryFee > 30;

    return matchesSearch && matchesCategory && matchesPrice;
  }).sort((a, b) => {
    if (sortBy === 'fee') return a.deliveryFee - b.deliveryFee;
    return 0; // Default no sort
  });

  // Top restaurant IDs set to avoid duplication in lower section
  const topRestaurantIdsSet = useMemo(() => {
    return new Set(bestOfCityRestaurants.map(b => b.restaurant.id));
  }, [bestOfCityRestaurants]);

  // Remaining restaurants excluding the top 3 featured ones when browsing
  const otherFilteredRestaurants = useMemo(() => {
    if (bestOfCityRestaurants.length > 0 && selectedCategory === 'Todos' && !searchTerm) {
      return filteredRestaurants.filter(r => !topRestaurantIdsSet.has(r.id));
    }
    return filteredRestaurants;
  }, [filteredRestaurants, bestOfCityRestaurants, topRestaurantIdsSet, selectedCategory, searchTerm]);

  return (
    <div id="customer_portal_container" className="max-w-7xl mx-auto px-4 py-6 relative">
      
      {/* Floating Notifications Stack */}
      <div className="fixed top-5 right-5 z-[100] max-w-xs sm:max-w-sm w-full pointer-events-none space-y-3">
        {customerToasts.map((t) => (
          <div 
            key={t.id} 
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex gap-3 animate-fadeIn transition-all transform duration-300 ${
              t.type === 'error' 
                ? 'bg-rose-50 border-rose-200 text-rose-900' 
                : t.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-indigo-50 border-indigo-200 text-indigo-950'
            }`}
          >
            <div className="shrink-0 text-lg">🔔</div>
            <div className="flex-1">
              <h5 className="font-extrabold text-xs uppercase tracking-wider">{t.title}</h5>
              <p className="text-[11px] mt-1 font-semibold leading-snug">{t.message}</p>
            </div>
            <button 
              onClick={() => setCustomerToasts((prev) => prev.filter(x => x.id !== t.id))}
              className="text-slate-400 hover:text-slate-600 self-start text-xs font-bold font-sans p-0.5"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Customer Auth status bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-gray-200 rounded-3xl p-5 mb-6 gap-4 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <Logo size="md" />
          <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm leading-tight flex items-center gap-2 flex-wrap">
              <span>{currentUser ? `¡Hola, ${userProfile?.name || 'Cliente'}!` : 'Bienvenido a Mesa 22'}</span>
              {currentUser && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200 shadow-2xs">
                  <MapPin className="w-3 h-3 text-brand-primary" />
                  {userProfile?.city ? `Ciudad: ${userProfile.city}` : 'Sin ciudad asignada'}
                </span>
              )}
            </h4>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                {currentUser ? `Sesión iniciada: ${currentUser.email}` : 'Inicia sesión para autocompletar tus pedidos y envíos'}
              </p>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCityValue(userProfile?.city || (cities[0]?.name || ''));
                    setIsCityModalOpen(true);
                  }}
                  className="text-[11px] font-black text-brand-primary hover:text-brand-primary-hover hover:underline flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200/60 transition cursor-pointer"
                  title="Cambiar mi ciudad de registro"
                >
                  <Edit3 className="w-3 h-3" />
                  Editar ciudad
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2.5">
          {cart.length > 0 && (
            <motion.button
              key={`header-comanda-${cart.length}`}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ 
                scale: [1, 1.05, 1],
                boxShadow: [
                  '0 4px 14px rgba(234, 88, 12, 0.4)',
                  '0 10px 24px rgba(234, 88, 12, 0.75)',
                  '0 4px 14px rgba(234, 88, 12, 0.4)'
                ]
              }}
              transition={{
                scale: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
                boxShadow: { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenCart}
              className="relative bg-gradient-to-r from-brand-primary via-orange-500 to-amber-600 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg cursor-pointer border border-orange-300/40 overflow-hidden"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 border border-white"></span>
              </span>
              <ShoppingBag className="w-4 h-4 animate-bounce" style={{ animationDuration: '1.6s' }} />
              <span className="tracking-wide">Comanda ({cart.length})</span>
            </motion.button>
          )}

          {currentUser ? (
            <button
              onClick={() => signOut(auth)}
              className="px-4 py-2 rounded-xl text-xs font-black text-rose-500 hover:bg-rose-50 border border-rose-100 transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-black bg-brand-primary text-white hover:bg-brand-primary-hover shadow-xs transition cursor-pointer"
            >
              Iniciar Sesión / Registrarse
            </button>
          )}
        </div>
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialRole="customer" 
        onAuthSuccess={() => {}} 
      />

      {/* Edit Customer City Modal */}
      {isCityModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-orange-100 text-brand-primary rounded-2xl shadow-2xs">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">Editar mi Ciudad</h3>
                  <p className="text-xs text-slate-500 font-medium">Selecciona tu ciudad asignada en el sistema</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCityModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Selecciona la ciudad
                </label>
                {cities.length === 0 ? (
                  <div className="p-4 bg-slate-50 text-slate-500 text-xs text-center rounded-2xl font-medium">
                    Cargando ciudades del sistema...
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-primary">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <select
                      value={editingCityValue}
                      onChange={(e) => setEditingCityValue(e.target.value)}
                      className="w-full pl-11 pr-10 py-3.5 bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 font-extrabold text-sm rounded-2xl border border-slate-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition cursor-pointer appearance-none shadow-2xs"
                    >
                      <option value="" disabled>-- Selecciona una ciudad --</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.name} className="py-2 font-bold text-slate-800">
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed">
                  Lista desplegable con desplazamiento (scroll) con todas las ciudades registradas por el Super Administrador.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCityModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!editingCityValue || isSavingCity}
                  onClick={() => handleSaveCustomerCity(editingCityValue)}
                  className="flex-1 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold rounded-2xl text-xs transition shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingCity ? 'Guardando...' : 'Guardar Ciudad'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 1. SINGLE RESTAURANT VIEW */}
      {selectedRestaurant ? (
        (selectedRestaurant.status || 'APPROVED') === 'SUSPENDED' ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-8 md:p-12 text-center max-w-lg mx-auto my-12 shadow-sm animate-scale-in animate-duration-300" id="suspended_restaurant_view">
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-6">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-3">
              Restaurante suspendido
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              Este establecimiento se encuentra temporalmente inactivo. Por favor, selecciona otro restaurante para realizar tu pedido.
            </p>
            <button
              id="suspended_back_home_btn"
              onClick={handleBackToRestaurants}
              className="bg-brand-primary hover:bg-brand-primary-hover text-white px-6 py-3 rounded-xl font-black text-sm transition shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Regresar al inicio
            </button>
          </div>
        ) : (
          <div>
            {/* Back button */}
            <button 
              id="back_to_restaurants_btn"
              onClick={handleBackToRestaurants}
              className="flex items-center text-slate-600 hover:text-brand-primary font-medium mb-6 transition"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Volver a restaurantes
            </button>

            {/* Restaurant Banner Card */}
            <div className="bg-white rounded-3xl shadow-xs overflow-hidden border border-slate-100 mb-8">
              <div className="h-48 md:h-64 bg-slate-100 relative">
                <img 
                  src={selectedRestaurant.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800'} 
                  alt={selectedRestaurant.name || 'Restaurante'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end">
                  <div className="p-6 md:p-8 text-white w-full">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="bg-brand-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                          {selectedRestaurant.category || 'General'}
                        </span>
                        <h1 className="text-2xl md:text-4xl font-extrabold mt-2 tracking-tight">
                          {selectedRestaurant.name || 'Cargando...'}
                        </h1>
                        <p className="text-slate-200 text-sm mt-1 flex items-center">
                          <MapPin className="w-4 h-4 mr-1 shrink-0" />
                          <span>{selectedRestaurant.address || 'Sin dirección'}</span>
                        </p>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex gap-4 text-center">
                        <div>
                          <div className="flex items-center justify-center text-white font-bold text-lg">
                            <Clock className="w-5 h-5 mr-1 text-slate-200" />
                            <span>{selectedRestaurant.deliveryTime || '30 min'}</span>
                          </div>
                          <div className="text-[10px] text-slate-300 uppercase font-semibold mt-0.5">
                            <span>Entrega</span>
                          </div>
                        </div>
                        <div className="border-l border-white/20 pl-4">
                          <div className="flex items-center justify-center text-emerald-400 font-bold text-lg">
                            <span>¡Gratis!</span>
                          </div>
                          <div className="text-[10px] text-slate-300 uppercase font-semibold mt-0.5">
                            <span>Envío</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Quick Details Bar & Schedule Status */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-4 text-sm text-slate-600">
                {(() => {
                  const sched = checkIsRestaurantOpen(selectedRestaurant);
                  return (
                    <div className={`p-4 rounded-2xl border flex items-start sm:items-center gap-3.5 transition-all ${
                      sched.isOpen 
                        ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-900' 
                        : 'bg-rose-50/90 border-rose-200 text-rose-950'
                    }`}>
                      <span className="text-2xl shrink-0 mt-0.5 sm:mt-0">{sched.isOpen ? '🟢' : '🔴'}</span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-xs uppercase tracking-wider">
                            {sched.isOpen ? 'Restaurante Abierto' : 'Restaurante Cerrado'}
                          </h4>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                            sched.isOpen ? 'bg-emerald-200/90 text-emerald-950' : 'bg-rose-200 text-rose-900'
                          }`}>
                            {sched.badgeText}
                          </span>
                        </div>
                        <p className="text-xs mt-1 font-medium leading-relaxed opacity-90">
                          {sched.isOpen 
                            ? `Horario habitual: ${selectedRestaurant.hours || 'No especificado'}${selectedRestaurant.restDay && selectedRestaurant.restDay !== 'Ninguno' ? ` | Día de descanso: ${selectedRestaurant.restDay}` : ''}`
                            : `${sched.reason} Los pedidos a domicilio están suspendidos mientras el restaurante esté fuera de horario o en su día de descanso.`
                          }
                        </p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span><strong>Horario:</strong> <span>{selectedRestaurant.hours || 'No especificado'}</span></span>
                    {selectedRestaurant.restDay && selectedRestaurant.restDay !== 'Ninguno' && (
                      <span><strong>Día de descanso:</strong> <span className="font-bold text-rose-600">{selectedRestaurant.restDay}</span></span>
                    )}
                    <span><strong>Zona de entrega:</strong> <span>{selectedRestaurant.deliveryZone || 'No especificado'}</span></span>
                    <span><strong>Teléfono:</strong> <span>{selectedRestaurant.phone || 'No especificado'}</span></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedRestaurant.socials?.facebook && (
                      <a 
                        href={selectedRestaurant.socials?.facebook} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-slate-700 hover:text-brand-primary hover:scale-105 transition shadow-xs border border-slate-100 flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 bg-blue-600 rounded-full shrink-0"></span>
                        Facebook
                      </a>
                    )}
                    {selectedRestaurant.socials?.instagram && (
                      <a 
                        href={selectedRestaurant.socials?.instagram} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-slate-700 hover:text-brand-primary hover:scale-105 transition shadow-xs border border-slate-100 flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 bg-pink-500 rounded-full shrink-0"></span>
                        Instagram
                      </a>
                    )}
                    {selectedRestaurant.socials?.twitter && (
                      <a 
                        href={selectedRestaurant.socials?.twitter} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-slate-700 hover:text-brand-primary hover:scale-105 transition shadow-xs border border-slate-100 flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 bg-sky-400 rounded-full shrink-0"></span>
                        Ubicación
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

          {/* Menu Catalog Section */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Menú Digital</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Explora nuestros platillos y bebidas para ordenar</p>
              </div>

              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
                {/* Filter buttons: Todos / Alimentos / Bebidas */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl max-w-full overflow-x-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setMenuTypeFilter('ALL')}
                    className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                      menuTypeFilter === 'ALL'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🍽️ Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuTypeFilter('FOOD')}
                    className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                      menuTypeFilter === 'FOOD'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-amber-600'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" /> Alimentos
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuTypeFilter('DRINK')}
                    className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                      menuTypeFilter === 'DRINK'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-slate-500 hover:text-sky-600'
                    }`}
                  >
                    <CupSoda className="w-3.5 h-3.5" /> Bebidas
                  </button>
                </div>

                {cart.length > 0 && (
                  <motion.button 
                    key={`comanda-btn-${cart.length}`}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ 
                      scale: [1, 1.06, 1],
                      boxShadow: [
                        '0 4px 14px rgba(234, 88, 12, 0.4)',
                        '0 12px 28px rgba(234, 88, 12, 0.75)',
                        '0 4px 14px rgba(234, 88, 12, 0.4)'
                      ]
                    }}
                    transition={{
                      scale: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
                      boxShadow: { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleOpenCart}
                    className="relative bg-gradient-to-r from-brand-primary via-orange-500 to-amber-600 text-white px-4.5 sm:px-5.5 py-2.5 rounded-full font-black text-xs sm:text-sm flex items-center shadow-xl cursor-pointer shrink-0 border border-orange-300/40 group overflow-hidden"
                  >
                    {/* Glowing Ping Dot */}
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 z-10">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-80"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-400 border-2 border-white shadow-xs"></span>
                    </span>

                    {/* Shimmer Effect */}
                    <motion.span 
                      className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", repeatDelay: 1 }}
                    />

                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 animate-bounce shrink-0 relative z-10" style={{ animationDuration: '1.6s' }} />
                    <span className="tracking-wide relative z-10">Comanda ({cart.length})</span>
                  </motion.button>
                )}
              </div>
            </div>

            {(() => {
              const filteredProducts = restaurantProducts.filter((product) => {
                const pType = product.type || (product.category?.toLowerCase().includes('bebida') ? 'DRINK' : 'FOOD');
                if (menuTypeFilter === 'FOOD' && pType !== 'FOOD') return false;
                if (menuTypeFilter === 'DRINK' && pType !== 'DRINK') return false;
                return true;
              });

              if (filteredProducts.length === 0) {
                return (
                  <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-xs">
                    <Utensils className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg font-medium">
                      {restaurantProducts.length === 0 
                        ? 'Este restaurante no ha cargado productos en su menú digital.'
                        : 'No se encontraron opciones para esta categoría.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => {
                    const isDrink = (product.type === 'DRINK') || (!product.type && product.category?.toLowerCase().includes('bebida'));
                    return (
                      <div 
                        key={product.id}
                        className="bg-white rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between group"
                      >
                        <div className="flex gap-4 p-5">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider inline-flex items-center gap-1 ${
                                isDrink ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {isDrink ? '🥤 Bebida' : '🍲 Alimento'}
                              </span>
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg leading-tight">{product.name}</h3>
                            <p className="text-slate-500 text-sm mt-1 line-clamp-2">{product.description}</p>
                            <div className="mt-3 flex items-center gap-3">
                              <span className="text-brand-primary font-black text-lg">${product.price}</span>
                              <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md flex items-center">
                                <Clock className="w-3 h-3 mr-1" /> <span>{product.prepTime} min</span>
                              </span>
                            </div>
                          </div>
                          {product.image && (
                            <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-slate-50 border border-slate-100">
                              <img 
                                src={product.image} 
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                        </div>
                        <div className="px-5 pb-5 pt-0 border-t border-slate-50 flex items-center justify-between">
                          <span className={`text-xs font-semibold ${product.available ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {product.available ? '● Disponible' : '● Agotado'}
                          </span>
                          <button
                            onClick={() => openProductModal(product)}
                            disabled={!product.available}
                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                              product.available 
                                ? 'bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white cursor-pointer' 
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" /> <span>Agregar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Active Table Session & Comanda Panel */}
            {tableFromQr && (
              <div className="mt-12 bg-white rounded-3xl border border-slate-150 p-6 shadow-sm animate-scale-in">
                {selectedRestaurant?.qrOrderingMode === 'ALWAYS_DISABLED' ? (
                  <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-950 flex items-start gap-3.5 shadow-xs">
                    <div className="p-2.5 bg-rose-100 rounded-xl text-rose-800 shrink-0 mt-0.5">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-extrabold text-xs uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                          <span>Mesa {tableFromQr} - Pedidos QR Desactivados</span>
                        </span>
                        <span className="bg-rose-200 text-rose-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                          Solo Catálogo Digital
                        </span>
                      </div>
                      <p className="text-xs text-rose-900 font-medium mt-1.5 leading-relaxed">
                        El restaurante ha configurado los pedidos por código QR como desactivados. Puedes consultar nuestro menú digital y realizar tu pedido directamente con tu mesero.
                      </p>
                    </div>
                  </div>
                ) : selectedRestaurant?.qrOrderingMode === 'ALWAYS_ACTIVE' ? (
                  <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <div>
                        <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-950 block">
                          Mesa {tableFromQr} - Pedidos QR Siempre Activados
                        </span>
                        <span className="text-[11px] text-emerald-800 font-bold block mt-0.5">
                          ¡Puedes realizar tus pedidos directamente desde tu celular en cualquier momento!
                        </span>
                      </div>
                    </div>
                    <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
                      Siempre Activo ⚡
                    </span>
                  </div>
                ) : !isTableUnlocked ? (
                  <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-950 flex items-start gap-3.5 shadow-xs">
                    <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800 shrink-0 mt-0.5">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-extrabold text-xs uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                          <span>Mesa {tableFromQr} Bloqueada para Pedidos QR</span>
                        </span>
                        <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                          Mesa Inactiva
                        </span>
                      </div>
                      <p className="text-xs text-amber-900 font-medium mt-1.5 leading-relaxed">
                        Para evitar que personas fuera de la mesa hagan pedidos falsos por el código QR, la opción de pedir desde tu celular se activará cuando <strong>un mesero les entregue su primer platillo en la mesa</strong>.
                      </p>
                      <p className="text-[11px] font-bold text-amber-800 mt-2">
                        💡 Si ya se encuentran sentados, soliciten a su mesero tomar su orden inicial o activar los pedidos QR de su mesa.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <div>
                        <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-950 block">
                          Mesa {tableFromQr} Activada
                        </span>
                        <span className="text-[11px] text-emerald-800 font-bold block mt-0.5">
                          ¡Platillo entregado por mesero! Ya puedes agregar más platillos o bebidas a tu comanda desde tu celular.
                        </span>
                      </div>
                    </div>
                    <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
                      Desbloqueada 🔓
                    </span>
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-650 flex items-center justify-center font-black text-lg animate-pulse">
                      🍽️
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                        Mesa Activa: <span className="text-brand-primary">{tableFromQr}</span>
                      </h3>
                      <p className="text-xs text-slate-500 font-bold uppercase mt-0.5">
                        Estás ordenando de forma autónoma en la mesa.
                      </p>
                    </div>
                  </div>

                  {/* Bill / Account button */}
                  {activeTableOrder && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (isRequestingBill || activeTableOrder.customerBillRequestedFromWaiter || activeTableOrder.billRequested) {
                            return;
                          }
                          handleRequestTableBill();
                        }}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition border ${
                          (activeTableOrder.customerBillRequestedFromWaiter || activeTableOrder.billRequested)
                            ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                            : 'bg-white text-red-600 border-red-600 hover:bg-red-50 shadow-sm hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                        style={{
                          color: '#dc2626'
                        }}
                      >
                        {(activeTableOrder.customerBillRequestedFromWaiter || activeTableOrder.billRequested) ? '🛎️ Cuenta Solicitada' : '🛎️ Solicitar la Cuenta'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Active Comanda Items status */}
                {activeTableOrder ? (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-extrabold text-slate-700 text-sm uppercase tracking-wide">
                        Estado de tu Comanda
                      </h4>
                      <span className="text-xs font-black uppercase font-mono px-3 py-1 rounded-full bg-slate-100 text-slate-800">
                        Total Mesa: ${activeTableOrder.total}
                      </span>
                    </div>

                    <div className="space-y-3 bg-slate-50 rounded-2xl border border-slate-100 p-5">
                      {activeTableOrder.items.map((it, idx) => {
                        const isDraft = it.sentToKitchen === false;
                        return (
                          <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-2.5 last:border-0 last:pb-0">
                            <div>
                              <span className="font-black text-brand-primary mr-2">{it.quantity}x</span>
                              <span className="font-bold text-slate-800">{it.name}</span>
                              {it.selectedVariant && (
                                <span className="text-xs text-slate-400 font-semibold block mt-0.5">({it.selectedVariant})</span>
                              )}
                              {it.selectedExtras && it.selectedExtras.length > 0 && (
                                <span className="text-[11px] text-indigo-600 font-medium block mt-0.5">Extras: {it.selectedExtras.map(e => e.name).join(', ')}</span>
                              )}
                              {it.notes && (
                                <span className="text-xs text-slate-500 italic block mt-0.5 bg-white p-1 rounded border border-slate-100">"{it.notes}"</span>
                              )}
                            </div>
                            
                            <div className="text-right shrink-0">
                              <span className="block text-xs font-mono font-bold text-slate-700 mb-1">${it.price * it.quantity}</span>
                              {isDraft ? (
                                <span className="bg-amber-150 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse inline-block">
                                  ⏳ Por enviar a cocina
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block border border-emerald-100 font-bold">
                                  🍳 En Cocina
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Submit comanda to kitchen banner */}
                      {activeTableOrder.items.some(i => i.sentToKitchen === false) && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
                          <div>
                            <p className="text-xs font-extrabold text-amber-900 uppercase">
                              Tienes platillos pendientes de enviar
                            </p>
                            <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                              Agrégalos y cuando termines, envíalos a la cocina para que el chef empiece a prepararlos.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleSendComandaToKitchen}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-black py-2 px-5 rounded-xl text-xs uppercase tracking-wider transition shrink-0 shadow-sm cursor-pointer"
                          >
                            🔥 Enviar comanda a la cocina
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 font-medium text-sm border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    Aún no has agregado platillos a tu comanda. ¡Selecciona del menú arriba y haz click en pedir!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
      ) : (
        /* 2. EXPLORE VIEW (ALL RESTAURANTS) */
        <div>
          {/* Welcome Hero Banner */}
          <div className="bg-gradient-to-br from-brand-primary via-orange-600 to-orange-700 rounded-3xl p-8 md:p-12 text-white mb-8 shadow-sm relative overflow-hidden">
            <div className="max-w-2xl relative z-10">
              <span className="bg-white/20 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider">
                Mesa 22 - Todos tus antojos en un solo lugar
              </span>
              <h1 className="text-3xl md:text-5xl font-black mt-4 leading-tight tracking-tight">
                Tus establecimientos favoritos a domicilio o para llevar.
              </h1>
              <p className="text-orange-50 text-sm md:text-base mt-3 max-w-lg opacity-90">
                Explora los mejores platillos locales, haz tu pedido fácil en línea y recíbelo calientito en minutos.
              </p>
              
              {/* Search Bar inside Hero */}
              <div className="mt-8 bg-white rounded-2xl p-2 shadow-md flex flex-col sm:flex-row items-center gap-2 max-w-xl text-slate-800">
                <div className="flex items-center flex-1 px-3 w-full border-b sm:border-b-0 sm:border-r border-gray-100 pb-2 sm:pb-0">
                  <Search className="text-slate-400 w-5 h-5 mr-2 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="¿Qué se te antoja hoy? buscar tacos, hamburguesas, sushi..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-slate-800 bg-transparent outline-hidden text-sm py-1.5 focus:ring-0 focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center gap-1.5 px-3 shrink-0 w-full sm:w-auto justify-between sm:justify-start border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                  <MapPin className="w-4 h-4 text-brand-primary shrink-0" />
                  {cities.length === 0 ? (
                    <span className="text-slate-500 text-xs font-bold">Cargando ciudades...</span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <select
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="bg-transparent text-slate-800 text-xs font-black py-1 pr-1 outline-hidden cursor-pointer hover:text-brand-primary transition"
                      >
                        <option value="Todas">Todas las ciudades</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.name} className="font-bold text-slate-800">
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {currentUser && userProfile?.city && selectedCity === userProfile.city && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCityValue(userProfile.city);
                            setIsCityModalOpen(true);
                          }}
                          className="text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-black px-2 py-0.5 rounded-md shrink-0 transition cursor-pointer flex items-center gap-1"
                          title="Haz clic para cambiar tu ciudad de registro"
                        >
                          <span>Tu ciudad</span>
                          <Edit3 className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {currentUser && selectedCity !== 'Todas' && selectedCity !== userProfile?.city && (
                        <button
                          type="button"
                          onClick={() => handleSaveCustomerCity(selectedCity)}
                          className="text-[10px] bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold px-2 py-0.5 rounded-md shrink-0 transition cursor-pointer shadow-2xs flex items-center gap-1"
                          title="Establecer esta ciudad como tu ciudad principal"
                        >
                          <span>Guardar en mi perfil</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Decors */}
            <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 hidden lg:block">
              <svg className="w-full h-full text-white" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" strokeDasharray="10 15" />
                <path d="M50 20 V80 M20 50 H80" stroke="currentColor" strokeWidth="8" />
              </svg>
            </div>
          </div>

          {/* Categories Bento Box */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-brand-primary" />
                Explorar Categorías
              </h2>
              <button 
                onClick={() => setSelectedCategory('Todos')} 
                className="text-brand-primary hover:text-brand-primary-hover text-sm font-semibold hover:underline cursor-pointer"
              >
                Ver todas
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin custom-scrollbar snap-x">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                const emoji = CATEGORY_EMOJIS[cat] || '🍽️';
                const styleColors = CATEGORY_COLORS[cat] || 'bg-slate-100 border-slate-200';
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`snap-center flex-shrink-0 w-24 flex flex-col items-center gap-2 p-3 rounded-2xl border transition cursor-pointer hover:scale-105 duration-200 ${
                      isActive 
                        ? 'bg-orange-600 border-orange-600 text-white shadow-xs' 
                        : `${styleColors} text-slate-700 hover:bg-gray-50`
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/95 shadow-2xs flex items-center justify-center text-2xl">
                      {emoji}
                    </div>
                    <span className="text-xs font-bold truncate w-full text-center">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-8 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
              <SlidersHorizontal className="w-4 h-4 text-brand-primary" />
              Filtrar por:
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Free shipping badge */}
              <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-black rounded-xl px-3 py-2 flex items-center gap-1.5">
                <span>🚀 Envíos Gratis en todos tus pedidos</span>
              </div>
            </div>
            <div className="text-slate-400 text-xs font-medium">
              <span>Mostrando {filteredRestaurants.length} establecimientos</span>
            </div>
          </div>

          {/* Restaurants Grid */}
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
              <p className="text-slate-500 font-medium">Buscando deliciosos establecimientos...</p>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-2xs max-w-lg mx-auto mt-6">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-bold text-slate-800 text-lg">No encontramos resultados</h3>
              <p className="text-slate-500 text-sm mt-1">Prueba cambiando los filtros de categoría o buscando algo diferente.</p>
              <button 
                onClick={() => { setSelectedCategory('Todos'); setSearchTerm(''); setSortBy('none'); setPriceFilter('all'); }}
                className="mt-4 bg-brand-primary text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                Restablecer Filtros
              </button>
            </div>
          ) : (
            <div>
              {/* "Lo mejor de la ciudad" Section */}
              {bestOfCityRestaurants.length > 0 && selectedCategory === 'Todos' && (
                <div className="mb-10 bg-gradient-to-br from-amber-500/10 via-amber-50/60 to-orange-500/10 p-6 md:p-8 rounded-3xl border border-amber-300/80 shadow-xs relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md border border-amber-400">
                        <Trophy className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                          <span>Lo Mejor de la Ciudad</span>
                          {cityObjForActiveUser && (
                            <span className="text-xs font-black text-amber-900 bg-amber-200/90 px-3 py-1 rounded-full border border-amber-300 shadow-2xs">
                              📍 {cityObjForActiveUser.name}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs font-bold text-amber-900/80 mt-0.5">
                          Top 3 establecimientos más destacados
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {bestOfCityRestaurants.map(({ restaurant, rank }) => {
                      const rankConfigs = {
                        1: {
                          badge: '🥇 1er Lugar de la Ciudad',
                          badgeBg: 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black shadow-md border border-amber-300',
                          cardStyle: 'border-2 border-amber-400 bg-gradient-to-b from-amber-50/80 via-white to-white shadow-md hover:shadow-xl hover:border-amber-500 scale-[1.02]',
                          tagBg: 'bg-amber-100 text-amber-950 font-black border border-amber-300/70',
                        },
                        2: {
                          badge: '🥈 2do Lugar de la Ciudad',
                          badgeBg: 'bg-gradient-to-r from-slate-600 via-slate-700 to-slate-800 text-white font-black shadow-md border border-slate-500',
                          cardStyle: 'border-2 border-slate-300 bg-gradient-to-b from-slate-50/80 via-white to-white shadow-xs hover:shadow-lg hover:border-slate-400',
                          tagBg: 'bg-slate-100 text-slate-800 font-bold border border-slate-200',
                        },
                        3: {
                          badge: '🥉 3er Lugar de la Ciudad',
                          badgeBg: 'bg-gradient-to-r from-amber-800 via-amber-900 to-amber-950 text-amber-100 font-black shadow-md border border-amber-700',
                          cardStyle: 'border-2 border-amber-800/30 bg-gradient-to-b from-amber-900/5 via-white to-white shadow-xs hover:shadow-lg hover:border-amber-700/60',
                          tagBg: 'bg-amber-50 text-amber-900 font-bold border border-amber-200/60',
                        },
                      };

                      const currentConfig = rankConfigs[rank as 1 | 2 | 3] || rankConfigs[3];

                      return (
                        <div 
                          key={restaurant.id}
                          onClick={() => handleSelectRestaurant(restaurant)}
                          className={`rounded-3xl transition duration-300 overflow-hidden cursor-pointer flex flex-col justify-between h-full group ${currentConfig.cardStyle}`}
                        >
                          <div>
                            <div className="h-44 bg-slate-100 relative overflow-hidden">
                              <img 
                                src={restaurant.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=400'} 
                                alt={restaurant.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=400';
                                }}
                              />
                              <span className={`absolute top-3 left-3 text-[11px] tracking-wide px-3 py-1 rounded-full ${currentConfig.badgeBg}`}>
                                {currentConfig.badge}
                              </span>
                              {(() => {
                                const sched = checkIsRestaurantOpen(restaurant);
                                return (
                                  <span className={`absolute top-3 right-3 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs ${
                                    sched.isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-rose-200'
                                  }`}>
                                    {sched.isOpen ? '🟢 Abierto' : '🔴 Cerrado'}
                                  </span>
                                );
                              })()}
                            </div>

                            <div className="p-5">
                              <h4 className="text-lg font-black text-slate-800 leading-snug">{restaurant.name}</h4>
                              <p className="text-slate-500 text-xs mt-1.5 flex items-center line-clamp-1">
                                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                                <span>{restaurant.address}</span>
                              </p>
                            </div>
                          </div>

                          <div className="p-5 pt-0">
                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                <span className="flex items-center">
                                  <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                  <span>{restaurant.deliveryTime || '30-40 min'}</span>
                                </span>
                                <span>• Envío: <span className="text-emerald-600 font-extrabold">¡Gratis!</span></span>
                              </div>
                              <span className="text-brand-primary text-xs font-black flex items-center">
                                <span>Ver menú</span> <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All / Other Restaurants List */}
              <h3 className="text-xl font-extrabold text-slate-800 mb-5">
                {bestOfCityRestaurants.length > 0 && selectedCategory === 'Todos' && !searchTerm
                  ? (selectedCity !== 'Todas' ? `Otros Establecimientos en ${selectedCity}` : 'Otros Establecimientos')
                  : (selectedCity !== 'Todas' ? `Establecimientos en ${selectedCity}` : 'Todos los Establecimientos')}
              </h3>

              {otherFilteredRestaurants.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 text-center text-slate-500 text-xs font-semibold">
                  {bestOfCityRestaurants.length > 0
                    ? 'Los mejores establecimientos de esta ciudad se muestran arriba en "Lo Mejor de la Ciudad".'
                    : 'No hay más establecimientos disponibles para los filtros seleccionados.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherFilteredRestaurants.map((restaurant) => (
                    <div 
                      key={restaurant.id}
                      onClick={() => handleSelectRestaurant(restaurant)}
                      className="bg-white rounded-3xl border border-gray-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition duration-200 overflow-hidden cursor-pointer flex flex-col justify-between h-full"
                    >
                    <div>
                      <div className="h-44 bg-slate-100 relative">
                        <img 
                          src={restaurant.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=400'} 
                          alt={restaurant.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=400';
                          }}
                        />
                        {restaurant.status === 'SUSPENDED' && (
                          <span className="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase shadow-xs">
                            Suspendido
                          </span>
                        )}
                        {(() => {
                          const sched = checkIsRestaurantOpen(restaurant);
                          return (
                            <span className={`absolute top-3 right-3 text-[10px] font-black px-2.5 py-1 rounded-full uppercase shadow-xs ${
                              sched.isOpen ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'
                            }`}>
                              {sched.isOpen ? '🟢 Abierto' : '🔴 Cerrado'}
                            </span>
                          );
                        })()}
                        <span className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs text-slate-850 text-xs font-extrabold px-2.5 py-1 rounded-lg shadow-sm">
                          {restaurant.deliveryTime}
                        </span>
                      </div>
                      <div className="p-5">
                        <h4 className="text-lg font-bold text-slate-800">{restaurant.name}</h4>
                        <p className="text-slate-400 text-xs mt-1 flex items-center line-clamp-1">
                          <MapPin className="w-3 h-3 mr-1" /> <span>{restaurant.address}</span>
                        </p>
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>Costo de envío: <strong className="text-emerald-600">¡Gratis!</strong></span>
                      <span className="text-brand-primary font-bold flex items-center">
                        <span>Pedir ahora</span> <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      )}

      {/* 3. PRODUCT CUSTOMIZATION MODAL */}
      {activeProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            <div className="relative h-48 bg-slate-100 shrink-0">
              <img 
                src={activeProduct.image} 
                alt={activeProduct.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setActiveProduct(null)}
                className="absolute top-4 right-4 bg-white/80 hover:bg-white text-slate-700 p-2 rounded-full transition shadow-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <h3 className="text-2xl font-black text-slate-800 leading-tight">{activeProduct.name}</h3>
              <p className="text-slate-500 text-sm mt-1">{activeProduct.description}</p>
              
              {/* Variants Selector */}
              {activeProduct.variants && activeProduct.variants.map((v) => (
                <div key={v.name} className="mt-5 pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-2">{v.name}</h4>
                  <div className="flex flex-wrap gap-2">
                    {v.options.map((opt) => {
                      const isSel = selectedVariant === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedVariant(opt)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                            isSel 
                              ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' 
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Extras Selector */}
              {activeProduct.extras && activeProduct.extras.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-2">Extras opcionales</h4>
                  <div className="space-y-2">
                    {activeProduct.extras.map((ex) => {
                      const isSel = selectedExtras.some(e => e.name === ex.name);
                      return (
                        <label 
                          key={ex.name} 
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer text-sm"
                        >
                          <div className="flex items-center gap-3 font-semibold text-slate-700">
                            <input 
                              type="checkbox"
                              checked={isSel}
                              onChange={() => {
                                if (isSel) {
                                  setSelectedExtras(selectedExtras.filter(e => e.name !== ex.name));
                                } else {
                                  setSelectedExtras([...selectedExtras, ex]);
                                }
                              }}
                              className="accent-brand-primary rounded"
                            />
                            {ex.name}
                          </div>
                          <span className="text-brand-primary font-bold">+${ex.price}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observations */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-2">Instrucciones especiales</h4>
                <textarea 
                  placeholder="Ej. Sin cebolla, aderezo aparte, etc."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary h-20 resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-semibold block uppercase">Total producto</span>
                <span className="text-xl font-black text-brand-primary">
                  ${activeProduct.price + selectedExtras.reduce((s, e) => s + e.price, 0)}
                </span>
              </div>
              <button 
                onClick={addToCart}
                className="bg-brand-primary text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-primary-hover shadow-md hover:scale-[1.02] transition cursor-pointer"
              >
                Agregar a la Comanda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Comanda Button for Mobile & Desktop Computers */}
      {cart.length > 0 && !isCartOpen && (
        <AnimatePresence>
          <motion.button
            key={`floating-comanda-${cart.length}`}
            initial={{ y: 50, opacity: 0, scale: 0.8 }}
            animate={{ 
              y: 0, 
              opacity: 1, 
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 8px 20px rgba(234, 88, 12, 0.45)',
                '0 14px 32px rgba(234, 88, 12, 0.85)',
                '0 8px 20px rgba(234, 88, 12, 0.45)'
              ]
            }}
            exit={{ y: 50, opacity: 0, scale: 0.8 }}
            transition={{
              scale: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
              boxShadow: { repeat: Infinity, duration: 1.8, ease: "easeInOut" }
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleOpenCart}
            className="fixed bottom-6 right-5 sm:bottom-8 sm:right-8 z-40 bg-gradient-to-r from-brand-primary via-orange-500 to-amber-600 text-white px-5 sm:px-7 py-3.5 sm:py-4 rounded-full font-black text-sm sm:text-base flex items-center gap-2.5 sm:gap-3 shadow-2xl border-2 border-white/90 cursor-pointer overflow-hidden group"
          >
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-80"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-400 border border-white"></span>
            </span>
            <motion.span 
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/35 to-transparent transform -skew-x-12"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", repeatDelay: 0.8 }}
            />
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce shrink-0 relative z-10" style={{ animationDuration: '1.6s' }} />
            <span className="tracking-wide relative z-10">Ver Comanda ({cart.length})</span>
          </motion.button>
        </AnimatePresence>
      )}

      {/* 4. SHOPPING CART SLIDE-OVER */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-brand-primary" />
                <h3 className="text-xl font-bold text-slate-800">Tu Pedido</h3>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Steps & Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {checkoutStep === 'cart' && (
                <div>
                  {cart.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium text-sm">Tu comanda está vacía.</p>
                      <button 
                        onClick={() => setIsCartOpen(false)}
                        className="mt-4 bg-brand-primary text-white text-xs font-bold px-4 py-2 rounded-xl"
                      >
                        Seguir navegando
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map((item, idx) => {
                        const itemExtrasCost = (item.extras || []).reduce((s, e) => s + e.price, 0);
                        const singleItemTotal = item.product.price + itemExtrasCost;
                        
                        return (
                          <div key={idx} className="flex gap-3 pb-4 border-b border-slate-100">
                            <div className="flex-1">
                              <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.product.name}</h4>
                              {item.variant && (
                                <p className="text-xs text-slate-400 font-semibold mt-0.5">Opción: {item.variant}</p>
                              )}
                              {item.extras && item.extras.length > 0 && (
                                <p className="text-xs text-brand-primary font-medium mt-0.5">
                                  Extras: {item.extras.map(e => e.name).join(', ')}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                  Nota: "{item.notes}"
                                </p>
                              )}
                              <div className="mt-2 text-sm font-black text-slate-800">${singleItemTotal * item.quantity}</div>
                            </div>
                            <div className="flex flex-col items-center justify-between shrink-0">
                              <button 
                                onClick={() => removeFromCart(idx)}
                                className="text-slate-300 hover:text-rose-500 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200">
                                <button 
                                  onClick={() => updateQuantity(idx, -1)}
                                  className="px-2 py-1 text-slate-500 hover:bg-slate-200 rounded-l-lg transition"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="px-2.5 text-xs font-bold text-slate-700">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(idx, 1)}
                                  className="px-2 py-1 text-slate-500 hover:bg-slate-200 rounded-r-lg transition"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Summary Pricing */}
                      <div className="pt-4 space-y-2 text-sm">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal</span>
                          <span className="font-semibold">${subtotal}</span>
                        </div>
                        {deliveryType === 'DELIVERY' && !tableFromQr && (
                          <div className="flex justify-between text-slate-600">
                            <span>Costo de envío</span>
                            <span className="font-bold text-emerald-600">¡Gratis!</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-800 font-black text-base pt-2 border-t border-dashed border-slate-200">
                          <span>Total</span>
                          <span>${total}</span>
                        </div>
                        {deliveryType === 'DELIVERY' && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-xs text-amber-800 font-bold justify-center">
                            <span>🛵 El repartidor solamente acepta pagos en efectivo.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {checkoutStep === 'shipping' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Datos del Cliente</h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Juan Pérez"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Teléfono <span className="text-rose-500 font-extrabold">* Obligatorio</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ej. 5512345678"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Electrónico (Opcional)</label>
                    <input 
                      type="email" 
                      placeholder="juan@ejemplo.com"
                      value={custEmail}
                      onChange={(e) => setCustEmail(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Método de entrega</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryType('DELIVERY')}
                        className={`py-3 rounded-xl font-bold text-xs border transition ${
                          deliveryType === 'DELIVERY' 
                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' 
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        A domicilio
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryType('PICKUP')}
                        className={`py-3 rounded-xl font-bold text-xs border transition ${
                          deliveryType === 'PICKUP' 
                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' 
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Recoger en sucursal
                      </button>
                    </div>
                  </div>

                  {selectedRestaurant && !checkIsRestaurantOpen(selectedRestaurant).isOpen && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 font-medium space-y-1">
                      <div className="font-extrabold uppercase text-[11px] text-rose-700 flex items-center gap-1.5">
                        <span>⚠️ RESTAURANTE CERRADO</span>
                      </div>
                      <p>{checkIsRestaurantOpen(selectedRestaurant).reason}</p>
                      <p className="font-bold text-rose-800">No se pueden realizar pedidos mientras el restaurante esté fuera de horario o en su día de descanso.</p>
                    </div>
                  )}

                  {deliveryType === 'DELIVERY' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between items-center">
                        <span>Dirección de Entrega</span>
                        <span className="text-rose-500 font-extrabold lowercase text-[10px]">* obligatorio</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="Calle, Número, Colonia, Municipio"
                        value={custAddress}
                        onChange={(e) => setCustAddress(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observaciones del Pedido</label>
                    <textarea 
                      placeholder="Ej. Tocar el timbre fuerte, dejar en caseta, etc."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary h-20 resize-none"
                    />
                  </div>

                  {/* Payment warning */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-slate-700">Pago Contra Entrega</span>
                      Por el momento solo aceptamos pago en efectivo al recibir el pedido o al recogerlo en sucursal.
                    </div>
                  </div>
                </div>
              )}

              {checkoutStep === 'success' && placedOrder && (
                <div className="text-center py-10">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h4 className="text-2xl font-black text-slate-800">¡Pedido Confirmado!</h4>
                  <p className="text-slate-500 text-sm mt-2 mb-6">Tu pedido ha sido enviado al restaurante.</p>
                  
                  {/* Status Tracker Stepper */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 text-left animate-fadeIn">
                    <h5 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider mb-4 flex justify-between items-center">
                      <span>Rastreo en Tiempo Real</span>
                      <span className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">
                        Vivo
                      </span>
                    </h5>

                    {placedOrder.status === 'CANCELLED' ? (
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-800 text-center font-bold">
                        ❌ El pedido ha sido cancelado por el restaurante.
                      </div>
                    ) : (
                      <div>
                        {/* Prominent notification banner for Pickup order when READY */}
                        {placedOrder.deliveryType === 'PICKUP' && placedOrder.status === 'READY' && (
                          <div className="mb-5 p-4 bg-emerald-500 text-white rounded-2xl shadow-lg border border-emerald-400 flex items-center gap-3.5 animate-bounce">
                            <div className="p-2.5 bg-white/20 rounded-xl text-white shrink-0">
                              <ShoppingBag className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                              <h6 className="font-extrabold text-sm uppercase tracking-wide">
                                ¡Tu pedido está listo para que lo recojas!
                              </h6>
                              <p className="text-xs text-emerald-100 mt-0.5 font-medium leading-relaxed">
                                Puedes pasar por tu pedido a la sucursal de <strong>{placedOrder.restaurantName}</strong>.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Stepper visual */}
                        <div className="relative flex items-center justify-between mb-4">
                          {/* Progress Line */}
                          <div className="absolute left-0 right-0 top-1/2 h-1 bg-slate-200 -translate-y-1/2 z-0 rounded-full"></div>
                          {(() => {
                            const isPickup = placedOrder.deliveryType === 'PICKUP';
                            const steps = isPickup ? [
                              { step: 1, label: 'Recibido', icon: '📥' },
                              { step: 2, label: 'Cocinando', icon: '🍳' },
                              { step: 3, label: 'Listo', icon: '🛍️' }
                            ] : [
                              { step: 1, label: 'Recibido', icon: '📥' },
                              { step: 2, label: 'Cocina', icon: '🍳' },
                              { step: 3, label: 'Listo', icon: '🛍️' },
                              { step: 4, label: 'En Camino', icon: '🏍️' },
                              { step: 5, label: 'Entregado', icon: '🎉' }
                            ];

                            const getActiveStep = (status: string): number => {
                              if (isPickup) {
                                if (['PENDING', 'CONFIRMED'].includes(status)) return 1;
                                if (status === 'PREPARING') return 2;
                                if (['READY', 'DELIVERED', 'SERVED'].includes(status)) return 3;
                                return 1;
                              }
                              if (['PENDING', 'CONFIRMED'].includes(status)) return 1;
                              if (status === 'PREPARING') return 2;
                              if (['READY', 'ASSIGNED'].includes(status)) return 3;
                              if (status === 'SHIPPED') return 4;
                              if (status === 'DELIVERED') return 5;
                              return 1;
                            };

                            const step = getActiveStep(placedOrder.status);
                            const progressPercent = ((step - 1) / (steps.length - 1)) * 100;

                            return (
                              <>
                                <div 
                                  className="absolute left-0 top-1/2 h-1 bg-brand-primary -translate-y-1/2 z-0 rounded-full transition-all duration-500"
                                  style={{ 
                                    width: `${progressPercent}%` 
                                  }}
                                ></div>

                                {/* Steps */}
                                {steps.map((s) => {
                                  const active = step >= s.step;
                                  return (
                                    <div key={s.step} className="relative z-10 flex flex-col items-center">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-xs transition-all duration-300 ${
                                        active 
                                          ? 'bg-brand-primary text-white scale-110 font-extrabold' 
                                          : 'bg-white border border-slate-200 text-slate-400 font-bold'
                                      }`}>
                                        {s.icon}
                                      </div>
                                      <span className={`text-[9px] font-black uppercase mt-1 tracking-wider ${
                                        active ? 'text-brand-primary' : 'text-slate-400'
                                      }`}>
                                        {s.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </div>

                        {/* Status Description Box */}
                        <div className="bg-white border border-slate-150 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5 shadow-xs">
                          <p className="font-extrabold text-slate-800 text-xs">
                            Estado actual: <span className="text-brand-primary font-black uppercase">
                              {placedOrder.deliveryType === 'PICKUP' ? (
                                (placedOrder.status === 'PENDING' || placedOrder.status === 'CONFIRMED') ? 'Recibido' :
                                placedOrder.status === 'PREPARING' ? 'Cocinando' :
                                placedOrder.status === 'READY' ? '¡Listo para que lo recojas!' :
                                placedOrder.status === 'DELIVERED' ? 'Entregado' : placedOrder.status
                              ) : (
                                placedOrder.status === 'PENDING' && 'Recibido (Esperando confirmación)' ||
                                placedOrder.status === 'CONFIRMED' && 'Confirmado (En cola de cocina)' ||
                                placedOrder.status === 'PREPARING' && 'Preparándose en cocina' ||
                                placedOrder.status === 'READY' && 'Listo para entrega' ||
                                placedOrder.status === 'ASSIGNED' && 'Repartidor asignado' ||
                                placedOrder.status === 'SHIPPED' && 'En camino a tu domicilio' ||
                                placedOrder.status === 'DELIVERED' && 'Entregado con éxito'
                              )}
                            </span>
                          </p>
                          {placedOrder.deliveryType !== 'PICKUP' && placedOrder.driverName && (
                            <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-center gap-2">
                              <img 
                                src="/driver-silhouette.svg" 
                                alt="Repartidor" 
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" 
                              />
                              <div>
                                <p className="font-bold text-slate-800">Repartidor asignado: {placedOrder.driverName}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Celular: {placedOrder.driverPhone}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 my-6 text-left text-xs space-y-2">
                    <div className="text-slate-400 font-bold uppercase">Ticket de Pedido</div>
                    <div><strong>ID:</strong> <span className="font-mono bg-slate-200 px-1 py-0.5 rounded">{placedOrder.id}</span></div>
                    <div><strong>Restaurante:</strong> {placedOrder.restaurantName}</div>
                    <div><strong>Cliente:</strong> {placedOrder.customerName}</div>
                    <div><strong>Teléfono:</strong> {placedOrder.customerPhone}</div>
                    <div><strong>Tipo de entrega:</strong> {placedOrder.deliveryType === 'DELIVERY' ? 'A domicilio' : 'Recoger en Sucursal'}</div>
                    {placedOrder.deliveryType === 'DELIVERY' && (
                      <div><strong>Dirección:</strong> {(placedOrder as any).deliveryAddress}</div>
                    )}
                    <div className="border-t border-slate-200 my-2 pt-2">
                      <strong>Detalle:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-600">
                        {placedOrder.items.map((i, k) => (
                          <li key={k}>
                            {i.quantity}x {i.name} {i.selectedVariant ? `(${i.selectedVariant})` : ''} - ${i.price * i.quantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-sm font-black text-slate-800 text-right pt-2 border-t border-slate-200">
                      Total a pagar: ${placedOrder.total}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setCheckoutStep('cart');
                      setPlacedOrder(null);
                      // Mantener el restaurante seleccionado para volver a su menú directamente
                    }}
                    className="w-full bg-brand-primary text-white font-bold py-3 rounded-xl shadow-md hover:bg-brand-primary-hover transition"
                  >
                    Volver al Inicio
                  </button>
                </div>
              )}
            </div>

            {/* Footer Buttons for navigation inside drawer */}
            {checkoutStep !== 'success' && cart.length > 0 && (
              <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
                {tableFromQr ? (
                  isRestaurantClosed ? (
                    <button
                      type="button"
                      disabled
                      className="w-full bg-slate-200 text-slate-500 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition text-xs uppercase tracking-wide border border-slate-300 cursor-not-allowed shadow-none"
                    >
                      <Lock className="w-4 h-4 text-slate-400" /> Restaurante Cerrado
                    </button>
                  ) : isTableUnlocked ? (
                    <button
                      onClick={handleAddToTableComanda}
                      className="w-full bg-emerald-500 text-white font-black py-3.5 rounded-xl hover:bg-emerald-600 shadow-md flex items-center justify-center gap-2 transition cursor-pointer text-sm uppercase tracking-wide"
                    >
                      <ShoppingBag className="w-5 h-5" /> Enviar a preparación
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedRestaurant?.qrOrderingMode === 'ALWAYS_DISABLED') {
                          alert(`🔒 El restaurante tiene desactivada la opción de realizar pedidos por código QR en mesa.\n\nPor favor, solicita atención a tu mesero para tomar tu pedido.`);
                        } else {
                          alert(`🔒 La Mesa ${tableFromQr} está bloqueada para pedidos por QR.\n\nPara poder pedir desde tu celular, un mesero debe entregar al menos un platillo en tu mesa. Solicita atención a tu mesero.`);
                        }
                      }}
                      className="w-full bg-slate-300 text-slate-600 font-extrabold py-3.5 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-xs uppercase tracking-wide border border-slate-300 shadow-none"
                    >
                      <Lock className="w-4 h-4 text-slate-500" /> {selectedRestaurant?.qrOrderingMode === 'ALWAYS_DISABLED' ? 'Pedidos QR Desactivados' : 'Mesa Bloqueada (Espere a su mesero)'}
                    </button>
                  )
                ) : checkoutStep === 'cart' ? (
                  isRestaurantClosed ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{closedReason || 'Restaurante cerrado actualmente. No se pueden realizar pedidos.'}</span>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="w-full bg-slate-200 text-slate-500 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition text-xs uppercase tracking-wide border border-slate-300 cursor-not-allowed opacity-80"
                      >
                        <Lock className="w-4 h-4 text-slate-400" /> Restaurante Cerrado
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCheckoutStep('shipping')}
                      className="w-full bg-brand-primary text-white font-bold py-3.5 rounded-xl hover:bg-brand-primary-hover shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      Siguiente: Datos de Entrega <ChevronRight className="w-4 h-4" />
                    </button>
                  )
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('cart')}
                      className="px-4 py-3.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-white transition cursor-pointer"
                    >
                      Atrás
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={isRestaurantClosed}
                      className={`flex-1 font-bold py-3.5 rounded-xl shadow-md flex items-center justify-center gap-1.5 transition ${
                        isRestaurantClosed
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300 shadow-none'
                          : 'bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer'
                      }`}
                    >
                      {isRestaurantClosed ? (
                        <>
                          <Lock className="w-4 h-4 text-slate-500" /> Restaurante Cerrado (${total})
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" /> Confirmar Pedido (${total})
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
