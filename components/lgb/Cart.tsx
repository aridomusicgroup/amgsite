"use client";
import { useState } from "react";
import Image from "next/image";
import { X, Trash2, ShoppingBag, CreditCard, ExternalLink } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { DIRECT_CHECKOUT_ENABLED } from "@/lib/site";
import { isDirectExclusive } from "@/lib/exclusive";
import { getAttribution } from "@/lib/attribution";
import { track } from "@/lib/track";

export function LGBCart() {
  const { items, removeItem, clearCart, toggleCart, total } = useCartStore();
  const { lang } = useLang();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cartTotal = total();
  // Stripe si el interruptor maestro está encendido, o si el carrito tiene una
  // exclusiva directa (beat nuevo) — esa siempre cobra por Stripe.
  const stripeCheckout =
    DIRECT_CHECKOUT_ENABLED ||
    items.some((i) => i.licenseId === "exclusive" && isDirectExclusive(i.beat.id));

  const handleCheckout = async () => {
    setError(null);
    if (stripeCheckout) {
      // Stripe Checkout
      setPaying(true);
      track("checkout_iniciado", {
        valor: cartTotal,
        n_items: items.length,
        beats: items.map((i) => i.beat.id),
        licencias: items.map((i) => i.licenseId),
      });
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({ beatId: i.beat.id, licenseId: i.licenseId })),
            lang,
            attrib: getAttribution(),
          }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError(
            lang === "es"
              ? "No se pudo iniciar el pago. Intenta de nuevo."
              : "Could not start checkout. Please try again."
          );
        }
      } catch {
        setError(
          lang === "es"
            ? "Error de conexión. Intenta de nuevo."
            : "Connection error. Please try again."
        );
      } finally {
        setPaying(false);
      }
    } else {
      // Phase 1: finish purchase on BeatStars (opens the first item's page)
      const first = items.find((i) => i.beat.beatstarsUrl);
      if (first?.beat.beatstarsUrl) {
        window.open(first.beat.beatstarsUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={toggleCart}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-sm bg-lgb-dark border-l border-white/5 flex flex-col h-full animate-slide-in-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-lgb-red" />
            <span className="text-white font-coolvetica text-lg">
              {lang === "es" ? "Carrito" : "Cart"}
            </span>
            {items.length > 0 && (
              <span className="w-5 h-5 bg-lgb-red rounded-full text-white text-[10px] flex items-center justify-center">
                {items.length}
              </span>
            )}
          </div>
          <button
            onClick={toggleCart}
            className="text-white/40 hover:text-white cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-white/30 gap-4">
              <ShoppingBag size={40} strokeWidth={1} />
              <p className="text-sm">
                {lang === "es" ? "Tu carrito está vacío" : "Your cart is empty"}
              </p>
              <button
                onClick={toggleCart}
                className="text-xs text-lgb-red hover:text-red-400 transition-colors cursor-pointer"
              >
                {lang === "es" ? "Explorar beats →" : "Browse beats →"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div
                  key={item.beat.id}
                  className="flex gap-3 p-3 rounded-xl bg-white/3 border border-white/5"
                >
                  {/* Cover mini */}
                  {item.beat.artworkUrl ? (
                    <Image
                      src={item.beat.artworkUrl}
                      alt={item.beat.title}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                      unoptimized
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${item.beat.coverGradient[0]}, ${item.beat.coverGradient[1]})`,
                      }}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-coolvetica text-sm truncate">
                      {item.beat.title}
                    </p>
                    <p className="text-white/40 text-xs">{item.licenseName}</p>
                  </div>

                  <div className="flex flex-col items-end justify-between shrink-0">
                    <button
                      onClick={() => removeItem(item.beat.id)}
                      className="text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                    <span className="text-white text-sm font-coolvetica">
                      ${item.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-4 border-t border-white/5">
            <div className="flex justify-between items-center mb-4">
              <span className="text-white/50 text-sm">Total</span>
              <span className="text-white font-coolvetica text-2xl">
                ${cartTotal.toFixed(2)}
                <span className="text-white/30 text-xs font-sans ml-1">USD</span>
              </span>
            </div>

            {error && (
              <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
            )}

            <button
              onClick={handleCheckout}
              disabled={paying}
              className="w-full bg-lgb-red text-white py-3.5 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer mb-2 disabled:opacity-50 disabled:cursor-wait"
            >
              {stripeCheckout ? (
                <>
                  <CreditCard size={16} />
                  {paying
                    ? lang === "es" ? "Redirigiendo..." : "Redirecting..."
                    : lang === "es" ? "Proceder al pago" : "Checkout"}
                </>
              ) : (
                <>
                  <ExternalLink size={15} />
                  {lang === "es" ? "Finalizar en BeatStars" : "Finish on BeatStars"}
                </>
              )}
            </button>

            <p className="text-white/30 text-[11px] text-center mb-2 leading-relaxed">
              {stripeCheckout
                ? lang === "es"
                  ? "🔒 Pago seguro con Stripe. Recibes tus archivos por email al instante."
                  : "🔒 Secure payment with Stripe. Files delivered to your email instantly."
                : lang === "es"
                  ? "El pago y la entrega de archivos se procesan de forma segura en BeatStars."
                  : "Payment and file delivery are securely processed on BeatStars."}
            </p>

            <button
              onClick={clearCart}
              className="w-full text-white/30 hover:text-white/60 text-xs text-center py-2 cursor-pointer transition-colors"
            >
              {lang === "es" ? "Vaciar carrito" : "Clear cart"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
