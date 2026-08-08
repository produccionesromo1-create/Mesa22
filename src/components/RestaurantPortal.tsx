import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  auth, 
  db,
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  query, 
  where,
  onSnapshot,
  getDoc,
  deleteDoc,
  deleteField
} from '../firebase';
import AuthModal from './AuthModal';
import Logo from './Logo';
import ProductImageUploader from './ProductImageUploader';
import { notificationService } from '../utils/notificationService';
import { sendDriverNewOrderEmail, sendRestaurantNewOrderEmail } from '../utils/emailService';
import { compressImageFile } from '../utils/imageUtils';
import { 
  Restaurant, 
  Product, 
  Order, 
  Ingredient, 
  Supplier, 
  Purchase, 
  CashRegisterSession,
  OrderStatus,
  OrderItem,
  Employee,
  City
} from '../types';
import { 
  Store, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Clock, 
  Database, 
  ChefHat, 
  Printer, 
  DollarSign, 
  Scissors, 
  AlertTriangle, 
  TrendingUp, 
  Truck, 
  Users, 
  FileText,
  Play,
  Check,
  CheckCircle,
  XCircle,
  FolderPlus,
  RefreshCw,
  Info,
  Lock,
  Unlock,
  LogOut,
  UserCheck,
  Trash2,
  Image as ImageIcon,
  Pencil,
  X,
  Settings,
  Bell,
  BellOff,
  BellRing,
  Search,
  Megaphone,
  QrCode,
  Download,
  ExternalLink,
  Heart,
  Receipt,
  PlusCircle,
  MinusCircle,
  Utensils,
  CupSoda,
  Phone,
  UserMinus,
  Upload
} from 'lucide-react';

interface RestaurantPortalProps {
  onSuperAdminLogin?: () => void;
}

