import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  Menu,
  X,
  ShoppingCart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  Shield,
  ArrowUpRight,
  PackageSearch,
  Eye,
  Plus,
  Clock,
  Star,
  User,
  FileText,
  Zap,
  ShoppingBag,
  MessageCircle,
  ShieldCheck,
  Building2,
  Copy,
  Check,
} from 'lucide-react';
import { SolariLogo } from './SolariLogo';
import {
  ProductsCatalogPage,
  AboutCompanyPage,
  GalleryPage,
  GetQuotePage,
} from './StorefrontPages';
import {
  PRODUCT_CATEGORIES,
  type Product,
  type PromoBanner,
  type StorefrontData,
} from '../types';
import type { CustomerSessionUser } from './AuthModals';
import { formatNaira } from '../utils/invoicePdf';

export type StorefrontPage = 'home' | 'products' | 'about' | 'gallery' | 'quote';

interface StorefrontProps {
  data: StorefrontData;
  activePage: StorefrontPage;
  selectedCategory: string;
  cartCount: number;
  customerUser: CustomerSessionUser | null;
  onNavigatePage: (page: StorefrontPage, category?: string) => void;
  onAddToCart: (product: Product, qty?: number, openCart?: boolean) => void;
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
  onOpenOrderLookup: () => void;
  onOpenAuth: (mode?: 'login' | 'register' | 'forgot') => void;
  onOpenAdmin: () => void;
  onOpenPolicy: () => void;
  policyChoice: 'accepted' | 'declined' | null;
  onAcceptPolicy: () => void;
  onDeclinePolicy: () => void;
}

