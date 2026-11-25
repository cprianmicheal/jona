import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  CreditCard,
  Package,
  Tag,
  Users,
  Settings,
  ArrowLeft,
  LogOut,
  Plus,
  Search,
  Download,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  Lock,
  Clock,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  Image as ImageIcon,
  Video,
  MessageCircle,
  KeyRound,
  Zap,
  Truck,
  FileText,
  ExternalLink,
  MapPin,
  Menu,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SolariLogo } from './SolariLogo';
import {
  PRODUCT_CATEGORIES,
  TRACKING_STAGES,
  type AboutMediaItem,
  type AdminDashboardData,
  type CustomerAccount,
  type CustomerInquiry,
  type Order,
  type OrderStatus,
  type PaymentGatewayConfig,
  type PaymentStatus,
  type Product,
  type PromoBanner,
  type StoreSettings,
  type TrackingStage,
} from '../types';
import { formatNaira } from '../utils/invoicePdf';
import { parseJsonResponseSafe, prepareMediaForUpload } from '../utils/mediaUpload';

type AdminTab =
  | 'overview'
  | 'orders'
  | 'payments'
  | 'products'
  | 'flash_sales'
  | 'about_media'
  | 'promotions'
  | 'customers'
  | 'settings';

const AVAILABLE_IMAGES = [
  { label: 'Dual Solar Panels', url: '/src/assets/images/product_solar_panels_1795501702594.jpg' },
  { label: 'Portable Solar Pack', url: '/src/assets/images/product_solar_backpack_1795501703144.jpg' },
  { label: 'Enphase Microinverter', url: '/src/assets/images/product_microinverter_1795501704611.jpg' },
  { label: 'Foldable Solar Charger', url: '/src/assets/images/product_foldable_charger_1795501704339.jpg' },
  { label: 'Hybrid Wall Inverter', url: '/src/assets/images/product_wall_inverter_1795501705391.jpg' },
  { label: 'Solar LED Floodlight', url: '/src/assets/images/product_solar_floodlight_1795501705103.jpg' },
  { label: 'Portable Power 300W', url: '/src/assets/images/product_portable_station_1795501706387.jpg' },
  { label: 'EcoFlow Delta 1088Wh', url: '/src/assets/images/product_ecoflow_station_1795501705949.jpg' },
];