export default function RestaurantPortal({ onSuperAdminLogin }: RestaurantPortalProps = {}) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  // Advertising popup states
  const [adConfig, setAdConfig] = useState<{ imageUrl: string; intervalSeconds: number; enabled: boolean } | null>(null);
  const [showAdPopup, setShowAdPopup] = useState(false);

  // Broadcast Announcement (Avisos Importantes de la Red)
  const [broadcastData, setBroadcastData] = useState<{
    id: string;
    imageUrl: string;
    title: string;
    sentAt: number;
    active: boolean;
  } | null>(null);
  const [showBroadcastPopup, setShowBroadcastPopup] = useState(false);

  // Real-time listener for Super Admin broadcast announcements
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'broadcast_announcement'), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.active !== false && data.id) {
          let finalImageUrl = data.imageUrl || '';
          if (data.imageUrl === 'chunked') {
            try {
              const numChunks = data.numChunks || 0;
              const chunkPromises = [];
              for (let i = 0; i < numChunks; i++) {
                chunkPromises.push(getDoc(doc(db, 'settings', 'broadcast_announcement', 'chunks', `chunk_${i}`)));
              }
              const chunkSnaps = await Promise.all(chunkPromises);
              const chunkData = chunkSnaps.map(s => s.exists() ? s.data()?.data : '').join('');
              if (chunkData) finalImageUrl = chunkData;
            } catch (err) {
              console.error('Error reassembling broadcast image:', err);
            }
          }

          const loadedAnnouncement = {
            id: data.id,
            imageUrl: finalImageUrl,
            title: data.title || 'Aviso Importante',
            sentAt: Number(data.sentAt || 0),
            active: data.active !== false
          };

          setBroadcastData(loadedAnnouncement);

          // Check if already dismissed on this browser/device
          const dismissedId = localStorage.getItem('dismissed_broadcast_id');
          if (dismissedId !== data.id && finalImageUrl) {
            setShowBroadcastPopup(true);
          } else {
            setShowBroadcastPopup(false);
          }
        } else {
          setShowBroadcastPopup(false);
          setBroadcastData(null);
        }
      } else {
        setShowBroadcastPopup(false);
        setBroadcastData(null);
      }
    }, (err) => {
      console.error('Error listening to broadcast announcement:', err);
    });

    return () => unsub();
  }, []);

  const handleCloseBroadcastPopup = () => {
    if (broadcastData?.id) {
      localStorage.setItem('dismissed_broadcast_id', broadcastData.id);
    }
    setShowBroadcastPopup(false);
  };

  // Fetch advertising settings in real-time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'ads'), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
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
            console.error('Error loading chunked image in RestaurantPortal:', err);
          }
        }

        setAdConfig({
          imageUrl: finalImageUrl,
          intervalSeconds: data.intervalSeconds !== undefined ? Number(data.intervalSeconds) : 10,
          enabled: data.enabled !== false
        });
      } else {
        setAdConfig({
          imageUrl: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&q=80&w=800',
          intervalSeconds: 10,
          enabled: true
        });
      }
    }, (err) => {
      console.error('Error listening to ads settings:', err);
    });
    return () => unsub();
  }, []);

  const getRemainingDays = (rest: Restaurant | null) => {
    if (!rest) return 0;
    const initialDays = (rest.remainingDays === undefined || rest.remainingDays === null) ? 30 : rest.remainingDays;
    const updatedAt = rest.remainingDaysUpdatedAt || rest.createdAt || Date.now();
    const now = Date.now();
    const elapsedMs = now - updatedAt;
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    return initialDays - elapsedDays;
  };

  const [lastPopupClosedTime, setLastPopupClosedTime] = useState<number | null>(null);

  const handleCloseAdPopup = () => {
    setShowAdPopup(false);
    setLastPopupClosedTime(Date.now());
  };

  // Periodic trigger for donation request advertising popup when remaining days reach 0
  useEffect(() => {
    // Only schedule if ads are configured, active, and the current restaurant is selected
    if (!adConfig || !adConfig.enabled || !selectedRest) {
      setShowAdPopup(false);
      return;
    }

    const interval = setInterval(() => {
      const daysLeft = getRemainingDays(selectedRest);

      // If the restaurant still has remaining days (> 0), keep popup hidden
      if (daysLeft > 0) {
        setShowAdPopup(false);
        setLastPopupClosedTime(null);
        return;
      }

      // If daysLeft === 0:
      if (!showAdPopup) {
        const now = Date.now();
        // If it was never closed, or if 60 seconds (1 minute) have passed since closed
        if (!lastPopupClosedTime || now - lastPopupClosedTime >= 60000) {
          setShowAdPopup(true);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [adConfig, selectedRest, showAdPopup, lastPopupClosedTime]);

  // Auth States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Restaurant | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (user) {
        unsubProfile = onSnapshot(doc(db, 'restaurants', user.uid), (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as Restaurant;
            setUserProfile(data);
            setSelectedRest(data); // Auto lock to logged-in restaurant
          } else {
            setUserProfile(null);
          }
        }, (err) => {
          console.error('Error listening to restaurant profile:', err);
        });
      } else {
        setUserProfile(null);
      }
    });
    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);
  
  // Tabs: dashboard, pos, kitchen, inventory, reports, employees, menu, profile
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'kitchen' | 'inventory' | 'reports' | 'employees' | 'menu' | 'profile'>('dashboard');

  // Employee Login & Management States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loggedInEmployee, setLoggedInEmployee] = useState<Employee | null>(() => {
    const cached = localStorage.getItem('loggedInEmployee');
    return cached ? JSON.parse(cached) : null;
  });
  const loggedInEmployeeRef = React.useRef<Employee | null>(loggedInEmployee);
  useEffect(() => {
    loggedInEmployeeRef.current = loggedInEmployee;
  }, [loggedInEmployee]);

  const [empLoginUsername, setEmpLoginUsername] = useState('');
  const [empLoginPassword, setEmpLoginPassword] = useState('');
  const [showEmpLogin, setShowEmpLogin] = useState(false);
  const [empLoginError, setEmpLoginError] = useState('');

  // Employee Management Form
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpUsername, setNewEmpUsername] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<'cajero' | 'mesero' | 'cocinero'>('cajero');
  const [empError, setEmpError] = useState('');
  const [empSuccess, setEmpSuccess] = useState('');

  // Menu / Product Management States
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Especialidades');
  const [newProdType, setNewProdType] = useState<'FOOD' | 'DRINK'>('FOOD');
  const [newProdDescription, setNewProdDescription] = useState('');
  const [prodError, setProdError] = useState('');
  const [prodSuccess, setProdSuccess] = useState('');

  // Menu / Product Edit States
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('');
  const [editProdImage, setEditProdImage] = useState('');
  const [editProdCategory, setEditProdCategory] = useState('Especialidades');
  const [editProdType, setEditProdType] = useState<'FOOD' | 'DRINK'>('FOOD');
  const [editProdDescription, setEditProdDescription] = useState('');
  const [editProdError, setEditProdError] = useState('');
  const [editProdSuccess, setEditProdSuccess] = useState('');

  // Menu / Product Classification Filters
  const [posTypeFilter, setPosTypeFilter] = useState<'ALL' | 'FOOD' | 'DRINK'>('ALL');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'ALL' | 'FOOD' | 'DRINK'>('ALL');

  // Restaurant Profile Edit States
  const [editRestName, setEditRestName] = useState('');
  const [editRestCategory, setEditRestCategory] = useState('');
  const [editRestCity, setEditRestCity] = useState('');
  const [editRestHours, setEditRestHours] = useState('');
  const [editRestRestDay, setEditRestRestDay] = useState('Ninguno');
  const [editRestPhone, setEditRestPhone] = useState('');
  const [editRestAddress, setEditRestAddress] = useState('');
  const [editRestLogo, setEditRestLogo] = useState('');
  const [editRestDeliveryZone, setEditRestDeliveryZone] = useState('');
  const [editRestDeliveryTime, setEditRestDeliveryTime] = useState('');
  const [editRestDeliveryFee, setEditRestDeliveryFee] = useState('');
  const [editRestDriverPayment, setEditRestDriverPayment] = useState('');
  const [editRestFacebook, setEditRestFacebook] = useState('');
  const [editRestInstagram, setEditRestInstagram] = useState('');
  const [editRestTwitter, setEditRestTwitter] = useState('');
  const [editRestQrOrderingMode, setEditRestQrOrderingMode] = useState<'ALWAYS_ACTIVE' | 'ALWAYS_DISABLED' | 'AUTOMATIC'>('AUTOMATIC');
  const [editRestSuccess, setEditRestSuccess] = useState('');
  const [editRestError, setEditRestError] = useState('');

  // Available Cities (registered by Super Admin)
  const [cities, setCities] = useState<City[]>([]);

  // Load registered cities from Super Admin
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cities'), (snapshot) => {
      const list: City[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as City);
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCities(list);
    }, (err) => {
      console.error('Error loading cities in RestaurantPortal:', err);
    });
    return () => unsub();
  }, []);

  // Auto save logged-in employee to localStorage
  useEffect(() => {
    if (loggedInEmployee) {
      localStorage.setItem('loggedInEmployee', JSON.stringify(loggedInEmployee));
    } else {
      localStorage.removeItem('loggedInEmployee');
    }
  }, [loggedInEmployee]);

  // Restaurant Specific Data
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const ordersRef = React.useRef<Order[]>([]);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cashSessions, setCashSessions] = useState<CashRegisterSession[]>([]);
  const [activeCashSession, setActiveCashSession] = useState<CashRegisterSession | null>(null);

  // POS State
  const [posCart, setPosCart] = useState<{ product: Product; quantity: number; notes?: string }[]>([]);
  const [posCustomerName, setPosCustomerName] = useState('Cliente POS');
  const [posCustomerPhone, setPosCustomerPhone] = useState('5500000000');
  const [posDeliveryAddress, setPosDeliveryAddress] = useState('');
  const [posDeliveryType, setPosDeliveryType] = useState<'DINE_IN' | 'PICKUP' | 'DELIVERY'>('DELIVERY');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'EFECTIVO' | 'TARJETA'>('EFECTIVO');
  const [posTableName, setPosTableName] = useState('Mesa 1');
  const [posTables, setPosTables] = useState<string[]>(['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6', 'Mesa 7', 'Mesa 8', 'Mesa 9', 'Mesa 10']);
  const [newTableQRName, setNewTableQRName] = useState('');
  const [showAddTableInput, setShowAddTableInput] = useState(false);
  const [newTableNameInput, setNewTableNameInput] = useState('');
  const [posNotes, setPosNotes] = useState('');
  const [posSearchQuery, setPosSearchQuery] = useState('');

  // Sync selectedRest tables
  useEffect(() => {
    if (selectedRest) {
      if (selectedRest.tables && selectedRest.tables.length > 0) {
        setPosTables(selectedRest.tables);
      } else {
        setPosTables(['Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5', 'Mesa 6', 'Mesa 7', 'Mesa 8', 'Mesa 9', 'Mesa 10']);
      }
    }
  }, [selectedRest]);
  
  // Accounts splitting support (Split bill)
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitBills, setSplitBills] = useState<{ customerName: string; items: OrderItem[]; total: number; paid: boolean }[]>([]);
  const [tempSplitBillName, setTempSplitBillName] = useState('');
  const [tempSplitItems, setTempSplitItems] = useState<{ productId: string; quantity: number }[]>([]);

  // Waiter & Cashier Workflow state variables
  const [waiterAlerts, setWaiterAlerts] = useState<{ id: string; message: string; orderId: string; timestamp: number }[]>([]);
  const [cashierAlerts, setCashierAlerts] = useState<{ id: string; message: string; orderId: string; timestamp: number }[]>([]);
  const [activeOrderToSplit, setActiveOrderToSplit] = useState<Order | null>(null);
  const [activeSplitName, setActiveSplitName] = useState('');
  const [activeSplitItems, setActiveSplitItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [tempActiveSplitBills, setTempActiveSplitBills] = useState<{
    customerName: string;
    items: OrderItem[];
    total: number;
    paid: boolean;
    receivedAmount?: number;
    changeAmount?: number;
    paymentMethod?: 'EFECTIVO' | 'TARJETA';
  }[]>([]);
  const [splitDinerPaymentMethod, setSplitDinerPaymentMethod] = useState<'EFECTIVO' | 'TARJETA'>('EFECTIVO');
  const [splitDinerReceivedAmount, setSplitDinerReceivedAmount] = useState<string>('');
  const [cashierSubTab, setCashierSubTab] = useState<'monitor' | 'pagos_turno' | 'cortes'>('monitor');
  const [paymentsSearchQuery, setPaymentsSearchQuery] = useState('');
  const [paymentsFilterMethod, setPaymentsFilterMethod] = useState<'ALL' | 'EFECTIVO' | 'TARJETA' | 'EGRESO'>('ALL');

  // Inventory forms state
  const [showAddIngModal, setShowAddIngModal] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngStock, setNewIngStock] = useState(10);
  const [newIngMin, setNewIngMin] = useState(2);
  const [newIngUnit, setNewIngUnit] = useState('kg');

  // Supplier form state
  const [newSupName, setNewSupName] = useState('');
  const [newSupContact, setNewSupContact] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  
  // Cash Register actions
  const [showCashTxModal, setShowCashTxModal] = useState(false);
  const [cashTxType, setCashTxType] = useState<'IN' | 'OUT'>('IN');
  const [cashActionAmount, setCashActionAmount] = useState<number | string>('');
  const [cashActionReason, setCashActionReason] = useState('');

  // Notification states and functions
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const playNewOrderChime = () => {
    notificationService.playNotificationSound('new_order');
  };

  const playWaiterChime = () => {
    notificationService.playNotificationSound('waiter');
  };

  const showPushNotification = (order: Order) => {
    notificationService.sendPushNotification({
      title: `🔔 ¡Nuevo Pedido en ${selectedRest?.name || 'Mesa 22'}!`,
      body: `Pedido de ${order.customerName || 'Cliente'} por $${order.total}.\nMétodo: ${order.deliveryType === 'DELIVERY' ? 'A Domicilio' : order.deliveryType === 'PICKUP' ? 'Para Recoger' : 'Mesa: ' + (order.tableName || 'N/A')}`,
      icon: selectedRest?.logo || '/favicon.ico',
      tag: order.id,
      soundType: 'new_order',
      type: 'order'
    });
  };

  const requestNotificationPermission = async () => {
    const permission = await notificationService.requestPermission();
    if (permission !== 'unsupported') {
      setNotificationPermission(permission);
    }
  };

  // 1. Fetch Approved & Suspended Restaurants for staff Login selection
  useEffect(() => {
    async function loadRests() {
      try {
        const q = query(collection(db, 'restaurants'), where('status', 'in', ['APPROVED', 'SUSPENDED']));
        const snap = await getDocs(q);
        const list: Restaurant[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Restaurant);
        });
        setRestaurants(list);
        // Do not auto-select list[0] so that selectedRest stays null (empty) unless someone logs in.
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadRests();
  }, []);

  // Listen to selected restaurant changes in real-time
  useEffect(() => {
    if (!selectedRest?.id) return;
    const unsub = onSnapshot(
      doc(db, 'restaurants', selectedRest.id), 
      (snap) => {
        if (snap.exists()) {
          const updatedData = { id: snap.id, ...snap.data() } as Restaurant;
          setSelectedRest(updatedData);
        }
      },
      (err) => {
        console.error("Error listening to selected restaurant:", err);
      }
    );
    return () => unsub();
  }, [selectedRest?.id]);

  // Sync edit profile form fields when selectedRest changes
  useEffect(() => {
    if (selectedRest) {
      setEditRestName(selectedRest.name || '');
      setEditRestCategory(selectedRest.category || 'Restaurantes🍽️');
      setEditRestCity(selectedRest.city || '');
      setEditRestHours(selectedRest.hours || '11:00 - 22:00');
      setEditRestRestDay(selectedRest.restDay || 'Ninguno');
      setEditRestPhone(selectedRest.phone || '');
      setEditRestAddress(selectedRest.address || '');
      setEditRestLogo(selectedRest.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200');
      setEditRestDeliveryZone(selectedRest.deliveryZone || 'Local');
      setEditRestDeliveryTime(selectedRest.deliveryTime || '30-40 min');
      setEditRestDeliveryFee((selectedRest.deliveryFee ?? 0).toString());
      setEditRestDriverPayment((selectedRest.driverPayment ?? 10).toString());
      setEditRestFacebook(selectedRest.socials?.facebook || '');
      setEditRestInstagram(selectedRest.socials?.instagram || '');
      setEditRestTwitter(selectedRest.socials?.twitter || '');
      setEditRestQrOrderingMode(selectedRest.qrOrderingMode || 'AUTOMATIC');
    }
  }, [selectedRest]);

  // 2. Fetch all real-time collections for the selected Restaurant
  useEffect(() => {
    if (!selectedRest) return;

    // Load Products
    const unsubscribeProducts = onSnapshot(
      query(collection(db, 'products'), where('restaurantId', '==', selectedRest.id)),
      (snapshot) => {
        const list: Product[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Product));
        setProducts(list);
      },
      (err) => {
        console.error("Error listening to products:", err);
      }
    );

    // Load Orders
    let isInitialLoad = true;
    const unsubscribeOrders = onSnapshot(
      query(collection(db, 'orders'), where('restaurantId', '==', selectedRest.id)),
      (snapshot) => {
        try {
          const list: Order[] = [];
          snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Order));
          
          if (!isInitialLoad) {
            snapshot.docChanges().forEach((change) => {
              try {
                const currentEmp = loggedInEmployeeRef.current;

                if (change.type === 'added') {
                  const orderData = { id: change.doc.id, ...change.doc.data() } as Order;
                  // Only notify if the order is extremely recent to avoid legacy triggers on boot/resync
                  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
                  if (orderData.createdAt > fiveMinutesAgo) {
                    // If logged in as cocinero, only notify if the order is pending or preparing (needs cooking)
                    if (currentEmp && currentEmp.role === 'cocinero') {
                      if (orderData.status === 'PENDING' || orderData.status === 'PREPARING') {
                        try {
                          playNewOrderChime();
                        } catch (e) {}
                        showPushNotification(orderData);
                      }
                    } else {
                      // For other roles, notify normally
                      try {
                        playNewOrderChime();
                      } catch (e) {}
                      showPushNotification(orderData);
                    }
                  }
                } else if (change.type === 'modified') {
                  const orderData = { id: change.doc.id, ...change.doc.data() } as Order;
                  
                  // Handle "READY" status (Pedido listo para entregar)
                  if (orderData.status === 'READY') {
                    const isWaiterForDineIn = currentEmp && currentEmp.role === 'mesero' && orderData.deliveryType === 'DINE_IN';
                    const isCashierForPickup = (currentEmp?.role === 'cajero' || !currentEmp) && orderData.deliveryType === 'PICKUP';

                    if (isWaiterForDineIn) {
                      // Only alert if this is their assigned order/table
                      if (orderData.waiterId && orderData.waiterId !== currentEmp.id) {
                        return; // Skip notification for other waiters
                      }

                      // Play waiter notification alert chime
                      try {
                        playWaiterChime();
                      } catch (e) {}
                      
                      // Add to waiterAlerts queue
                      const newAlert = {
                        id: `${orderData.id}_${Date.now()}_${Math.random()}`,
                        message: `🍽️ ¡Pedido Listo! El pedido de ${orderData.tableName || 'la mesa'} (${orderData.customerName}) está listo en cocina. ¡Favor de recoger y entregar!`,
                        orderId: orderData.id,
                        timestamp: Date.now()
                      };

                      setWaiterAlerts(prev => {
                        if (prev.some(a => a.orderId === orderData.id)) return prev;
                        return [...prev, newAlert];
                      });
                      
                      // Show standard browser notification if permission granted
                      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                        try {
                          new Notification(`🍽️ ¡Pedido Listo para Entrega!`, {
                            body: `El pedido de la ${orderData.tableName || 'Mesa'} (${orderData.customerName}) ya está listo en cocina. ¡Pasa a recogerlo!`,
                            icon: selectedRest?.logo || '/favicon.ico'
                          });
                        } catch (notifErr) {
                          console.error("Error creating Notification inside onSnapshot:", notifErr);
                        }
                      }
                    } else if (isCashierForPickup) {
                      // Play notification alert chime for cashier!
                      try {
                        playNewOrderChime();
                      } catch (e) {}

                      // Add to cashierAlerts queue
                      const newAlert = {
                        id: `${orderData.id}_${Date.now()}_${Math.random()}`,
                        message: `🛍️ ¡Pedido para Llevar Listo! El pedido de ${orderData.customerName || 'Cliente'} por $${orderData.total} está listo en cocina. ¡Favor de cobrar/entregar!`,
                        orderId: orderData.id,
                        timestamp: Date.now()
                      };

                      setCashierAlerts(prev => {
                        if (prev.some(a => a.orderId === orderData.id)) return prev;
                        return [...prev, newAlert];
                      });

                      // Show standard browser notification if permission granted
                      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                        try {
                          new Notification(`🛍️ ¡Pedido para Llevar Listo!`, {
                            body: `El pedido de ${orderData.customerName || 'Cliente'} ya está listo en cocina. ¡Listo para entregar!`,
                            icon: selectedRest?.logo || '/favicon.ico'
                          });
                        } catch (notifErr) {
                          console.error("Error creating Notification inside onSnapshot for cashier:", notifErr);
                        }
                      }
                    }
                  }

                  // Handle customer requesting bill from waiter
                  if (orderData.customerBillRequestedFromWaiter) {
                    const prevOrder = ordersRef.current.find(o => o.id === orderData.id);
                    const wasNotifiedBefore = prevOrder?.customerBillRequestedFromWaiter;
                    
                    if (!wasNotifiedBefore) {
                      const isAssignedWaiter = currentEmp && currentEmp.role === 'mesero' && (!orderData.waiterId || orderData.waiterId === currentEmp.id);
                      
                      if (isAssignedWaiter) {
                        try {
                          playWaiterChime();
                        } catch (e) {}
                        
                        const newAlert = {
                          id: `bill_${orderData.id}_${Date.now()}_${Math.random()}`,
                          message: `🛎️ ¡La Mesa ${orderData.tableName || 'activa'} solicita su cuenta! Favor de acercarse a la mesa para realizar el corte.`,
                          orderId: orderData.id,
                          timestamp: Date.now()
                        };

                        setWaiterAlerts(prev => {
                          if (prev.some(a => a.orderId === orderData.id && a.id.startsWith('bill_'))) return prev;
                          return [...prev, newAlert];
                        });

                        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                          try {
                            new Notification(`🛎️ Mesa ${orderData.tableName || ''} solicita cuenta`, {
                              body: `Favor de acercarse para realizar el corte de la cuenta.`,
                              icon: selectedRest?.logo || '/favicon.ico'
                            });
                          } catch (notifErr) {
                            console.error("Error creating Notification inside onSnapshot:", notifErr);
                          }
                        }
                      }
                    }
                  }

                  // Handle transition to "PENDING" or "PREPARING" for Cook (Cocinero)
                  if (orderData.status === 'PENDING' || orderData.status === 'PREPARING') {
                    if (currentEmp && currentEmp.role === 'cocinero') {
                      const prevOrder = ordersRef.current.find(o => o.id === orderData.id);
                      const isTransitionToPrep = (!prevOrder || (prevOrder.status !== 'PENDING' && prevOrder.status !== 'PREPARING'));
                      
                      if (isTransitionToPrep) {
                        try {
                          playNewOrderChime();
                        } catch (e) {}
                        showPushNotification(orderData);
                      }
                    }
                  }
                }
              } catch (innerErr) {
                console.error("Error processing single doc change in orders:", innerErr);
              }
            });
          }
          
          setOrders(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        } catch (err) {
          console.error("Critical error inside orders onSnapshot callback:", err);
        } finally {
          isInitialLoad = false;
        }
      },
      (err) => {
        console.error("Error listening to orders:", err);
      }
    );

    // Load Ingredients
    const unsubscribeIngredients = onSnapshot(
      query(collection(db, 'ingredients'), where('restaurantId', '==', selectedRest.id)),
      (snapshot) => {
        const list: Ingredient[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Ingredient));
        setIngredients(list);
      },
      (err) => {
        console.error("Error listening to ingredients:", err);
      }
    );

    // Load Suppliers
    const unsubscribeSuppliers = onSnapshot(
      query(collection(db, 'suppliers'), where('restaurantId', '==', selectedRest.id)),
      (snapshot) => {
        const list: Supplier[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as Supplier));
        setSuppliers(list);
      },
      (err) => {
        console.error("Error listening to suppliers:", err);
      }
    );

    // Load Cash Register sessions
    const unsubscribeCash = onSnapshot(
      query(collection(db, 'cashSessions'), where('restaurantId', '==', selectedRest.id)),
      (snapshot) => {
        const list: CashRegisterSession[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...d.data() } as CashRegisterSession));
        setCashSessions(list);
        
        // Find if there is an active OPEN cash session
        const openSes = list.find(s => s.status === 'OPEN');
        setActiveCashSession(openSes || null);
      },
      (err) => {
        console.error("Error listening to cash sessions:", err);
      }
    );

    // Load Employees
    const unsubscribeEmployees = onSnapshot(
      query(collection(db, 'employees'), where('restaurantId', '==', selectedRest.id)),
      (snapshot) => {
        const list: Employee[] = [];
        snapshot.forEach(d => {
          const data = d.data();
          if (!data.deleted) {
            list.push({ id: d.id, ...data } as Employee);
          }
        });
        setEmployees(list);
      },
      (err) => {
        console.error("Error listening to employees:", err);
      }
    );

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
      unsubscribeIngredients();
      unsubscribeSuppliers();
      unsubscribeCash();
      unsubscribeEmployees();
    };
  }, [selectedRest]);

  // Lock selectedRest when loggedInEmployee is active
  useEffect(() => {
    if (loggedInEmployee && restaurants.length > 0) {
      const matched = restaurants.find(r => r.id === loggedInEmployee.restaurantId);
      if (matched && selectedRest?.id !== matched.id) {
        setSelectedRest(matched);
      }
    }
  }, [loggedInEmployee, restaurants, selectedRest?.id]);

  // Clear selectedRest when nobody is logged in (employee or owner)
  useEffect(() => {
    if (!loggedInEmployee && !currentUser) {
      setSelectedRest(null);
    }
  }, [loggedInEmployee, currentUser]);

  // Enforce tab access permissions for employees
  useEffect(() => {
    if (loggedInEmployee) {
      if (loggedInEmployee.role === 'cocinero' && activeTab !== 'kitchen') {
        setActiveTab('kitchen');
      } else if (loggedInEmployee.role === 'mesero' && !['pos', 'dashboard'].includes(activeTab)) {
        setActiveTab('pos');
      } else if (loggedInEmployee.role === 'cajero' && !['pos', 'dashboard', 'kitchen', 'inventory'].includes(activeTab)) {
        setActiveTab('pos');
      }
    }
  }, [loggedInEmployee, activeTab]);

  // Waiters can only take dine-in/table orders, cashiers can only take pickup/delivery
  useEffect(() => {
    if (loggedInEmployee?.role === 'mesero') {
      setPosDeliveryType('DINE_IN');
    } else if (loggedInEmployee?.role === 'cajero') {
      setPosDeliveryType('DELIVERY');
    }
  }, [loggedInEmployee]);

  // Employee Operations & Auth Handlers
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpError('');
    setEmpSuccess('');
    if (!selectedRest?.id) {
      setEmpError('No hay un restaurante seleccionado.');
      return;
    }
    if (!newEmpName.trim() || !newEmpUsername.trim() || !newEmpPassword.trim()) {
      setEmpError('Todos los campos son obligatorios.');
      return;
    }

    const cleanUsername = newEmpUsername.toLowerCase().trim();

    // Check if username is already taken locally in this restaurant
    const existsLocally = employees.some(emp => !emp.deleted && emp.username?.toLowerCase().trim() === cleanUsername);
    if (existsLocally) {
      setEmpError('El usuario ya existe. Por favor elige otro nombre de usuario.');
      return;
    }

    try {
      // Check globally in Firestore across all employees in the system
      const qEmp = query(
        collection(db, 'employees'),
        where('username', '==', cleanUsername)
      );
      const snapEmp = await getDocs(qEmp);
      const existsInDb = snapEmp.docs.some(docSnap => !docSnap.data().deleted);
      if (existsInDb) {
        setEmpError('El usuario ya existe. Por favor elige otro nombre de usuario.');
        return;
      }

      await addDoc(collection(db, 'employees'), {
        restaurantId: selectedRest.id,
        name: newEmpName.trim(),
        username: cleanUsername,
        password: newEmpPassword.trim(),
        role: newEmpRole,
        status: 'active',
        createdAt: Date.now()
      });
      setEmpSuccess(`Empleado "${newEmpName}" creado exitosamente.`);
      setNewEmpName('');
      setNewEmpUsername('');
      setNewEmpPassword('');
      setNewEmpRole('cajero');
    } catch (err) {
      console.error(err);
      setEmpError('Error al crear el empleado en el servidor.');
    }
  };

  const handleToggleEmployeeStatus = async (empId: string, currentStatus: 'active' | 'inactive') => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'employees', empId), {
        status: newStatus
      });
      
      // If the currently logged-in employee was deactivated, force log them out
      if (loggedInEmployee?.id === empId && newStatus === 'inactive') {
        setLoggedInEmployee(null);
      }
    } catch (err) {
      console.error('Error toggling employee status:', err);
    }
  };

  const handleDeleteEmployee = async (empId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas dar de baja (eliminar) a este empleado?')) return;
    try {
      await updateDoc(doc(db, 'employees', empId), {
        deleted: true,
        status: 'inactive'
      });
      
      // If the currently logged-in employee was deleted, force log them out
      if (loggedInEmployee?.id === empId) {
        setLoggedInEmployee(null);
      }
    } catch (err) {
      console.error('Error deleting employee:', err);
    }
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmpLoginError('');
    if (!empLoginUsername.trim() || !empLoginPassword.trim()) {
      setEmpLoginError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    // Intercept Super Admin credentials
    const cleanUser = empLoginUsername.trim().toLowerCase();
    const cleanPass = empLoginPassword.trim();
    if (cleanUser === 'produccionesromo1@gmail.com' && (cleanPass === 'WuJ6nnT7CFrr' || cleanPass === 'wuj6nnt7cfrr')) {
      setEmpLoginUsername('');
      setEmpLoginPassword('');
      setShowEmpLogin(false);
      if (onSuperAdminLogin) {
        onSuperAdminLogin();
      }
      return;
    }

    try {
      // Find the employee globally across all restaurants
      const q = query(
        collection(db, 'employees'),
        where('username', '==', empLoginUsername.toLowerCase().trim()),
        where('password', '==', empLoginPassword.trim())
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setEmpLoginError('Usuario o contraseña incorrectos.');
        return;
      }

      let foundEmp: Employee | null = null;
      snap.forEach((d) => {
        const emp = { id: d.id, ...d.data() } as Employee;
        if (!emp.deleted && emp.status === 'active') {
          foundEmp = emp;
        }
      });

      if (!foundEmp) {
        setEmpLoginError('Esta cuenta de empleado ha sido dada de baja (inactiva).');
        return;
      }

      // Auto-detect the restaurant that this employee belongs to
      const emp: Employee = foundEmp;
      let empRest = restaurants.find(r => r.id === emp.restaurantId);
      if (!empRest) {
        // Fallback: fetch directly from database if not in the preloaded list
        const restDoc = await getDoc(doc(db, 'restaurants', emp.restaurantId));
        if (restDoc.exists()) {
          empRest = { id: restDoc.id, ...restDoc.data() } as Restaurant;
        }
      }

      if (!empRest) {
        setEmpLoginError('No se encontró el restaurante asignado a este empleado.');
        return;
      }

      setSelectedRest(empRest);
      setLoggedInEmployee(emp);
      setEmpLoginUsername('');
      setEmpLoginPassword('');
      setShowEmpLogin(false);
      
      // Redirect based on role
      if (emp.role === 'cocinero') {
        setActiveTab('kitchen');
      } else if (emp.role === 'mesero') {
        setActiveTab('pos');
      } else {
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error(err);
      setEmpLoginError('Error al validar credenciales en el servidor.');
    }
  };

  // Menu / Product Operations
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdError('');
    setProdSuccess('');
    if (!selectedRest?.id) {
      setProdError('No hay un restaurante seleccionado.');
      return;
    }
    if (!newProdName.trim() || !newProdPrice.trim()) {
      setProdError('El nombre y el precio son obligatorios.');
      return;
    }

    const priceVal = parseFloat(newProdPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      setProdError('Por favor ingresa un precio válido mayor que 0.');
      return;
    }

    const defaultImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300';
    const cleanImageUrl = newProdImage.trim() || defaultImage;

    try {
      await addDoc(collection(db, 'products'), {
        restaurantId: selectedRest.id,
        name: newProdName.trim(),
        price: priceVal,
        image: cleanImageUrl,
        category: newProdType === 'DRINK' ? 'Bebidas' : 'Alimentos',
        type: newProdType,
        description: newProdDescription.trim() || 'Exquisito platillo preparado al momento con los mejores ingredientes.',
        prepTime: 12, // default prep time in minutes
        available: true,
        createdAt: Date.now()
      });

      setProdSuccess(`Platillo "${newProdName}" agregado exitosamente al menú.`);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdImage('');
      setNewProdDescription('');
      setNewProdType('FOOD');
    } catch (err) {
      console.error('Error al crear platillo:', err);
      setProdError('Error al guardar el platillo en la base de datos.');
    }
  };

  const handleToggleProductAvailability = async (productId: string, currentAvailability: boolean) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        available: !currentAvailability
      });
    } catch (err) {
      console.error('Error toggling product availability:', err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este platillo del menú?')) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setEditProdName(prod.name);
    setEditProdPrice(prod.price.toString());
    setEditProdImage(prod.image || '');
    setEditProdCategory(prod.category || 'Especialidades');
    setEditProdType(prod.type || (prod.category?.toLowerCase().includes('bebida') ? 'DRINK' : 'FOOD'));
    setEditProdDescription(prod.description || '');
    setEditProdError('');
    setEditProdSuccess('');
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditProdError('');
    setEditProdSuccess('');

    if (!editingProduct) return;

    if (!editProdName.trim() || !editProdPrice.trim()) {
      setEditProdError('El nombre y el precio son obligatorios.');
      return;
    }

    const priceVal = parseFloat(editProdPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      setEditProdError('Por favor ingresa un precio válido mayor que 0.');
      return;
    }

    const defaultImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300';
    const cleanImageUrl = editProdImage.trim() || defaultImage;

    try {
      await updateDoc(doc(db, 'products', editingProduct.id), {
        name: editProdName.trim(),
        price: priceVal,
        image: cleanImageUrl,
        category: editProdType === 'DRINK' ? 'Bebidas' : 'Alimentos',
        type: editProdType,
        description: editProdDescription.trim() || 'Exquisito platillo preparado al momento con los mejores ingredientes.'
      });

      setEditProdSuccess('Platillo actualizado exitosamente.');
      setTimeout(() => {
        setEditingProduct(null);
      }, 800);
    } catch (err) {
      console.error('Error al actualizar platillo:', err);
      setEditProdError('Error al actualizar el platillo en la base de datos.');
    }
  };

  const handleUpdateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditRestError('');
    setEditRestSuccess('');

    if (!selectedRest?.id) {
      setEditRestError('No hay un restaurante seleccionado.');
      return;
    }

    if (!editRestName.trim()) {
      setEditRestError('El nombre del restaurante es obligatorio.');
      return;
    }

    if (!editRestPhone.trim()) {
      setEditRestError('El teléfono del restaurante es obligatorio.');
      return;
    }

    const feeVal = 0; // Envíos gratis para todos los clientes

    const driverPaymentVal = parseFloat(editRestDriverPayment);
    if (isNaN(driverPaymentVal) || driverPaymentVal < 0) {
      setEditRestError('El pago a repartidores debe ser un número válido mayor o igual a 0.');
      return;
    }

    const hoursStr = editRestHours.trim() || '11:00 - 22:00';
    let parsedOpen = '11:00';
    let parsedClose = '22:00';
    const parts = hoursStr.split(/\s*(?:[-–—]|hasta|\ba\b)\s*/i);
    if (parts.length >= 2) {
      parsedOpen = parts[0].trim();
      parsedClose = parts[1].trim();
    }

    try {
      await updateDoc(doc(db, 'restaurants', selectedRest.id), {
        name: editRestName.trim(),
        category: editRestCategory.trim() || 'Tacos',
        city: editRestCity.trim(),
        hours: hoursStr,
        openTime: parsedOpen,
        closeTime: parsedClose,
        restDay: editRestRestDay || 'Ninguno',
        phone: editRestPhone.trim(),
        address: editRestAddress.trim(),
        logo: editRestLogo.trim() || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200',
        deliveryZone: editRestDeliveryZone.trim() || 'Local',
        deliveryTime: editRestDeliveryTime.trim() || '30-40 min',
        deliveryFee: 0,
        driverPayment: driverPaymentVal,
        socials: {
          facebook: editRestFacebook.trim(),
          instagram: editRestInstagram.trim(),
          twitter: editRestTwitter.trim()
        },
        qrOrderingMode: editRestQrOrderingMode || 'AUTOMATIC'
      });

      setEditRestSuccess('¡Perfil del restaurante actualizado exitosamente!');
    } catch (err) {
      console.error('Error al actualizar perfil de restaurante:', err);
      setEditRestError('Error al guardar los cambios en la base de datos.');
    }
  };

  const handleAddTableFromQRSection = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (posTables.includes(trimmed)) {
      alert('Esta mesa ya existe.');
      return;
    }
    const updatedTables = [...posTables, trimmed];
    setPosTables(updatedTables);
    if (selectedRest) {
      try {
        await updateDoc(doc(db, 'restaurants', selectedRest.id), {
          tables: updatedTables
        });
        setSelectedRest({ ...selectedRest, tables: updatedTables });
        if (userProfile && userProfile.id === selectedRest.id) {
          setUserProfile({ ...userProfile, tables: updatedTables });
        }
      } catch (err) {
        console.error("Error saving new table:", err);
      }
    }
  };

  const handleDeleteTableFromQRSection = async (name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la ${name}? Los códigos QR generados para esta mesa ya no funcionarán.`)) {
      return;
    }
    const updatedTables = posTables.filter(t => t !== name);
    setPosTables(updatedTables);
    if (selectedRest) {
      try {
        await updateDoc(doc(db, 'restaurants', selectedRest.id), {
          tables: updatedTables
        });
        setSelectedRest({ ...selectedRest, tables: updatedTables });
        if (userProfile && userProfile.id === selectedRest.id) {
          setUserProfile({ ...userProfile, tables: updatedTables });
        }
      } catch (err) {
        console.error("Error deleting table:", err);
      }
    }
  };

  // POS Actions
  const addToPosCart = (product: Product) => {
    const existing = posCart.find(i => i.product.id === product.id);
    if (existing) {
      setPosCart(posCart.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setPosCart([...posCart, { product, quantity: 1 }]);
    }
  };

  const removeFromPosCart = (productId: string) => {
    setPosCart(posCart.filter(i => i.product.id !== productId));
  };

  const updatePosCartQty = (productId: string, change: number) => {
    setPosCart(posCart.map(i => {
      if (i.product.id === productId) {
        const newQty = i.quantity + change;
        return { ...i, quantity: newQty <= 0 ? 1 : newQty };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const posSubtotal = posCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const posDeliveryFee = 0; // Todos los envíos son gratis
  const posTotal = posSubtotal + posDeliveryFee;

  // Open Cash Register
  const handleOpenCashRegister = async () => {
    if (!selectedRest) return;
    const initialAmtStr = prompt('Ingrese el fondo inicial de caja:', '1000');
    if (initialAmtStr === null) return;
    const initialAmount = parseFloat(initialAmtStr) || 0;

    const cashierName = loggedInEmployee?.name || userProfile?.name || 'Propietario';

    const newSession: Omit<CashRegisterSession, 'id'> = {
      restaurantId: selectedRest.id,
      openedAt: Date.now(),
      openedBy: cashierName,
      initialAmount,
      transactions: [],
      status: 'OPEN'
    };

    try {
      await addDoc(collection(db, 'cashSessions'), newSession);
      alert('¡Caja abierta exitosamente!');
    } catch (err) {
      console.error(err);
    }
  };

  const getSessionTotals = (session: CashRegisterSession) => {
    const salesCash = (session.transactions || [])
      .filter(t => t.type === 'IN' && (t.paymentMethod === 'EFECTIVO' || !t.paymentMethod))
      .reduce((sum, t) => sum + t.amount, 0);

    const salesCard = (session.transactions || [])
      .filter(t => t.type === 'IN' && t.paymentMethod === 'TARJETA')
      .reduce((sum, t) => sum + t.amount, 0);

    const withdrawalsTotal = (session.transactions || [])
      .filter(t => t.type === 'OUT')
      .reduce((sum, t) => sum + t.amount, 0);

    const calculatedFinal = session.initialAmount + salesCash - withdrawalsTotal;
    const totalSales = salesCash + salesCard;

    return { salesCash, salesCard, withdrawalsTotal, calculatedFinal, totalSales };
  };

  // Print thermal ticket for Cash Session Turn Closure Report
  const handlePrintCashSessionReport = (session: CashRegisterSession, salesCash: number, salesCard: number, withdrawalsTotal: number, calculatedFinal: number) => {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Corte de Caja - #${session.id.slice(0, 5).toUpperCase()}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 15px; font-size: 13px; color: #000; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
            .details { margin-bottom: 15px; font-size: 11px; }
            .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .summary-table td { padding: 4px 0; }
            .summary-table td.amount { text-align: right; font-weight: bold; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .section-title { font-weight: bold; text-align: center; margin-top: 15px; text-transform: uppercase; font-size: 12px; }
            .footer { text-align: center; margin-top: 25px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
            .signatures { margin-top: 40px; display: flex; justify-content: space-between; font-size: 10px; }
            .signature-line { border-top: 1px solid #000; width: 40%; text-align: center; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${selectedRest?.name || 'RESTAURANTE'}</div>
            <div style="font-size: 13px; font-weight: bold; margin-top: 5px;">REPORTE DE CORTE DE CAJA</div>
            <div>========================</div>
            <div>ID SESION: #${session.id.slice(0, 8).toUpperCase()}</div>
            <div>Apertura: ${new Date(session.openedAt).toLocaleString()}</div>
            <div>Cierre: ${new Date().toLocaleString()}</div>
          </div>

          <div class="details">
            <div><strong>Abierto por:</strong> ${session.openedBy || 'Cajero de Turno'}</div>
            <div><strong>Estado:</strong> CERRADO</div>
          </div>

          <div class="divider"></div>

          <table class="summary-table">
            <tr>
              <td>FONDO INICIAL:</td>
              <td class="amount">$${session.initialAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td>(+) VENTAS EN EFECTIVO:</td>
              <td class="amount">+$${salesCash.toFixed(2)}</td>
            </tr>
            <tr>
              <td>(+) VENTAS EN TARJETA:</td>
              <td class="amount">+$${salesCard.toFixed(2)}</td>
            </tr>
            <tr>
              <td>(-) RETIROS / EGRESOS:</td>
              <td class="amount">-$${withdrawalsTotal.toFixed(2)}</td>
            </tr>
            <tr style="border-top: 1px solid #000; font-weight: bold;">
              <td style="padding-top: 6px;">CASH ESPERADO EN CAJA:</td>
              <td class="amount" style="padding-top: 6px;">$${(session.initialAmount + salesCash - withdrawalsTotal).toFixed(2)}</td>
            </tr>
            <tr style="border-top: 1px dashed #000; font-weight: bold;">
              <td style="padding-top: 6px;">TOTAL VENTAS RECIBIDO:</td>
              <td class="amount" style="padding-top: 6px;">$${(salesCash + salesCard).toFixed(2)}</td>
            </tr>
          </table>

          <div class="divider"></div>

          <div class="section-title">Detalle de Transacciones</div>
          <table style="width: 100%; font-size: 10px; border-collapse: collapse; margin-top: 5px;">
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding: 2px 0;">Hora</th>
                <th style="text-align: left; padding: 2px 0;">Concepto / Metodo</th>
                <th style="text-align: right; padding: 2px 0;">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${session.transactions.length === 0 ? `
                <tr>
                  <td colspan="3" style="text-align: center; padding: 8px; font-style: italic;">Sin transacciones registradas</td>
                </tr>
              ` : session.transactions.map(t => `
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 4px 0; font-size: 8px; color: #555;">${new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style="padding: 4px 0;">
                    ${t.reason} 
                    <span style="font-size: 8px; color: #555; font-weight: bold; text-transform: uppercase;">
                      [${t.type === 'IN' ? `${t.paymentMethod || 'EFECTIVO'}` : 'EGRESO'}]
                    </span>
                  </td>
                  <td style="padding: 4px 0; text-align: right; font-weight: bold;">
                    ${t.type === 'IN' ? '+' : '-'}$${t.amount.toFixed(2)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="signatures">
            <div class="signature-line">Firma Cajera</div>
            <div class="signature-line">Firma Supervisor</div>
          </div>

          <div class="footer">
            <p>¡Gracias por su excelente jornada!</p>
            <p>Sistema POS de Alta Precisión</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print thermal ticket for individual payment transaction
  const handlePrintSinglePaymentReceipt = (t: { type: 'IN' | 'OUT'; amount: number; reason: string; timestamp: number; paymentMethod?: 'EFECTIVO' | 'TARJETA' }) => {
    const printWindow = window.open('', '_blank', 'width=350,height=520');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Comprobante de Pago - Mesa 22</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 15px; font-size: 13px; color: #000; }
            .header { text-align: center; margin-bottom: 12px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
            .details { margin-bottom: 15px; font-size: 11px; line-height: 1.5; }
            .amount-box { text-align: center; font-size: 18px; font-weight: bold; margin: 15px 0; border: 1px solid #000; padding: 10px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${selectedRest?.name || 'RESTAURANTE'}</div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 4px;">COMPROBANTE DE COBRO</div>
            <div>========================</div>
            <div>Fecha: ${new Date(t.timestamp).toLocaleDateString()}</div>
            <div>Hora: ${new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          </div>

          <div class="details">
            <div><strong>Cajera(o):</strong> ${loggedInEmployee?.name || activeCashSession?.openedBy || userProfile?.name || 'Propietario'}</div>
            <div><strong>Concepto:</strong> ${t.reason}</div>
            <div><strong>Método de Pago:</strong> ${t.paymentMethod || (t.type === 'IN' ? 'EFECTIVO' : 'EGRESO')}</div>
            <div><strong>Tipo Transacción:</strong> ${t.type === 'IN' ? 'INGRESO DE VENTA' : 'EGRESO / RETIRO DE CAJA'}</div>
          </div>

          <div class="amount-box">
            ${t.type === 'IN' ? 'PAGADO' : 'EGRESO'}: $${t.amount.toFixed(2)}
          </div>

          <div class="footer">
            <p>¡Gracias por su preferencia!</p>
            <p>Mesa 22 - Sistema POS Multi-Restaurante</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Close Cash Register
  const handleCloseCashRegister = async () => {
    if (!activeCashSession) return;
    
    const { salesCash, salesCard, withdrawalsTotal, calculatedFinal, totalSales } = getSessionTotals(activeCashSession);
    
    const confirmMessage = `¿Está seguro de realizar el corte de caja?

📊 RESUMEN DE TURNO:
---------------------------
Fondo Inicial: $${activeCashSession.initialAmount.toFixed(2)}
💵 Ventas en Efectivo: +$${salesCash.toFixed(2)}
💳 Ventas en Tarjeta: +$${salesCard.toFixed(2)}
---------------------------
Total de Ventas Recibido: $${totalSales.toFixed(2)}
🛑 Retiros/Egresos: -$${withdrawalsTotal.toFixed(2)}
---------------------------
💵 Efectivo Esperado en Caja: $${calculatedFinal.toFixed(2)}

Al confirmar, se guardará el corte de caja y se generará un ticket impreso con el desglose.`;

    if (!confirm(confirmMessage)) return;

    try {
      const docRef = doc(db, 'cashSessions', activeCashSession.id);
      await updateDoc(docRef, {
        status: 'CLOSED',
        closedAt: Date.now(),
        finalAmount: calculatedFinal
      });
      
      // Print the turn closure ticket
      handlePrintCashSessionReport(activeCashSession, salesCash, salesCard, withdrawalsTotal, calculatedFinal);
      
      alert('¡Caja cerrada exitosamente! El ticket de corte de caja ha sido generado.');
    } catch (err) {
      console.error(err);
    }
  };

  // Deposit or Withdraw Cash
  const handleCashSessionTransaction = async (type: 'IN' | 'OUT') => {
    if (!activeCashSession) return;
    const amountVal = typeof cashActionAmount === 'number' ? cashActionAmount : parseFloat(cashActionAmount.toString()) || 0;
    if (amountVal <= 0) {
      alert('Por favor ingrese un monto mayor a cero.');
      return;
    }
    if (!cashActionReason.trim()) {
      alert('Por favor escriba el motivo o comentario del movimiento de efectivo.');
      return;
    }

    try {
      const docRef = doc(db, 'cashSessions', activeCashSession.id);
      const updatedTransactions = [
        ...activeCashSession.transactions,
        {
          type,
          amount: amountVal,
          reason: cashActionReason.trim(),
          timestamp: Date.now()
        }
      ];

      await updateDoc(docRef, { transactions: updatedTransactions });
      alert(`✅ ${type === 'IN' ? 'Ingreso Extra' : 'Retiro / Egreso'} registrado con éxito: $${amountVal.toFixed(2)}`);
      setCashActionAmount('');
      setCashActionReason('');
      setShowCashTxModal(false);
    } catch (err) {
      console.error(err);
      alert('Error al registrar el movimiento en caja.');
    }
  };

  // Split bill helper - Add sub-account
  const addSplitBillAccount = () => {
    if (!tempSplitBillName.trim()) {
      alert('Escriba un nombre para el comensal.');
      return;
    }
    const selectedItems: OrderItem[] = posCart.map(i => {
      const splitQty = tempSplitItems.find(ts => ts.productId === i.product.id)?.quantity || 0;
      if (splitQty > 0) {
        return {
          productId: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: splitQty
        };
      }
      return null;
    }).filter(i => i !== null) as OrderItem[];

    if (selectedItems.length === 0) {
      alert('Seleccione al menos un producto para este comensal.');
      return;
    }

    const billTotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    setSplitBills([
      ...splitBills,
      {
        customerName: tempSplitBillName,
        items: selectedItems,
        total: billTotal,
        paid: false
      }
    ]);

    // Subtract assigned quantities from temporary counters
    setTempSplitBillName('');
    setTempSplitItems([]);
  };

  // Subtract ingredients when a sale happens
  const discountStockForOrder = async (items: OrderItem[]) => {
    if (!selectedRest) return;
    try {
      for (const item of items) {
        const prod = products.find(p => p.id === item.productId);
        if (prod && prod.ingredients) {
          for (const recipeIng of prod.ingredients) {
            const currentIng = ingredients.find(ing => ing.id === recipeIng.ingredientId);
            if (currentIng) {
              const usedQty = recipeIng.qtyPerProduct * item.quantity;
              const newStock = Math.max(0, currentIng.stock - usedQty);
              
              // Update in Firestore
              const ingRef = doc(db, 'ingredients', currentIng.id);
              await updateDoc(ingRef, { stock: newStock });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error subtracting ingredients stock:', err);
    }
  };

  // Submit POS Order
  const handlePlacePosOrder = async (customStatus: OrderStatus = 'READY', requestBillingImmediately = false) => {
    if (!selectedRest) return;
    if (posCart.length === 0) {
      alert('Agregue productos al carrito antes de cobrar.');
      return;
    }

    if (posDeliveryType === 'DELIVERY') {
      const cleanPhone = posCustomerPhone.trim();
      if (!cleanPhone || cleanPhone === '5500000000') {
        alert('⚠️ Campo Obligatorio: El teléfono del cliente es obligatorio para pedidos a domicilio.');
        return;
      }
      if (!posDeliveryAddress.trim()) {
        alert('⚠️ Campo Obligatorio: La dirección de entrega es obligatoria para pedidos a domicilio.');
        return;
      }
    }

    const finalStatus = (loggedInEmployee && loggedInEmployee.role === 'mesero') ? 'PREPARING' : customStatus;

    if (finalStatus === 'DELIVERED' && !activeCashSession) {
      alert('⚠️ Error de Caja: La caja está cerrada. Debe abrir el turno de caja en el panel de control antes de realizar cobros o registrar pagos.');
      return;
    }

    const orderItems: OrderItem[] = posCart.map(i => {
      const item: OrderItem = {
        productId: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity
      };
      if (i.notes) {
        item.notes = i.notes;
      }
      return item;
    });

    const newOrder: any = {
      restaurantId: selectedRest.id,
      restaurantName: selectedRest.name,
      city: selectedRest.city || '',
      customerName: posCustomerName || 'Cliente POS',
      customerPhone: posCustomerPhone || '5500000000',
      deliveryType: posDeliveryType,
      status: finalStatus,
      items: orderItems,
      subtotal: posSubtotal,
      deliveryFee: posDeliveryFee,
      total: posTotal,
      paymentMethod: posDeliveryType === 'DINE_IN' ? 'CASH_ON_TABLE' : posDeliveryType === 'PICKUP' ? 'CASH_ON_PICKUP' : 'CASH_ON_DELIVERY',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (posDeliveryType === 'DINE_IN' && posTableName) {
      newOrder.tableName = posTableName;
    }

    if (posDeliveryType === 'DELIVERY') {
      (newOrder as any).deliveryAddress = posDeliveryAddress;
    }

    if (posNotes) {
      newOrder.notes = posNotes;
    }

    if (loggedInEmployee) {
      newOrder.waiterId = loggedInEmployee.id;
      newOrder.waiterName = loggedInEmployee.name;
    }

    if (splitBills.length > 0) {
      newOrder.splitBills = splitBills;
    }

    if (requestBillingImmediately) {
      if (splitBills.length > 0) {
        newOrder.splitBillsRequested = true;
      } else {
        newOrder.billRequested = true;
        newOrder.billRequestedAt = Date.now();
      }
    }

    try {
      const docRef = await addDoc(collection(db, 'orders'), newOrder);
      const generatedId = docRef.id;

      if (newOrder.deliveryType === 'DELIVERY') {
        sendRestaurantNewOrderEmail({ id: generatedId, ...newOrder }, db).catch(err => {
          console.error('Error sending restaurant notification email:', err);
        });
      }

      // If active cash session exists, register sale transaction
      if (activeCashSession && customStatus === 'DELIVERED') {
        const sessionRef = doc(db, 'cashSessions', activeCashSession.id);
        const updatedTrans = [
          ...activeCashSession.transactions,
          {
            type: 'IN' as const,
            amount: posTotal,
            reason: `Venta POS #${generatedId.slice(0, 5)} (${posPaymentMethod})`,
            timestamp: Date.now(),
            paymentMethod: posPaymentMethod
          }
        ];
        await updateDoc(sessionRef, { transactions: updatedTrans });
      }

      // If immediate payment/collection from POS for DINE_IN, also finalize all existing active orders of that table
      if (customStatus === 'DELIVERED' && posDeliveryType === 'DINE_IN' && posTableName) {
        const otherActiveTableOrders = orders.filter(
          o => o.tableName === posTableName &&
               o.id !== generatedId &&
               o.status !== 'DELIVERED' &&
               o.status !== 'CANCELLED' &&
               o.deliveryType === 'DINE_IN'
        );
        for (const o of otherActiveTableOrders) {
          await updateDoc(doc(db, 'orders', o.id), {
            status: 'DELIVERED',
            billRequested: false,
            customerBillRequestedFromWaiter: false,
            splitBillsRequested: false,
            updatedAt: Date.now()
          });
        }
      }

      // Discount Ingredients stock
      discountStockForOrder(orderItems);

      if (requestBillingImmediately) {
        alert(`¡Cierre de mesa enviado con éxito!\nCuenta solicitada a caja para ${posDeliveryType === 'DINE_IN' ? posTableName : 'pedido'}.\nTotal: $${posTotal}`);
      } else {
        alert(`¡Comanda enviada a cocina con éxito!\nTipo: ${posDeliveryType}\nTotal: $${posTotal}`);
      }
      
      // Clean up states
      setPosCart([]);
      setPosCustomerName('Cliente POS');
      setPosCustomerPhone('5500000000');
      setPosDeliveryAddress('');
      setPosNotes('');
      setIsSplitting(false);
      setSplitBills([]);
    } catch (err) {
      console.error(err);
      alert('Error al guardar el pedido en Firestore');
    }
  };

  // Kitchen Status update
  const handleKitchenStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: nextStatus,
        updatedAt: Date.now()
      });

      if (nextStatus === 'READY') {
        const orderDoc = orders.find(o => o.id === orderId);
        if (orderDoc && orderDoc.deliveryType === 'DELIVERY') {
          sendDriverNewOrderEmail({ ...orderDoc, status: 'READY' }, db).catch(err => {
            console.error('Error sending driver notification email:', err);
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Kitchen Reject order handler
  const handleKitchenRejectOrder = async (orderId: string, orderNumber?: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas rechazar el pedido${orderNumber ? ` #${orderNumber}` : ''}?\n\nSe cancelará el pedido y se enviará una notificación al cliente.`)) {
      return;
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'CANCELLED',
        cancelReason: 'Rechazado por cocina',
        updatedAt: Date.now()
      });

      notificationService.sendPushNotification({
        title: '❌ Pedido Rechazado',
        body: `El pedido ${orderNumber ? `#${orderNumber}` : ''} ha sido rechazado por el restaurante.`,
        soundType: 'alert',
        type: 'alert'
      });
    } catch (err) {
      console.error('Error al rechazar el pedido:', err);
      alert('Error al rechazar el pedido');
    }
  };

  // Unassign driver from delivery order
  const handleUnassignDriver = async (order: Order) => {
    if (!order || !order.id) return;
    const driverText = order.driverName ? ` (${order.driverName})` : '';
    if (!window.confirm(`¿Quitar la asignación del repartidor${driverText} para el pedido #${order.id.slice(0, 5).toUpperCase()}?\n\nEl pedido volverá al estado 'Listo para entrega' y se notificará de nuevo a los repartidores disponibles.`)) {
      return;
    }

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'READY',
        driverId: deleteField(),
        driverName: deleteField(),
        driverPhone: deleteField(),
        updatedAt: Date.now()
      });

      // Trigger push notification to available drivers
      notificationService.sendPushNotification({
        title: `🏍️ ¡Pedido Disponible en ${order.restaurantName || selectedRest?.name || 'Restaurante'}!`,
        body: `El pedido #${order.id.slice(0, 5).toUpperCase()} vuelve a estar disponible para entrega.`,
        icon: '/favicon.ico',
        soundType: 'new_order',
        type: 'order'
      });

      // Dispatch email notification to drivers
      if (order.deliveryType === 'DELIVERY') {
        sendDriverNewOrderEmail({ ...order, status: 'READY' }, db).catch(err => {
          console.error('Error sending driver notification email:', err);
        });
      }

      alert(`Se quitó la asignación del repartidor. El pedido #${order.id.slice(0, 5).toUpperCase()} volvió a estar disponible para todos los repartidores.`);
    } catch (err) {
      console.error('Error unassigning driver:', err);
      alert('Error al quitar la asignación del repartidor.');
    }
  };

  // Print receipt of full bill for a table
  const handlePrintBill = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Cuenta Mesa - ${order.tableName || 'Mesa'}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 15px; font-size: 13px; color: #000; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .details { margin-bottom: 15px; font-size: 11px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .items-table th, .items-table td { text-align: left; padding: 4px 0; }
            .items-table th { border-bottom: 1px solid #000; }
            .total-section { border-top: 1px dashed #000; padding-top: 5px; text-align: right; font-weight: bold; }
            .footer { text-align: center; margin-top: 25px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${order.restaurantName}</div>
            <div style="font-size: 14px; font-weight: bold; margin-top: 5px;">TICKET DE CONSUMO</div>
            <div>------------------------</div>
            <div>Mesa: ${order.tableName || 'N/A'}</div>
            <div>ID: #${order.id.slice(0, 8).toUpperCase()}</div>
            <div>Fecha: ${new Date().toLocaleString()}</div>
          </div>
          <div class="details">
            <div><strong>Cliente:</strong> ${order.customerName}</div>
            ${order.waiterName ? `<div><strong>Atendido por (Mesero):</strong> ${order.waiterName}</div>` : ''}
            <div><strong>Consumo:</strong> ${order.deliveryType === 'DINE_IN' ? 'En Mesa' : 'Para Llevar'}</div>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Cant</th>
                <th>Producto</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.quantity}x</td>
                  <td>${item.name}</td>
                  <td style="text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total-section">
            <div>Subtotal: $${order.subtotal.toFixed(2)}</div>
            ${order.deliveryFee > 0 ? `<div>Envío: $${order.deliveryFee.toFixed(2)}</div>` : ''}
            <div style="font-size: 16px; margin-top: 5px;">TOTAL A PAGAR: $${order.total.toFixed(2)}</div>
          </div>
          <div class="footer">
            ¡Muchas gracias por su preferencia!<br>
            Este ticket no es un comprobante fiscal.<br>
            Mesa 22 Software POS
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Print individual ticket for a split bill diner
  const handlePrintSplitBill = (order: Order, splitIndex: number) => {
    const split = order.splitBills?.[splitIndex];
    if (!split) return;
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Sub-Cuenta - ${split.customerName}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 15px; font-size: 13px; color: #000; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .details { margin-bottom: 15px; font-size: 11px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .items-table th, .items-table td { text-align: left; padding: 4px 0; }
            .items-table th { border-bottom: 1px solid #000; }
            .total-section { border-top: 1px dashed #000; padding-top: 5px; text-align: right; font-weight: bold; }
            .footer { text-align: center; margin-top: 25px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${order.restaurantName}</div>
            <div style="font-size: 14px; font-weight: bold; margin-top: 5px;">SUB-TICKET DE COMENSAL</div>
            <div>------------------------</div>
            <div>Mesa: ${order.tableName || 'N/A'}</div>
            <div>Comensal: ${split.customerName.toUpperCase()}</div>
            <div>ID Mesa: #${order.id.slice(0, 8).toUpperCase()}</div>
            <div>Fecha: ${new Date().toLocaleString()}</div>
          </div>
          <div class="details">
            <div><strong>Comensal:</strong> ${split.customerName}</div>
            ${order.waiterName ? `<div><strong>Mesero:</strong> ${order.waiterName}</div>` : ''}
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Cant</th>
                <th>Producto</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${split.items.map(item => `
                <tr>
                  <td>${item.quantity}x</td>
                  <td>${item.name}</td>
                  <td style="text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total-section">
            <div style="font-size: 15px; margin-top: 5px;">TOTAL COMENSAL: $${split.total.toFixed(2)}</div>
            ${split.paymentMethod === 'TARJETA' ? `
              <div style="font-size: 13px; margin-top: 5px; font-weight: bold; text-align: right; text-transform: uppercase;">*** PAGADO CON TARJETA ***</div>
            ` : `
              <div style="font-size: 12px; margin-top: 4px; text-align: right;">Efectivo Recibido: $${(split.receivedAmount ?? split.total).toFixed(2)}</div>
              <div style="font-size: 13px; margin-top: 2px; font-weight: bold; text-align: right;">Cambio Entregar: $${(split.changeAmount ?? 0).toFixed(2)}</div>
            `}
          </div>
          <div class="footer">
            ¡Muchas gracias por su preferencia!<br>
            Sub-ticket de comensal.<br>
            Mesa 22 Software POS
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Waiter triggers bill request (corte) to cashier
  const handleRequestBill = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        billRequested: true,
        billRequestedAt: Date.now(),
        updatedAt: Date.now()
      });
      alert('Se ha solicitado la cuenta a caja correctamente.');
    } catch (err) {
      console.error('Error requesting bill:', err);
      alert('Error al solicitar la cuenta');
    }
  };

  // Waiter marks the order as delivered to table
  const handleMarkOrderAsDelivered = async (orderId: string) => {
    try {
      const orderDoc = orders.find(o => o.id === orderId);
      const isDineIn = orderDoc?.deliveryType === 'DINE_IN';
      const targetStatus = isDineIn ? 'SERVED' : 'DELIVERED';

      await updateDoc(doc(db, 'orders', orderId), {
        status: targetStatus,
        updatedAt: Date.now()
      });
      if (isDineIn) {
        alert('El pedido ha sido entregado a la mesa y sumado a su monto pendiente por pagar.');
      } else {
        alert('El pedido ha sido marcado como entregado con éxito.');
      }
    } catch (err) {
      console.error('Error marking order as delivered:', err);
      alert('Error al actualizar el estado del pedido');
    }
  };

  // Waiter explicitly unlocks or locks QR code ordering for a table
  const handleToggleTableQrUnlock = async (tableName: string, currentUnlockedState: boolean) => {
    if (!selectedRest?.id) return;
    try {
      const activeTableOrders = orders.filter(
        o => o.tableName === tableName &&
             o.status !== 'DELIVERED' &&
             o.status !== 'CANCELLED' &&
             o.deliveryType === 'DINE_IN'
      );

      if (activeTableOrders.length > 0) {
        for (const o of activeTableOrders) {
          await updateDoc(doc(db, 'orders', o.id), {
            qrUnlocked: !currentUnlockedState,
            updatedAt: Date.now()
          });
        }
      } else {
        // If no active order exists yet, create an initial session order for this table so customers can order via QR
        if (!currentUnlockedState) {
          await addDoc(collection(db, 'orders'), {
            restaurantId: selectedRest.id,
            restaurantName: selectedRest.name,
            customerName: `Mesa ${tableName}`,
            customerPhone: '0000000000',
            deliveryType: 'DINE_IN',
            tableName: tableName,
            status: 'SERVED',
            qrUnlocked: true,
            items: [],
            subtotal: 0,
            deliveryFee: 0,
            total: 0,
            paymentMethod: 'CASH_ON_TABLE',
            waiterId: loggedInEmployee?.id || null,
            waiterName: loggedInEmployee?.name || 'Mesero',
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      }

      alert(!currentUnlockedState 
        ? `🔓 Pedidos por código QR DESBLOQUEADOS para la ${tableName}. Los comensales ya pueden pedir desde su celular.`
        : `🔒 Pedidos por código QR BLOQUEADOS para la ${tableName}.`
      );
    } catch (err) {
      console.error('Error toggling table QR lock state:', err);
      alert('Error al cambiar el estado de bloqueo QR de la mesa');
    }
  };

  // Add diner split for active order
  const handleAddActiveSplitDiner = () => {
    if (!activeOrderToSplit) return;
    if (!activeSplitName.trim()) {
      alert('Escriba el nombre del comensal');
      return;
    }

    const selectedItems: OrderItem[] = activeOrderToSplit.items.map(it => {
      const splitQty = activeSplitItems.find(s => s.productId === it.productId)?.quantity || 0;
      if (splitQty > 0) {
        return {
          productId: it.productId,
          name: it.name,
          price: it.price,
          quantity: splitQty
        };
      }
      return null;
    }).filter(i => i !== null) as OrderItem[];

    if (selectedItems.length === 0) {
      alert('Seleccione al menos un producto para este comensal');
      return;
    }

    const dinerTotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    let received = dinerTotal;
    let change = 0;

    if (splitDinerPaymentMethod === 'EFECTIVO') {
      const parsed = parseFloat(splitDinerReceivedAmount);
      if (isNaN(parsed) || parsed < dinerTotal) {
        alert(`Monto recibido inválido. Para pago en efectivo, el monto recibido debe ser mayor o igual al total del comensal ($${dinerTotal.toFixed(2)}).`);
        return;
      }
      received = parsed;
      change = received - dinerTotal;
    } else {
      received = dinerTotal;
      change = 0;
    }

    setTempActiveSplitBills([
      ...tempActiveSplitBills,
      {
        customerName: activeSplitName,
        items: selectedItems,
        total: dinerTotal,
        paid: false,
        receivedAmount: received,
        changeAmount: change,
        paymentMethod: splitDinerPaymentMethod
      }
    ]);

    // Reset fields
    setActiveSplitName('');
    setActiveSplitItems([]);
    setSplitDinerReceivedAmount('');
    setSplitDinerPaymentMethod('EFECTIVO');
  };

  // Send splits of active order to cashier
  const handleSendActiveSplitsToCashier = async () => {
    if (!activeOrderToSplit) return;
    if (tempActiveSplitBills.length === 0) {
      alert('Debe agregar al menos un comensal con productos divididos.');
      return;
    }

    try {
      const activeDineInOrders = orders.filter(
        o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.deliveryType === 'DINE_IN'
      );
      const tableOrders = activeDineInOrders.filter(o => o.tableName === activeOrderToSplit.tableName);

      // Update all orders of this table
      for (const order of tableOrders) {
        const orderRef = doc(db, 'orders', order.id);
        const updateObj: any = {
          splitBillsRequested: true,
          updatedAt: Date.now()
        };
        // Only the primary order stores the complete splitBills payload
        if (order.id === activeOrderToSplit.id) {
          updateObj.splitBills = tempActiveSplitBills;
        }
        await updateDoc(orderRef, updateObj);
      }

      alert('Cuentas divididas correctamente. Se han enviado los cortes a la caja para su cobro.');
      setActiveOrderToSplit(null);
      setTempActiveSplitBills([]);
      setActiveSplitItems([]);
      setActiveSplitName('');
    } catch (err) {
      console.error('Error sending splits to cashier:', err);
      alert('Error al enviar los cortes a la caja');
    }
  };

  // Cashier pays an individual diner from a split order
  const handlePaySplitDiner = async (order: Order, dinerIndex: number, paymentMethod: 'EFECTIVO' | 'TARJETA' = 'EFECTIVO') => {
    if (!activeCashSession) {
      alert('⚠️ Error de Caja: La caja está cerrada. Debe abrir el turno de caja antes de realizar cobros o registrar pagos.');
      return;
    }
    if (!order.splitBills) return;
    
    const updatedSplits = order.splitBills.map((bill, i) => {
      if (i === dinerIndex) {
        const finalMethod = paymentMethod || bill.paymentMethod || 'EFECTIVO';
        const received = finalMethod === 'TARJETA' ? bill.total : (bill.receivedAmount ?? bill.total);
        const change = finalMethod === 'TARJETA' ? 0 : (bill.changeAmount ?? 0);
        return { 
          ...bill, 
          paid: true,
          paymentMethod: finalMethod,
          receivedAmount: received,
          changeAmount: change
        };
      }
      return bill;
    });
    
    const allPaid = updatedSplits.every(b => b.paid);
    
    try {
      const activeDineInOrders = orders.filter(
        o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.deliveryType === 'DINE_IN'
      );
      const tableOrders = activeDineInOrders.filter(o => o.tableName === order.tableName);

      for (const tOrder of tableOrders) {
        const orderRef = doc(db, 'orders', tOrder.id);
        const updateData: any = {
          updatedAt: Date.now()
        };
        // The primary split order stores the updated splits array
        if (tOrder.id === order.id) {
          updateData.splitBills = updatedSplits;
        }
        
        // If all split parts have been paid, we can finalize all constituent orders to DELIVERED
        if (allPaid) {
          updateData.status = 'DELIVERED';
          updateData.splitBillsRequested = false;
          updateData.billRequested = false;
        }
        
        await updateDoc(orderRef, updateData);
      }
      
      if (allPaid && activeCashSession) {
        // Register total split sale transaction in active cash session
        const sessionRef = doc(db, 'cashSessions', activeCashSession.id);
        const updatedTrans = [
          ...activeCashSession.transactions,
          {
            type: 'IN' as const,
            amount: tableOrders.reduce((sum, o) => sum + o.total, 0),
            reason: `Venta Mesa ${order.tableName || 'N/A'} Dividida Completa (${paymentMethod})`,
            timestamp: Date.now(),
            paymentMethod: paymentMethod
          }
        ];
        await updateDoc(sessionRef, { transactions: updatedTrans });
      } else if (activeCashSession) {
        // Register individual diner amount in cash session
        const sessionRef = doc(db, 'cashSessions', activeCashSession.id);
        const updatedTrans = [
          ...activeCashSession.transactions,
          {
            type: 'IN' as const,
            amount: order.splitBills[dinerIndex].total,
            reason: `Pago Comensal: ${order.splitBills[dinerIndex].customerName} Mesa ${order.tableName || 'N/A'} (${paymentMethod})`,
            timestamp: Date.now(),
            paymentMethod: paymentMethod
          }
        ];
        await updateDoc(sessionRef, { transactions: updatedTrans });
      }
    } catch (err) {
      console.error('Error paying split diner:', err);
    }
  };

  // Register payment for a table/order group with open cash session verification
  const handleRegisterGroupPayment = async (tableOrders: Order[], tableName: string, total: number, paymentMethod: 'EFECTIVO' | 'TARJETA') => {
    if (!activeCashSession) {
      alert('⚠️ Error de Caja: La caja está cerrada. Debe abrir el turno de caja en el panel de control antes de realizar cobros o registrar pagos.');
      return;
    }

    try {
      // Find ALL active orders of this table to clean them up completely from all views
      const allActiveTableOrders = orders.filter(
        o => o.tableName === tableName &&
             o.status !== 'DELIVERED' &&
             o.status !== 'CANCELLED' &&
             o.deliveryType === 'DINE_IN'
      );

      // We will update all of them so they are cleared
      const ordersToUpdate = allActiveTableOrders.length > 0 ? allActiveTableOrders : tableOrders;

      // Recalculate total to ensure we charge the actual complete consumption of the table
      const finalTotal = allActiveTableOrders.reduce((sum, o) => sum + o.total, 0) || total;

      for (const o of ordersToUpdate) {
        await updateDoc(doc(db, 'orders', o.id), {
          status: 'DELIVERED',
          billRequested: false,
          customerBillRequestedFromWaiter: false, // Ensure this alert is cleared too!
          splitBillsRequested: false,
          updatedAt: Date.now()
        });
      }

      const sessionRef = doc(db, 'cashSessions', activeCashSession.id);
      const updatedTrans = [
        ...activeCashSession.transactions,
        {
          type: 'IN' as const,
          amount: finalTotal,
          reason: `Venta Mesa ${tableName} Completa (${paymentMethod})`,
          timestamp: Date.now(),
          paymentMethod: paymentMethod
        }
      ];
      await updateDoc(sessionRef, { transactions: updatedTrans });
      alert(`¡Pago registrado con éxito con ${paymentMethod} para ${tableName}! Mesa liberada y comanda limpia.`);
    } catch (err) {
      console.error('Error completing payment:', err);
      alert('Hubo un error al registrar el pago de la mesa.');
    }
  };

  const handleRegisterPickupPayment = async (order: Order, paymentMethod: 'EFECTIVO' | 'TARJETA') => {
    if (!activeCashSession) {
      alert('⚠️ Error de Caja: La caja está cerrada. Debe abrir el turno de caja en el panel de control antes de realizar cobros o registrar pagos.');
      return;
    }

    try {
      // 1. Mark order as cashierPaid
      await updateDoc(doc(db, 'orders', order.id), {
        cashierPaid: true,
        cashierPaidAt: Date.now(),
        updatedAt: Date.now()
      });

      // 2. Add cash session transaction
      const sessionRef = doc(db, 'cashSessions', activeCashSession.id);
      const updatedTrans = [
        ...activeCashSession.transactions,
        {
          type: 'IN' as const,
          amount: order.total,
          reason: `Pago de Pedido para Llevar #${order.id.slice(0, 5)} (${paymentMethod})`,
          timestamp: Date.now(),
          paymentMethod: paymentMethod
        }
      ];
      await updateDoc(sessionRef, { transactions: updatedTrans });
      const printNow = window.confirm(`¡Pago de $${order.total} registrado con éxito con ${paymentMethod}!\n\n¿Deseas imprimir el ticket de venta ahora?`);
      if (printNow) {
        handlePrintBill({
          ...order,
          cashierPaid: true
        });
      }
    } catch (err) {
      console.error('Error completing pickup payment:', err);
      alert('Hubo un error al registrar el pago del pedido para llevar.');
    }
  };

  const handleDeliverPickupOrder = async (order: Order) => {
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'DELIVERED',
        updatedAt: Date.now()
      });
      alert(`¡Pedido de ${order.customerName || 'Cliente'} entregado correctamente!`);
    } catch (err) {
      console.error('Error delivering pickup order:', err);
      alert('Hubo un error al entregar el pedido.');
    }
  };

  // Print comanda simulated HTML preview
  const handlePrintComanda = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Comanda Mesa 22</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 15px; font-size: 13px; color: #000; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .title { font-size: 18px; font-weight: bold; }
            .details { margin-bottom: 15px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .items-table th, .items-table td { text-align: left; padding: 4px 0; }
            .items-table th { border-bottom: 1px solid #000; }
            .total-section { border-top: 1px dashed #000; padding-top: 5px; text-align: right; font-weight: bold; }
            .footer { text-align: center; margin-top: 25px; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${order.restaurantName}</div>
            <div>Mesa 22 - Ticket de Cocina</div>
            <div>------------------------</div>
            <div>ID: #${order.id.slice(0, 8)}</div>
            <div>Fecha: ${new Date(order.createdAt).toLocaleString()}</div>
          </div>
          <div class="details">
            <div><strong>Cliente:</strong> ${order.customerName}</div>
            <div><strong>Teléfono:</strong> ${order.customerPhone}</div>
            <div><strong>Tipo:</strong> ${order.deliveryType} ${order.tableName ? `[${order.tableName}]` : ''}</div>
          </div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Cant</th>
                <th>Producto</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.quantity}x</td>
                  <td>${item.name} ${item.selectedVariant ? `(${item.selectedVariant})` : ''}</td>
                  <td style="text-align: right;">$${item.price * item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total-section">
            <div>Subtotal: $${order.subtotal}</div>
            ${order.deliveryFee > 0 ? `<div>Envío: $${order.deliveryFee}</div>` : ''}
            <div style="font-size: 16px;">TOTAL: $${order.total}</div>
          </div>
          <div class="footer">
            ¡Buen provecho!<br>
            Desarrollado por Mesa 22 Software POS
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Inventory actions
  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRest) return;
    if (!newIngName.trim()) return;

    const newIng: Omit<Ingredient, 'id'> = {
      restaurantId: selectedRest.id,
      name: newIngName,
      stock: newIngStock,
      minStock: newIngMin,
      unit: newIngUnit
    };

    try {
      await addDoc(collection(db, 'ingredients'), newIng);
      setNewIngName('');
      setShowAddIngModal(false);
      alert('Ingrediente agregado al inventario.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRest) return;
    if (!newSupName.trim()) return;

    const newSup: Omit<Supplier, 'id'> = {
      restaurantId: selectedRest.id,
      name: newSupName,
      contact: newSupContact,
      phone: newSupPhone
    };

    try {
      await addDoc(collection(db, 'suppliers'), newSup);
      setNewSupName('');
      setNewSupContact('');
      setNewSupPhone('');
      alert('Proveedor agregado con éxito.');
    } catch (err) {
      console.error(err);
    }
  };

  const handlePurchaseStock = async (ingredientId: string, quantity: number, cost: number) => {
    if (!selectedRest) return;
    if (quantity <= 0 || cost <= 0) {
      alert('La cantidad y costo deben ser mayores a cero.');
      return;
    }

    try {
      // Find current stock
      const ing = ingredients.find(i => i.id === ingredientId);
      if (!ing) return;

      const ingRef = doc(db, 'ingredients', ingredientId);
      await updateDoc(ingRef, { stock: ing.stock + quantity });

      // Add Purchase log
      const newPurchase: Omit<Purchase, 'id'> = {
        restaurantId: selectedRest.id,
        ingredientId,
        qty: quantity,
        cost,
        date: Date.now()
      };
      await addDoc(collection(db, 'purchases'), newPurchase);

      // Register cash withdrawal if cash register is open
      if (activeCashSession) {
        const sesRef = doc(db, 'cashSessions', activeCashSession.id);
        const updatedTrans = [
          ...activeCashSession.transactions,
          {
            type: 'OUT' as const,
            amount: cost,
            reason: `Compra insumo: ${ing.name} (${quantity} ${ing.unit})`,
            timestamp: Date.now()
          }
        ];
        await updateDoc(sesRef, { transactions: updatedTrans });
      }

      alert('Compra e ingreso de stock procesado con éxito.');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary mx-auto mb-4"></div>
        <p className="text-slate-500 font-semibold">Iniciando Portal del Restaurante...</p>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center">
        <Store className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="font-extrabold text-slate-800 text-lg">No hay restaurantes aprobados</h3>
        <p className="text-slate-500 text-sm mt-1.5">Regístrate en la pestaña "Registrar Restaurante" y luego apruébalo desde el panel "Administrador General" para poder abrir su POS y cocina.</p>
      </div>
    );
  }

  if (selectedRest?.status === 'SUSPENDED') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4 text-white" id="suspended_restaurant_full_screen">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center relative overflow-hidden animate-scale-in">
          {/* Decorative glowing background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 blur-3xl rounded-full"></div>
          
          <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 relative z-10 text-rose-500">
            <Lock className="w-10 h-10" />
          </div>
          
          <h2 className="text-2xl font-black tracking-tight text-white mb-2 relative z-10 uppercase">
            Mesa 22 - Panel Suspendido
          </h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-6">
            Membresía Vencida o Inactiva
          </p>
          
          <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-700/50 mb-8 text-left text-sm text-slate-300 space-y-3">
            <p className="font-medium leading-relaxed">
              El acceso al panel de control de <strong className="text-white font-black">{selectedRest.name}</strong> ha sido suspendido temporalmente por falta de pago.
            </p>
            <p className="text-xs text-slate-400 leading-normal">
              Para reactivar tu servicio y restablecer las operaciones, por favor comunícate de inmediato con nuestro equipo administrativo.
            </p>
          </div>

          <div className="space-y-4">
            <a
              href="https://wa.me/523951347469?text=Hola,%20deseo%20realizar%20el%20pago%20de%20mi%20membres%C3%ADa%20para%20el%20restaurante%20Mesa%2022"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-black py-3.5 px-6 rounded-2xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.588 1.981 14.114.957 11.5.957c-5.434 0-9.858 4.37-9.862 9.801-.001 1.768.463 3.49 1.345 5.021l-.998 3.64 3.73-.974zm11.167-7.29c-.3-.15-1.774-.875-2.048-.975-.275-.1-.475-.15-.675.15-.2.3-.775.975-.95 1.175-.175.2-.35.225-.65.075-1.204-.6-2.007-1.05-2.8-2.425-.2-.35-.05-.55.1-.7l.45-.45c.15-.15.2-.25.3-.45.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.493-.51-.675-.51-.172-.001-.371-.001-.571-.001-.2 0-.525.075-.8 1.05-.3 1-.95 2.35-.95 2.4 0 .45.35.9.7 1.4 1.42 2.05 3.338 3.4 5.35 4.075.5.175.975.3 1.325.4.5.15.95.125 1.3.075.4-.05 1.225-.5 1.4-1 .175-.5.175-.925.125-1-.05-.075-.225-.15-.525-.3z"/>
              </svg>
              WhatsApp 3951347469
            </a>

            {/* Logout / Switch controls */}
            <div className="pt-5 border-t border-slate-700/50 flex flex-col gap-2.5">
              {currentUser && userProfile ? (
                <button
                  onClick={() => signOut(auth)}
                  className="w-full bg-slate-700 hover:bg-slate-650 text-slate-300 font-extrabold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" /> Cerrar Sesión Propietario
                </button>
              ) : (
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] text-slate-400 font-extrabold uppercase">
                    Cambiar Restaurante (Simulación):
                  </label>
                  <select
                    value={selectedRest?.id || ''}
                    onChange={(e) => {
                      const found = restaurants.find(r => r.id === e.target.value);
                      if (found) setSelectedRest(found);
                    }}
                    className="bg-slate-700 text-white text-xs font-bold rounded-xl p-2.5 w-full border border-slate-600 focus:ring-1 focus:ring-brand-primary outline-hidden cursor-pointer"
                  >
                    {restaurants.map(r => (
                      <option key={r.id} value={r.id} className="text-slate-800">
                        {r.name} ({r.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if neither employee nor owner is logged in
  const isNotLoggedIn = !loggedInEmployee && !(currentUser && userProfile);

  // Calculate Critical Stock ingredients
  const criticalStockList = ingredients.filter(i => i.stock <= i.minStock);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" id="restaurant_portal_container">
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialRole="restaurant" 
        onAuthSuccess={() => {}} 
      />

      {/* Selector & Shop Title */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <Logo size="md" />
          <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>
          <div className="flex-1 min-w-[200px]">
            {loggedInEmployee ? (
              <div>
                <label className="block text-[10px] text-gray-400 font-extrabold uppercase flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-brand-primary animate-pulse" /> Sesión de Empleado Activa:
                </label>
                <div className="font-black text-slate-800 text-xl flex items-center gap-2">
                  <span>{selectedRest?.name}</span>
                  <span className="bg-brand-primary text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                    {loggedInEmployee.role}
                  </span>
                </div>
              </div>
            ) : currentUser && userProfile ? (
              <div>
                <label className="block text-[10px] text-gray-400 font-extrabold uppercase flex items-center gap-1">
                  <Lock className="w-3 h-3 text-brand-primary" /> Panel de Control Protegido:
                </label>
                <div className="font-black text-slate-800 text-xl flex flex-wrap items-center gap-2">
                  <span>{selectedRest?.name}</span>
                  <span className="bg-brand-primary/10 text-brand-primary text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                    Propietario / Admin
                  </span>
                  {selectedRest?.id && (
                    <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold text-slate-700 ml-1">
                      <span>ID: {selectedRest.id}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedRest.id);
                          alert('✅ ID de restaurante copiado al portapapeles');
                        }}
                        className="text-[10px] font-sans font-extrabold text-brand-primary hover:underline ml-1 cursor-pointer"
                        title="Copiar ID"
                      >
                        Copiar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] text-gray-400 font-extrabold uppercase">Estás operando en (Simulación):</label>
                <div className="font-black text-slate-300 text-xl py-1 select-none">
                  (Vacío)
                </div>
              </div>
            )}
          </div>

          {/* Restaurant Auth / Employee Auth Buttons */}
          <div className="shrink-0 flex items-center gap-3">
            {loggedInEmployee ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-gray-150 p-2 rounded-2xl">
                <div className="text-right px-2">
                  <div className="text-[10px] text-gray-400 font-bold uppercase">Operador:</div>
                  <div className="text-xs font-black text-slate-800">{loggedInEmployee.name}</div>
                </div>
                <button
                  onClick={() => setLoggedInEmployee(null)}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión Empleado
                </button>
              </div>
            ) : currentUser && userProfile ? (
              <button
                onClick={() => signOut(auth)}
                className="px-4 py-2 bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Cerrar Panel Privado
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer"
                >
                  Inicia Propietario
                </button>
                <button
                  onClick={() => setShowEmpLogin(true)}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
                >
                  Inicia Empleado
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cash Register State Control */}
        {(!loggedInEmployee || loggedInEmployee.role === 'cajero') && (
          <div className="flex items-center gap-3 shrink-0">
            {activeCashSession ? (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl">
                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 font-sans">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Caja Abierta (Efectivo: ${getSessionTotals(activeCashSession).calculatedFinal.toFixed(2)})
                </span>
                <button
                  onClick={handleCloseCashRegister}
                  className="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-black px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs uppercase tracking-wider"
                >
                  Corte Caja
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-slate-50 border border-gray-200 px-4 py-2 rounded-2xl">
                <span className="text-xs text-slate-500 font-bold font-sans">Caja Cerrada</span>
                <button
                  onClick={handleOpenCashRegister}
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white text-[11px] font-black px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs uppercase tracking-wider"
                >
                  Abrir Turno Caja
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isNotLoggedIn ? (
        <div className="bg-white border border-gray-200 rounded-3xl p-8 md:p-12 text-center max-w-2xl mx-auto shadow-xs animate-fade-in my-12" id="login_required_card">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-3">Acceso al Panel de Control Protegido</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-6 leading-relaxed max-w-md mx-auto">
            Por favor, inicia sesión para acceder a las herramientas operativas de tu restaurante (Punto de Venta POS, Cocina, Inventario y Reportes).
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-4 max-w-md mx-auto">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <Store className="w-4 h-4 text-orange-400" />
              Inicia Propietario
            </button>
            <button
              onClick={() => setShowEmpLogin(true)}
              className="flex-1 px-6 py-4 bg-brand-primary hover:bg-brand-primary-hover text-white font-black rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <UserCheck className="w-4 h-4 text-white" />
              Inicia Empleado
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs Menu */}
          <div className="flex border-b border-gray-200 mb-8 overflow-x-auto gap-2">
        {(!loggedInEmployee || loggedInEmployee.role !== 'cocinero') && (
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Resumen
          </button>
        )}
        {(!loggedInEmployee || loggedInEmployee.role !== 'cocinero') && (
          <button
            onClick={() => setActiveTab('pos')}
            className={`pb-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'pos' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Punto de Venta (POS)
          </button>
        )}
        {(!loggedInEmployee || ['cocinero', 'cajero'].includes(loggedInEmployee.role)) && (
          <button
            onClick={() => setActiveTab('kitchen')}
            className={`pb-4 px-4 font-bold text-sm border-b-2 transition relative whitespace-nowrap cursor-pointer ${
              activeTab === 'kitchen' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Pantalla Cocina
            {orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PREPARING').length > 0 && (
              <span className="ml-1.5 bg-brand-primary text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-bounce">
                {orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PREPARING').length}
              </span>
            )}
          </button>
        )}
        {(!loggedInEmployee || ['cajero'].includes(loggedInEmployee.role)) && (
          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-4 px-4 font-bold text-sm border-b-2 transition relative whitespace-nowrap cursor-pointer ${
              activeTab === 'inventory' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Inventarios
            {criticalStockList.length > 0 && (
              <span className="ml-1.5 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {criticalStockList.length}
              </span>
            )}
          </button>
        )}
        {!loggedInEmployee && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-4 px-4 font-bold text-sm border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'reports' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Reportes y Utilidades
          </button>
        )}
        {currentUser && userProfile && (
          <button
            onClick={() => setActiveTab('employees')}
            className={`pb-4 px-4 font-bold text-sm border-b-2 transition relative whitespace-nowrap cursor-pointer ${
              activeTab === 'employees' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Personal / Empleados
            {employees.length > 0 && (
              <span className="ml-1.5 bg-slate-800 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {employees.length}
              </span>
            )}
          </button>
        )}
        {currentUser && userProfile && (
          <button
            onClick={() => setActiveTab('menu')}
            className={`pb-4 px-4 font-bold text-sm border-b-2 transition relative whitespace-nowrap cursor-pointer ${
              activeTab === 'menu' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Menú / Platillos
            {products.length > 0 && (
              <span className="ml-1.5 bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {products.length}
              </span>
            )}
          </button>
        )}
        {currentUser && userProfile && (
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-4 px-4 font-bold text-sm border-b-2 transition relative whitespace-nowrap cursor-pointer ${
              activeTab === 'profile' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Perfil / Configuración
          </button>
        )}
      </div>



      {/* Tab Contents */}
      {/* 1. DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* WAITER-SPECIFIC PORTAL */}
          {loggedInEmployee?.role === 'mesero' ? (
            <div className="space-y-8">
              {/* Header and Summary stats */}
              <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h3 className="text-xl font-black tracking-tight uppercase flex items-center gap-2">
                    <UserCheck className="w-6 h-6 animate-pulse text-white" /> Panel del Mesero: Comandas y Servicio de Mesas
                  </h3>
                  <p className="text-orange-50 text-xs mt-1 leading-relaxed">
                    Hola, <strong className="font-extrabold">{loggedInEmployee.name}</strong>. Desde aquí puedes monitorear tus mesas en servicio, marcar platillos entregados, solicitar la cuenta del cliente (hacer corte) o dividir cuentas entre comensales.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('pos')}
                  className="px-5 py-3 bg-white hover:bg-orange-50 text-brand-primary text-xs font-black rounded-2xl transition cursor-pointer flex items-center gap-2 uppercase tracking-wider shadow-sm shrink-0"
                  type="button"
                >
                  <Plus className="w-4 h-4" /> Nueva Orden (POS)
                </button>
              </div>

              {/* Stats highlights removed from here, moved under Active Tables Grid */}

              {/* Active Tables Grid */}
              <div className="bg-white rounded-3xl border border-slate-150 p-6">
                <h3 className="font-extrabold text-slate-800 text-lg mb-6 flex items-center gap-2">
                  <Store className="w-5 h-5 text-brand-primary" /> Monitoreo de Mesas Activas y Comandas
                </h3>

                {orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.deliveryType === 'DINE_IN').length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-sm font-semibold">
                    No hay mesas activas con comanda en este momento. ¡Abre una comanda desde la pestaña POS!
                  </div>
                ) : (() => {
                  const activeDineInOrders = orders.filter(
                    o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.deliveryType === 'DINE_IN'
                  );
                  const tableGroups: { [tableName: string]: Order[] } = {};
                  activeDineInOrders.forEach(o => {
                    const table = o.tableName || 'Mesa Sin Nombre';
                    if (!tableGroups[table]) {
                      tableGroups[table] = [];
                    }
                    tableGroups[table].push(o);
                  });

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries(tableGroups).map(([tableName, tableOrders]) => {
                        const readyOrders = tableOrders.filter(o => o.status === 'READY');
                        const preparingOrders = tableOrders.filter(o => o.status === 'PREPARING' || o.status === 'PENDING' || o.status === 'CONFIRMED');
                        const servedOrders = tableOrders.filter(o => o.status === 'SERVED');
                        const hasExplicitUnlock = tableOrders.some(o => o.qrUnlocked === true);
                        const hasExplicitLock = tableOrders.some(o => o.qrUnlocked === false);
                        const qrMode = selectedRest?.qrOrderingMode || 'AUTOMATIC';
                        const isTableQrUnlocked = qrMode === 'ALWAYS_ACTIVE' ? true : qrMode === 'ALWAYS_DISABLED' ? false : (hasExplicitUnlock ? true : hasExplicitLock ? false : servedOrders.length > 0);

                        const anyBillRequested = tableOrders.some(o => o.billRequested);
                        const anySplitBillsRequested = tableOrders.some(o => o.splitBillsRequested);
                        const anyCustomerBillRequestedFromWaiter = tableOrders.some(o => o.customerBillRequestedFromWaiter);
                        const assignedWaiterId = tableOrders.find(o => o.waiterId)?.waiterId;
                        const assignedWaiterName = tableOrders.find(o => o.waiterId)?.waiterName;

                        const pendingToPay = servedOrders.reduce((sum, o) => sum + o.total, 0);
                        const cookingAmount = preparingOrders.reduce((sum, o) => sum + o.total, 0) + readyOrders.reduce((sum, o) => sum + o.total, 0);
                        const tableTotalAccumulated = tableOrders.reduce((sum, o) => sum + o.total, 0);

                        const customerNames = Array.from(new Set(tableOrders.map(o => o.customerName).filter(Boolean))).join(', ') || 'Cliente';
                        const waiterNames = Array.from(new Set(tableOrders.map(o => o.waiterName).filter(Boolean))).join(', ');

                        return (
                          <div 
                            key={tableName} 
                            className={`rounded-3xl border p-6 transition duration-200 flex flex-col justify-between h-full ${
                              readyOrders.length > 0 
                                ? 'border-emerald-300 bg-emerald-50/20 shadow-emerald-100/50 shadow-md ring-2 ring-emerald-500/20' 
                                : anyBillRequested || anySplitBillsRequested
                                ? 'border-indigo-200 bg-indigo-50/10'
                                : anyCustomerBillRequestedFromWaiter
                                ? 'border-rose-200 bg-rose-50/15 shadow-rose-100/50 shadow-md'
                                : 'border-slate-150 bg-white hover:border-slate-300 hover:shadow-xs'
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-start gap-2 mb-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-slate-800 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                                      {tableName}
                                    </span>
                                    {qrMode === 'ALWAYS_ACTIVE' ? (
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> QR Siempre Activo
                                      </span>
                                    ) : qrMode === 'ALWAYS_DISABLED' ? (
                                      <span className="bg-rose-100 text-rose-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-rose-700" /> QR Desactivado
                                      </span>
                                    ) : isTableQrUnlocked ? (
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> QR Activo
                                      </span>
                                    ) : (
                                      <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-amber-700" /> QR Bloqueado
                                      </span>
                                    )}
                                  </div>
                                  <span className="block font-bold text-slate-800 text-sm mt-1.5">{customerNames}</span>
                                </div>
                                <div className="text-right">
                                  {readyOrders.length > 0 && (
                                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest inline-block bg-emerald-100 text-emerald-800 animate-pulse mb-1">
                                      Listo 🛎 ({readyOrders.length})
                                    </span>
                                  )}
                                  {preparingOrders.length > 0 && (
                                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest inline-block bg-amber-100 text-amber-800">
                                      Cocina 🍳 ({preparingOrders.length})
                                    </span>
                                  )}
                                  {waiterNames && (
                                    <span className="block text-[10px] text-slate-400 font-bold mt-1 uppercase font-mono">Mesero: {waiterNames}</span>
                                  )}
                                </div>
                              </div>

                              <div className="py-3 border-t border-b border-slate-100 my-3 space-y-3">
                                <div>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Historial Entregados (Monto por pagar):</span>
                                  {servedOrders.length === 0 ? (
                                    <span className="text-xs text-slate-400 italic block">Ninguno entregado aún</span>
                                  ) : (
                                    <div className="space-y-1">
                                      {servedOrders.flatMap(o => o.items).map((it, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-slate-700 font-medium font-mono">
                                          <span>✓ {it.quantity}x {it.name}</span>
                                          <span>${it.price * it.quantity}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {readyOrders.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Listos en Mostrador:</span>
                                    <div className="space-y-1">
                                      {readyOrders.flatMap(o => o.items).map((it, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-emerald-700 font-medium font-mono">
                                          <span>🛎 {it.quantity}x {it.name}</span>
                                          <span>${it.price * it.quantity}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {preparingOrders.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block mb-1">En Cocina:</span>
                                    <div className="space-y-1">
                                      {preparingOrders.flatMap(o => o.items).map((it, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-slate-500 font-medium font-mono">
                                          <span>🍳 {it.quantity}x {it.name}</span>
                                          <span>${it.price * it.quantity}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5 text-xs pb-3 border-b border-slate-100">
                                <div className="flex justify-between text-slate-500 font-medium">
                                  <span>Monto en Preparación:</span>
                                  <span>${cookingAmount}</span>
                                </div>
                                <div className="flex justify-between text-slate-800 font-bold">
                                  <span>Monto Pendiente (Entregado):</span>
                                  <span className="text-brand-primary">${pendingToPay}</span>
                                </div>
                                <div className="flex justify-between text-slate-900 font-black pt-1 border-t border-dashed border-slate-200">
                                  <span>Total Acumulado Mesa:</span>
                                  <span>${tableTotalAccumulated}</span>
                                </div>
                              </div>

                              {anyBillRequested && (
                                <div className="mt-3 p-2 bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-black rounded-lg text-center uppercase tracking-wide flex items-center justify-center gap-1.5 animate-pulse">
                                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span> Cuenta Solicitada a Caja (Cierre)
                                </div>
                              )}

                              {anySplitBillsRequested && (
                                <div className="mt-3 p-2 bg-purple-50 border border-purple-200 text-purple-950 text-[10px] font-black rounded-lg text-center uppercase tracking-wide flex items-center justify-center gap-1.5">
                                  <Scissors className="w-3.5 h-3.5 text-purple-600" /> Cuenta Dividida (Cortes en Caja)
                                </div>
                              )}

                              {anyCustomerBillRequestedFromWaiter && !anyBillRequested && !anySplitBillsRequested && (
                                <div className="mt-3 p-2 bg-rose-50 border border-rose-250 text-rose-900 text-[10px] font-black rounded-lg text-center uppercase tracking-wide flex items-center justify-center gap-1.5 animate-pulse">
                                  <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping"></span> 🛎️ Cliente solicita cuenta al mesero
                                </div>
                              )}
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                              <button
                                type="button"
                                onClick={() => handleToggleTableQrUnlock(tableName, isTableQrUnlocked)}
                                className={`w-full font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 border uppercase tracking-wider ${
                                  isTableQrUnlocked 
                                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                {isTableQrUnlocked ? (
                                  <>
                                    <Lock className="w-3.5 h-3.5" /> Bloquear Pedidos QR
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3.5 h-3.5" /> Desbloquear Pedidos QR
                                  </>
                                )}
                              </button>

                              {readyOrders.map((order) => (
                                <button
                                  key={order.id}
                                  onClick={async () => {
                                    if (assignedWaiterId && assignedWaiterId !== loggedInEmployee?.id) {
                                      alert(`Esta mesa está siendo atendida por el mesero "${assignedWaiterName}". Solo él puede entregar pedidos.`);
                                      return;
                                    }
                                    handleMarkOrderAsDelivered(order.id);
                                  }}
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs uppercase tracking-wider"
                                  type="button"
                                >
                                  <CheckCircle className="w-4 h-4" /> Entregar Pedido ({order.items.map(i => `${i.quantity}x ${i.name}`).join(', ').slice(0, 25)}...)
                                </button>
                              ))}

                              {!assignedWaiterId ? (
                                <button
                                  onClick={async () => {
                                    if (!loggedInEmployee) return;
                                    try {
                                      for (const o of tableOrders) {
                                        await updateDoc(doc(db, 'orders', o.id), {
                                          waiterId: loggedInEmployee.id,
                                          waiterName: loggedInEmployee.name,
                                          updatedAt: Date.now()
                                        });
                                      }
                                      alert(`Te has asignado como el mesero de la ${tableName} con éxito.`);
                                    } catch (err) {
                                      console.error("Error claiming table:", err);
                                      alert("Error al asignarse a la mesa.");
                                    }
                                  }}
                                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider"
                                  type="button"
                                >
                                  <UserCheck className="w-4 h-4" /> Atender esta Mesa (Asignarme)
                                </button>
                              ) : (
                                <>
                                  {!anyBillRequested && !anySplitBillsRequested && (
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                      <button
                                        onClick={async () => {
                                          if (assignedWaiterId !== loggedInEmployee?.id) {
                                            alert(`Esta mesa está asignada al mesero "${assignedWaiterName}". Solo él puede solicitar el corte de cuenta a caja.`);
                                            return;
                                          }
                                          if (confirm(`¿Solicitar cierre de mesa para la ${tableName}? El monto pendiente es de $${pendingToPay}.`)) {
                                            try {
                                              for (const o of tableOrders) {
                                                await updateDoc(doc(db, 'orders', o.id), {
                                                  billRequested: true,
                                                  billRequestedAt: Date.now(),
                                                  updatedAt: Date.now()
                                                });
                                              }
                                              alert(`Se ha solicitado el cierre de cuenta para la ${tableName} con éxito.`);
                                            } catch (err) {
                                              console.error(err);
                                            }
                                          }
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-1.5 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                        type="button"
                                      >
                                        <Printer className="w-3.5 h-3.5" /> Cierre de Mesa
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (assignedWaiterId !== loggedInEmployee?.id) {
                                            alert(`Esta mesa está asignada al mesero "${assignedWaiterName}". Solo él puede dividir la cuenta.`);
                                            return;
                                          }
                                          const combinedItems: OrderItem[] = [];
                                          tableOrders.forEach(o => {
                                            o.items.forEach(it => {
                                              const existing = combinedItems.find(x => x.productId === it.productId);
                                              if (existing) {
                                                existing.quantity += it.quantity;
                                              } else {
                                                combinedItems.push({ ...it });
                                              }
                                            });
                                          });

                                          const mockOrder: Order = {
                                            id: tableOrders[0].id,
                                            restaurantId: tableOrders[0].restaurantId,
                                            restaurantName: tableOrders[0].restaurantName,
                                            customerName: customerNames,
                                            customerPhone: tableOrders[0].customerPhone,
                                            deliveryType: 'DINE_IN',
                                            tableName: tableName,
                                            status: 'SERVED',
                                            items: combinedItems,
                                            subtotal: combinedItems.reduce((s, x) => s + x.price * x.quantity, 0),
                                            deliveryFee: 0,
                                            total: combinedItems.reduce((s, x) => s + x.price * x.quantity, 0),
                                            paymentMethod: 'CASH_ON_TABLE',
                                            createdAt: tableOrders[0].createdAt,
                                            updatedAt: Date.now()
                                          };

                                          setActiveOrderToSplit(mockOrder);
                                          setTempActiveSplitBills([]);
                                          setActiveSplitItems([]);
                                          setActiveSplitName('');
                                        }}
                                        className="bg-brand-primary/15 hover:bg-brand-primary/25 text-brand-primary font-extrabold py-2 px-1.5 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                        type="button"
                                      >
                                        <Scissors className="w-3.5 h-3.5" /> Dividir Cuenta
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}

                              {!(loggedInEmployee?.role === 'mesero' || loggedInEmployee?.role === 'cajero') && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`¿Está seguro de liberar la ${tableName} y LIMPIAR por completo la comanda? Esto marcará todos los pedidos activos como cobrados/entregados en la base de datos.`)) {
                                      try {
                                        const allActiveTableOrders = orders.filter(
                                          o => o.tableName === tableName &&
                                               o.status !== 'DELIVERED' &&
                                               o.status !== 'CANCELLED' &&
                                               o.deliveryType === 'DINE_IN'
                                        );
                                        for (const o of allActiveTableOrders) {
                                          await updateDoc(doc(db, 'orders', o.id), {
                                            status: 'DELIVERED',
                                            billRequested: false,
                                            customerBillRequestedFromWaiter: false,
                                            splitBillsRequested: false,
                                            updatedAt: Date.now()
                                          });
                                        }
                                        alert(`La ${tableName} ha sido liberada y limpiada correctamente.`);
                                      } catch (err) {
                                        console.error("Error clearing table orders:", err);
                                        alert("Error al limpiar la mesa.");
                                      }
                                    }
                                  }}
                                  className="w-full mt-2.5 bg-rose-600/10 hover:bg-rose-600 text-rose-700 hover:text-white font-extrabold py-2 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider"
                                  type="button"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Liberar Mesa / Limpiar Comanda
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Stats highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Mis Mesas Activas</span>
                    <Store className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-slate-800">
                      {new Set(
                        orders
                          .filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.deliveryType === 'DINE_IN' && o.waiterId === loggedInEmployee.id)
                          .map(o => o.tableName || 'Mesa Sin Nombre')
                      ).size}
                    </span>
                    <span className="text-slate-500 text-xs block mt-1">En servicio</span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Platillos por Recoger (Cocina)</span>
                    <BellRing className="w-5 h-5 text-emerald-500 animate-pulse" />
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-emerald-600">
                      {orders.filter(o => o.status === 'READY' && o.waiterId === loggedInEmployee.id).length}
                    </span>
                    <span className="text-emerald-500 text-xs font-bold block mt-1">Listos en mostrador</span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Cocina en Preparación</span>
                    <ChefHat className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-black text-amber-600">
                      {orders.filter(o => o.status === 'PREPARING' && o.waiterId === loggedInEmployee.id).length}
                    </span>
                    <span className="text-amber-500 text-xs font-bold block mt-1">Cocinándose</span>
                  </div>
                </div>
              </div>

              {/* Active Order Splitting Modal */}
              {activeOrderToSplit && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-100 shadow-2xl p-6 sm:p-8 flex flex-col">
                    
                    {/* Modal header */}
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                          <Scissors className="w-5 h-5 text-brand-primary" /> Dividir Cuenta - {activeOrderToSplit.tableName || 'Mesa'}
                        </h3>
                        <p className="text-slate-500 text-xs mt-0.5 font-sans">Divide los platillos consumidos entre diferentes comensales para enviar los cortes a caja.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setActiveOrderToSplit(null);
                          setTempActiveSplitBills([]);
                          setActiveSplitItems([]);
                          setActiveSplitName('');
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition"
                        type="button"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Left Column: Selector & Right Column: live split layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-y-auto">
                      
                      {/* Diner Creator details */}
                      <div className="space-y-4">
                        <h4 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">1. Agregar Comensal</h4>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-extrabold uppercase font-mono">Nombre del comensal:</label>
                          <input 
                            type="text" 
                            placeholder="Ej. Juan Pérez" 
                            value={activeSplitName}
                            onChange={(e) => setActiveSplitName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition font-sans"
                          />
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          <label className="text-[10px] text-slate-400 font-extrabold uppercase block mb-1 font-mono">Seleccionar productos:</label>
                          
                          {activeOrderToSplit.items.map((it) => {
                            const assignedQty = activeSplitItems.find(s => s.productId === it.productId)?.quantity || 0;
                            // Calculate quantities already assigned to other split parts to avoid over-assigning
                            const totalAssignedInOtherSplits = tempActiveSplitBills.reduce((sum, split) => {
                              const itemInSplit = split.items.find(si => si.productId === it.productId);
                              return sum + (itemInSplit?.quantity || 0);
                            }, 0);
                            const remainingQty = it.quantity - totalAssignedInOtherSplits;

                            if (remainingQty <= 0 && assignedQty === 0) return null;

                            return (
                              <div key={it.productId} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                                <div className="flex-1 pr-2">
                                  <span className="font-bold text-slate-800 block">{it.name}</span>
                                  <span className="text-[10px] text-slate-400 font-semibold block font-sans">Disp: {remainingQty} / total {it.quantity} | ${it.price} c/u</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    disabled={assignedQty <= 0}
                                    onClick={() => {
                                      const current = activeSplitItems.find(s => s.productId === it.productId);
                                      if (current) {
                                        if (current.quantity === 1) {
                                          setActiveSplitItems(activeSplitItems.filter(s => s.productId !== it.productId));
                                        } else {
                                          setActiveSplitItems(activeSplitItems.map(s => s.productId === it.productId ? { ...s, quantity: s.quantity - 1 } : s));
                                        }
                                      }
                                    }}
                                    className="p-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-800 disabled:opacity-50 transition cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-5 text-center font-black text-slate-800 text-xs font-mono">{assignedQty}</span>
                                  <button
                                    type="button"
                                    disabled={assignedQty >= remainingQty}
                                    onClick={() => {
                                      const current = activeSplitItems.find(s => s.productId === it.productId);
                                      if (current) {
                                        setActiveSplitItems(activeSplitItems.map(s => s.productId === it.productId ? { ...s, quantity: s.quantity + 1 } : s));
                                      } else {
                                        setActiveSplitItems([...activeSplitItems, { productId: it.productId, quantity: 1 }]);
                                      }
                                    }}
                                    className="p-1 bg-brand-primary text-white hover:bg-brand-primary-hover rounded-lg disabled:opacity-50 transition cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Pago de Comensal details */}
                        <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                          <label className="text-[10px] text-slate-500 font-extrabold uppercase block font-mono">Registro de Pago:</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setSplitDinerPaymentMethod('EFECTIVO')}
                              className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition border cursor-pointer ${
                                splitDinerPaymentMethod === 'EFECTIVO'
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <span>💵</span> Efectivo
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitDinerPaymentMethod('TARJETA')}
                              className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition border cursor-pointer ${
                                splitDinerPaymentMethod === 'TARJETA'
                                  ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              <span>💳</span> Tarjeta
                            </button>
                          </div>

                          {splitDinerPaymentMethod === 'EFECTIVO' && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 font-extrabold">
                                <span>TOTAL COMENSAL:</span>
                                <span className="text-slate-700 text-xs font-bold">
                                  ${activeSplitItems.reduce((sum, item) => {
                                    const prod = activeOrderToSplit.items.find(i => i.productId === item.productId);
                                    return sum + (prod ? prod.price * item.quantity : 0);
                                  }, 0).toFixed(2)}
                                </span>
                              </div>
                              <label className="text-[10px] text-slate-400 font-extrabold uppercase font-mono block">Dinero recibido de este comensal:</label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-sm">$</span>
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="0.00"
                                  value={splitDinerReceivedAmount}
                                  onChange={(e) => setSplitDinerReceivedAmount(e.target.value)}
                                  className="w-full pl-7 pr-4 py-2 bg-white rounded-xl border border-slate-200 font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition font-sans"
                                />
                              </div>
                              
                              {(() => {
                                const currentTotal = activeSplitItems.reduce((sum, item) => {
                                  const prod = activeOrderToSplit.items.find(i => i.productId === item.productId);
                                  return sum + (prod ? prod.price * item.quantity : 0);
                                }, 0);
                                const parsedRec = parseFloat(splitDinerReceivedAmount);
                                if (!isNaN(parsedRec) && parsedRec >= currentTotal) {
                                  return (
                                    <div className="text-[10px] text-emerald-600 font-extrabold flex justify-between font-mono bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                                      <span>CAMBIO A ENTREGAR:</span>
                                      <span>${(parsedRec - currentTotal).toFixed(2)}</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleAddActiveSplitDiner}
                          className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                        >
                          + Agregar Comensal
                        </button>
                      </div>

                      {/* Right side Diner splits summaries */}
                      <div className="space-y-4 border-t md:border-t-0 md:border-l md:pl-6 border-slate-100 pt-4 md:pt-0">
                        <div className="flex justify-between items-center">
                          <h4 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">2. Cortes de Cuenta</h4>
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase font-mono">Total Comanda: ${activeOrderToSplit.total}</span>
                        </div>

                        {tempActiveSplitBills.length === 0 ? (
                          <div className="h-64 flex items-center justify-center text-center text-slate-400 font-bold text-xs border border-dashed border-slate-200 rounded-2xl p-4">
                            Aún no has asignado platillos a ningún comensal. Completa los datos a la izquierda para agregarlo.
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                            {tempActiveSplitBills.map((bill, index) => (
                              <div key={index} className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex justify-between items-start text-xs">
                                <div>
                                  <strong className="text-slate-800 block uppercase tracking-wide text-[11px]">{bill.customerName}</strong>
                                  <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                                    {bill.items.map((i, sIdx) => (
                                      <div key={sIdx} className="font-mono">{i.quantity}x {i.name} (${i.price})</div>
                                    ))}
                                  </div>
                                  <div className="mt-2 text-[10px] bg-white/80 p-2 rounded-xl border border-slate-200/60 space-y-0.5">
                                    <div className="font-sans text-slate-500 flex justify-between gap-2">
                                      <span>Método:</span> 
                                      <strong className="text-slate-700 font-bold uppercase">{bill.paymentMethod || 'EFECTIVO'}</strong>
                                    </div>
                                    {bill.paymentMethod !== 'TARJETA' ? (
                                      <>
                                        <div className="font-sans text-slate-500 flex justify-between gap-2">
                                          <span>Recibido:</span> 
                                          <strong className="text-emerald-600 font-mono">${(bill.receivedAmount ?? bill.total).toFixed(2)}</strong>
                                        </div>
                                        <div className="font-sans text-slate-500 flex justify-between gap-2">
                                          <span>Cambio:</span> 
                                          <strong className="text-blue-600 font-mono">${(bill.changeAmount ?? 0).toFixed(2)}</strong>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-blue-600 font-bold text-[9px] uppercase tracking-wide text-right mt-1">*** PAGADO CON TARJETA ***</div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-black text-brand-primary block text-sm font-mono">${bill.total}</span>
                                  <button
                                    onClick={() => setTempActiveSplitBills(tempActiveSplitBills.filter((_, iIdx) => iIdx !== index))}
                                    className="text-[10px] text-rose-500 font-bold hover:underline mt-1 cursor-pointer block"
                                    type="button"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 mt-6">
                      <button
                        onClick={() => {
                          setActiveOrderToSplit(null);
                          setTempActiveSplitBills([]);
                          setActiveSplitItems([]);
                          setActiveSplitName('');
                        }}
                        className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer"
                        type="button"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSendActiveSplitsToCashier}
                        disabled={tempActiveSplitBills.length === 0}
                        className="px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md"
                        type="button"
                      >
                        ✂ Enviar Cortes a Caja
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          ) : (
            // STANDARD / OWNER / CASHIER PORTAL VIEW
            <div className="space-y-8">
              {/* Sub-tabs Navigation for Cashier/Owner */}
              <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setCashierSubTab('monitor')}
                  className={`py-3 px-5 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 cursor-pointer transition whitespace-nowrap ${
                    cashierSubTab === 'monitor'
                      ? 'border-brand-primary text-brand-primary font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  📟 Monitor de Turno
                </button>
                <button
                  type="button"
                  onClick={() => setCashierSubTab('pagos_turno')}
                  className={`py-3 px-5 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 cursor-pointer transition whitespace-nowrap flex items-center gap-2 ${
                    cashierSubTab === 'pagos_turno'
                      ? 'border-brand-primary text-brand-primary font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  💵 Pagos Recibidos en Turno
                  {activeCashSession && (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                      {(activeCashSession.transactions || []).length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCashierSubTab('cortes')}
                  className={`py-3 px-6 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 cursor-pointer transition whitespace-nowrap ${
                    cashierSubTab === 'cortes'
                      ? 'border-brand-primary text-brand-primary font-black'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  📋 Últimos Cortes (3 días)
                </button>
              </div>

              {/* Cashier Alerts Notification Banner */}
              {cashierAlerts.length > 0 && (
                <div className="space-y-2.5 animate-fadeIn">
                  {cashierAlerts.map(alert => (
                    <div 
                      key={alert.id}
                      className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-lg border border-emerald-500/20 flex justify-between items-center gap-4 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-xl rounded-full -mr-5 -mt-5"></div>
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="bg-white/10 p-2.5 rounded-xl text-white">
                          <BellRing className="w-5 h-5 text-amber-300 animate-bounce" />
                        </div>
                        <div>
                          <p className="font-extrabold text-xs sm:text-sm">{alert.message}</p>
                          <span className="text-[10px] text-emerald-250 font-mono block mt-0.5">
                            Hace unos momentos • {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setCashierAlerts(prev => prev.filter(a => a.id !== alert.id))}
                        className="bg-white/20 hover:bg-white/30 text-white font-extrabold text-[10px] sm:text-xs py-1.5 px-3 rounded-lg transition cursor-pointer relative z-10 uppercase tracking-wide"
                      >
                        Entendido
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {cashierSubTab === 'monitor' ? (
                <>
                  {/* CASHIER MONITOR WIDGET: PENDING ACCOUNTS AND SPLITS */}
                  <div className="bg-indigo-950 text-white rounded-3xl p-6 border border-indigo-900 shadow-lg space-y-6">
                <div>
                  <h3 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
                    <Printer className="w-5 h-5 text-indigo-400" /> Monitor de Caja: Solicitudes de Cuentas y Cortes
                  </h3>
                  <p className="text-indigo-250 text-xs mt-1">
                    Aquí se listan las mesas que han solicitado su ticket de cuenta o cuyos meseros han configurado cortes (cuentas divididas) para cobrar.
                  </p>
                </div>

                {orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (o.billRequested || o.splitBillsRequested)).length === 0 ? (
                  <div className="text-center py-10 text-indigo-300 text-xs font-semibold border border-dashed border-indigo-800 rounded-2xl bg-indigo-950/40 font-sans">
                    No hay solicitudes de cuentas o cortes de mesas pendientes de pago en este momento.
                  </div>
                ) : (() => {
                  const pendingBillingOrders = orders.filter(
                    o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (o.billRequested || o.splitBillsRequested)
                  );

                  // Group pending bills by table name for Dine-In, leave non-dine-in as standalone
                  const billingGroups: { [groupKey: string]: { tableName: string; isDineIn: boolean; orders: Order[] } } = {};
                  pendingBillingOrders.forEach(order => {
                    if (order.deliveryType !== 'DINE_IN') {
                      billingGroups[`standalone_${order.id}`] = {
                        tableName: order.deliveryType === 'PICKUP' ? 'Para Llevar' : 'A Domicilio',
                        isDineIn: false,
                        orders: [order]
                      };
                    } else {
                      const table = order.tableName || 'Mesa';
                      if (!billingGroups[table]) {
                        billingGroups[table] = {
                          tableName: table,
                          isDineIn: true,
                          orders: []
                        };
                      }
                      billingGroups[table].orders.push(order);
                    }
                  });

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(billingGroups).map(([groupKey, group]) => {
                        const tableOrders = group.orders;
                        const tableName = group.tableName;
                        const isDineIn = group.isDineIn;

                        // Consolidate values
                        const total = tableOrders.reduce((sum, o) => sum + o.total, 0);
                        const customerNames = Array.from(new Set(tableOrders.map(o => o.customerName).filter(Boolean))).join(', ') || 'Cliente';
                        const waiterName = Array.from(new Set(tableOrders.map(o => o.waiterName).filter(Boolean))).join(', ');

                        // Consolidated items
                        const combinedItems: OrderItem[] = [];
                        tableOrders.forEach(o => {
                          o.items.forEach(it => {
                            const existing = combinedItems.find(x => x.productId === it.productId);
                            if (existing) {
                              existing.quantity += it.quantity;
                            } else {
                              combinedItems.push({ ...it });
                            }
                          });
                        });

                        // Check splits
                        // Split bills are stored in the order that has splitBills
                        const primarySplitOrder = tableOrders.find(o => o.splitBillsRequested && o.splitBills);
                        const splitBills = primarySplitOrder?.splitBills;
                        const splitBillsRequested = !!primarySplitOrder;

                        return (
                          <div key={groupKey} className="bg-slate-900 rounded-2xl border border-indigo-800/40 p-5 flex flex-col justify-between h-full">
                            <div>
                              <div className="flex justify-between items-start gap-2 mb-3">
                                <div>
                                  <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    {tableName}
                                  </span>
                                  <h4 className="font-bold text-slate-200 text-sm mt-1.5">{customerNames}</h4>
                                </div>
                                <div className="text-right">
                                  <span className="text-brand-primary font-black text-base block font-mono">${total}</span>
                                  {waiterName && (
                                    <span className="text-[9px] text-slate-400 font-bold block uppercase mt-0.5">Mesero: {waiterName}</span>
                                  )}
                                </div>
                              </div>

                              {/* STANDARD BILL (NOT SPLIT) */}
                              {!splitBillsRequested && (
                                <div className="space-y-3 pt-3 border-t border-slate-800 my-3">
                                  <div className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest flex items-center gap-1 font-mono">
                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse"></span> Solicitud de Cuenta Completa
                                  </div>
                                  <div className="space-y-1 max-h-[120px] overflow-y-auto font-sans">
                                    {combinedItems.map((it, idx) => (
                                      <div key={idx} className="flex justify-between text-xs text-slate-400 font-medium font-mono">
                                        <span>{it.quantity}x {it.name}</span>
                                        <span>${it.price * it.quantity}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="pt-2.5 space-y-2 border-t border-slate-800">
                                    <button
                                      onClick={() => {
                                        // Print simulated ticket
                                        const mockOrder: Order = {
                                          id: tableOrders[0].id,
                                          restaurantId: tableOrders[0].restaurantId,
                                          restaurantName: tableOrders[0].restaurantName,
                                          customerName: customerNames,
                                          customerPhone: tableOrders[0].customerPhone,
                                          deliveryType: isDineIn ? 'DINE_IN' : 'PICKUP',
                                          tableName: tableName,
                                          status: 'SERVED',
                                          items: combinedItems,
                                          subtotal: combinedItems.reduce((s, x) => s + x.price * x.quantity, 0),
                                          deliveryFee: 0,
                                          total: total,
                                          paymentMethod: 'CASH_ON_TABLE',
                                          createdAt: tableOrders[0].createdAt,
                                          updatedAt: Date.now(),
                                          waiterName: waiterName
                                        };
                                        handlePrintBill(mockOrder);
                                      }}
                                      className="w-full bg-slate-850 hover:bg-slate-800 text-slate-300 font-extrabold py-2 px-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider border border-slate-700/30"
                                      type="button"
                                    >
                                      <Printer className="w-4 h-4" /> Imprimir Ticket de Cuenta
                                    </button>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        onClick={() => handleRegisterGroupPayment(tableOrders, tableName, total, 'EFECTIVO')}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                        type="button"
                                      >
                                        💵 Cobrar Efectivo
                                      </button>
                                      <button
                                        onClick={() => handleRegisterGroupPayment(tableOrders, tableName, total, 'TARJETA')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                        type="button"
                                      >
                                        💳 Cobrar Tarjeta
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* SPLIT BILLS REQUEST */}
                              {splitBillsRequested && splitBills && (
                                <div className="space-y-3 pt-3 border-t border-slate-800 my-3 font-sans">
                                  <div className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest flex items-center gap-1 font-mono">
                                    <Scissors className="w-3.5 h-3.5" /> Solicitud de Cortes (Cuentas Divididas)
                                  </div>
                                  <div className="space-y-2.5">
                                    {splitBills.map((bill, index) => (
                                      <div key={index} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                                        <div>
                                          <strong className="text-slate-300 block uppercase tracking-wide text-[10px]">{bill.customerName}</strong>
                                          <span className="text-[10px] text-slate-500 block font-mono font-medium">Subtotal: ${bill.total}</span>
                                          {bill.paymentMethod && (
                                            <div className="text-[9px] text-slate-400 font-medium mt-1">
                                              <span>Método: <strong>{bill.paymentMethod}</strong></span>
                                              {bill.paymentMethod === 'EFECTIVO' ? (
                                                <span className="ml-2">Recibido: <strong className="text-emerald-500 font-mono">${(bill.receivedAmount ?? bill.total).toFixed(2)}</strong> (Cambio: <strong className="text-blue-500 font-mono">${(bill.changeAmount ?? 0).toFixed(2)}</strong>)</span>
                                              ) : (
                                                <span className="ml-2 text-blue-400 font-bold">PAGADO CON TARJETA</span>
                                              )}
                                            </div>
                                          )}
                                          <div className="mt-1 flex gap-2">
                                            <button
                                              onClick={() => handlePrintSplitBill(primarySplitOrder, index)}
                                              className="text-[10px] text-indigo-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer font-sans"
                                              type="button"
                                            >
                                              <Printer className="w-3 h-3" /> Ticket
                                            </button>
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          {bill.paid ? (
                                            <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 font-sans">
                                              <Check className="w-3 h-3" /> Cobrado
                                            </span>
                                          ) : (
                                            <div className="flex flex-col gap-1.5">
                                              <button
                                                onClick={() => handlePaySplitDiner(primarySplitOrder, index, bill.paymentMethod || 'EFECTIVO')}
                                                className={`text-white font-extrabold py-1.5 px-3 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider font-sans shadow-sm ${
                                                  bill.paymentMethod === 'TARJETA'
                                                    ? 'bg-blue-600 hover:bg-blue-700'
                                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                                }`}
                                                type="button"
                                              >
                                                {bill.paymentMethod === 'TARJETA' ? '💳 Reg. Tarjeta' : '💵 Reg. Efectivo'}
                                              </button>
                                              
                                              <div className="flex gap-1 justify-end mt-0.5">
                                                <button
                                                  onClick={() => handlePaySplitDiner(primarySplitOrder, index, 'EFECTIVO')}
                                                  className="text-slate-400 hover:text-emerald-500 font-extrabold py-0.5 px-1 rounded text-[8px] uppercase tracking-wider font-sans border border-slate-700/40 hover:border-emerald-500/40 cursor-pointer"
                                                  type="button"
                                                  title="Cambiar a Efectivo"
                                                >
                                                  💵 Efec
                                                </button>
                                                <button
                                                  onClick={() => handlePaySplitDiner(primarySplitOrder, index, 'TARJETA')}
                                                  className="text-slate-400 hover:text-blue-500 font-extrabold py-0.5 px-1 rounded text-[8px] uppercase tracking-wider font-sans border border-slate-700/40 hover:border-blue-500/40 cursor-pointer"
                                                  type="button"
                                                  title="Cambiar a Tarjeta"
                                                >
                                                  💳 Tarj
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="pt-2">
                                    <button
                                      onClick={async () => {
                                        try {
                                          const allActiveTableOrders = orders.filter(
                                            o => o.tableName === tableName &&
                                                 o.status !== 'DELIVERED' &&
                                                 o.status !== 'CANCELLED' &&
                                                 o.deliveryType === 'DINE_IN'
                                          );
                                          const ordersToUpdate = allActiveTableOrders.length > 0 ? allActiveTableOrders : tableOrders;
                                          for (const o of ordersToUpdate) {
                                            await updateDoc(doc(db, 'orders', o.id), {
                                              status: 'DELIVERED',
                                              splitBillsRequested: false,
                                              billRequested: false,
                                              customerBillRequestedFromWaiter: false,
                                              updatedAt: Date.now()
                                            });
                                          }
                                          alert(`Cuenta de ${tableName} finalizada, mesa liberada y comanda limpia.`);
                                        } catch (err) {
                                          console.error('Error finalizing split order:', err);
                                        }
                                      }}
                                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider font-sans"
                                      type="button"
                                    >
                                      ✅ Finalizar Mesa y Liberar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Otras Mesas Activas en Servicio (Sin Solicitud de Cuenta de Caja) */}
                {(() => {
                  const activeTablesWithoutBillRequest = Array.from(new Set(
                    orders
                      .filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.deliveryType === 'DINE_IN' && !o.billRequested && !o.splitBillsRequested)
                      .map(o => o.tableName)
                  )).filter(Boolean) as string[];

                  if (activeTablesWithoutBillRequest.length > 0) {
                    return (
                      <div className="mt-8 pt-6 border-t border-indigo-900/60 animate-fadeIn">
                        <h4 className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider mb-4 flex items-center gap-2 font-mono">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Otras Mesas Activas en Servicio (Sin Solicitud de Cuenta)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 font-sans">
                          {activeTablesWithoutBillRequest.map(tableName => {
                            const tableOrders = orders.filter(
                              o => o.tableName === tableName &&
                                   o.status !== 'DELIVERED' &&
                                   o.status !== 'CANCELLED' &&
                                   o.deliveryType === 'DINE_IN'
                            );
                            const totalConsumed = tableOrders.reduce((sum, o) => sum + o.total, 0);
                            const waiterNames = Array.from(new Set(tableOrders.map(o => o.waiterName).filter(Boolean))).join(', ') || 'Sin mesero';
                            const itemsCount = tableOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);

                            return (
                              <div key={tableName} className="bg-indigo-950/40 border border-indigo-900/60 p-4 rounded-2xl flex flex-col justify-between gap-3 text-xs hover:border-indigo-500/40 transition">
                                <div>
                                  <div className="flex justify-between items-start">
                                    <span className="bg-indigo-900/80 text-indigo-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                      {tableName}
                                    </span>
                                    <span className="font-mono text-sm font-black text-indigo-200">${totalConsumed}</span>
                                  </div>
                                  <div className="mt-2 space-y-1 text-[11px] text-indigo-300/80">
                                    <p className="font-medium">Mesero: <strong className="text-indigo-200">{waiterNames}</strong></p>
                                    <p className="font-mono font-bold">Consumo: {itemsCount} platillos</p>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1.5 pt-2 border-t border-indigo-900/30">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      onClick={() => handleRegisterGroupPayment(tableOrders, tableName, totalConsumed, 'EFECTIVO')}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1.5 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider font-sans"
                                      type="button"
                                    >
                                      💵 Cobrar Efec
                                    </button>
                                    <button
                                      onClick={() => handleRegisterGroupPayment(tableOrders, tableName, totalConsumed, 'TARJETA')}
                                      className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-1.5 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider font-sans"
                                      type="button"
                                    >
                                      💳 Cobrar Tarj
                                    </button>
                                  </div>
                                  {!(loggedInEmployee?.role === 'mesero' || loggedInEmployee?.role === 'cajero') && (
                                    <button
                                      onClick={async () => {
                                        if (confirm(`¿Está seguro de liberar la ${tableName} y LIMPIAR por completo la comanda? Esto marcará todos los pedidos activos como cobrados/entregados en la base de datos.`)) {
                                          try {
                                            for (const o of tableOrders) {
                                              await updateDoc(doc(db, 'orders', o.id), {
                                                status: 'DELIVERED',
                                                billRequested: false,
                                                customerBillRequestedFromWaiter: false,
                                                splitBillsRequested: false,
                                                updatedAt: Date.now()
                                              });
                                            }
                                            alert(`La ${tableName} ha sido liberada y limpiada correctamente.`);
                                          } catch (err) {
                                            console.error("Error clearing table orders:", err);
                                            alert("Error al limpiar la mesa.");
                                          }
                                        }
                                      }}
                                      className="w-full bg-indigo-900/40 hover:bg-rose-600 text-indigo-300 hover:text-white font-extrabold py-1.5 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider font-sans"
                                      type="button"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Liberar Mesa / Limpiar
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* 🛍️ WIDGET: PEDIDOS PARA LLEVAR PENDIENTES DE ENTREGA */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-lg space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-amber-500 animate-pulse" /> Pedidos para Llevar Pendientes de Entrega
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">
                      Monitorea la preparación de pedidos para llevar, cobra por adelantado y entrégalos una vez pagados.
                    </p>
                  </div>
                  <span className="bg-amber-500/15 text-amber-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                    {orders.filter(o => o.deliveryType === 'PICKUP' && o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length} activos
                  </span>
                </div>

                {orders.filter(o => o.deliveryType === 'PICKUP' && o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs font-semibold border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                    No hay pedidos para llevar pendientes de entrega en este momento.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {orders
                      .filter(o => o.deliveryType === 'PICKUP' && o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((order) => {
                        const isReady = order.status === 'READY';
                        const isPaid = order.cashierPaid === true;

                        return (
                          <div 
                            key={order.id} 
                            className={`p-5 rounded-2xl border transition duration-200 flex flex-col justify-between space-y-4 h-full ${
                              isReady 
                                ? 'bg-emerald-950/20 border-emerald-500/50 shadow-emerald-500/5 ring-1 ring-emerald-500/30' 
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="space-y-3">
                              {/* Encabezado del Pedido */}
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="bg-slate-800 text-slate-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Pedido #{order.id.slice(0, 5)}
                                  </span>
                                  <h4 className="font-extrabold text-white text-sm mt-1.5 flex items-center gap-1.5">
                                    👤 {order.customerName || 'Cliente para llevar'}
                                  </h4>
                                  {order.customerPhone && order.customerPhone !== '5500000000' && (
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">📞 {order.customerPhone}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="text-amber-400 font-black text-sm block font-mono">${order.total}</span>
                                  <span className="text-[9px] text-slate-500 font-bold block uppercase mt-0.5">
                                    ⏱ {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>

                              {/* Artículos de la Orden */}
                              <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800/40 text-xs space-y-1 max-h-[100px] overflow-y-auto">
                                {order.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between text-slate-300 font-mono text-[11px]">
                                    <span>{it.quantity}x {it.name}</span>
                                    <span className="text-slate-500">${it.price * it.quantity}</span>
                                  </div>
                                ))}
                                {order.notes && (
                                  <p className="text-[10px] text-orange-400 italic mt-1 border-t border-slate-800/60 pt-1">
                                    Nota: {order.notes}
                                  </p>
                                )}
                              </div>

                              {/* Estado en Cocina / Preparación (3 estados para llevar: Recibido, Cocinando, Listo) */}
                              <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estado del pedido:</span>
                                  {isReady ? (
                                    <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                      <CheckCircle className="w-3.5 h-3.5 animate-bounce" /> 🛍️ LISTO PARA RECOGER
                                    </span>
                                  ) : order.status === 'PREPARING' ? (
                                    <span className="bg-orange-500/15 text-orange-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                      <ChefHat className="w-3.5 h-3.5" /> 🍳 COCINANDO
                                    </span>
                                  ) : (
                                    <span className="bg-amber-500/15 text-amber-400 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                      📥 RECIBIDO
                                    </span>
                                  )}
                                </div>

                                {/* Botones para cambiar el estado de preparación para llevar */}
                                {!isReady && (
                                  <div className="flex gap-2">
                                    {order.status !== 'PREPARING' && (
                                      <button
                                        type="button"
                                        onClick={() => handleKitchenStatusChange(order.id, 'PREPARING')}
                                        className="flex-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 font-bold py-1.5 px-2 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                      >
                                        🍳 Cocinando
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleKitchenStatusChange(order.id, 'READY')}
                                      className="flex-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 font-bold py-1.5 px-2 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                    >
                                      🛍️ Marcar como Listo
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Acciones de Pago y Entrega */}
                            <div className="pt-3 border-t border-slate-800 space-y-2">
                              {isPaid ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-900/40 px-3 py-2 rounded-xl text-xs">
                                    <span className="text-emerald-400 font-bold uppercase text-[9px] tracking-wider">Estado de cuenta:</span>
                                    <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                      🟢 PAGADO
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() => handlePrintBill(order)}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-2 rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-2xs"
                                      type="button"
                                    >
                                      <Printer className="w-3.5 h-3.5" /> Imprimir Ticket
                                    </button>
                                    <button
                                      onClick={() => handleDeliverPickupOrder(order)}
                                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2.5 px-2 rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-2xs"
                                      type="button"
                                    >
                                      🛍️ Entregar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between bg-rose-950/30 border border-rose-900/30 px-3 py-2 rounded-xl text-xs">
                                    <span className="text-rose-400 font-bold uppercase text-[9px] tracking-wider">Estado de cuenta:</span>
                                    <span className="bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                      🔴 POR COBRAR
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() => handleRegisterPickupPayment(order, 'EFECTIVO')}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 px-3 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                      type="button"
                                    >
                                      💵 Cobrar Efectivo
                                    </button>
                                    <button
                                      onClick={() => handleRegisterPickupPayment(order, 'TARJETA')}
                                      className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 px-3 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                      type="button"
                                    >
                                      💳 Cobrar Tarjeta
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* MONITOR DE REPARTIDORES Y LIQUIDACIÓN */}
              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-lg space-y-6">
                <div>
                  <h3 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
                    <Truck className="w-5 h-5 text-orange-400" /> Control y Liquidación de Repartidores
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Supervisa las entregas activas de los repartidores y cobra el dinero en efectivo de los pedidos ya entregados para liberar su cuenta.
                  </p>
                </div>

                {(() => {
                  const driversMap: {
                    [driverId: string]: {
                      driverName: string;
                      driverPhone?: string;
                      active: Order[];
                      unpaid: Order[];
                    };
                  } = {};

                  orders.forEach(order => {
                    if (order.deliveryType === 'DELIVERY' && order.driverId) {
                      const dId = order.driverId;
                      if (!driversMap[dId]) {
                        driversMap[dId] = {
                          driverName: order.driverName || 'Repartidor',
                          driverPhone: order.driverPhone,
                          active: [],
                          unpaid: []
                        };
                      } else if (!driversMap[dId].driverPhone && order.driverPhone) {
                        driversMap[dId].driverPhone = order.driverPhone;
                      }
                      if (['ASSIGNED', 'SHIPPED'].includes(order.status)) {
                        driversMap[dId].active.push(order);
                      } else if (order.status === 'DELIVERED' && order.cashierPaid !== true) {
                        driversMap[dId].unpaid.push(order);
                      }
                    }
                  });

                  const driverList = Object.entries(driversMap).filter(
                    ([_, data]) => data.active.length > 0 || data.unpaid.length > 0
                  );

                  if (driverList.length === 0) {
                    return (
                      <div className="text-center py-10 text-slate-400 text-xs font-semibold border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 font-sans">
                        No hay repartidores con entregas activas o cuentas pendientes de pago en este momento.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                      {driverList.map(([driverId, data]) => {
                        const getDriverPaymentRate = (order: Order) => order.driverPaymentRate ?? selectedRest?.driverPayment ?? 10;
                        const totalDebt = data.unpaid.reduce((sum, o) => sum + o.total, 0);
                        const totalDriverPay = data.unpaid.reduce((sum, o) => sum + getDriverPaymentRate(o), 0);
                        const netSettleAmount = data.unpaid.reduce((sum, o) => sum + Math.max(0, o.total - getDriverPaymentRate(o)), 0);
                        
                        const unpaidActive = data.active.filter(o => o.cashierPaid !== true);
                        const totalUnpaidCount = unpaidActive.length + data.unpaid.length;
                        const isBlocked = totalUnpaidCount >= 3;

                        return (
                          <div 
                            key={driverId} 
                            className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition ${
                              isBlocked 
                                ? 'bg-rose-950/30 border-rose-900/50' 
                                : totalUnpaidCount > 0
                                ? 'bg-amber-950/25 border-amber-900/40'
                                : 'bg-slate-950/40 border-slate-800'
                            }`}
                          >
                            <div className="space-y-3">
                              {/* Driver Title and Status */}
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
                                    👤 {data.driverName}
                                  </h4>
                                  {data.driverPhone && (
                                    <a 
                                      href={`tel:${data.driverPhone}`}
                                      className="inline-flex items-center gap-1 text-xs text-amber-400 font-extrabold hover:underline mt-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-mono"
                                    >
                                      <Phone className="w-3 h-3 text-amber-400" /> {data.driverPhone}
                                    </a>
                                  )}
                                  <span className="text-[10px] text-slate-500 block font-mono mt-0.5">ID: {driverId.slice(0, 8).toUpperCase()}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {data.active.length > 0 && (
                                    <span className="bg-orange-500/15 text-orange-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                      En Ruta ({data.active.length})
                                    </span>
                                  )}
                                  {isBlocked ? (
                                    <span className="bg-rose-500 text-white animate-pulse font-extrabold px-2 py-1 text-[9px] rounded uppercase tracking-wider">
                                      Bloqueado (3/3 Sin Pagar)
                                    </span>
                                  ) : totalUnpaidCount > 0 ? (
                                    <span className="bg-amber-500/25 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                      Carga: {totalUnpaidCount}/3 sin pagar
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-500/15 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                      Al corriente
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Active Deliveries List */}
                              {data.active.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider block">Entregas Activas (En camino)</span>
                                  <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-[11px]">
                                    {data.active.map(o => {
                                      const driverRate = getDriverPaymentRate(o);
                                      const netToCashier = Math.max(0, o.total - driverRate);

                                      return (
                                        <div key={o.id} className="space-y-2 pb-2 last:pb-0 border-b border-slate-800/45 last:border-0">
                                          <div className="flex justify-between items-start text-slate-300">
                                            <div>
                                              <span className="font-bold">#{o.id.slice(0, 5).toUpperCase()} - {o.customerName}</span>
                                              {o.driverPhone && (
                                                <p className="text-[10px] text-orange-400 font-bold flex items-center gap-1 mt-0.5 font-mono">
                                                  <Phone className="w-2.5 h-2.5" /> Tel Repartidor: <a href={`tel:${o.driverPhone}`} className="underline">{o.driverPhone}</a>
                                                </p>
                                              )}
                                            </div>
                                            <div className="text-right">
                                              <span className="font-bold text-orange-400 uppercase text-[9px] block">
                                                {o.status === 'SHIPPED' ? 'En ruta' : 'Asignado'}
                                              </span>
                                              {o.cashierPaid ? (
                                                <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider block mt-0.5 font-mono">
                                                  ✅ Pagado Adelantado
                                                </span>
                                              ) : (
                                                <span className="bg-amber-500/20 text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-wider block mt-0.5 font-mono">
                                                  ⏳ Pendiente Pago Caja
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          {/* Dishes list */}
                                          <div className="pl-2 border-l border-orange-500/40 space-y-0.5 text-slate-400 text-[10px]">
                                            {o.items.map((it, idx) => (
                                              <div key={idx} className="flex justify-between">
                                                <span>{it.quantity}x {it.name}</span>
                                                <span>${it.price * it.quantity}</span>
                                              </div>
                                            ))}
                                          </div>

                                          {/* Upfront payment action / status for cashier */}
                                          <div className="flex justify-between items-center pt-1 gap-2">
                                            {!o.cashierPaid && (
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  if (!activeCashSession) {
                                                    alert('⚠️ Error de Caja: La caja está cerrada. Debe abrir la caja antes de registrar cobros.');
                                                    return;
                                                  }
                                                  if (window.confirm(`¿Registrar COBRO POR ADELANTADO de $${netToCashier} (Total: $${o.total} - Ganancia Repartidor: $${driverRate}) al repartidor ${data.driverName} para el pedido #${o.id.slice(0, 5)}?\n\nEsto liberará 1 espacio en su capacidad de carga de 3 pedidos.`)) {
                                                    try {
                                                      await updateDoc(doc(db, 'orders', o.id), {
                                                        cashierPaid: true,
                                                        cashierPaidAt: Date.now(),
                                                        paidUpfront: true
                                                      });
                                                      const sessionRef = doc(db, 'cashSessions', activeCashSession.id);
                                                      const updatedTrans = [
                                                        ...activeCashSession.transactions,
                                                        {
                                                          type: 'IN' as const,
                                                          amount: netToCashier,
                                                          reason: `Cobro Adelantado Repartidor (${data.driverName}) - Pedido #${o.id.slice(0, 5)} (Total: $${o.total} - Ganancia: $${driverRate})`,
                                                          timestamp: Date.now(),
                                                          paymentMethod: 'EFECTIVO'
                                                        }
                                                      ];
                                                      await updateDoc(sessionRef, { transactions: updatedTrans });
                                                      alert(`¡Cobro por adelantado de $${netToCashier} registrado con éxito! Se liberó 1 espacio de carga para ${data.driverName}.`);
                                                    } catch (err) {
                                                      console.error('Error charging upfront driver payment:', err);
                                                      alert('Error al registrar cobro por adelantado.');
                                                    }
                                                  }
                                                }}
                                                className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 uppercase tracking-wider"
                                              >
                                                💵 Cobrar por Adelantado (${netToCashier})
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => handleUnassignDriver(o)}
                                              className="bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 border border-rose-500/40 text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 uppercase tracking-wider shadow-xs ml-auto"
                                            >
                                              <UserMinus className="w-3 h-3 text-rose-400" /> Quitar asignación
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Unpaid Deliveries List */}
                              {data.unpaid.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[9px] font-extrabold uppercase text-amber-500 tracking-wider block">Pedidos Entregados a Liquidar</span>
                                  <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs">
                                    {data.unpaid.map(o => (
                                      <div key={o.id} className="flex flex-col text-slate-300 border-b border-slate-800/40 pb-2 last:border-0 last:pb-0 space-y-1">
                                        <div className="flex justify-between items-center">
                                          <div>
                                            <span className="font-bold">#{o.id.slice(0, 5).toUpperCase()}</span> - <span className="text-[11px] text-slate-400">{o.customerName}</span>
                                            <span className="block text-[10px] text-slate-500 font-mono">Total pedido: ${o.total}</span>
                                          </div>
                                          <span className="font-mono font-black text-slate-100">${o.total}</span>
                                        </div>
                                        {/* Dishes list */}
                                        <div className="pl-2 border-l border-emerald-500/40 space-y-0.5 text-slate-400 text-[10px] ml-1">
                                          {o.items.map((it, idx) => (
                                            <div key={idx} className="flex justify-between">
                                              <span>{it.quantity}x {it.name}</span>
                                              <span>${it.price * it.quantity}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                    <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                                      <div className="flex justify-between items-center text-slate-400">
                                        <span>Total recaudado por repartidor:</span>
                                        <span className="font-semibold font-mono text-slate-300">${totalDebt}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-rose-400">
                                        <span>Pago retenido por Repartidor:</span>
                                        <span className="font-semibold font-mono">-${totalDriverPay}</span>
                                      </div>
                                      <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-800 text-sm">
                                        <span className="font-bold text-slate-200">Monto Neto a Recibir:</span>
                                        <span className="font-black text-emerald-400 font-mono">${netSettleAmount}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Payment action button */}
                            {data.unpaid.length > 0 && (
                              (() => {
                                const handleSettleDriver = async (paymentMethod: 'EFECTIVO' | 'TARJETA') => {
                                  if (!activeCashSession) {
                                    alert('⚠️ Error de Caja: La caja está cerrada. Debe abrir el turno de caja en el panel de control antes de realizar cobros o liquidar adeudos.');
                                    return;
                                  }
                                  try {
                                    if (window.confirm(`¿Confirmar liquidación de $${netSettleAmount} (Bruto: $${totalDebt} - Pago Repartidor: $${totalDriverPay}) en ${paymentMethod} al repartidor ${data.driverName}? Esto liberará sus entregas.`)) {
                                      // 1. Mark orders as cashierPaid
                                      for (const order of data.unpaid) {
                                        await updateDoc(doc(db, 'orders', order.id), {
                                          cashierPaid: true,
                                          cashierPaidAt: Date.now()
                                        });
                                      }

                                      // 2. Add cash session transaction
                                      const sessionRef = doc(db, 'cashSessions', activeCashSession.id);
                                      const updatedTrans = [
                                        ...activeCashSession.transactions,
                                        {
                                          type: 'IN' as const,
                                          amount: netSettleAmount,
                                          reason: `Liquidación de Repartidor: ${data.driverName} (${data.unpaid.length} pedidos) (Total: $${totalDebt} - Pago Repartidor: $${totalDriverPay}) (${paymentMethod})`,
                                          timestamp: Date.now(),
                                          paymentMethod: paymentMethod
                                        }
                                      ];
                                      await updateDoc(sessionRef, { transactions: updatedTrans });

                                      alert(`Liquidación procesada con éxito para ${data.driverName}. ¡Monto neto de $${netSettleAmount} cobrado con ${paymentMethod}!`);
                                    }
                                  } catch (err) {
                                    console.error('Error settling driver deliveries:', err);
                                    alert('Hubo un error al liquidar el adeudo del repartidor.');
                                  }
                                };

                                return (
                                  <div className="grid grid-cols-2 gap-2 w-full">
                                    <button
                                      onClick={() => handleSettleDriver('EFECTIVO')}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 px-3 rounded-xl text-[10px] sm:text-xs transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                      type="button"
                                    >
                                      💵 Liqui. Efectivo
                                    </button>
                                    <button
                                      onClick={() => handleSettleDriver('TARJETA')}
                                      className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 px-3 rounded-xl text-[10px] sm:text-xs transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                      type="button"
                                    >
                                      💳 Liqui. Tarjeta
                                    </button>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Notification settings banner */}
              <div className="bg-slate-950 text-white rounded-3xl p-6 border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-3xl rounded-full -mr-10 -mt-10"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`p-4 rounded-2xl shrink-0 ${notificationPermission === 'granted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                    {notificationPermission === 'granted' ? (
                      <BellRing className="w-8 h-8 animate-bounce" />
                    ) : (
                      <BellOff className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight uppercase">Notificaciones de Pedidos en Tiempo Real</h3>
                    <p className="text-slate-400 text-xs mt-1 max-w-xl leading-relaxed">
                      {notificationPermission === 'granted' ? (
                        '¡Excelente! Recibirás alertas sonoras y notificaciones emergentes cada vez que entre un nuevo pedido de tus clientes.'
                      ) : notificationPermission === 'denied' ? (
                        <span className="text-rose-400 font-bold">Has bloqueado las notificaciones. Por favor, habilítalas en el candado junto a la URL de tu navegador para poder recibir alertas de pedidos.</span>
                      ) : (
                        'Activa las notificaciones del navegador para escuchar un sonido y ver una ventana emergente instantánea en tu pantalla cada vez que un cliente realice un pedido.'
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-[11px] font-bold uppercase tracking-wider">
                      <span className="text-slate-400">Estado actual:</span>
                      {notificationPermission === 'granted' ? (
                        <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Activo
                        </span>
                      ) : notificationPermission === 'denied' ? (
                        <span className="bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span> Bloqueado
                        </span>
                      ) : (
                        <span className="bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> Desactivado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 relative z-10 w-full md:w-auto">
                  {notificationPermission !== 'granted' && (
                    <button
                      onClick={requestNotificationPermission}
                      className="flex-1 md:flex-none px-5 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-black rounded-2xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                      type="button"
                    >
                      <Bell className="w-4 h-4" /> Solicitar Permiso
                    </button>
                  )}
                  <button
                    onClick={() => {
                      try {
                        playNewOrderChime();
                      } catch (e) {}
                      if (notificationPermission === 'granted') {
                        try {
                          new Notification("🔔 ¡Mesa 22 - Prueba Correcta!", {
                            body: "¡Hola! Las notificaciones para tus nuevos pedidos funcionan perfectamente.",
                            icon: selectedRest?.logo || '/favicon.ico'
                          });
                        } catch (notifErr) {
                          console.error("Error creating Notification:", notifErr);
                          alert("🔔 Sonido de prueba reproducido. La notificación de escritorio no se pudo mostrar en este entorno.");
                        }
                      } else {
                        alert("🔔 Sonido de prueba reproducido. Activa los permisos de notificaciones para ver la ventana emergente.");
                      }
                    }}
                    className="flex-1 md:flex-none px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-black rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider"
                    type="button"
                  >
                    <RefreshCw className="w-4 h-4" /> Probar Alerta
                  </button>
                </div>
              </div>

              {/* Daily highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Ventas del Día</span>
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl md:text-3xl font-black text-slate-800 font-mono">
                      ${orders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + o.total, 0)}
                    </span>
                    <span className="text-emerald-500 text-xs font-bold block mt-1 font-sans">
                      {orders.filter(o => o.status === 'DELIVERED').length} pedidos completados
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Pedidos en Cocina</span>
                    <ChefHat className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl md:text-3xl font-black text-slate-800 font-mono">
                      {orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PREPARING').length}
                    </span>
                    <span className="text-amber-500 text-xs font-bold block mt-1 font-sans">En preparación</span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Productos en Menú</span>
                    <ShoppingBag className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl md:text-3xl font-black text-slate-800 font-mono">{products.length}</span>
                    <span className="text-gray-400 text-xs block mt-1 font-sans">Platillos habilitados</span>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm">
                  <div className="flex justify-between items-center text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Insumos Críticos</span>
                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                  </div>
                  <div className="mt-4">
                    <span className="text-2xl md:text-3xl font-black text-slate-800 font-mono">{criticalStockList.length}</span>
                    {criticalStockList.length > 0 ? (
                      <span className="text-rose-500 text-xs font-bold block mt-1 font-sans">Alerta: ¡Stock bajo!</span>
                    ) : (
                      <span className="text-emerald-500 text-xs font-bold block mt-1 font-sans">Inventario saludable</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Critical stock details */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6">
                  <h3 className="font-extrabold text-slate-800 text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-500" /> Inventario Crítico (Bajo Stock)
                  </h3>
                  
                  {criticalStockList.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm font-semibold font-sans">
                      No hay insumos por debajo del stock mínimo. ¡Todo al corriente!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {criticalStockList.map((ing) => (
                        <div key={ing.id} className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/50 flex justify-between items-center text-xs">
                          <div>
                            <h4 className="font-bold text-slate-800">{ing.name}</h4>
                            <span className="text-xs text-rose-600 font-semibold font-sans">Min: {ing.minStock} {ing.unit}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-black text-rose-600 block font-mono">{ing.stock} {ing.unit}</span>
                            <span className="text-[10px] text-rose-500 font-bold block font-sans">Reordenar de inmediato</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active kitchen alerts */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6">
                  <h3 className="font-extrabold text-slate-800 text-lg mb-4 flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-brand-primary" /> Pedidos Recientes en Cocina
                  </h3>
                  
                  {orders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)).length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-sm font-semibold font-sans">
                      No hay pedidos pendientes en cocina en este momento.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)).slice(0, 4).map((o) => (
                        <div key={o.id} className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-mono text-xs text-slate-400 block font-bold">#{o.id.slice(0, 5)} - {o.customerName}</span>
                            <span className="text-slate-800 font-bold text-sm block">{o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</span>
                          </div>
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded uppercase font-mono">
                            {o.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : cashierSubTab === 'pagos_turno' ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6 animate-fadeIn">
              {/* Header & Shift Info */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight uppercase text-slate-800 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-600" /> Listado de Pagos Recibidos en el Turno
                    </h3>
                    {activeCashSession ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 uppercase tracking-wide font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                        Turno Activo
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide font-mono">
                        Caja Cerrada
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-1 font-sans">
                    {activeCashSession 
                      ? `Cajera(o): ${activeCashSession.openedBy || loggedInEmployee?.name || 'Caja'} • Apertura: ${new Date(activeCashSession.openedAt).toLocaleString()}` 
                      : 'Abre el turno de caja en el botón superior para comenzar a registrar e inspeccionar cobros.'}
                  </p>
                </div>

                {activeCashSession && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCashTxType('IN');
                        setCashActionAmount('');
                        setCashActionReason('');
                        setShowCashTxModal(true);
                      }}
                      className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <PlusCircle className="w-4 h-4" /> Ingreso Extra
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCashTxType('OUT');
                        setCashActionAmount('');
                        setCashActionReason('');
                        setShowCashTxModal(true);
                      }}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <MinusCircle className="w-4 h-4" /> Retiro / Egreso
                    </button>
                  </div>
                )}
              </div>

              {/* Real-time Shift Metric Cards */}
              {activeCashSession ? (() => {
                const { salesCash, salesCard, calculatedFinal, totalSales } = getSessionTotals(activeCashSession);
                const inCount = (activeCashSession.transactions || []).filter(t => t.type === 'IN').length;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-4">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block font-mono">💵 Cobrado en Efectivo</span>
                      <span className="text-2xl font-black text-emerald-800 font-mono mt-0.5 block">${salesCash.toFixed(2)}</span>
                      <span className="text-[10px] text-emerald-600 mt-1 block font-sans">Efectivo físico recibido</span>
                    </div>

                    <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-4">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block font-mono">💳 Cobrado en Tarjeta</span>
                      <span className="text-2xl font-black text-blue-800 font-mono mt-0.5 block">${salesCard.toFixed(2)}</span>
                      <span className="text-[10px] text-blue-600 mt-1 block font-sans">TPV / Terminal digital</span>
                    </div>

                    <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider block font-mono">💰 Total Ventas Recibidas</span>
                      <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">${totalSales.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400 mt-1 block font-sans">{inCount} cobros procesados</span>
                    </div>

                    <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4">
                      <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block font-mono">🏦 Efectivo Esperado en Caja</span>
                      <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">${calculatedFinal.toFixed(2)}</span>
                      <span className="text-[10px] text-amber-700 mt-1 block font-sans">Fondo (${activeCashSession.initialAmount}) + Cash - Retiros</span>
                    </div>
                  </div>
                );
              })() : null}

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                <div className="relative w-full sm:w-80">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por mesa, cliente, folio o concepto..."
                    value={paymentsSearchQuery}
                    onChange={(e) => setPaymentsSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 focus:outline-brand-primary font-sans"
                  />
                  {paymentsSearchQuery && (
                    <button 
                      onClick={() => setPaymentsSearchQuery('')} 
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setPaymentsFilterMethod('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                      paymentsFilterMethod === 'ALL'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Todos ({(activeCashSession?.transactions || []).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentsFilterMethod('EFECTIVO')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      paymentsFilterMethod === 'EFECTIVO'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentsFilterMethod('TARJETA')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      paymentsFilterMethod === 'TARJETA'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    💳 Tarjeta
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentsFilterMethod('EGRESO')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      paymentsFilterMethod === 'EGRESO'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🔴 Retiros/Egresos
                  </button>
                </div>
              </div>

              {/* Payments List Table */}
              {!activeCashSession ? (
                <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-8 font-sans">
                  <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-extrabold text-slate-800 text-base">Turno de Caja Cerrado</h4>
                  <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
                    Abre el turno de caja para comenzar a cobrar pedidos e inspeccionar el historial en vivo de pagos recibidos.
                  </p>
                </div>
              ) : (() => {
                let filtered = (activeCashSession.transactions || []).slice();

                if (paymentsFilterMethod === 'EFECTIVO') {
                  filtered = filtered.filter(t => t.type === 'IN' && (t.paymentMethod === 'EFECTIVO' || !t.paymentMethod));
                } else if (paymentsFilterMethod === 'TARJETA') {
                  filtered = filtered.filter(t => t.type === 'IN' && t.paymentMethod === 'TARJETA');
                } else if (paymentsFilterMethod === 'EGRESO') {
                  filtered = filtered.filter(t => t.type === 'OUT');
                }

                if (paymentsSearchQuery.trim()) {
                  const q = paymentsSearchQuery.toLowerCase();
                  filtered = filtered.filter(t => 
                    t.reason.toLowerCase().includes(q) || 
                    (t.paymentMethod && t.paymentMethod.toLowerCase().includes(q))
                  );
                }

                filtered.sort((a, b) => b.timestamp - a.timestamp);

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 font-sans">
                      <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-extrabold text-slate-700 text-sm">Sin cobros ni transacciones registradas</p>
                      <p className="text-slate-400 text-xs mt-1">Los pagos cobrados desde el punto de venta o solicitudes de mesas aparecerán aquí automáticamente.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider font-mono">
                          <th className="py-3.5 px-4">Hora</th>
                          <th className="py-3.5 px-4">Tipo</th>
                          <th className="py-3.5 px-4">Concepto / Detalle del Pago</th>
                          <th className="py-3.5 px-4">Método de Pago</th>
                          <th className="py-3.5 px-4 text-right">Monto</th>
                          <th className="py-3.5 px-4 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filtered.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-600 whitespace-nowrap">
                              {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {t.type === 'IN' ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                                  (+) Cobro
                                </span>
                              ) : (
                                <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                                  (-) Egreso
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-800 text-xs block">{t.reason}</span>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {t.type === 'OUT' ? (
                                <span className="text-rose-600 font-bold text-[11px]">Retiro / Egreso</span>
                              ) : t.paymentMethod === 'TARJETA' ? (
                                <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full font-bold text-[11px] border border-blue-100">
                                  💳 Tarjeta
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold text-[11px] border border-emerald-100">
                                  💵 Efectivo
                                </span>
                              )}
                            </td>
                            <td className={`py-3.5 px-4 text-right font-mono font-black text-sm whitespace-nowrap ${
                              t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {t.type === 'IN' ? '+' : '-'}${t.amount.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handlePrintSinglePaymentReceipt(t)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                                title="Imprimir comprobante térmico individual"
                              >
                                <Printer className="w-3.5 h-3.5 text-slate-500" /> Ticket
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-black tracking-tight uppercase text-slate-800 flex items-center gap-2">
                    <span>📋</span> Historial de Cortes de Caja (Últimos 3 Días)
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">
                    Aquí puedes consultar los cortes de caja realizados en las últimas 72 horas y reimprimir su ticket físico como evidencia.
                  </p>
                </div>

                {(() => {
                  const last3Days = Date.now() - 3 * 24 * 60 * 60 * 1000;
                  const recentSessions = cashSessions
                    .filter(s => s.status === 'CLOSED' && s.closedAt && s.closedAt >= last3Days)
                    .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));

                  if (recentSessions.length === 0) {
                    return (
                      <div className="text-center py-16 text-slate-400 text-sm font-semibold border border-dashed border-slate-200 rounded-3xl bg-slate-50 font-sans">
                        No hay registros de cortes de caja realizados en los últimos 3 días.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider font-mono">
                            <th className="py-4 px-4 font-black">Sesión ID</th>
                            <th className="py-4 px-4 font-black">Apertura</th>
                            <th className="py-4 px-4 font-black">Cierre</th>
                            <th className="py-4 px-4 font-black">Cajero</th>
                            <th className="py-4 px-4 font-black">Fondo Inicial</th>
                            <th className="py-4 px-4 font-black text-emerald-600">Efectivo (+)</th>
                            <th className="py-4 px-4 font-black text-blue-600">Tarjeta (+)</th>
                            <th className="py-4 px-4 font-black text-rose-600">Egresos (-)</th>
                            <th className="py-4 px-4 font-black">Fondo Final</th>
                            <th className="py-4 px-4 text-center font-black">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentSessions.map((session) => {
                            const { salesCash, salesCard, withdrawalsTotal, calculatedFinal } = getSessionTotals(session);
                            return (
                              <tr key={session.id} className="hover:bg-slate-50/80 transition">
                                <td className="py-4 px-4 font-mono font-bold text-slate-700">
                                  #{session.id.slice(0, 8).toUpperCase()}
                                </td>
                                <td className="py-4 px-4 text-slate-500 font-medium">
                                  {new Date(session.openedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                <td className="py-4 px-4 text-slate-700 font-bold">
                                  {session.closedAt ? new Date(session.closedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '---'}
                                </td>
                                <td className="py-4 px-4 text-slate-700 font-medium font-sans">
                                  {session.openedBy || 'Cajero de Turno'}
                                </td>
                                <td className="py-4 px-4 font-mono text-slate-600 font-semibold">
                                  ${session.initialAmount.toFixed(2)}
                                </td>
                                <td className="py-4 px-4 font-mono text-emerald-600 font-bold">
                                  +${salesCash.toFixed(2)}
                                </td>
                                <td className="py-4 px-4 font-mono text-blue-600 font-bold">
                                  +${salesCard.toFixed(2)}
                                </td>
                                <td className="py-4 px-4 font-mono text-rose-500 font-semibold">
                                  -${withdrawalsTotal.toFixed(2)}
                                </td>
                                <td className="py-4 px-4 font-mono text-slate-800 font-black text-sm">
                                  ${calculatedFinal.toFixed(2)}
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <button
                                    onClick={() => handlePrintCashSessionReport(session, salesCash, salesCard, withdrawalsTotal, calculatedFinal)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition cursor-pointer font-sans"
                                    type="button"
                                  >
                                    🖨️ Imprimir
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        </div>
      )}

      {/* 2. PUNTO DE VENTA (POS) */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Products menu list */}
          <div className={`lg:col-span-7 space-y-6 ${loggedInEmployee?.role === 'mesero' ? 'order-2 lg:order-1' : ''}`}>
            <div className="bg-white rounded-2xl p-4 border border-slate-150 flex flex-col space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">Haga Clic en los productos para la comanda</h3>
                  <p className="text-slate-400 text-xs">Selecciona para agregar al carrito</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar platillo..."
                    value={posSearchQuery}
                    onChange={(e) => setPosSearchQuery(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-brand-primary bg-slate-50 focus:bg-white font-bold transition-all text-slate-700"
                  />
                  {posSearchQuery && (
                    <button
                      onClick={() => setPosSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                      type="button"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Classification filter bar */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setPosTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    posTypeFilter === 'ALL'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  🍽️ Todos
                </button>
                <button
                  type="button"
                  onClick={() => setPosTypeFilter('FOOD')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    posTypeFilter === 'FOOD'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-amber-700'
                  }`}
                >
                  <Utensils className="w-3.5 h-3.5" /> 🍲 Solo Alimentos
                </button>
                <button
                  type="button"
                  onClick={() => setPosTypeFilter('DRINK')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    posTypeFilter === 'DRINK'
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-sky-700'
                  }`}
                >
                  <CupSoda className="w-3.5 h-3.5" /> 🥤 Solo Bebidas
                </button>
              </div>
            </div>

            {(() => {
              const filteredPosProducts = products.filter(prod => {
                const pType = prod.type || (prod.category?.toLowerCase().includes('bebida') ? 'DRINK' : 'FOOD');
                if (posTypeFilter === 'FOOD' && pType !== 'FOOD') return false;
                if (posTypeFilter === 'DRINK' && pType !== 'DRINK') return false;
                if (posSearchQuery.trim() && !prod.name.toLowerCase().includes(posSearchQuery.toLowerCase())) return false;
                return true;
              });

              if (filteredPosProducts.length === 0) {
                return (
                  <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center">
                    <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h4 className="font-bold text-slate-700 text-sm">No se encontraron platillos</h4>
                    <p className="text-slate-400 text-xs mt-1">Prueba seleccionando otro filtro o borra la búsqueda.</p>
                    {(posSearchQuery || posTypeFilter !== 'ALL') && (
                      <button
                        onClick={() => { setPosSearchQuery(''); setPosTypeFilter('ALL'); }}
                        className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Mostrar todos
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {filteredPosProducts.map((prod) => {
                    const isDrink = (prod.type === 'DRINK') || (!prod.type && prod.category?.toLowerCase().includes('bebida'));
                    return (
                      <div
                        key={prod.id}
                        onClick={() => addToPosCart(prod)}
                        className="bg-white rounded-2xl border border-slate-100 shadow-2xs hover:shadow-md hover:border-brand-primary/50 transition p-4 cursor-pointer flex flex-col justify-between text-center relative overflow-hidden group"
                      >
                        <span className={`absolute top-2 left-2 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider z-10 ${
                          isDrink ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isDrink ? '🥤 Bebida' : '🍲 Alimento'}
                        </span>
                        {prod.image && (
                          <div className="w-16 h-16 mx-auto rounded-xl overflow-hidden mb-2 bg-slate-50 transition-transform group-hover:scale-105 mt-3">
                            <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        <h4 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">{prod.name}</h4>
                        <span className="text-brand-primary font-black text-sm mt-2 block">${prod.price}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* POS Cart and Bill Builder */}
          <div className={`lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-fit flex flex-col justify-between gap-6 ${loggedInEmployee?.role === 'mesero' ? 'order-1 lg:order-2' : ''}`}>
            
            {/* POS Cart Head */}
            <div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-1.5">
                  <ShoppingBag className="w-5 h-5 text-brand-primary" /> Nueva Comanda POS
                </h3>
                <button
                  onClick={() => setPosCart([])}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Vaciar
                </button>
              </div>

              {/* Order configuration parameters */}
              <div className="grid grid-cols-2 gap-3 py-3 border-b border-slate-100 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {posDeliveryType === 'DELIVERY' ? 'Nombre Cliente' : 'Nombre Comensal'}
                  </label>
                  <input 
                    type="text" 
                    value={posCustomerName}
                    onChange={(e) => setPosCustomerName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-brand-primary bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo de consumo</label>
                  <select
                    value={posDeliveryType}
                    onChange={(e) => setPosDeliveryType(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-slate-50 font-bold text-slate-700 disabled:opacity-80"
                    disabled={loggedInEmployee?.role === 'mesero'}
                  >
                    {loggedInEmployee?.role === 'mesero' ? (
                      <option value="DINE_IN">Mesa (Consumo)</option>
                    ) : loggedInEmployee?.role === 'cajero' ? (
                      <>
                        <option value="DELIVERY">Domicilio</option>
                        <option value="PICKUP">Para Llevar</option>
                      </>
                    ) : (
                      <>
                        <option value="DINE_IN">Mesa (Consumo)</option>
                        <option value="DELIVERY">Domicilio</option>
                        <option value="PICKUP">Para Llevar</option>
                      </>
                    )}
                  </select>
                </div>

                {posDeliveryType === 'DELIVERY' && (
                  <div className="col-span-2 space-y-3 bg-orange-50/50 p-3.5 rounded-2xl border border-orange-100 mt-1 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-bold text-orange-800 uppercase mb-1 flex justify-between">
                        <span>Teléfono del Cliente</span>
                        <span className="text-rose-600 font-extrabold">* Obligatorio</span>
                      </label>
                      <input 
                        type="tel" 
                        value={posCustomerPhone === '5500000000' ? '' : posCustomerPhone}
                        onChange={(e) => setPosCustomerPhone(e.target.value)}
                        placeholder="e.g. 5512345678"
                        className="w-full border border-orange-200 rounded-lg p-2 text-xs focus:outline-brand-primary bg-white font-bold text-slate-800"
                        id="pos_phone_input"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-orange-800 uppercase mb-1 flex justify-between">
                        <span>Dirección de Entrega</span>
                        <span className="text-rose-600 font-extrabold">* Obligatoria</span>
                      </label>
                      <textarea 
                        value={posDeliveryAddress}
                        onChange={(e) => setPosDeliveryAddress(e.target.value)}
                        placeholder="Calle, Número, Colonia, Referencias de entrega..."
                        className="w-full border border-orange-200 rounded-lg p-2 text-xs focus:outline-brand-primary bg-white font-bold text-slate-800"
                        rows={2}
                        id="pos_address_input"
                        required
                      />
                    </div>
                  </div>
                )}

                {posDeliveryType === 'PICKUP' && (
                  <div className="col-span-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 mt-1 animate-fadeIn">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Teléfono del Cliente</label>
                    <input 
                      type="tel" 
                      value={posCustomerPhone === '5500000000' ? '' : posCustomerPhone}
                      onChange={(e) => setPosCustomerPhone(e.target.value)}
                      placeholder="e.g. 5512345678"
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-brand-primary bg-white font-bold text-slate-800"
                    />
                  </div>
                )}

                {posDeliveryType === 'DINE_IN' && (
                  <div className="col-span-2 space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Número de Mesa</label>
                    <div className="flex gap-2">
                      <select
                        value={posTableName}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'ADD_NEW_TABLE') {
                            setShowAddTableInput(true);
                            setNewTableNameInput(`Mesa ${posTables.length + 1}`);
                          } else {
                            setPosTableName(val);
                            setShowAddTableInput(false);
                          }
                        }}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-brand-primary bg-slate-50 font-bold text-slate-700"
                      >
                        {posTables.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                        <option value="ADD_NEW_TABLE" className="text-brand-primary font-bold">➕ Agregar más mesas...</option>
                      </select>
                    </div>

                    {showAddTableInput && (
                      <div className="flex gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200 mt-1 animate-fadeIn">
                        <input
                          type="text"
                          value={newTableNameInput}
                          onChange={(e) => setNewTableNameInput(e.target.value)}
                          placeholder="Nombre o No. de mesa"
                          className="flex-1 border border-slate-200 rounded-lg p-1.5 text-xs focus:outline-brand-primary bg-white font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = newTableNameInput.trim();
                            if (trimmed) {
                              if (!posTables.includes(trimmed)) {
                                setPosTables([...posTables, trimmed]);
                              }
                              setPosTableName(trimmed);
                              setShowAddTableInput(false);
                            }
                          }}
                          className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-[11px] font-bold rounded-lg cursor-pointer"
                        >
                          Agregar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddTableInput(false);
                          }}
                          className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 text-[11px] font-bold rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* Consumo Activo de la Mesa en POS */}
                    {posTableName && (
                      (() => {
                        const tableOrders = orders.filter(
                          o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.deliveryType === 'DINE_IN' && o.tableName === posTableName
                        );
                        const totalConsumed = tableOrders.reduce((sum, o) => sum + o.total, 0);

                        return (
                          <div className="bg-slate-100/70 border border-slate-200 p-3 rounded-2xl space-y-2 mt-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Mesa activa ({posTableName})</span>
                              <span className="text-xs font-black text-brand-primary">${totalConsumed}</span>
                            </div>

                            {tableOrders.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic">Mesa limpia. Sin platillos activos.</p>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                  {tableOrders.flatMap(o => o.items.map(item => ({ ...item, status: o.status }))).map((it, idx) => (
                                    <div key={idx} className="flex justify-between text-[10px] font-medium font-mono text-slate-600">
                                      <span className="flex items-center gap-1">
                                        {it.status === 'SERVED' ? (
                                          <span className="text-emerald-600 font-bold">✓</span>
                                        ) : it.status === 'READY' ? (
                                          <span className="text-amber-500 font-bold">🛎</span>
                                        ) : (
                                          <span className="text-blue-500 font-bold">🍳</span>
                                        )}
                                        {it.quantity}x {it.name}
                                      </span>
                                      <span className="text-slate-500">${it.price * it.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2 pt-1 border-t border-slate-200 text-[9px] font-bold text-slate-400 uppercase justify-between">
                                  <div className="flex gap-2">
                                    <span className="flex items-center gap-0.5"><span className="text-emerald-600 font-extrabold">✓</span> Entregado</span>
                                    <span className="flex items-center gap-0.5"><span className="text-amber-500 font-extrabold">🛎</span> Listo</span>
                                    <span className="flex items-center gap-0.5"><span className="text-blue-500 font-extrabold">🍳</span> Cocina</span>
                                  </div>
                                </div>
                                
                                {loggedInEmployee?.role !== 'mesero' && (
                                  <div className="pt-2.5 border-t border-slate-200/60 flex flex-col gap-1.5">
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        onClick={async () => {
                                          if (confirm(`¿Registrar cobro en EFECTIVO de $${totalConsumed} para la ${posTableName}?`)) {
                                            await handleRegisterGroupPayment(tableOrders, posTableName, totalConsumed, 'EFECTIVO');
                                          }
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1.5 px-2 rounded-xl text-[9px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                        type="button"
                                      >
                                        💵 Cobrar Efec.
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (confirm(`¿Registrar cobro con TARJETA de $${totalConsumed} para la ${posTableName}?`)) {
                                            await handleRegisterGroupPayment(tableOrders, posTableName, totalConsumed, 'TARJETA');
                                          }
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-1.5 px-2 rounded-xl text-[9px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                        type="button"
                                      >
                                        💳 Cobrar Tarj.
                                      </button>
                                    </div>
                                    {loggedInEmployee?.role !== 'cajero' && (
                                      <button
                                        onClick={async () => {
                                          if (confirm(`¿Está seguro de liberar la ${posTableName} y LIMPIAR por completo la comanda? Esto marcará todos los pedidos activos como cobrados/entregados en la base de datos.`)) {
                                            try {
                                              for (const o of tableOrders) {
                                                await updateDoc(doc(db, 'orders', o.id), {
                                                  status: 'DELIVERED',
                                                  billRequested: false,
                                                  customerBillRequestedFromWaiter: false,
                                                  splitBillsRequested: false,
                                                  updatedAt: Date.now()
                                                });
                                              }
                                              alert(`La ${posTableName} ha sido liberada correctamente.`);
                                            } catch (err) {
                                              console.error("Error clearing table orders:", err);
                                              alert("Error al limpiar la mesa.");
                                            }
                                          }
                                        }}
                                        className="w-full bg-slate-200 hover:bg-rose-600 text-slate-600 hover:text-white font-extrabold py-1.5 rounded-xl text-[9px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                                        type="button"
                                      >
                                        🧹 Liberar / Limpiar Mesa
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>

              {/* Added POS Products list */}
              {posCart.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm font-semibold">
                  La comanda está vacía.<br />Agrega productos desde la izquierda.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 my-4">
                  {posCart.map((item, index) => (
                    <div key={item.product.id} className="py-2.5 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="flex-1 pr-4">
                          <span className="font-bold text-slate-800 text-sm block leading-tight">{item.product.name}</span>
                          <span className="text-slate-400 text-xs">${item.product.price} c/u</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button 
                            onClick={() => updatePosCartQty(item.product.id, -1)}
                            className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                            type="button"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-slate-700 text-sm px-1">{item.quantity}</span>
                          <button 
                            onClick={() => updatePosCartQty(item.product.id, 1)}
                            className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
                            type="button"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeFromPosCart(item.product.id)}
                            className="p-1 hover:text-rose-500 text-slate-300 ml-2"
                            type="button"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Specifications input */}
                      <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase shrink-0 pl-1">Esp:</span>
                        <input
                          type="text"
                          placeholder="Especificaciones (ej: sin cebolla, salsa aparte)"
                          value={item.notes || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPosCart(posCart.map((c, i) => i === index ? { ...c, notes: val } : c));
                          }}
                          className="flex-1 bg-transparent border-none text-[11px] text-slate-600 focus:outline-none placeholder-slate-400 font-medium py-0.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total Pricing and Checkout Buttons */}
            <div>

              <div className="space-y-2 text-sm border-t border-slate-150 pt-4">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-semibold">${posSubtotal}</span>
                </div>
                {posDeliveryFee > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Envío</span>
                    <span className="font-semibold">${posDeliveryFee}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-800 font-black text-lg pt-2 border-t border-dashed border-slate-200">
                  <span>Total</span>
                  <span>${posTotal}</span>
                </div>
              </div>

              {/* Action Trigger Buttons */}
              <div className="mt-4">
                <button
                  onClick={() => handlePlacePosOrder('PENDING')}
                  disabled={posCart.length === 0}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold py-3.5 rounded-2xl text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
                  type="button"
                >
                  <ChefHat className="w-5 h-5" /> Mandar a Cocina
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. PANTALLA COCINA */}
      {activeTab === 'kitchen' && (
        <div>
          <div className="bg-white rounded-2xl p-5 border border-slate-150 mb-6 flex justify-between items-center shadow-2xs">
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-1.5">
                <ChefHat className="w-6 h-6 text-brand-primary" /> Pantalla de Cocina (KDS)
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">Control de órdenes y comanda digital en tiempo real</p>
            </div>
            <span className="bg-orange-100 text-brand-primary text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
              {orders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)).length} órdenes activas
            </span>
          </div>

          {orders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'ASSIGNED'].includes(o.status)).length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-150 p-16 text-center shadow-2xs max-w-lg mx-auto">
              <ChefHat className="w-16 h-16 text-slate-300 mx-auto mb-4 animate-bounce" />
              <h3 className="font-black text-slate-800 text-lg">Cocina al día</h3>
              <p className="text-slate-500 text-sm mt-1">No hay pedidos en cola por preparar. ¡Buen trabajo!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orders.filter(o => ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'ASSIGNED'].includes(o.status)).map((order) => {
                const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <div 
                    key={order.id} 
                    className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                      order.deliveryType === 'DELIVERY'
                        ? 'border-orange-500 ring-2 ring-orange-500/50 bg-orange-50/10'
                        : order.status === 'PENDING' ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-slate-200'
                    }`}
                  >
                    {/* Order kitchen card head */}
                    <div className={`p-5 border-b border-slate-100 flex justify-between items-start ${
                      order.deliveryType === 'DELIVERY' ? 'bg-orange-100/70' : 'bg-slate-50'
                    }`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-600">
                            #{order.id.slice(0, 5).toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                            order.deliveryType === 'PICKUP' ? (
                              ['PENDING', 'CONFIRMED'].includes(order.status) ? 'bg-amber-100 text-amber-800' :
                              order.status === 'PREPARING' ? 'bg-orange-100 text-orange-800' :
                              'bg-emerald-100 text-emerald-800'
                            ) : (
                              order.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            )
                          }`}>
                            {order.deliveryType === 'PICKUP' ? (
                              ['PENDING', 'CONFIRMED'].includes(order.status) ? 'Recibido' :
                              order.status === 'PREPARING' ? 'Cocinando' :
                              order.status === 'READY' ? 'Listo' : order.status
                            ) : order.status}
                          </span>
                        </div>
                        <h4 className="font-black text-slate-800 text-base mt-2 flex items-center gap-1.5">
                          {order.customerName} {order.tableName ? `[${order.tableName}]` : ''}
                        </h4>
                        <span className="text-slate-400 text-xs block mt-0.5">
                          Consumo: {order.deliveryType === 'DINE_IN' ? '🍽️ En Mesa' : order.deliveryType === 'PICKUP' ? '🛍️ Para Llevar' : '🏍️ Domicilio'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-medium block">Recibido</span>
                        <span className="text-slate-700 font-bold text-xs">{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>

                    {order.deliveryType === 'DELIVERY' && (
                      <div className="mx-5 mt-4 p-3 bg-orange-100/40 rounded-2xl border border-orange-200/50 text-xs text-slate-700 space-y-1 animate-fadeIn">
                        <p className="font-extrabold text-orange-800 text-[10px] uppercase tracking-wider flex items-center gap-1">
                          🏍️ PEDIDO A DOMICILIO
                        </p>
                        <p><strong>Cliente:</strong> {order.customerName}</p>
                        <p><strong>Teléfono:</strong> {order.customerPhone}</p>
                        <p><strong>Dirección:</strong> {(order as any).deliveryAddress || 'No especificada'}</p>

                        {order.driverName && (
                          <div className="pt-2 mt-2 border-t border-orange-200/60 flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <p className="font-extrabold text-slate-800 text-[11px] flex items-center gap-1">
                                👤 Repartidor: {order.driverName}
                              </p>
                              {order.driverPhone && (
                                <a 
                                  href={`tel:${order.driverPhone}`} 
                                  className="text-[11px] text-orange-700 font-bold hover:underline flex items-center gap-1 mt-0.5 font-mono"
                                >
                                  <Phone className="w-3 h-3 text-orange-600" /> {order.driverPhone}
                                </a>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnassignDriver(order)}
                              className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold px-2.5 py-1 rounded-xl text-[10px] transition cursor-pointer flex items-center gap-1 shadow-xs uppercase tracking-wider"
                            >
                              <UserMinus className="w-3 h-3" /> Quitar asignación
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Products list for chefs */}
                    <div className="p-5 flex-1 space-y-3">
                      {order.items.map((it, k) => (
                        <div key={k} className="flex justify-between items-start text-sm border-b border-dashed border-slate-100 pb-2">
                          <div>
                            <span className="font-black text-brand-primary mr-2">{it.quantity}x</span>
                            <span className="font-bold text-slate-800">{it.name}</span>
                            {it.selectedVariant && (
                              <span className="block text-xs text-slate-400 font-semibold mt-0.5">Opción: {it.selectedVariant}</span>
                            )}
                            {it.selectedExtras && it.selectedExtras.length > 0 && (
                              <span className="block text-xs text-brand-primary font-medium mt-0.5">
                                Extras: {it.selectedExtras.map(e => e.name).join(', ')}
                              </span>
                            )}
                            {it.notes && (
                              <span className="block text-xs text-rose-600 bg-rose-50 p-1.5 rounded-lg border border-rose-100 mt-1 font-mono">
                                Nota: "{it.notes}"
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Kitchen actions */}
                    <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePrintComanda(order)}
                          className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 p-2.5 rounded-xl transition cursor-pointer"
                          title="Imprimir Comanda"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        
                        {order.status === 'PENDING' && (
                          <div className="flex gap-2 flex-1">
                            <button
                              onClick={() => handleKitchenRejectOrder(order.id, order.id.slice(0, 5).toUpperCase())}
                              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                              title="Rechazar pedido"
                            >
                              Rechazar <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleKitchenStatusChange(order.id, 'READY')}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                            >
                              Listo <CheckCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {order.status === 'CONFIRMED' && (
                          <div className="flex gap-2 flex-1">
                            <button
                              onClick={() => handleKitchenRejectOrder(order.id, order.id.slice(0, 5).toUpperCase())}
                              className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold px-3 py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                              title="Rechazar pedido"
                            >
                              Rechazar <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleKitchenStatusChange(order.id, 'PREPARING')}
                              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              {order.deliveryType === 'PICKUP' ? <ChefHat className="w-4 h-4" /> : <Play className="w-4 h-4" />} {order.deliveryType === 'PICKUP' ? 'Cocinando' : 'Prep'}
                            </button>
                            <button
                              onClick={() => handleKitchenStatusChange(order.id, 'READY')}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              Listo <CheckCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {order.status === 'PREPARING' && (
                          <div className="flex gap-2 flex-1">
                            <button
                              onClick={() => handleKitchenRejectOrder(order.id, order.id.slice(0, 5).toUpperCase())}
                              className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold px-3 py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                              title="Rechazar pedido"
                            >
                              Rechazar <XCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleKitchenStatusChange(order.id, 'READY')}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              {order.deliveryType === 'PICKUP' ? 'Listo para que lo recoja' : 'Listo'} <CheckCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {order.status === 'READY' && order.deliveryType === 'DINE_IN' && (
                          <div className="flex-1 bg-emerald-50 text-emerald-800 border border-emerald-200 py-2 px-3 rounded-xl text-[10px] font-black text-center animate-pulse uppercase tracking-wider flex items-center justify-center gap-1.5">
                            <BellRing className="w-3.5 h-3.5 text-emerald-600 animate-bounce" /> Esperando al Mesero
                          </div>
                        )}

                        {order.status === 'READY' && order.deliveryType === 'PICKUP' && (
                          <div className="flex-1 bg-amber-50 text-amber-800 border border-amber-200 py-2 px-3 rounded-xl text-[10px] font-black text-center animate-pulse uppercase tracking-wider flex items-center justify-center gap-1.5">
                            <BellRing className="w-3.5 h-3.5 text-amber-600 animate-bounce" /> En Mostrador / Entrega en Caja
                          </div>
                        )}

                        {order.status === 'READY' && order.deliveryType === 'DELIVERY' && (
                          <div className="flex-1 bg-orange-50 text-orange-800 border border-orange-200 py-2 px-3 rounded-xl text-[10px] font-black text-center animate-pulse uppercase tracking-wider flex items-center justify-center gap-1.5">
                            <BellRing className="w-3.5 h-3.5 text-orange-600 animate-bounce" /> Listo / Esperando al Repartidor
                          </div>
                        )}

                        {order.status === 'ASSIGNED' && order.deliveryType === 'DELIVERY' && (
                          <div className="flex-1 bg-blue-50 text-blue-900 border border-blue-200 py-2 px-3 rounded-xl text-[10px] font-bold flex items-center justify-between gap-1.5 flex-wrap">
                            <div>
                              <span className="font-black uppercase tracking-wider block text-blue-900">🏍️ Asignado a Repartidor</span>
                              <span className="text-slate-800 font-extrabold">{order.driverName}</span>
                              {order.driverPhone && (
                                <a href={`tel:${order.driverPhone}`} className="block text-orange-700 font-bold underline font-mono text-[10px] mt-0.5">
                                  📞 {order.driverPhone}
                                </a>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnassignDriver(order)}
                              className="bg-rose-500 hover:bg-rose-600 text-white font-black px-2.5 py-1 rounded-lg text-[10px] transition cursor-pointer flex items-center gap-1 uppercase tracking-wider"
                            >
                              <UserMinus className="w-3 h-3" /> Quitar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. INVENTARIOS */}
      {activeTab === 'inventory' && (
        <div className="space-y-8">
          
          {/* Create buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setShowAddIngModal(true)}
              className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold px-5 py-2.5 rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Agregar Insumo / Ingrediente
            </button>
          </div>

          {/* Add Ingredient Modal */}
          {showAddIngModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <form onSubmit={handleAddIngredient} className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100">
                <h3 className="font-extrabold text-slate-800 text-lg mb-4">Agregar Insumo</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Insumo</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. Carne al Pastor"
                      value={newIngName}
                      onChange={(e) => setNewIngName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stock</label>
                      <input 
                        type="number" 
                        required
                        value={newIngStock}
                        onChange={(e) => setNewIngStock(parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mínimo</label>
                      <input 
                        type="number" 
                        required
                        value={newIngMin}
                        onChange={(e) => setNewIngMin(parseFloat(e.target.value) || 0)}
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidad</label>
                      <input 
                        type="text" 
                        required
                        placeholder="kg, pz"
                        value={newIngUnit}
                        onChange={(e) => setNewIngUnit(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-brand-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddIngModal(false)}
                    className="flex-1 border border-slate-200 rounded-xl py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2.5 rounded-xl text-xs"
                  >
                    Guardar Insumo
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Ingredients table catalog */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
              <div className="p-6 border-b border-slate-150">
                <h3 className="font-extrabold text-slate-800 text-base">Insumos e Ingredientes en Almacén ({ingredients.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                      <th className="p-4">Nombre Insumo</th>
                      <th className="p-4 text-center">Mínimo Requerido</th>
                      <th className="p-4 text-center">Stock Actual</th>
                      <th className="p-4 text-right">Carga Rápida Insumo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ingredients.map((ing) => {
                      const isLow = ing.stock <= ing.minStock;
                      return (
                        <tr key={ing.id} className="hover:bg-slate-50 transition">
                          <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                            {ing.name}
                            {isLow && (
                              <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-1.5 py-0.5 rounded">
                                Alerta Bajo Stock
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center font-semibold text-slate-500">
                            {ing.minStock} {ing.unit}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`font-black text-sm ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>
                              {ing.stock} {ing.unit}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => {
                                const qty = parseFloat(prompt(`¿Cuánto ${ing.unit} compraste de ${ing.name}?`, '10') || '0');
                                const cost = parseFloat(prompt(`¿Cuál fue el costo total de la compra?`, '150') || '0');
                                if (qty > 0 && cost > 0) handlePurchaseStock(ing.id, qty, cost);
                              }}
                              className="bg-slate-100 hover:bg-brand-primary hover:text-white text-slate-600 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
                            >
                              Ingresar Compra
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Suppliers & purchases */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6 space-y-6">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base mb-4">Directorio de Proveedores</h3>
                <form onSubmit={handleAddSupplier} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-150">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Registrar Nuevo Proveedor</span>
                  <input 
                    type="text" 
                    placeholder="Nombre Proveedor" 
                    required 
                    value={newSupName} 
                    onChange={(e) => setNewSupName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                  />
                  <input 
                    type="text" 
                    placeholder="Contacto Principal" 
                    value={newSupContact} 
                    onChange={(e) => setNewSupContact(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                  />
                  <input 
                    type="tel" 
                    placeholder="Teléfono" 
                    value={newSupPhone} 
                    onChange={(e) => setNewSupPhone(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white"
                  />
                  <button type="submit" className="w-full bg-brand-primary text-white text-xs font-bold py-2 rounded-lg cursor-pointer">
                    Agregar Proveedor
                  </button>
                </form>

                {/* Suppliers directory list */}
                <div className="space-y-2 mt-4 max-h-48 overflow-y-auto">
                  {suppliers.map(sup => (
                    <div key={sup.id} className="p-3 bg-white rounded-lg border border-slate-100 text-xs">
                      <strong className="text-slate-800 block">{sup.name}</strong>
                      <span className="text-slate-500">Contacto: {sup.contact || 'No asignado'}</span>
                      <span className="text-slate-400 block mt-0.5">Tel: {sup.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. REPORTES */}
      {activeTab === 'reports' && (
        <div className="space-y-8">
          
          {/* Quick numbers report cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ingresos de Venta Totales</span>
              <span className="text-3xl font-black text-slate-800 mt-2 block">
                ${orders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + o.total, 0)}
              </span>
              <span className="text-emerald-500 text-xs font-bold block mt-1">↑ Caja cerrada & liquidada</span>
            </div>

            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Ticket Promedio por Pedido</span>
              <span className="text-3xl font-black text-slate-800 mt-2 block">
                ${orders.filter(o => o.status === 'DELIVERED').length > 0 
                  ? Math.round(orders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + o.total, 0) / orders.filter(o => o.status === 'DELIVERED').length)
                  : 0
                }
              </span>
              <span className="text-slate-400 text-xs block mt-1">Sabor local constante</span>
            </div>

            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Egresos / Gastos Registrados</span>
              <span className="text-3xl font-black text-slate-800 mt-2 block">
                ${cashSessions.flatMap(s => s.transactions || []).filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.amount, 0)}
              </span>
              <span className="text-rose-500 text-xs font-bold block mt-1">Insumos y pago a proveedores</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Products ranking popularity */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6">
              <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-1.5">
                <TrendingUp className="w-5 h-5 text-emerald-500" /> Productos Más Vendidos (Popularidad)
              </h3>
              
              {/* Calculate ranking */}
              {(() => {
                const ranking: { [name: string]: { qty: number; total: number } } = {};
                orders.filter(o => o.status === 'DELIVERED').flatMap(o => o.items).forEach(item => {
                  if (ranking[item.name]) {
                    ranking[item.name].qty += item.quantity;
                    ranking[item.name].total += item.price * item.quantity;
                  } else {
                    ranking[item.name] = { qty: item.quantity, total: item.price * item.quantity };
                  }
                });

                const rankingList = Object.entries(ranking).sort((a, b) => b[1].qty - a[1].qty);

                if (rankingList.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 text-sm font-semibold">
                      Aún no hay ventas entregadas para generar la clasificación de productos.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {rankingList.map(([name, stat], k) => (
                      <div key={k} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <strong className="text-slate-800 text-sm">{name}</strong>
                          <span className="text-slate-400 text-xs block">{stat.qty} unidades vendidas</span>
                        </div>
                        <span className="font-black text-emerald-600">${stat.total}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Performance analysis */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6">
              <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-1.5">
                <Users className="w-5 h-5 text-blue-500" /> Rendimiento de Repartidores
              </h3>
              
              {/* Calculate Driver shipments completed */}
              {(() => {
                const driverRanking: { [name: string]: { completed: number; revenue: number } } = {};
                orders.filter(o => o.status === 'DELIVERED' && o.driverName).forEach(o => {
                  const dName = o.driverName || 'Desconocido';
                  if (driverRanking[dName]) {
                    driverRanking[dName].completed += 1;
                    driverRanking[dName].revenue += o.deliveryFee;
                  } else {
                    driverRanking[dName] = { completed: 1, revenue: o.deliveryFee };
                  }
                });

                const driverList = Object.entries(driverRanking).sort((a, b) => b[1].completed - a[1].completed);

                if (driverList.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 text-sm font-semibold">
                      No hay registros de repartidores en pedidos completados aún.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {driverList.map(([name, stat], k) => (
                      <div key={k} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <strong className="text-slate-800 text-sm">{name}</strong>
                          <span className="text-slate-400 text-xs block">{stat.completed} entregas exitosas</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-800 block">${stat.revenue}</span>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Envío total cobrado</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 6. EMPLOYEES MANAGEMENT TAB (Owner Only) */}
      {activeTab === 'employees' && currentUser && userProfile && (
        <div className="space-y-8 animate-fade-in" id="employees_management_tab">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form to Create Employees */}
            <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm lg:col-span-1">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-brand-primary" /> Registrar Empleado
              </h3>
              <p className="text-xs text-gray-400 font-bold mb-6 uppercase">
                Crea una cuenta para tus cajeros, meseros o cocineros.
              </p>

              <form onSubmit={handleCreateEmployee} className="space-y-4">
                {empError && (
                  <div className="p-3 bg-rose-50 border border-rose-150 text-rose-500 text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{empError}</span>
                  </div>
                )}
                
                {empSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-600 text-xs font-bold rounded-xl flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>{empSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    placeholder="ej: Juan Pérez"
                    className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Nombre de Usuario (Login)</label>
                  <input
                    type="text"
                    required
                    value={newEmpUsername}
                    onChange={(e) => setNewEmpUsername(e.target.value)}
                    placeholder="ej: juan_cocina"
                    className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Contraseña</label>
                  <input
                    type="text"
                    required
                    value={newEmpPassword}
                    onChange={(e) => setNewEmpPassword(e.target.value)}
                    placeholder="ej: 12345"
                    className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Rol de Trabajo</label>
                  <select
                    value={newEmpRole}
                    onChange={(e) => setNewEmpRole(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden cursor-pointer"
                  >
                    <option value="cajero">Cajero (POS, Inventarios, Dashboard)</option>
                    <option value="mesero">Mesero (POS, Dashboard)</option>
                    <option value="cocinero">Cocinero (Exclusivo Pantalla Cocina)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-black py-3 px-5 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
                >
                  Registrar Empleado
                </button>
              </form>
            </div>

            {/* List of Registered Employees */}
            <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-sm lg:col-span-2">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" /> Catálogo de Empleados ({employees.length})
              </h3>
              <p className="text-xs text-gray-400 font-bold mb-6 uppercase">
                Administra, suspende o da de baja a los empleados de {selectedRest?.name}.
              </p>

              {employees.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-3xl text-gray-400 font-bold text-sm">
                  Aún no has registrado empleados para este restaurante.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-150 text-[10px] text-gray-400 font-extrabold uppercase bg-gray-50/50">
                        <th className="py-3 px-4">Empleado</th>
                        <th className="py-3 px-4">Usuario</th>
                        <th className="py-3 px-4">Contraseña</th>
                        <th className="py-3 px-4">Rol</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-4 px-4">
                            <span className="font-bold text-slate-800 text-sm block">{emp.name}</span>
                            <span className="text-[10px] text-gray-400 font-bold">Creado {new Date(emp.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-600">
                            {emp.username}
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-slate-600">
                            {emp.password}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                              emp.role === 'cocinero' 
                                ? 'bg-amber-100 text-amber-700' 
                                : emp.role === 'mesero' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {emp.role}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                              emp.status === 'active' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-rose-100 text-rose-700'
                            }`}>
                              {emp.status === 'active' ? 'ACTIVO' : 'DE BAJA / INACTIVO'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleToggleEmployeeStatus(emp.id, emp.status)}
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition cursor-pointer ${
                                  emp.status === 'active'
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-600'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                }`}
                              >
                                {emp.status === 'active' ? 'Suspender' : 'Activar'}
                              </button>
                              <button
                                onClick={() => handleDeleteEmployee(emp.id)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl text-[10px] font-black transition cursor-pointer"
                              >
                                Dar de baja
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 7. MENÚ / PLATILLOS (ADMIN) */}
      {activeTab === 'menu' && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-gradient-to-r from-slate-800 to-indigo-900 rounded-3xl p-6 text-white shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight">Gestión del Menú Digital</h2>
                <p className="text-indigo-200 text-xs font-semibold mt-1">
                  Agrega nuevos platillos, define precios, imágenes y controla la disponibilidad en tiempo real para tu restaurante.
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-xs font-bold font-mono">
                {products.length} PLATILLOS EN TOTAL
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left: Add Product Form */}
            <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-xs self-start">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight mb-2 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" /> Nuevo Platillo
              </h3>
              <p className="text-xs text-gray-400 font-bold mb-6 uppercase">
                Ingresa los datos para registrar el platillo en tu carta digital.
              </p>

              {prodError && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-150 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{prodError}</span>
                </div>
              )}

              {prodSuccess && (
                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-600 text-xs font-bold rounded-2xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{prodSuccess}</span>
                </div>
              )}

              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Nombre del Platillo *</label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    placeholder="ej: Taco de Pastor al Carbón"
                    className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Precio ($) *</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    placeholder="ej: 75.00"
                    className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">¿Es Alimento o Bebida? *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewProdType('FOOD')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-black transition cursor-pointer border ${
                        newProdType === 'FOOD'
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-500/20'
                          : 'bg-gray-50 text-slate-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Utensils className="w-4 h-4" /> 🍲 Alimento
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewProdType('DRINK')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-black transition cursor-pointer border ${
                        newProdType === 'DRINK'
                          ? 'bg-sky-500 text-white border-sky-600 shadow-xs ring-2 ring-sky-500/20'
                          : 'bg-gray-50 text-slate-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <CupSoda className="w-4 h-4" /> 🥤 Bebida
                    </button>
                  </div>
                </div>

                <ProductImageUploader
                  value={newProdImage}
                  onChange={setNewProdImage}
                  label="Foto / Imagen del Platillo"
                />

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Descripción del Platillo</label>
                  <textarea
                    rows={3}
                    value={newProdDescription}
                    onChange={(e) => setNewProdDescription(e.target.value)}
                    placeholder="ej: Elaborados con tortillas artesanales, cebolla asada, piña fresca y un toque picante de salsa verde..."
                    className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-5 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
                >
                  Agregar al Menú
                </button>
              </form>
            </div>

            {/* Right: Products catalog list */}
            <div className="bg-white border border-gray-200 p-6 rounded-3xl shadow-xs xl:col-span-2 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-indigo-500" /> Carta de Platillos ({products.length})
                  </h3>
                  <p className="text-xs text-gray-400 font-bold uppercase mt-0.5">
                    Habilita, deshabilita o elimina platillos de tu menú digital.
                  </p>
                </div>

                {/* Filter tabs for Alimentos vs Bebidas */}
                <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setCatalogTypeFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      catalogTypeFilter === 'ALL'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-gray-500 hover:text-slate-800'
                    }`}
                  >
                    🍽️ Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogTypeFilter('FOOD')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                      catalogTypeFilter === 'FOOD'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-gray-500 hover:text-amber-600'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" /> Alimentos
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogTypeFilter('DRINK')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                      catalogTypeFilter === 'DRINK'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'text-gray-500 hover:text-sky-600'
                    }`}
                  >
                    <CupSoda className="w-3.5 h-3.5" /> Bebidas
                  </button>
                </div>
              </div>

              {(() => {
                const filteredCatalogProducts = products.filter((prod) => {
                  const pType = prod.type || (prod.category?.toLowerCase().includes('bebida') ? 'DRINK' : 'FOOD');
                  if (catalogTypeFilter === 'FOOD' && pType !== 'FOOD') return false;
                  if (catalogTypeFilter === 'DRINK' && pType !== 'DRINK') return false;
                  return true;
                });

                if (filteredCatalogProducts.length === 0) {
                  return (
                    <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-3xl text-gray-400 font-bold text-sm">
                      {products.length === 0
                        ? 'No hay platillos registrados en el menú. ¡Agrega el primero para comenzar!'
                        : 'No hay productos que coincidan con la clasificación seleccionada.'}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[700px] overflow-y-auto pr-2">
                    {filteredCatalogProducts.map((prod) => {
                      const isDrink = (prod.type === 'DRINK') || (!prod.type && prod.category?.toLowerCase().includes('bebida'));
                      return (
                        <div 
                          key={prod.id} 
                          className={`border rounded-2xl p-4 flex gap-4 transition duration-200 hover:shadow-md bg-white ${
                            prod.available ? 'border-slate-150' : 'border-rose-100 bg-rose-50/10'
                          }`}
                        >
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 shrink-0 border border-slate-100 relative">
                            <img 
                              src={prod.image} 
                              alt={prod.name} 
                              className={`w-full h-full object-cover transition ${!prod.available ? 'grayscale opacity-60' : ''}`} 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-extrabold text-slate-800 text-sm leading-snug">{prod.name}</h4>
                                <span className="font-black text-indigo-600 text-sm shrink-0">${prod.price}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider inline-flex items-center gap-1 ${
                                  isDrink ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {isDrink ? '🥤 Bebida' : '🍲 Alimento'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-2 mt-1.5">{prod.description}</p>
                            </div>
                            
                            <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-100">
                              {/* Toggle availability badge */}
                              <button
                                type="button"
                                onClick={() => handleToggleProductAvailability(prod.id, prod.available)}
                                className={`px-3 py-1 rounded-full text-[9px] font-extrabold transition uppercase cursor-pointer ${
                                  prod.available 
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                }`}
                              >
                                {prod.available ? '● DISPONIBLE' : '○ AGOTADO'}
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditProduct(prod)}
                                  className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition cursor-pointer"
                                  title="Editar platillo"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(prod.id)}
                                  className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
                                  title="Eliminar de la carta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 8. PERFIL / CONFIGURACIÓN (ADMIN) */}
      {activeTab === 'profile' && currentUser && userProfile && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-gradient-to-r from-slate-800 to-indigo-900 rounded-3xl p-6 text-white shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-black tracking-tight">Datos del Restaurante</h2>
                <p className="text-indigo-200 text-xs font-semibold mt-1">
                  Mantén actualizada la información de tu restaurante para tus clientes en la aplicación móvil y web.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-xs font-bold font-mono">
                  {selectedRest?.name?.toUpperCase()}
                </div>
                {selectedRest?.id && (
                  <div className="bg-white/15 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 text-xs font-mono font-extrabold flex items-center gap-2">
                    <span className="text-indigo-100 font-sans text-[11px]">ID del Restaurante:</span>
                    <span className="text-white font-mono">{selectedRest.id}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedRest.id);
                        alert('✅ ID del restaurante copiado al portapapeles');
                      }}
                      className="bg-white/20 hover:bg-white/30 text-white text-[10px] px-2.5 py-1 rounded-xl font-sans font-extrabold transition cursor-pointer"
                    >
                      Copiar ID
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateRestaurant} className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
            {editRestError && (
              <div className="p-4 bg-rose-50 border border-rose-150 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>{editRestError}</span>
              </div>
            )}

            {editRestSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-600 text-xs font-bold rounded-2xl flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>{editRestSuccess}</span>
              </div>
            )}

            {/* General Info */}
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Información Básica</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Nombre del Restaurante *</label>
                  <input
                    type="text"
                    required
                    value={editRestName}
                    onChange={(e) => setEditRestName(e.target.value)}
                    placeholder="Ej. Tacos El Torito"
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Giro / Categoría Principal *</label>
                  <select
                    value={editRestCategory}
                    onChange={(e) => setEditRestCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden cursor-pointer"
                  >
                    <option value="Restaurantes🍽️">Restaurantes🍽️</option>
                    <option value="Cafeterías☕/postres🍰">Cafeterías☕/postres🍰</option>
                    <option value="Bares🍺">Bares🍺</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Horario de Servicio *</label>
                  <input
                    type="text"
                    required
                    value={editRestHours}
                    onChange={(e) => setEditRestHours(e.target.value)}
                    placeholder="Ej. 11:00 - 22:00"
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Día de Descanso / Cierre Semanal *</label>
                  <select
                    value={editRestRestDay}
                    onChange={(e) => setEditRestRestDay(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-bold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden cursor-pointer"
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
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Teléfono de Atención *</label>
                  <input
                    type="tel"
                    required
                    value={editRestPhone}
                    onChange={(e) => setEditRestPhone(e.target.value)}
                    placeholder="Ej. 3951234567"
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Address & Delivery Zone */}
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Ubicación y Entregas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Ciudad del Restaurante *</label>
                  <select
                    value={editRestCity}
                    onChange={(e) => setEditRestCity(e.target.value)}
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-bold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden cursor-pointer"
                  >
                    <option value="">-- Seleccionar Ciudad --</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {/* Fallback if restaurant has a legacy city not in the active list */}
                    {editRestCity && !cities.some(c => c.name.toLowerCase() === editRestCity.toLowerCase()) && (
                      <option value={editRestCity}>
                        {editRestCity} (Actual)
                      </option>
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Dirección Física Completa</label>
                  <input
                    type="text"
                    value={editRestAddress}
                    onChange={(e) => setEditRestAddress(e.target.value)}
                    placeholder="Ej. Calle Hidalgo #45, Col. Centro, San Juan de los Lagos"
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Zona de Entrega</label>
                  <input
                    type="text"
                    value={editRestDeliveryZone}
                    onChange={(e) => setEditRestDeliveryZone(e.target.value)}
                    placeholder="Ej. Todo el Municipio, Zona Centro, etc."
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Tiempo de Entrega Estimado</label>
                  <input
                    type="text"
                    value={editRestDeliveryTime}
                    onChange={(e) => setEditRestDeliveryTime(e.target.value)}
                    placeholder="Ej. 30-40 min"
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Pago a Repartidores por Pedido ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editRestDriverPayment}
                    onChange={(e) => setEditRestDriverPayment(e.target.value)}
                    placeholder="Ej. 10.00 (Por defecto $10)"
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Design & Media */}
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Diseño y Logo del Restaurante</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-8 space-y-4">
                  
                  {/* File Upload Area */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase mb-1.5">
                      Subir Logo desde tu Dispositivo (Hasta 10 MB)
                    </label>
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 bg-slate-50 hover:bg-slate-100/70 transition text-center relative cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const compressedDataUrl = await compressImageFile(file, 500, 500, 0.82, 15);
                            setEditRestLogo(compressedDataUrl);
                          } catch (err: any) {
                            alert(err.message || 'Error al procesar la imagen del logo.');
                          }
                          e.target.value = '';
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-2xl group-hover:scale-105 transition">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 block">
                            Haz clic o arrastra una imagen desde tu dispositivo
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                            Tamaño máximo: 10 MB • Formatos: PNG, JPG, SVG, WEBP
                          </span>
                        </div>
                        {editRestLogo && (
                          <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[11px] font-extrabold">
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Logo cargado correctamente
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Preview Box */}
                <div className="md:col-span-4 flex flex-col items-center justify-center p-5 border border-slate-200 rounded-3xl bg-slate-50 h-full min-h-[180px] shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Vista Previa</span>
                  <div className="relative">
                    <img 
                      src={editRestLogo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200'} 
                      alt="Vista previa del Logo" 
                      className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-md mb-2 bg-white"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=200';
                      }}
                    />
                  </div>
                  {editRestLogo && (
                    <button
                      type="button"
                      onClick={() => setEditRestLogo('')}
                      className="text-[10px] text-rose-600 hover:text-rose-700 font-extrabold flex items-center gap-1 mt-1 cursor-pointer hover:underline"
                    >
                      <X className="w-3 h-3" /> Eliminar / Restablecer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Social Networks */}
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Redes Sociales</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Facebook (URL)</label>
                  <input
                    type="url"
                    value={editRestFacebook}
                    onChange={(e) => setEditRestFacebook(e.target.value)}
                    placeholder="Ej. https://facebook.com/mitienda"
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Instagram (URL)</label>
                  <input
                    type="url"
                    value={editRestInstagram}
                    onChange={(e) => setEditRestInstagram(e.target.value)}
                    placeholder="Ej. https://instagram.com/mitienda"
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-2">Ubicación / Maps (URL)</label>
                  <input
                    type="url"
                    value={editRestTwitter}
                    onChange={(e) => setEditRestTwitter(e.target.value)}
                    placeholder="Ej. https://maps.google.com/?q=..."
                    className="w-full bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Administrar Órdenes por Código QR */}
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-indigo-600" /> Modo de Pedidos por Código QR en Mesa
              </h3>
              <p className="text-xs text-slate-500 font-medium mb-4">
                Elige cómo deseas que funcionen los códigos QR escaneados por los comensales en las mesas:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Opción 1: Siempre Activadas */}
                <div
                  onClick={() => setEditRestQrOrderingMode('ALWAYS_ACTIVE')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    editRestQrOrderingMode === 'ALWAYS_ACTIVE'
                      ? 'border-emerald-500 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                        <Unlock className="w-4 h-4 text-emerald-600 shrink-0" /> Siempre Activadas
                      </span>
                      <input
                        type="radio"
                        name="qrOrderingMode"
                        value="ALWAYS_ACTIVE"
                        checked={editRestQrOrderingMode === 'ALWAYS_ACTIVE'}
                        onChange={() => setEditRestQrOrderingMode('ALWAYS_ACTIVE')}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Los comensales siempre pueden realizar pedidos desde su celular al escanear el código QR de la mesa, sin requerir previa entrega o activación de un mesero.
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-emerald-200/60">
                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md inline-block">
                      ⚡ Pedidos QR Libres
                    </span>
                  </div>
                </div>

                {/* Opción 2: Siempre Desactivadas */}
                <div
                  onClick={() => setEditRestQrOrderingMode('ALWAYS_DISABLED')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    editRestQrOrderingMode === 'ALWAYS_DISABLED'
                      ? 'border-rose-500 bg-rose-50/60 shadow-sm ring-2 ring-rose-500/20'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-rose-600 shrink-0" /> Siempre Desactivadas
                      </span>
                      <input
                        type="radio"
                        name="qrOrderingMode"
                        value="ALWAYS_DISABLED"
                        checked={editRestQrOrderingMode === 'ALWAYS_DISABLED'}
                        onChange={() => setEditRestQrOrderingMode('ALWAYS_DISABLED')}
                        className="text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Los comensales solo podrán consultar el catálogo/menú digital. La opción de enviar pedidos a cocina desde el celular estará completamente bloqueada.
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-rose-200/60">
                    <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md inline-block">
                      📖 Solo Menú Digital
                    </span>
                  </div>
                </div>

                {/* Opción 3: Automáticas */}
                <div
                  onClick={() => setEditRestQrOrderingMode('AUTOMATIC')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col justify-between ${
                    editRestQrOrderingMode === 'AUTOMATIC'
                      ? 'border-indigo-500 bg-indigo-50/60 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 text-indigo-600 shrink-0" /> Automáticas
                      </span>
                      <input
                        type="radio"
                        name="qrOrderingMode"
                        value="AUTOMATIC"
                        checked={editRestQrOrderingMode === 'AUTOMATIC'}
                        onChange={() => setEditRestQrOrderingMode('AUTOMATIC')}
                        className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Se activan automáticamente cuando un mesero entrega el primer platillo en la mesa, y se bloquean cuando se solicita la cuenta o el mesero cierra la mesa.
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-indigo-200/60">
                    <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-md inline-block">
                      🛎️ Control por Entrega de Mesero
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-8 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
              >
                Guardar Cambios del Perfil
              </button>
            </div>
          </form>

          {/* Control de Mesas y Códigos QR */}
          <div className="mt-8 pt-8 border-t border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <QrCode className="w-6 h-6 text-indigo-600" /> Códigos QR de las Mesas
                </h3>
                <p className="text-xs text-gray-500 font-semibold uppercase mt-1">
                  Administra tus mesas y descarga sus códigos QR únicos para que los clientes ordenen desde su celular.
                </p>
              </div>

              {/* Add new table form inline */}
              <div className="flex gap-2 shrink-0">
                <input
                  type="text"
                  placeholder="Ej. Mesa 11"
                  value={newTableQRName}
                  onChange={(e) => setNewTableQRName(e.target.value)}
                  className="bg-slate-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl px-4 py-2 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleAddTableFromQRSection(newTableQRName);
                    setNewTableQRName('');
                  }}
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white font-black py-2 px-4 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  + Añadir Mesa
                </button>
              </div>
            </div>

            {posTables.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-250 text-slate-500 font-bold text-sm">
                Aún no tienes mesas registradas. ¡Agrega tu primera mesa usando el botón de arriba!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {posTables.map((t) => {
                  const qrLink = `${window.location.origin}${window.location.pathname}?restaurantId=${selectedRest?.id}&table=${encodeURIComponent(t)}`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrLink)}`;

                  return (
                    <div key={t} className="bg-white border border-slate-150 rounded-3xl p-5 flex flex-col items-center justify-between text-center hover:shadow-md transition duration-200">
                      <div className="w-full">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                            {t}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteTableFromQRSection(t)}
                            className="text-slate-400 hover:text-rose-600 transition p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
                            title="Eliminar Mesa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* QR Code container */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-center mb-4">
                          <img
                            src={qrUrl}
                            alt={`QR ${t}`}
                            className="w-36 h-36 object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="w-full space-y-2 mt-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const response = await fetch(qrUrl);
                              const blob = await response.blob();
                              const blobUrl = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = `QR_${selectedRest?.name || 'Restaurante'}_${t}.png`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(blobUrl);
                            } catch (err) {
                              window.open(qrUrl, '_blank');
                            }
                          }}
                          className="w-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-650 text-slate-700 font-extrabold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider"
                        >
                          <Download className="w-3.5 h-3.5" /> Descargar QR
                        </button>

                        <button
                          type="button"
                          onClick={() => window.open(qrLink, '_blank')}
                          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold py-2 rounded-xl text-[10px] transition cursor-pointer flex items-center justify-center gap-1 uppercase tracking-wider"
                        >
                          <ExternalLink className="w-3 h-3" /> Probar Escaneo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* Employee Login Modal */}
      {showEmpLogin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-100 shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setShowEmpLogin(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-slate-800 cursor-pointer p-1 rounded-full hover:bg-gray-50 transition"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-orange-50 text-brand-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Iniciar Sesión Empleado</h3>
              <p className="text-xs text-gray-400 font-bold mt-1 uppercase">
                Ingresa tus credenciales asignadas por el administrador de {selectedRest?.name}
              </p>
            </div>

            <form onSubmit={handleEmployeeLogin} className="space-y-4">
              {empLoginError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-500 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{empLoginError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Nombre de Usuario</label>
                <input
                  type="text"
                  required
                  value={empLoginUsername}
                  onChange={(e) => setEmpLoginUsername(e.target.value)}
                  placeholder="ej: cajero_mesa22"
                  className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-sm focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Contraseña</label>
                <input
                  type="password"
                  required
                  value={empLoginPassword}
                  onChange={(e) => setEmpLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-sm focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-black py-3.5 px-6 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
              >
                Ingresar al Turno
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full border border-gray-100 shadow-2xl relative my-8 animate-scale-in">
            <button
              onClick={() => setEditingProduct(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-slate-800 cursor-pointer p-1 rounded-full hover:bg-gray-50 transition"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Pencil className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Editar Platillo</h3>
              <p className="text-xs text-gray-400 font-bold mt-1 uppercase">
                Modifica los datos del platillo seleccionado.
              </p>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4">
              {editProdError && (
                <div className="p-3 bg-rose-50 border border-rose-150 text-rose-600 text-xs font-bold rounded-2xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{editProdError}</span>
                </div>
              )}

              {editProdSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-600 text-xs font-bold rounded-2xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{editProdSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Nombre del Platillo *</label>
                <input
                  type="text"
                  required
                  value={editProdName}
                  onChange={(e) => setEditProdName(e.target.value)}
                  placeholder="ej: Taco de Pastor al Carbón"
                  className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Precio ($) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={editProdPrice}
                  onChange={(e) => setEditProdPrice(e.target.value)}
                  placeholder="ej: 75.00"
                  className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">¿Es Alimento o Bebida? *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditProdType('FOOD')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-black transition cursor-pointer border ${
                      editProdType === 'FOOD'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-500/20'
                        : 'bg-gray-50 text-slate-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Utensils className="w-4 h-4" /> 🍲 Alimento
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditProdType('DRINK')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-black transition cursor-pointer border ${
                      editProdType === 'DRINK'
                        ? 'bg-sky-500 text-white border-sky-600 shadow-xs ring-2 ring-sky-500/20'
                        : 'bg-gray-50 text-slate-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <CupSoda className="w-4 h-4" /> 🥤 Bebida
                  </button>
                </div>
              </div>

              <ProductImageUploader
                value={editProdImage}
                onChange={setEditProdImage}
                label="Foto / Imagen del Platillo"
              />

              <div>
                <label className="block text-[10px] font-extrabold text-gray-400 uppercase mb-1.5">Descripción del Platillo</label>
                <textarea
                  rows={3}
                  value={editProdDescription}
                  onChange={(e) => setEditProdDescription(e.target.value)}
                  placeholder="ej: Elaborados con tortillas artesanales, cebolla asada, piña fresca y un toque picante de salsa verde..."
                  className="w-full bg-gray-50 border border-gray-200 text-slate-800 font-semibold rounded-2xl p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-hidden resize-none"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-800 font-extrabold py-3 px-5 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-5 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Ingreso Extra / Retiro de Caja */}
      {showCashTxModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl relative animate-scale-in">
            <button
              type="button"
              onClick={() => setShowCashTxModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 cursor-pointer p-1 rounded-full hover:bg-slate-50 transition"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs ${
                cashTxType === 'IN' 
                  ? 'bg-emerald-50 text-emerald-600' 
                  : 'bg-rose-50 text-rose-600'
              }`}>
                {cashTxType === 'IN' ? (
                  <PlusCircle className="w-8 h-8" />
                ) : (
                  <MinusCircle className="w-8 h-8" />
                )}
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                {cashTxType === 'IN' ? 'Ingreso Extra a Caja' : 'Retiro / Egreso de Caja'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {cashTxType === 'IN'
                  ? 'Ingresa la cantidad y el motivo para agregar dinero a la caja chica del turno.'
                  : 'Ingresa la cantidad y el motivo de la salida de dinero de la caja.'}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCashSessionTransaction(cashTxType);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5">
                  Monto de efectivo ($)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-black text-base">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    autoFocus
                    value={cashActionAmount}
                    onChange={(e) => setCashActionAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-black text-lg rounded-2xl pl-8 pr-4 py-3 focus:bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1.5">
                  Comentario / Motivo del {cashTxType === 'IN' ? 'ingreso' : 'retiro'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={cashActionReason}
                  onChange={(e) => setCashActionReason(e.target.value)}
                  placeholder={
                    cashTxType === 'IN'
                      ? 'Ejemplo: Fondo extra recibido, cambio inicial...'
                      : 'Ejemplo: Pago a proveedor, gastos de insumos...'
                  }
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-medium rounded-2xl p-3 text-xs focus:bg-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCashTxModal(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`w-1/2 py-3 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-1.5 ${
                    cashTxType === 'IN'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {cashTxType === 'IN' ? 'Confirmar Ingreso' : 'Confirmar Retiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SaaS Marketing Ad Popup for Basic Plan */}
      {showAdPopup && adConfig && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="basic_plan_ad_popup">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col relative text-slate-800">
            
            {/* Top Indicator */}
            <div className="bg-slate-950 px-4 py-2.5 flex items-center justify-between border-b border-slate-900">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider font-mono">Soporte de la Comunidad</span>
              </div>
            </div>

            {/* Ad Image Container */}
            <div className="relative aspect-video w-full bg-slate-50 flex items-center justify-center border-b border-slate-100 overflow-hidden group">
              {adConfig.imageUrl ? (
                <img
                  src={adConfig.imageUrl}
                  alt="Patrocinador Oficial"
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center p-8 text-slate-400 flex flex-col items-center gap-1.5">
                  <Megaphone className="w-8 h-8 text-slate-300 animate-bounce" />
                  <span className="text-xs font-black">Cargando patrocinador oficial...</span>
                </div>
              )}
            </div>

            {/* Content & CTA */}
            <div className="p-6 md:p-8 space-y-6">
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-850 text-base flex items-center gap-1.5">
                  <span className="bg-indigo-50 text-brand-primary p-1 rounded-lg">
                    <Heart className="w-4 h-4 text-rose-500" />
                  </span>
                  ¿Quieres apoyar a Mesa 22?
                </h4>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Mesa 22 es una iniciativa sin fines de lucro financiada de forma comunitaria. Tu donación voluntaria nos ayuda a costear los servidores, mejorar las comandas de cocina instantáneas, brindar soporte técnico constante y continuar optimizando el sistema para todos los restaurantes de manera libre.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={handleCloseAdPopup}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3.5 px-4 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer text-center"
                >
                  Cerrar
                </button>
                <a
                  href={`https://wa.me/523951347469?text=${encodeURIComponent("Hola, ¿me pasas por favor los datos bancarios para realizar mi donación?")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleCloseAdPopup}
                  className="bg-brand-primary hover:bg-brand-primary/90 text-white font-black py-3.5 px-4 rounded-2xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer text-center flex items-center justify-center gap-1"
                >
                  Hacer donación 💖
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Broadcast Announcement Popup Modal */}
      {showBroadcastPopup && broadcastData && broadcastData.active && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" id="network_broadcast_popup">
          <div className="bg-white rounded-3xl w-full max-w-sm sm:max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col relative text-slate-800 animate-scale-up">
            
            {/* Top Indicator Header */}
            <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-900">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-[10px] text-slate-200 font-black uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-rose-500" /> AVISO IMPORTANTE DE LA RED
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseBroadcastPopup}
                className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                title="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Square 1:1 Image Container */}
            <div className="relative aspect-square w-full bg-slate-950 flex items-center justify-center border-b border-slate-100 overflow-hidden">
              {broadcastData.imageUrl ? (
                <img
                  src={broadcastData.imageUrl}
                  alt="Aviso de la Red"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center p-8 text-slate-400 flex flex-col items-center gap-2">
                  <Bell className="w-10 h-10 text-rose-500 animate-bounce" />
                  <span className="text-xs font-black">Cargando aviso importante...</span>
                </div>
              )}
            </div>

            {/* Content & Action */}
            <div className="p-5 space-y-3.5">
              <h4 className="font-extrabold text-slate-850 text-sm text-center leading-snug">
                {broadcastData.title || 'Aviso Importante de la Red'}
              </h4>

              <button
                type="button"
                onClick={handleCloseBroadcastPopup}
                className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-black py-3.5 px-4 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer text-center shadow-lg flex items-center justify-center gap-2"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
