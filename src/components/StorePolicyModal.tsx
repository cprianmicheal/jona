import React, { useState } from 'react';
import {
  ShieldCheck,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  X,
} from 'lucide-react';
import type { StoreSettings } from '../types';

interface StorePolicyModalProps {
  open: boolean;
  settings: StoreSettings;
  onAccept: () => void;
  onDecline: () => void;
  onCloseAfterDecline?: () => void;
}

export const StorePolicyModal: React.FC<StorePolicyModalProps> = ({
  open,
  settings,
  onAccept,
  onDecline,
  onCloseAfterDecline,
}) => {
  const [declinedView, setDeclinedView] = useState(false);

  if (!open) return null;

  const whatsappDigits = settings.whatsappNumber.replace(/\D/g, '');
  const whatsappHelpUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
    `Hello ${settings.storeName}, I need assistance on your website.`
  )}`;

  const handleDeclineClick = () => {
    setDeclinedView(true);
    onDecline();
  };

  const handleAcceptClick = () => {
    setDeclinedView(false);
    onAccept();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-policy-title"
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#151916] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#4CB04F]/20 border border-[#4CB04F]/40 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#4CB04F]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4CB04F]">
                Official Store Terms &amp; Customer Protection
              </p>
              <h2 id="store-policy-title" className="text-sm sm:text-base font-bold truncate">
                {settings.storeName} — Store Policy
              </h2>
            </div>
          </div>
          {declinedView && onCloseAfterDecline && (
            <button
              type="button"
              onClick={onCloseAfterDecline}
              aria-label="Continue browsing in read-only mode"
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-300 hover:bg-white/10 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-neutral-700 leading-relaxed flex-1">
          {declinedView ? (
            <div className="py-4 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <XCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-[#151916]">Policy Declined</h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  You can continue browsing products and prices on our store. Whenever you are ready
                  to place an order, please accept the store policy or reach us on WhatsApp first.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeclinedView(false)}
                  className="w-full sm:w-auto px-5 h-10 rounded-md bg-[#4CB04F] text-white text-xs font-semibold border border-transparent btn-hover-white"
                >
                  Read &amp; Accept Policy
                </button>
                {onCloseAfterDecline && (
                  <button
                    type="button"
                    onClick={onCloseAfterDecline}
                    className="w-full sm:w-auto px-5 h-10 rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold"
                  >
                    Continue Browsing
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs sm:text-[13px] text-neutral-700">
                Thank you for shopping with <strong>{settings.storeName}</strong>. Here is how we
                handle payments, deliveries, and warranties:
              </p>

              <div className="space-y-3 bg-[#F8FAF8] border border-neutral-200 rounded-xl p-4">
                <div>
                  <h3 className="font-bold text-[#151916] mb-0.5">Tested Solar &amp; Electrical Stock</h3>
                  <p className="text-neutral-600">
                    Every panel, inverter, battery, cable, and accessory is checked before leaving
                    our Ankpa store. Manufacturer warranties apply to covered equipment.
                  </p>
                </div>

                <div className="pt-2.5 border-t border-neutral-200/80">
                  <h3 className="font-bold text-[#151916] mb-0.5">Nationwide Waybill &amp; Dispatch</h3>
                  <p className="text-neutral-600">
                    We send orders across all 36 states and FCT through verified motor parks or
                    doorstep courier. Your delivery fee is shown clearly before you pay.
                  </p>
                </div>

                <div className="pt-2.5 border-t border-neutral-200/80">
                  <h3 className="font-bold text-[#151916] mb-0.5">Verified Transfers &amp; Tracking</h3>
                  <p className="text-neutral-600">
                    Pay only into the official bank accounts shown on our checkout screen. After
                    uploading your receipt and tapping <strong>&ldquo;I Have Sent&rdquo;</strong>,
                    you get a downloadable PDF invoice and tracking code (starting from{' '}
                    <span className="font-mono-tabular font-semibold">Emmy1001</span>).
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Direct WhatsApp Assistance Box */}
          <div className="p-4 rounded-xl bg-[#EDF7EE] border border-[#4CB04F]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#235D25]">
                Need Help? Talk to Us Directly
              </p>
              <p className="text-xs text-[#151916] font-semibold">
                WhatsApp: <span className="font-mono-tabular">{settings.whatsappNumber}</span>
              </p>
              <p className="text-[11px] text-[#235D25] flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {settings.businessHours}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Ankpa, Kogi State
                </span>
              </p>
            </div>

            <a
              href={whatsappHelpUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-md bg-[#151916] text-white text-xs font-semibold border border-transparent shrink-0 btn-hover-white"
            >
              <MessageCircle className="w-4 h-4 text-[#4CB04F]" />
              <span>Chat WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Footer Buttons */}
        {!declinedView && (
          <div className="px-5 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDeclineClick}
              className="h-10 px-5 rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-semibold transition-colors"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={handleAcceptClick}
              className="h-10 px-6 rounded-md bg-[#4CB04F] text-white text-xs font-semibold border border-transparent inline-flex items-center justify-center gap-2 btn-hover-white"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Accept &amp; Continue Shopping</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
