import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AboutMediaItem,
  AdminDashboardData,
  Coupon,
  CustomerAccount,
  CustomerInquiry,
  Order,
  OrderItem,
  OrderStatus,
  PaymentGatewayConfig,
  PaymentGatewayId,
  PaymentStatus,
  Product,
  PromoBanner,
  StoreSettings,
  TrackingEvent,
  TrackingStage,
  Transaction,
} from './src/types.ts';

dotenv.config();

const cleanEnv = (val: string | undefined): string => {
  const trimmed = (val || '').trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

interface StoredCustomerAccount extends CustomerAccount {
  passwordHash: string;
}

interface StoreDatabase {
  schemaVersion: number;
  adminAuthHash: string | null;
  nextOrderNumber: number;
  nextTrackingNumber: number;
  nextEmmyCodeNumber: number;
  nextExpCodeNumber: number;
  products: Product[];
  banners: PromoBanner[];
  aboutMedia: AboutMediaItem[];
  coupons: Coupon[];
  gateways: PaymentGatewayConfig[];
  settings: StoreSettings;
  orders: Order[];
  transactions: Transaction[];
  inquiries: CustomerInquiry[];
  customers: StoredCustomerAccount[];
}

const SCHEMA_VERSION = 5;
const IS_SERVERLESS = Boolean(
  process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);
const DATA_DIR = IS_SERVERLESS
  ? path.join('/tmp', 'emmystylez-data')
  : path.resolve(process.cwd(), '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const RECEIPTS_DIR = path.join(UPLOADS_DIR, 'receipts');
const DB_FILE = path.join(DATA_DIR, 'emmystylez-store.json');
const SESSION_SECRET =
  cleanEnv(process.env.SESSION_SECRET) ||
  crypto
    .createHash('sha256')
    .update(
      `emmystylez-session:${cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || cleanEnv(process.env.ADMIN_PASSCODE) || 'global-fallback-key'}`
    )
    .digest('hex');

const adminSessions = new Map<string, number>();
const customerSessions = new Map<string, { customerId: string; expiresAt: number }>();
const revokedTokens = new Map<string, number>();

interface LoginAttemptRecord {
  failures: number;
  lockedUntil: number;
}
const MAX_ADMIN_LOGIN_ATTEMPTS = 3;
const ADMIN_LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes cooldown after 3 failed admin attempts
const MAX_CUSTOMER_LOGIN_ATTEMPTS = 5;
const CUSTOMER_LOCKOUT_MS = 2 * 60 * 1000; // 2 minutes cooldown after 5 failed customer attempts
const adminLoginAttempts = new Map<string, LoginAttemptRecord>();
const customerLoginAttempts = new Map<string, LoginAttemptRecord>();

const getActiveLockoutSeconds = (
  store: Map<string, LoginAttemptRecord>,
  key: string
): { locked: boolean; retryAfterSeconds: number; lockedUntil: number } => {
  const rec = store.get(key);
  if (!rec) return { locked: false, retryAfterSeconds: 0, lockedUntil: 0 };
  const now = Date.now();
  if (rec.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((rec.lockedUntil - now) / 1000)),
      lockedUntil: rec.lockedUntil,
    };
  }
  if (rec.lockedUntil > 0 && rec.lockedUntil <= now) {
    store.delete(key);
  }
  return { locked: false, retryAfterSeconds: 0, lockedUntil: 0 };
};

const recordFailedAttempt = (
  store: Map<string, LoginAttemptRecord>,
  key: string,
  maxAttempts: number,
  lockoutMs: number
): { lockedNow: boolean; attemptsRemaining: number; retryAfterSeconds: number; lockedUntil: number } => {
  const existing = store.get(key) || { failures: 0, lockedUntil: 0 };
  const failures = existing.failures + 1;
  if (failures >= maxAttempts) {
    const lockedUntil = Date.now() + lockoutMs;
    store.set(key, { failures: 0, lockedUntil });
    return {
      lockedNow: true,
      attemptsRemaining: 0,
      retryAfterSeconds: Math.ceil(lockoutMs / 1000),
      lockedUntil,
    };
  }
  store.set(key, { failures, lockedUntil: 0 });
  return {
    lockedNow: false,
    attemptsRemaining: maxAttempts - failures,
    retryAfterSeconds: 0,
    lockedUntil: 0,
  };
};

const createInitialDatabase = (
  preservedAuthHash: string | null = null,
  preservedCustomers: StoredCustomerAccount[] = []
): StoreDatabase => {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

  const products: Product[] = [
    {
      id: 'prod-solar-panels',
      sku: 'EMM-PNL-400',
      name: '400W Monocrystalline Solar Panel',
      category: 'Solar panels',
      price: 145000,
      compareAtPrice: 185000,
      stock: 42,
      image: '/src/assets/images/product_solar_panels_1795501702594.jpg',
      description:
        'High-efficiency dual monocrystalline solar panels engineered for Nigerian rooftops, offices, shops, and commercial solar installations.',
      wattage: '400W Dual Monocrystalline',
      warranty: '25-Year Output Warranty',
      specifications: 'Voc: 49.2V · Efficiency: 22.4% · Tempered Anti-Reflective Glass · IP68 Junction Box',
      status: 'Active',
      featured: true,
      isFlashSale: true,
      flashSalePrice: 125000,
      createdAt: daysAgo(30),
    },
    {
      id: 'prod-solar-backpack',
      sku: 'EMM-ACC-060',
      name: 'Solar Installer Field Power Kit',
      category: 'Solar accessories',
      price: 92000,
      compareAtPrice: 135000,
      stock: 28,
      image: '/src/assets/images/product_solar_backpack_1795501703144.jpg',
      description:
        'Portable tactical solar accessory pack with mounting straps, DC/USB controller, and weather-sealed cabling for installers and field teams.',
      wattage: '60W Field Pack',
      warranty: '5-Year Field Warranty',
      specifications: 'Output: 18V DC + Dual USB-C · Waterproof Nylon · Heavy-Duty Buckles',
      status: 'Active',
      featured: true,
      isFlashSale: true,
      flashSalePrice: 75000,
      createdAt: daysAgo(28),
    },
    {
      id: 'prod-enphase-microinverter',
      sku: 'EMM-INV-IQ8',
      name: 'Enphase Smart Microinverter',
      category: 'Solar inverters',
      price: 195000,
      compareAtPrice: 245000,
      stock: 35,
      image: '/src/assets/images/product_microinverter_1795501704611.jpg',
      description:
        'Grid-forming smart solar microinverter with per-panel MPPT optimization, surge protection, and 97.6% conversion efficiency.',
      wattage: '366VA Smart Microinverter',
      warranty: '25-Year Limited Warranty',
      specifications: 'MPPT Range: 25-45V · Peak Efficiency: 97.6% · Rapid Shutdown Compliant',
      status: 'Active',
      featured: true,
      isFlashSale: false,
      createdAt: daysAgo(25),
    },
    {
      id: 'prod-blavor-charger',
      sku: 'EMM-LGT-030',
      name: 'Blavor Tri-Fold Solar Charger',
      category: 'Solar accessories',
      price: 68000,
      compareAtPrice: 95000,
      stock: 54,
      image: '/src/assets/images/product_foldable_charger_1795501704339.jpg',
      description:
        'Foldable portable solar charger with built-in power bank pouch and fast USB-C PD delivery for mobile electronics and backup lighting.',
      wattage: '30W Tri-Fold PD',
      warranty: '3-Year Warranty',
      specifications: '20,000mAh Buffer · 45W USB-C PD · ETFE Laminated Cells',
      status: 'Active',
      featured: true,
      isFlashSale: true,
      flashSalePrice: 54000,
      createdAt: daysAgo(22),
    },
    {
      id: 'prod-solar-house',
      sku: 'EMM-SOL-120',
      name: 'Home Off-Grid Solar Starter Kit',
      category: 'Solar installation solutions',
      price: 215000,
      compareAtPrice: 270000,
      stock: 19,
      image: '/src/assets/images/product_foldable_charger_1795501704339.jpg',
      description:
        'Complete plug-and-play solar installation kit with folding PV array, charge regulator, and universal MC4 solar wiring harness.',
      wattage: '120W Off-Grid Kit',
      warranty: '10-Year Performance Warranty',
      specifications: 'Includes MC4 Cables · MPPT Charge Controller · Residential & Shop Ready',
      status: 'Active',
      featured: true,
      isFlashSale: false,
      createdAt: daysAgo(20),
    },
    {
      id: 'prod-blueplanet-inverter',
      sku: 'EMM-INV-BP3',
      name: 'Blueplanet 3.5kVA Hybrid Inverter',
      category: 'Solar inverters',
      price: 345000,
      compareAtPrice: 410000,
      stock: 16,
      image: '/src/assets/images/product_wall_inverter_1795501705391.jpg',
      description:
        'Hybrid residential & office solar inverter with dual MPPT trackers, pure sine wave AC output, and battery BMS communication.',
      wattage: '3.5kVA / 24V Hybrid',
      warranty: '10-Year Standard Warranty',
      specifications: '230V AC Pure Sine · Dual MPPT · Supports Lithium & Tubular Batteries',
      status: 'Active',
      featured: true,
      isFlashSale: true,
      flashSalePrice: 299000,
      createdAt: daysAgo(18),
    },
    {
      id: 'prod-solar-light',
      sku: 'EMM-LGT-200',
      name: '200W Solar Floodlight Pro',
      category: 'Lighting products',
      price: 58000,
      compareAtPrice: 78000,
      stock: 61,
      image: '/src/assets/images/product_solar_floodlight_1795501705103.jpg',
      description:
        'Commercial-grade IP67 outdoor solar LED floodlight with integrated PV panel, dusk-to-dawn radar sensor, and LiFePO4 battery.',
      wattage: '200W LED / 24,000lm',
      warranty: '5-Year Outdoor Warranty',
      specifications: 'IP67 Waterproof · 6500K Daylight · 14-Hour Runtime · Remote Included',
      status: 'Active',
      featured: true,
      isFlashSale: true,
      flashSalePrice: 45000,
      createdAt: daysAgo(15),
    },
    {
      id: 'prod-eco-portable',
      sku: 'EMM-BAT-1088',
      name: 'EcoFlow 1088Wh LiFePO4 Power Station',
      category: 'Lithium batteries',
      price: 540000,
      compareAtPrice: 650000,
      stock: 22,
      image: '/src/assets/images/product_ecoflow_station_1795501705949.jpg',
      description:
        'High-capacity LiFePO4 lithium battery power station with 1800W AC inverter output, fast solar charging, and smart BMS protection.',
      wattage: '1088Wh LiFePO4 / 1800W',
      warranty: '5-Year Battery Warranty',
      specifications: '3,500+ Cycles · LiFePO4 Chemistry · Dual 230V AC & USB-C 100W',
      status: 'Active',
      featured: true,
      isFlashSale: true,
      flashSalePrice: 485000,
      createdAt: daysAgo(12),
    },
    {
      id: 'prod-portable-station-300',
      sku: 'EMM-BAT-320',
      name: 'Portable Lithium Power Station 300W',
      category: 'Lithium batteries',
      price: 265000,
      compareAtPrice: 315000,
      stock: 31,
      image: '/src/assets/images/product_portable_station_1795501706387.jpg',
      description:
        'Compact 320Wh portable lithium battery station for shops, home offices, and field technicians needing clean silent backup power.',
      wattage: '320Wh / 300W AC',
      warranty: '3-Year Warranty',
      specifications: 'Pure Sine Wave · Solar MPPT Input · LED Wattage Readout',
      status: 'Active',
      featured: false,
      isFlashSale: false,
      createdAt: daysAgo(10),
    },
    {
      id: 'prod-tubular-220ah',
      sku: 'EMM-TUB-220',
      name: 'Tall Tubular Solar Battery 220Ah',
      category: 'Tubular batteries',
      price: 295000,
      compareAtPrice: 340000,
      stock: 24,
      image: '/src/assets/images/product_ecoflow_station_1795501705949.jpg',
      description:
        'Deep-cycle 12V 220Ah tall tubular inverter battery engineered for long power outages and heavy daily residential/shop cycling.',
      wattage: '12V / 220Ah Deep Cycle',
      warranty: '36-Month Replacement Warranty',
      specifications: 'Low Antimony Alloy · Fast Recharge · High Electrolyte Reserve',
      status: 'Active',
      featured: false,
      isFlashSale: true,
      flashSalePrice: 265000,
      createdAt: daysAgo(9),
    },
    {
      id: 'prod-cables-kit',
      sku: 'EMM-CBL-6MM',
      name: '6mm Tinned Copper Solar Cable (100m)',
      category: 'Cables and wires',
      price: 78000,
      compareAtPrice: 96000,
      stock: 80,
      image: '/src/assets/images/product_solar_backpack_1795501703144.jpg',
      description:
        'UV-resistant double-insulated 6mm² tinned copper PV solar cable and heavy-gauge armoured electrical wiring for zero-loss power transfer.',
      wattage: '1500V DC Rated / 70A',
      warranty: '15-Year Insulation Warranty',
      specifications: 'TUV EN 50618 · Flame Retardant · Red & Black Pair Options',
      status: 'Active',
      featured: false,
      isFlashSale: false,
      createdAt: daysAgo(8),
    },
    {
      id: 'prod-protection-box',
      sku: 'EMM-PRT-SPD',
      name: 'AC/DC Solar Surge & Breaker Protection Box',
      category: 'Power protection equipment',
      price: 88000,
      compareAtPrice: 112000,
      stock: 37,
      image: '/src/assets/images/product_microinverter_1795501704611.jpg',
      description:
        'Pre-wired IP65 combiner & power protection distribution box with DC MCB, Type-2 surge arrestor (SPD), and automatic voltage protector.',
      wattage: '1000V DC / 63A AC SPD',
      warranty: '5-Year Hardware Warranty',
      specifications: 'DC Isolator · 40kA Lightning Surge Arrestor · DIN Rail Enclosure',
      status: 'Active',
      featured: false,
      isFlashSale: false,
      createdAt: daysAgo(7),
    },
    {
      id: 'prod-switches-sockets',
      sku: 'EMM-SWT-PRO',
      name: 'Smart Distribution Switches & Heavy Sockets Pack',
      category: 'Switches and sockets',
      price: 38000,
      compareAtPrice: 49000,
      stock: 95,
      image: '/src/assets/images/product_wall_inverter_1795501705391.jpg',
      description:
        'Fire-retardant polycarbonate 13A/20A switches, changeover switches, and commercial wall sockets for electrical wiring projects.',
      wattage: '250V / 20A Heavy Duty',
      warranty: '5-Year Warranty',
      specifications: 'Brass Terminals · Neon Indicator · BS1363 Compliant',
      status: 'Active',
      featured: false,
      isFlashSale: false,
      createdAt: daysAgo(6),
    },
    {
      id: 'prod-electrical-materials',
      sku: 'EMM-ELC-KIT',
      name: 'Contractor Electrical Materials & Conduit Bundle',
      category: 'Electrical materials',
      price: 115000,
      compareAtPrice: 145000,
      stock: 44,
      image: '/src/assets/images/product_solar_floodlight_1795501705103.jpg',
      description:
        'Complete electrical installation materials kit including PVC trunking, earth rods, copper lugs, DB box, and earthing accessories.',
      wattage: 'Full Site Wiring Pack',
      warranty: '3-Year Material Warranty',
      specifications: 'Copper Earth Rod · 12-Way DB · Trunking & Connectors',
      status: 'Active',
      featured: false,
      isFlashSale: false,
      createdAt: daysAgo(5),
    },
    {
      id: 'prod-electrical-equipment',
      sku: 'EMM-EQP-AVS',
      name: '5kVA Automatic Voltage Stabilizer & Changeover',
      category: 'Electrical equipment',
      price: 162000,
      compareAtPrice: 198000,
      stock: 27,
      image: '/src/assets/images/product_wall_inverter_1795501705391.jpg',
      description:
        'Heavy-duty digital servo voltage regulator and automatic grid/inverter changeover switch protecting appliances in homes and offices.',
      wattage: '5kVA Servo / 63A ATS',
      warranty: '3-Year Warranty',
      specifications: 'Input 130-260V · Digital LED Meter · Zero-Arc Relay',
      status: 'Active',
      featured: false,
      isFlashSale: false,
      createdAt: daysAgo(4),
    },
  ];

  const banners: PromoBanner[] = [
    {
      id: 'ban-1',
      badgeText: '20% Off',
      badgeTone: 'red',
      title: 'Portable Solar Panel',
      productId: 'prod-solar-panels',
      image: '/src/assets/images/product_solar_panels_1795501702594.jpg',
      ctaLabel: 'Shop Now',
      active: true,
    },
    {
      id: 'ban-2',
      badgeText: 'New Product',
      badgeTone: 'red',
      title: 'Portable Power Station',
      productId: 'prod-portable-station-300',
      image: '/src/assets/images/product_portable_station_1795501706387.jpg',
      ctaLabel: 'Shop Now',
      active: true,
    },
    {
      id: 'ban-3',
      badgeText: '50% Off',
      badgeTone: 'red',
      title: 'Solar Powered Charger',
      productId: 'prod-blavor-charger',
      image: '/src/assets/images/product_foldable_charger_1795501704339.jpg',
      ctaLabel: 'Shop Now',
      active: true,
    },
    {
      id: 'ban-4',
      badgeText: 'Sale 35% off',
      badgeTone: 'red',
      title: 'Eco flow Delta Portable Power',
      productId: 'prod-eco-portable',
      image: '/src/assets/images/product_ecoflow_station_1795501705949.jpg',
      ctaLabel: 'Shop Now',
      active: true,
    },
  ];

  const aboutMedia: AboutMediaItem[] = [
    {
      id: 'media-1',
      type: 'image',
      url: '/src/assets/images/hero_solar_engineer_1795501702895.jpg',
      title: 'Commercial Rooftop Solar Installation — Kogi State',
      caption: 'Full hybrid inverter and monocrystalline panel commissioning by our Ankpa field engineers.',
      specifications: 'System: 10kVA Hybrid Inverter · 16x 400W Panels · 15kWh LiFePO4 Bank · Surge SPD',
      category: 'Solar Installation',
      active: true,
      createdAt: daysAgo(12),
    },
    {
      id: 'media-2',
      type: 'image',
      url: '/src/assets/images/about_solar_engineer_1795501703000.jpg',
      title: 'Residential Roof Array & Pure Sine Inverter Pairing',
      caption: 'Certified solar installations tailored for homeowners, offices, shops, and contractors.',
      specifications: 'System: 5kVA 48V Inverter · 8x 450W Mono Panels · 6mm PV Tinned Copper Cable',
      category: 'Solar Installation',
      active: true,
      createdAt: daysAgo(9),
    },
    {
      id: 'media-3',
      type: 'image',
      url: '/src/assets/images/product_ecoflow_station_1795501705949.jpg',
      title: 'Balewa Road Showroom — Lithium & Inverter Stock',
      caption: 'Genuine lithium batteries, tubular batteries, cables, switches, and protection gear in stock.',
      specifications: 'Stock Spec: 1088Wh-5kWh LiFePO4 · 220Ah Tall Tubular · IP65 AC/DC Breakers',
      category: 'Electrical Store',
      active: true,
      createdAt: daysAgo(5),
    },
  ];

  const coupons: Coupon[] = [
    {
      id: 'cpn-1',
      code: 'SOLAR10',
      type: 'percent',
      value: 10,
      minOrderAmount: 50000,
      usageCount: 14,
      active: true,
    },
    {
      id: 'cpn-2',
      code: 'EMMY5K',
      type: 'fixed',
      value: 5000,
      minOrderAmount: 100000,
      usageCount: 6,
      active: true,
    },
  ];

  const gateways: PaymentGatewayConfig[] = [
    {
      id: 'bank_transfer',
      name: 'Direct Bank Transfer (Upload Receipt)',
      description: 'Transfer to Emmystylez official Nigerian bank account & upload transfer receipt',
      enabled: true,
      mode: 'Live',
      publicKey: 'EMMYSTYLEZ-BANK-NG',
      processingFeePercent: 0,
      instructions: 'Pay to the displayed account number, drag-and-drop your receipt, download PDF invoice, and click "I Have Sent".',
    },
    {
      id: 'paystack',
      name: 'Paystack Instant Checkout',
      description: 'Cards, Bank USSD & Instant Transfer via Paystack',
      enabled: false,
      mode: 'Live',
      publicKey: 'pk_live_paystack_emmystylez_84a1',
      processingFeePercent: 1.5,
      instructions: 'Instant authorization via Paystack merchant terminal.',
    },
    {
      id: 'stripe_card',
      name: 'Credit / Debit Card',
      description: 'Instant Visa, Mastercard, and Verve processing',
      enabled: false,
      mode: 'Live',
      publicKey: 'pk_live_emmystylez_51Nx92Kp',
      processingFeePercent: 2.9,
      instructions: 'Processed securely via encrypted card gateway.',
    },
    {
      id: 'cod',
      name: 'Pay at Balewa Road Store / Park Waybill COD',
      description: 'Pay on pickup opposite AP Filling Station, Ankpa or verified dispatch',
      enabled: true,
      mode: 'Live',
      publicKey: 'EMMYSTYLEZ-COD-ANKPA',
      processingFeePercent: 0,
      instructions: 'Available for Ankpa store pickup and verified park dispatch.',
    },
  ];

  const settings: StoreSettings = {
    storeName: 'Emmystylez Solar Electrical Store',
    businessCategory: 'Solar Energy Equipment Supplier · Electrical Equipment Store · Electronics Wholesaler',
    heroKicker: 'Solar Energy for a Brighter Tomorrow',
    heroHeading: 'ENERGY DISCOVER',
    heroSubheading: 'Our Solar Shop',
    heroDescription:
      'Emmystylez Solar Electrical Store — reliable solar energy products, inverters, batteries, electrical materials, and professional solar installations in Ankpa, Kogi State.',
    aboutHeading: 'Engineered for Unstoppable Power, Built on Unshakeable Integrity',
    aboutDescription:
      'Emmystylez Solar Electrical Store is a premier solar and electrical equipment partner delivering certified solar panels, hybrid inverters, lithium & tubular batteries, heavy-duty cables, switches, lighting, and industrial power protection across all 36 states of Nigeria and the FCT.',
    supportEmail: 'enquiries@emmystylezsolar.com',
    supportPhone: '+234 816 385 5656',
    whatsappNumber: '+234 816 385 5656',
    address: 'Balewa Road, opposite AP Filling Station, Ankpa, Kogi State, Nigeria',
    landmark: 'Opposite AP Filling Station, Balewa Road, Ankpa, Kogi State, Nigeria',
    businessHours: 'Monday – Saturday, 8:00 AM – 6:00 PM',
    googleRating: '5.0',
    googleReviewCount: 3,
    targetCustomers: [
      'Homeowners',
      'Businesses',
      'Offices',
      'Shops',
      'Contractors',
      'Solar installers',
      'Individuals seeking alternative power solutions',
    ],
    currencySymbol: '₦',
    taxRatePercent: 0,
    flatShippingFee: 5000,
    freeShippingThreshold: 2500000,
    flashSalesHeading: 'Flash Sales Deals',
    flashSalesSubheading: 'Limited-time factory pricing on high-demand solar panels, hybrid inverters & batteries',
    heroImageUrl: '/src/assets/images/hero-showcase.jpg',
    missionImageUrl: '/src/assets/images/leadership-photo.png',
    bankDetails: {
      bankName: 'UBA BANK',
      accountName: 'Emmystylez',
      accountNumber: '1028336645',
      routingCode: 'UNAFNGLA',
    },
    secondaryBankDetails: {
      enabled: true,
      bankName: 'Opay',
      accountName: 'Maji Emmanuel',
      accountNumber: '6105470722',
      routingCode: 'OPAYNG',
    },
  };

  const orders: Order[] = [];
  const transactions: Transaction[] = [];
  const inquiries: CustomerInquiry[] = [];

  return {
    schemaVersion: SCHEMA_VERSION,
    adminAuthHash: preservedAuthHash,
    nextOrderNumber: 1001,
    nextTrackingNumber: 1001,
    nextEmmyCodeNumber: 1001,
    nextExpCodeNumber: 1001,
    products,
    banners,
    aboutMedia,
    coupons,
    gateways,
    settings,
    orders,
    transactions,
    inquiries,
    customers: preservedCustomers || [],
  };
};

