import React, { useMemo, useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Building2,
  Truck,
  CheckCircle2,
  ShieldCheck,
  Printer,
  Search,
  Package,
  ArrowRight,
  Tag,
  UploadCloud,
  Copy,
  Check,
  FileDown,
  MessageCircle,
  MapPin,
  Clock,
  ShoppingBag,
} from 'lucide-react';
import {
  TRACKING_STAGES,
  type Coupon,
  type Order,
  type PaymentGatewayConfig,
  type PaymentGatewayId,
  type Product,
  type StoreSettings,
} from '../types';
import { NIGERIA_LOCATIONS } from '../data/nigeriaLocations';
import { downloadOrderInvoicePdf, formatNaira } from '../utils/invoicePdf';
import { parseJsonResponseSafe, prepareMediaForUpload } from '../utils/mediaUpload';

export interface CartItem {
  product: Product;
  quantity: number;
}

const getUnitPrice = (p: Product): number =>
  p.isFlashSale && p.flashSalePrice && p.flashSalePrice > 0 ? p.flashSalePrice : p.price;

interface ProductModalProps {
  product: Product | null;
  currency: string;
  onClose: () => void;
  onAddToCart: (product: Product, qty: number, openCart?: boolean) => void;
}

export const ProductDetailModal: React.FC<ProductModalProps> = ({
  product,
  currency,
  onClose,
  onAddToCart,
}) => {
  const [qty, setQty] = useState(1);

  React.useEffect(() => {
    setQty(1);
  }, [product?.id]);

  if (!product) return null;

  const effectivePrice = getUnitPrice(product);
  const strikePrice =
    product.isFlashSale && product.flashSalePrice ? product.price : product.compareAtPrice;
  const discountPct =
    strikePrice > effectivePrice
      ? Math.round(((strikePrice - effectivePrice) / strikePrice) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 sm:p-6 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div
        className="relative w-full max-w-[400px] sm:max-w-lg md:max-w-2xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[84vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Standard Pinned Top Header with Prominent Exit Icon */}
        <div className="px-4 sm:px-5 py-3 border-b border-neutral-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-500 min-w-0 truncate">
            <span className="font-semibold text-[#4CB04F] truncate">{product.category}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular shrink-0">{product.sku}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-700 hover:text-neutral-950 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-5 bg-[#F7F7F7] flex items-center justify-center p-5 sm:p-6 h-44 sm:h-52 md:h-auto md:min-h-[260px] relative">
            <img
              src={product.image}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="w-full h-full max-h-[150px] sm:max-h-[190px] md:max-h-[240px] object-contain"
            />
            {discountPct > 0 && (
              <span className="absolute top-3 left-3 text-[11px] font-bold text-[#E04F44]">
                Save {discountPct}%
              </span>
            )}
          </div>

          <div className="md:col-span-7 p-4 sm:p-6 flex flex-col justify-between gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-[#151916] leading-snug mb-1.5">
                {product.name}
              </h3>

              <div className="flex items-baseline gap-2.5 mb-3">
                <span className="text-xl sm:text-2xl font-bold text-[#151916] tabular-nums">
                  {formatNaira(effectivePrice, currency)}
                </span>
                {strikePrice > effectivePrice && (
                  <span className="text-sm text-neutral-400 line-through tabular-nums">
                    {formatNaira(strikePrice, currency)}
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed mb-3">
                {product.description}
              </p>

              {product.specifications && (
                <p className="text-[11px] sm:text-xs text-neutral-600 bg-[#F7F7F7] rounded-lg p-2.5 mb-3">
                  <strong className="text-neutral-800">Specs:</strong> {product.specifications}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5 border-t border-b border-neutral-100 py-3 text-[11px] sm:text-xs">
                <div>
                  <div className="text-neutral-400">Rated Output</div>
                  <div className="font-semibold text-neutral-800 truncate">{product.wattage}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Warranty</div>
                  <div className="font-semibold text-neutral-800 truncate">{product.warranty}</div>
                </div>
                <div>
                  <div className="text-neutral-400">Availability</div>
                  <div
                    className={`font-semibold ${
                      product.stock > 0 ? 'text-[#4CB04F]' : 'text-red-600'
                    }`}
                  >
                    {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-400">Dispatch</div>
                  <div className="font-semibold text-neutral-800 truncate">36 States &amp; FCT</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
              <div className="inline-flex items-center border border-neutral-200 rounded-md h-10 shrink-0">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-2.5 h-full text-neutral-600 hover:bg-neutral-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-2.5 text-xs sm:text-sm font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(Math.max(1, product.stock), q + 1))}
                  className="px-2.5 h-full text-neutral-600 hover:bg-neutral-50"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={() => {
                  onAddToCart(product, qty, false);
                  onClose();
                }}
                className="flex-1 h-10 px-3 rounded-md bg-[#4CB04F] disabled:bg-neutral-300 text-white text-xs font-semibold border border-transparent whitespace-nowrap btn-hover-white"
              >
                Add to Cart
              </button>

              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={() => {
                  onAddToCart(product, qty, true);
                  onClose();
                }}
                className="flex-1 h-10 px-3 rounded-md bg-[#151916] disabled:bg-neutral-300 text-white text-xs font-semibold border border-transparent whitespace-nowrap inline-flex items-center justify-center gap-1.5 btn-hover-white"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Buy Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  settings: StoreSettings;
  onClose: () => void;
  onUpdateQty: (productId: string, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: (appliedCoupon: string | null, discountAmount: number) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  items,
  settings,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onCheckout,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Pick<
    Coupon,
    'code' | 'type' | 'value' | 'minOrderAmount'
  > | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  if (!open) return null;

  const currency = settings.currencySymbol || '₦';
  const subtotal = items.reduce(
    (sum, item) => sum + getUnitPrice(item.product) * item.quantity,
    0
  );

  let discountAmount = 0;
  if (appliedCoupon && subtotal >= appliedCoupon.minOrderAmount) {
    discountAmount =
      appliedCoupon.type === 'percent'
        ? Number(((subtotal * appliedCoupon.value) / 100).toFixed(2))
        : Number(Math.min(subtotal, appliedCoupon.value).toFixed(2));
  }

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const shippingFee =
    items.length === 0
      ? 0
      : settings.freeShippingThreshold > 0 && discountedSubtotal >= settings.freeShippingThreshold
      ? 0
      : settings.flatShippingFee;
  const estimatedTax = Number(((discountedSubtotal * settings.taxRatePercent) / 100).toFixed(2));
  const estimatedTotal = Number((discountedSubtotal + shippingFee + estimatedTax).toFixed(2));

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setValidating(true);
    setCouponError(null);
    setCouponMsg(null);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || 'Invalid coupon.');
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon(data);
        setCouponMsg(
          data.type === 'percent'
            ? `${data.code} applied (${data.value}% off)`
            : `${data.code} applied (${formatNaira(data.value, currency)} off)`
        );
      }
    } catch {
      setCouponError('Unable to validate coupon right now.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#151916]">Your Solar &amp; Electrical Cart</h3>
            <p className="text-xs text-neutral-500">
              {items.reduce((s, i) => s + i.quantity, 0)} item(s) selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {items.length > 0 && (
          <div className="px-6 py-2.5 bg-[#EDF7EE] text-xs text-[#235D25] font-medium">
            Nationwide waybill &amp; park delivery across all 36 Nigerian States &amp; FCT · Fee:{' '}
            {shippingFee === 0 ? 'Free' : formatNaira(shippingFee, currency)}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-neutral-100">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-[#EDF7EE] text-[#4CB04F] flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-neutral-800 mb-1">Your cart is empty</p>
              <p className="text-xs text-neutral-500">
                Explore our solar panels, inverters, batteries, and electrical materials.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const unitPrice = getUnitPrice(item.product);
              return (
                <div key={item.product.id} className="py-4 flex gap-4">
                  <div className="w-20 h-20 rounded-lg bg-[#F7F7F7] flex items-center justify-center p-2 shrink-0">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[#151916] truncate">
                        {item.product.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.product.id)}
                        aria-label={`Remove ${item.product.name}`}
                        className="text-neutral-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500 mb-2">{item.product.wattage}</p>
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center border border-neutral-200 rounded h-8">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.product.id, item.quantity - 1)}
                          className="px-2 h-full text-neutral-600 hover:bg-neutral-50"
                          aria-label="Decrease"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateQty(
                              item.product.id,
                              Math.min(item.product.stock, item.quantity + 1)
                            )
                          }
                          className="px-2 h-full text-neutral-600 hover:bg-neutral-50"
                          aria-label="Increase"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-[#151916] tabular-nums">
                        {formatNaira(unitPrice * item.quantity, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 border-t border-neutral-200 bg-neutral-50/70 space-y-4">
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Promo code (e.g. SOLAR10)"
                  className="w-full h-9 pl-8 pr-3 rounded-md border border-neutral-200 bg-white text-xs focus:outline-none focus:border-[#4CB04F]"
                />
              </div>
              <button
                type="submit"
                disabled={validating}
                className="px-3.5 h-9 rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 text-xs font-semibold text-neutral-800 whitespace-nowrap"
              >
                {validating ? 'Checking...' : 'Apply'}
              </button>
            </form>
            {couponError && <p className="text-xs text-red-600">{couponError}</p>}
            {couponMsg && <p className="text-xs text-[#4CB04F] font-medium">{couponMsg}</p>}

            <div className="space-y-1.5 text-xs text-neutral-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-neutral-900 tabular-nums">
                  {formatNaira(subtotal, currency)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[#4CB04F] font-medium">
                  <span>Discount ({appliedCoupon?.code})</span>
                  <span className="tabular-nums">-{formatNaira(discountAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span className="font-medium text-neutral-900 tabular-nums">
                  {shippingFee === 0 ? 'Free' : formatNaira(shippingFee, currency)}
                </span>
              </div>
              {settings.taxRatePercent > 0 && (
                <div className="flex justify-between">
                  <span>VAT ({settings.taxRatePercent}%)</span>
                  <span className="font-medium text-neutral-900 tabular-nums">
                    {formatNaira(estimatedTax, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-neutral-200 text-sm font-bold text-[#151916]">
                <span>Total</span>
                <span className="tabular-nums">{formatNaira(estimatedTotal, currency)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onCheckout(appliedCoupon?.code ?? null, discountAmount)}
              className="w-full h-11 rounded-md bg-[#4CB04F] text-white text-sm font-semibold border border-transparent flex items-center justify-center gap-2 btn-hover-white"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface CheckoutModalProps {
  open: boolean;
  items: CartItem[];
  couponCode: string | null;
  discountAmount: number;
  settings: StoreSettings;
  gateways: PaymentGatewayConfig[];
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
  onOpenTrackingWithCode?: (trackingNumber: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  items,
  couponCode,
  discountAmount,
  settings,
  gateways,
  onClose,
  onOrderSuccess,
  onOpenTrackingWithCode,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedState, setSelectedState] = useState('Kogi');
  const [selectedLga, setSelectedLga] = useState('Ankpa');
  const [selectedPark, setSelectedPark] = useState(
    'Ankpa Balewa Road / Store Pickup (Opposite AP Station)'
  );
  const [customPark, setCustomPark] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const enabledGateways = gateways.filter((g) => g.enabled);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayId>(() => {
    const bankFirst = enabledGateways.find((g) => g.id === 'bank_transfer');
    return bankFirst?.id || enabledGateways[0]?.id || 'bank_transfer';
  });
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [paystackEmail, setPaystackEmail] = useState('');

  // Receipt drag & drop upload
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [receiptDragOver, setReceiptDragOver] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [copiedAcct1, setCopiedAcct1] = useState(false);
  const [copiedAcct2, setCopiedAcct2] = useState(false);
  const [selectedBankSlot, setSelectedBankSlot] = useState<'primary' | 'secondary'>('primary');
  const [copiedTracking, setCopiedTracking] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const stateEntry = useMemo(
    () => NIGERIA_LOCATIONS.find((s) => s.state === selectedState) || NIGERIA_LOCATIONS[0],
    [selectedState]
  );

  const handleStateChange = (nextState: string) => {
    setSelectedState(nextState);
    const found = NIGERIA_LOCATIONS.find((s) => s.state === nextState);
    if (found) {
      setSelectedLga(found.lgas[0] || '');
      setSelectedPark(found.parks[0] || 'Doorstep Delivery');
    }
  };

  if (!open) return null;

  const currency = settings.currencySymbol || '₦';
  const subtotal = items.reduce((s, i) => s + getUnitPrice(i.product) * i.quantity, 0);
  const discounted = Math.max(0, subtotal - discountAmount);
  const shippingFee =
    settings.freeShippingThreshold > 0 && discounted >= settings.freeShippingThreshold
      ? 0
      : settings.flatShippingFee;
  const taxAmount = Number(((discounted * settings.taxRatePercent) / 100).toFixed(2));
  const totalAmount = Number((discounted + shippingFee + taxAmount).toFixed(2));

  const resolvedPark =
    selectedPark === 'Other Motor Park (Specify)' && customPark.trim()
      ? customPark.trim()
      : selectedPark;

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handleReceiptFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingReceipt(true);
    setError(null);
    try {
      const prepared = await prepareMediaForUpload(file);
      const res = await fetch('/api/orders/upload-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: prepared.filename,
          mimeType: prepared.mimeType,
          dataBase64: prepared.dataBase64,
        }),
      });
      const json = await parseJsonResponseSafe<{ url?: string; error?: string }>(res);
      if (!res.ok || !json.url) {
        setError(json.error || 'Could not upload receipt.');
      } else {
        setReceiptUrl(json.url);
        setReceiptName(file.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error uploading payment receipt.');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const buildProFormaInvoiceOrder = (): Order => ({
    id: 'preview',
    orderNumber: 'PRO-FORMA',
    trackingNumber: 'Pending Confirmation',
    customer: {
      fullName: fullName || 'Customer',
      email: email || 'buyer@emmystylezsolar.com',
      phone: phone || settings.whatsappNumber,
      state: selectedState,
      lga: selectedLga,
      park: resolvedPark,
      address: address || `${selectedLga}, ${selectedState}`,
      city: selectedLga,
      postalCode: 'NG',
      country: 'Nigeria',
    },
    items: items.map((i) => ({
      productId: i.product.id,
      sku: i.product.sku,
      name: i.product.name,
      image: i.product.image,
      unitPrice: getUnitPrice(i.product),
      quantity: i.quantity,
      lineTotal: Number((getUnitPrice(i.product) * i.quantity).toFixed(2)),
    })),
    subtotal,
    discountAmount,
    couponCode,
    shippingFee,
    taxAmount,
    totalAmount,
    paymentMethod: selectedGateway,
    paymentMethodName:
      enabledGateways.find((g) => g.id === selectedGateway)?.name || 'Bank Transfer',
    paymentStatus: 'Pending Verification',
    orderStatus: 'Pending',
    trackingStage: 'Payment Pending Verification',
    trackingHistory: [],
    receiptUrl,
    transactionId: 'Awaiting Confirmation',
    notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            fullName,
            email: email.trim() || `${phone.replace(/\D/g, '') || 'buyer'}@emmystylez.ng`,
            phone,
            state: selectedState,
            lga: selectedLga,
            park: resolvedPark,
            address,
            city: selectedLga,
            postalCode: 'NG',
            country: 'Nigeria',
          },
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          paymentMethod: selectedGateway,
          couponCode,
          notes:
            selectedGateway === 'bank_transfer'
              ? `${
                  notes.trim() ? `${notes.trim()} | ` : ''
                }Paid into ${
                  selectedBankSlot === 'secondary' &&
                  settings.secondaryBankDetails?.accountNumber
                    ? `${settings.secondaryBankDetails.bankName} (${settings.secondaryBankDetails.accountNumber})`
                    : `${settings.bankDetails.bankName} (${settings.bankDetails.accountNumber})`
                }`
              : notes,
          receiptUrl,
          paymentDetails: {
            cardNumber,
            expiry,
            cvc,
            paypalEmail: paypalEmail || email,
            paystackEmail: paystackEmail || email,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not process checkout. Please review your details.');
      } else {
        setCompletedOrder(data.order);
        onOrderSuccess(data.order);
      }
    } catch {
      setError('Network error while submitting order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseAll = () => {
    setCompletedOrder(null);
    setError(null);
    setReceiptUrl(null);
    setReceiptName(null);
    onClose();
  };

  const whatsappDigits = settings.whatsappNumber.replace(/\D/g, '');
  const buildWhatsappConfirmHref = (ord: Order) => {
    const productNames = ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    const loc = `${ord.customer.state} State, ${ord.customer.lga} LGA (${ord.customer.park})`;
    const text = `Hello ${settings.storeName}, I have made a payment of ${formatNaira(
      ord.totalAmount,
      currency
    )} for ${productNames}. Delivery Location: ${loc}. Customer: ${ord.customer.fullName} (${
      ord.customer.phone
    }). Tracking Code: ${ord.trackingNumber}.`;
    return `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto"
      onClick={handleCloseAll}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#4CB04F]" />
            <h3 className="text-lg font-bold text-[#151916]">
              {completedOrder
                ? 'Payment Sent · Tracking Number Generated'
                : 'Nigeria Delivery & Payment Checkout'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCloseAll}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
            aria-label="Close checkout"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {completedOrder ? (
          <div className="p-6 md:p-8 overflow-y-auto space-y-6">
            {/* Prominent Auto-Generated Emmy1001 Tracking Code Box */}
            <div className="bg-[#EDF7EE] border border-[#4CB04F]/40 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#4CB04F] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#235D25]">
                      Your Tracking Code Is Ready
                    </p>
                    <h4 className="text-2xl font-extrabold text-[#151916] font-mono-tabular mt-0.5">
                      {completedOrder.trackingNumber}
                    </h4>
                    <p className="text-xs text-neutral-600 mt-1">
                      Copy this tracking code anytime and paste it into{' '}
                      <strong>Track Order</strong> to view live dispatch &amp; park updates from our
                      Admin team.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(completedOrder.trackingNumber);
                      setCopiedTracking(true);
                      setTimeout(() => setCopiedTracking(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#4CB04F] text-white text-xs font-semibold border border-transparent btn-hover-white"
                  >
                    {copiedTracking ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTracking ? 'Copied!' : 'Copy Tracking Code'}</span>
                  </button>

                  {onOpenTrackingWithCode && (
                    <button
                      type="button"
                      onClick={() => {
                        const code = completedOrder.trackingNumber;
                        handleCloseAll();
                        onOpenTrackingWithCode(code);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#151916] text-white text-xs font-semibold border border-transparent btn-hover-white"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Track Now</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* PDF Download, Print & WhatsApp Confirmation Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => downloadOrderInvoicePdf(completedOrder, settings)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#151916] text-white text-xs font-semibold border border-transparent btn-hover-white"
              >
                <FileDown className="w-4 h-4" />
                <span>Download Invoice Receipt (PDF)</span>
              </button>

              <a
                href={buildWhatsappConfirmHref(completedOrder)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#4CB04F] text-white text-xs font-semibold border border-transparent btn-hover-white"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Send Payment Message on WhatsApp ({settings.whatsappNumber})</span>
              </a>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-md bg-white border border-neutral-200 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="border border-neutral-200 rounded-lg p-4 space-y-1 text-xs">
                <p className="font-semibold text-neutral-400 mb-1">Nigerian Delivery Destination</p>
                <p className="font-bold text-sm text-neutral-900">{completedOrder.customer.fullName}</p>
                <p className="text-neutral-700">
                  <strong>State:</strong> {completedOrder.customer.state} · <strong>LGA:</strong>{' '}
                  {completedOrder.customer.lga}
                </p>
                <p className="text-neutral-700">
                  <strong>Park / Hub:</strong> {completedOrder.customer.park}
                </p>
                <p className="text-neutral-600">{completedOrder.customer.address}</p>
                <p className="text-neutral-500 pt-1">
                  WhatsApp: {completedOrder.customer.phone} · {completedOrder.customer.email}
                </p>
              </div>
              <div className="border border-neutral-200 rounded-lg p-4 space-y-1.5 text-xs">
                <p className="font-semibold text-neutral-400">Payment &amp; Receipt Summary</p>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Status</span>
                  <span className="font-semibold text-[#235D25]">
                    {completedOrder.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Subtotal</span>
                  <span className="tabular-nums">
                    {formatNaira(completedOrder.subtotal, currency)}
                  </span>
                </div>
                {completedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-[#4CB04F]">
                    <span>Discount ({completedOrder.couponCode})</span>
                    <span className="tabular-nums">
                      -{formatNaira(completedOrder.discountAmount, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-600">Delivery Fee</span>
                  <span className="tabular-nums">
                    {formatNaira(completedOrder.shippingFee, currency)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-neutral-100 text-sm font-bold text-[#151916]">
                  <span>Total Paid</span>
                  <span className="tabular-nums">
                    {formatNaira(completedOrder.totalAmount, currency)}
                  </span>
                </div>
                {completedOrder.receiptUrl && (
                  <p className="text-[11px] text-[#4CB04F] font-semibold pt-1">
                    ✓ Transfer receipt attached and sent to Admin Panel.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCloseAll}
                className="px-6 py-2.5 rounded-md bg-[#4CB04F] text-white text-sm font-semibold border border-transparent btn-hover-white"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmitOrder}
            className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12"
          >
            <div className="lg:col-span-7 p-6 space-y-6 border-b lg:border-b-0 lg:border-r border-neutral-200">
              {/* Step 1: Location & Buyer Details */}
              <div>
                <h4 className="text-sm font-bold text-[#151916] mb-3">
                  1. Buyer Details &amp; Nigerian State / LGA / Park Location
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-neutral-600 mb-1">Full Name *</label>
                    <input
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Musa Abdullahi"
                      className="w-full h-9 px-3 rounded-md border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-600 mb-1">WhatsApp Number *</label>
                    <input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 803 000 0000"
                      className="w-full h-9 px-3 rounded-md border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-neutral-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@domain.com (for invoice copy)"
                      className="w-full h-9 px-3 rounded-md border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-600 mb-1">Nigerian State *</label>
                    <select
                      required
                      value={selectedState}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-md border border-neutral-300 bg-white focus:outline-none focus:border-[#4CB04F]"
                    >
                      {NIGERIA_LOCATIONS.map((loc) => (
                        <option key={loc.state} value={loc.state}>
                          {loc.state}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-600 mb-1">
                      Local Government Area (LGA) *
                    </label>
                    <select
                      required
                      value={selectedLga}
                      onChange={(e) => setSelectedLga(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-md border border-neutral-300 bg-white focus:outline-none focus:border-[#4CB04F]"
                    >
                      {stateEntry.lgas.map((lga) => (
                        <option key={lga} value={lga}>
                          {lga}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-neutral-600 mb-1">
                      Transport Park / Delivery Hub in {selectedState} *
                    </label>
                    <select
                      required
                      value={selectedPark}
                      onChange={(e) => setSelectedPark(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-md border border-neutral-300 bg-white focus:outline-none focus:border-[#4CB04F]"
                    >
                      {stateEntry.parks.map((park) => (
                        <option key={park} value={park}>
                          {park}
                        </option>
                      ))}
                      <option value="Doorstep Home / Office Delivery">
                        Doorstep Home / Office Delivery
                      </option>
                      <option value="Other Motor Park (Specify)">
                        Other Motor Park (Specify below)
                      </option>
                    </select>
                  </div>

                  {selectedPark === 'Other Motor Park (Specify)' && (
                    <div className="sm:col-span-2">
                      <label className="block text-neutral-600 mb-1">
                        Specify Transport Park Name *
                      </label>
                      <input
                        required
                        type="text"
                        value={customPark}
                        onChange={(e) => setCustomPark(e.target.value)}
                        placeholder="Enter preferred park or waybill terminal name"
                        className="w-full h-9 px-3 rounded-md border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-neutral-600 mb-1">
                      Street Address / Landmark *
                    </label>
                    <input
                      required
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="House/Shop number, street name, or landmark"
                      className="w-full h-9 px-3 rounded-md border border-neutral-300 focus:outline-none focus:border-[#4CB04F]"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Payment Method & Transfer Receipt Drag-and-Drop */}
              <div>
                <h4 className="text-sm font-bold text-[#151916] mb-3">
                  2. Payment Method &amp; Upload Receipt
                </h4>
                {enabledGateways.length === 0 ? (
                  <p className="text-xs text-red-600">
                    No payment gateways are currently enabled in Admin Settings.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {enabledGateways.map((gw) => {
                      const active = selectedGateway === gw.id;
                      return (
                        <div
                          key={gw.id}
                          className={`rounded-lg border transition-colors ${
                            active
                              ? 'border-[#4CB04F] bg-[#F5FBF5]'
                              : 'border-neutral-200 bg-white hover:border-neutral-300'
                          }`}
                        >
                          <label className="flex items-start gap-3 p-3.5 cursor-pointer">
                            <input
                              type="radio"
                              name="paymentGateway"
                              checked={active}
                              onChange={() => setSelectedGateway(gw.id)}
                              className="mt-0.5 accent-[#4CB04F]"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-[#151916] flex items-center gap-1.5">
                                  {gw.id === 'stripe_card' && <CreditCard className="w-3.5 h-3.5" />}
                                  {gw.id === 'bank_transfer' && <Building2 className="w-3.5 h-3.5" />}
                                  {gw.id === 'cod' && <Truck className="w-3.5 h-3.5" />}
                                  {gw.name}
                                </span>
                                <span className="text-[11px] text-neutral-500">{gw.mode}</span>
                              </div>
                              <p className="text-[11px] text-neutral-500 mt-0.5">
                                {gw.description}
                              </p>
                            </div>
                          </label>

                          {active && gw.id === 'bank_transfer' && (
                            <div className="px-4 pb-4 space-y-3">
                              {/* Two Normal Bank Accounts */}
                              <div className="p-3.5 rounded-lg bg-white border border-[#4CB04F]/40 text-xs space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-[#151916]">
                                    Transfer Total: {formatNaira(totalAmount, currency)}
                                  </span>
                                  <span className="text-[11px] font-semibold text-[#235D25]">
                                    Select either bank account below
                                  </span>
                                </div>

                                <div
                                  className={`grid grid-cols-1 ${
                                    settings.secondaryBankDetails?.enabled !== false &&
                                    settings.secondaryBankDetails?.accountNumber?.trim()
                                      ? 'sm:grid-cols-2'
                                      : ''
                                  } gap-2.5`}
                                >
                                  {/* Bank Account 1 */}
                                  <div
                                    onClick={() => setSelectedBankSlot('primary')}
                                    className={`rounded-lg border p-3 cursor-pointer transition-colors space-y-1 ${
                                      selectedBankSlot === 'primary'
                                        ? 'border-[#4CB04F] bg-[#EDF7EE]/55'
                                        : 'border-neutral-200 bg-neutral-50/70 hover:border-neutral-300'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#235D25]">
                                        Account 1
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard?.writeText(
                                            settings.bankDetails.accountNumber
                                          );
                                          setCopiedAcct1(true);
                                          setTimeout(() => setCopiedAcct1(false), 1800);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#4CB04F]/40 text-[#235D25] font-semibold text-[10px]"
                                      >
                                        {copiedAcct1 ? (
                                          <Check className="w-3 h-3" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                        <span>{copiedAcct1 ? 'Copied' : 'Copy #'}</span>
                                      </button>
                                    </div>
                                    <p className="text-neutral-700 font-semibold">
                                      {settings.bankDetails.bankName}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 truncate">
                                      {settings.bankDetails.accountName}
                                    </p>
                                    <p className="text-base font-extrabold text-[#151916] font-mono-tabular pt-0.5">
                                      {settings.bankDetails.accountNumber}
                                    </p>
                                  </div>

                                  {/* Bank Account 2 */}
                                  {settings.secondaryBankDetails?.enabled !== false &&
                                    settings.secondaryBankDetails?.accountNumber?.trim() && (
                                      <div
                                        onClick={() => setSelectedBankSlot('secondary')}
                                        className={`rounded-lg border p-3 cursor-pointer transition-colors space-y-1 ${
                                          selectedBankSlot === 'secondary'
                                            ? 'border-[#4CB04F] bg-[#EDF7EE]/55'
                                            : 'border-neutral-200 bg-neutral-50/70 hover:border-neutral-300'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#235D25]">
                                            Account 2
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigator.clipboard?.writeText(
                                                settings.secondaryBankDetails?.accountNumber || ''
                                              );
                                              setCopiedAcct2(true);
                                              setTimeout(() => setCopiedAcct2(false), 1800);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#4CB04F]/40 text-[#235D25] font-semibold text-[10px]"
                                          >
                                            {copiedAcct2 ? (
                                              <Check className="w-3 h-3" />
                                            ) : (
                                              <Copy className="w-3 h-3" />
                                            )}
                                            <span>{copiedAcct2 ? 'Copied' : 'Copy #'}</span>
                                          </button>
                                        </div>
                                        <p className="text-neutral-700 font-semibold">
                                          {settings.secondaryBankDetails.bankName}
                                        </p>
                                        <p className="text-[11px] text-neutral-600 truncate">
                                          {settings.secondaryBankDetails.accountName}
                                        </p>
                                        <p className="text-base font-extrabold text-[#151916] font-mono-tabular pt-0.5">
                                          {settings.secondaryBankDetails.accountNumber}
                                        </p>
                                      </div>
                                    )}
                                </div>
                              </div>

                              {/* Drag and Drop Receipt Upload */}
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setReceiptDragOver(true);
                                }}
                                onDragLeave={() => setReceiptDragOver(false)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setReceiptDragOver(false);
                                  handleReceiptFiles(e.dataTransfer.files);
                                }}
                                className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors text-xs ${
                                  receiptDragOver
                                    ? 'border-[#4CB04F] bg-[#EDF7EE]'
                                    : receiptUrl
                                    ? 'border-[#4CB04F] bg-white'
                                    : 'border-neutral-300 bg-white'
                                }`}
                              >
                                <UploadCloud className="w-6 h-6 text-[#4CB04F] mx-auto mb-1.5" />
                                {uploadingReceipt ? (
                                  <p className="font-semibold text-neutral-700">
                                    Uploading payment receipt...
                                  </p>
                                ) : receiptUrl ? (
                                  <div className="space-y-1">
                                    <p className="font-bold text-[#235D25]">
                                      ✓ Receipt Uploaded: {receiptName}
                                    </p>
                                    <p className="text-[11px] text-neutral-500">
                                      Drop another file to replace, or click &ldquo;I Have Sent&rdquo; below.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <p className="font-semibold text-neutral-800">
                                      Drag &amp; Drop Payment Receipt Here *
                                    </p>
                                    <p className="text-[11px] text-neutral-500">
                                      Supports JPG, PNG, WEBP screenshot or bank PDF receipt
                                    </p>
                                  </div>
                                )}
                                <label className="mt-2 inline-block px-3 py-1.5 rounded bg-[#151916] text-white font-semibold cursor-pointer text-[11px]">
                                  <span>{receiptUrl ? 'Change Receipt File' : 'Browse Receipt File'}</span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                      handleReceiptFiles(e.target.files);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>

                              {/* Download Pro-forma Invoice PDF before confirming */}
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadOrderInvoicePdf(buildProFormaInvoiceOrder(), settings)
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-neutral-300 bg-white text-neutral-800 text-[11px] font-semibold btn-hover-white"
                                >
                                  <FileDown className="w-3.5 h-3.5 text-[#4CB04F]" />
                                  <span>Download Invoice Receipt (PDF)</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {active && gw.id === 'stripe_card' && (
                            <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-2.5 text-xs">
                              <div className="col-span-2">
                                <label className="block text-neutral-600 mb-1">Card Number *</label>
                                <input
                                  required
                                  inputMode="numeric"
                                  value={cardNumber}
                                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                  placeholder="4242 4242 4242 4242"
                                  className="w-full h-9 px-3 rounded border border-neutral-300 bg-white font-mono-tabular focus:outline-none focus:border-[#4CB04F]"
                                />
                              </div>
                              <div>
                                <label className="block text-neutral-600 mb-1">Expiry (MM/YY) *</label>
                                <input
                                  required
                                  value={expiry}
                                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                                  placeholder="09/28"
                                  className="w-full h-9 px-3 rounded border border-neutral-300 bg-white font-mono-tabular focus:outline-none focus:border-[#4CB04F]"
                                />
                              </div>
                              <div>
                                <label className="block text-neutral-600 mb-1">CVC *</label>
                                <input
                                  required
                                  inputMode="numeric"
                                  maxLength={4}
                                  value={cvc}
                                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))}
                                  placeholder="424"
                                  className="w-full h-9 px-3 rounded border border-neutral-300 bg-white font-mono-tabular focus:outline-none focus:border-[#4CB04F]"
                                />
                              </div>
                            </div>
                          )}

                          {active && gw.id === 'paypal' && (
                            <div className="px-4 pb-4 pt-1 text-xs">
                              <label className="block text-neutral-600 mb-1">
                                PayPal Account Email *
                              </label>
                              <input
                                type="email"
                                required
                                value={paypalEmail || email}
                                onChange={(e) => setPaypalEmail(e.target.value)}
                                placeholder="buyer@paypal.com"
                                className="w-full h-9 px-3 rounded border border-neutral-300 bg-white focus:outline-none focus:border-[#4CB04F]"
                              />
                            </div>
                          )}

                          {active && gw.id === 'paystack' && (
                            <div className="px-4 pb-4 pt-1 text-xs">
                              <label className="block text-neutral-600 mb-1">
                                Paystack Receipt Email *
                              </label>
                              <input
                                type="email"
                                required
                                value={paystackEmail || email}
                                onChange={(e) => setPaystackEmail(e.target.value)}
                                placeholder="customer@domain.com"
                                className="w-full h-9 px-3 rounded border border-neutral-300 bg-white focus:outline-none focus:border-[#4CB04F]"
                              />
                            </div>
                          )}

                          {active && gw.id === 'cod' && (
                            <div className="mx-4 mb-4 p-3 rounded bg-white border border-neutral-200 text-[11px] text-neutral-600">
                              {gw.instructions}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-neutral-600 mb-1">
                  Delivery Instructions (Optional)
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferred waybill park time, receiver phone, etc."
                  className="w-full h-9 px-3 rounded-md border border-neutral-300 text-xs focus:outline-none focus:border-[#4CB04F]"
                />
              </div>
            </div>

            <div className="lg:col-span-5 p-6 bg-neutral-50 flex flex-col justify-between space-y-5">
              <div>
                <h4 className="text-sm font-bold text-[#151916] mb-3">Order Summary</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {items.map((item) => {
                    const unit = getUnitPrice(item.product);
                    return (
                      <div key={item.product.id} className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-white border border-neutral-200 p-1 shrink-0">
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-neutral-900 truncate">
                            {item.product.name}
                          </p>
                          <p className="text-[11px] text-neutral-500">Qty {item.quantity}</p>
                        </div>
                        <span className="text-xs font-semibold tabular-nums">
                          {formatNaira(unit * item.quantity, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 pt-4 border-t border-neutral-200 space-y-2 text-xs text-neutral-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-medium">
                      {formatNaira(subtotal, currency)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[#4CB04F] font-medium">
                      <span>Promo ({couponCode})</span>
                      <span className="tabular-nums">-{formatNaira(discountAmount, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery Fee ({selectedState})</span>
                    <span className="tabular-nums font-medium">
                      {shippingFee === 0 ? 'Free' : formatNaira(shippingFee, currency)}
                    </span>
                  </div>
                  {settings.taxRatePercent > 0 && (
                    <div className="flex justify-between">
                      <span>VAT ({settings.taxRatePercent}%)</span>
                      <span className="tabular-nums font-medium">
                        {formatNaira(taxAmount, currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-neutral-200 text-base font-bold text-[#151916]">
                    <span>Total Due</span>
                    <span className="tabular-nums">{formatNaira(totalAmount, currency)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {error && (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || enabledGateways.length === 0}
                  className="w-full h-11 rounded-md bg-[#4CB04F] disabled:bg-neutral-400 text-white text-sm font-semibold border border-transparent transition-colors btn-hover-white"
                >
                  {submitting
                    ? 'Generating Tracking Code...'
                    : selectedGateway === 'bank_transfer'
                    ? 'I Have Sent'
                    : `Complete Order (${formatNaira(totalAmount, currency)})`}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

interface OrderLookupProps {
  open: boolean;
  initialTrackingCode?: string;
  settings: StoreSettings;
  onClose: () => void;
}

export const OrderLookupModal: React.FC<OrderLookupProps> = ({
  open,
  initialTrackingCode = '',
  settings,
  onClose,
}) => {
  const [trackingInput, setTrackingInput] = useState(initialTrackingCode);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (initialTrackingCode && open) {
      setTrackingInput(initialTrackingCode);
      void runLookup(initialTrackingCode);
    }
  }, [initialTrackingCode, open]);

  if (!open) return null;

  const currency = settings.currencySymbol || '₦';

  const runLookup = async (codeValue: string) => {
    const cleaned = codeValue.trim();
    if (!cleaned) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const params = new URLSearchParams({ trackingNumber: cleaned });
      const res = await fetch(`/api/orders/lookup?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Tracking code not found.');
      } else {
        setOrder(data.order);
      }
    } catch {
      setError('Unable to reach order tracking service.');
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    await runLookup(trackingInput);
  };

  const currentStageIndex = order
    ? Math.max(0, TRACKING_STAGES.indexOf(order.trackingStage))
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 space-y-5 my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#151916]">Track Your Order &amp; Waybill</h3>
            <p className="text-xs text-neutral-500">
              Paste your Tracking Code (e.g. <span className="font-mono-tabular">Emmy1001</span>) to
              view live Admin dispatch updates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2.5 text-xs">
          <input
            required
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
            placeholder="Enter Tracking Code (e.g. Emmy1001)"
            className="flex-1 h-10 px-3.5 rounded-md border border-neutral-300 font-mono-tabular focus:outline-none focus:border-[#4CB04F]"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-10 px-5 rounded-md bg-[#4CB04F] text-white font-semibold border border-transparent inline-flex items-center justify-center gap-2 btn-hover-white"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{loading ? 'Checking...' : 'Track Order'}</span>
          </button>
        </form>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {order && (
          <div className="space-y-5 text-xs">
            <div className="bg-[#EDF7EE] border border-[#4CB04F]/30 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-[#235D25] uppercase">
                  Tracking Code: <span className="font-mono-tabular">{order.trackingNumber}</span>
                </p>
                <p className="text-base font-extrabold text-[#151916] mt-0.5">
                  {order.trackingStage}
                </p>
                <p className="text-neutral-600 mt-0.5">
                  Payment: <strong>{order.paymentStatus}</strong> · Order Status:{' '}
                  <strong>{order.orderStatus}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadOrderInvoicePdf(order, settings)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#151916] text-white font-semibold border border-transparent btn-hover-white shrink-0"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download PDF Receipt</span>
              </button>
            </div>

            {/* Visual Stage Progress */}
            <div className="border border-neutral-200 rounded-lg p-4 space-y-3">
              <p className="font-bold text-[#151916]">Live Delivery Progress</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TRACKING_STAGES.map((stage, idx) => {
                  const done = idx <= currentStageIndex;
                  const current = idx === currentStageIndex;
                  return (
                    <div
                      key={stage}
                      className={`p-2.5 rounded border flex items-center gap-2 ${
                        current
                          ? 'bg-[#EDF7EE] border-[#4CB04F] text-[#235D25] font-bold'
                          : done
                          ? 'bg-neutral-50 border-neutral-200 text-neutral-800'
                          : 'bg-white border-neutral-100 text-neutral-400'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          done ? 'text-[#4CB04F]' : 'text-neutral-300'
                        }`}
                      />
                      <span>{stage}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Destination & Waybill Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-neutral-200 rounded-lg p-4 space-y-1">
                <p className="font-bold text-[#151916] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#4CB04F]" />
                  <span>Destination &amp; Park</span>
                </p>
                <p className="text-neutral-700 font-medium">{order.customer.fullName}</p>
                <p className="text-neutral-600">
                  {order.customer.state} State · {order.customer.lga} LGA
                </p>
                <p className="text-neutral-600">Park: {order.customer.park}</p>
                <p className="text-neutral-500">{order.customer.address}</p>
              </div>
              <div className="border border-neutral-200 rounded-lg p-4 space-y-1">
                <p className="font-bold text-[#151916] flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#4CB04F]" />
                  <span>Dispatch &amp; Waybill Status</span>
                </p>
                <p className="text-neutral-600">
                  <strong>Current Hub:</strong> {order.trackingLocation || 'Emmystylez Warehouse'}
                </p>
                <p className="text-neutral-600">
                  <strong>Waybill / Driver:</strong> {order.waybillInfo || 'Pending dispatch'}
                </p>
                <p className="text-neutral-600">
                  <strong>Est. Delivery:</strong> {order.estimatedDelivery || '1–3 Working Days'}
                </p>
                <p className="text-neutral-800 font-bold pt-1 tabular-nums">
                  Total: {formatNaira(order.totalAmount, currency)}
                </p>
              </div>
            </div>

            {/* Tracking Log Updates */}
            {order.trackingHistory && order.trackingHistory.length > 0 && (
              <div className="border border-neutral-200 rounded-lg p-4 space-y-2.5">
                <p className="font-bold text-[#151916] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#4CB04F]" />
                  <span>Tracking Updates Timeline</span>
                </p>
                <div className="divide-y divide-neutral-100">
                  {order.trackingHistory.map((ev) => (
                    <div key={ev.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#151916]">{ev.stage}</span>
                        <span className="text-[11px] text-neutral-400 tabular-nums">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-neutral-600">
                        {ev.location} — {ev.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border border-neutral-200 rounded-lg p-3.5 bg-neutral-50">
              <p className="font-semibold text-[#151916] mb-1">Products in Package</p>
              <p className="text-neutral-600">
                {order.items
                  .map((i) => `${i.quantity}× ${i.name} (${formatNaira(i.lineTotal, currency)})`)
                  .join(' · ')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
