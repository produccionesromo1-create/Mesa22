/**
 * Mesa 22 - Type Definitions
 */

export interface City {
  id: string;
  name: string;
  createdAt: number;
  topRestaurants?: string[]; // Array of up to 3 restaurant IDs [top1, top2, top3]
}

export interface Restaurant {
  id: string;
  name: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  category: string;
  hours: string;
  openTime?: string;
  closeTime?: string;
  restDay?: string; // e.g., 'Ninguno', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
  deliveryZone: string;
  city?: string; // Associated city
  socials?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  plan?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  remainingDays?: number; // Days remaining before donation request popup appears
  remainingDaysUpdatedAt?: number; // Timestamp when remainingDays was set
  createdAt?: number;
  rating: number;
  reviewsCount: number;
  deliveryTime: string; // e.g. "30-40 min"
  deliveryFee: number;
  driverPayment?: number;
  featured?: boolean;
  tables?: string[];
  qrOrderingMode?: 'ALWAYS_ACTIVE' | 'ALWAYS_DISABLED' | 'AUTOMATIC';
}

export interface Product {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  prepTime: number; // in minutes
  available: boolean;
  type?: 'FOOD' | 'DRINK'; // 'FOOD' (Alimento) or 'DRINK' (Bebida)
  variants?: { name: string; options: string[] }[];
  extras?: { name: string; price: number }[];
  ingredients?: { ingredientId: string; qtyPerProduct: number }[];
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  photo: string;
  vehicle: 'Bicycle' | 'Motorcycle' | 'Car' | 'Other';
  licenseNumber?: string;
  workingZone: string;
  city?: string; // Associated city
  status: 'OFFLINE' | 'AVAILABLE' | 'DELIVERING' | 'SUSPENDED';
  rating: number;
}

export type OrderStatus =
  | 'PENDING'          // Cliente o mesero acaba de pedir
  | 'CONFIRMED'        // Restaurante aceptó el pedido
  | 'PREPARING'        // En cocina
  | 'READY'            // Listo para recoger / entregar
  | 'SERVED'           // Entregado a la mesa (unpaid)
  | 'ASSIGNED'         // Asignado a repartidor
  | 'SHIPPED'          // En camino
  | 'DELIVERED'        // Entregado con éxito (o pagado)
  | 'CANCELLED';       // Cancelado

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedVariant?: string;
  selectedExtras?: { name: string; price: number }[];
  notes?: string;
  sentToKitchen?: boolean;
}

export interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  city?: string; // Order city (from restaurant)
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  tableName?: string; // Solo para DINE_IN
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: 'CASH_ON_DELIVERY' | 'CASH_ON_PICKUP' | 'CASH_ON_TABLE';
  notes?: string;
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverPaymentRate?: number;
  kitchenNotes?: string;
  cashierPaid?: boolean;
  cashierPaidAt?: number;
  // Waiter & Billing workflow fields
  waiterId?: string;
  waiterName?: string;
  billRequested?: boolean;
  billRequestedAt?: number;
  customerBillRequestedFromWaiter?: boolean;
  customerBillRequestedFromWaiterAt?: number;
  splitBillsRequested?: boolean;
  qrUnlocked?: boolean; // Controls if table QR code ordering is enabled by waiter
  // Accounts splitting support
  splitBills?: {
    customerName: string;
    items: OrderItem[];
    total: number;
    paid: boolean;
    receivedAmount?: number;
    changeAmount?: number;
    paymentMethod?: 'EFECTIVO' | 'TARJETA';
  }[];
}

export interface Ingredient {
  id: string;
  restaurantId: string;
  name: string;
  stock: number;
  minStock: number; // Alerta de stock bajo
  unit: string; // e.g. "kg", "gr", "pz", "lt"
  supplierId?: string;
}

export interface Supplier {
  id: string;
  restaurantId: string;
  name: string;
  contact: string;
  phone: string;
  email?: string;
}

export interface Purchase {
  id: string;
  restaurantId: string;
  ingredientId: string;
  qty: number;
  cost: number;
  date: number;
  supplierId?: string;
}

export interface CashRegisterSession {
  id: string;
  restaurantId: string;
  openedAt: number;
  closedAt?: number;
  openedBy: string;
  initialAmount: number;
  finalAmount?: number;
  transactions: {
    type: 'IN' | 'OUT'; // IN: Venta, Depósito. OUT: Retiro, Pago a proveedor
    amount: number;
    reason: string;
    timestamp: number;
    paymentMethod?: 'EFECTIVO' | 'TARJETA';
  }[];
  status: 'OPEN' | 'CLOSED';
}

export interface Employee {
  id: string;
  restaurantId: string;
  name: string;
  username: string;
  password?: string;
  role: 'cajero' | 'mesero' | 'cocinero';
  status: 'active' | 'inactive';
  createdAt: number;
  deleted?: boolean;
}