const DB_BACKUP_FILE = `${DB_FILE}.bak`;

// Optional Global Supabase Persistence (activated automatically via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
let supabaseClient: SupabaseClient | null = null;
const supabaseStatus = {
  configured: false,
  connected: false,
  urlHost: null as string | null,
  lastSyncAt: null as string | null,
  lastError: null as string | null,
};

(() => {
  const rawUrl = cleanEnv(
    process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL
  );
  const serviceKey = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  );
  if (rawUrl && serviceKey) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        const normalizedUrl = `${parsed.protocol}//${parsed.host}`;
        supabaseClient = createClient(normalizedUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        supabaseStatus.configured = true;
        supabaseStatus.urlHost = parsed.host;
      }
    } catch {
      supabaseStatus.lastError = 'Invalid SUPABASE_URL format.';
    }
  }
})();

let mediaBucketVerified = false;
const ensureMediaBucketPublic = async (): Promise<void> => {
  if (!supabaseClient || mediaBucketVerified) return;
  try {
    const { data, error } = await supabaseClient.storage.getBucket('emmystylez-media');
    if (error && /not found/i.test(error.message || '')) {
      await supabaseClient.storage
        .createBucket('emmystylez-media', { public: true })
        .catch(() => {});
    } else if (data && data.public === false) {
      await supabaseClient.storage
        .updateBucket('emmystylez-media', { public: true })
        .catch(() => {});
    }
    mediaBucketVerified = true;
  } catch {
    // Non-fatal check
  }
};

const uploadBufferToSupabaseStorage = async (
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> => {
  if (!supabaseClient) return null;
  try {
    await ensureMediaBucketPublic();
    let { error } = await supabaseClient.storage
      .from('emmystylez-media')
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error && /bucket/i.test(error.message || '')) {
      await supabaseClient.storage
        .createBucket('emmystylez-media', { public: true })
        .catch(() => {});
      const retry = await supabaseClient.storage
        .from('emmystylez-media')
        .upload(storagePath, buffer, { contentType, upsert: true });
      error = retry.error;
    }

    if (error) {
      console.error('Supabase storage upload error:', error.message);
      return null;
    }
    const { data } = supabaseClient.storage.from('emmystylez-media').getPublicUrl(storagePath);
    return data?.publicUrl || null;
  } catch (err) {
    console.error('Supabase storage upload exception:', err);
    return null;
  }
};

let siteAssetsSynced = false;
const ensureSiteAssetsInSupabaseStorage = async (): Promise<void> => {
  if (!supabaseClient || siteAssetsSynced) return;
  siteAssetsSynced = true;
  try {
    const candidateDirs = [
      path.resolve(process.cwd(), 'src/assets/images'),
      path.resolve(process.cwd(), 'public/src/assets/images'),
      path.resolve(process.cwd(), 'dist/src/assets/images'),
    ];
    const sourceDir = candidateDirs.find((dir) => fs.existsSync(dir));
    if (!sourceDir) return;

    const { data: existingList } = await supabaseClient.storage
      .from('emmystylez-media')
      .list('site-assets', { limit: 100 });
    const existingNames = new Set((existingList || []).map((f) => f.name));

    const files = fs.readdirSync(sourceDir);
    for (const file of files) {
      if (existingNames.has(file)) continue;
      const fullPath = path.join(sourceDir, file);
      if (!fs.statSync(fullPath).isFile()) continue;
      const ext = path.extname(file).toLowerCase();
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.svg'
              ? 'image/svg+xml'
              : 'image/jpeg';
      const buf = fs.readFileSync(fullPath);
      await uploadBufferToSupabaseStorage(`site-assets/${file}`, buf, mime);
    }
  } catch {
    // Non-fatal background sync
  }
};

let supabaseSyncQueue: Promise<void> = Promise.resolve();

