"use client";
import { useEffect, useState } from "react";
import { X, Check, ShoppingCart, Star, ExternalLink } from "lucide-react";
import { WhatsappIcon } from "@/components/shared/BrandIcons";
import { useCartStore, Beat, License } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { DIRECT_CHECKOUT_ENABLED, SOCIALS } from "@/lib/site";
import { isDirectExclusive, EXCLUSIVE_DIRECT_PRICE } from "@/lib/exclusive";
import { track } from "@/lib/track";

interface Props {
  beat: Beat;
  licenses: License[];
  onClose: () => void;
}

export function LicenseModal({ beat, licenses, onClose }: Props) {
  const [selected, setSelected] = useState<string>("premium");
  const { addItem, toggleCart } = useCartStore();
  const { lang } = useLang();

  // Embudo: el usuario abrió el selector de licencias de este beat
  useEffect(() => {
    track("licencia_abierta", { beat_id: beat.id, beat: beat.title });
  }, [beat.id, beat.title]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  const selectedLicense = licenses.find((l) => l.id === selected);
  const isExclusive = selectedLicense?.exclusive;
  // Beats nuevos: la exclusiva es compra directa $600. Beats legacy: se negocia en BeatStars.
  const directExclusive = isDirectExclusive(beat.id);
  // Precio efectivo de una licencia (la exclusiva depende de si el beat es nuevo o legacy)
  const licPrice = (lic: License) =>
    lic.exclusive ? (directExclusive ? EXCLUSIVE_DIRECT_PRICE : null) : lic.price;
  const selectedPrice = selectedLicense ? licPrice(selectedLicense) : null;
  // Exclusiva que se negocia (beat legacy) → flujo a BeatStars, sin checkout directo
  const exclusiveNegotiate = !!isExclusive && !directExclusive;
  // La exclusiva directa (beat nuevo) SIEMPRE cobra por Stripe, aunque el checkout
  // global esté apagado. Las licencias no exclusivas dependen del interruptor maestro.
  const canAddToCart = (isExclusive && directExclusive) || DIRECT_CHECKOUT_ENABLED;

  const handleAddToCart = () => {
    if (!selectedLicense || selectedPrice === null) return;
    addItem({
      beat,
      licenseId: selectedLicense.id,
      licenseName: selectedLicense.name[lang],
      price: selectedPrice,
    });
    track("add_to_cart", {
      beat_id: beat.id,
      beat: beat.title,
      licencia: selectedLicense.id,
      valor: selectedPrice,
    });
    onClose();
    toggleCart();
  };

  const t = {
    selectLicense: lang === "es" ? "Selecciona el tipo de licencia:" : "Select your license type:",
    popular: lang === "es" ? "Popular" : "Popular",
    negotiable: lang === "es" ? "Negociable" : "Negotiable",
    includes: lang === "es" ? "Incluye" : "Includes",
    notIncludes: lang === "es" ? "No incluye" : "Not included",
    buyOnBS: lang === "es" ? "Comprar en BeatStars" : "Buy on BeatStars",
    addToCart: lang === "es" ? "Agregar al carrito" : "Add to cart",
    negotiate: lang === "es" ? "Negociar precio" : "Start negotiation",
    securePay:
      lang === "es"
        ? "Pago seguro y entrega instantánea de archivos a través de BeatStars."
        : "Secure payment and instant file delivery through BeatStars.",
    secureStripe:
      lang === "es"
        ? "Pago seguro con tarjeta. Recibirás los archivos por email."
        : "Secure card payment. You'll receive the files by email.",
    negotiateNote:
      lang === "es"
        ? "La licencia exclusiva se negocia directamente. Escríbenos o inicia la negociación en BeatStars."
        : "Exclusive licenses are negotiated directly. Message us or start a negotiation on BeatStars.",
    exclusiveNote:
      lang === "es"
        ? "Compra exclusiva: el beat se retira de la venta y recibes el contrato de exclusividad firmado por correo."
        : "Exclusive purchase: the beat is removed from sale and you receive the signed exclusivity contract by email.",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full sm:max-w-4xl bg-lgb-dark rounded-t-3xl sm:rounded-2xl border border-white/10 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-white font-coolvetica text-xl">{beat.title}</h2>
            <p className="text-white/40 text-sm">
              {beat.artists?.[0] ?? beat.genre}
              {beat.bpm > 0 && ` · ${beat.bpm} BPM`}
              {beat.key !== "—" && ` · ${beat.key}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors cursor-pointer w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          <p className="text-white/50 text-sm mb-5">{t.selectLicense}</p>

          {/* License cards grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {licenses.map((lic) => (
              <button
                key={lic.id}
                onClick={() => setSelected(lic.id)}
                className={`relative rounded-xl p-4 border text-left transition-all duration-200 cursor-pointer ${
                  selected === lic.id
                    ? "border-lgb-red bg-lgb-red/10 scale-[1.02]"
                    : "border-white/10 bg-white/3 hover:border-white/20"
                }`}
              >
                {lic.popular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-lgb-red text-white text-[9px] px-2 py-0.5 rounded-full font-sans tracking-wider uppercase">
                    {t.popular}
                  </span>
                )}
                {lic.exclusive && (
                  <Star
                    size={10}
                    className="absolute top-3 right-3 text-yellow-400 fill-yellow-400"
                  />
                )}
                <div
                  className="text-[10px] font-asphaltic tracking-widest uppercase mb-2"
                  style={{ color: lic.color }}
                >
                  {lic.badge}
                </div>
                <div className="text-white font-coolvetica text-base leading-tight mb-1">
                  {lic.name[lang].replace(" License", "")}
                </div>
                <div className="text-2xl font-coolvetica text-white mt-2">
                  {licPrice(lic) !== null ? (
                    <>
                      ${licPrice(lic)}
                      <span className="text-white/30 text-sm font-sans ml-1">USD</span>
                    </>
                  ) : (
                    <span className="text-lgb-gold text-lg">{t.negotiable}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Selected license details */}
          {selectedLicense && (
            <div className="rounded-xl bg-white/3 border border-white/8 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-coolvetica text-lg">
                    {selectedLicense.name[lang]}
                  </h3>
                  <p className="text-white/50 text-sm mt-1">
                    {selectedLicense.description[lang]}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  {selectedPrice !== null ? (
                    <>
                      <div className="text-white font-coolvetica text-2xl">
                        ${selectedPrice}
                      </div>
                      <div className="text-white/30 text-xs">USD</div>
                    </>
                  ) : (
                    <div className="text-lgb-gold font-coolvetica text-xl">
                      {t.negotiable}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-3">
                    {t.includes}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {selectedLicense.features[lang].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                        <Check size={13} className="text-green-400 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedLicense.notIncluded[lang].length > 0 && (
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-3">
                      {t.notIncludes}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {selectedLicense.notIncluded[lang].map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-white/40">
                          <X size={13} className="text-white/30 mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-white/40 text-xs hidden sm:block max-w-xs">
            {exclusiveNegotiate
              ? t.negotiateNote
              : isExclusive
                ? t.exclusiveNote
                : DIRECT_CHECKOUT_ENABLED
                  ? t.secureStripe
                  : t.securePay}
          </p>

          <div className="flex items-center gap-2 justify-end flex-wrap">
            {/* WhatsApp en exclusiva: "Negociar" en beats legacy, "Dudas" en compra directa */}
            {isExclusive && (
              <a
                href={`${SOCIALS.whatsapp}?text=${encodeURIComponent(
                  lang === "es"
                    ? exclusiveNegotiate
                      ? `Hola! Me interesa la licencia exclusiva del beat "${beat.title}"`
                      : `Hola! Tengo una duda sobre la licencia exclusiva del beat "${beat.title}"`
                    : exclusiveNegotiate
                      ? `Hi! I'm interested in the exclusive license for "${beat.title}"`
                      : `Hi! I have a question about the exclusive license for "${beat.title}"`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 border border-white/15 text-white/70 hover:text-white hover:border-[#25D366] px-5 py-3 rounded-full text-sm transition-all cursor-pointer"
              >
                <WhatsappIcon size={14} />
                {exclusiveNegotiate ? "WhatsApp" : lang === "es" ? "Dudas" : "Questions"}
              </a>
            )}

            {exclusiveNegotiate ? (
              <a
                href={beat.beatstarsUrl ?? SOCIALS.beatstars}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-lgb-gold text-black px-6 py-3 rounded-full font-medium hover:bg-yellow-400 transition-all hover:scale-105 active:scale-95 cursor-pointer text-sm whitespace-nowrap"
              >
                <Star size={14} />
                {t.negotiate}
              </a>
            ) : canAddToCart ? (
              <button
                onClick={handleAddToCart}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap ${
                  isExclusive
                    ? "bg-lgb-gold text-black hover:bg-yellow-400"
                    : "bg-lgb-red text-white hover:bg-red-700"
                }`}
              >
                {isExclusive ? <Star size={16} /> : <ShoppingCart size={16} />}
                {t.addToCart} · ${selectedPrice}
              </button>
            ) : (
              <a
                href={beat.beatstarsUrl ?? SOCIALS.beatstars}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-lgb-red text-white px-6 py-3 rounded-full font-medium hover:bg-red-700 transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <ExternalLink size={15} />
                {t.buyOnBS} · ${selectedPrice}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
