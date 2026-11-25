export type OrderStatus =
  | 'Pending'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled'
  | 'Refunded';

export type TrackingStage =
  | 'Payment Pending Verification'
  | 'Payment Verified & Packing'
  | 'Dispatched to Park'
  | 'In Transit'
  | 'Arrived at Destination Park'
  | 'Out for Delivery'
  | 'Delivered';

export const TRACKING_STAGES: TrackingStage[] = [
  'Payment Pending Verification',
  'Payment Verified & Packing',
  'Dispatched to Park',
  'In Transit',
  'Arrived at Destination Park',
  'Out for Delivery',
  'Delivered',
];

export type PaymentStatus =
  | 'Paid'
  | 'Pending Verification'
  | 'COD Pending'
  | 'Failed'
  | 'Refunded';

export type PaymentGatewayId =
  | 'stripe_card'
  | 'paystack'
  | 'paypal'
  | 'bank_transfer'
  | 'cod';

export type ProductCategory =
  | 'Solar panels'
  | 'Solar inverters'
  | 'Lithium batteries'
  | 'Tubular batteries'
  | 'Solar accessories'
  | 'Electrical materials'
  | 'Lighting products'
  | 'Cables and wires'
  | 'Switches and sockets'
  | 'Power protection equipment'
  | 'Solar installation solutions'
  | 'Electrical equipment';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Solar panels',
  'Solar inverters',
  'Lithium batteries',
  'Tubular batteries',
  'Solar accessories',
  'Electrical materials',
  'Lighting products',
  'Cables and wires',
  'Switches and sockets',
  'Power protection equipment',
  'Solar installation solutions',
  'Electrical equipment',
];

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: number;
  compareAtPrice: number;
  stock: number;
  image: string;
  description: string;
  wattage: string;
  warranty: string;
  specifications?: string;
  status: 'Active' | 'Draft' | 'Out of Stock';
  featured: boolean;
  isFlashSale?: boolean;
  flashSalePrice?: number;
  createdAt: string;
}

export interface PromoBanner {
  id: string;
  badgeText: string;
  badgeTone: 'red' | 'green';
  title: string;
  productId: string;
  image: string;
  ctaLabel: string;
  active: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderAmount: number;
  usageCount: number;
  active: boolean;
}

export interface PaymentGatewayConfig {
  id: PaymentGatewayId;
  name: string;
  description: string;
  enabled: boolean;
  mode: 'Test' | 'Live';
  publicKey: string;
  processingFeePercent: number;
  instructions: string;
}

export interface AboutMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  title: string;
  caption: string;
  specifications?: string;
  category: 'Solar Installation' | 'Electrical Store' | 'Team & Showroom';
  active: boolean;
  createdAt: string;
}

export interface CustomerAccount {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  initialCode: string;
  activeResetCode: string | null;
  resetCodeStatus: 'Assigned' | 'Active' | 'Expired' | 'Used';
  resetCodeExpiresAt: string | null;
  codeHistory: {
    code: string;
    reason: 'Registration' | 'Forgot Password' | 'Expired Regeneration';
    issuedAt: string;
    expiresAt: string | null;
  }[];
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  businessCategory: string;
  heroKicker: string;
  heroHeading: string;
  heroSubheading: string;
  heroDescription: string;
  aboutHeading: string;
  aboutDescription: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  address: string;
  landmark: string;
  businessHours: string;
  googleRating: string;
  googleReviewCount: number;
  targetCustomers: string[];
  currencySymbol: string;
  taxRatePercent: number;
  flatShippingFee: number;
  freeShippingThreshold: number;
  flashSalesHeading?: string;
  flashSalesSubheading?: string;
  heroImageUrl?: string;
  missionImageUrl?: string;
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingCode: string;
  };
  secondaryBankDetails?: {
    enabled: boolean;
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingCode: string;
  };
}

export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderCustomer {
  fullName: string;
  email: string;
  phone: string;
  state: string;
  lga: string;
  park: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface TrackingEvent {
  id: string;
  stage: TrackingStage;
  location: string;
  note: string;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  shippingFee: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: PaymentGatewayId;
  paymentMethodName: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  trackingStage: TrackingStage;
  trackingLocation?: string;
  waybillInfo?: string;
  estimatedDelivery?: string;
  trackingHistory: TrackingEvent[];
  receiptUrl?: string | null;
  transactionId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  transactionRef: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  gatewayId: PaymentGatewayId;
  gatewayName: string;
  grossAmount: number;
  gatewayFee: number;
  netAmount: number;
  status: PaymentStatus;
  mode: 'Test' | 'Live';
  createdAt: string;
}

export interface CustomerInquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  customerType: string;
  serviceType: string;
  propertyLocation?: string;
  estimatedLoad?: string;
  message: string;
  status: 'New' | 'Contacted' | 'Scheduled';
  createdAt: string;
}

export interface StorefrontData {
  products: Product[];
  banners: PromoBanner[];
  aboutMedia: AboutMediaItem[];
  settings: StoreSettings;
  gateways: PaymentGatewayConfig[];
  coupons: Pick<Coupon, 'code' | 'type' | 'value' | 'minOrderAmount' | 'active'>[];
}

export interface AdminDashboardData {
  products: Product[];
  banners: PromoBanner[];
  aboutMedia: AboutMediaItem[];
  orders: Order[];
  transactions: Transaction[];
  coupons: Coupon[];
  gateways: PaymentGatewayConfig[];
  settings: StoreSettings;
  inquiries: CustomerInquiry[];
  customers: CustomerAccount[];
  summary: {
    totalRevenue: number;
    paidRevenue: number;
    pendingRevenue: number;
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    avgOrderValue: number;
    lowStockCount: number;
    totalCustomers: number;
    registeredAccounts: number;
  };
}