const syncToSupabase = async (snapshot: StoreDatabase): Promise<void> => {
  if (!supabaseClient) return;
  try {
    const nowIso = new Date().toISOString();
    const { error: stateErr } = await supabaseClient
      .from('emmystylez_store_state')
      .upsert(
        {
          id: 'primary',
          schema_version: snapshot.schemaVersion,
          state: snapshot,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );

    if (stateErr) {
      supabaseStatus.connected = false;
      supabaseStatus.lastError = stateErr.message;
      return;
    }

    // Best-effort sync to normalized relational tables so rows are visible in Supabase Table Editor
    const relationalOps: PromiseLike<unknown>[] = [
      supabaseClient.from('store_settings').upsert(
        {
          id: 'default',
          store_name: snapshot.settings.storeName,
          business_category: snapshot.settings.businessCategory,
          address: snapshot.settings.address,
          landmark: snapshot.settings.landmark,
          whatsapp_number: snapshot.settings.whatsappNumber,
          support_email: snapshot.settings.supportEmail,
          support_phone: snapshot.settings.supportPhone,
          business_hours: snapshot.settings.businessHours,
          currency_symbol: snapshot.settings.currencySymbol,
          tax_rate_percent: snapshot.settings.taxRatePercent,
          flat_shipping_fee: snapshot.settings.flatShippingFee,
          free_shipping_threshold: snapshot.settings.freeShippingThreshold,
          hero_image_url: snapshot.settings.heroImageUrl || null,
          mission_image_url: snapshot.settings.missionImageUrl || null,
          bank_1_name: snapshot.settings.bankDetails.bankName,
          bank_1_account_name: snapshot.settings.bankDetails.accountName,
          bank_1_account_number: snapshot.settings.bankDetails.accountNumber,
          bank_2_enabled: snapshot.settings.secondaryBankDetails?.enabled !== false,
          bank_2_name: snapshot.settings.secondaryBankDetails?.bankName || null,
          bank_2_account_name: snapshot.settings.secondaryBankDetails?.accountName || null,
          bank_2_account_number: snapshot.settings.secondaryBankDetails?.accountNumber || null,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      ),
    ];

    if (snapshot.products.length > 0) {
      const activeIds = snapshot.products.map((p) => p.id);
      relationalOps.push(
        supabaseClient.from('products').delete().not('id', 'in', `(${activeIds.join(',')})`),
        supabaseClient.from('products').upsert(
          snapshot.products.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            price: p.price,
            compare_at_price: p.compareAtPrice,
            stock: p.stock,
            image: p.image,
            description: p.description,
            wattage: p.wattage,
            warranty: p.warranty,
            specifications: p.specifications,
            status: p.status,
            featured: p.featured,
            is_flash_sale: Boolean(p.isFlashSale),
            flash_sale_price: p.flashSalePrice ?? null,
            created_at: p.createdAt,
          })),
          { onConflict: 'id' }
        )
      );
    } else {
      relationalOps.push(
        supabaseClient.from('products').delete().neq('id', 'EMPTY_SENTINEL')
      );
    }

    if (snapshot.banners.length > 0) {
      const activeIds = snapshot.banners.map((b) => b.id);
      relationalOps.push(
        supabaseClient.from('promo_banners').delete().not('id', 'in', `(${activeIds.join(',')})`),
        supabaseClient.from('promo_banners').upsert(
          snapshot.banners.map((b) => ({
            id: b.id,
            badge_text: b.badgeText,
            badge_tone: b.badgeTone,
            title: b.title,
            product_id: b.productId,
            image: b.image,
            cta_label: b.ctaLabel,
            active: b.active,
          })),
          { onConflict: 'id' }
        )
      );
    } else {
      relationalOps.push(
        supabaseClient.from('promo_banners').delete().neq('id', 'EMPTY_SENTINEL')
      );
    }

    if (snapshot.aboutMedia.length > 0) {
      const activeIds = snapshot.aboutMedia.map((m) => m.id);
      relationalOps.push(
        supabaseClient.from('gallery_media').delete().not('id', 'in', `(${activeIds.join(',')})`),
        supabaseClient.from('gallery_media').upsert(
          snapshot.aboutMedia.map((m) => ({
            id: m.id,
            type: m.type,
            title: m.title,
            specifications: m.specifications,
            caption: m.caption,
            category: m.category,
            url: m.url,
            active: m.active,
            created_at: m.createdAt,
          })),
          { onConflict: 'id' }
        )
      );
    } else {
      relationalOps.push(
        supabaseClient.from('gallery_media').delete().neq('id', 'EMPTY_SENTINEL')
      );
    }

    if (snapshot.orders.length > 0) {
      const activeIds = snapshot.orders.map((o) => o.id);
      relationalOps.push(
        supabaseClient.from('orders').delete().not('id', 'in', `(${activeIds.join(',')})`),
        supabaseClient.from('orders').upsert(
          snapshot.orders.map((o) => ({
            id: o.id,
            order_number: o.orderNumber,
            tracking_number: o.trackingNumber,
            customer_name: o.customer.fullName,
            customer_email: o.customer.email,
            customer_phone: o.customer.phone,
            delivery_state: o.customer.state || '',
            delivery_lga: o.customer.lga || o.customer.city || '',
            delivery_park: o.customer.park || '',
            delivery_address: o.customer.address || '',
            subtotal: o.subtotal,
            discount_amount: o.discountAmount,
            coupon_code: o.couponCode,
            shipping_fee: o.shippingFee,
            tax_amount: o.taxAmount,
            total_amount: o.totalAmount,
            payment_method: o.paymentMethod,
            payment_method_name: o.paymentMethodName,
            payment_status: o.paymentStatus,
            order_status: o.orderStatus,
            tracking_stage: o.trackingStage,
            tracking_location: o.trackingLocation,
            waybill_info: o.waybillInfo,
            estimated_delivery: o.estimatedDelivery,
            tracking_history: o.trackingHistory,
            receipt_url: o.receiptUrl,
            transaction_id: o.transactionId,
            notes: o.notes,
            created_at: o.createdAt,
            updated_at: o.updatedAt,
          })),
          { onConflict: 'id' }
        )
      );
    } else {
      relationalOps.push(
        supabaseClient.from('orders').delete().neq('id', 'EMPTY_SENTINEL')
      );
    }

    if (snapshot.coupons.length > 0) {
      const activeIds = snapshot.coupons.map((c) => c.id);
      relationalOps.push(
        supabaseClient.from('coupons').delete().not('id', 'in', `(${activeIds.join(',')})`),
        supabaseClient.from('coupons').upsert(
          snapshot.coupons.map((c) => ({
            id: c.id,
            code: c.code,
            type: c.type,
            value: c.value,
            min_order_amount: c.minOrderAmount,
            active: c.active,
            usage_count: c.usageCount,
          })),
          { onConflict: 'id' }
        )
      );
    } else {
      relationalOps.push(
        supabaseClient.from('coupons').delete().neq('id', 'EMPTY_SENTINEL')
      );
    }

    if (snapshot.gateways.length > 0) {
      relationalOps.push(
        supabaseClient.from('payment_gateways').upsert(
          snapshot.gateways.map((g) => ({
            id: g.id,
            name: g.name,
            provider: g.description || g.id,
            enabled: g.enabled,
            mode: g.mode,
            public_key: g.publicKey,
            instructions: g.instructions,
            fee_percent: g.processingFeePercent,
            settlement_days: 0,
          })),
          { onConflict: 'id' }
        )
      );
    }

    if (snapshot.customers.length > 0) {
      const activeIds = snapshot.customers.map((c) => c.id);
      relationalOps.push(
        supabaseClient.from('customers').delete().not('id', 'in', `(${activeIds.join(',')})`),
        supabaseClient.from('customers').upsert(
          snapshot.customers.map((cu) => ({
            id: cu.id,
            full_name: cu.fullName,
            email: cu.email,
            phone: cu.phone,
            password_hash: cu.passwordHash,
            active_reset_code: cu.activeResetCode,
            reset_code_status: cu.resetCodeStatus,
            reset_code_expires_at: cu.resetCodeExpiresAt,
            created_at: cu.createdAt,
          })),
          { onConflict: 'id' }
        )
      );
    } else {
      relationalOps.push(
        supabaseClient.from('customers').delete().neq('id', 'EMPTY_SENTINEL')
      );
    }

    if (snapshot.transactions.length > 0) {
      const activeIds = snapshot.transactions.map((t) => t.id);
      relationalOps.push(
        supabaseClient.from('transactions').delete().not('id', 'in', `(${activeIds.join(',')})`),
        supabaseClient.from('transactions').upsert(
          snapshot.transactions.map((tx) => ({
            id: tx.id,
            transaction_ref: tx.transactionRef,
            order_id: tx.orderId,
            order_number: tx.orderNumber,
            customer_name: tx.customerName,
            customer_email: tx.customerEmail,
            gateway_id: tx.gatewayId,
            gateway_name: tx.gatewayName,
            gross_amount: tx.grossAmount,
            gateway_fee: tx.gatewayFee,
            net_amount: tx.netAmount,
            status: tx.status,
            mode: tx.mode,
            created_at: tx.createdAt,
          })),
          { onConflict: 'id' }
        )
      );
    } else {
      relationalOps.push(
        supabaseClient.from('transactions').delete().neq('id', 'EMPTY_SENTINEL')
      );
    }

    if (snapshot.inquiries.length > 0) {
      const activeIds = snapshot.inquiries.map((i) => i.id);
      relationalOps.push(
        supabaseClient.from('customer_inquiries').delete().not('id', 'in', `(${activeIds.join(',')})`),
        supabaseClient.from('customer_inquiries').upsert(
          snapshot.inquiries.map((inq) => ({
            id: inq.id,
            name: inq.name,
            email: inq.email,
            phone: inq.phone,
            customer_type: inq.customerType,
            service_type: inq.serviceType,
            property_location: inq.propertyLocation,
            estimated_load: inq.estimatedLoad,
            message: inq.message,
            status: inq.status,
            created_at: inq.createdAt,
          })),
          { onConflict: 'id' }
        )
      );
    } else {
      relationalOps.push(
        supabaseClient.from('customer_inquiries').delete().neq('id', 'EMPTY_SENTINEL')
      );
    }

    await Promise.allSettled(relationalOps);

    supabaseStatus.connected = true;
    supabaseStatus.lastSyncAt = nowIso;
    supabaseStatus.lastError = null;
    lastRemoteUpdatedAt = nowIso;
  } catch (err) {
    supabaseStatus.connected = false;
    supabaseStatus.lastError = err instanceof Error ? err.message : 'Supabase sync error';
  }
};

let lastHydratedAt = 0;
let lastRemoteUpdatedAt: string | null = null;
let hasHydratedFromSupabase = false;
let hydrationInFlight: Promise<void> | null = null;

const writeLocalDatabaseFile = (database: StoreDatabase): void => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = JSON.stringify(database, null, 2);
    const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpFile, serialized, 'utf-8');
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, DB_BACKUP_FILE);
      } catch {
        // Non-fatal backup copy skip
      }
    }
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    if (!IS_SERVERLESS) {
      console.warn('Local DB write notice:', err instanceof Error ? err.message : err);
    }
  }
};

const saveDatabase = (database: StoreDatabase): void => {
  lastHydratedAt = Date.now();
  writeLocalDatabaseFile(database);
  if (supabaseClient) {
    const snapshot = JSON.parse(JSON.stringify(database)) as StoreDatabase;
    supabaseSyncQueue = supabaseSyncQueue.then(() => syncToSupabase(snapshot));
  }
};

const saveDatabaseAsync = async (database: StoreDatabase): Promise<void> => {
  saveDatabase(database);
  if (supabaseClient) {
    await supabaseSyncQueue;
  }
};

const isDefaultSeedGallery = (media: AboutMediaItem[] | undefined): boolean => {
  if (!Array.isArray(media) || media.length !== 3) return false;
  return (
    media[0]?.id === 'media-1' &&
    media[1]?.id === 'media-2' &&
    media[2]?.id === 'media-3'
  );
};

const hydrateFromSupabase = async (): Promise<void> => {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from('emmystylez_store_state')
      .select('state, updated_at')
      .eq('id', 'primary')
      .maybeSingle();

    if (error) {
      supabaseStatus.connected = false;
      supabaseStatus.lastError = error.message;
      console.warn('Supabase read check notice:', error.message);
      return;
    }

    if (data && data.state && typeof data.state === 'object') {
      const remoteDb = data.state as StoreDatabase;
      if (Array.isArray(remoteDb.products) && remoteDb.settings) {
        const localUploadedMedia = (db.aboutMedia || []).filter(
          (m) => m?.id && !['media-1', 'media-2', 'media-3'].includes(m.id)
        );
        const shouldRecoverLocalMedia =
          !hasHydratedFromSupabase &&
          localUploadedMedia.length > 0 &&
          (remoteDb.orders?.length || 0) === 0 &&
          isDefaultSeedGallery(remoteDb.aboutMedia);

        db = remoteDb;
        if (!db.customers) db.customers = [];
        if (!db.aboutMedia) db.aboutMedia = [];
        if (!db.orders) db.orders = [];
        if (!db.transactions) db.transactions = [];
        if (!db.inquiries) db.inquiries = [];
        if (!db.banners) db.banners = [];
        if (!db.coupons) db.coupons = [];
        if (
          !db.settings.heroImageUrl ||
          db.settings.heroImageUrl.includes('i.ibb.co/5hvHYxLt/IMG-20261120-WA0081.jpg')
        ) {
          db.settings.heroImageUrl = '/src/assets/images/hero-showcase.jpg';
        }
        if (
          !db.settings.missionImageUrl ||
          db.settings.missionImageUrl.includes('i.ibb.co/GQdg80PP/leadership-photo.png')
        ) {
          db.settings.missionImageUrl = '/src/assets/images/leadership-photo.png';
        }

        if (shouldRecoverLocalMedia) {
          db.aboutMedia = localUploadedMedia;
          await syncToSupabase(db);
        }

        hasHydratedFromSupabase = true;
        writeLocalDatabaseFile(db);
        lastHydratedAt = Date.now();
        lastRemoteUpdatedAt = supabaseStatus.lastSyncAt || data.updated_at || null;
        supabaseStatus.connected = true;
        supabaseStatus.lastSyncAt = lastRemoteUpdatedAt || new Date().toISOString();
        supabaseStatus.lastError = null;
        void ensureSiteAssetsInSupabaseStorage();
        return;
      }
    }

    // Only seed an empty brand-new Supabase table when zero rows exist
    if (!hasHydratedFromSupabase && data === null) {
      await syncToSupabase(db);
      hasHydratedFromSupabase = true;
      lastHydratedAt = Date.now();
      if (supabaseStatus.connected) {
        console.log('Seeded initial Emmystylez store data into Supabase globally.');
      }
    }
  } catch (err) {
    supabaseStatus.connected = false;
    supabaseStatus.lastError = err instanceof Error ? err.message : 'Supabase connection error';
  }
};

const ensureLatestState = async (force = false): Promise<void> => {
  if (!supabaseClient) return;
  const maxAgeMs = IS_SERVERLESS ? 1200 : 2500;
  if (!force && lastHydratedAt > 0 && Date.now() - lastHydratedAt < maxAgeMs) {
    return;
  }
  if (!force && lastRemoteUpdatedAt) {
    try {
      const { data, error } = await supabaseClient
        .from('emmystylez_store_state')
        .select('updated_at')
        .eq('id', 'primary')
        .maybeSingle();
      if (!error && data?.updated_at === lastRemoteUpdatedAt) {
        lastHydratedAt = Date.now();
        supabaseStatus.connected = true;
        supabaseStatus.lastError = null;
        return;
      }
    } catch {
      // Fall through to full hydration attempt
    }
  }
  if (!hydrationInFlight) {
    hydrationInFlight = hydrateFromSupabase().finally(() => {
      hydrationInFlight = null;
    });
  }
  await hydrationInFlight;
};