interface AdminDashboardProps {
  token: string | null;
  onTokenChange: (token: string | null) => void;
  onBackToStorefront: () => void;
  onStorefrontSync: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  token,
  onTokenChange,
  onBackToStorefront,
  onStorefrontSync,
}) => {
  const [authStatus, setAuthStatus] = useState<{
    loaded: boolean;
    initialized: boolean;
    envManaged: boolean;
    database?: string;
    supabaseHost?: string | null;
  }>({ loaded: false, initialized: true, envManaged: false });
  const [passcodeInput, setPasscodeInput] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [adminLockedUntilMs, setAdminLockedUntilMs] = useState<number | null>(null);
  const [adminLockSecondsLeft, setAdminLockSecondsLeft] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mobileNavScrollRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Global Yes/No Delete Confirmation Dialog
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  // Orders filters & inspector + tracking edit fields
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<'All' | OrderStatus>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trkStageDraft, setTrkStageDraft] = useState<TrackingStage>('Payment Pending Verification');
  const [trkLocationDraft, setTrkLocationDraft] = useState('');
  const [trkWaybillDraft, setTrkWaybillDraft] = useState('');
  const [trkEtaDraft, setTrkEtaDraft] = useState('');
  const [trkNoteDraft, setTrkNoteDraft] = useState('');
  const [savingTracking, setSavingTracking] = useState(false);

  // Products modal & drag/drop state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prefillImageUrl, setPrefillImageUrl] = useState<string | null>(null);
  const [prefillName, setPrefillName] = useState<string | null>(null);
  const [prefillFlashSale, setPrefillFlashSale] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productDragOver, setProductDragOver] = useState(false);
  const [flashDragOver, setFlashDragOver] = useState(false);
  const [uploadingProductDrop, setUploadingProductDrop] = useState(false);

  // Gallery Media form & edit & drag/drop state
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaSpecifications, setMediaSpecifications] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaCategory, setMediaCategory] =
    useState<AboutMediaItem['category']>('Solar Installation');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaDragOver, setMediaDragOver] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<string | null>(null);
  const [savingMedia, setSavingMedia] = useState(false);

  // Editable gateways & settings local state
  const [gatewaysDraft, setGatewaysDraft] = useState<PaymentGatewayConfig[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<StoreSettings | null>(null);
  const [savingGateways, setSavingGateways] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Coupons draft
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponType, setNewCouponType] = useState<'percent' | 'fixed'>('percent');
  const [newCouponValue, setNewCouponValue] = useState('10');
  const [newCouponMin, setNewCouponMin] = useState('50000');

  // Banner & homepage slot image editing
  const [editingBanner, setEditingBanner] = useState<PromoBanner | null>(null);
  const [isCreatingBanner, setIsCreatingBanner] = useState(false);
  const [uploadingBannerImg, setUploadingBannerImg] = useState(false);
  const [uploadingBannerCardId, setUploadingBannerCardId] = useState<string | null>(null);
  const [afterHeroDropBusy, setAfterHeroDropBusy] = useState(false);
  const [afterHeroDragOver, setAfterHeroDragOver] = useState(false);
  const [uploadingSlotImg, setUploadingSlotImg] = useState<'hero' | 'mission' | null>(null);
  const [slotDragOver, setSlotDragOver] = useState<'hero' | 'mission' | null>(null);

  // Change passcode state
  const [currentPass, setCurrentPass] = useState('');
  const [nextPass, setNextPass] = useState('');
  const [supabaseInfo, setSupabaseInfo] = useState<{
    configured: boolean;
    connected: boolean;
    urlHost: string | null;
    lastSyncAt: string | null;
    lastError: string | null;
    envStatus?: {
      supabaseUrl: boolean;
      supabaseServiceKey: boolean;
      adminPasscodeEnv: boolean;
      sessionSecret: boolean;
    };
    counts?: {
      products: number;
      gallery: number;
      banners: number;
      orders: number;
    };
  } | null>(null);
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [pullingSupabase, setPullingSupabase] = useState(false);

  // Tick every second to show live 1-minute code countdown & auto-refresh when expired
  const [nowTick, setNowTick] = useState(Date.now());

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  useEffect(() => {
    if (selectedOrder) {
      setTrkStageDraft(selectedOrder.trackingStage || 'Payment Pending Verification');
      setTrkLocationDraft(
        selectedOrder.trackingLocation ||
          `${selectedOrder.customer.park || selectedOrder.customer.city}, ${selectedOrder.customer.state || ''}`
      );
      setTrkWaybillDraft(selectedOrder.waybillInfo || '');
      setTrkEtaDraft(selectedOrder.estimatedDelivery || '');
      setTrkNoteDraft('');
    }
  }, [selectedOrder]);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/status', { cache: 'no-store' });
      const json = await res.json();
      setAuthStatus({
        loaded: true,
        initialized: Boolean(json.initialized),
        envManaged: Boolean(json.envManaged),
        database: json.database,
        supabaseHost: json.supabaseHost || null,
      });
    } catch {
      setAuthStatus({ loaded: true, initialized: true, envManaged: false });
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/dashboard', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onTokenChange(null);
        return;
      }
      const json: AdminDashboardData = await res.json();
      setData(json);
      setGatewaysDraft(json.gateways);
      setSettingsDraft(json.settings);
      fetch('/api/admin/supabase-status', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((sb) => {
          if (sb) setSupabaseInfo(sb);
        })
        .catch(() => {});
    } catch {
      notify('Failed to load admin dashboard data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, onTokenChange, notify]);

  useEffect(() => {
    fetchAuthStatus();
  }, [fetchAuthStatus]);

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token, loadDashboard]);

  useEffect(() => {
    if (!adminLockedUntilMs) {
      setAdminLockSecondsLeft(0);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((adminLockedUntilMs - Date.now()) / 1000));
      setAdminLockSecondsLeft(diff);
      if (diff <= 0) {
        setAdminLockedUntilMs(null);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [adminLockedUntilMs]);

  // Live countdown ticker & automatic refresh when an active customer reset code crosses 60s
  useEffect(() => {
    if (!token || !data) return;
    const hasActiveCode = data.customers.some((c) => c.resetCodeStatus === 'Active');
    if (!hasActiveCode) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      const justExpired = data.customers.some(
        (c) =>
          c.resetCodeStatus === 'Active' &&
          c.resetCodeExpiresAt &&
          now > new Date(c.resetCodeExpiresAt).getTime()
      );
      if (justExpired) {
        loadDashboard();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [token, data, loadDashboard]);

  const uploadMediaFile = async (file: File): Promise<{ url: string; type: 'image' | 'video' }> => {
    const prepared = await prepareMediaForUpload(file);
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        filename: prepared.filename,
        mimeType: prepared.mimeType,
        dataBase64: prepared.dataBase64,
      }),
    });
    const json = await parseJsonResponseSafe<{ url?: string; type?: 'image' | 'video'; error?: string }>(res);
    if (!res.ok || !json.url) {
      throw new Error(json.error || 'Upload failed.');
    }
    return { url: json.url, type: json.type || 'image' };
  };

  const openNewProductModal = (opts?: {
    prefillImageUrl?: string | null;
    prefillName?: string | null;
    asFlashSale?: boolean;
  }) => {
    setEditingProduct(null);
    setPrefillImageUrl(opts?.prefillImageUrl ?? null);
    setPrefillName(opts?.prefillName ?? null);
    setPrefillFlashSale(Boolean(opts?.asFlashSale));
    setProductModalOpen(true);
  };

  const handleProductDropFiles = async (files: FileList | null, asFlashSale = false) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadingProductDrop(true);
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : parsed.products;
        const res = await fetch('/api/admin/products/bulk', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ products: list }),
        });
        const json = await res.json();
        if (!res.ok) {
          notify(json.error || 'JSON product import failed.', 'error');
        } else {
          await loadDashboard();
          onStorefrontSync();
          notify(`Imported ${json.importedCount} product(s) into catalog.`);
        }
      } else {
        const uploaded = await uploadMediaFile(file);
        const cleanTitle = file.name
          .replace(/\.[^.]+$/, '')
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (m) => m.toUpperCase());
        setEditingProduct(null);
        setPrefillImageUrl(uploaded.url);
        setPrefillName(cleanTitle);
        setPrefillFlashSale(asFlashSale);
        setProductModalOpen(true);
        notify(
          asFlashSale
            ? 'Flash sale image uploaded! Enter Flash Sale price and click Save.'
            : 'Product image uploaded! Complete details and save.'
        );
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to process dropped file.', 'error');
    } finally {
      setUploadingProductDrop(false);
    }
  };

  const formatTitleFromFilename = (filename: string) =>
    filename
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (m) => m.toUpperCase()) || 'Emmystylez Installation';

  const handleAboutMediaDropFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    setUploadingMedia(true);

    try {
      if (fileList.length === 1) {
        const file = fileList[0];
        setMediaUploadProgress(`Uploading ${file.name}...`);
        const uploaded = await uploadMediaFile(file);
        setMediaUrl(uploaded.url);
        setMediaType(uploaded.type);
        if (!mediaTitle.trim()) {
          setMediaTitle(formatTitleFromFilename(file.name));
        }
        notify(
          `${uploaded.type === 'video' ? 'Video' : 'Image'} uploaded! Click "Publish to Gallery Page" below to display it live.`
        );
      } else {
        let publishedCount = 0;
        let lastError: string | null = null;
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          setMediaUploadProgress(`Uploading & publishing ${i + 1} of ${fileList.length}...`);
          try {
            const uploaded = await uploadMediaFile(file);
            const autoTitle = formatTitleFromFilename(file.name);
            const res = await fetch('/api/admin/about-media', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({
                title: autoTitle,
                specifications: mediaSpecifications.trim(),
                caption: mediaCaption.trim(),
                type: uploaded.type,
                category: mediaCategory,
                url: uploaded.url,
              }),
            });
            const json = await parseJsonResponseSafe<{ error?: string }>(res);
            if (!res.ok) {
              lastError = json.error || `Could not publish ${file.name}.`;
            } else {
              publishedCount++;
            }
          } catch (err) {
            lastError = err instanceof Error ? err.message : `Failed to upload ${file.name}.`;
          }
        }
        if (publishedCount > 0) {
          await loadDashboard();
          onStorefrontSync();
          notify(
            lastError
              ? `Published ${publishedCount} of ${fileList.length} items. Notice: ${lastError}`
              : `Uploaded & published ${publishedCount} items to the Gallery Page!`
          );
        } else {
          notify(lastError || 'Could not upload selected gallery files.', 'error');
        }
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Media upload failed.', 'error');
    } finally {
      setUploadingMedia(false);
      setMediaUploadProgress(null);
    }
  };

  const handleSettingsImageDrop = async (slot: 'hero' | 'mission', files: FileList | null) => {
    if (!files || files.length === 0 || !settingsDraft) return;
    const file = files[0];
    setUploadingSlotImg(slot);
    try {
      const uploaded = await uploadMediaFile(file);
      if (uploaded.type !== 'image') {
        notify('Please upload an image file (JPG, PNG, WEBP).', 'error');
        return;
      }
      const nextSettings: StoreSettings =
        slot === 'hero'
          ? { ...settingsDraft, heroImageUrl: uploaded.url }
          : { ...settingsDraft, missionImageUrl: uploaded.url };
      setSettingsDraft(nextSettings);
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(nextSettings),
      });
      if (res.ok) {
        await loadDashboard();
        onStorefrontSync();
        notify(
          slot === 'hero'
            ? 'Hero image updated and published to Storefront!'
            : 'Make Solar Energy Accessible image updated and published!'
        );
      } else {
        notify('Image uploaded — click Save Global Settings to publish.', 'error');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Image upload failed.', 'error');
    } finally {
      setUploadingSlotImg(null);
    }
  };

  const resetMediaForm = () => {
    setEditingMediaId(null);
    setMediaTitle('');
    setMediaSpecifications('');
    setMediaCaption('');
    setMediaUrl('');
    setMediaType('image');
    setMediaCategory('Solar Installation');
  };

  const handlePublishOrUpdateGalleryMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaTitle.trim() || !mediaUrl.trim()) {
      notify('Media file/URL and title are required.', 'error');
      return;
    }

    const endpoint = editingMediaId
      ? `/api/admin/about-media/${editingMediaId}`
      : '/api/admin/about-media';
    const method = editingMediaId ? 'PATCH' : 'POST';

    setSavingMedia(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: authHeaders,
        body: JSON.stringify({
          title: mediaTitle,
          specifications: mediaSpecifications,
          caption: mediaCaption,
          type: mediaType,
          category: mediaCategory,
          url: mediaUrl,
        }),
      });
      const json = await parseJsonResponseSafe<{ error?: string }>(res);
      if (!res.ok) {
        notify(json.error || 'Could not save gallery media.', 'error');
        return;
      }
      const wasEdit = Boolean(editingMediaId);
      resetMediaForm();
      await loadDashboard();
      onStorefrontSync();
      notify(wasEdit ? 'Gallery item updated!' : 'Published to Gallery Page!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save gallery media.', 'error');
    } finally {
      setSavingMedia(false);
    }
  };

  const startEditMediaItem = (item: AboutMediaItem) => {
    setEditingMediaId(item.id);
    setMediaTitle(item.title);
    setMediaSpecifications(item.specifications || '');
    setMediaCaption(item.caption || '');
    setMediaType(item.type);
    setMediaCategory(item.category);
    setMediaUrl(item.url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleAboutMedia = async (item: AboutMediaItem) => {
    await fetch(`/api/admin/about-media/${item.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ active: !item.active }),
    });
    await loadDashboard();
    onStorefrontSync();
  };

  const promptDeleteAboutMedia = (item: AboutMediaItem) => {
    setConfirmDelete({
      title: 'Delete Gallery Item?',
      message: `Are you sure you want to permanently delete "${item.title}" (${item.type.toUpperCase()}) from the Gallery?`,
      onConfirm: async () => {
        await fetch(`/api/admin/about-media/${item.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (editingMediaId === item.id) resetMediaForm();
        await loadDashboard();
        onStorefrontSync();
        notify(`Deleted "${item.title}" from Gallery.`);
      },
    });
  };

  const promptDeleteOrder = (order: Order) => {
    setConfirmDelete({
      title: 'Delete Order Record?',
      message: `Are you sure you want to permanently delete order "${order.orderNumber}" (${order.trackingNumber})? This will also remove its associated transaction.`,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/orders/${order.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (res.ok) {
          if (selectedOrder?.id === order.id) setSelectedOrder(null);
          await loadDashboard();
          onStorefrontSync();
          notify(`Deleted order ${order.orderNumber}.`);
        } else {
          notify('Unable to delete order.', 'error');
        }
      },
    });
  };

  const promptDeleteInquiry = (inquiry: CustomerInquiry) => {
    setConfirmDelete({
      title: 'Delete Quote Request?',
      message: `Are you sure you want to delete the quote request from "${inquiry.name}" (${inquiry.serviceType})?`,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (res.ok) {
          await loadDashboard();
          notify(`Deleted inquiry from ${inquiry.name}.`);
        } else {
          notify('Unable to delete inquiry.', 'error');
        }
      },
    });
  };

  const promptDeleteCustomer = (cust: CustomerAccount) => {
    setConfirmDelete({
      title: 'Delete Customer Account?',
      message: `Are you sure you want to permanently delete the account for "${cust.fullName}" (${cust.email})?`,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/customers/${cust.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (res.ok) {
          await loadDashboard();
          notify(`Deleted account for ${cust.fullName}.`);
        } else {
          notify('Unable to delete customer account.', 'error');
        }
      },
    });
  };

  const handleRegenerateCustomerCode = async (customerId: string) => {
    const res = await fetch(`/api/admin/customers/${customerId}/regenerate-code`, {
      method: 'POST',
      headers: authHeaders,
    });
    if (res.ok) {
      await loadDashboard();
      notify('New EXP verification code generated (valid for 1 minute).');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLockSecondsLeft > 0) return;
    setAuthError(null);
    if (!authStatus.initialized) {
      if (passcodeInput.length < 6) {
        setAuthError('Passcode must be at least 6 characters.');
        return;
      }
      if (passcodeInput !== confirmPasscode) {
        setAuthError('Passcodes do not match.');
        return;
      }
    }
    setAuthSubmitting(true);
    try {
      const endpoint = authStatus.initialized
        ? '/api/admin/auth/login'
        : '/api/admin/auth/setup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.retryAfterSeconds && Number(json.retryAfterSeconds) > 0) {
          const until =
            json.lockedUntil && Number(json.lockedUntil) > Date.now()
              ? Number(json.lockedUntil)
              : Date.now() + Number(json.retryAfterSeconds) * 1000;
          setAdminLockedUntilMs(until);
        }
        setAuthError(json.error || 'Authentication failed.');
      } else {
        setAdminLockedUntilMs(null);
        setPasscodeInput('');
        setConfirmPasscode('');
        setAuthStatus((s) => ({ ...s, initialized: true }));
        onTokenChange(json.token);
      }
    } catch {
      setAuthError('Network error authenticating with server.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    onTokenChange(null);
    setData(null);
  };

  const handleOrderUpdate = async (
    orderId: string,
    patch: {
      orderStatus?: OrderStatus;
      paymentStatus?: PaymentStatus;
      trackingStage?: TrackingStage;
      trackingLocation?: string;
      waybillInfo?: string;
      estimatedDelivery?: string;
      trackingNote?: string;
      notes?: string;
    }
  ) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Failed to update order.', 'error');
        return;
      }
      setSelectedOrder(json.order);
      await loadDashboard();
      onStorefrontSync();
      notify(`Order ${json.order.trackingNumber} updated.`);
    } catch {
      notify('Network error updating order.', 'error');
    }
  };

  const handleSaveTrackingDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSavingTracking(true);
    await handleOrderUpdate(selectedOrder.id, {
      trackingStage: trkStageDraft,
      trackingLocation: trkLocationDraft,
      waybillInfo: trkWaybillDraft,
      estimatedDelivery: trkEtaDraft,
      trackingNote: trkNoteDraft,
    });
    setTrkNoteDraft('');
    setSavingTracking(false);
  };

  const handleSaveGatewaysAndFinancials = async () => {
    if (!settingsDraft) return;
    setSavingGateways(true);
    try {
      const [gwRes, stRes] = await Promise.all([
        fetch('/api/admin/gateways', {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ gateways: gatewaysDraft }),
        }),
        fetch('/api/admin/settings', {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(settingsDraft),
        }),
      ]);
      if (!gwRes.ok || !stRes.ok) {
        notify('Failed to save payment & delivery settings.', 'error');
      } else {
        await loadDashboard();
        onStorefrontSync();
        notify('Payment gateways, delivery fee & bank details synced to Storefront.');
      }
    } catch {
      notify('Network error saving gateways.', 'error');
    } finally {
      setSavingGateways(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settingsDraft) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(settingsDraft),
      });
      if (!res.ok) {
        notify('Failed to save storefront settings.', 'error');
      } else {
        await loadDashboard();
        onStorefrontSync();
        notify('Storefront settings & global WhatsApp updated.');
      }
    } catch {
      notify('Network error saving settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleQuickStock = async (product: Product, delta: number) => {
    const nextStock = Math.max(0, product.stock + delta);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ stock: nextStock }),
      });
      if (res.ok) {
        await loadDashboard();
        onStorefrontSync();
      }
    } catch {
      notify('Error adjusting inventory.', 'error');
    }
  };

  const handleToggleFlashSale = async (product: Product) => {
    const nextFlash = !product.isFlashSale;
    const defaultFlashPrice =
      product.flashSalePrice && product.flashSalePrice > 0
        ? product.flashSalePrice
        : Math.round(product.price * 0.85);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          isFlashSale: nextFlash,
          flashSalePrice: nextFlash ? defaultFlashPrice : product.flashSalePrice,
        }),
      });
      if (res.ok) {
        await loadDashboard();
        onStorefrontSync();
        notify(
          nextFlash
            ? `"${product.name}" added to Flash Sales carousel!`
            : `"${product.name}" removed from Flash Sales.`
        );
      }
    } catch {
      notify('Error updating Flash Sale status.', 'error');
    }
  };

  const handleUpdateFlashPrice = async (product: Product, nextPrice: number) => {
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) return;
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ flashSalePrice: nextPrice, isFlashSale: true }),
      });
      if (res.ok) {
        await loadDashboard();
        onStorefrontSync();
        notify(`Updated Flash Sale price for "${product.name}".`);
      }
    } catch {
      notify('Failed to update Flash Sale price.', 'error');
    }
  };

  const promptDeleteProduct = (product: Product) => {
    setConfirmDelete({
      title: 'Delete Product?',
      message: `Are you sure you want to permanently delete "${product.name}" (SKU: ${product.sku}) from your store?`,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/products/${product.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (res.ok) {
          await loadDashboard();
          onStorefrontSync();
          notify(`Removed "${product.name}" from catalog.`);
        } else {
          notify('Unable to delete product.', 'error');
        }
      },
    });
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          code: newCouponCode.trim().toUpperCase(),
          type: newCouponType,
          value: Number(newCouponValue),
          minOrderAmount: Number(newCouponMin),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Could not create coupon.', 'error');
      } else {
        setNewCouponCode('');
        await loadDashboard();
        onStorefrontSync();
        notify(`Promo code ${json.coupon.code} created.`);
      }
    } catch {
      notify('Error creating coupon.', 'error');
    }
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    await fetch(`/api/admin/coupons/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ active }),
    });
    await loadDashboard();
    onStorefrontSync();
  };

  const promptDeleteCoupon = (couponId: string, code: string) => {
    setConfirmDelete({
      title: 'Delete Promo Code?',
      message: `Are you sure you want to delete promo code "${code}"? Buyers will no longer be able to apply it.`,
      onConfirm: async () => {
        await fetch(`/api/admin/coupons/${couponId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        await loadDashboard();
        onStorefrontSync();
        notify(`Deleted promo code ${code}.`);
      },
    });
  };

  const handleBannerImageDrop = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editingBanner) return;
    setUploadingBannerImg(true);
    try {
      const uploaded = await uploadMediaFile(files[0]);
      setEditingBanner({ ...editingBanner, image: uploaded.url });
      notify('Banner image uploaded!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Banner image upload failed.', 'error');
    } finally {
      setUploadingBannerImg(false);
    }
  };

  const handleDirectCardImageDrop = async (banner: PromoBanner, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingBannerCardId(banner.id);
    try {
      const uploaded = await uploadMediaFile(files[0]);
      const res = await fetch(`/api/admin/banners/${banner.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ ...banner, image: uploaded.url }),
      });
      if (res.ok) {
        await loadDashboard();
        onStorefrontSync();
        notify(`Updated image for "${banner.title}"!`);
      } else {
        notify('Failed to save card image.', 'error');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Image upload failed.', 'error');
    } finally {
      setUploadingBannerCardId(null);
    }
  };

  const handleAfterHeroNewProductDrop = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAfterHeroDropBusy(true);
    try {
      const uploaded = await uploadMediaFile(files[0]);
      const cleanName = files[0].name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      setEditingBanner({
        id: 'new',
        badgeText: 'New Product',
        badgeTone: 'green',
        title: cleanName || 'Featured Solar Product',
        productId: data?.products[0]?.id || '',
        image: uploaded.url,
        ctaLabel: 'Buy Now',
        active: true,
      });
      setIsCreatingBanner(true);
      notify('Image uploaded! Complete the card details or post a new product.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setAfterHeroDropBusy(false);
      setAfterHeroDragOver(false);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    const isNew = isCreatingBanner || editingBanner.id === 'new';
    const res = await fetch(
      isNew ? '/api/admin/banners' : `/api/admin/banners/${editingBanner.id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: authHeaders,
        body: JSON.stringify(editingBanner),
      }
    );
    if (res.ok) {
      setEditingBanner(null);
      setIsCreatingBanner(false);
      await loadDashboard();
      onStorefrontSync();
      notify(isNew ? 'New after-hero showcase card added.' : 'After-hero showcase card updated.');
    } else {
      const err = await res.json().catch(() => ({}));
      notify(err.error || 'Could not save banner card.', 'error');
    }
  };

  const promptDeleteBanner = (banner: PromoBanner) => {
    setConfirmDelete({
      title: 'Delete After-Hero Card?',
      message: `Remove "${banner.title}" from the homepage section right after the hero?`,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/banners/${banner.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
        if (res.ok) {
          await loadDashboard();
          onStorefrontSync();
          notify(`Removed "${banner.title}".`);
        }
      },
    });
  };

  const handleUpdateInquiryStatus = async (id: string, status: 'New' | 'Contacted' | 'Scheduled') => {
    const res = await fetch(`/api/admin/inquiries/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await loadDashboard();
      notify('Quote/Inquiry status updated.');
    }
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/auth/change-passcode', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ currentPasscode: currentPass, newPasscode: nextPass }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify(json.error || 'Could not update passcode.', 'error');
    } else {
      setCurrentPass('');
      setNextPass('');
      notify('Admin passcode updated.');
    }
  };

  const exportTransactionsCsv = () => {
    if (!data) return;
    const headers = [
      'Transaction Ref',
      'Order #',
      'Tracking Code',
      'Customer',
      'Email',
      'Gateway',
      'Mode',
      'Gross',
      'Fee',
      'Net',
      'Status',
      'Date',
    ];
    const orderById = new Map(data.orders.map((o) => [o.id, o]));
    const rows = data.transactions.map((t) => [
      t.transactionRef,
      t.orderNumber,
      orderById.get(t.orderId)?.trackingNumber || '',
      `"${t.customerName.replace(/"/g, '""')}"`,
      t.customerEmail,
      `"${t.gatewayName}"`,
      t.mode,
      t.grossAmount.toFixed(2),
      t.gatewayFee.toFixed(2),
      t.netAmount.toFixed(2),
      t.status,
      t.createdAt,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `emmystylez-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredOrders = useMemo(() => {
    if (!data) return [];
    return data.orders.filter((o) => {
      if (orderFilter !== 'All' && o.orderStatus !== orderFilter) return false;
      if (orderSearch.trim()) {
        const q = orderSearch.trim().toLowerCase();
        return (
          (o.trackingNumber || '').toLowerCase().includes(q) ||
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.fullName.toLowerCase().includes(q) ||
          o.customer.phone.toLowerCase().includes(q) ||
          (o.customer.state || '').toLowerCase().includes(q) ||
          (o.customer.park || '').toLowerCase().includes(q) ||
          o.transactionId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, orderFilter, orderSearch]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    if (!productSearch.trim()) return data.products;
    const q = productSearch.trim().toLowerCase();
    return data.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.specifications || '').toLowerCase().includes(q)
    );
  }, [data, productSearch]);

  const flashSaleProducts = useMemo(
    () => (data?.products || []).filter((p) => p.isFlashSale),
    [data]
  );

  const aggregatedCustomers = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      {
        name: string;
        email: string;
        phone: string;
        city: string;
        ordersCount: number;
        totalSpent: number;
        lastOrderDate: string;
      }
    >();
    for (const order of data.orders) {
      const key = `${order.customer.phone || order.customer.email}`.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          name: order.customer.fullName,
          email: order.customer.email,
          phone: order.customer.phone,
          city: `${order.customer.lga || order.customer.city}, ${order.customer.state || order.customer.country}`,
          ordersCount: 1,
          totalSpent: order.totalAmount,
          lastOrderDate: order.createdAt,
        });
      } else {
        existing.ordersCount += 1;
        existing.totalSpent += order.totalAmount;
        if (order.createdAt > existing.lastOrderDate) {
          existing.lastOrderDate = order.createdAt;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [data]);

  const currency = data?.settings.currencySymbol || '₦';

  // Auth Gate Screen
  if (!token) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <SolariLogo label="Emmystylez Admin" />
            <button
              type="button"
              onClick={onBackToStorefront}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Storefront</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4CB04F]">
              <Lock className="w-3.5 h-3.5" />
              <span>
                {!authStatus.loaded
                  ? 'Checking Admin Security...'
                  : authStatus.initialized
                  ? 'Merchant Workspace Sign In'
                  : 'First-Run Admin Setup'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {authStatus.initialized
                ? 'Sign in to Emmystylez Console'
                : 'Initialize Admin Passcode'}
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              {authStatus.initialized
                ? 'Enter your Emmystylez Solar Electrical Store admin passcode to manage Flash Sales, order receipts, Emmy1001 tracking, delivery fees, WhatsApp number, and Gallery media.'
                : 'Create your administrator passcode to control Flash Sales, transfer receipts, tracking updates, delivery fees, and Gallery uploads.'}
            </p>
            {authStatus.loaded && authStatus.database && (
              <div
                className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border ${
                  authStatus.database === 'supabase'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                <span>
                  {authStatus.database === 'supabase'
                    ? `Global Cloud Connected (${authStatus.supabaseHost || 'Supabase'})`
                    : authStatus.database === 'supabase-pending'
                    ? 'Supabase Credentials Found — Check Schema / Key'
                    : 'Local Storage Only — Set SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY in Host Env'}
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {authStatus.initialized ? 'Admin Passcode' : 'Create Passcode (min 6 characters)'}
              </label>
              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  required
                  minLength={6}
                  disabled={adminLockSecondsLeft > 0}
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#4CB04F] disabled:bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((v) => !v)}
                  aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!authStatus.initialized && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Confirm Passcode
                </label>
                <input
                  type={showPasscode ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#4CB04F]"
                />
              </div>
            )}

            {adminLockSecondsLeft > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Locked after 3 wrong attempts</span>
                  </span>
                  <span className="font-mono-tabular px-2 py-0.5 rounded bg-amber-100">
                    {String(Math.floor(adminLockSecondsLeft / 60)).padStart(2, '0')}:
                    {String(adminLockSecondsLeft % 60).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Please wait for the countdown to finish before entering your admin passcode again.
                </p>
              </div>
            )}

            {authError && adminLockSecondsLeft === 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
                <p className="font-semibold">{authError}</p>
                {authStatus.envManaged && (
                  <p className="text-[11px] text-red-600">
                    This host uses your <code className="font-mono-tabular bg-red-100 px-1 rounded">ADMIN_PASSCODE</code> environment variable. Ensure the value matches your passcode cleanly (without quotes, spaces, or the key name prefix) in Settings &rarr; Secrets / Netlify Environment Variables, then redeploy with cleared cache.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={authSubmitting || adminLockSecondsLeft > 0}
              className="w-full h-10 rounded-lg bg-[#4CB04F] hover:bg-[#419B44] disabled:bg-slate-300 disabled:text-slate-600 text-white text-sm font-semibold transition-colors"
            >
              {adminLockSecondsLeft > 0
                ? `Locked — Retry in ${String(Math.floor(adminLockSecondsLeft / 60)).padStart(2, '0')}:${String(adminLockSecondsLeft % 60).padStart(2, '0')}`
                : authSubmitting
                ? 'Verifying...'
                : authStatus.initialized
                ? 'Unlock Admin Dashboard'
                : 'Initialize & Enter Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'orders',
      label: 'Orders, Receipts & Tracking',
      icon: <ShoppingBag className="w-4 h-4" />,
      badge: data?.summary.pendingOrders || undefined,
    },
    { id: 'payments', label: '2 Bank Accounts & Payments', icon: <CreditCard className="w-4 h-4" /> },
    {
      id: 'flash_sales',
      label: 'Flash Sales Manager',
      icon: <Zap className="w-4 h-4" />,
      badge: flashSaleProducts.length || undefined,
    },
    {
      id: 'products',
      label: 'All Products (Drag & Drop)',
      icon: <Package className="w-4 h-4" />,
      badge: data?.summary.lowStockCount || undefined,
    },
    {
      id: 'about_media',
      label: 'Gallery (Images & Videos)',
      icon: <ImageIcon className="w-4 h-4" />,
      badge: data?.aboutMedia.length || undefined,
    },
    { id: 'promotions', label: 'After-Hero Cards & Promos', icon: <Tag className="w-4 h-4" /> },
    {
      id: 'customers',
      label: 'Accounts, Codes & Quotes',
      icon: <Users className="w-4 h-4" />,
      badge:
        (data?.inquiries.filter((i) => i.status === 'New').length || 0) +
          (data?.customers.length || 0) || undefined,
    },
    { id: 'settings', label: 'Hero Images, WhatsApp & Store', icon: <Settings className="w-4 h-4" /> },
  ];

  const tabTitles: Record<AdminTab, string> = {
    overview: 'Emmystylez Commerce Overview',
    orders: 'Orders, Uploaded Receipts & Emmy1001 Tracking',
    payments: 'Delivery Fee, Two Normal Bank Accounts & Payment Methods',
    flash_sales: 'Homepage Green Flash Sales Manager',
    products: 'Products, Categories & Drag-and-Drop Upload',
    about_media: 'Gallery Manager (Images & Videos with Specs)',
    promotions: 'After-Hero Product Cards (Upload Images & Post New Products) + Coupons',
    customers: 'Customer Accounts & Quote Inquiries',
    settings: 'Homepage Images, Global WhatsApp Number & Store Security',
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'Paid':
      case 'Delivered':
      case 'Active':
      case 'Scheduled':
      case 'Assigned':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Processing':
      case 'Shipped':
      case 'Contacted':
      case 'Used':
        return 'text-sky-700 bg-sky-50 border-sky-200';
      case 'Pending':
      case 'Pending Verification':
      case 'COD Pending':
      case 'New':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Refunded':
      case 'Cancelled':
      case 'Failed':
      case 'Out of Stock':
      case 'Expired':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  const scrollMobileTabs = (direction: 'left' | 'right') => {
    const el = mobileNavScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === 'left' ? -200 : 200,
      behavior: 'smooth',
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 bg-[#0F172A] text-slate-200 flex-col shrink-0 border-r border-slate-800 sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center border-b border-slate-800">
          <SolariLogo dark label="Emmystylez Admin" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#4CB04F] text-white'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1.5">
          <button
            type="button"
            onClick={onBackToStorefront}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800/70 hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#4CB04F]" />
            <span>Back to Storefront</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-black/55 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            className="w-72 max-w-[85vw] bg-[#0F172A] text-slate-200 flex flex-col h-full shadow-2xl border-r border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800">
              <SolariLogo dark label="Emmystylez Admin" />
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close admin menu"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#4CB04F] text-white'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
                          active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-800 space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setMobileSidebarOpen(false);
                  onBackToStorefront();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800/70 hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-[#4CB04F]" />
                <span>Back to Storefront</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open admin features menu"
              className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 min-w-0 truncate">
              <span className="hidden md:inline truncate">
                {data?.settings.storeName || 'Emmystylez Solar Electrical Store'}
              </span>
              <span className="hidden md:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">{tabTitles[activeTab]}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadDashboard}
              aria-label="Refresh admin data"
              className="h-9 px-2.5 sm:px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={onBackToStorefront}
              className="h-9 px-3 sm:px-4 rounded-lg bg-[#4CB04F] hover:bg-[#419B44] text-white text-xs font-semibold whitespace-nowrap"
            >
              <span className="sm:hidden">Storefront</span>
              <span className="hidden sm:inline">Open Live Storefront</span>
            </button>
          </div>
        </header>

        {/* Mobile Horizontal Scrollable Feature Bar (Scroll Left / Right to see every Admin feature) */}
        <div className="lg:hidden bg-white border-b border-slate-200 sticky top-14 z-20 flex items-center gap-1 px-2 py-2">
          <button
            type="button"
            onClick={() => scrollMobileTabs('left')}
            aria-label="Scroll features left"
            className="w-8 h-8 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div
            ref={mobileNavScrollRef}
            className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                    active
                      ? 'bg-[#4CB04F] text-white border-[#4CB04F]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollMobileTabs('right')}
            aria-label="Scroll features right"
            className="w-8 h-8 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Feedback */}
        {toast && (
          <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-50">
            <div
              className={`px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold flex items-center gap-2 ${
                toast.type === 'success'
                  ? 'bg-slate-900 text-white border-slate-800'
                  : 'bg-red-600 text-white border-red-700'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#4CB04F] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        <main className="p-3 sm:p-5 lg:p-6 max-w-[1400px] w-full mx-auto space-y-5 sm:space-y-6">
          {supabaseInfo && (!supabaseInfo.configured || !supabaseInfo.connected) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-bold">
                  {supabaseInfo.configured
                    ? 'Global Supabase Connection Pending — Local Fallback Active'
                    : 'Global Backend Database Not Connected (Using Temporary Local Storage)'}
                </p>
                <p className="text-[11px] text-red-800 mt-0.5">
                  {supabaseInfo.lastError ||
                    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your server environment variables so uploads and updates persist globally across reloads and deployments.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-800 text-white font-semibold text-[11px] shrink-0"
              >
                Fix Connection in Settings
              </button>
            </div>
          )}
          {!data ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((k) => (
                <div
                  key={k}
                  className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-slate-900">
                        {data.settings.storeName}
                      </h2>
                      <p className="text-xs text-slate-600">{data.settings.businessCategory}</p>
                      <p className="text-xs text-slate-500">
                        {data.settings.address} · Delivery Fee:{' '}
                        <span className="font-semibold text-slate-900">
                          {formatNaira(data.settings.flatShippingFee, currency)}
                        </span>{' '}
                        · Global WhatsApp:{' '}
                        <span className="font-semibold text-[#4CB04F]">
                          {data.settings.whatsappNumber}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('flash_sales')}
                        className="h-8 px-3 rounded-lg bg-[#4CB04F] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Manage Flash Sales</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('orders')}
                        className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold"
                      >
                        Inspect Receipts &amp; Tracking
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold"
                      >
                        Change WhatsApp #
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <p className="text-xs font-medium text-slate-500">Gross Store Revenue</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                        {formatNaira(data.summary.totalRevenue, currency)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
                        {data.summary.totalOrders} orders · Avg{' '}
                        {formatNaira(data.summary.avgOrderValue, currency)}
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <p className="text-xs font-medium text-slate-500">Settled / Paid Volume</p>
                      <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                        {formatNaira(data.summary.paidRevenue, currency)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
                        {data.summary.paidOrders} settled transactions
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <p className="text-xs font-medium text-slate-500">Flash Sale Deals</p>
                      <p className="text-2xl font-bold text-[#4CB04F] mt-1 tabular-nums">
                        {flashSaleProducts.length}
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5">
                        Live in green homepage carousel
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <p className="text-xs font-medium text-slate-500">Gallery &amp; Products</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                        {data.products.length} SKUs
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
                        {data.aboutMedia.length} Gallery items · {PRODUCT_CATEGORIES.length}{' '}
                        categories
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900">
                          Payment Gateway Volume
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('payments')}
                          className="text-xs font-semibold text-[#4CB04F] hover:underline"
                        >
                          Configure Delivery &amp; Banks
                        </button>
                      </div>

                      <div className="space-y-3">
                        {data.gateways.map((gw) => {
                          const gwTxns = data.transactions.filter(
                            (t) => t.gatewayId === gw.id && t.status !== 'Refunded'
                          );
                          const gwSum = gwTxns.reduce((s, t) => s + t.grossAmount, 0);
                          const maxRef = Math.max(1, data.summary.totalRevenue);
                          const pct = Math.min(100, Math.round((gwSum / maxRef) * 100));
                          return (
                            <div key={gw.id} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-slate-800">{gw.name}</span>
                                <span className="font-semibold text-slate-900 tabular-nums">
                                  {formatNaira(gwSum, currency)} ({gwTxns.length})
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-[#4CB04F] rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900">
                          Recent Storefront Orders
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('orders')}
                          className="text-xs font-semibold text-[#4CB04F] hover:underline"
                        >
                          View All Orders &amp; Tracking
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                            <tr>
                              <th className="py-2.5 px-4 font-medium">Tracking Code</th>
                              <th className="py-2.5 px-4 font-medium">Customer &amp; State</th>
                              <th className="py-2.5 px-4 font-medium">Payment</th>
                              <th className="py-2.5 px-4 font-medium">Tracking Stage</th>
                              <th className="py-2.5 px-4 font-medium text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {data.orders.slice(0, 6).map((order) => (
                              <tr
                                key={order.id}
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setActiveTab('orders');
                                }}
                                className="hover:bg-slate-50 cursor-pointer"
                              >
                                <td className="py-3 px-4 font-mono-tabular font-bold text-[#235D25]">
                                  {order.trackingNumber || order.orderNumber}
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  <span className="font-medium block">
                                    {order.customer.fullName}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {order.customer.state}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${statusBadgeClass(
                                      order.paymentStatus
                                    )}`}
                                  >
                                    {order.paymentStatus}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-700">
                                  {order.trackingStage}
                                </td>
                                <td className="py-3 px-4 text-right font-semibold tabular-nums">
                                  {formatNaira(order.totalAmount, currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ORDERS, RECEIPTS & TRACKING TAB */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
                      {(['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Refunded'] as const).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setOrderFilter(st)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                              orderFilter === st
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {st}
                          </button>
                        )
                      )}
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Search Emmy1001, name, state, park..."
                        className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-xs w-full md:w-72 focus:outline-none focus:border-[#4CB04F]"
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="py-3 px-4 font-medium">Tracking / Order #</th>
                            <th className="py-3 px-4 font-medium">Buyer &amp; Destination</th>
                            <th className="py-3 px-4 font-medium">Receipt</th>
                            <th className="py-3 px-4 font-medium">Payment</th>
                            <th className="py-3 px-4 font-medium">Live Tracking Stage</th>
                            <th className="py-3 px-4 font-medium text-right">Total</th>
                            <th className="py-3 px-4 font-medium text-right">Manage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-slate-500">
                                No matching orders found.
                              </td>
                            </tr>
                          ) : (
                            filteredOrders.map((order) => (
                              <tr key={order.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <p className="font-mono-tabular font-bold text-[#235D25]">
                                    {order.trackingNumber || 'N/A'}
                                  </p>
                                  <p className="text-[11px] font-mono-tabular text-slate-500">
                                    {order.orderNumber}
                                  </p>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-slate-900">
                                    {order.customer.fullName} ({order.customer.phone})
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {order.customer.state} · {order.customer.lga} ·{' '}
                                    {order.customer.park}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  {order.receiptUrl ? (
                                    <a
                                      href={order.receiptUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EDF7EE] text-[#235D25] font-semibold text-[11px] hover:underline"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>View Receipt</span>
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-slate-400">None</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${statusBadgeClass(
                                      order.paymentStatus
                                    )}`}
                                  >
                                    {order.paymentStatus}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <p className="font-semibold text-slate-800">
                                    {order.trackingStage}
                                  </p>
                                  <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                    {order.trackingLocation || order.customer.park}
                                  </p>
                                </td>
                                <td className="py-3 px-4 text-right font-semibold tabular-nums">
                                  {formatNaira(order.totalAmount, currency)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedOrder(order)}
                                      className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                                    >
                                      Track &amp; Verify
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => promptDeleteOrder(order)}
                                      title="Delete Order Record"
                                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* DELIVERY FEE, BANK & PAYMENTS TAB */}
              {activeTab === 'payments' && settingsDraft && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Nationwide Delivery Fee, Bank Account &amp; Payment Gateways
                        </h2>
                        <p className="text-xs text-slate-500">
                          Set the delivery fee charged at checkout, settlement bank account shown to
                          buyers before uploading receipts, and payment channels.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={savingGateways}
                        onClick={handleSaveGatewaysAndFinancials}
                        className="h-9 px-4 rounded-lg bg-[#4CB04F] hover:bg-[#419B44] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                      >
                        {savingGateways ? 'Saving...' : 'Save Delivery & Payment Settings'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-[#EDF7EE]/70 border border-[#4CB04F]/30 text-xs">
                      <div>
                        <label className="block font-bold text-[#151916] mb-1">
                          Nationwide Delivery Fee ({currency})
                        </label>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={settingsDraft.flatShippingFee}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              flatShippingFee: Number(e.target.value),
                            })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300 bg-white tabular-nums font-bold"
                        />
                        <p className="text-[11px] text-slate-600 mt-1">
                          Automatically applied to State/Park waybill checkout.
                        </p>
                      </div>
                      <div>
                        <label className="block font-bold text-[#151916] mb-1">
                          Free Delivery Order Threshold ({currency})
                        </label>
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          value={settingsDraft.freeShippingThreshold}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              freeShippingThreshold: Number(e.target.value),
                            })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300 bg-white tabular-nums"
                        />
                        <p className="text-[11px] text-slate-600 mt-1">
                          Set 0 to always charge the flat delivery fee.
                        </p>
                      </div>
                      <div>
                        <label className="block font-bold text-[#151916] mb-1">
                          VAT / Sales Tax Rate (%)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={settingsDraft.taxRatePercent}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              taxRatePercent: Number(e.target.value),
                            })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300 bg-white tabular-nums"
                        />
                      </div>
                    </div>

                    {/* Two Normal Bank Accounts Shown at Checkout */}
                    <div className="pt-2 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Two Normal Bank Accounts (Displayed to Buyers at Checkout)
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Save up to two normal Nigerian bank accounts here so customers can pay
                            directly without Paystack.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                        {/* Bank Account 1 */}
                        <div className="p-4 rounded-lg border border-emerald-200 bg-[#EDF7EE]/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#235D25]">
                              Bank Account 1 (Primary)
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#4CB04F] text-white">
                              Active at Checkout
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-slate-600 mb-1">Bank Name</label>
                              <input
                                value={settingsDraft.bankDetails.bankName}
                                onChange={(e) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    bankDetails: {
                                      ...settingsDraft.bankDetails,
                                      bankName: e.target.value,
                                    },
                                  })
                                }
                                placeholder="e.g. Zenith Bank Plc"
                                className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Account Name</label>
                              <input
                                value={settingsDraft.bankDetails.accountName}
                                onChange={(e) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    bankDetails: {
                                      ...settingsDraft.bankDetails,
                                      accountName: e.target.value,
                                    },
                                  })
                                }
                                placeholder="e.g. Emmystylez Solar Nig Ltd"
                                className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">Account Number</label>
                              <input
                                value={settingsDraft.bankDetails.accountNumber}
                                onChange={(e) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    bankDetails: {
                                      ...settingsDraft.bankDetails,
                                      accountNumber: e.target.value,
                                    },
                                  })
                                }
                                placeholder="10-digit NUBAN"
                                className="w-full h-9 px-3 rounded border border-slate-300 bg-white font-mono-tabular font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-600 mb-1">
                                Routing / Sort Code
                              </label>
                              <input
                                value={settingsDraft.bankDetails.routingCode}
                                onChange={(e) =>
                                  setSettingsDraft({
                                    ...settingsDraft,
                                    bankDetails: {
                                      ...settingsDraft.bankDetails,
                                      routingCode: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Optional"
                                className="w-full h-9 px-3 rounded border border-slate-300 bg-white font-mono-tabular"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Bank Account 2 */}
                        {(() => {
                          const sec = settingsDraft.secondaryBankDetails || {
                            enabled: true,
                            bankName: '',
                            accountName: '',
                            accountNumber: '',
                            routingCode: '',
                          };
                          return (
                            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                                  Bank Account 2 (Secondary)
                                </span>
                                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={sec.enabled}
                                    onChange={(e) =>
                                      setSettingsDraft({
                                        ...settingsDraft,
                                        secondaryBankDetails: {
                                          ...sec,
                                          enabled: e.target.checked,
                                        },
                                      })
                                    }
                                    className="w-3.5 h-3.5 accent-[#4CB04F]"
                                  />
                                  Show at Checkout
                                </label>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-slate-600 mb-1">Bank Name</label>
                                  <input
                                    value={sec.bankName}
                                    onChange={(e) =>
                                      setSettingsDraft({
                                        ...settingsDraft,
                                        secondaryBankDetails: {
                                          ...sec,
                                          bankName: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="e.g. Guaranty Trust Bank (GTBank)"
                                    className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-600 mb-1">Account Name</label>
                                  <input
                                    value={sec.accountName}
                                    onChange={(e) =>
                                      setSettingsDraft({
                                        ...settingsDraft,
                                        secondaryBankDetails: {
                                          ...sec,
                                          accountName: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="e.g. Emmystylez Solar Nig Ltd"
                                    className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-600 mb-1">
                                    Account Number
                                  </label>
                                  <input
                                    value={sec.accountNumber}
                                    onChange={(e) =>
                                      setSettingsDraft({
                                        ...settingsDraft,
                                        secondaryBankDetails: {
                                          ...sec,
                                          accountNumber: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="10-digit NUBAN"
                                    className="w-full h-9 px-3 rounded border border-slate-300 bg-white font-mono-tabular font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-600 mb-1">
                                    Routing / Sort Code
                                  </label>
                                  <input
                                    value={sec.routingCode}
                                    onChange={(e) =>
                                      setSettingsDraft({
                                        ...settingsDraft,
                                        secondaryBankDetails: {
                                          ...sec,
                                          routingCode: e.target.value,
                                        },
                                      })
                                    }
                                    placeholder="Optional"
                                    className="w-full h-9 px-3 rounded border border-slate-300 bg-white font-mono-tabular"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                      {gatewaysDraft.map((gw, idx) => (
                        <div
                          key={gw.id}
                          className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-xs"
                        >
                          <div className="lg:col-span-4">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={gw.enabled}
                                onChange={(e) => {
                                  const next = [...gatewaysDraft];
                                  next[idx] = { ...gw, enabled: e.target.checked };
                                  setGatewaysDraft(next);
                                }}
                                className="w-4 h-4 accent-[#4CB04F]"
                              />
                              <div>
                                <p className="font-bold text-slate-900">{gw.name}</p>
                                <p className="text-[11px] text-slate-500">{gw.description}</p>
                              </div>
                            </div>
                          </div>

                          <div className="lg:col-span-4">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Public Key / Merchant Terminal ID
                            </label>
                            <input
                              value={gw.publicKey}
                              onChange={(e) => {
                                const next = [...gatewaysDraft];
                                next[idx] = { ...gw, publicKey: e.target.value };
                                setGatewaysDraft(next);
                              }}
                              className="w-full h-8 px-2.5 rounded border border-slate-300 font-mono-tabular text-[11px]"
                            />
                          </div>

                          <div className="lg:col-span-2">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Fee (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={gw.processingFeePercent}
                              onChange={(e) => {
                                const next = [...gatewaysDraft];
                                next[idx] = {
                                  ...gw,
                                  processingFeePercent: Number(e.target.value),
                                };
                                setGatewaysDraft(next);
                              }}
                              className="w-full h-8 px-2.5 rounded border border-slate-300 tabular-nums"
                            />
                          </div>

                          <div className="lg:col-span-2">
                            <label className="block text-[11px] text-slate-500 mb-1">Mode</label>
                            <select
                              value={gw.mode}
                              onChange={(e) => {
                                const next = [...gatewaysDraft];
                                next[idx] = {
                                  ...gw,
                                  mode: e.target.value === 'Test' ? 'Test' : 'Live',
                                };
                                setGatewaysDraft(next);
                              }}
                              className="w-full h-8 px-2 rounded border border-slate-300 bg-white"
                            >
                              <option value="Live">Live</option>
                              <option value="Test">Test</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-slate-900">
                        Live Payment Transactions Ledger
                      </h2>
                      <button
                        type="button"
                        onClick={exportTransactionsCsv}
                        className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="py-2.5 px-4 font-medium">Transaction Ref</th>
                            <th className="py-2.5 px-4 font-medium">Order #</th>
                            <th className="py-2.5 px-4 font-medium">Customer</th>
                            <th className="py-2.5 px-4 font-medium">Gateway</th>
                            <th className="py-2.5 px-4 font-medium text-right">Gross</th>
                            <th className="py-2.5 px-4 font-medium text-right">Net</th>
                            <th className="py-2.5 px-4 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.transactions.map((txn) => (
                            <tr key={txn.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono-tabular font-semibold text-slate-900">
                                {txn.transactionRef}
                              </td>
                              <td className="py-3 px-4 font-mono-tabular text-slate-600">
                                {txn.orderNumber}
                              </td>
                              <td className="py-3 px-4 text-slate-700">{txn.customerName}</td>
                              <td className="py-3 px-4 text-slate-600">
                                {txn.gatewayName} · {txn.mode}
                              </td>
                              <td className="py-3 px-4 text-right font-medium tabular-nums">
                                {formatNaira(txn.grossAmount, currency)}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                                {formatNaira(txn.netAmount, currency)}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${statusBadgeClass(
                                    txn.status
                                  )}`}
                                >
                                  {txn.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* FLASH SALES MANAGER TAB */}
              {activeTab === 'flash_sales' && settingsDraft && (
                <div className="space-y-6">
                  {/* Green Flash Sale Section Headings + Upload Dropzone */}
                  <div className="bg-[#4CB04F] text-white rounded-xl p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Homepage Green Flash Sales Carousel</span>
                        </span>
                        <h2 className="text-lg font-extrabold mt-2">
                          Upload &amp; Control Flash Sale Deals ({flashSaleProducts.length} Active)
                        </h2>
                        <p className="text-xs text-white/90 mt-0.5">
                          These products appear in the green animated section right before
                          &ldquo;Our Recent Product&rdquo; on the storefront.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(null);
                          setPrefillImageUrl(null);
                          setPrefillName(null);
                          setPrefillFlashSale(true);
                          setProductModalOpen(true);
                        }}
                        className="h-10 px-5 rounded-lg bg-[#151916] hover:bg-white hover:text-[#151916] text-white text-xs font-bold inline-flex items-center gap-2 transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Upload New Flash Sale Product</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white/10 p-4 rounded-lg text-xs">
                      <div className="md:col-span-4">
                        <label className="block font-semibold text-white/90 mb-1">
                          Flash Sales Section Title
                        </label>
                        <input
                          value={settingsDraft.flashSalesHeading || ''}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              flashSalesHeading: e.target.value,
                            })
                          }
                          className="w-full h-9 px-3 rounded bg-white text-[#151916] font-semibold"
                        />
                      </div>
                      <div className="md:col-span-6">
                        <label className="block font-semibold text-white/90 mb-1">
                          Flash Sales Subtitle
                        </label>
                        <input
                          value={settingsDraft.flashSalesSubheading || ''}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              flashSalesSubheading: e.target.value,
                            })
                          }
                          className="w-full h-9 px-3 rounded bg-white text-[#151916]"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <button
                          type="button"
                          onClick={() => handleSaveSettings()}
                          disabled={savingSettings}
                          className="w-full h-9 rounded bg-white text-[#235D25] font-bold hover:bg-[#151916] hover:text-white transition-colors"
                        >
                          {savingSettings ? 'Saving...' : 'Save Titles'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Drag & Drop directly to Flash Sales */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setFlashDragOver(true);
                    }}
                    onDragLeave={() => setFlashDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setFlashDragOver(false);
                      handleProductDropFiles(e.dataTransfer.files, true);
                    }}
                    className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                      flashDragOver
                        ? 'border-[#4CB04F] bg-[#EDF7EE]'
                        : 'border-slate-300 bg-white hover:border-[#4CB04F]'
                    }`}
                  >
                    <UploadCloud className="w-8 h-8 text-[#4CB04F] mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-900">
                      Drag &amp; Drop Image to Upload Directly into Flash Sales
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Drop a product image here to automatically mark it as a Flash Sale item.
                    </p>
                    <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4CB04F] text-white text-xs font-semibold cursor-pointer">
                      <span>Choose Flash Sale Product Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          handleProductDropFiles(e.target.files, true);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {/* All Products Flash Sale Quick Controls */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900">
                        Select Products for Green Flash Sales Strip &amp; Set Flash Sale Prices ({currency})
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {data.products.map((product) => (
                        <div
                          key={product.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={product.image}
                              alt={product.name}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded bg-slate-100 object-contain p-1 shrink-0"
                            />
                            <div>
                              <p className="font-bold text-slate-900">{product.name}</p>
                              <p className="text-slate-500">
                                Regular: {formatNaira(product.price, currency)} · SKU {product.sku}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500">Flash Price ({currency}):</span>
                              <input
                                type="number"
                                defaultValue={
                                  product.flashSalePrice || Math.round(product.price * 0.85)
                                }
                                onBlur={(e) => {
                                  const val = Number(e.target.value);
                                  if (val > 0 && val !== product.flashSalePrice) {
                                    handleUpdateFlashPrice(product, val);
                                  }
                                }}
                                className="w-28 h-8 px-2.5 rounded border border-slate-300 font-semibold tabular-nums"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleFlashSale(product)}
                              className={`h-8 px-3 rounded-md font-semibold border transition-colors ${
                                product.isFlashSale
                                  ? 'bg-[#4CB04F] text-white border-[#4CB04F]'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {product.isFlashSale ? '✓ In Flash Sales' : '+ Add to Flash Sales'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(product);
                                setPrefillImageUrl(null);
                                setPrefillName(null);
                                setPrefillFlashSale(Boolean(product.isFlashSale));
                                setProductModalOpen(true);
                              }}
                              className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              title="Edit Product & Image"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => promptDeleteProduct(product)}
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PRODUCTS TAB WITH DRAG & DROP */}
              {activeTab === 'products' && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setProductDragOver(true);
                    }}
                    onDragLeave={() => setProductDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setProductDragOver(false);
                      handleProductDropFiles(e.dataTransfer.files, false);
                    }}
                    className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                      productDragOver
                        ? 'border-[#4CB04F] bg-[#EDF7EE]'
                        : 'border-slate-300 bg-white hover:border-[#4CB04F]'
                    }`}
                  >
                    <UploadCloud className="w-8 h-8 text-[#4CB04F] mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-900">
                      {uploadingProductDrop
                        ? 'Uploading dropped product...'
                        : 'Drag & Drop Products Here'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Drop a product photo (.jpg, .png, .webp) to create a new product instantly, or
                      drop a <code className="font-mono-tabular">.json</code> catalog file to bulk
                      import items.
                    </p>
                    <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer">
                      <span>Browse Product File</span>
                      <input
                        type="file"
                        accept="image/*,.json"
                        className="hidden"
                        onChange={(e) => {
                          handleProductDropFiles(e.target.files, false);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Filter catalog by name, category, specs..."
                        className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-xs w-full sm:w-72 focus:outline-none focus:border-[#4CB04F]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setPrefillImageUrl(null);
                        setPrefillName(null);
                        setPrefillFlashSale(false);
                        setProductModalOpen(true);
                      }}
                      className="h-9 px-4 rounded-lg bg-[#4CB04F] hover:bg-[#419B44] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Solar / Electrical Product</span>
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="py-3 px-4 font-medium">Product</th>
                            <th className="py-3 px-4 font-medium">SKU</th>
                            <th className="py-3 px-4 font-medium">Category</th>
                            <th className="py-3 px-4 font-medium text-right">Price ({currency})</th>
                            <th className="py-3 px-4 font-medium text-center">Stock</th>
                            <th className="py-3 px-4 font-medium">Flash / Status</th>
                            <th className="py-3 px-4 font-medium text-right">Edit / Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredProducts.map((product) => (
                            <tr key={product.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded bg-slate-100 p-1 shrink-0">
                                    <img
                                      src={product.image}
                                      alt={product.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900">{product.name}</p>
                                    <p className="text-[11px] text-slate-500">{product.wattage}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 font-mono-tabular text-slate-600">
                                {product.sku}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">{product.category}</td>
                              <td className="py-2.5 px-4 text-right tabular-nums">
                                <span className="font-semibold text-slate-900">
                                  {formatNaira(product.price, currency)}
                                </span>
                                {product.isFlashSale && product.flashSalePrice && (
                                  <span className="block text-[11px] font-bold text-[#4CB04F]">
                                    Flash: {formatNaira(product.flashSalePrice, currency)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickStock(product, -1)}
                                    className="w-6 h-6 rounded border border-slate-200 hover:bg-slate-100 text-slate-700"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center font-semibold tabular-nums">
                                    {product.stock}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickStock(product, 1)}
                                    className="w-6 h-6 rounded border border-slate-200 hover:bg-slate-100 text-slate-700"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 space-y-1">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${statusBadgeClass(
                                    product.status
                                  )}`}
                                >
                                  {product.status}
                                </span>
                                {product.isFlashSale && (
                                  <span className="ml-1 inline-block px-1.5 py-0.5 rounded bg-[#EDF7EE] text-[#235D25] text-[10px] font-bold">
                                    FLASH
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingProduct(product);
                                      setPrefillImageUrl(null);
                                      setPrefillName(null);
                                      setPrefillFlashSale(Boolean(product.isFlashSale));
                                      setProductModalOpen(true);
                                    }}
                                    aria-label={`Edit ${product.name}`}
                                    className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => promptDeleteProduct(product)}
                                    aria-label={`Delete ${product.name}`}
                                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* GALLERY PAGE MEDIA TAB (IMAGES & VIDEOS WITH SPECIFICATIONS) */}
              {activeTab === 'about_media' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <form
                    onSubmit={handlePublishOrUpdateGalleryMedia}
                    className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs h-fit"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-slate-900">
                        {editingMediaId
                          ? 'Edit Gallery Image / Video'
                          : 'Post Image or Video to Gallery Page'}
                      </h2>
                      {editingMediaId && (
                        <button
                          type="button"
                          onClick={resetMediaForm}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setMediaDragOver(true);
                      }}
                      onDragLeave={() => setMediaDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setMediaDragOver(false);
                        handleAboutMediaDropFiles(e.dataTransfer.files);
                      }}
                      className={`rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
                        mediaDragOver
                          ? 'border-[#4CB04F] bg-[#EDF7EE]'
                          : 'border-slate-300 hover:border-[#4CB04F]'
                      }`}
                    >
                      <UploadCloud className="w-7 h-7 text-[#4CB04F] mx-auto mb-1.5" />
                      <p className="font-semibold text-slate-800">
                        {uploadingMedia
                          ? mediaUploadProgress || 'Uploading media...'
                          : 'Drag & Drop 1 or Multiple Images/Videos (.jpg, .png, .mp4, .webm)'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Select multiple photos to auto-publish them all at once, or 1 file to customize title &amp; specs first.
                      </p>
                      <label className="mt-2.5 inline-block px-3.5 py-1.5 rounded bg-slate-900 text-white font-semibold cursor-pointer">
                        <span>{uploadingMedia ? 'Uploading...' : 'Choose Image(s) / Video'}</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          disabled={uploadingMedia}
                          className="hidden"
                          onChange={(e) => {
                            handleAboutMediaDropFiles(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    {mediaUrl.trim() && (
                      <div className="rounded-lg border border-emerald-200 bg-[#EDF7EE]/60 p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-[#235D25]">
                          <span>Ready Preview</span>
                          <button
                            type="button"
                            onClick={() => setMediaUrl('')}
                            className="text-slate-500 hover:text-red-600"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="aspect-video rounded overflow-hidden bg-slate-100 border border-slate-200">
                          {mediaType === 'video' ? (
                            <video src={mediaUrl} controls className="w-full h-full object-contain" />
                          ) : (
                            <img
                              src={mediaUrl}
                              alt={mediaTitle || 'Uploaded gallery preview'}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                            />
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 mb-1">Media Type</label>
                        <select
                          value={mediaType}
                          onChange={(e) =>
                            setMediaType(e.target.value === 'video' ? 'video' : 'image')
                          }
                          className="w-full h-9 px-2.5 rounded border border-slate-300 bg-white"
                        >
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Gallery Category</label>
                        <select
                          value={mediaCategory}
                          onChange={(e) =>
                            setMediaCategory(e.target.value as AboutMediaItem['category'])
                          }
                          className="w-full h-9 px-2.5 rounded border border-slate-300 bg-white"
                        >
                          <option value="Solar Installation">Solar Installation</option>
                          <option value="Electrical Store">Electrical Store</option>
                          <option value="Team & Showroom">Team &amp; Showroom</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1">Media File URL *</label>
                      <input
                        required
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="/uploads/... or https://..."
                        className="w-full h-9 px-3 rounded border border-slate-300 font-mono-tabular"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1">Title *</label>
                      <input
                        required
                        value={mediaTitle}
                        onChange={(e) => setMediaTitle(e.target.value)}
                        placeholder="e.g. 10kVA Solar Installation at Ankpa"
                        className="w-full h-9 px-3 rounded border border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1">
                        System / Product Specifications *
                      </label>
                      <input
                        value={mediaSpecifications}
                        onChange={(e) => setMediaSpecifications(e.target.value)}
                        placeholder="e.g. 10kVA Hybrid Inverter · 16x 550W Panels · 48V 200Ah Lithium"
                        className="w-full h-9 px-3 rounded border border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 mb-1">Caption / Details</label>
                      <textarea
                        rows={2}
                        value={mediaCaption}
                        onChange={(e) => setMediaCaption(e.target.value)}
                        placeholder="Project summary or electrical stock overview..."
                        className="w-full p-2.5 rounded border border-slate-300"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingMedia || uploadingMedia}
                      className="w-full h-10 rounded-lg bg-[#4CB04F] hover:bg-[#419B44] disabled:bg-slate-400 text-white font-semibold"
                    >
                      {savingMedia
                        ? 'Saving to Gallery...'
                        : editingMediaId
                        ? 'Save Gallery Changes'
                        : 'Publish to Gallery Page'}
                    </button>
                  </form>

                  <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <h2 className="text-sm font-bold text-slate-900">
                      Published Gallery Media ({data.aboutMedia.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {data.aboutMedia.map((item) => (
                        <div
                          key={item.id}
                          className="border border-slate-200 rounded-lg overflow-hidden flex flex-col"
                        >
                          <div className="aspect-[4/3] bg-slate-100 relative">
                            {item.type === 'video' ? (
                              <video
                                src={item.url}
                                controls
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={item.url}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const fallback = '/src/assets/images/about_solar_engineer_1795501703000.jpg';
                                  if (!e.currentTarget.src.endsWith(fallback)) {
                                    e.currentTarget.src = fallback;
                                  }
                                }}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-semibold inline-flex items-center gap-1">
                              {item.type === 'video' ? (
                                <Video className="w-3 h-3" />
                              ) : (
                                <ImageIcon className="w-3 h-3" />
                              )}
                              {item.type.toUpperCase()}
                            </span>
                          </div>
                          <div className="p-3.5 text-xs flex-1 flex flex-col justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-semibold text-[#4CB04F]">
                                {item.category}
                              </p>
                              <p className="font-bold text-slate-900 mt-0.5">{item.title}</p>
                              {item.specifications && (
                                <p className="text-[11px] font-medium text-[#235D25] bg-[#EDF7EE] rounded px-2 py-1 mt-1.5">
                                  Specs: {item.specifications}
                                </p>
                              )}
                              <p className="text-slate-500 mt-1 line-clamp-2">{item.caption}</p>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleToggleAboutMedia(item)}
                                className={`px-2 py-0.5 rounded border text-[11px] font-medium ${
                                  item.active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {item.active ? 'Visible' : 'Hidden'}
                              </button>
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEditMediaItem(item)}
                                  className="text-slate-500 hover:text-slate-900 p-1"
                                  title="Edit media item & specifications"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => promptDeleteAboutMedia(item)}
                                  className="text-slate-400 hover:text-red-600 p-1"
                                  title="Delete media item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PROMOTIONS & AFTER-HERO PRODUCT CARDS TAB */}
              {activeTab === 'promotions' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          After-Hero Showcase Cards (Right Under Hero Image)
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Upload your own images onto any card below or post a new product directly
                          to this homepage section.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openNewProductModal()}
                          className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Package className="w-3.5 h-3.5 text-[#4CB04F]" />
                          <span>Post New Product</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingBanner(true);
                            setEditingBanner({
                              id: 'new',
                              badgeText: 'New Product',
                              badgeTone: 'green',
                              title: '',
                              productId: data.products[0]?.id || '',
                              image: AVAILABLE_IMAGES[0].url,
                              ctaLabel: 'Buy Now',
                              active: true,
                            });
                          }}
                          className="h-9 px-3 rounded-lg bg-[#4CB04F] hover:bg-[#419B44] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Card Slot</span>
                        </button>
                      </div>
                    </div>

                    {/* Drag & drop zone to create a new after-hero card */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setAfterHeroDragOver(true);
                      }}
                      onDragLeave={() => setAfterHeroDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleAfterHeroNewProductDrop(e.dataTransfer.files);
                      }}
                      className={`border-2 border-dashed rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors ${
                        afterHeroDragOver
                          ? 'border-[#4CB04F] bg-[#EDF7EE]'
                          : 'border-slate-300 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <UploadCloud className="w-7 h-7 text-[#4CB04F] shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {afterHeroDropBusy
                              ? 'Uploading image...'
                              : 'Drag & drop an image here to add a new After-Hero Product Card'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            JPG, PNG, or WEBP — instantly creates a new showcase card right below
                            the Hero section
                          </p>
                        </div>
                      </div>
                      <label className="px-3.5 py-2 rounded-lg bg-[#4CB04F] hover:bg-[#419B44] text-white text-xs font-semibold cursor-pointer whitespace-nowrap">
                        <span>Upload New Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            handleAfterHeroNewProductDrop(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {data.banners.map((banner) => (
                        <div
                          key={banner.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDirectCardImageDrop(banner, e.dataTransfer.files);
                          }}
                          className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3 hover:border-[#4CB04F]/60 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span
                                className={`text-[11px] font-bold ${
                                  banner.badgeTone === 'red' ? 'text-red-600' : 'text-[#4CB04F]'
                                }`}
                              >
                                {banner.badgeText}
                              </span>
                              <p className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2">
                                {banner.title}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-1">
                                {banner.active ? 'Visible after Hero' : 'Hidden'}
                              </p>
                            </div>
                            <div className="relative w-16 h-16 shrink-0 rounded bg-slate-50 border border-slate-200 p-1 flex items-center justify-center">
                              <img
                                src={banner.image}
                                alt={banner.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                              />
                              {uploadingBannerCardId === banner.id && (
                                <span className="absolute inset-0 bg-white/80 text-[10px] font-bold text-[#4CB04F] flex items-center justify-center rounded">
                                  Saving...
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <label className="flex-1 h-8 rounded bg-[#EDF7EE] hover:bg-[#DFF1E0] border border-[#4CB04F]/30 text-[#235D25] text-[11px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer">
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>Upload Image</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  handleDirectCardImageDrop(banner, e.target.files);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingBanner(false);
                                setEditingBanner(banner);
                              }}
                              className="h-8 px-2.5 rounded border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => promptDeleteBanner(banner)}
                              aria-label={`Delete ${banner.title}`}
                              className="h-8 w-8 rounded border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center justify-center shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                    <h2 className="text-sm font-bold text-slate-900">Checkout Promo Codes</h2>
                    <form onSubmit={handleCreateCoupon} className="grid grid-cols-2 gap-2.5 text-xs">
                      <input
                        required
                        value={newCouponCode}
                        onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                        placeholder="CODE (e.g. SUN20)"
                        className="h-9 px-3 rounded border border-slate-300 font-mono-tabular uppercase"
                      />
                      <select
                        value={newCouponType}
                        onChange={(e) =>
                          setNewCouponType(e.target.value === 'fixed' ? 'fixed' : 'percent')
                        }
                        className="h-9 px-2.5 rounded border border-slate-300 bg-white"
                      >
                        <option value="percent">Percent (%)</option>
                        <option value="fixed">Fixed ({currency})</option>
                      </select>
                      <input
                        type="number"
                        required
                        min={1}
                        value={newCouponValue}
                        onChange={(e) => setNewCouponValue(e.target.value)}
                        placeholder="Discount Value"
                        className="h-9 px-3 rounded border border-slate-300 tabular-nums"
                      />
                      <input
                        type="number"
                        required
                        min={0}
                        value={newCouponMin}
                        onChange={(e) => setNewCouponMin(e.target.value)}
                        placeholder="Min Spend"
                        className="h-9 px-3 rounded border border-slate-300 tabular-nums"
                      />
                      <button
                        type="submit"
                        className="col-span-2 h-9 rounded bg-[#4CB04F] hover:bg-[#419B44] text-white font-semibold"
                      >
                        Create Promo Code
                      </button>
                    </form>

                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                      {data.coupons.map((c) => (
                        <div
                          key={c.id}
                          className="py-3 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-mono-tabular font-bold text-slate-900">
                              {c.code}
                            </span>
                            <span className="text-slate-500 ml-2">
                              {c.type === 'percent'
                                ? `${c.value}% off`
                                : `${formatNaira(c.value, currency)} off`}
                              {' · '}Min {formatNaira(c.minOrderAmount, currency)}
                            </span>
                            <p className="text-[11px] text-slate-400">
                              Used {c.usageCount} time(s)
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCoupon(c.id, !c.active)}
                              className={`px-2 py-1 rounded border text-[11px] font-medium ${
                                c.active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {c.active ? 'Active' : 'Paused'}
                            </button>
                            <button
                              type="button"
                              onClick={() => promptDeleteCoupon(c.id, c.code)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="Delete coupon"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CUSTOMERS, ACCOUNTS & QUOTES TAB */}
              {activeTab === 'customers' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-[#4CB04F]" />
                          <span>
                            Registered Customer Accounts &amp; Verification Codes
                          </span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Reset codes expire in 1 minute and automatically regenerate starting from{' '}
                          <code className="font-mono-tabular">EXP1001</code>.
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="py-2.5 px-4 font-medium">Customer</th>
                            <th className="py-2.5 px-4 font-medium">WhatsApp Phone</th>
                            <th className="py-2.5 px-4 font-medium">Initial Code</th>
                            <th className="py-2.5 px-4 font-medium">Current / Reset Code</th>
                            <th className="py-2.5 px-4 font-medium">Code Status (1m Expiry)</th>
                            <th className="py-2.5 px-4 font-medium text-right">
                              WhatsApp &amp; Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.customers.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-500">
                                No registered customer accounts yet.
                              </td>
                            </tr>
                          ) : (
                            data.customers.map((cust) => {
                              const secs =
                                cust.resetCodeStatus === 'Active' && cust.resetCodeExpiresAt
                                  ? Math.max(
                                      0,
                                      Math.ceil(
                                        (new Date(cust.resetCodeExpiresAt).getTime() - nowTick) /
                                          1000
                                      )
                                    )
                                  : 0;
                              const phoneDigits = cust.phone.replace(/\D/g, '');
                              const displayCode = cust.activeResetCode || cust.initialCode;
                              return (
                                <tr key={cust.id} className="hover:bg-slate-50">
                                  <td className="py-3 px-4">
                                    <p className="font-semibold text-slate-900">{cust.fullName}</p>
                                    <p className="text-[11px] text-slate-500">{cust.email}</p>
                                  </td>
                                  <td className="py-3 px-4 font-mono-tabular text-slate-700">
                                    {cust.phone}
                                  </td>
                                  <td className="py-3 px-4 font-mono-tabular font-bold text-slate-900">
                                    {cust.initialCode}
                                  </td>
                                  <td className="py-3 px-4 font-mono-tabular font-bold text-[#235D25]">
                                    {cust.activeResetCode || 'Used'}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium tabular-nums ${statusBadgeClass(
                                        cust.resetCodeStatus
                                      )}`}
                                    >
                                      {cust.resetCodeStatus === 'Active'
                                        ? `Active (${secs}s left)`
                                        : cust.resetCodeStatus}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      <a
                                        href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(
                                          `Hello ${cust.fullName}, your ${data.settings.storeName} verification code is ${displayCode}. It expires in 1 minute.`
                                        )}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2.5 py-1 rounded bg-[#4CB04F] hover:bg-[#419B44] text-white font-semibold inline-flex items-center gap-1"
                                      >
                                        <MessageCircle className="w-3 h-3" />
                                        <span>WhatsApp Code</span>
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleRegenerateCustomerCode(cust.id)}
                                        className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium"
                                      >
                                        New EXP Code
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => promptDeleteCustomer(cust)}
                                        title="Delete Customer Account"
                                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Quote & Solar Installation Inquiries */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h2 className="text-sm font-bold text-slate-900">
                        Solar Installation &amp; Wholesale Quote Requests ({data.inquiries.length})
                      </h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {data.inquiries.map((inq) => (
                        <div
                          key={inq.id}
                          className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900">{inq.name}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-[#4CB04F] font-semibold">
                                {inq.serviceType}
                              </span>
                            </div>
                            <p className="text-slate-600">{inq.message}</p>
                            {(inq.propertyLocation || inq.estimatedLoad) && (
                              <p className="text-[11px] text-slate-500">
                                {inq.propertyLocation ? `Location: ${inq.propertyLocation}` : ''}{' '}
                                {inq.estimatedLoad ? `· Load: ${inq.estimatedLoad}` : ''}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-400">
                              {inq.email} {inq.phone ? `· ${inq.phone}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={inq.status}
                              onChange={(e) =>
                                handleUpdateInquiryStatus(
                                  inq.id,
                                  e.target.value as 'New' | 'Contacted' | 'Scheduled'
                                )
                              }
                              className="h-8 px-2.5 rounded border border-slate-300 bg-white font-medium"
                            >
                              <option value="New">New</option>
                              <option value="Contacted">Contacted</option>
                              <option value="Scheduled">Scheduled</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => promptDeleteInquiry(inq)}
                              title="Delete Quote Request"
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Customer Directory */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h2 className="text-sm font-bold text-slate-900">
                        Storefront Buyer Directory ({aggregatedCustomers.length})
                      </h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="py-2.5 px-4 font-medium">Customer</th>
                            <th className="py-2.5 px-4 font-medium">Phone</th>
                            <th className="py-2.5 px-4 font-medium">Location</th>
                            <th className="py-2.5 px-4 font-medium text-right">Orders</th>
                            <th className="py-2.5 px-4 font-medium text-right">Lifetime Spend</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aggregatedCustomers.map((cust) => (
                            <tr key={`${cust.phone}-${cust.email}`} className="hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <p className="font-semibold text-slate-900">{cust.name}</p>
                                <p className="text-[11px] text-slate-500">{cust.email}</p>
                              </td>
                              <td className="py-3 px-4 text-slate-600">{cust.phone}</td>
                              <td className="py-3 px-4 text-slate-600">{cust.city}</td>
                              <td className="py-3 px-4 text-right tabular-nums">
                                {cust.ordersCount}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold tabular-nums">
                                {formatNaira(cust.totalSpent, currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* GLOBAL WHATSAPP & STORE SETTINGS TAB */}
              {activeTab === 'settings' && settingsDraft && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <form
                    onSubmit={handleSaveSettings}
                    className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-slate-900">
                        Global WhatsApp Number, Delivery &amp; Business Profile
                      </h2>
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="h-9 px-4 rounded-lg bg-[#4CB04F] hover:bg-[#419B44] text-white font-semibold"
                      >
                        {savingSettings ? 'Saving...' : 'Save Global Settings'}
                      </button>
                    </div>

                    {/* Highlighted Global WhatsApp Box */}
                    <div className="p-4 rounded-lg bg-[#EDF7EE] border border-[#4CB04F]/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-[#151916] mb-1">
                          Global Website WhatsApp Number *
                        </label>
                        <input
                          required
                          value={settingsDraft.whatsappNumber}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              whatsappNumber: e.target.value,
                              supportPhone: e.target.value,
                            })
                          }
                          placeholder="+234 816 385 5656"
                          className="w-full h-9 px-3 rounded border border-slate-300 bg-white font-mono-tabular font-bold"
                        />
                        <p className="text-[11px] text-[#235D25] mt-1">
                          Updating this reflects across the entire website: header/footer links,
                          checkout payment confirmation WhatsApp message, and contact buttons.
                        </p>
                      </div>
                      <div>
                        <label className="block font-bold text-[#151916] mb-1">
                          Nationwide Delivery Fee ({settingsDraft.currencySymbol || '₦'})
                        </label>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={settingsDraft.flatShippingFee}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              flatShippingFee: Number(e.target.value),
                            })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300 bg-white tabular-nums font-bold"
                        />
                        <p className="text-[11px] text-[#235D25] mt-1">
                          Applied automatically in Cart &amp; Checkout.
                        </p>
                      </div>
                    </div>

                    {/* Editable Homepage Hero & Make Solar Energy Accessible Images */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Homepage Hero &amp; &ldquo;Make Solar Energy Accessible&rdquo; Images
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Drag &amp; drop an image file or paste an image URL to update either
                            homepage photo while preserving the exact layout &amp; background.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('payments')}
                          className="text-[11px] font-semibold text-[#235D25] hover:underline"
                        >
                          Edit 2 Normal Bank Accounts &rarr;
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Hero Image Editor */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setSlotDragOver('hero');
                          }}
                          onDragLeave={() => setSlotDragOver(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setSlotDragOver(null);
                            handleSettingsImageDrop('hero', e.dataTransfer.files);
                          }}
                          className={`p-3.5 rounded-lg border-2 border-dashed transition-colors bg-white space-y-3 ${
                            slotDragOver === 'hero'
                              ? 'border-[#4CB04F] bg-[#EDF7EE]'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">
                              1. Hero Section Image
                            </span>
                            <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#4CB04F] hover:bg-[#419B44] text-white text-[11px] font-semibold cursor-pointer">
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>
                                {uploadingSlotImg === 'hero' ? 'Uploading...' : 'Upload'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  handleSettingsImageDrop('hero', e.target.files);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                          <div className="h-36 rounded-lg bg-[#F3F5F4] overflow-hidden border border-slate-200 flex items-center justify-center">
                            {settingsDraft.heroImageUrl ? (
                              <img
                                src={settingsDraft.heroImageUrl}
                                alt="Homepage Hero Preview"
                                className="w-full h-full object-cover object-center"
                              />
                            ) : (
                              <span className="text-slate-400 text-[11px]">No hero image URL</span>
                            )}
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Hero Image URL (or drag image above)
                            </label>
                            <input
                              value={settingsDraft.heroImageUrl || ''}
                              onChange={(e) =>
                                setSettingsDraft({
                                  ...settingsDraft,
                                  heroImageUrl: e.target.value,
                                })
                              }
                              placeholder="https://..."
                              className="w-full h-8 px-2.5 rounded border border-slate-300 text-[11px] font-mono-tabular"
                            />
                          </div>
                        </div>

                        {/* Mission / Make Solar Energy Accessible Image Editor */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setSlotDragOver('mission');
                          }}
                          onDragLeave={() => setSlotDragOver(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setSlotDragOver(null);
                            handleSettingsImageDrop('mission', e.dataTransfer.files);
                          }}
                          className={`p-3.5 rounded-lg border-2 border-dashed transition-colors bg-white space-y-3 ${
                            slotDragOver === 'mission'
                              ? 'border-[#4CB04F] bg-[#EDF7EE]'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">
                              2. &ldquo;Make Solar Energy Accessible&rdquo; Image
                            </span>
                            <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#4CB04F] hover:bg-[#419B44] text-white text-[11px] font-semibold cursor-pointer">
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>
                                {uploadingSlotImg === 'mission' ? 'Uploading...' : 'Upload'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  handleSettingsImageDrop('mission', e.target.files);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                          <div className="h-36 rounded-lg bg-[#EDF7EE] overflow-hidden border border-slate-200 flex items-center justify-center">
                            {settingsDraft.missionImageUrl ? (
                              <img
                                src={settingsDraft.missionImageUrl}
                                alt="Mission Section Preview"
                                className="w-full h-full object-cover object-top"
                              />
                            ) : (
                              <span className="text-slate-400 text-[11px]">
                                No mission image URL
                              </span>
                            )}
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-600 mb-1">
                              Mission Image URL (or drag image above)
                            </label>
                            <input
                              value={settingsDraft.missionImageUrl || ''}
                              onChange={(e) =>
                                setSettingsDraft({
                                  ...settingsDraft,
                                  missionImageUrl: e.target.value,
                                })
                              }
                              placeholder="https://..."
                              className="w-full h-8 px-2.5 rounded border border-slate-300 text-[11px] font-mono-tabular"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-600 mb-1">Business Name</label>
                        <input
                          value={settingsDraft.storeName}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, storeName: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Currency Symbol</label>
                        <input
                          value={settingsDraft.currencySymbol}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, currencySymbol: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-slate-600 mb-1">Business Category</label>
                        <input
                          value={settingsDraft.businessCategory}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, businessCategory: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Support Email</label>
                        <input
                          value={settingsDraft.supportEmail}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, supportEmail: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Business Hours</label>
                        <input
                          value={settingsDraft.businessHours}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, businessHours: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-slate-600 mb-1">Location &amp; Landmark</label>
                        <input
                          value={settingsDraft.address}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              address: e.target.value,
                              landmark: e.target.value,
                            })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Hero Main Heading</label>
                        <input
                          value={settingsDraft.heroHeading}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, heroHeading: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Hero Subheading</label>
                        <input
                          value={settingsDraft.heroSubheading}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, heroSubheading: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-slate-600 mb-1">About Us Heading</label>
                        <input
                          value={settingsDraft.aboutHeading}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, aboutHeading: e.target.value })
                          }
                          className="w-full h-9 px-3 rounded border border-slate-300"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-slate-600 mb-1">Business Description</label>
                        <textarea
                          rows={3}
                          value={settingsDraft.aboutDescription}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              aboutDescription: e.target.value,
                            })
                          }
                          className="w-full p-2.5 rounded border border-slate-300"
                        />
                      </div>
                    </div>
                  </form>

                  <div className="lg:col-span-4 space-y-5 h-fit">
                    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs">
                      <h2 className="text-sm font-bold text-slate-900">Admin Security</h2>
                      {authStatus.envManaged ? (
                        <p className="text-slate-600 leading-relaxed">
                          Admin passcode is managed via the server{' '}
                          <code className="font-mono-tabular bg-slate-100 px-1 rounded">
                            ADMIN_PASSCODE
                          </code>{' '}
                          environment variable.
                        </p>
                      ) : (
                        <form onSubmit={handleChangePasscode} className="space-y-3">
                          <div>
                            <label className="block text-slate-600 mb-1">Current Passcode</label>
                            <input
                              type="password"
                              required
                              value={currentPass}
                              onChange={(e) => setCurrentPass(e.target.value)}
                              className="w-full h-9 px-3 rounded border border-slate-300"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 mb-1">New Passcode (6+ chars)</label>
                            <input
                              type="password"
                              required
                              minLength={6}
                              value={nextPass}
                              onChange={(e) => setNextPass(e.target.value)}
                              className="w-full h-9 px-3 rounded border border-slate-300"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full h-9 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                          >
                            Update Passcode
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Global Supabase Database Connection Status */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-bold text-slate-900">
                          Global Supabase Database
                        </h2>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            supabaseInfo?.connected
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : supabaseInfo?.configured
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {supabaseInfo?.connected
                            ? 'Connected Globally'
                            : supabaseInfo?.configured
                            ? 'Pending Schema'
                            : 'Secrets Needed'}
                        </span>
                      </div>

                      {supabaseInfo?.connected ? (
                        <div className="p-3 rounded-lg bg-[#EDF7EE] border border-[#4CB04F]/35 space-y-1 text-[11px] text-[#235D25]">
                          <p className="font-bold">
                            Live sync active with {supabaseInfo.urlHost}
                          </p>
                          {supabaseInfo.lastSyncAt && (
                            <p className="text-[10px] opacity-90">
                              Last synced: {new Date(supabaseInfo.lastSyncAt).toLocaleString()}
                            </p>
                          )}
                          {supabaseInfo.counts && (
                            <p className="text-[10px] opacity-90 pt-0.5">
                              Synced: {supabaseInfo.counts.products} products · {supabaseInfo.counts.gallery} gallery items · {supabaseInfo.counts.banners} promo cards
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2.5 text-[11px] text-slate-600 leading-relaxed">
                          <p>
                            To keep AI Studio and Netlify synced globally, open{' '}
                            <strong className="text-slate-900">Settings &rarr; Secrets</strong> (and Netlify Environment Variables) and add matching values for:
                          </p>
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono-tabular text-[11px] text-slate-800 space-y-1">
                            <div>
                              <span className="font-bold">SUPABASE_URL</span> = https://your-project.supabase.co
                            </div>
                            <div>
                              <span className="font-bold">SUPABASE_SERVICE_ROLE_KEY</span> = your-secret-key
                            </div>
                            <div>
                              <span className="font-bold">ADMIN_PASSCODE</span> = your-admin-password
                            </div>
                            <div>
                              <span className="font-bold">SESSION_SECRET</span> = random-32char-secret
                            </div>
                          </div>
                        </div>
                      )}

                      {supabaseInfo?.envStatus && (
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          {[
                            { label: 'SUPABASE_URL', ok: supabaseInfo.envStatus.supabaseUrl },
                            { label: 'SERVICE_ROLE_KEY', ok: supabaseInfo.envStatus.supabaseServiceKey },
                            { label: 'ADMIN_PASSCODE', ok: supabaseInfo.envStatus.adminPasscodeEnv },
                            { label: 'SESSION_SECRET', ok: supabaseInfo.envStatus.sessionSecret },
                          ].map((envItem) => (
                            <div
                              key={envItem.label}
                              className={`px-2 py-1 rounded border font-mono-tabular flex items-center justify-between ${
                                envItem.ok
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                  : 'bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              <span className="truncate">{envItem.label}</span>
                              <span className="font-bold">{envItem.ok ? 'SET' : 'UNSET'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {supabaseInfo?.lastError && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                          {supabaseInfo.lastError}
                        </p>
                      )}

                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(
                              'SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\nADMIN_PASSCODE=\nSESSION_SECRET='
                            );
                            notify('Copied Netlify / AI Studio environment variable template.');
                          }}
                          className="w-full h-8 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold"
                        >
                          Copy Env Variable Template
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={pullingSupabase || syncingSupabase}
                            onClick={async () => {
                              setPullingSupabase(true);
                              try {
                                const r = await fetch('/api/admin/supabase-pull', {
                                  method: 'POST',
                                  headers: authHeaders,
                                });
                                const j = await parseJsonResponseSafe<{
                                  error?: string;
                                  status?: typeof supabaseInfo;
                                }>(r);
                                if (j.status) setSupabaseInfo(j.status);
                                if (!r.ok) {
                                  notify(j.error || 'Could not pull latest state from Supabase.', 'error');
                                } else {
                                  await loadDashboard();
                                  onStorefrontSync();
                                  notify('Pulled latest store & gallery data from Supabase!');
                                }
                              } catch {
                                notify('Network error pulling from Supabase.', 'error');
                              } finally {
                                setPullingSupabase(false);
                              }
                            }}
                            className="h-9 rounded border border-[#4CB04F] text-[#235D25] hover:bg-[#EDF7EE] font-semibold text-[11px]"
                          >
                            {pullingSupabase ? 'Pulling...' : 'Pull from Cloud'}
                          </button>
                          <button
                            type="button"
                            disabled={syncingSupabase || pullingSupabase}
                            onClick={async () => {
                              setSyncingSupabase(true);
                              try {
                                const r = await fetch('/api/admin/supabase-sync', {
                                  method: 'POST',
                                  headers: authHeaders,
                                });
                                const j = await parseJsonResponseSafe<{
                                  error?: string;
                                  status?: typeof supabaseInfo;
                                }>(r);
                                if (j.status) setSupabaseInfo(j.status);
                                if (!r.ok) {
                                  notify(j.error || 'Supabase sync pending.', 'error');
                                } else {
                                  await loadDashboard();
                                  onStorefrontSync();
                                  notify('Synced store & gallery media to Supabase globally!');
                                }
                              } catch {
                                notify('Network error checking Supabase.', 'error');
                              } finally {
                                setSyncingSupabase(false);
                              }
                            }}
                            className="h-9 rounded bg-[#4CB04F] hover:bg-[#419B44] text-white font-semibold text-[11px]"
                          >
                            {syncingSupabase ? 'Syncing...' : 'Push & Verify Sync'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Danger Zone — Clear Store Activity & Records (Fresh Start) */}
                    <div className="bg-white border border-red-200 rounded-xl p-6 space-y-3 text-xs">
                      <h2 className="text-sm font-bold text-red-600">Danger Zone — Clear Activity Records (Fresh Start)</h2>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Permanently clear all sales, customer orders, transactions, inquiries, and customer accounts across local storage and your global Supabase database while keeping all 15 catalog products intact.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDelete({
                            title: 'Clear Store Records & Start Fresh?',
                            message: 'Are you sure you want to clear all sales, orders, transactions, customer accounts, and inquiries? All 15 products in your catalog will stay intact so you have a clean slate.',
                            onConfirm: async () => {
                              const r = await fetch('/api/admin/reset-data', {
                                method: 'POST',
                                headers: authHeaders,
                              });
                              if (r.ok) {
                                await loadDashboard();
                                onStorefrontSync();
                                notify('All orders, sales, customer accounts, and inquiries cleared. Products preserved.');
                              } else {
                                notify('Failed to clear store records.', 'error');
                              }
                            },
                          });
                        }}
                        className="w-full h-9 rounded bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                      >
                        Clear All Records &amp; Sales (Keep Products Fresh)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ORDER INSPECTOR, RECEIPT VIEWER & LIVE TRACKING DRAWER */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#EDF7EE] text-[#235D25] font-mono-tabular text-xs font-extrabold">
                    {selectedOrder.trackingNumber}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 font-mono-tabular">
                    {selectedOrder.orderNumber}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  TXN {selectedOrder.transactionId} ·{' '}
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Quick Payment & Fulfillment Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1 font-medium">Payment Status</label>
                  <select
                    value={selectedOrder.paymentStatus}
                    onChange={(e) =>
                      handleOrderUpdate(selectedOrder.id, {
                        paymentStatus: e.target.value as PaymentStatus,
                      })
                    }
                    className="w-full h-9 px-2.5 rounded border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Pending Verification">Pending Verification</option>
                    <option value="Paid">Paid (Verified)</option>
                    <option value="COD Pending">COD Pending</option>
                    <option value="Failed">Failed</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-medium">Fulfillment Status</label>
                  <select
                    value={selectedOrder.orderStatus}
                    onChange={(e) =>
                      handleOrderUpdate(selectedOrder.id, {
                        orderStatus: e.target.value as OrderStatus,
                      })
                    }
                    className="w-full h-9 px-2.5 rounded border border-slate-300 bg-white font-semibold"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
              </div>

              {/* Uploaded Payment Receipt Preview */}
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#4CB04F]" />
                    <span>Uploaded Payment Receipt</span>
                  </span>
                  {selectedOrder.receiptUrl && (
                    <a
                      href={selectedOrder.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#235D25] font-semibold hover:underline"
                    >
                      <span>Open Full Receipt</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {selectedOrder.receiptUrl ? (
                  selectedOrder.receiptUrl.toLowerCase().endsWith('.pdf') ? (
                    <div className="p-3 bg-white rounded border border-slate-200 flex items-center justify-between">
                      <span className="font-mono-tabular text-slate-700">PDF Payment Receipt</span>
                      <a
                        href={selectedOrder.receiptUrl}
                        download
                        className="px-3 py-1.5 rounded bg-[#4CB04F] text-white font-semibold"
                      >
                        Download PDF
                      </a>
                    </div>
                  ) : (
                    <img
                      src={selectedOrder.receiptUrl}
                      alt="Uploaded Transfer Receipt"
                      className="max-h-52 w-full object-contain rounded border border-slate-200 bg-white"
                    />
                  )
                ) : (
                  <p className="text-slate-500">
                    No bank transfer receipt uploaded for this order ({selectedOrder.paymentMethodName}).
                  </p>
                )}
              </div>

              {/* Customer Nigerian Destination */}
              <div className="p-4 rounded-lg border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#4CB04F]" />
                  <span>{selectedOrder.customer.fullName}</span>
                </p>
                <p className="text-slate-700 font-semibold">
                  WhatsApp: {selectedOrder.customer.phone} · {selectedOrder.customer.email}
                </p>
                <p className="text-slate-700 pt-1">
                  <strong>State:</strong> {selectedOrder.customer.state || 'Kogi'} ·{' '}
                  <strong>LGA:</strong> {selectedOrder.customer.lga || selectedOrder.customer.city}
                </p>
                <p className="text-slate-700">
                  <strong>Park / Hub:</strong> {selectedOrder.customer.park || 'Store Pickup'}
                </p>
                <p className="text-slate-600">{selectedOrder.customer.address}</p>
                {selectedOrder.notes && (
                  <p className="pt-2 text-slate-500 italic">Note: {selectedOrder.notes}</p>
                )}
              </div>

              {/* Live Tracking Functions & Stage Controller */}
              <form
                onSubmit={handleSaveTrackingDetails}
                className="p-4 rounded-lg border border-[#4CB04F]/40 bg-[#EDF7EE]/50 space-y-3"
              >
                <div className="flex items-center gap-2 font-bold text-[#151916]">
                  <Truck className="w-4 h-4 text-[#4CB04F]" />
                  <span>Update Customer Order Tracking ({selectedOrder.trackingNumber})</span>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1 font-medium">
                    Current Tracking Stage
                  </label>
                  <select
                    value={trkStageDraft}
                    onChange={(e) => setTrkStageDraft(e.target.value as TrackingStage)}
                    className="w-full h-9 px-2.5 rounded border border-slate-300 bg-white font-semibold"
                  >
                    {TRACKING_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-600 mb-1">Current Hub / Location</label>
                    <input
                      value={trkLocationDraft}
                      onChange={(e) => setTrkLocationDraft(e.target.value)}
                      placeholder="e.g. Lokoja Motor Park"
                      className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Estimated Arrival</label>
                    <input
                      value={trkEtaDraft}
                      onChange={(e) => setTrkEtaDraft(e.target.value)}
                      placeholder="e.g. Tomorrow 2:00 PM"
                      className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">
                    Waybill # / Driver Name &amp; Phone
                  </label>
                  <input
                    value={trkWaybillDraft}
                    onChange={(e) => setTrkWaybillDraft(e.target.value)}
                    placeholder="e.g. GIGL Waybill #WB-8421 · Driver 0803..."
                    className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">
                    Tracking Update Note (Shown in Customer Timeline)
                  </label>
                  <input
                    value={trkNoteDraft}
                    onChange={(e) => setTrkNoteDraft(e.target.value)}
                    placeholder="e.g. Loaded on morning bus heading to Lagos Jibowu Park"
                    className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingTracking}
                  className="w-full h-9 rounded bg-[#4CB04F] hover:bg-[#419B44] text-white font-bold"
                >
                  {savingTracking ? 'Updating Tracking...' : 'Save & Publish Tracking Update'}
                </button>
              </form>

              {/* Tracking History Preview */}
              {Array.isArray(selectedOrder.trackingHistory) &&
                selectedOrder.trackingHistory.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800">Live Customer Tracking Timeline</p>
                    <div className="space-y-2">
                      {selectedOrder.trackingHistory.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-2.5 rounded border border-slate-200 bg-slate-50 text-[11px]"
                        >
                          <div className="flex justify-between font-bold text-slate-900">
                            <span>{ev.stage}</span>
                            <span className="text-slate-500">
                              {new Date(ev.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-700 mt-0.5">{ev.note}</p>
                          <p className="text-slate-500">Location: {ev.location}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Order Items & Financials */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 px-3 font-medium">Item</th>
                      <th className="py-2 px-3 font-medium text-right">Qty</th>
                      <th className="py-2 px-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item) => (
                      <tr key={item.productId}>
                        <td className="py-2 px-3 font-medium text-slate-900">{item.name}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-semibold tabular-nums">
                          {formatNaira(item.lineTotal, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1.5 border-t border-slate-200 pt-3">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {formatNaira(selectedOrder.subtotal, currency)}
                  </span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-[#4CB04F]">
                    <span>Discount ({selectedOrder.couponCode})</span>
                    <span className="tabular-nums">
                      -{formatNaira(selectedOrder.discountAmount, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Fee &amp; Tax</span>
                  <span className="tabular-nums">
                    {formatNaira(selectedOrder.shippingFee + selectedOrder.taxAmount, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Amount</span>
                  <span className="tabular-nums">
                    {formatNaira(selectedOrder.totalAmount, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YES / NO DELETE CONFIRMATION MODAL */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
          onClick={() => !deletingItem && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{confirmDelete.title}</h3>
                <p className="text-slate-600 mt-1 leading-relaxed">{confirmDelete.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deletingItem}
                onClick={() => setConfirmDelete(null)}
                className="h-9 px-5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
              >
                No
              </button>
              <button
                type="button"
                disabled={deletingItem}
                onClick={async () => {
                  setDeletingItem(true);
                  try {
                    await confirmDelete.onConfirm();
                  } finally {
                    setDeletingItem(false);
                    setConfirmDelete(null);
                  }
                }}
                className="h-9 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {deletingItem ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT ADD / EDIT MODAL (WITH DRAG & DROP IMAGE & FLASH SALE SUPPORT) */}
      {productModalOpen && (
        <ProductEditorModal
          product={editingProduct}
          prefillImageUrl={prefillImageUrl}
          prefillName={prefillName}
          prefillFlashSale={prefillFlashSale}
          currency={currency}
          headers={authHeaders}
          onUploadFile={uploadMediaFile}
          onClose={() => setProductModalOpen(false)}
          onSaved={async () => {
            setProductModalOpen(false);
            await loadDashboard();
            onStorefrontSync();
            notify(editingProduct ? 'Product updated.' : 'New product added.');
          }}
        />
      )}

      {/* PROMO BANNER CREATE / EDIT MODAL (WITH DRAG & DROP IMAGE UPLOAD) */}
      {editingBanner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => {
            setEditingBanner(null);
            setIsCreatingBanner(false);
          }}
        >
          <form
            onSubmit={handleSaveBanner}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-xl p-6 space-y-4 text-xs my-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {isCreatingBanner || editingBanner.id === 'new'
                  ? 'Add After-Hero Product Card'
                  : 'Edit After-Hero Card & Image'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingBanner(null);
                  setIsCreatingBanner(false);
                }}
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleBannerImageDrop(e.dataTransfer.files);
              }}
              className="border border-dashed border-slate-300 rounded-lg p-3 flex items-center justify-between gap-3 bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <img
                  src={editingBanner.image}
                  alt={editingBanner.title}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded bg-white object-contain border border-slate-200"
                />
                <div>
                  <p className="font-semibold text-slate-800">
                    {uploadingBannerImg ? 'Uploading...' : 'Drag & drop card image'}
                  </p>
                  <p className="text-[11px] text-slate-500">Or paste URL below</p>
                </div>
              </div>
              <label className="px-3 py-1.5 rounded bg-slate-900 text-white font-semibold cursor-pointer">
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleBannerImageDrop(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Card Image URL</label>
              <input
                required
                value={editingBanner.image}
                onChange={(e) => setEditingBanner({ ...editingBanner, image: e.target.value })}
                className="w-full h-9 px-3 rounded border border-slate-300 font-mono-tabular"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Badge Label (e.g. New Product)</label>
                <input
                  required
                  value={editingBanner.badgeText}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, badgeText: e.target.value })
                  }
                  className="w-full h-9 px-3 rounded border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Button Label</label>
                <input
                  required
                  value={editingBanner.ctaLabel}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, ctaLabel: e.target.value })
                  }
                  className="w-full h-9 px-3 rounded border border-slate-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Card Title (Product / Promo Name)</label>
              <input
                required
                value={editingBanner.title}
                onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                placeholder="e.g. 5kVA Hybrid Solar Inverter"
                className="w-full h-9 px-3 rounded border border-slate-300"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600">Linked Product (Opens when clicked)</label>
                <button
                  type="button"
                  onClick={() => {
                    const img = editingBanner.image;
                    const title = editingBanner.title;
                    setEditingBanner(null);
                    setIsCreatingBanner(false);
                    openNewProductModal({ prefillImageUrl: img, prefillName: title });
                  }}
                  className="text-[11px] font-semibold text-[#4CB04F] hover:underline"
                >
                  + Create New Product
                </button>
              </div>
              <select
                value={editingBanner.productId}
                onChange={(e) =>
                  setEditingBanner({ ...editingBanner, productId: e.target.value })
                }
                className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
              >
                {data?.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingBanner.active}
                onChange={(e) => setEditingBanner({ ...editingBanner, active: e.target.checked })}
                className="accent-[#4CB04F]"
              />
              <span>Visible right after Hero Section</span>
            </label>
            <button
              type="submit"
              className="w-full h-9 rounded bg-[#4CB04F] hover:bg-[#419B44] text-white font-semibold"
            >
              {isCreatingBanner || editingBanner.id === 'new'
                ? 'Publish After-Hero Card'
                : 'Save Changes'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

interface ProductEditorModalProps {
  product: Product | null;
  prefillImageUrl: string | null;
  prefillName: string | null;
  prefillFlashSale: boolean;
  currency: string;
  headers: Record<string, string>;
  onUploadFile: (file: File) => Promise<{ url: string; type: 'image' | 'video' }>;
  onClose: () => void;
  onSaved: () => void;
}

const ProductEditorModal: React.FC<ProductEditorModalProps> = ({
  product,
  prefillImageUrl,
  prefillName,
  prefillFlashSale,
  currency,
  headers,
  onUploadFile,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(product?.name || prefillName || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [category, setCategory] = useState<Product['category']>(
    product?.category || 'Solar panels'
  );
  const [price, setPrice] = useState(product ? String(product.price) : '185000');
  const [compareAtPrice, setCompareAtPrice] = useState(
    product ? String(product.compareAtPrice) : '220000'
  );
  const [isFlashSale, setIsFlashSale] = useState(
    product ? Boolean(product.isFlashSale) : prefillFlashSale
  );
  const [flashSalePrice, setFlashSalePrice] = useState(
    product?.flashSalePrice
      ? String(product.flashSalePrice)
      : product
      ? String(Math.round(product.price * 0.85))
      : '155000'
  );
  const [stock, setStock] = useState(product ? String(product.stock) : '25');
  const [wattage, setWattage] = useState(product?.wattage || '400W');
  const [warranty, setWarranty] = useState(product?.warranty || '5-Year Warranty');
  const [specifications, setSpecifications] = useState(product?.specifications || '');
  const [image, setImage] = useState(
    product?.image || prefillImageUrl || '/src/assets/images/product_solar_panels_1795501702594.jpg'
  );
  const [description, setDescription] = useState(product?.description || '');
  const [status, setStatus] = useState<Product['status']>(product?.status || 'Active');
  const [featured, setFeatured] = useState(product ? product.featured : true);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageDrop = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingImg(true);
    setError(null);
    try {
      const uploaded = await onUploadFile(files[0]);
      setImage(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const endpoint = product ? `/api/admin/products/${product.id}` : '/api/admin/products';
      const method = product ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify({
          name,
          sku,
          category,
          price: Number(price),
          compareAtPrice: Number(compareAtPrice),
          isFlashSale,
          flashSalePrice: isFlashSale ? Number(flashSalePrice) : undefined,
          stock: Number(stock),
          wattage,
          warranty,
          specifications,
          image,
          description,
          status,
          featured,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to save product.');
      } else {
        onSaved();
      }
    } catch {
      setError('Network error saving product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl p-6 space-y-4 text-xs my-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {product ? `Edit ${product.name}` : 'Add New Solar / Electrical Product'}
          </h3>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleImageDrop(e.dataTransfer.files);
          }}
          className="border border-dashed border-slate-300 rounded-lg p-3 flex items-center justify-between gap-3 bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <img
              src={image}
              alt="Preview"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded bg-white object-contain border border-slate-200"
            />
            <div>
              <p className="font-semibold text-slate-800">
                {uploadingImg ? 'Uploading...' : 'Drag & drop product photo here'}
              </p>
              <p className="text-[11px] text-slate-500">Or pick a preset studio photo below</p>
            </div>
          </div>
          <label className="px-3 py-1.5 rounded bg-white border border-slate-300 font-semibold cursor-pointer hover:bg-slate-100">
            <span>Upload</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleImageDrop(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 mb-1">Product Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 rounded border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">SKU</label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="EMM-PNL-400"
              className="w-full h-9 px-3 rounded border border-slate-300 font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Product['category'])}
              className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
            >
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Catalog Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Product['status'])}
              className="w-full h-9 px-3 rounded border border-slate-300 bg-white"
            >
              <option>Active</option>
              <option>Draft</option>
              <option>Out of Stock</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Sale Price ({currency}) *</label>
            <input
              type="number"
              step="1"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full h-9 px-3 rounded border border-slate-300 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Original Price ({currency})</label>
            <input
              type="number"
              step="1"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              className="w-full h-9 px-3 rounded border border-slate-300 tabular-nums"
            />
          </div>

          {/* Flash Sale Control inside Product Editor */}
          <div className="sm:col-span-2 p-3 rounded-lg bg-[#EDF7EE] border border-[#4CB04F]/40 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <label className="flex items-center gap-2 font-bold text-[#151916]">
              <input
                type="checkbox"
                checked={isFlashSale}
                onChange={(e) => setIsFlashSale(e.target.checked)}
                className="accent-[#4CB04F]"
              />
              <span>Publish in Green Flash Sales Carousel</span>
            </label>
            {isFlashSale && (
              <div>
                <label className="block text-[#235D25] font-semibold mb-1">
                  Flash Sale Price ({currency}) *
                </label>
                <input
                  type="number"
                  step="1"
                  required={isFlashSale}
                  value={flashSalePrice}
                  onChange={(e) => setFlashSalePrice(e.target.value)}
                  className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white tabular-nums font-bold"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Stock Quantity</label>
            <input
              type="number"
              required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full h-9 px-3 rounded border border-slate-300 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1">Rated Output / Spec</label>
            <input
              value={wattage}
              onChange={(e) => setWattage(e.target.value)}
              className="w-full h-9 px-3 rounded border border-slate-300"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-slate-600 mb-1">Image URL or Preset</label>
            <div className="flex gap-2">
              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="flex-1 h-9 px-3 rounded border border-slate-300 font-mono-tabular"
              />
              <select
                value={AVAILABLE_IMAGES.some((a) => a.url === image) ? image : ''}
                onChange={(e) => {
                  if (e.target.value) setImage(e.target.value);
                }}
                className="h-9 px-2 rounded border border-slate-300 bg-white"
              >
                <option value="">Presets...</option>
                {AVAILABLE_IMAGES.map((img) => (
                  <option key={img.url} value={img.url}>
                    {img.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-slate-600 mb-1">Technical Specifications</label>
            <input
              value={specifications}
              onChange={(e) => setSpecifications(e.target.value)}
              placeholder="e.g. 230V AC · 22.4% Efficiency · IP68"
              className="w-full h-9 px-3 rounded border border-slate-300"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-slate-600 mb-1">Warranty</label>
            <input
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
              className="w-full h-9 px-3 rounded border border-slate-300"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-slate-600 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded border border-slate-300"
            />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="accent-[#4CB04F]"
            />
            <span>Show in &ldquo;Our Recent Product&rdquo; Homepage Grid</span>
          </label>
        </div>

        {error && <p className="text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded border border-slate-200 text-slate-700 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-5 rounded bg-[#4CB04F] hover:bg-[#419B44] text-white font-semibold"
          >
            {saving ? 'Saving...' : 'Save Product'}
          </button>
        </div>
      </form>
    </div>
  );
};
