import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Phone,
  Clock,
  Star,
  MessageCircle,
  Zap,
  Wrench,
  Award,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Image as ImageIcon,
  ShoppingBag,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  type AboutMediaItem,
  type Product,
  type StorefrontData,
} from '../types';
import { formatNaira } from '../utils/invoicePdf';

interface ProductsPageProps {
  data: StorefrontData;
  initialCategory?: string;
  onAddToCart: (product: Product, qty?: number, openCart?: boolean) => void;
  onSelectProduct: (product: Product) => void;
  onBackHome: () => void;
}

export const ProductsCatalogPage: React.FC<ProductsPageProps> = ({
  data,
  initialCategory = 'All',
  onAddToCart,
  onSelectProduct,
  onBackHome,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = useMemo(() => {
    return data.products.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.wattage.toLowerCase().includes(q) ||
          (p.specifications || '').toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data.products, selectedCategory, searchQuery]);

  const currency = data.settings.currencySymbol || '₦';

  return (
    <section className="max-w-[1280px] mx-auto w-full px-5 lg:px-10 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
        <div>
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4CB04F] hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <h1 className="text-3xl font-extrabold text-[#151916] tracking-tight">
            Solar &amp; Electrical Products Catalog
          </h1>
          <p className="text-xs sm:text-sm text-[#6B726D] mt-1">
            Browse all solar energy equipment, inverters, batteries, electrical materials, and
            installation hardware at {data.settings.storeName}.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, specs, wattage, SKU..."
            className="w-full h-10 pl-10 pr-4 rounded-md border border-neutral-200 text-xs focus:outline-none focus:border-[#4CB04F]"
          />
        </div>
      </div>

      {/* All 12 Categories */}
      <div className="flex flex-wrap gap-2">
        {['All', ...PRODUCT_CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-2 rounded-[4px] text-xs font-semibold border transition-colors whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-[#4CB04F] text-white border-[#4CB04F] btn-hover-white'
                : 'bg-[#F7F7F7] text-[#1D231F] border-transparent hover:bg-[#EDF7EE]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center bg-[#F7F7F7] rounded-lg space-y-2">
          <p className="text-sm font-bold text-[#151916]">No matching equipment in this category</p>
          <p className="text-xs text-neutral-500">
            Try clearing your search or contact us on WhatsApp at {data.settings.whatsappNumber} for
            wholesale availability.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="mt-2 px-4 py-2 rounded-[4px] bg-[#4CB04F] text-white text-xs font-semibold border border-transparent btn-hover-white"
          >
            Show All Categories
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {filteredProducts.map((product) => {
            const effectivePrice =
              product.isFlashSale && product.flashSalePrice && product.flashSalePrice > 0
                ? product.flashSalePrice
                : product.price;
            const strikePrice =
              product.isFlashSale && product.flashSalePrice
                ? product.price
                : product.compareAtPrice;

            return (
              <article key={product.id} className="group flex flex-col">
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
                      className="w-9 h-9 rounded-[4px] bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200 flex items-center justify-center shadow-sm"
                      aria-label={`View ${product.name}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="pt-3 text-center space-y-1">
                  <p className="text-[11px] font-semibold text-[#4CB04F]">{product.category}</p>
                  <h3
                    onClick={() => onSelectProduct(product)}
                    className="text-[15px] font-bold text-[#151916] hover:text-[#4CB04F] cursor-pointer"
                  >
                    {product.name}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    {product.wattage} · {product.warranty}
                  </p>
                  <div className="pt-1 flex items-center justify-center gap-2.5 text-[13px] tabular-nums">
                    <span className="font-bold text-[#151916]">
                      {formatNaira(effectivePrice, currency)}
                    </span>
                    {strikePrice > effectivePrice && (
                      <span className="text-[#8E9690] line-through">
                        {formatNaira(strikePrice, currency)}
                      </span>
                    )}
                  </div>

                  {/* Mobile touch action buttons */}
                  <div className="pt-2.5 w-full flex lg:hidden items-center gap-2">
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
                      className="w-9 h-9 rounded-[4px] bg-white border border-neutral-200 text-neutral-700 flex items-center justify-center"
                      aria-label={`View ${product.name}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

interface AboutPageProps {
  data: StorefrontData;
  onNavigateQuote: () => void;
  onNavigateProducts: () => void;
  onNavigateGallery: () => void;
  onBackHome: () => void;
}

export const AboutCompanyPage: React.FC<AboutPageProps> = ({
  data,
  onNavigateQuote,
  onNavigateProducts,
  onNavigateGallery,
  onBackHome,
}) => {
  const { settings } = data;
  const whatsappDigits = settings.whatsappNumber.replace(/\D/g, '');

  const pillarsOfGreatness = [
    {
      icon: <Award className="w-5 h-5 text-[#4CB04F]" />,
      title: '01. Unyielding Standard of Originality',
      description:
        'Every solar panel, inverter, battery bank, and electrical switch we stock undergoes strict voltage, load-capacity, and authenticity inspection. We refuse counterfeit components because your family home and enterprise deserve power that never quits.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#4CB04F]" />,
      title: '02. Precision Engineering & Safety Protection',
      description:
        'Power without protection is a hazard. Our installations integrate industrial AC/DC surge arrestors, thermal breakers, tinned copper cabling, and balanced earthing—delivering silent, fire-safe, 24/7 energy confidence.',
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-[#4CB04F]" />,
      title: '03. Built to Outlast Blackouts & Fuel Costs',
      description:
        'From deep-cycle tall tubular batteries to smart LiFePO4 lithium packs, we size systems specifically for Nigerian heat, heavy appliances, and business growth—turning endless generator spending into lasting asset ownership.',
    },
    {
      icon: <CheckCircle2 className="w-5 h-5 text-[#4CB04F]" />,
      title: '04. Transparent Honour & Nationwide Dispatch',
      description:
        'Rooted opposite AP Filling Station on Balewa Road, Ankpa, and trusted across all 36 Nigerian states & FCT. We honour every warranty, back every contractor, and guide every buyer from specification to park waybill.',
    },
  ];

  return (
    <div className="max-w-[1280px] mx-auto w-full px-5 lg:px-10 py-10 space-y-14">
      <div>
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4CB04F] hover:underline mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-8 h-[2px] bg-[#4CB04F]" />
              <span className="text-xs font-bold tracking-wider text-[#4CB04F] uppercase">
                ABOUT {settings.storeName}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#151916] leading-tight text-balance">
              {settings.aboutHeading}
            </h1>

            <p className="text-sm text-[#6B726D] leading-relaxed">{settings.aboutDescription}</p>

            {/* Dual Purpose Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-[#EDF7EE] rounded-[6px] p-5 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#151916]">
                  <Wrench className="w-4 h-4 text-[#4CB04F]" />
                  <span>1. Solar Installations</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Turnkey residential, office, shop, and commercial solar power system sizing,
                  mounting, inverter pairing, and maintenance.
                </p>
              </div>
              <div className="bg-[#F7F7F7] rounded-[6px] p-5 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#151916]">
                  <Zap className="w-4 h-4 text-[#4CB04F]" />
                  <span>2. Electrical &amp; Electronics Store</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Retail and wholesale supply of panels, inverters, lithium &amp; tubular batteries,
                  cables, switches, sockets, lighting, and protection gear.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onNavigateQuote}
                className="px-6 py-3 rounded-[4px] bg-[#4CB04F] text-white text-xs font-semibold border border-transparent btn-hover-white"
              >
                Request Installation or Supply Quote
              </button>
              <button
                type="button"
                onClick={onNavigateGallery}
                className="px-6 py-3 rounded-[4px] bg-[#151916] text-white text-xs font-semibold border border-transparent btn-hover-white inline-flex items-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Explore Project Gallery</span>
              </button>
              <button
                type="button"
                onClick={onNavigateProducts}
                className="px-6 py-3 rounded-[4px] border border-neutral-300 text-[#151916] text-xs font-semibold btn-hover-white"
              >
                Browse All 12 Categories
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <div className="relative rounded-[10px] overflow-hidden border border-neutral-200 bg-neutral-100 shadow-xs max-w-[420px] mx-auto lg:mx-0">
              <div className="aspect-[3/4] w-full bg-[#F3F5F4] overflow-hidden">
                <img
                  src={
                    settings.missionImageUrl &&
                    !settings.missionImageUrl.includes('i.ibb.co/GQdg80PP/leadership-photo.png')
                      ? settings.missionImageUrl
                      : '/src/assets/images/leadership-photo.png'
                  }
                  alt={`${settings.storeName} — Make Solar Energy Accessible`}
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
              <div className="bg-[#1D221F] text-white px-5 py-4">
                <p className="text-[10px] font-semibold tracking-wider text-[#4CB04F] uppercase mb-1">
                  OUR MISSION
                </p>
                <p className="text-sm sm:text-base font-extrabold leading-snug tracking-tight">
                  MAKE SOLAR ENERGY ACCESSIBLE
                </p>
              </div>
            </div>

            <div className="bg-[#F7F7F7] rounded-[8px] p-6 space-y-4 text-xs">
              <h2 className="text-base font-bold text-[#151916]">Store &amp; Location Profile</h2>
              <div className="space-y-3 text-neutral-700">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#4CB04F] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#151916]">Address &amp; Landmark</p>
                  <p>{settings.landmark}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#4CB04F] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#151916]">Business Hours</p>
                  <p>{settings.businessHours}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#4CB04F] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#151916]">Phone &amp; WhatsApp Enquiries</p>
                  <a
                    href={`https://wa.me/${whatsappDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#4CB04F] font-semibold hover:underline"
                  >
                    {settings.whatsappNumber}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Star className="w-4 h-4 text-[#4CB04F] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#151916]">Google Rating</p>
                  <p>
                    {settings.googleRating} stars ({settings.googleReviewCount} reviews)
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200">
              <p className="font-semibold text-[#151916] mb-2">Who We Serve</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-neutral-600">
                {settings.targetCustomers.map((cust) => (
                  <span key={cust} className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[#4CB04F]" />
                    <span>{cust}</span>
                  </span>
                ))}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Words of Greatness & Core Pillars */}
      <div className="space-y-8 border-t border-neutral-100 pt-10">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-bold tracking-wider text-[#4CB04F] uppercase">
            OUR PROMISE OF GREATNESS
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#151916]">
            Why Homeowners, Contractors &amp; Industries Trust {settings.storeName}
          </h2>
          <p className="text-sm text-[#6B726D] leading-relaxed">
            Greatness is measured in years of uninterrupted light, silent nights without generator
            fumes, and electrical systems that stand the test of time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pillarsOfGreatness.map((pillar) => (
            <div
              key={pillar.title}
              className="bg-[#F7F7F7] rounded-[8px] p-6 space-y-2.5 border border-neutral-100"
            >
              <div className="flex items-center gap-2.5">
                {pillar.icon}
                <h3 className="text-base font-bold text-[#151916]">{pillar.title}</h3>
              </div>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-[#151916] text-white rounded-[8px] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <p className="text-xs font-bold text-[#4CB04F] uppercase tracking-wider">
              SEE OUR WORK IN ACTION
            </p>
            <h3 className="text-xl font-extrabold">
              Explore Completed Solar Installations &amp; Showroom Equipment Specifications
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Visit our dedicated Gallery to inspect real photos, installation videos, inverter
              ratings, and full technical specifications.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateGallery}
            className="px-6 py-3 rounded-[4px] bg-[#4CB04F] text-white text-xs font-semibold border border-transparent btn-hover-white shrink-0"
          >
            Open Project Gallery →
          </button>
        </div>
      </div>
    </div>
  );
};

interface GalleryPageProps {
  data: StorefrontData;
  onNavigateQuote: () => void;
  onBackHome: () => void;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({
  data,
  onNavigateQuote,
  onBackHome,
}) => {
  const { aboutMedia, settings } = data;
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selectedMedia, setSelectedMedia] = useState<AboutMediaItem | null>(null);

  const filteredMedia = useMemo(() => {
    return aboutMedia.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      return true;
    });
  }, [aboutMedia, categoryFilter, typeFilter]);

  return (
    <section className="max-w-[1280px] mx-auto w-full px-5 lg:px-10 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-100 pb-6">
        <div>
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4CB04F] hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <h1 className="text-3xl font-extrabold text-[#151916] tracking-tight">
            Installations &amp; Equipment Gallery
          </h1>
          <p className="text-xs sm:text-sm text-[#6B726D] mt-1">
            Real photos and installation videos with complete system specifications from{' '}
            {settings.storeName}.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateQuote}
          className="px-5 py-2.5 rounded-[4px] bg-[#4CB04F] text-white text-xs font-semibold border border-transparent btn-hover-white shrink-0"
        >
          Request Similar Installation Quote
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {['All', 'Solar Installation', 'Electrical Store', 'Team & Showroom'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-2 rounded-[4px] text-xs font-semibold border transition-colors ${
                categoryFilter === cat
                  ? 'bg-[#4CB04F] text-white border-[#4CB04F] btn-hover-white'
                  : 'bg-[#F7F7F7] text-[#1D231F] border-transparent hover:bg-[#EDF7EE]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {(['all', 'image', 'video'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-semibold capitalize border transition-colors ${
                typeFilter === t
                  ? 'bg-[#151916] text-white border-[#151916]'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {t === 'all' ? 'All Media' : `${t}s`}
            </button>
          ))}
        </div>
      </div>

      {filteredMedia.length === 0 ? (
        <div className="p-12 bg-[#F7F7F7] rounded-lg text-center text-xs text-neutral-500">
          No gallery photos or videos match this filter yet. Post images or videos with
          specifications from the Admin Dashboard → Gallery Media tab.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMedia.map((media) => (
            <article
              key={media.id}
              className="bg-white border border-neutral-200 rounded-[6px] overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-[#F7F7F7] overflow-hidden relative group">
                {media.type === 'video' ? (
                  <video src={media.url} controls className="w-full h-full object-cover" />
                ) : (
                  <>
                    <img
                      src={media.url}
                      alt={media.title}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onClick={() => setSelectedMedia(media)}
                      onError={(e) => {
                        const fallback = '/src/assets/images/about_solar_engineer_1795501703000.jpg';
                        if (!e.currentTarget.src.endsWith(fallback)) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                      className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedMedia(media)}
                      aria-label={`View full image ${media.title}`}
                      className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded bg-black/70 text-white text-[10px] font-semibold inline-flex items-center gap-1 opacity-90 hover:opacity-100"
                    >
                      <ZoomIn className="w-3 h-3" />
                      <span>Full View</span>
                    </button>
                  </>
                )}
              </div>
              <div className="p-5 space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[#4CB04F]">
                    <span>{media.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="uppercase">{media.type}</span>
                  </div>
                  <h2 className="text-base font-bold text-[#151916]">{media.title}</h2>
                  {media.caption && (
                    <p className="text-xs text-neutral-600 leading-relaxed">{media.caption}</p>
                  )}
                </div>

                {media.specifications && (
                  <div className="mt-2 pt-3 border-t border-neutral-100 text-[11px] text-neutral-700 bg-[#EDF7EE]/60 rounded p-2.5 flex items-start gap-2">
                    <Cpu className="w-3.5 h-3.5 text-[#4CB04F] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[#151916]">Specifications: </span>
                      <span>{media.specifications}</span>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold text-[#4CB04F]">{selectedMedia.category}</p>
                <h3 className="text-sm sm:text-base font-bold text-[#151916]">{selectedMedia.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMedia(null)}
                aria-label="Close full image view"
                className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-neutral-950 flex-1 overflow-auto flex items-center justify-center p-2 max-h-[65vh]">
              {selectedMedia.type === 'video' ? (
                <video src={selectedMedia.url} controls autoPlay className="max-h-[62vh] max-w-full" />
              ) : (
                <img
                  src={selectedMedia.url}
                  alt={selectedMedia.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[62vh] max-w-full object-contain"
                />
              )}
            </div>
            {(selectedMedia.caption || selectedMedia.specifications) && (
              <div className="p-4 text-xs space-y-1.5 border-t border-neutral-100 bg-white">
                {selectedMedia.caption && <p className="text-neutral-700">{selectedMedia.caption}</p>}
                {selectedMedia.specifications && (
                  <p className="text-[11px] text-[#235D25] font-medium">
                    Specifications: {selectedMedia.specifications}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

interface QuotePageProps {
  data: StorefrontData;
  onBackHome: () => void;
}

export const GetQuotePage: React.FC<QuotePageProps> = ({ data, onBackHome }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState('Homeowners');
  const [serviceType, setServiceType] = useState('Solar installation solutions');
  const [propertyLocation, setPropertyLocation] = useState('');
  const [estimatedLoad, setEstimatedLoad] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const whatsappDigits = data.settings.whatsappNumber.replace(/\D/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          customerType,
          serviceType,
          propertyLocation,
          estimatedLoad,
          message,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not submit quote request.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Network error submitting quote.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-[1000px] mx-auto w-full px-5 lg:px-10 py-10 space-y-8">
      <div>
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4CB04F] hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>
        <h1 className="text-3xl font-extrabold text-[#151916]">
          Get a Solar Installation or Electrical Supply Quote
        </h1>
        <p className="text-xs sm:text-sm text-[#6B726D] mt-1">
          {data.settings.storeName} · {data.settings.address} · {data.settings.businessHours}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-[8px] p-6">
          {submitted ? (
            <div className="py-10 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-[#4CB04F] mx-auto" />
              <h2 className="text-lg font-bold text-[#151916]">Quote Request Received</h2>
              <p className="text-xs text-neutral-600 max-w-md mx-auto">
                Your quote request has been logged in our Admin Dashboard. Our team will reach out
                shortly, or you can chat immediately on WhatsApp ({data.settings.whatsappNumber}).
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-5 py-2 rounded-[4px] bg-[#4CB04F] text-white text-xs font-semibold border border-transparent btn-hover-white"
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-600 mb-1">Full Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name or business name"
                    className="w-full h-10 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 mb-1">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full h-10 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 mb-1">WhatsApp / Phone *</label>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 816 385 5656"
                    className="w-full h-10 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 mb-1">Customer Type</label>
                  <select
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value)}
                    className="w-full h-10 px-3 rounded border border-neutral-300 bg-white"
                  >
                    {data.settings.targetCustomers.map((tc) => (
                      <option key={tc} value={tc}>
                        {tc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-600 mb-1">Product / Service Category</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full h-10 px-3 rounded border border-neutral-300 bg-white"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-600 mb-1">Site Location</label>
                  <input
                    value={propertyLocation}
                    onChange={(e) => setPropertyLocation(e.target.value)}
                    placeholder="e.g. Ankpa, Kogi State"
                    className="w-full h-10 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-600 mb-1">
                  Appliances / System Capacity (Optional)
                </label>
                <input
                  value={estimatedLoad}
                  onChange={(e) => setEstimatedLoad(e.target.value)}
                  placeholder="e.g. 5kVA inverter, 2 freezers, lighting, 8 solar panels"
                  className="w-full h-10 px-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                />
              </div>

              <div>
                <label className="block text-neutral-600 mb-1">Quote Details *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the solar installation or electrical materials you need priced..."
                  className="w-full p-3 rounded border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                />
              </div>

              {error && <p className="text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-[4px] bg-[#4CB04F] text-white font-semibold border border-transparent btn-hover-white"
              >
                {submitting ? 'Submitting Quote...' : 'Submit Quote Request'}
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-4 space-y-4 text-xs">
          <div className="bg-[#EDF7EE] rounded-[8px] p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#151916]">Direct WhatsApp Desk</h3>
            <p className="text-neutral-700 leading-relaxed">
              Need instant pricing, stock availability, or site inspection scheduling? Message us
              directly on WhatsApp.
            </p>
            <a
              href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
                `Hello ${data.settings.storeName}, I would like to request a quote for solar/electrical equipment.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="w-full h-10 rounded-[4px] bg-[#4CB04F] text-white font-semibold border border-transparent flex items-center justify-center gap-2 btn-hover-white"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>

          <div className="bg-[#F7F7F7] rounded-[8px] p-5 space-y-2 text-neutral-700">
            <p className="font-bold text-[#151916]">Visit Our Showroom</p>
            <p>{data.settings.landmark}</p>
            <p>{data.settings.businessHours}</p>
            <p className="font-semibold text-[#151916] pt-1">{data.settings.whatsappNumber}</p>
          </div>
        </div>
      </div>
    </section>
  );
};