const normalizeLoadedDb = (parsed: StoreDatabase): StoreDatabase => {
  if (parsed.schemaVersion === 3 || parsed.schemaVersion === 4) {
    const wasV3 = parsed.schemaVersion === 3;
    parsed.schemaVersion = SCHEMA_VERSION;
    const shouldUpdateBank1 =
      !parsed.settings.bankDetails ||
      parsed.settings.bankDetails.accountNumber === '3084921056';
    const shouldUpdateBank2 =
      !parsed.settings.secondaryBankDetails ||
      parsed.settings.secondaryBankDetails.accountNumber === '8163855656';

    parsed.settings = {
      ...parsed.settings,
      heroImageUrl:
        parsed.settings.heroImageUrl &&
        !parsed.settings.heroImageUrl.includes('i.ibb.co/5hvHYxLt/IMG-20261120-WA0081.jpg')
          ? parsed.settings.heroImageUrl
          : '/src/assets/images/hero-showcase.jpg',
      missionImageUrl:
        parsed.settings.missionImageUrl &&
        !parsed.settings.missionImageUrl.includes('i.ibb.co/GQdg80PP/leadership-photo.png')
          ? parsed.settings.missionImageUrl
          : '/src/assets/images/leadership-photo.png',
      bankDetails: shouldUpdateBank1
        ? {
            bankName: 'UBA BANK',
            accountName: 'Emmystylez',
            accountNumber: '1028336645',
            routingCode: 'UNAFNGLA',
          }
        : parsed.settings.bankDetails,
      secondaryBankDetails: shouldUpdateBank2
        ? {
            enabled: true,
            bankName: 'Opay',
            accountName: 'Maji Emmanuel',
            accountNumber: '6105470722',
            routingCode: 'OPAYNG',
          }
        : parsed.settings.secondaryBankDetails,
    };
    if (wasV3 && Array.isArray(parsed.gateways)) {
      for (const gw of parsed.gateways) {
        if (gw.id === 'paystack' || gw.id === 'stripe_card') {
          gw.enabled = false;
        }
      }
    }
  } else if (parsed.schemaVersion !== SCHEMA_VERSION) {
    return createInitialDatabase(parsed.adminAuthHash ?? null, parsed.customers ?? []);
  }
  if (!parsed.nextTrackingNumber) parsed.nextTrackingNumber = 1001;
  if (!parsed.nextEmmyCodeNumber) parsed.nextEmmyCodeNumber = 1001;
  if (!parsed.nextExpCodeNumber) parsed.nextExpCodeNumber = 1001;
  if (!parsed.customers) parsed.customers = [];
  if (!parsed.aboutMedia) parsed.aboutMedia = [];
  if (
    !parsed.settings.heroImageUrl ||
    parsed.settings.heroImageUrl.includes('i.ibb.co/5hvHYxLt/IMG-20261120-WA0081.jpg')
  ) {
    parsed.settings.heroImageUrl = '/src/assets/images/hero-showcase.jpg';
  }
  if (
    !parsed.settings.missionImageUrl ||
    parsed.settings.missionImageUrl.includes('i.ibb.co/GQdg80PP/leadership-photo.png')
  ) {
    parsed.settings.missionImageUrl = '/src/assets/images/leadership-photo.png';
  }
  if (!parsed.settings.secondaryBankDetails) {
    parsed.settings.secondaryBankDetails = {
      enabled: true,
      bankName: 'Opay',
      accountName: 'Maji Emmanuel',
      accountNumber: '6105470722',
      routingCode: 'OPAYNG',
    };
  }
  return parsed;
};

const loadDatabase = (): StoreDatabase => {
  // CRITICAL: loadDatabase() must NEVER call saveDatabase() or syncToSupabase(),
  // otherwise a serverless/container cold start would overwrite global Supabase with seed data
  // before hydrateFromSupabase() can read the real remote state.
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    if (!fs.existsSync(RECEIPTS_DIR)) {
      fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return normalizeLoadedDb(JSON.parse(raw) as StoreDatabase);
    }
    if (fs.existsSync(DB_BACKUP_FILE)) {
      const backupRaw = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
      const backupParsed = JSON.parse(backupRaw) as StoreDatabase;
      if (backupParsed && Array.isArray(backupParsed.products)) {
        return normalizeLoadedDb(backupParsed);
      }
    }
    const initial = createInitialDatabase();
    if (!supabaseClient) {
      writeLocalDatabaseFile(initial);
    }
    return initial;
  } catch (error) {
    console.error('Primary DB load failed, attempting backup recovery:', error);
    try {
      if (fs.existsSync(DB_BACKUP_FILE)) {
        const backupRaw = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
        const backupParsed = JSON.parse(backupRaw) as StoreDatabase;
        if (backupParsed && Array.isArray(backupParsed.products)) {
          return normalizeLoadedDb(backupParsed);
        }
      }
    } catch (backupErr) {
      console.error('Backup DB recovery also failed:', backupErr);
    }
    const initial = createInitialDatabase();
    if (!supabaseClient) {
      writeLocalDatabaseFile(initial);
    }
    return initial;
  }
};

let db: StoreDatabase = loadDatabase();

const hashSecret = (secret: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret, salt, 64).toString('hex');
  return `${salt}:${derived}`;
};

const verifySecretHash = (secret: string, stored: string): boolean => {
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(secret, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
};

const verifyEnvPasscode = (input: string, envValue: string): boolean => {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(envValue).digest();
  return crypto.timingSafeEqual(a, b);
};

interface SignedSessionPayload {
  r: 'adm' | 'cus';
  s?: string;
  e: number;
  n: string;
}

const signSessionPayload = (payload: SignedSessionPayload): string => {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const raw = `${payload.r}_${encoded}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('base64url');
  return `${raw}.${sig}`;
};

const verifySignedSessionPayload = (token: string): SignedSessionPayload | null => {
  if (!token || revokedTokens.has(token)) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [raw, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('base64url');
  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expectedSig, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const sepIdx = raw.indexOf('_');
  if (sepIdx === -1) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(raw.slice(sepIdx + 1), 'base64url').toString('utf-8')
    ) as SignedSessionPayload;
    if (!decoded || typeof decoded.e !== 'number' || decoded.e < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
};

const issueAdminSessionToken = (): string => {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const token = signSessionPayload({
    r: 'adm',
    e: expiresAt,
    n: crypto.randomBytes(12).toString('hex'),
  });
  adminSessions.set(token, expiresAt);
  return token;
};

const verifyAdminSessionToken = (token: string): boolean => {
  const payload = verifySignedSessionPayload(token);
  return Boolean(payload && payload.r === 'adm');
};

const issueCustomerSessionToken = (customerId: string): string => {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const token = signSessionPayload({
    r: 'cus',
    s: customerId,
    e: expiresAt,
    n: crypto.randomBytes(12).toString('hex'),
  });
  customerSessions.set(token, { customerId, expiresAt });
  return token;
};

const verifyCustomerSessionToken = (token: string): string | null => {
  const payload = verifySignedSessionPayload(token);
  if (!payload || payload.r !== 'cus' || !payload.s) return null;
  return payload.s;
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!verifyAdminSessionToken(token)) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  next();
};

const normalizePhoneDigits = (phone: string): string => phone.replace(/\D/g, '');

const validateStrongPassword = (password: string): string | null => {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least 1 uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least 1 lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least 1 digit.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least 1 special character.';
  return null;
};

const syncExpiredResetCodes = (): boolean => {
  const now = Date.now();
  let mutated = false;
  for (const customer of db.customers) {
    if (
      customer.resetCodeStatus === 'Active' &&
      customer.resetCodeExpiresAt &&
      now > new Date(customer.resetCodeExpiresAt).getTime()
    ) {
      const nextExpCode = `EXP${db.nextExpCodeNumber++}`;
      const issuedAt = new Date(now).toISOString();
      customer.activeResetCode = nextExpCode;
      customer.resetCodeStatus = 'Expired';
      customer.resetCodeExpiresAt = null;
      customer.codeHistory.unshift({
        code: nextExpCode,
        reason: 'Expired Regeneration',
        issuedAt,
        expiresAt: null,
      });
      mutated = true;
    }
  }
  if (mutated) {
    saveDatabase(db);
  }
  return mutated;
};

const computeSummary = (database: StoreDatabase): AdminDashboardData['summary'] => {
  const validOrders = database.orders.filter(
    (o) => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded'
  );
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const paidOrdersList = validOrders.filter((o) => o.paymentStatus === 'Paid');
  const paidRevenue = paidOrdersList.reduce((sum, o) => sum + o.totalAmount, 0);
  const pendingOrdersList = validOrders.filter(
    (o) => o.paymentStatus === 'Pending Verification' || o.paymentStatus === 'COD Pending'
  );
  const pendingRevenue = pendingOrdersList.reduce((sum, o) => sum + o.totalAmount, 0);
  const uniqueEmails = new Set(database.orders.map((o) => o.customer.email.toLowerCase()));
  const lowStockCount = database.products.filter((p) => p.stock <= 15).length;

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    paidRevenue: Number(paidRevenue.toFixed(2)),
    pendingRevenue: Number(pendingRevenue.toFixed(2)),
    totalOrders: database.orders.length,
    paidOrders: paidOrdersList.length,
    pendingOrders: pendingOrdersList.length,
    avgOrderValue: validOrders.length
      ? Number((totalRevenue / validOrders.length).toFixed(2))
      : 0,
    lowStockCount,
    totalCustomers: uniqueEmails.size,
    registeredAccounts: database.customers.length,
  };
};

const safeFiniteNumber = (val: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
};

const isPrivateOrLocalHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '169.254.169.254' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^127\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  const match172 = /^172\.(\d+)\./.exec(host);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }
  return false;
};

const isValidMediaUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  if (/[\s<>"'`]/.test(trimmed)) return false;
  if (trimmed.startsWith('/src/assets/images/') || trimmed.startsWith('/uploads/')) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (isPrivateOrLocalHostname(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
};

const detectMediaTypeFromBuffer = (
  buffer: Buffer
): { ext: string; mime: string; type: 'image' | 'video' | 'pdf' } | null => {
  if (!buffer || buffer.length < 4) return null;
  // JPEG: 0xFF, 0xD8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { ext: '.jpg', mime: 'image/jpeg', type: 'image' };
  }
  // PNG: 0x89, 'PNG'
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: '.png', mime: 'image/png', type: 'image' };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp', type: 'image' };
  }
  // GIF: GIF87a / GIF89a
  if (buffer.length >= 6 && buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return { ext: '.gif', mime: 'image/gif', type: 'image' };
  }
  // AVIF / HEIC / MP4 / MOV via ISO BMFF ftyp box
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
      return { ext: '.avif', mime: 'image/avif', type: 'image' };
    }
    if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') {
      return { ext: '.heic', mime: 'image/heic', type: 'image' };
    }
    if (
      brand === 'isom' ||
      brand === 'iso2' ||
      brand === 'mp41' ||
      brand === 'mp42' ||
      brand === 'qt  ' ||
      brand === 'm4v ' ||
      brand === 'avc1' ||
      brand === 'dash'
    ) {
      return { ext: '.mp4', mime: 'video/mp4', type: 'video' };
    }
  }
  // WEBM: 0x1A 0x45 0xDF 0xA3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { ext: '.webm', mime: 'video/webm', type: 'video' };
  }
  // PDF: %PDF-
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { ext: '.pdf', mime: 'application/pdf', type: 'pdf' };
  }
  return null;
};

const ensureUploadedMediaUrl = async (url: string, prefix = 'media'): Promise<string> => {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (!trimmed.startsWith('data:')) return trimmed;

  try {
    const match = /^data:([^;]+);base64,(.+)$/.exec(trimmed);
    if (!match) return trimmed;
    const mime = match[1].toLowerCase();
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0 || buffer.length > 30 * 1024 * 1024) return trimmed;

    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
      'image/svg+xml': '.svg',
    };
    const detected = detectMediaTypeFromBuffer(buffer);
    const ext = detected?.ext || extMap[mime] || '.jpg';
    const contentType = detected?.mime || mime || 'image/jpeg';
    const safeFile = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const storagePath = `${prefix}/${safeFile}`;

    const cloudUrl = await uploadBufferToSupabaseStorage(storagePath, buffer, contentType);
    if (cloudUrl) return cloudUrl;

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const targetPath = path.resolve(UPLOADS_DIR, safeFile);
    fs.writeFileSync(targetPath, buffer);
    return `/uploads/${safeFile}`;
  } catch (err) {
    console.warn('ensureUploadedMediaUrl processing error:', err);
    return trimmed;
  }
};