export const Storefront: React.FC<StorefrontProps> = ({
  data,
  activePage,
  selectedCategory,
  cartCount,
  customerUser,
  onNavigatePage,
  onAddToCart,
  onSelectProduct,
  onOpenCart,
  onOpenOrderLookup,
  onOpenAuth,
  onOpenAdmin,
  onOpenPolicy,
  policyChoice,
  onAcceptPolicy,
  onDeclinePolicy,
}) => {
  const { products, banners, settings } = data;
  const currency = settings.currencySymbol || '₦';

  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSaved, setNewsletterSaved] = useState(false);
  const [copiedBankIdx, setCopiedBankIdx] = useState<1 | 2 | null>(null);

  // Flash sales horizontal arrow nudge offset
  const [flashOffset, setFlashOffset] = useState(0);
  const [flashPaused, setFlashPaused] = useState(false);
  const flashContainerRef = useRef<HTMLDivElement | null>(null);

  const flashSaleProducts = useMemo(() => {
    const flagged = products.filter((p) => p.isFlashSale);
    return flagged.length > 0 ? flagged : products.slice(0, 6);
  }, [products]);

  const masqueradeItems = useMemo(
    () => [...flashSaleProducts, ...flashSaleProducts],
    [flashSaleProducts]
  );

  const displayedHomeProducts = useMemo(() => {
    const list = products;
    if (!searchQuery.trim()) {
      const featured = list.filter((p) => p.featured);
      return featured.length >= 8 ? featured.slice(0, 8) : list.slice(0, 8);
    }
    const q = searchQuery.trim().toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.specifications || '').toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const handlePromoClick = (banner: PromoBanner) => {
    const matched = products.find((p) => p.id === banner.productId);
    if (matched) {
      onSelectProduct(matched);
    } else {
      onNavigatePage('products');
    }
  };

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.includes('@')) return;
    setNewsletterSaved(true);
    setNewsletterEmail('');
  };

  const handleFlashStep = (direction: 'prev' | 'next') => {
    setFlashPaused(true);
    setFlashOffset((prev) => {
      const step = 300;
      const next = direction === 'next' ? prev - step : prev + step;
      if (next > 450) return -450;
      if (next < -900) return 0;
      return next;
    });
  };

  const whatsappDigits = settings.whatsappNumber.replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-white text-[#151916] flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-neutral-100">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 h-16 lg:h-[76px] flex items-center justify-between gap-3 sm:gap-6">
          {/* Zone 1: Business Name Wordmark (no logo icon) */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              onNavigatePage('home');
            }}
            className="min-w-0 truncate max-w-[195px] sm:max-w-none"
          >
            <SolariLogo label={settings.storeName} />
          </a>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden lg:flex items-center gap-5 text-[13px] font-semibold tracking-wide text-[#1D231F]">
            <button
              type="button"
              onClick={() => onNavigatePage('home')}
              className={`inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'home' ? 'text-[#4CB04F]' : 'hover:text-[#4CB04F]'
              }`}
            >
              <span>HOME</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown(openDropdown === 'products' ? null : 'products')
                }
                className={`inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                  activePage === 'products' ? 'text-[#4CB04F]' : 'hover:text-[#4CB04F]'
                }`}
              >
                <span>PRODUCTS</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>
              {openDropdown === 'products' && (
                <div
                  className="absolute left-0 top-full mt-3 w-64 bg-white rounded-lg shadow-lg border border-neutral-100 py-2 z-50 max-h-80 overflow-y-auto"
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenDropdown(null);
                      onNavigatePage('products', 'All');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-[#4CB04F] hover:bg-[#EDF7EE]"
                  >
                    All Products &amp; Specifications
                  </button>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setOpenDropdown(null);
                        onNavigatePage('products', cat);
                      }}
                      className="w-full text-left px-4 py-1.5 text-xs font-medium text-neutral-700 hover:bg-[#EDF7EE] hover:text-[#235D25]"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigatePage('gallery')}
              className={`inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'gallery' ? 'text-[#4CB04F]' : 'hover:text-[#4CB04F]'
              }`}
            >
              <span>GALLERY</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigatePage('about')}
              className={`inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'about' ? 'text-[#4CB04F]' : 'hover:text-[#4CB04F]'
              }`}
            >
              <span>ABOUT</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigatePage('quote')}
              className={`inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'quote' ? 'text-[#4CB04F]' : 'hover:text-[#4CB04F]'
              }`}
            >
              <span>GET QUOTE</span>
            </button>

            <button
              type="button"
              onClick={onOpenOrderLookup}
              className="hover:text-[#4CB04F] transition-colors whitespace-nowrap shrink-0"
            >
              TRACK ORDER
            </button>

            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-[#4CB04F] transition-colors whitespace-nowrap shrink-0"
            >
              {customerUser ? `ACCOUNT (${customerUser.fullName.split(' ')[0]})` : 'LOGIN'}
            </button>
          </nav>

          {/* Zone 3: Search, Menu Toggle, Cart */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activePage === 'home') {
                  setSearchOpen((v) => !v);
                  document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  onNavigatePage('products', 'All');
                }
              }}
              aria-label="Search solar & electrical products"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1D231F] hover:text-[#4CB04F] hover:bg-neutral-100 transition-colors"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            {/* Menu Toggle */}
            <button
              type="button"
              onClick={() => setMenuDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1D231F] hover:text-[#4CB04F] hover:bg-neutral-100 transition-colors"
            >
              <Menu className="w-[19px] h-[19px]" />
            </button>

            <button
              type="button"
              onClick={onOpenCart}
              aria-label="Open shopping cart"
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#1D231F] hover:text-[#4CB04F] hover:bg-neutral-100 transition-colors"
            >
              <ShoppingCart className="w-[18px] h-[18px]" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#4CB04F] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Slide-Over Navigation Menu Drawer */}
      {menuDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/45"
          onClick={() => setMenuDrawerOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <SolariLogo label={settings.storeName} />
              <button
                type="button"
                onClick={() => setMenuDrawerOpen(false)}
                aria-label="Close menu"
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-sm flex-1">
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Pages
                </p>
                <div className="space-y-1">
                  {[
                    { label: 'Home', action: () => onNavigatePage('home') },
                    {
                      label: 'Products & Categories Search',
                      action: () => onNavigatePage('products', 'All'),
                    },
                    {
                      label: 'Gallery (Images, Videos & Specs)',
                      action: () => onNavigatePage('gallery'),
                    },
                    {
                      label: 'About Us (Our Greatness & Profile)',
                      action: () => onNavigatePage('about'),
                    },
                    {
                      label: 'Get a Quote (Installations & Wholesale)',
                      action: () => onNavigatePage('quote'),
                    },
                    { label: 'Track Order (Emmy1001...)', action: () => onOpenOrderLookup() },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setMenuDrawerOpen(false);
                        item.action();
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-xs font-semibold text-[#151916] hover:bg-[#EDF7EE] hover:text-[#235D25] transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Customer Account
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {customerUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuDrawerOpen(false);
                        onOpenAuth('login');
                      }}
                      className="col-span-2 px-3 py-2 rounded-md bg-[#EDF7EE] text-[#235D25] text-xs font-semibold flex items-center justify-center gap-2"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>{customerUser.fullName}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuDrawerOpen(false);
                          onOpenAuth('login');
                        }}
                        className="px-3 py-2 rounded-md border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold"
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuDrawerOpen(false);
                          onOpenAuth('register');
                        }}
                        className="px-3 py-2 rounded-md bg-[#4CB04F] text-white text-xs font-semibold border border-transparent btn-hover-white"
                      >
                        Create Account
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Product &amp; Service Categories
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setMenuDrawerOpen(false);
                        onNavigatePage('products', cat);
                      }}
                      className="text-left px-3 py-1.5 rounded text-xs text-neutral-700 hover:bg-[#EDF7EE] hover:text-[#235D25]"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 text-xs text-neutral-600 space-y-1">
                <p className="font-bold text-[#151916]">{settings.storeName}</p>
                <p>{settings.address}</p>
                <p>{settings.businessHours}</p>
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#4CB04F] hover:underline inline-block"
                >
                  WhatsApp: {settings.whatsappNumber}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAGE VIEW ROUTING */}
      {activePage === 'products' && (
        <ProductsCatalogPage
          data={data}
          initialCategory={selectedCategory}
          onAddToCart={onAddToCart}
          onSelectProduct={onSelectProduct}
          onBackHome={() => onNavigatePage('home')}
        />
      )}

      {activePage === 'gallery' && (
        <GalleryPage
          data={data}
          onNavigateQuote={() => onNavigatePage('quote')}
          onBackHome={() => onNavigatePage('home')}
        />
      )}

      {activePage === 'about' && (
        <AboutCompanyPage
          data={data}
          onNavigateQuote={() => onNavigatePage('quote')}
          onNavigateProducts={() => onNavigatePage('products', 'All')}
          onNavigateGallery={() => onNavigatePage('gallery')}
          onBackHome={() => onNavigatePage('home')}
        />
      )}

      {activePage === 'quote' && (
        <GetQuotePage data={data} onBackHome={() => onNavigatePage('home')} />
      )}

      {activePage === 'home' && (
        <>
          {/* Hero Section (Preserved Layout, Colors & Hero Font) */}
          <section
            id="home"
            className="font-hero relative bg-[#F3F5F4] overflow-hidden border-b border-neutral-100"
          >
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
              viewBox="0 0 1440 520"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 420C280 350 480 480 820 390C1120 310 1280 360 1440 310V520H0V420Z"
                fill="#E9ECEA"
              />
              <path
                d="M0 120C240 160 440 60 720 110C1040 165 1240 70 1440 110"
                stroke="#E1E5E2"
                strokeWidth="1.5"
              />
            </svg>

            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[420px] lg:min-h-[500px] relative z-10">
              <div className="lg:col-span-6 py-8 sm:py-12 lg:py-20 flex flex-col justify-center">
                <p className="text-xs sm:text-[13px] font-semibold text-[#4CB04F] mb-2.5 sm:mb-3">
                  {settings.heroKicker}
                </p>

                <h1 className="text-3xl sm:text-5xl lg:text-[50px] font-extrabold tracking-tight text-[#151916] leading-[1.08]">
                  {settings.heroHeading.includes('DISCOVER') ? (
                    <>
                      ENERGY{' '}
                      <span className="relative inline-block">
                        DISCOVER
                        <svg
                          className="absolute left-0 -bottom-2 w-full h-3 text-[#4CB04F]"
                          viewBox="0 0 220 14"
                          fill="none"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M3 10.5C68 3 152 2.5 217 8.5"
                            stroke="currentColor"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    </>
                  ) : (
                    settings.heroHeading
                  )}
                </h1>

                <p className="text-2xl sm:text-4xl lg:text-[42px] font-light italic text-[#1D231F] mt-2 mb-3 sm:mb-4 leading-tight">
                  {settings.heroSubheading}
                </p>

                <p className="text-xs sm:text-sm text-[#5F6761] max-w-md leading-relaxed mb-6 sm:mb-7">
                  {settings.heroDescription}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigatePage('products', 'All')}
                    className="px-6 sm:px-7 py-2.5 sm:py-3 rounded-[4px] bg-[#4CB04F] text-white text-xs sm:text-sm font-semibold border border-transparent shadow-xs btn-hover-white"
                  >
                    Shop Now
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigatePage('quote')}
                    className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-[4px] border border-[#151916]/25 text-[#151916] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 btn-hover-white"
                  >
                    <FileText className="w-4 h-4 text-[#4CB04F]" />
                    <span>Get a Quote</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 relative flex items-end justify-end pb-4 lg:pb-0 lg:min-h-full">
                <div className="relative w-full h-[250px] sm:h-[380px] lg:h-[500px] flex items-end justify-end overflow-hidden rounded-lg lg:rounded-none">
                  <img
                    src={
                      settings.heroImageUrl &&
                      !settings.heroImageUrl.includes('i.ibb.co/5hvHYxLt/IMG-20261120-WA0081.jpg')
                        ? settings.heroImageUrl
                        : '/src/assets/images/hero-showcase.jpg'
                    }
                    alt="Emmystylez Solar Electrical Store Featured Showcase"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const fallback = '/src/assets/images/hero-showcase.jpg';
                      if (!e.currentTarget.src.endsWith(fallback)) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                    className="w-full h-full object-cover object-center"
                  />
                  <div
                    className="hidden lg:block absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#F3F5F4] to-transparent pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 4-Column Mint Promo Cards */}
          <section id="promos" className="max-w-[1280px] mx-auto w-full px-5 lg:px-10 pt-8 pb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {banners.map((banner) => (
                <div
                  key={banner.id}
                  onClick={() => handlePromoClick(banner)}
                  className="group cursor-pointer bg-[#EDF7EE] hover:bg-[#E4F3E5] rounded-[6px] p-5 flex items-center justify-between gap-3 transition-colors min-h-[168px]"
                >
                  <div className="flex flex-col justify-between h-full min-w-0 flex-1">
                    <div>
                      <span
                        className={`block text-[11px] font-bold mb-1 ${
                          banner.badgeTone === 'red' ? 'text-[#E04F44]' : 'text-[#4CB04F]'
                        }`}
                      >
                        {banner.badgeText}
                      </span>
                      <h2 className="text-[15px] font-bold text-[#151916] leading-snug mb-4">
                        {banner.title}
                      </h2>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePromoClick(banner);
                        }}
                        className="px-4 py-1.5 rounded-[4px] bg-[#4CB04F] text-white text-[11px] font-semibold border border-transparent whitespace-nowrap btn-hover-white"
                      >
                        {banner.ctaLabel}
                      </button>
                    </div>
                  </div>

                  <div className="w-24 h-24 shrink-0 flex items-center justify-center">
                    <img
                      src={banner.image}
                      alt={banner.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const fallback = '/src/assets/images/product_solar_panels_1795501702594.jpg';
                        if (!e.currentTarget.src.endsWith(fallback)) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                      className="w-full h-full object-contain mix-blend-multiply transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FLASH SALES SECTION (GREEN SECTION, SLOW LEFT-TO-RIGHT MASQUERADE GLIDE + ARROWS, BEFORE OUR PRODUCTS) */}
          {flashSaleProducts.length > 0 && (
            <section
              id="flash-sales"
              className="w-full bg-[#4CB04F] text-white py-12 overflow-hidden border-y border-[#3D9A40]"
            >
              <div className="max-w-[1280px] mx-auto px-5 lg:px-10 mb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-white/90 mb-1.5">
                    <Zap className="w-4 h-4 text-white" />
                    <span>FLASH SALES</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    {settings.flashSalesHeading || 'Flash Sales Deals'}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/90 mt-1 max-w-xl">
                    {settings.flashSalesSubheading ||
                      'Admin-curated flash deals on high-capacity solar panels, inverters & batteries.'}
                  </p>
                </div>

                {/* Arrow Controls (Move Back & Front) */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleFlashStep('prev')}
                    aria-label="Move flash sales left"
                    className="w-10 h-10 rounded-full bg-[#151916] text-white border border-white/25 flex items-center justify-center shadow-sm btn-hover-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFlashStep('next')}
                    aria-label="Move flash sales right"
                    className="w-10 h-10 rounded-full bg-[#151916] text-white border border-white/25 flex items-center justify-center shadow-sm btn-hover-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  {flashPaused && (
                    <button
                      type="button"
                      onClick={() => {
                        setFlashOffset(0);
                        setFlashPaused(false);
                      }}
                      className="px-3 h-10 rounded-full bg-white/15 text-white border border-white/30 text-xs font-semibold btn-hover-white"
                    >
                      Resume Glide
                    </button>
                  )}
                </div>
              </div>

              {/* Slow Left-to-Right Masquerade Track */}
              <div
                ref={flashContainerRef}
                className="masquerade-container max-w-[1440px] mx-auto overflow-hidden px-4"
              >
                <div
                  className="transition-transform duration-700 ease-out"
                  style={{ transform: `translate3d(${flashOffset}px, 0, 0)` }}
                >
                  <div
                    className="masquerade-track gap-5"
                    style={flashPaused ? { animationPlayState: 'paused' } : undefined}
                  >
                    {masqueradeItems.map((product, idx) => {
                      const salePrice =
                        product.flashSalePrice && product.flashSalePrice > 0
                          ? product.flashSalePrice
                          : product.price;
                      const origPrice =
                        product.flashSalePrice && product.flashSalePrice > 0
                          ? product.price
                          : product.compareAtPrice;
                      const pctOff =
                        origPrice > salePrice
                          ? Math.round(((origPrice - salePrice) / origPrice) * 100)
                          : 0;

                      return (
                        <article
                          key={`${product.id}-fs-${idx}`}
                          onClick={() => onSelectProduct(product)}
                          className="w-[260px] sm:w-[275px] shrink-0 bg-white text-[#151916] rounded-[8px] p-4 shadow-md flex flex-col justify-between cursor-pointer group"
                        >
                          <div>
                            <div className="relative aspect-[4/3] bg-[#F7F7F7] rounded-[6px] p-4 flex items-center justify-center overflow-hidden mb-3">
                              <img
                                src={product.image}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const fallback = '/src/assets/images/product_solar_panels_1795501702594.jpg';
                                  if (!e.currentTarget.src.endsWith(fallback)) {
                                    e.currentTarget.src = fallback;
                                  }
                                }}
                                className="w-4/5 h-4/5 object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                              />
                              {pctOff > 0 && (
                                <span className="absolute top-2.5 left-2.5 text-[11px] font-bold text-[#E04F44]">
                                  -{pctOff}% Flash
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] font-semibold text-[#4CB04F] truncate">
                              {product.category}
                            </p>
                            <h3 className="text-sm font-bold text-[#151916] mt-0.5 line-clamp-1 group-hover:text-[#4CB04F] transition-colors">
                              {product.name}
                            </h3>
                            <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                              {product.wattage}
                            </p>

                            <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
                              <span className="text-base font-extrabold text-[#151916]">
                                {formatNaira(salePrice, currency)}
                              </span>
                              {origPrice > salePrice && (
                                <span className="text-xs text-[#8E9690] line-through">
                                  {formatNaira(origPrice, currency)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3.5 pt-3 border-t border-neutral-100 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={product.stock <= 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToCart(product, 1, true);
                              }}
                              className="flex-1 h-9 rounded-[4px] bg-[#4CB04F] disabled:bg-neutral-400 text-white text-xs font-semibold border border-transparent flex items-center justify-center gap-1 btn-hover-white"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>Buy</span>
                            </button>
                            <button
                              type="button"
                              disabled={product.stock <= 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToCart(product, 1, false);
                              }}
                              className="h-9 px-3 rounded-[4px] bg-[#151916] disabled:bg-neutral-400 text-white text-xs font-semibold border border-transparent flex items-center justify-center gap-1 btn-hover-white"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Cart</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Our Recent Product Section */}
          <section id="products" className="max-w-[1280px] mx-auto w-full px-5 lg:px-10 py-14">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-3xl sm:text-[34px] font-extrabold text-[#151916] tracking-tight inline-block relative">
                Our Recent{' '}
                <span className="relative inline-block">
                  Product
                  <svg
                    className="absolute left-0 -bottom-2 w-full h-3 text-[#4CB04F]"
                    viewBox="0 0 160 12"
                    fill="none"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 9.5C50 2.5 110 2.5 158 8"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-[#6B726D] mt-4 leading-relaxed">
                Solar panels, inverters, lithium &amp; tubular batteries, electrical materials,
                cables, switches, and lighting equipment at {settings.storeName}.
              </p>
            </div>

            {searchOpen && (
              <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 pb-5 border-b border-neutral-100">
                <div className="relative w-full sm:w-80">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search solar panels, inverters, specs..."
                    className="w-full h-9 pl-8 pr-3 rounded-md border border-neutral-200 text-xs focus:outline-none focus:border-[#4CB04F]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onNavigatePage('products', 'All')}
                  className="text-xs font-semibold text-[#4CB04F] hover:underline"
                >
                  Open All 12 Categories &amp; Specifications →
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {displayedHomeProducts.map((product) => {
                const effectivePrice =
                  product.isFlashSale && product.flashSalePrice && product.flashSalePrice > 0
                    ? product.flashSalePrice
                    : product.price;
                const strikePrice =
                  product.isFlashSale && product.flashSalePrice
                    ? product.price
                    : product.compareAtPrice;

                return (
                  <article
                    key={product.id}
                    className="group flex flex-col items-center text-center"
                  >
                    <div
                      onClick={() => onSelectProduct(product)}
                      className="relative w-full aspect-square bg-[#F7F7F7] rounded-[6px] p-6 flex items-center justify-center overflow-hidden cursor-pointer"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const fallback = '/src/assets/images/product_solar_panels_1795501702594.jpg';
                          if (!e.currentTarget.src.endsWith(fallback)) {
                            e.currentTarget.src = fallback;
                          }
                        }}
                        className="w-4/5 h-4/5 object-contain mix-blend-multiply transition-transform duration-200 group-hover:scale-105"
                      />

                      {product.stock <= 0 && (
                        <span className="absolute top-3 left-3 text-[11px] font-semibold text-red-600 bg-white/90 px-2 py-0.5 rounded">
                          Out of Stock
                        </span>
                      )}

                      <div className="hidden lg:flex absolute inset-x-3 bottom-3 items-center gap-1.5 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                        <button
                          type="button"
                          disabled={product.stock <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(product, 1, false);
                          }}
                          className="flex-1 h-9 rounded-[4px] bg-[#4CB04F] disabled:bg-neutral-400 text-white text-xs font-semibold border border-transparent flex items-center justify-center gap-1 shadow-sm btn-hover-white"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Cart</span>
                        </button>
                        <button
                          type="button"
                          disabled={product.stock <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart(product, 1, true);
                          }}
                          className="flex-1 h-9 rounded-[4px] bg-[#151916] disabled:bg-neutral-400 text-white text-xs font-semibold border border-transparent flex items-center justify-center gap-1 shadow-sm btn-hover-white"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Buy</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProduct(product);
                          }}
                          aria-label={`Quick view ${product.name}`}
                          className="w-9 h-9 rounded-[4px] bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200 flex items-center justify-center shadow-sm"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3
                      onClick={() => onSelectProduct(product)}
                      className="mt-3.5 sm:mt-4 text-[15px] font-bold text-[#151916] hover:text-[#4CB04F] transition-colors cursor-pointer"
                    >
                      {product.name}
                    </h3>

                    <div className="mt-1 flex items-center justify-center gap-2.5 text-[13px] tabular-nums">
                      <span className="font-bold text-[#151916]">
                        {formatNaira(effectivePrice, currency)}
                      </span>
                      {strikePrice > effectivePrice && (
                        <span className="text-[#8E9690] line-through">
                          {formatNaira(strikePrice, currency)}
                        </span>
                      )}
                    </div>

                    {/* Touch-friendly mobile actions below price */}
                    <div className="mt-3 w-full flex lg:hidden items-center gap-2">
                      <button
                        type="button"
                        disabled={product.stock <= 0}
                        onClick={() => onAddToCart(product, 1, false)}
                        className="flex-1 h-9 rounded-[4px] bg-[#4CB04F] disabled:bg-neutral-400 text-white text-xs font-semibold border border-transparent flex items-center justify-center gap-1 btn-hover-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Cart</span>
                      </button>
                      <button
                        type="button"
                        disabled={product.stock <= 0}
                        onClick={() => onAddToCart(product, 1, true)}
                        className="flex-1 h-9 rounded-[4px] bg-[#151916] disabled:bg-neutral-400 text-white text-xs font-semibold border border-transparent flex items-center justify-center gap-1 btn-hover-white"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Buy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectProduct(product)}
                        aria-label={`View ${product.name}`}
                        className="w-9 h-9 rounded-[4px] bg-white border border-neutral-200 text-neutral-700 flex items-center justify-center"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="text-center mt-10">
              <button
                type="button"
                onClick={() => onNavigatePage('products', 'All')}
                className="px-6 py-2.5 rounded-[4px] border border-neutral-300 text-[#151916] text-xs font-semibold btn-hover-white"
              >
                Explore All Categories &amp; Specifications
              </button>
            </div>
          </section>

          {/* About Us Section */}
          <section id="about" className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-10 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
              <div className="lg:col-span-6 relative sm:pr-6">
                <div className="relative max-w-[440px] mx-auto lg:mx-0">
                  <div className="relative rounded-t-[10px] overflow-hidden aspect-[3/4] bg-[#F3F5F4] border border-b-0 border-neutral-200/80 shadow-sm">
                    <img
                      src={
                        settings.missionImageUrl &&
                        !settings.missionImageUrl.includes('i.ibb.co/GQdg80PP/leadership-photo.png')
                          ? settings.missionImageUrl
                          : '/src/assets/images/leadership-photo.png'
                      }
                      alt={`${settings.storeName} Leadership — Make Solar Energy Accessible`}
                      referrerPolicy="no-referrer"
                      loading="eager"
                      decoding="async"
                      onError={(e) => {
                        const fallback = '/src/assets/images/leadership-photo.png';
                        if (!e.currentTarget.src.endsWith(fallback)) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>

                  <div
                    className="hidden sm:flex flex-col items-center gap-3 absolute top-4 -right-5 bottom-4"
                    aria-hidden="true"
                  >
                    <div className="w-[3px] flex-1 bg-[#4CB04F] rounded-full" />
                    <div className="w-[3px] h-14 bg-[#4CB04F] rounded-full" />
                  </div>

                  <div className="bg-[#1D221F] text-white px-6 py-4 rounded-b-[10px] shadow-md">
                    <p className="text-[10px] font-semibold tracking-wider text-[#66C969] uppercase mb-1">
                      OUR MISSION
                    </p>
                    <p className="text-sm sm:text-base font-extrabold leading-snug tracking-tight">
                      MAKE SOLAR ENERGY ACCESSIBLE
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-[2px] bg-[#4CB04F]" aria-hidden="true" />
                  <span className="text-xs font-bold tracking-wider text-[#4CB04F] uppercase">
                    ABOUT US
                  </span>
                </div>

                <h2 className="text-3xl sm:text-[38px] font-extrabold text-[#151916] leading-[1.15] tracking-tight mb-5 text-balance">
                  {settings.aboutHeading}
                </h2>

                <p className="text-sm text-[#6B726D] leading-relaxed mb-7">
                  {settings.aboutDescription}
                </p>

                <ul className="space-y-3.5 mb-8">
                  {[
                    'Solar Installation Solutions (Homes, Offices, Businesses)',
                    'Electrical Materials, Cables, Switches & Power Protection',
                    'Inverters, Solar Panels, Lithium & Tubular Batteries',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-sm font-semibold text-[#151916]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#4CB04F] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigatePage('about')}
                    className="px-7 py-3 rounded-[4px] bg-[#4CB04F] text-white text-sm font-semibold border border-transparent btn-hover-white"
                  >
                    Our Story &amp; Greatness
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigatePage('gallery')}
                    className="px-6 py-3 rounded-[4px] border border-neutral-300 text-[#151916] text-sm font-semibold btn-hover-white"
                  >
                    View Gallery
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigatePage('quote')}
                    className="px-6 py-3 rounded-[4px] border border-neutral-300 text-[#151916] text-sm font-semibold btn-hover-white"
                  >
                    Get a Quote
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer id="footer" className="bg-[#141916] text-neutral-300 mt-auto">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-10 py-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-4">
            <SolariLogo dark label={settings.storeName} />
            <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">
              {settings.businessCategory}. Providing reliable solar installations, electrical
              materials, and electronics for homeowners, businesses, contractors, and installers.
            </p>
            <div className="space-y-1.5 text-xs text-neutral-400 pt-1">
              <p className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#4CB04F] shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#4CB04F]" />
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#4CB04F]"
                >
                  {settings.whatsappNumber} (Call &amp; WhatsApp)
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#4CB04F]" />
                <span>{settings.businessHours}</span>
              </p>
              <p className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-[#4CB04F]" />
                <span>
                  Google Rating: {settings.googleRating} stars ({settings.googleReviewCount}{' '}
                  reviews)
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#4CB04F]" />
                <span>{settings.supportEmail}</span>
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-sm font-bold text-white">Navigation</h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigatePage('home')}
                  className="hover:text-[#4CB04F] transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigatePage('products', 'All')}
                  className="hover:text-[#4CB04F] transition-colors"
                >
                  Products &amp; Categories
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigatePage('gallery')}
                  className="hover:text-[#4CB04F] transition-colors"
                >
                  Gallery &amp; Specs
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigatePage('about')}
                  className="hover:text-[#4CB04F] transition-colors"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigatePage('quote')}
                  className="hover:text-[#4CB04F] transition-colors"
                >
                  Get a Quote
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenOrderLookup}
                  className="inline-flex items-center gap-1.5 hover:text-[#4CB04F] transition-colors"
                >
                  <PackageSearch className="w-3.5 h-3.5" />
                  <span>Track Order</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-sm font-bold text-white">Categories &amp; Solutions</h4>
            <ul className="space-y-2 text-xs text-neutral-400">
              {[
                'Solar panels',
                'Solar inverters',
                'Lithium batteries',
                'Tubular batteries',
                'Electrical materials',
                'Solar installation solutions',
              ].map((cat) => (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => onNavigatePage('products', cat)}
                    className="hover:text-[#4CB04F] transition-colors"
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-sm font-bold text-white">Newsletter &amp; Admin Portal</h4>
            <form onSubmit={handleNewsletter} className="flex gap-2">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 h-9 px-3 rounded-[4px] bg-[#1F2621] border border-neutral-700 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#4CB04F]"
              />
              <button
                type="submit"
                className="px-3.5 h-9 rounded-[4px] bg-[#4CB04F] text-white text-xs font-semibold border border-transparent whitespace-nowrap btn-hover-white"
              >
                Subscribe
              </button>
            </form>
            {newsletterSaved && (
              <p className="text-[11px] text-[#4CB04F]">Subscribed to {settings.storeName} updates.</p>
            )}


          </div>
        </div>

        {/* Official Store Payment Accounts (Displayed Globally on Website) */}
        <div className="border-t border-neutral-800 bg-[#111714]">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <Building2 className="w-4 h-4 text-[#4CB04F] shrink-0" />
                <span>Official Bank Payment Accounts</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Make transfers only to these verified store accounts, then upload your receipt at
                checkout.
              </p>
            </div>

            <div
              className={`grid grid-cols-1 ${
                settings.secondaryBankDetails?.enabled !== false &&
                settings.secondaryBankDetails?.accountNumber?.trim()
                  ? 'sm:grid-cols-2'
                  : ''
              } gap-4`}
            >
              {/* First Account */}
              <div className="rounded-lg bg-[#1A211D] border border-neutral-800 p-4 flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#4CB04F]">
                    Account 1 — {settings.bankDetails.bankName}
                  </span>
                  <p className="text-xs font-semibold text-white truncate">
                    Account Name: {settings.bankDetails.accountName}
                  </p>
                  <p className="text-base font-extrabold text-white font-mono-tabular tracking-wide">
                    {settings.bankDetails.accountNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(settings.bankDetails.accountNumber);
                    setCopiedBankIdx(1);
                    setTimeout(() => setCopiedBankIdx(null), 1800);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded bg-[#4CB04F]/15 hover:bg-[#4CB04F]/25 border border-[#4CB04F]/40 text-[#66C969] text-[11px] font-semibold shrink-0 transition-colors"
                >
                  {copiedBankIdx === 1 ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedBankIdx === 1 ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Second Account */}
              {settings.secondaryBankDetails?.enabled !== false &&
                settings.secondaryBankDetails?.accountNumber?.trim() && (
                  <div className="rounded-lg bg-[#1A211D] border border-neutral-800 p-4 flex items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#4CB04F]">
                        Account 2 — {settings.secondaryBankDetails.bankName}
                      </span>
                      <p className="text-xs font-semibold text-white truncate">
                        Account Name: {settings.secondaryBankDetails.accountName}
                      </p>
                      <p className="text-base font-extrabold text-white font-mono-tabular tracking-wide">
                        {settings.secondaryBankDetails.accountNumber}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          settings.secondaryBankDetails?.accountNumber || ''
                        );
                        setCopiedBankIdx(2);
                        setTimeout(() => setCopiedBankIdx(null), 1800);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded bg-[#4CB04F]/15 hover:bg-[#4CB04F]/25 border border-[#4CB04F]/40 text-[#66C969] text-[11px] font-semibold shrink-0 transition-colors"
                    >
                      {copiedBankIdx === 2 ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedBankIdx === 2 ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Store Policy & WhatsApp Help Bar inside Footer (Non-Blocking) */}
        <div className="border-t border-neutral-800 bg-[#101412]">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#4CB04F] shrink-0" />
                <span>Store Policy &amp; Customer Support</span>
                {policyChoice === 'accepted' && (
                  <span className="px-2 py-0.5 rounded bg-[#4CB04F]/20 text-[#66C969] text-[10px] font-semibold">
                    Accepted
                  </span>
                )}
                {policyChoice === 'declined' && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                    Declined
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                All solar and electrical items are checked before dispatch across Nigeria. Transfers
                should go only to the verified checkout bank accounts, with receipt upload for your{' '}
                <span className="font-mono-tabular text-neutral-200">Emmy1001+</span> tracking code.
                Need help? Message us on WhatsApp:{' '}
                <a
                  href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
                    `Hello ${settings.storeName}, I need assistance on your website.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#4CB04F] font-semibold hover:underline font-mono-tabular"
                >
                  {settings.whatsappNumber}
                </a>
                .
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
                  `Hello ${settings.storeName}, I need assistance on your website.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded bg-[#1E2520] hover:bg-[#27312A] border border-neutral-700 text-white text-[11px] font-semibold transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#4CB04F]" />
                <span>WhatsApp Help</span>
              </a>
              {policyChoice !== 'accepted' && (
                <button
                  type="button"
                  onClick={onAcceptPolicy}
                  className="px-3.5 h-8 rounded bg-[#4CB04F] text-white text-[11px] font-semibold border border-transparent btn-hover-white"
                >
                  Accept Policy
                </button>
              )}
              {policyChoice !== 'declined' && (
                <button
                  type="button"
                  onClick={onDeclinePolicy}
                  className="px-3 h-8 rounded border border-neutral-700 text-neutral-300 hover:bg-white/5 text-[11px] font-medium transition-colors"
                >
                  Decline
                </button>
              )}
              <button
                type="button"
                onClick={onOpenPolicy}
                className="px-3 h-8 rounded text-neutral-300 hover:text-white underline text-[11px]"
              >
                Full Policy
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-800">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400 text-center sm:text-left">
            <p>
              © {new Date().getFullYear()} {settings.storeName}. {settings.landmark}.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={onOpenPolicy}
                className="hover:text-white transition-colors"
              >
                Store Policy
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="hover:text-white transition-colors"
              >
                {customerUser ? 'My Account' : 'Customer Login'}
              </button>
              <button
                type="button"
                onClick={onOpenOrderLookup}
                className="hover:text-white transition-colors"
              >
                Track Order
              </button>

            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
