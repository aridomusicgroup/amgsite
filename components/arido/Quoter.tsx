"use client";
import { useMemo, useState } from "react";
import { Check, Plus, Minus, CreditCard, Sparkles } from "lucide-react";
import { WhatsappIcon } from "@/components/shared/BrandIcons";
import { useLang } from "@/lib/i18n";
import { SOCIALS } from "@/lib/site";
import { getAttribution } from "@/lib/attribution";
import { track } from "@/lib/track";
import rawServices from "@/data/services.json";

type L = { es: string; en: string };
interface Choice {
  id: string;
  label: L;
  options: { id: string; label: L }[];
}
interface Base {
  id: string;
  name: L;
  tagline: L;
  price: number;
  includes: { es: string[]; en: string[] };
  includedExtras: string[];
  choices: Choice[];
}
interface Extra {
  id: string;
  label: L;
  price: number;
}
interface Studio {
  id: string;
  label: L;
  description: L;
  price: number;
}

const services = rawServices as unknown as {
  bases: Base[];
  extras: Extra[];
  studio: Studio[];
};

const fmt = (n: number) => `$${n.toLocaleString("es-MX")}`;

export function Quoter() {
  const { lang } = useLang();
  const [baseId, setBaseId] = useState<string>("tumbes");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [studio, setStudio] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = services.bases.find((b) => b.id === baseId)!;
  const hasBeat = base.id !== "scratch";

  const selectBase = (id: string) => {
    setBaseId(id);
    setChoices({});
    setExtras(new Set());
  };

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const lineItems = useMemo(() => {
    const items: { label: string; price: number }[] = [];
    if (hasBeat) {
      const choiceText = base.choices
        .map((c) => {
          const sel = choices[c.id] ?? c.options[0].id;
          const opt = c.options.find((o) => o.id === sel)!;
          return opt.label[lang];
        })
        .join(", ");
      items.push({
        label: base.name[lang] + (choiceText ? ` (${choiceText.toLowerCase()})` : ""),
        price: base.price,
      });
      for (const exId of extras) {
        const ex = services.extras.find((e) => e.id === exId);
        if (ex && !base.includedExtras.includes(exId))
          items.push({ label: `+ ${ex.label[lang]}`, price: ex.price });
      }
    }
    for (const stId of studio) {
      const st = services.studio.find((s) => s.id === stId);
      if (st) items.push({ label: st.label[lang], price: st.price });
    }
    return items;
  }, [base, baseId, choices, extras, studio, lang, hasBeat]);

  const total = lineItems.reduce((acc, i) => acc + i.price, 0);

  const t = {
    step1: lang === "es" ? "1 · Elige tu punto de partida" : "1 · Pick your starting point",
    step2: lang === "es" ? "2 · Personalízalo" : "2 · Customize it",
    step3: lang === "es" ? "3 · Tu cotización" : "3 · Your quote",
    included: lang === "es" ? "Incluye" : "Includes",
    includedTag: lang === "es" ? "Incluido" : "Included",
    extrasTitle: lang === "es" ? "Instrumentos extra" : "Extra instruments",
    extrasHint:
      lang === "es"
        ? "Suma instrumentos a tu producción"
        : "Add instruments to your production",
    studioTitle: lang === "es" ? "Servicios de estudio" : "Studio services",
    studioHint:
      lang === "es"
        ? "Agrégalos a tu paquete o contrátalos por separado"
        : "Add them to your package or book them on their own",
    noteLabel:
      lang === "es"
        ? "Cuéntanos de tu proyecto (opcional)"
        : "Tell us about your project (optional)",
    notePh:
      lang === "es"
        ? "Ej. corrido estilo Fuerza Regida, ya tengo la letra…"
        : "E.g. Fuerza Regida style corrido, lyrics ready…",
    empty:
      lang === "es"
        ? "Elige un paquete o agrega servicios para armar tu cotización"
        : "Pick a package or add services to build your quote",
    total: "Total",
    mxnNote:
      lang === "es"
        ? "Precios en pesos mexicanos (MXN). Pagos en otra divisa sujetos al tipo de cambio."
        : "Prices in Mexican pesos (MXN). Payments in other currencies subject to exchange rate.",
    pay: lang === "es" ? "Pagar con tarjeta" : "Pay by card",
    paying: lang === "es" ? "Redirigiendo…" : "Redirecting…",
    wa: lang === "es" ? "Cotizar por WhatsApp" : "Quote via WhatsApp",
    after:
      lang === "es"
        ? "Al completar tu pago te contactamos en menos de 24 h para arrancar tu proyecto."
        : "Once your payment is complete we'll contact you within 24 h to kick off your project.",
    terms:
      lang === "es"
        ? "Incluye 2 rondas de revisiones por servicio; ajustes adicionales se cotizan aparte. El tiempo de entrega se confirma al arrancar tu proyecto."
        : "Includes 2 rounds of revisions per service; additional changes are quoted separately. Delivery time is confirmed when your project kicks off.",
  };

  const waMessage = useMemo(() => {
    const lines = [
      lang === "es"
        ? "¡Hola LGB! Quiero cotizar esto:"
        : "Hi LGB! I'd like a quote for:",
      ...lineItems.map((i) => `• ${i.label} — ${fmt(i.price)} MXN`),
      `Total: ${fmt(total)} MXN`,
    ];
    if (note.trim()) lines.push((lang === "es" ? "Mi proyecto: " : "My project: ") + note.trim());
    return `${SOCIALS.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [lineItems, total, note, lang]);

  const handlePay = async () => {
    setError(null);
    setPaying(true);
    track("cotizador_pago_iniciado", { valor: total, items: lineItems.map((i) => i.label) });
    try {
      const res = await fetch("/api/checkout-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseId: hasBeat ? baseId : null,
          choices,
          extras: [...extras],
          studio: [...studio],
          note: note.trim().slice(0, 400),
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
            ? "No se pudo iniciar el pago. Intenta de nuevo o cotiza por WhatsApp."
            : "Could not start checkout. Try again or quote via WhatsApp."
        );
      }
    } catch {
      setError(lang === "es" ? "Error de conexión. Intenta de nuevo." : "Connection error. Try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-10 items-start">
      {/* Columna principal */}
      <div className="flex flex-col gap-12 min-w-0">
        {/* Paso 1: paquetes */}
        <section>
          <h2 className="text-arido-red text-sm font-asphaltic tracking-[0.25em] uppercase mb-5">
            {t.step1}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {services.bases.map((b) => {
              const active = baseId === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => selectBase(b.id)}
                  className={`relative text-left rounded-2xl p-5 border-2 transition-all duration-200 cursor-pointer ${
                    active
                      ? "border-arido-red bg-arido-red/5 shadow-lg shadow-arido-red/10"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-arido-red/40"
                  }`}
                >
                  {active && (
                    <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-arido-red flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </span>
                  )}
                  {b.id === "scratch" && (
                    <Sparkles size={16} className="text-arido-orange mb-2" />
                  )}
                  <h3 className="font-coolvetica text-xl text-[var(--fg)]">{b.name[lang]}</h3>
                  <p className="text-[var(--fg-2)] text-xs mt-0.5 mb-3">{b.tagline[lang]}</p>
                  {b.includes[lang].length > 0 && (
                    <ul className="flex flex-col gap-1 mb-3">
                      {b.includes[lang].map((inc) => (
                        <li key={inc} className="flex items-start gap-1.5 text-xs text-[var(--fg-2)]">
                          <Check size={11} className="text-arido-red mt-0.5 shrink-0" />
                          {inc}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="font-coolvetica text-2xl text-[var(--fg)]">
                    {b.price > 0 ? (
                      <>
                        {fmt(b.price)}{" "}
                        <span className="text-xs text-[var(--fg-2)] font-sans">MXN</span>
                      </>
                    ) : (
                      <span className="text-arido-orange text-lg">
                        {lang === "es" ? "Tú decides" : "You decide"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Paso 2: personalización */}
        <section>
          <h2 className="text-arido-red text-sm font-asphaltic tracking-[0.25em] uppercase mb-5">
            {t.step2}
          </h2>

          {/* Elecciones del paquete */}
          {base.choices.length > 0 && (
            <div className="mb-8">
              {base.choices.map((c) => (
                <div key={c.id} className="mb-4">
                  <p className="text-[var(--fg)] text-sm font-medium mb-2">{c.label[lang]}</p>
                  <div className="flex gap-2 flex-wrap">
                    {c.options.map((o) => {
                      const sel = (choices[c.id] ?? c.options[0].id) === o.id;
                      return (
                        <button
                          key={o.id}
                          onClick={() => setChoices({ ...choices, [c.id]: o.id })}
                          className={`px-5 py-2 rounded-full text-sm border-2 transition-all cursor-pointer ${
                            sel
                              ? "border-arido-red bg-arido-red text-white"
                              : "border-[var(--border)] text-[var(--fg-2)] hover:border-arido-red/40"
                          }`}
                        >
                          {o.label[lang]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instrumentos extra (solo con beat base) */}
          {hasBeat && (
            <div className="mb-8">
              <p className="text-[var(--fg)] font-coolvetica text-lg">{t.extrasTitle}</p>
              <p className="text-[var(--fg-2)] text-xs mb-3">{t.extrasHint}</p>
              <div className="flex gap-2 flex-wrap">
                {services.extras.map((ex) => {
                  const included = base.includedExtras.includes(ex.id);
                  const active = extras.has(ex.id);
                  return (
                    <button
                      key={ex.id}
                      disabled={included}
                      onClick={() => toggle(extras, ex.id, setExtras)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm border-2 transition-all ${
                        included
                          ? "border-[var(--border)] text-[var(--fg-2)] opacity-60 cursor-default"
                          : active
                            ? "border-arido-red bg-arido-red text-white cursor-pointer"
                            : "border-[var(--border)] text-[var(--fg)] hover:border-arido-red/40 cursor-pointer"
                      }`}
                    >
                      {included ? (
                        <Check size={13} />
                      ) : active ? (
                        <Minus size={13} />
                      ) : (
                        <Plus size={13} />
                      )}
                      {ex.label[lang]}
                      <span className={included ? "" : active ? "text-white/80" : "text-[var(--fg-2)]"}>
                        {included ? t.includedTag : `+${fmt(ex.price)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Servicios de estudio */}
          <div>
            <p className="text-[var(--fg)] font-coolvetica text-lg">{t.studioTitle}</p>
            <p className="text-[var(--fg-2)] text-xs mb-3">{t.studioHint}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {services.studio.map((st) => {
                const active = studio.has(st.id);
                return (
                  <button
                    key={st.id}
                    onClick={() => toggle(studio, st.id, setStudio)}
                    className={`flex items-start justify-between gap-3 text-left rounded-2xl p-4 border-2 transition-all cursor-pointer ${
                      active
                        ? "border-arido-red bg-arido-red/5"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-arido-red/40"
                    }`}
                  >
                    <div>
                      <p className="text-[var(--fg)] text-sm font-medium leading-tight">
                        {st.label[lang]}
                      </p>
                      <p className="text-[var(--fg-2)] text-xs mt-1">{st.description[lang]}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex w-6 h-6 rounded-full items-center justify-center mb-1 ${
                          active ? "bg-arido-red text-white" : "border border-[var(--border)] text-[var(--fg-2)]"
                        }`}
                      >
                        {active ? <Check size={13} /> : <Plus size={13} />}
                      </span>
                      <p className="text-[var(--fg)] font-coolvetica">{fmt(st.price)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nota del proyecto */}
          <div className="mt-8">
            <label className="text-[var(--fg)] text-sm font-medium block mb-2">
              {t.noteLabel}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePh}
              rows={3}
              maxLength={400}
              className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] placeholder-[var(--fg-2)] p-4 text-sm focus:outline-none focus:border-arido-red/60 transition-colors resize-none"
            />
          </div>
        </section>
      </div>

      {/* Resumen sticky */}
      <aside className="lg:sticky lg:top-24 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 pb-28 lg:pb-6">
        <h2 className="text-arido-red text-sm font-asphaltic tracking-[0.25em] uppercase mb-4">
          {t.step3}
        </h2>

        {lineItems.length === 0 ? (
          <p className="text-[var(--fg-2)] text-sm py-6 text-center">{t.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2.5 mb-5">
            {lineItems.map((i) => (
              <li key={i.label} className="flex justify-between gap-3 text-sm">
                <span className="text-[var(--fg-2)]">{i.label}</span>
                <span className="text-[var(--fg)] shrink-0">{fmt(i.price)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-[var(--border)] pt-4 flex justify-between items-baseline mb-1">
          <span className="text-[var(--fg-2)] text-sm">{t.total}</span>
          <span className="font-coolvetica text-3xl text-[var(--fg)]">
            {fmt(total)} <span className="text-sm text-[var(--fg-2)] font-sans">MXN</span>
          </span>
        </div>
        <p className="text-[var(--fg-2)] text-[11px] leading-relaxed mb-5">{t.mxnNote}</p>

        {error && <p className="text-arido-red text-xs mb-3 text-center">{error}</p>}

        <button
          onClick={handlePay}
          disabled={total === 0 || paying}
          className="w-full bg-arido-red text-white py-3.5 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-arido-orange transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 mb-2.5"
        >
          <CreditCard size={16} />
          {paying ? t.paying : `${t.pay} · ${fmt(total)}`}
        </button>
        <a
          href={waMessage}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full border-2 border-[#25D366] text-[#25D366] py-3 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-[#25D366] hover:text-white transition-all cursor-pointer ${
            total === 0 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <WhatsappIcon size={16} />
          {t.wa}
        </a>
        <p className="text-[var(--fg-2)] text-[11px] leading-relaxed mt-4 text-center">{t.after}</p>
        <p className="text-[var(--fg-2)] text-[10px] leading-relaxed mt-2 text-center opacity-80">
          {t.terms}
        </p>
      </aside>

      {/* Barra fija móvil */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)] border-t border-[var(--border)] px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[var(--fg-2)] text-[10px] uppercase tracking-wider">{t.total}</p>
          <p className="font-coolvetica text-xl text-[var(--fg)] leading-none">
            {fmt(total)} <span className="text-xs text-[var(--fg-2)] font-sans">MXN</span>
          </p>
        </div>
        <button
          onClick={handlePay}
          disabled={total === 0 || paying}
          className="bg-arido-red text-white px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2 disabled:opacity-40"
        >
          <CreditCard size={14} />
          {paying ? t.paying : t.pay}
        </button>
      </div>
    </div>
  );
}