const createRateLimiter = (maxRequests: number, windowMs: number, message: string) => {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, Math.max(windowMs, 60_000));
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const existing = hits.get(key);
    if (!existing || now > existing.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    existing.count += 1;
    if (existing.count > maxRequests) {
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
};

const sanitizePublicCustomers = (customers: StoredCustomerAccount[]): CustomerAccount[] =>
  customers.map(({ passwordHash: _ph, ...rest }) => rest);

// Periodic stale session eviction
setInterval(() => {
  const now = Date.now();
  for (const [tok, exp] of adminSessions.entries()) {
    if (now > exp) adminSessions.delete(tok);
  }
  for (const [tok, sess] of customerSessions.entries()) {
    if (now > sess.expiresAt) customerSessions.delete(tok);
  }
  for (const [tok, exp] of revokedTokens.entries()) {
    if (now > exp) revokedTokens.delete(tok);
  }
  for (const [key, rec] of adminLoginAttempts.entries()) {
    if (rec.lockedUntil > 0 && now > rec.lockedUntil + 60_000) adminLoginAttempts.delete(key);
  }
  for (const [key, rec] of customerLoginAttempts.entries()) {
    if (rec.lockedUntil > 0 && now > rec.lockedUntil + 60_000) customerLoginAttempts.delete(key);
  }
}, 10 * 60 * 1000).unref();

export function createApiApp(options?: { includeErrorHandler?: boolean }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Normalize Netlify Serverless Function paths (/.netlify/functions/api/* -> /api/* or /uploads/*)
  app.use((req, _res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      const stripped = req.url.slice('/.netlify/functions/api'.length) || '/';
      req.url =
        stripped.startsWith('/api') || stripped.startsWith('/uploads')
          ? stripped
          : `/api${stripped.startsWith('/') ? '' : '/'}${stripped}`;
    } else if (
      IS_SERVERLESS &&
      !req.url.startsWith('/api') &&
      !req.url.startsWith('/uploads') &&
      !req.url.startsWith('/src/assets/images')
    ) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
    next();
  });

  // Security headers compatible with iframe preview & standard web browsers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  // Ensure global Supabase hydration and disable stale API caching before serving /api routes
  app.use('/api', async (req, res, next) => {
    if (!req.path.startsWith('/site-assets/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      const skipSyncForFastEnvLogin =
        req.path === '/admin/auth/login' && Boolean(cleanEnv(process.env.ADMIN_PASSCODE));
      if (!skipSyncForFastEnvLogin) {
        const isMutation = req.method !== 'GET' && req.method !== 'HEAD';
        await Promise.race([
          ensureLatestState(
            isMutation &&
              req.path.startsWith('/admin/') &&
              req.path !== '/admin/supabase-sync' &&
              req.path !== '/admin/supabase-pull' &&
              !req.path.startsWith('/admin/auth/')
          ),
          new Promise<void>((resolve) => setTimeout(resolve, 6500)),
        ]);
      }
    }
    next();
  });

  const authRateLimiter = createRateLimiter(
    25,
    5 * 60 * 1000,
    'Too many authentication attempts. Please wait a few minutes and try again.'
  );
  const publicWriteLimiter = createRateLimiter(
    45,
    5 * 60 * 1000,
    'Too many requests submitted rapidly. Please wait a moment and try again.'
  );

  // Serve static site images from local directories or Supabase Storage fallback
  const siteImageDirs = [
    path.resolve(process.cwd(), 'src/assets/images'),
    path.resolve(process.cwd(), 'public/src/assets/images'),
    path.resolve(process.cwd(), 'dist/src/assets/images'),
  ];
  for (const dir of siteImageDirs) {
    if (fs.existsSync(dir)) {
      app.use(
        '/src/assets/images',
        express.static(dir, {
          setHeaders: (res) => {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          },
        })
      );
    }
  }

  app.get('/api/site-assets/:filename', (req, res) => {
    const safeName = path.basename(String(req.params.filename || ''));
    if (!safeName || safeName.includes('..')) {
      res.status(400).end();
      return;
    }
    for (const dir of siteImageDirs) {
      const candidate = path.resolve(dir, safeName);
      if (candidate.startsWith(dir + path.sep) && fs.existsSync(candidate)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.sendFile(candidate);
        return;
      }
    }
    if (supabaseClient) {
      const { data } = supabaseClient.storage
        .from('emmystylez-media')
        .getPublicUrl(`site-assets/${safeName}`);
      if (data?.publicUrl) {
        res.redirect(302, data.publicUrl);
        return;
      }
    }
    res.status(404).end();
  });

  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      },
    })
  );

  app.get('/uploads/*', (req, res) => {
    const rel = req.path.replace(/^\/uploads\//, '').replace(/^\/+/, '');
    if (rel && !rel.includes('..') && supabaseClient) {
      const storageKey = rel.startsWith('receipts/') ? rel : `media/${rel}`;
      const { data } = supabaseClient.storage.from('emmystylez-media').getPublicUrl(storageKey);
      if (data?.publicUrl) {
        res.redirect(302, data.publicUrl);
        return;
      }
    }
    res.status(404).end();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      database: supabaseStatus.connected ? 'supabase' : supabaseStatus.configured ? 'supabase-pending' : 'local-json',
    });
  });

  // Public Storefront Payload
  app.get('/api/storefront', (_req, res) => {
    const activeProducts = db.products.filter((p) => p.status !== 'Draft');
    const activeBanners = db.banners.filter((b) => b.active);
    const activeMedia = db.aboutMedia.filter((m) => m.active);
    const enabledGateways = db.gateways.filter((g) => g.enabled);
    const publicCoupons = db.coupons
      .filter((c) => c.active)
      .map(({ code, type, value, minOrderAmount, active }) => ({
        code,
        type,
        value,
        minOrderAmount,
        active,
      }));

    res.json({
      products: activeProducts,
      banners: activeBanners,
      aboutMedia: activeMedia,
      settings: db.settings,
      gateways: enabledGateways,
      coupons: publicCoupons,
    });
  });

  // ---------------- CUSTOMER ACCOUNT AUTH & FORGOT PASSWORD ----------------
  app.post('/api/auth/register', authRateLimiter, async (req, res) => {
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');

    if (!fullName || !email || !email.includes('@') || normalizePhoneDigits(phone).length < 7) {
      res.status(400).json({
        error: 'Please enter full name, valid email address, and WhatsApp phone number.',
      });
      return;
    }

    const pwErr = validateStrongPassword(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    if (
      db.customers.some(
        (c) =>
          c.email.toLowerCase() === email ||
          normalizePhoneDigits(c.phone) === normalizePhoneDigits(phone)
      )
    ) {
      res.status(409).json({ error: 'An account with this email or WhatsApp number already exists.' });
      return;
    }

    const assignedCode = `Emmy${db.nextEmmyCodeNumber++}`;
    const createdAt = new Date().toISOString();
    const newCustomer: StoredCustomerAccount = {
      id: `cus-${Date.now()}`,
      fullName: fullName.slice(0, 120),
      email,
      phone: phone.slice(0, 40),
      passwordHash: hashSecret(password),
      initialCode: assignedCode,
      activeResetCode: assignedCode,
      resetCodeStatus: 'Assigned',
      resetCodeExpiresAt: null,
      codeHistory: [
        {
          code: assignedCode,
          reason: 'Registration',
          issuedAt: createdAt,
          expiresAt: null,
        },
      ],
      createdAt,
    };

    db.customers.unshift(newCustomer);
    await saveDatabaseAsync(db);

    const token = issueCustomerSessionToken(newCustomer.id);
    res.status(201).json({
      token,
      user: {
        id: newCustomer.id,
        fullName: newCustomer.fullName,
        email: newCustomer.email,
        phone: newCustomer.phone,
      },
    });
  });

  app.post('/api/auth/login', authRateLimiter, (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const attemptKey = `${clientIp}:${identifier || 'anon'}`;

    const activeLock = getActiveLockoutSeconds(customerLoginAttempts, attemptKey);
    if (activeLock.locked) {
      res.status(429).json({
        error: `Too many wrong password attempts. Try again in ${activeLock.retryAfterSeconds}s or use Forgot Password.`,
        lockout: true,
        lockedUntil: activeLock.lockedUntil,
        retryAfterSeconds: activeLock.retryAfterSeconds,
        attemptsRemaining: 0,
        suggestForgotPassword: true,
      });
      return;
    }

    const customer = db.customers.find(
      (c) =>
        c.email.toLowerCase() === identifier ||
        (normalizePhoneDigits(identifier).length >= 7 &&
          normalizePhoneDigits(c.phone) === normalizePhoneDigits(identifier))
    );

    if (!customer || !verifySecretHash(password, customer.passwordHash)) {
      const outcome = recordFailedAttempt(
        customerLoginAttempts,
        attemptKey,
        MAX_CUSTOMER_LOGIN_ATTEMPTS,
        CUSTOMER_LOCKOUT_MS
      );
      if (outcome.lockedNow) {
        res.status(429).json({
          error: `Wrong password entered 5 times. Please wait ${outcome.retryAfterSeconds}s or use Forgot Password to reset it.`,
          lockout: true,
          lockedUntil: outcome.lockedUntil,
          retryAfterSeconds: outcome.retryAfterSeconds,
          attemptsRemaining: 0,
          suggestForgotPassword: true,
        });
        return;
      }
      res.status(401).json({
        error: `Invalid email/phone or password. ${outcome.attemptsRemaining} attempt${outcome.attemptsRemaining === 1 ? '' : 's'} remaining before temporary lockout.`,
        attemptsRemaining: outcome.attemptsRemaining,
      });
      return;
    }

    customerLoginAttempts.delete(attemptKey);
    const token = issueCustomerSessionToken(customer.id);
    res.json({
      token,
      user: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      },
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const customerId = verifyCustomerSessionToken(token);
    if (!customerId) {
      res.status(401).json({ error: 'Please sign in.' });
      return;
    }
    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    const orders = db.orders.filter(
      (o) => o.customer.email.toLowerCase() === customer.email.toLowerCase()
    );
    res.json({
      user: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      },
      orders,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token) {
      customerSessions.delete(token);
      revokedTokens.set(token, Date.now() + 24 * 60 * 60 * 1000);
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/forgot-password', authRateLimiter, async (req, res) => {
    syncExpiredResetCodes();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const digits = normalizePhoneDigits(phone);

    if (!email || !email.includes('@') || digits.length < 7) {
      res.status(400).json({ error: 'Please enter both your account email and WhatsApp number.' });
      return;
    }

    const customer = db.customers.find(
      (c) =>
        c.email.toLowerCase() === email &&
        normalizePhoneDigits(c.phone).endsWith(digits.slice(-9))
    );

    if (!customer) {
      res.status(404).json({
        error: 'No account matches that email and WhatsApp phone number.',
      });
      return;
    }

    const now = Date.now();
    if (
      customer.resetCodeStatus === 'Active' &&
      customer.resetCodeExpiresAt &&
      new Date(customer.resetCodeExpiresAt).getTime() > now
    ) {
      const remainingSeconds = Math.ceil(
        (new Date(customer.resetCodeExpiresAt).getTime() - now) / 1000
      );
      res.json({
        ok: true,
        expiresAt: customer.resetCodeExpiresAt,
        expiresInSeconds: remainingSeconds,
        whatsappNumber: db.settings.whatsappNumber,
        message: `A verification code is already active for your WhatsApp (${customer.phone}). It expires in ${remainingSeconds}s.`,
      });
      return;
    }

    const expiresAtIso = new Date(now + 60 * 1000).toISOString();
    const issuedAtIso = new Date(now).toISOString();

    if (customer.resetCodeStatus === 'Assigned' && customer.activeResetCode) {
      customer.resetCodeStatus = 'Active';
      customer.resetCodeExpiresAt = expiresAtIso;
      customer.codeHistory.unshift({
        code: customer.activeResetCode,
        reason: 'Forgot Password',
        issuedAt: issuedAtIso,
        expiresAt: expiresAtIso,
      });
    } else if (customer.resetCodeStatus === 'Expired' && customer.activeResetCode?.startsWith('EXP')) {
      customer.resetCodeStatus = 'Active';
      customer.resetCodeExpiresAt = expiresAtIso;
      customer.codeHistory.unshift({
        code: customer.activeResetCode,
        reason: 'Forgot Password',
        issuedAt: issuedAtIso,
        expiresAt: expiresAtIso,
      });
    } else {
      const expCode = `EXP${db.nextExpCodeNumber++}`;
      customer.activeResetCode = expCode;
      customer.resetCodeStatus = 'Active';
      customer.resetCodeExpiresAt = expiresAtIso;
      customer.codeHistory.unshift({
        code: expCode,
        reason: 'Expired Regeneration',
        issuedAt: issuedAtIso,
        expiresAt: expiresAtIso,
      });
    }

    await saveDatabaseAsync(db);

    res.json({
      ok: true,
      expiresAt: expiresAtIso,
      expiresInSeconds: 60,
      whatsappNumber: db.settings.whatsappNumber,
      message: `A 1-minute verification code has been generated and queued for WhatsApp (${customer.phone}).`,
    });
  });

  app.post('/api/auth/reset-password', authRateLimiter, async (req, res) => {
    const expiredNow = syncExpiredResetCodes();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    const digits = normalizePhoneDigits(phone);

    const customer = db.customers.find(
      (c) =>
        c.email.toLowerCase() === email &&
        normalizePhoneDigits(c.phone).endsWith(digits.slice(-9))
    );

    if (!customer) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    if (customer.resetCodeStatus === 'Expired' || expiredNow) {
      if (customer.resetCodeStatus !== 'Active') {
        res.status(410).json({
          error:
            'Your 1-minute verification code has expired. A new EXP code has been regenerated — please click "Resend Code" to receive it.',
        });
        return;
      }
    }

    if (
      customer.resetCodeStatus !== 'Active' ||
      !customer.activeResetCode ||
      !customer.resetCodeExpiresAt ||
      Date.now() > new Date(customer.resetCodeExpiresAt).getTime()
    ) {
      syncExpiredResetCodes();
      res.status(410).json({
        error:
          'Verification code expired after 1 minute. Request a new code to continue.',
      });
      return;
    }

    if (customer.activeResetCode.toUpperCase() !== code.toUpperCase()) {
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }

    const pwErr = validateStrongPassword(newPassword);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    customer.passwordHash = hashSecret(newPassword);
    customer.resetCodeStatus = 'Used';
    customer.activeResetCode = null;
    customer.resetCodeExpiresAt = null;
    await saveDatabaseAsync(db);

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    customerLoginAttempts.delete(`${clientIp}:${customer.email.toLowerCase()}`);
    customerLoginAttempts.delete(`${clientIp}:${email}`);

    res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
  });

  // Public Coupon Validation
  app.post('/api/coupons/validate', (req, res) => {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    const subtotal = safeFiniteNumber(req.body?.subtotal, 0, 0);
    if (!code) {
      res.status(400).json({ error: 'Coupon code is required.' });
      return;
    }
    const coupon = db.coupons.find((c) => c.code.toUpperCase() === code && c.active);
    if (!coupon) {
      res.status(404).json({ error: 'Invalid or inactive coupon code.' });
      return;
    }
    if (subtotal < coupon.minOrderAmount) {
      res.status(400).json({
        error: `Minimum order of ${db.settings.currencySymbol}${coupon.minOrderAmount.toLocaleString()} required for ${coupon.code}.`,
      });
      return;
    }
    res.json({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount,
    });
  });

  // Public Buyer Payment Receipt Upload (Drag & Drop at Checkout)
  app.post('/api/orders/upload-receipt', publicWriteLimiter, async (req, res) => {
    const filename = String(req.body?.filename || '');
    const dataBase64 = String(req.body?.dataBase64 || '');
    if (!filename || !dataBase64) {
      res.status(400).json({ error: 'Receipt file and data are required.' });
      return;
    }

    const base64Clean = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
    const buffer = Buffer.from(base64Clean, 'base64');
    if (buffer.length > 25 * 1024 * 1024) {
      res.status(413).json({ error: 'Receipt file exceeds 25MB upload limit.' });
      return;
    }

    const detected = detectMediaTypeFromBuffer(buffer);
    const declaredExt = path.extname(path.basename(filename)).toLowerCase();
    const resolvedExt =
      detected?.ext ||
      (['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.gif'].includes(declaredExt) ? declaredExt : '.jpg');
    const mime = detected?.mime || (resolvedExt === '.pdf' ? 'application/pdf' : 'image/jpeg');

    const safeFile = `rcp-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${resolvedExt}`;

    const cloudUrl = await uploadBufferToSupabaseStorage(
      `receipts/${safeFile}`,
      buffer,
      mime
    );
    if (cloudUrl) {
      res.status(201).json({ url: cloudUrl });
      return;
    }

    if (IS_SERVERLESS) {
      if (mime.startsWith('image/') && buffer.length <= 1.5 * 1024 * 1024) {
        res.status(201).json({ url: `data:${mime};base64,${buffer.toString('base64')}` });
        return;
      }
      res.status(503).json({
        error: 'Cloud media storage is unavailable. Please verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or upload a smaller receipt image.',
      });
      return;
    }

    if (!fs.existsSync(RECEIPTS_DIR)) {
      fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
    }

    const targetPath = path.resolve(RECEIPTS_DIR, safeFile);
    if (!targetPath.startsWith(RECEIPTS_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid upload path.' });
      return;
    }

    fs.writeFileSync(targetPath, buffer);
    res.status(201).json({ url: `/uploads/receipts/${safeFile}` });
  });

  // Public Checkout & Payment Processing -> Auto Tracking Number Starting From Emmy1001
  app.post('/api/orders/checkout', publicWriteLimiter, async (req, res) => {
    const { customer, items, paymentMethod, couponCode, notes, paymentDetails, receiptUrl } =
      req.body ?? {};

    if (!customer || typeof customer !== 'object') {
      res.status(400).json({ error: 'Customer shipping & location details are required.' });
      return;
    }

    const fullName = String(customer.fullName || '').trim();
    const email = String(customer.email || '').trim() || 'buyer@emmystylezsolar.com';
    const phone = String(customer.phone || '').trim();
    const state = String(customer.state || '').trim();
    const lga = String(customer.lga || '').trim();
    const park = String(customer.park || '').trim();
    const address = String(customer.address || '').trim();
    const city = String(customer.city || lga || state).trim();
    const postalCode = String(customer.postalCode || 'NG').trim();
    const country = String(customer.country || 'Nigeria').trim();

    if (!fullName || !phone || !state || !lga || !park || !address) {
      res.status(400).json({
        error: 'Please enter your full name, WhatsApp number, State, LGA, Delivery Park, and address.',
      });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Your cart is empty.' });
      return;
    }

    const gateway = db.gateways.find((g) => g.id === paymentMethod && g.enabled);
    if (!gateway) {
      res.status(400).json({ error: 'Selected payment gateway is unavailable.' });
      return;
    }

    if (gateway.id === 'stripe_card') {
      const cardNumber = String(paymentDetails?.cardNumber || '').replace(/\s+/g, '');
      const expiry = String(paymentDetails?.expiry || '').trim();
      const cvc = String(paymentDetails?.cvc || '').trim();
      if (!/^\d{13,19}$/.test(cardNumber) || !/^\d{2}\/\d{2}$/.test(expiry) || !/^\d{3,4}$/.test(cvc)) {
        res.status(400).json({ error: 'Please enter valid card number, MM/YY expiry, and CVC.' });
        return;
      }
    } else if (gateway.id === 'paypal') {
      const paypalEmail = String(paymentDetails?.paypalEmail || email).trim();
      if (!paypalEmail.includes('@')) {
        res.status(400).json({ error: 'Please enter a valid PayPal account email.' });
        return;
      }
    } else if (gateway.id === 'paystack') {
      const paystackEmail = String(paymentDetails?.paystackEmail || email).trim();
      if (!paystackEmail.includes('@')) {
        res.status(400).json({ error: 'Please enter a valid email for Paystack verification.' });
        return;
      }
    }

    let safeReceiptUrl =
      typeof receiptUrl === 'string' &&
      (receiptUrl.startsWith('/uploads/receipts/') || isValidMediaUrl(receiptUrl))
        ? receiptUrl.trim()
        : null;

    if (safeReceiptUrl && safeReceiptUrl.startsWith('data:image/')) {
      safeReceiptUrl = await ensureUploadedMediaUrl(safeReceiptUrl, 'receipts');
    }

    if (gateway.id === 'bank_transfer' && !safeReceiptUrl) {
      res.status(400).json({
        error: 'Please upload your bank transfer payment receipt before pressing "I Have Sent".',
      });
      return;
    }

    const orderItems: OrderItem[] = [];
    for (const rawItem of items) {
      const productId = String(rawItem?.productId || '');
      const qty = Math.floor(Number(rawItem?.quantity || 0));
      if (!productId || qty <= 0 || qty > 100) {
        res.status(400).json({ error: 'Invalid item quantity.' });
        return;
      }
      const product = db.products.find((p) => p.id === productId && p.status !== 'Draft');
      if (!product) {
        res.status(404).json({ error: 'Product not found or unavailable.' });
        return;
      }
      if (product.stock < qty) {
        res.status(409).json({
          error: `Only ${product.stock} unit(s) of "${product.name}" remain in stock.`,
        });
        return;
      }
      const unitPrice =
        product.isFlashSale && product.flashSalePrice && product.flashSalePrice > 0
          ? product.flashSalePrice
          : product.price;
      const lineTotal = Number((unitPrice * qty).toFixed(2));
      orderItems.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        image: product.image,
        unitPrice,
        quantity: qty,
        lineTotal,
      });
    }

    const subtotal = Number(orderItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));

    let discountAmount = 0;
    let appliedCoupon: Coupon | undefined;
    if (typeof couponCode === 'string' && couponCode.trim()) {
      const normalized = couponCode.trim().toUpperCase();
      appliedCoupon = db.coupons.find((c) => c.code.toUpperCase() === normalized && c.active);
      if (appliedCoupon && subtotal >= appliedCoupon.minOrderAmount) {
        if (appliedCoupon.type === 'percent') {
          discountAmount = Number(((subtotal * appliedCoupon.value) / 100).toFixed(2));
        } else {
          discountAmount = Number(Math.min(subtotal, appliedCoupon.value).toFixed(2));
        }
      }
    }

    const taxableBase = Math.max(0, subtotal - discountAmount);
    const shippingFee =
      db.settings.freeShippingThreshold > 0 && taxableBase >= db.settings.freeShippingThreshold
        ? 0
        : db.settings.flatShippingFee;
    const taxAmount = Number(((taxableBase * db.settings.taxRatePercent) / 100).toFixed(2));
    const totalAmount = Number((taxableBase + shippingFee + taxAmount).toFixed(2));

    for (const item of orderItems) {
      const product = db.products.find((p) => p.id === item.productId);
      if (product) {
        product.stock = Math.max(0, product.stock - item.quantity);
        if (product.stock === 0) {
          product.status = 'Out of Stock';
        }
      }
    }
    if (appliedCoupon) {
      appliedCoupon.usageCount += 1;
    }

    const trackingNum = `Emmy${db.nextTrackingNumber++}`;
    const orderNum = `ORD-${db.nextOrderNumber++}`;
    const orderId = `ord-${Date.now()}`;
    const prefixMap: Record<PaymentGatewayId, string> = {
      stripe_card: 'STR',
      paystack: 'PSK',
      paypal: 'PP',
      bank_transfer: 'BNK',
      cod: 'COD',
    };
    const transactionRef = `TXN-${prefixMap[gateway.id]}-${crypto.randomInt(100000, 999999)}`;

    let paymentStatus: PaymentStatus = 'Paid';
    let orderStatus: OrderStatus = 'Processing';
    let trackingStage: TrackingStage = 'Payment Verified & Packing';
    if (gateway.id === 'bank_transfer') {
      paymentStatus = 'Pending Verification';
      orderStatus = 'Pending';
      trackingStage = 'Payment Pending Verification';
    } else if (gateway.id === 'cod') {
      paymentStatus = 'COD Pending';
      orderStatus = 'Pending';
      trackingStage = 'Payment Pending Verification';
    }

    const timestamp = new Date().toISOString();
    const initialEvent: TrackingEvent = {
      id: `trk-${Date.now()}`,
      stage: trackingStage,
      location: `${state} State · ${lga} (${park})`,
      note:
        gateway.id === 'bank_transfer'
          ? 'Buyer clicked "I Have Sent" and uploaded payment receipt for Admin verification.'
          : `Order placed for delivery via ${park}, ${state} State.`,
      timestamp,
    };

    const newOrder: Order = {
      id: orderId,
      orderNumber: orderNum,
      trackingNumber: trackingNum,
      customer: {
        fullName,
        email,
        phone,
        state,
        lga,
        park,
        address,
        city,
        postalCode,
        country,
      },
      items: orderItems,
      subtotal,
      discountAmount,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      shippingFee,
      taxAmount,
      totalAmount,
      paymentMethod: gateway.id,
      paymentMethodName: gateway.name,
      paymentStatus,
      orderStatus,
      trackingStage,
      trackingLocation: 'Emmystylez Warehouse, Balewa Road, Ankpa',
      waybillInfo: `Scheduled for ${park} (${state} State)`,
      estimatedDelivery: '1–3 Working Days',
      trackingHistory: [initialEvent],
      receiptUrl: safeReceiptUrl,
      transactionId: transactionRef,
      notes: typeof notes === 'string' ? notes.slice(0, 500) : '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const gatewayFee = Number(((totalAmount * gateway.processingFeePercent) / 100).toFixed(2));
    const newTransaction: Transaction = {
      id: `txn-${Date.now()}`,
      transactionRef,
      orderId,
      orderNumber: orderNum,
      customerName: fullName,
      customerEmail: email,
      gatewayId: gateway.id,
      gatewayName: gateway.name,
      grossAmount: totalAmount,
      gatewayFee,
      netAmount: Number((totalAmount - gatewayFee).toFixed(2)),
      status: paymentStatus,
      mode: gateway.mode,
      createdAt: timestamp,
    };

    db.orders.unshift(newOrder);
    db.transactions.unshift(newTransaction);
    await saveDatabaseAsync(db);

    res.status(201).json({ order: newOrder, transaction: newTransaction });
  });

  // Public Order Tracking Lookup (accepts Tracking Code e.g. Emmy1001 OR Order Number)
  app.get('/api/orders/lookup', (req, res) => {
    const code = String(req.query.trackingNumber || req.query.orderNumber || '')
      .trim()
      .toUpperCase();
    const email = String(req.query.email || '').trim().toLowerCase();

    if (!code) {
      res.status(400).json({ error: 'Please enter your Tracking Code (e.g. Emmy1001).' });
      return;
    }

    const order = db.orders.find((o) => {
      const matchesCode =
        (o.trackingNumber && o.trackingNumber.toUpperCase() === code) ||
        o.orderNumber.toUpperCase() === code;
      if (!matchesCode) return false;
      if (email && o.customer.email.toLowerCase() !== email) return false;
      return true;
    });

    if (!order) {
      res.status(404).json({
        error: `No order found for Tracking Code "${code}". Please check your code and try again.`,
      });
      return;
    }
    res.json({ order });
  });

  // Public Service / Installation / Wholesale Quote Inquiry
  app.post('/api/inquiries', publicWriteLimiter, async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const customerType = String(req.body?.customerType || 'Homeowners').trim();
    const serviceType = String(req.body?.serviceType || 'Solar installation solutions').trim();
    const propertyLocation = String(req.body?.propertyLocation || '').trim();
    const estimatedLoad = String(req.body?.estimatedLoad || '').trim();
    const message = String(req.body?.message || '').trim();

    if (!name || !email || !email.includes('@') || !message) {
      res.status(400).json({ error: 'Name, valid email, and project details are required.' });
      return;
    }

    const inquiry: CustomerInquiry = {
      id: `inq-${Date.now()}`,
      name: name.slice(0, 120),
      email: email.slice(0, 160),
      phone: phone.slice(0, 40),
      customerType: customerType.slice(0, 80),
      serviceType: serviceType.slice(0, 100),
      propertyLocation: propertyLocation.slice(0, 160),
      estimatedLoad: estimatedLoad.slice(0, 160),
      message: message.slice(0, 1200),
      status: 'New',
      createdAt: new Date().toISOString(),
    };

    db.inquiries.unshift(inquiry);
    await saveDatabaseAsync(db);
    res.status(201).json({ inquiry });
  });

  // ---------------- ADMIN AUTH ROUTES ----------------
  app.get('/api/admin/auth/status', (_req, res) => {
    const envManaged = Boolean(cleanEnv(process.env.ADMIN_PASSCODE));
    const initialized = envManaged || Boolean(db.adminAuthHash);
    res.json({
      initialized,
      envManaged,
      database: supabaseStatus.connected
        ? 'supabase'
        : supabaseStatus.configured
        ? 'supabase-pending'
        : 'local-json',
      supabaseHost: supabaseStatus.urlHost,
    });
  });

  app.post('/api/admin/auth/setup', authRateLimiter, async (req, res) => {
    const envPasscode = cleanEnv(process.env.ADMIN_PASSCODE);
    if (envPasscode || db.adminAuthHash) {
      res.status(409).json({ error: 'Admin passcode is already initialized. Please sign in.' });
      return;
    }
    const passcode = String(req.body?.passcode || '').trim();
    if (passcode.length < 6) {
      res.status(400).json({ error: 'Admin passcode must be at least 6 characters.' });
      return;
    }
    db.adminAuthHash = hashSecret(passcode);
    await saveDatabaseAsync(db);
    res.status(201).json({ token: issueAdminSessionToken() });
  });

  app.post('/api/admin/auth/login', authRateLimiter, (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const activeLock = getActiveLockoutSeconds(adminLoginAttempts, clientIp);
    if (activeLock.locked) {
      res.status(429).json({
        error: `Admin login is temporarily locked after 3 failed attempts. Please wait ${activeLock.retryAfterSeconds}s before trying again.`,
        lockout: true,
        lockedUntil: activeLock.lockedUntil,
        retryAfterSeconds: activeLock.retryAfterSeconds,
        attemptsRemaining: 0,
      });
      return;
    }

    const passcode = String(req.body?.passcode || '').trim();
    const envPasscode = cleanEnv(process.env.ADMIN_PASSCODE);

    if (envPasscode) {
      if (!passcode || !verifyEnvPasscode(passcode, envPasscode)) {
        const outcome = recordFailedAttempt(
          adminLoginAttempts,
          clientIp,
          MAX_ADMIN_LOGIN_ATTEMPTS,
          ADMIN_LOCKOUT_MS
        );
        if (outcome.lockedNow) {
          res.status(429).json({
            error: `Incorrect admin passcode entered 3 times. Locked for ${outcome.retryAfterSeconds}s.`,
            lockout: true,
            lockedUntil: outcome.lockedUntil,
            retryAfterSeconds: outcome.retryAfterSeconds,
            attemptsRemaining: 0,
          });
          return;
        }
        res.status(401).json({
          error: `Invalid admin passcode. ${outcome.attemptsRemaining} attempt${outcome.attemptsRemaining === 1 ? '' : 's'} remaining before lockout.`,
          attemptsRemaining: outcome.attemptsRemaining,
        });
        return;
      }
      adminLoginAttempts.delete(clientIp);
      res.json({ token: issueAdminSessionToken() });
      return;
    }

    if (!db.adminAuthHash) {
      res.status(400).json({ error: 'Admin passcode has not been initialized yet.' });
      return;
    }

    if (!passcode || !verifySecretHash(passcode, db.adminAuthHash)) {
      const outcome = recordFailedAttempt(
        adminLoginAttempts,
        clientIp,
        MAX_ADMIN_LOGIN_ATTEMPTS,
        ADMIN_LOCKOUT_MS
      );
      if (outcome.lockedNow) {
        res.status(429).json({
          error: `Incorrect admin passcode entered 3 times. Locked for ${outcome.retryAfterSeconds}s.`,
          lockout: true,
          lockedUntil: outcome.lockedUntil,
          retryAfterSeconds: outcome.retryAfterSeconds,
          attemptsRemaining: 0,
        });
        return;
      }
      res.status(401).json({
        error: `Invalid admin passcode. ${outcome.attemptsRemaining} attempt${outcome.attemptsRemaining === 1 ? '' : 's'} remaining before lockout.`,
        attemptsRemaining: outcome.attemptsRemaining,
      });
      return;
    }

    adminLoginAttempts.delete(clientIp);
    res.json({ token: issueAdminSessionToken() });
  });

  app.post('/api/admin/auth/logout', requireAdmin, (req, res) => {
    const token = (req.headers.authorization || '').slice(7).trim();
    if (token) {
      adminSessions.delete(token);
      revokedTokens.set(token, Date.now() + 24 * 60 * 60 * 1000);
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/auth/change-passcode', requireAdmin, async (req, res) => {
    if (cleanEnv(process.env.ADMIN_PASSCODE)) {
      res.status(400).json({
        error: 'Admin passcode is managed by environment secret ADMIN_PASSCODE.',
      });
      return;
    }
    const currentPasscode = String(req.body?.currentPasscode || '');
    const newPasscode = String(req.body?.newPasscode || '');
    if (!db.adminAuthHash || !verifySecretHash(currentPasscode, db.adminAuthHash)) {
      res.status(401).json({ error: 'Current passcode is incorrect.' });
      return;
    }
    if (newPasscode.length < 6) {
      res.status(400).json({ error: 'New passcode must be at least 6 characters.' });
      return;
    }
    db.adminAuthHash = hashSecret(newPasscode);
    await saveDatabaseAsync(db);
    res.json({ ok: true });
  });

  // ---------------- PROTECTED ADMIN DATA & UPLOAD ROUTES ----------------
  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    syncExpiredResetCodes();

    const payload: AdminDashboardData = {
      products: db.products,
      banners: db.banners,
      aboutMedia: db.aboutMedia,
      orders: db.orders,
      transactions: db.transactions,
      coupons: db.coupons,
      gateways: db.gateways,
      settings: db.settings,
      inquiries: db.inquiries,
      customers: sanitizePublicCustomers(db.customers),
      summary: computeSummary(db),
    };
    res.json(payload);
  });

  // Admin Drag-and-Drop Image/Video Upload
  app.post('/api/admin/upload', requireAdmin, async (req, res) => {
    const filename = String(req.body?.filename || '');
    const dataBase64 = String(req.body?.dataBase64 || '');
    if (!filename || !dataBase64) {
      res.status(400).json({ error: 'File name and data are required.' });
      return;
    }

    const base64Clean = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
    const buffer = Buffer.from(base64Clean, 'base64');
    if (buffer.length > 30 * 1024 * 1024) {
      res.status(413).json({ error: 'File exceeds 30MB upload limit.' });
      return;
    }

    const detected = detectMediaTypeFromBuffer(buffer);
    const declaredExt = path.extname(path.basename(filename)).toLowerCase();
    const resolvedExt =
      detected?.ext ||
      (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg', '.mp4', '.webm', '.mov'].includes(declaredExt)
        ? declaredExt
        : '.jpg');

    const mediaType =
      detected?.type === 'video' || ['.mp4', '.webm', '.mov'].includes(resolvedExt) ? 'video' : 'image';

    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.avif': 'image/avif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
    };
    const mime = detected?.mime || mimeMap[resolvedExt] || 'image/jpeg';

    const safeFile = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${resolvedExt}`;

    const cloudUrl = await uploadBufferToSupabaseStorage(
      `media/${safeFile}`,
      buffer,
      mime
    );
    if (cloudUrl) {
      res.status(201).json({ url: cloudUrl, type: mediaType });
      return;
    }

    // If Supabase is configured or running serverless, avoid trapping uploads in ephemeral disk
    if (IS_SERVERLESS || supabaseClient) {
      if (mime.startsWith('image/') && buffer.length <= 1.2 * 1024 * 1024) {
        res.status(201).json({
          url: `data:${mime};base64,${buffer.toString('base64')}`,
          type: mediaType,
        });
        return;
      }
      res.status(502).json({
        error: supabaseClient
          ? 'Supabase Storage upload failed for this file. Ensure the "emmystylez-media" bucket exists & is public in Supabase.'
          : 'Backend cloud storage is not connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment variables.',
      });
      return;
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const targetPath = path.resolve(UPLOADS_DIR, safeFile);
    if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid upload path.' });
      return;
    }

    fs.writeFileSync(targetPath, buffer);
    res.status(201).json({ url: `/uploads/${safeFile}`, type: mediaType });
  });

  // Bulk Product Drag-and-Drop JSON Import
  app.post('/api/admin/products/bulk', requireAdmin, async (req, res) => {
    const items = req.body?.products;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'No valid products found in import payload.' });
      return;
    }

    const added: Product[] = [];
    for (const raw of items.slice(0, 100)) {
      const name = String(raw?.name || '').trim();
      const price = Number(raw?.price);
      if (!name || !Number.isFinite(price) || price <= 0) continue;

      let image = isValidMediaUrl(String(raw?.image || ''))
        ? String(raw.image).trim()
        : '/src/assets/images/product_solar_panels_1795501702594.jpg';
      if (image.startsWith('data:image/')) {
        image = await ensureUploadedMediaUrl(image, 'products');
      }

      const stock = Math.max(0, Math.floor(Number(raw?.stock ?? 15)));
      const product: Product = {
        id: `prod-${Date.now()}-${crypto.randomInt(100, 999)}`,
        sku: String(raw?.sku || `EMM-${crypto.randomInt(100, 999)}`).trim().toUpperCase(),
        name,
        category: raw?.category || 'Solar panels',
        price: Number(price.toFixed(2)),
        compareAtPrice: Number(Math.max(price, Number(raw?.compareAtPrice || price)).toFixed(2)),
        stock,
        image,
        description: String(raw?.description || 'Emmystylez certified solar & electrical equipment.').trim(),
        wattage: String(raw?.wattage || 'Standard Spec').trim(),
        warranty: String(raw?.warranty || '5-Year Warranty').trim(),
        specifications: String(raw?.specifications || '').trim(),
        status: stock === 0 ? 'Out of Stock' : 'Active',
        featured: Boolean(raw?.featured),
        isFlashSale: Boolean(raw?.isFlashSale),
        flashSalePrice: raw?.flashSalePrice ? Number(raw.flashSalePrice) : undefined,
        createdAt: new Date().toISOString(),
      };
      db.products.unshift(product);
      added.push(product);
    }

    await saveDatabaseAsync(db);
    res.status(201).json({ importedCount: added.length, products: added });
  });

  // Products CRUD
  app.post('/api/admin/products', requireAdmin, async (req, res) => {
    const body = req.body ?? {};
    const name = String(body.name || '').trim();
    const sku = String(body.sku || `EMM-${crypto.randomInt(100, 999)}`).trim().toUpperCase();
    const price = Number(body.price);
    const compareAtPrice = Number(body.compareAtPrice || price);
    const stock = Math.max(0, Math.floor(Number(body.stock ?? 10)));
    let image = String(body.image || '/src/assets/images/product_solar_panels_1795501702594.jpg').trim();
    if (image.startsWith('data:image/')) {
      image = await ensureUploadedMediaUrl(image, 'products');
    }
    const isFlashSale = Boolean(body.isFlashSale);
    const flashSalePrice =
      body.flashSalePrice !== undefined && Number(body.flashSalePrice) > 0
        ? Number(Number(body.flashSalePrice).toFixed(2))
        : undefined;

    if (!name || !Number.isFinite(price) || price <= 0) {
      res.status(400).json({ error: 'Product name and valid positive price are required.' });
      return;
    }
    if (!isValidMediaUrl(image)) {
      res.status(400).json({ error: 'Invalid product image path or URL.' });
      return;
    }

    const product: Product = {
      id: `prod-${Date.now()}`,
      sku,
      name,
      category: body.category || 'Solar panels',
      price: Number(price.toFixed(2)),
      compareAtPrice: Number(Math.max(price, compareAtPrice).toFixed(2)),
      stock,
      image,
      description: String(body.description || 'High-efficiency Emmystylez solar & electrical equipment.').trim(),
      wattage: String(body.wattage || '200W').trim(),
      warranty: String(body.warranty || '5-Year Warranty').trim(),
      specifications: String(body.specifications || '').trim(),
      status: stock === 0 ? 'Out of Stock' : body.status || 'Active',
      featured: body.featured !== false,
      isFlashSale,
      flashSalePrice,
      createdAt: new Date().toISOString(),
    };

    db.products.unshift(product);
    await saveDatabaseAsync(db);
    res.status(201).json({ product });
  });

  app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const body = req.body ?? {};
    if (body.name !== undefined) product.name = String(body.name).trim() || product.name;
    if (body.sku !== undefined) product.sku = String(body.sku).trim().toUpperCase() || product.sku;
    if (body.category !== undefined) product.category = body.category;
    if (body.price !== undefined && Number(body.price) > 0) {
      product.price = Number(Number(body.price).toFixed(2));
    }
    if (body.compareAtPrice !== undefined && Number(body.compareAtPrice) >= 0) {
      product.compareAtPrice = Number(Number(body.compareAtPrice).toFixed(2));
    }
    if (body.stock !== undefined && Number(body.stock) >= 0) {
      product.stock = Math.floor(Number(body.stock));
      if (product.stock === 0 && product.status === 'Active') {
        product.status = 'Out of Stock';
      } else if (product.stock > 0 && product.status === 'Out of Stock') {
        product.status = 'Active';
      }
    }
    if (body.image !== undefined) {
      let imgStr = String(body.image).trim();
      if (imgStr.startsWith('data:image/')) {
        imgStr = await ensureUploadedMediaUrl(imgStr, 'products');
      }
      if (isValidMediaUrl(imgStr)) {
        product.image = imgStr;
      }
    }
    if (body.description !== undefined) product.description = String(body.description).trim();
    if (body.wattage !== undefined) product.wattage = String(body.wattage).trim();
    if (body.warranty !== undefined) product.warranty = String(body.warranty).trim();
    if (body.specifications !== undefined) product.specifications = String(body.specifications).trim();
    if (body.status !== undefined) product.status = body.status;
    if (body.featured !== undefined) product.featured = Boolean(body.featured);
    if (body.isFlashSale !== undefined) product.isFlashSale = Boolean(body.isFlashSale);
    if (body.flashSalePrice !== undefined) {
      product.flashSalePrice =
        Number(body.flashSalePrice) > 0 ? Number(Number(body.flashSalePrice).toFixed(2)) : undefined;
    }
    await saveDatabaseAsync(db);
    res.json({ product });
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    db.products.splice(idx, 1);
    await saveDatabaseAsync(db);
    res.json({ ok: true });
  });

  // Gallery Page Media CRUD (Images & Videos with Specifications posted from Admin Panel)
  app.post('/api/admin/about-media', requireAdmin, async (req, res) => {
    let url = String(req.body?.url || '').trim();
    if (url.startsWith('data:image/')) {
      url = await ensureUploadedMediaUrl(url, 'gallery');
    }
    const title = String(req.body?.title || '').trim();
    const caption = String(req.body?.caption || '').trim();
    const specifications = String(req.body?.specifications || '').trim();
    const type = req.body?.type === 'video' ? 'video' : 'image';
    const category =
      req.body?.category === 'Electrical Store' || req.body?.category === 'Team & Showroom'
        ? req.body.category
        : 'Solar Installation';

    if (!title || !isValidMediaUrl(url)) {
      res.status(400).json({ error: 'Valid media URL/upload and title are required.' });
      return;
    }

    const item: AboutMediaItem = {
      id: `media-${Date.now()}`,
      type,
      url,
      title: title.slice(0, 140),
      caption: caption.slice(0, 400),
      specifications: specifications.slice(0, 300),
      category,
      active: true,
      createdAt: new Date().toISOString(),
    };
    db.aboutMedia.unshift(item);
    await saveDatabaseAsync(db);
    res.status(201).json({ item });
  });

  app.patch('/api/admin/about-media/:id', requireAdmin, async (req, res) => {
    const item = db.aboutMedia.find((m) => m.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Gallery item not found.' });
      return;
    }
    if (req.body?.active !== undefined) item.active = Boolean(req.body.active);
    if (req.body?.title !== undefined) item.title = String(req.body.title).trim();
    if (req.body?.caption !== undefined) item.caption = String(req.body.caption).trim();
    if (req.body?.specifications !== undefined) {
      item.specifications = String(req.body.specifications).trim();
    }
    if (req.body?.category !== undefined) item.category = req.body.category;
    if (req.body?.type !== undefined) item.type = req.body.type === 'video' ? 'video' : 'image';
    if (req.body?.url !== undefined) {
      let nextUrl = String(req.body.url).trim();
      if (nextUrl.startsWith('data:image/')) {
        nextUrl = await ensureUploadedMediaUrl(nextUrl, 'gallery');
      }
      if (isValidMediaUrl(nextUrl)) {
        item.url = nextUrl;
      }
    }
    await saveDatabaseAsync(db);
    res.json({ item });
  });

  app.delete('/api/admin/about-media/:id', requireAdmin, async (req, res) => {
    const idx = db.aboutMedia.findIndex((m) => m.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Gallery item not found.' });
      return;
    }
    db.aboutMedia.splice(idx, 1);
    await saveDatabaseAsync(db);
    res.json({ ok: true });
  });

  // Orders, Payment Verification & Full Tracking Functions Update
  app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    const {
      orderStatus,
      paymentStatus,
      trackingStage,
      trackingLocation,
      waybillInfo,
      estimatedDelivery,
      trackingNote,
      notes,
    } = req.body ?? {};

    let stageChanged = false;
    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
      const txn = db.transactions.find((t) => t.orderId === order.id);
      if (txn) {
        txn.status = paymentStatus;
      }
      if (paymentStatus === 'Refunded') {
        order.orderStatus = 'Refunded';
      }
      if (paymentStatus === 'Paid' && order.trackingStage === 'Payment Pending Verification') {
        order.trackingStage = 'Payment Verified & Packing';
        if (order.orderStatus === 'Pending') order.orderStatus = 'Processing';
        stageChanged = true;
      }
    }
    if (trackingStage && trackingStage !== order.trackingStage) {
      order.trackingStage = trackingStage;
      stageChanged = true;
      if (trackingStage === 'Delivered') order.orderStatus = 'Delivered';
      else if (trackingStage === 'In Transit' || trackingStage === 'Dispatched to Park' || trackingStage === 'Out for Delivery') {
        order.orderStatus = 'Shipped';
      } else if (trackingStage === 'Payment Verified & Packing') {
        order.orderStatus = 'Processing';
      }
    }
    if (trackingLocation !== undefined) {
      order.trackingLocation = String(trackingLocation).slice(0, 160);
    }
    if (waybillInfo !== undefined) {
      order.waybillInfo = String(waybillInfo).slice(0, 200);
    }
    if (estimatedDelivery !== undefined) {
      order.estimatedDelivery = String(estimatedDelivery).slice(0, 100);
    }
    if (notes !== undefined) {
      order.notes = String(notes).slice(0, 500);
    }

    const noteText = typeof trackingNote === 'string' ? trackingNote.trim() : '';
    if (stageChanged || noteText) {
      if (!Array.isArray(order.trackingHistory)) order.trackingHistory = [];
      order.trackingHistory.unshift({
        id: `trk-${Date.now()}`,
        stage: order.trackingStage,
        location: order.trackingLocation || order.customer.park || order.customer.state,
        note: noteText || `Status updated to ${order.trackingStage}`,
        timestamp: new Date().toISOString(),
      });
    }

    order.updatedAt = new Date().toISOString();
    await saveDatabaseAsync(db);
    res.json({ order });
  });

  app.delete('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    const idx = db.orders.findIndex((o) => o.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    const orderId = db.orders[idx].id;
    db.orders.splice(idx, 1);
    db.transactions = db.transactions.filter((t) => t.orderId !== orderId);
    await saveDatabaseAsync(db);
    res.json({ ok: true });
  });

  app.delete('/api/admin/customers/:id', requireAdmin, async (req, res) => {
    const idx = db.customers.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Customer account not found.' });
      return;
    }
    db.customers.splice(idx, 1);
    await saveDatabaseAsync(db);
    res.json({ ok: true });
  });

  // Admin manual regeneration of EXP code for a customer
  app.post('/api/admin/customers/:id/regenerate-code', requireAdmin, async (req, res) => {
    const customer = db.customers.find((c) => c.id === req.params.id);
    if (!customer) {
      res.status(404).json({ error: 'Customer account not found.' });
      return;
    }
    const now = Date.now();
    const expCode = `EXP${db.nextExpCodeNumber++}`;
    const expiresAtIso = new Date(now + 60 * 1000).toISOString();
    customer.activeResetCode = expCode;
    customer.resetCodeStatus = 'Active';
    customer.resetCodeExpiresAt = expiresAtIso;
    customer.codeHistory.unshift({
      code: expCode,
      reason: 'Expired Regeneration',
      issuedAt: new Date(now).toISOString(),
      expiresAt: expiresAtIso,
    });
    await saveDatabaseAsync(db);
    const { passwordHash: _ph, ...safeCustomer } = customer;
    res.json({ customer: safeCustomer });
  });

  // Payment Gateways Configuration
  app.put('/api/admin/gateways', requireAdmin, async (req, res) => {
    const incoming = req.body?.gateways;
    if (!Array.isArray(incoming)) {
      res.status(400).json({ error: 'Gateways array required.' });
      return;
    }
    for (const item of incoming) {
      const target = db.gateways.find((g) => g.id === item.id);
      if (target) {
        target.enabled = Boolean(item.enabled);
        target.mode = item.mode === 'Test' ? 'Test' : 'Live';
        target.publicKey = String(item.publicKey || target.publicKey).slice(0, 120);
        target.processingFeePercent = Math.max(
          0,
          Math.min(15, Number(item.processingFeePercent ?? target.processingFeePercent))
        );
        target.instructions = String(item.instructions || target.instructions).slice(0, 300);
      }
    }
    await saveDatabaseAsync(db);
    res.json({ gateways: db.gateways });
  });

  // Promo Banners CRUD (After-Hero Product & Promo Cards)
  app.post('/api/admin/banners', requireAdmin, async (req, res) => {
    const body = req.body ?? {};
    const title = String(body.title || '').trim();
    const badgeText = String(body.badgeText || 'New Arrival').trim();
    let image = String(body.image || '').trim();
    if (image.startsWith('data:image/')) {
      image = await ensureUploadedMediaUrl(image, 'banners');
    }
    const productId = String(body.productId || db.products[0]?.id || '').trim();
    if (!title || !isValidMediaUrl(image)) {
      res.status(400).json({ error: 'Card title and a valid image are required.' });
      return;
    }
    const newBanner: PromoBanner = {
      id: `banner-${crypto.randomBytes(4).toString('hex')}`,
      badgeText,
      badgeTone: body.badgeTone === 'red' ? 'red' : 'green',
      title,
      productId,
      image,
      ctaLabel: String(body.ctaLabel || 'Buy Now').trim() || 'Buy Now',
      active: body.active !== undefined ? Boolean(body.active) : true,
    };
    db.banners.unshift(newBanner);
    await saveDatabaseAsync(db);
    res.status(201).json({ banner: newBanner });
  });

  app.put('/api/admin/banners/:id', requireAdmin, async (req, res) => {
    const banner = db.banners.find((b) => b.id === req.params.id);
    if (!banner) {
      res.status(404).json({ error: 'Banner not found.' });
      return;
    }
    const body = req.body ?? {};
    if (body.badgeText !== undefined) banner.badgeText = String(body.badgeText).trim();
    if (body.badgeTone !== undefined) {
      banner.badgeTone = body.badgeTone === 'red' ? 'red' : 'green';
    }
    if (body.title !== undefined) banner.title = String(body.title).trim();
    if (body.productId !== undefined) banner.productId = String(body.productId).trim();
    if (body.image !== undefined) {
      let nextImage = String(body.image).trim();
      if (nextImage.startsWith('data:image/')) {
        nextImage = await ensureUploadedMediaUrl(nextImage, 'banners');
      }
      if (isValidMediaUrl(nextImage)) {
        banner.image = nextImage;
      }
    }
    if (body.ctaLabel !== undefined) banner.ctaLabel = String(body.ctaLabel).trim();
    if (body.active !== undefined) banner.active = Boolean(body.active);
    await saveDatabaseAsync(db);
    res.json({ banner });
  });

  app.delete('/api/admin/banners/:id', requireAdmin, async (req, res) => {
    const idx = db.banners.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Banner not found.' });
      return;
    }
    const [removed] = db.banners.splice(idx, 1);
    await saveDatabaseAsync(db);
    res.json({ ok: true, removedId: removed.id });
  });

  // Coupons CRUD
  app.post('/api/admin/coupons', requireAdmin, async (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const type = req.body?.type === 'fixed' ? 'fixed' : 'percent';
    const value = Number(req.body?.value || 0);
    const minOrderAmount = Math.max(0, Number(req.body?.minOrderAmount || 0));

    if (!code || !/^[A-Z0-9_-]{3,20}$/.test(code) || value <= 0) {
      res.status(400).json({ error: 'Valid alphanumeric coupon code and value required.' });
      return;
    }
    if (db.coupons.some((c) => c.code === code)) {
      res.status(409).json({ error: 'Coupon code already exists.' });
      return;
    }

    const coupon: Coupon = {
      id: `cpn-${Date.now()}`,
      code,
      type,
      value: type === 'percent' ? Math.min(90, value) : value,
      minOrderAmount,
      usageCount: 0,
      active: true,
    };
    db.coupons.unshift(coupon);
    await saveDatabaseAsync(db);
    res.status(201).json({ coupon });
  });

  app.patch('/api/admin/coupons/:id', requireAdmin, async (req, res) => {
    const coupon = db.coupons.find((c) => c.id === req.params.id);
    if (!coupon) {
      res.status(404).json({ error: 'Coupon not found.' });
      return;
    }
    if (req.body?.active !== undefined) coupon.active = Boolean(req.body.active);
    await saveDatabaseAsync(db);
    res.json({ coupon });
  });

  app.delete('/api/admin/coupons/:id', requireAdmin, async (req, res) => {
    const idx = db.coupons.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Coupon not found.' });
      return;
    }
    db.coupons.splice(idx, 1);
    await saveDatabaseAsync(db);
    res.json({ ok: true });
  });

  // Storefront Settings (Global WhatsApp, Delivery Fee, Bank Account, Flash Sales Titles)
  app.put('/api/admin/settings', requireAdmin, async (req, res) => {
    const body = req.body ?? {};
    let heroUrl = body.heroImageUrl ? String(body.heroImageUrl).trim() : '';
    if (heroUrl.startsWith('data:image/')) {
      heroUrl = await ensureUploadedMediaUrl(heroUrl, 'settings');
    }
    let missionUrl = body.missionImageUrl ? String(body.missionImageUrl).trim() : '';
    if (missionUrl.startsWith('data:image/')) {
      missionUrl = await ensureUploadedMediaUrl(missionUrl, 'settings');
    }

    db.settings = {
      ...db.settings,
      storeName: String(body.storeName ?? db.settings.storeName).slice(0, 100),
      businessCategory: String(body.businessCategory ?? db.settings.businessCategory).slice(0, 200),
      heroKicker: String(body.heroKicker ?? db.settings.heroKicker).slice(0, 120),
      heroHeading: String(body.heroHeading ?? db.settings.heroHeading).slice(0, 80),
      heroSubheading: String(body.heroSubheading ?? db.settings.heroSubheading).slice(0, 80),
      heroDescription: String(body.heroDescription ?? db.settings.heroDescription).slice(0, 350),
      aboutHeading: String(body.aboutHeading ?? db.settings.aboutHeading).slice(0, 180),
      aboutDescription: String(body.aboutDescription ?? db.settings.aboutDescription).slice(0, 600),
      flashSalesHeading: String(body.flashSalesHeading ?? db.settings.flashSalesHeading ?? 'Flash Sales Deals').slice(0, 100),
      flashSalesSubheading: String(body.flashSalesSubheading ?? db.settings.flashSalesSubheading ?? '').slice(0, 220),
      supportEmail: String(body.supportEmail ?? db.settings.supportEmail).slice(0, 120),
      supportPhone: String(body.supportPhone ?? db.settings.supportPhone).slice(0, 60),
      whatsappNumber: String(body.whatsappNumber ?? db.settings.whatsappNumber).slice(0, 60),
      address: String(body.address ?? db.settings.address).slice(0, 240),
      landmark: String(body.landmark ?? db.settings.landmark).slice(0, 240),
      businessHours: String(body.businessHours ?? db.settings.businessHours).slice(0, 120),
      currencySymbol: String(body.currencySymbol ?? db.settings.currencySymbol).slice(0, 4),
      taxRatePercent: safeFiniteNumber(body.taxRatePercent, db.settings.taxRatePercent, 0, 35),
      flatShippingFee: safeFiniteNumber(body.flatShippingFee, db.settings.flatShippingFee, 0),
      freeShippingThreshold: safeFiniteNumber(
        body.freeShippingThreshold,
        db.settings.freeShippingThreshold,
        0
      ),
      heroImageUrl:
        heroUrl && isValidMediaUrl(heroUrl)
          ? heroUrl.startsWith('data:') ? heroUrl : heroUrl.slice(0, 1000)
          : db.settings.heroImageUrl || '/src/assets/images/hero-showcase.jpg',
      missionImageUrl:
        missionUrl && isValidMediaUrl(missionUrl)
          ? missionUrl.startsWith('data:') ? missionUrl : missionUrl.slice(0, 1000)
          : db.settings.missionImageUrl || '/src/assets/images/leadership-photo.png',
      bankDetails: {
        bankName: String(body.bankDetails?.bankName ?? db.settings.bankDetails.bankName).slice(0, 120),
        accountName: String(
          body.bankDetails?.accountName ?? db.settings.bankDetails.accountName
        ).slice(0, 120),
        accountNumber: String(
          body.bankDetails?.accountNumber ?? db.settings.bankDetails.accountNumber
        ).slice(0, 60),
        routingCode: String(
          body.bankDetails?.routingCode ?? db.settings.bankDetails.routingCode
        ).slice(0, 40),
      },
      secondaryBankDetails: {
        enabled:
          body.secondaryBankDetails?.enabled !== undefined
            ? Boolean(body.secondaryBankDetails.enabled)
            : db.settings.secondaryBankDetails?.enabled ?? true,
        bankName: String(
          body.secondaryBankDetails?.bankName ??
            db.settings.secondaryBankDetails?.bankName ??
            'Opay'
        ).slice(0, 120),
        accountName: String(
          body.secondaryBankDetails?.accountName ??
            db.settings.secondaryBankDetails?.accountName ??
            'Maji Emmanuel'
        ).slice(0, 120),
        accountNumber: String(
          body.secondaryBankDetails?.accountNumber ??
            db.settings.secondaryBankDetails?.accountNumber ??
            ''
        ).slice(0, 60),
        routingCode: String(
          body.secondaryBankDetails?.routingCode ??
            db.settings.secondaryBankDetails?.routingCode ??
            ''
        ).slice(0, 40),
      },
    };
    await saveDatabaseAsync(db);
    res.json({ settings: db.settings });
  });

  // Inquiries Status Update & Delete
  app.patch('/api/admin/inquiries/:id', requireAdmin, async (req, res) => {
    const inquiry = db.inquiries.find((i) => i.id === req.params.id);
    if (!inquiry) {
      res.status(404).json({ error: 'Inquiry not found.' });
      return;
    }
    if (req.body?.status) inquiry.status = req.body.status;
    await saveDatabaseAsync(db);
    res.json({ inquiry });
  });

  app.delete('/api/admin/inquiries/:id', requireAdmin, async (req, res) => {
    const idx = db.inquiries.findIndex((i) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Inquiry not found.' });
      return;
    }
    db.inquiries.splice(idx, 1);
    await saveDatabaseAsync(db);
    res.json({ ok: true });
  });

  const buildSupabaseDiagnostics = () => ({
    ...supabaseStatus,
    envStatus: {
      supabaseUrl: Boolean(
        cleanEnv(
          process.env.SUPABASE_URL ||
            process.env.NEXT_PUBLIC_SUPABASE_URL ||
            process.env.VITE_SUPABASE_URL
        )
      ),
      supabaseServiceKey: Boolean(
        cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)
      ),
      adminPasscodeEnv: Boolean(cleanEnv(process.env.ADMIN_PASSCODE)),
      sessionSecret: Boolean(cleanEnv(process.env.SESSION_SECRET)),
    },
    counts: {
      products: db.products.length,
      gallery: db.aboutMedia.length,
      banners: db.banners.length,
      orders: db.orders.length,
    },
  });

  // Supabase Global Connection Status & Manual Sync (Admin Protected)
  app.get('/api/admin/supabase-status', requireAdmin, (_req, res) => {
    res.json(buildSupabaseDiagnostics());
  });

  app.post('/api/admin/supabase-pull', requireAdmin, async (_req, res) => {
    if (!supabaseClient) {
      res.status(400).json({
        error: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables first.',
        status: buildSupabaseDiagnostics(),
      });
      return;
    }
    await ensureLatestState(true);
    if (!supabaseStatus.connected) {
      res.status(502).json({
        error: supabaseStatus.lastError || 'Could not reach Supabase tables. Make sure you ran supabase_schema.sql in your Supabase SQL Editor.',
        status: buildSupabaseDiagnostics(),
      });
      return;
    }
    res.json({ ok: true, status: buildSupabaseDiagnostics() });
  });

  app.post('/api/admin/supabase-sync', requireAdmin, async (_req, res) => {
    if (!supabaseClient) {
      res.status(400).json({
        error: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables first.',
        status: buildSupabaseDiagnostics(),
      });
      return;
    }
    for (const item of db.aboutMedia) {
      if (item.url.startsWith('data:image/')) {
        item.url = await ensureUploadedMediaUrl(item.url, 'gallery');
      }
    }
    for (const prod of db.products) {
      if (prod.image.startsWith('data:image/')) {
        prod.image = await ensureUploadedMediaUrl(prod.image, 'products');
      }
    }
    for (const ban of db.banners) {
      if (ban.image.startsWith('data:image/')) {
        ban.image = await ensureUploadedMediaUrl(ban.image, 'banners');
      }
    }
    await ensureMediaBucketPublic();
    siteAssetsSynced = false;
    await ensureSiteAssetsInSupabaseStorage();
    await saveDatabaseAsync(db);
    if (!supabaseStatus.connected) {
      res.status(502).json({
        error: supabaseStatus.lastError || 'Could not reach Supabase tables. Make sure you ran supabase_schema.sql in your Supabase SQL Editor.',
        status: buildSupabaseDiagnostics(),
      });
      return;
    }
    res.json({ ok: true, status: buildSupabaseDiagnostics() });
  });

  // Clear Store Records (Sales, Orders, Inquiries, Customer Accounts, Transactions) — Keeps Products Intact
  app.post('/api/admin/reset-data', requireAdmin, async (req, res) => {
    const clearProducts = Boolean(req.body?.clearProducts);
    if (clearProducts) {
      db.products = [];
      db.banners = [];
      db.aboutMedia = [];
    }
    db.orders = [];
    db.transactions = [];
    db.inquiries = [];
    db.customers = [];
    db.nextOrderNumber = 1001;
    db.nextTrackingNumber = 1001;
    db.nextEmmyCodeNumber = 1001;
    db.nextExpCodeNumber = 1001;
    await saveDatabaseAsync(db);
    res.json({
      ok: true,
      message: clearProducts
        ? 'All store records and products wiped successfully.'
        : 'All sales, orders, inquiries, transactions, and customer accounts cleared successfully. Catalog products preserved.',
    });
  });

  if (options?.includeErrorHandler !== false) {
    attachErrorHandler(app);
  }

  return app;
}

function attachErrorHandler(app: express.Express) {
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const errObj = err as { type?: string; status?: number; message?: string };
    if (errObj?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Malformed JSON request payload.' });
      return;
    }
    if (errObj?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Uploaded payload exceeds maximum server size limit.' });
      return;
    }
    console.error(`Server error on ${req.method} ${req.path}:`, err);
    if (!res.headersSent) {
      res.status(errObj?.status && errObj.status >= 400 && errObj.status < 600 ? errObj.status : 500).json({
        error: 'An unexpected server error occurred. Please try again.',
      });
    }
  });
}

async function startServer() {
  await hydrateFromSupabase();

  const app = createApiApp({ includeErrorHandler: false });

  // Vite / Static Serving
  if (process.env.NODE_ENV !== 'production') {
    const viteModule = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ viteModule);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  attachErrorHandler(app);

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Emmystylez Solar Electrical Store running on http://0.0.0.0:${port}`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection caught safely:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception caught safely:', error);
});

const entryArg = path.basename(process.argv[1] || '');
if (!IS_SERVERLESS && (entryArg === 'server.ts' || entryArg === 'server.js')) {
  startServer().catch((err) => {
    console.error('Failed to start Emmystylez server:', err);
    process.exit(1);
  });
}
