-- ============================================================================
-- Emmystylez Solar Electrical Store — Complete Supabase PostgreSQL Schema
-- Paste this entire script into: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Primary Global State Snapshot (used by server.ts for atomic global sync)
CREATE TABLE IF NOT EXISTS public.emmystylez_store_state (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  schema_version INTEGER NOT NULL DEFAULT 5,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Store Settings (Store info, Global WhatsApp, Delivery Fee, Bank Accounts)
CREATE TABLE IF NOT EXISTS public.store_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  store_name TEXT NOT NULL,
  business_category TEXT NOT NULL,
  address TEXT NOT NULL,
  landmark TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  support_email TEXT NOT NULL,
  support_phone TEXT NOT NULL,
  business_hours TEXT NOT NULL,
  currency_symbol TEXT NOT NULL DEFAULT '₦',
  tax_rate_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  flat_shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 5000,
  free_shipping_threshold NUMERIC(12,2) NOT NULL DEFAULT 2500000,
  hero_image_url TEXT,
  mission_image_url TEXT,
  bank_1_name TEXT NOT NULL,
  bank_1_account_name TEXT NOT NULL,
  bank_1_account_number TEXT NOT NULL,
  bank_2_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  bank_2_name TEXT,
  bank_2_account_name TEXT,
  bank_2_account_number TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Products Catalog (Regular Products & Flash Sales)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  wattage TEXT NOT NULL DEFAULT '',
  warranty TEXT NOT NULL DEFAULT '',
  specifications TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_flash_sale BOOLEAN NOT NULL DEFAULT FALSE,
  flash_sale_price NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);
CREATE INDEX IF NOT EXISTS idx_products_flash_sale ON public.products (is_flash_sale) WHERE is_flash_sale = TRUE;

-- 4. After-Hero Showcase & Promo Cards
CREATE TABLE IF NOT EXISTS public.promo_banners (
  id TEXT PRIMARY KEY,
  badge_text TEXT NOT NULL,
  badge_tone TEXT NOT NULL DEFAULT 'green',
  title TEXT NOT NULL,
  product_id TEXT NOT NULL,
  image TEXT NOT NULL,
  cta_label TEXT NOT NULL DEFAULT 'Buy Now',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Gallery Images & Videos with Technical Specifications
CREATE TABLE IF NOT EXISTS public.gallery_media (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  title TEXT NOT NULL,
  specifications TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Checkout Promo Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value NUMERIC(12,2) NOT NULL,
  min_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count INTEGER NOT NULL DEFAULT 0
);

-- 7. Payment Gateways Configuration
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mode TEXT NOT NULL DEFAULT 'Live',
  public_key TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  fee_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  settlement_days INTEGER NOT NULL DEFAULT 0
);

-- 8. Registered Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active_reset_code TEXT,
  reset_code_status TEXT NOT NULL DEFAULT 'Assigned',
  reset_code_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers (LOWER(email));

-- 9. Orders & Emmy1001 Tracking
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  tracking_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_state TEXT NOT NULL,
  delivery_lga TEXT NOT NULL,
  delivery_park TEXT NOT NULL,
  delivery_address TEXT NOT NULL DEFAULT '',
  subtotal NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_method_name TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  order_status TEXT NOT NULL,
  tracking_stage TEXT NOT NULL,
  tracking_location TEXT NOT NULL DEFAULT '',
  waybill_info TEXT NOT NULL DEFAULT '',
  estimated_delivery TEXT NOT NULL DEFAULT '',
  tracking_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  receipt_url TEXT,
  transaction_id TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders (UPPER(tracking_number));
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- 10. Order Line Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

-- 11. Financial Transactions Ledger
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  transaction_ref TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  gateway_id TEXT NOT NULL,
  gateway_name TEXT NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL,
  gateway_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'Live',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Quote & Installation Inquiries
CREATE TABLE IF NOT EXISTS public.customer_inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  customer_type TEXT NOT NULL,
  service_type TEXT NOT NULL,
  property_location TEXT NOT NULL,
  estimated_load TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Enable Row Level Security (RLS) on all tables
-- Server connects with SUPABASE_SERVICE_ROLE_KEY (bypasses RLS safely on backend only).
ALTER TABLE public.emmystylez_store_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_inquiries ENABLE ROW LEVEL SECURITY;

-- Optional public read policies only for non-sensitive storefront catalog tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'Public read active products'
  ) THEN
    CREATE POLICY "Public read active products" ON public.products
      FOR SELECT USING (status <> 'Draft');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'promo_banners' AND policyname = 'Public read active promo banners'
  ) THEN
    CREATE POLICY "Public read active promo banners" ON public.promo_banners
      FOR SELECT USING (active = TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gallery_media' AND policyname = 'Public read active gallery media'
  ) THEN
    CREATE POLICY "Public read active gallery media" ON public.gallery_media
      FOR SELECT USING (active = TRUE);
  END IF;
END $$;

-- 14. Optional Public Storage Bucket for Product, Receipt & Gallery Media
INSERT INTO storage.buckets (id, name, public)
VALUES ('emmystylez-media', 'emmystylez-media', TRUE)
ON CONFLICT (id) DO NOTHING;
