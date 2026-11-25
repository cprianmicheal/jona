/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Storefront, type StorefrontPage } from './components/Storefront';
import {
  CartDrawer,
  CheckoutModal,
  OrderLookupModal,
  ProductDetailModal,
  type CartItem,
} from './components/StorefrontModals';
import { CustomerAuthModal, type CustomerSessionUser } from './components/AuthModals';
import { AdminDashboard } from './components/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StorePolicyModal } from './components/StorePolicyModal';
import type { Order, Product, StorefrontData } from './types';

const POLICY_STORAGE_KEY = 'emmystylez_policy_choice';

const readPolicyChoice = (): 'accepted' | 'declined' | null => {
  try {
    const val = window.sessionStorage.getItem(POLICY_STORAGE_KEY);
    if (val === 'accepted' || val === 'declined') return val;
    return null;
  } catch {
    return null;
  }
};

const writePolicyChoice = (choice: 'accepted' | 'declined') => {
  try {
    window.sessionStorage.setItem(POLICY_STORAGE_KEY, choice);
  } catch {
    // Ignore storage unavailability in restricted contexts
  }
};

function AppContent() {
  const [view, setView] = useState<'storefront' | 'admin'>(() =>
    window.location.hash === '#admin' || window.location.pathname === '/admin'
      ? 'admin'
      : 'storefront'
  );
  const [activePage, setActivePage] = useState<StorefrontPage>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [customerUser, setCustomerUser] = useState<CustomerSessionUser | null>(null);
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'login' | 'register' | 'forgot';
  }>({ open: false, mode: 'login' });

  const [storefrontData, setStorefrontData] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [policyChoice, setPolicyChoice] = useState<'accepted' | 'declined' | null>(() =>
    readPolicyChoice()
  );
  const [policyModalOpen, setPolicyModalOpen] = useState<boolean>(false);

  // Cart & Storefront Modals
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutState, setCheckoutState] = useState<{
    open: boolean;
    couponCode: string | null;
    discountAmount: number;
  }>({ open: false, couponCode: null, discountAmount: 0 });
  const [orderLookupOpen, setOrderLookupOpen] = useState(false);
  const [trackingCodePrefill, setTrackingCodePrefill] = useState('');
  const [cartNotice, setCartNotice] = useState<string | null>(null);

  const fetchStorefront = useCallback(async () => {
    const attemptFetch = async (): Promise<StorefrontData> => {
      const res = await fetch('/api/storefront', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        let errMessage = 'Unable to connect to Emmystylez Solar Electrical Store server.';
        if (contentType.includes('application/json')) {
          const errJson = await res.json().catch(() => null);
          if (errJson?.error) errMessage = errJson.error;
        }
        throw new Error(errMessage);
      }
      if (!contentType.includes('application/json')) {
        throw new Error('Server API returned non-JSON response. Please check API function routing.');
      }
      return (await res.json()) as StorefrontData;
    };

    try {
      setLoadError(null);
      let json: StorefrontData;
      try {
        json = await attemptFetch();
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 900));
        json = await attemptFetch();
      }
      setStorefrontData(json);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error && err.message
          ? err.message
          : 'Unable to connect to Emmystylez Solar Electrical Store server.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorefront();
  }, [fetchStorefront]);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
        setView('admin');
      } else {
        setView('storefront');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateToAdmin = () => {
    window.location.hash = '#admin';
    setView('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToStorefront = () => {
    if (window.location.hash === '#admin') {
      window.history.pushState(null, '', '/');
    }
    setView('storefront');
    fetchStorefront();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigatePage = (page: StorefrontPage, category = 'All') => {
    setActivePage(page);
    setSelectedCategory(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (product: Product, qty = 1, openCartAfter = false) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(product.stock, i.quantity + qty) }
            : i
        );
      }
      return [...prev, { product, quantity: Math.min(product.stock, qty) }];
    });

    if (openCartAfter) {
      setCartOpen(true);
    } else {
      setCartNotice(`Added "${product.name}" to your cart`);
      setTimeout(() => setCartNotice(null), 2600);
    }
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleOrderSuccess = (_order: Order) => {
    setCart([]);
    fetchStorefront();
  };

  const handleCustomerLogout = async () => {
    if (customerToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
      }).catch(() => {});
    }
    setCustomerToken(null);
    setCustomerUser(null);
  };

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  if (view === 'admin') {
    return (
      <AdminDashboard
        token={adminToken}
        onTokenChange={setAdminToken}
        onBackToStorefront={navigateToStorefront}
        onStorefrontSync={fetchStorefront}
      />
    );
  }

  if (loading && !storefrontData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#4CB04F] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-neutral-500">
            Loading Emmystylez Solar Electrical Store...
          </p>
        </div>
      </div>
    );
  }

  if (loadError || !storefrontData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-sm font-semibold text-neutral-800">{loadError}</p>
          <button
            type="button"
            onClick={fetchStorefront}
            className="px-4 py-2 rounded bg-[#4CB04F] text-white text-xs font-semibold btn-hover-white border border-transparent"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Storefront
        data={storefrontData}
        activePage={activePage}
        selectedCategory={selectedCategory}
        cartCount={cartCount}
        customerUser={customerUser}
        onNavigatePage={handleNavigatePage}
        onAddToCart={handleAddToCart}
        onSelectProduct={setSelectedProduct}
        onOpenCart={() => setCartOpen(true)}
        onOpenOrderLookup={() => {
          setTrackingCodePrefill('');
          setOrderLookupOpen(true);
        }}
        onOpenAuth={(mode = 'login') => setAuthModal({ open: true, mode })}
        onOpenAdmin={navigateToAdmin}
        onOpenPolicy={() => setPolicyModalOpen(true)}
        policyChoice={policyChoice}
        onAcceptPolicy={() => {
          writePolicyChoice('accepted');
          setPolicyChoice('accepted');
        }}
        onDeclinePolicy={() => {
          writePolicyChoice('declined');
          setPolicyChoice('declined');
        }}
      />

      {cartNotice && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-50 bg-[#151916] text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl flex items-center justify-between gap-3">
          <span className="truncate">{cartNotice}</span>
          <button
            type="button"
            onClick={() => {
              setCartNotice(null);
              setCartOpen(true);
            }}
            className="text-[#4CB04F] hover:underline shrink-0"
          >
            View Cart
          </button>
        </div>
      )}

      <StorePolicyModal
        open={policyModalOpen}
        settings={storefrontData.settings}
        onAccept={() => {
          writePolicyChoice('accepted');
          setPolicyChoice('accepted');
          setPolicyModalOpen(false);
        }}
        onDecline={() => {
          writePolicyChoice('declined');
          setPolicyChoice('declined');
        }}
        onCloseAfterDecline={() => setPolicyModalOpen(false)}
      />

      <ProductDetailModal
        product={selectedProduct}
        currency={storefrontData.settings.currencySymbol}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        open={cartOpen}
        items={cart}
        settings={storefrontData.settings}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onCheckout={(couponCode, discountAmount) => {
          if (policyChoice === 'declined') {
            setCartOpen(false);
            setPolicyModalOpen(true);
            return;
          }
          setCartOpen(false);
          setCheckoutState({ open: true, couponCode, discountAmount });
        }}
      />

      <CheckoutModal
        open={checkoutState.open}
        items={cart}
        couponCode={checkoutState.couponCode}
        discountAmount={checkoutState.discountAmount}
        settings={storefrontData.settings}
        gateways={storefrontData.gateways}
        onClose={() => setCheckoutState({ open: false, couponCode: null, discountAmount: 0 })}
        onOrderSuccess={handleOrderSuccess}
        onOpenTrackingWithCode={(trackingNumber) => {
          setTrackingCodePrefill(trackingNumber);
          setOrderLookupOpen(true);
        }}
      />

      <OrderLookupModal
        open={orderLookupOpen}
        initialTrackingCode={trackingCodePrefill}
        settings={storefrontData.settings}
        onClose={() => setOrderLookupOpen(false)}
      />

      <CustomerAuthModal
        open={authModal.open}
        initialMode={authModal.mode}
        settings={storefrontData.settings}
        user={customerUser}
        customerToken={customerToken}
        onClose={() => setAuthModal({ ...authModal, open: false })}
        onAuthenticated={(tok, usr) => {
          setCustomerToken(tok);
          setCustomerUser(usr);
        }}
        onLogout={handleCustomerLogout}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
