"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, TriangleAlert } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Catalogo } from "@/lib/servicios";
import type { TipoServicio } from "@/lib/servicios-validar";
import { ServicioForm, type ItemServicio } from "@/components/admin/ServicioForm";
import { DisenoAdmin } from "@/components/admin/DisenoAdmin";
import type { ServicioDiseno } from "@/lib/diseno";

const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`;

const TABS: { id: TipoServicio; label: string; nuevo: string; ayuda: string }[] = [
  { id: "base", label: "Paquetes", nuevo: "Nuevo paquete", ayuda: "Lo primero que elige el cliente: qué incluye y cuánto cuesta." },
  { id: "extra", label: "Instrumentos", nuevo: "Nuevo instrumento", ayuda: "Instrumentos que se suman a un paquete. Cada uno genera su tarea “Grabar …” al vender." },
  { id: "studio", label: "Estudio", nuevo: "Nuevo servicio", ayuda: "Mezcla, grabación de voces y otros servicios sueltos." },
];

const nombreDe = (it: ItemServicio): string => ("name" in it ? it.name.es : it.label.es);

function detalleDe(it: ItemServicio): string {
  if ("includes" in it) return it.includes.es.filter((x) => !/mezcla|master/i.test(x)).join(" · ");
  if ("description" in it) return it.description.es;
  return "";
}

export function ServiciosPanel({ catalogo, enBase, sinMusico, diseno }: {
  catalogo: Catalogo; enBase: boolean; sinMusico: string[];
  /** Sólo para admin (trae el costo del diseñador); null = sin pestaña. */
  diseno: { catalogo: ServicioDiseno[]; enBase: boolean } | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TipoServicio | "diseno">("base");
  const [editando, setEditando] = useState<{ item: ItemServicio | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const tipo: TipoServicio = tab === "diseno" ? "base" : tab;
  const lista: ItemServicio[] = tipo === "base" ? catalogo.bases : tipo === "extra" ? catalogo.extras : catalogo.studio;
  const meta = TABS.find((t) => t.id === tipo)!;

  const llamar = async (method: string, body: unknown, ok?: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/servicios", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo guardar"}`); return; }
      if (ok) toast(ok);
      router.refresh();
    } catch {
      toast("Error de red");
    } finally {
      setBusy(false);
    }
  };

  const alternarVisible = (it: ItemServicio) =>
    llamar("PUT", { tipo, ...it, activo: !it.activo }, it.activo ? "✓ Oculto del cotizador" : "✓ Visible otra vez");

  const mover = (i: number, d: -1 | 1) => {
    const ids = lista.map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void llamar("PATCH", { tipo, ids });
  };

  return (
    <div>
      {tab !== "diseno" && !enBase && (
        <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
          <p className="flex items-center gap-2 text-amber-300 font-medium">
            <TriangleAlert size={16} /> El catálogo todavía se lee del archivo
          </p>
          <p className="text-white/60 text-xs mt-1">
            Para poder editarlo aquí, corre <b className="text-white/80">supabase-servicios-catalogo.sql</b> en Supabase.
            Si ya lo corriste y la tabla está vacía, carga el catálogo actual:
          </p>
          <button
            disabled={busy}
            onClick={() => llamar("POST", { accion: "sembrar" }, "✓ Catálogo cargado")}
            className="mt-2 px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 cursor-pointer disabled:opacity-50"
          >
            Cargar el catálogo actual
          </button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center mb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${tab === t.id ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
        {diseno && (
          <button
            onClick={() => setTab("diseno")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${tab === "diseno" ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
          >
            Diseño
          </button>
        )}
        {tab !== "diseno" && (
        <button
          disabled={!enBase}
          onClick={() => setEditando({ item: null })}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-white/10 hover:bg-white/15 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={15} /> {meta.nuevo}
        </button>
        )}
      </div>

      {tab === "diseno" && diseno && <DisenoAdmin catalogo={diseno.catalogo} enBase={diseno.enBase} />}

      {tab !== "diseno" && (
      <>
      <p className="text-white/40 text-xs mb-4">{meta.ayuda}</p>

      <div className="flex flex-col gap-2">
        {lista.map((it, i) => {
          const sinNadie = tab === "extra" && "graba" in it && it.graba && sinMusico.includes(it.id);
          return (
            <div key={it.id} className={`flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 sm:p-4 ${it.activo ? "" : "opacity-55"}`}>
              <div className="flex flex-col">
                <button aria-label="Subir" disabled={busy || i === 0} onClick={() => mover(i, -1)} className="text-white/40 hover:text-white disabled:opacity-20 cursor-pointer"><ArrowUp size={15} /></button>
                <button aria-label="Bajar" disabled={busy || i === lista.length - 1} onClick={() => mover(i, 1)} className="text-white/40 hover:text-white disabled:opacity-20 cursor-pointer"><ArrowDown size={15} /></button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
                  {nombreDe(it)}
                  {!it.activo && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">Oculto</span>}
                  {"graba" in it && !it.graba && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">Sin grabación</span>}
                  {sinNadie && (
                    <span title="Nadie del catálogo de músicos toca esto todavía" className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300">
                      Sin músico
                    </span>
                  )}
                </p>
                {detalleDe(it) && <p className="text-white/40 text-xs mt-0.5 truncate">{detalleDe(it)}</p>}
              </div>

              <p className="font-coolvetica text-lg shrink-0">{it.price > 0 ? pesos(it.price) : "—"}</p>

              <div className="flex shrink-0">
                <button title={it.activo ? "Ocultar del cotizador" : "Mostrar en el cotizador"} disabled={busy} onClick={() => alternarVisible(it)} className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-40">
                  {it.activo ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button title="Editar" disabled={!enBase} onClick={() => setEditando({ item: it })} className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-40">
                  <Pencil size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {lista.length === 0 && <p className="text-center text-white/40 text-sm py-12 border border-dashed border-white/10 rounded-2xl">Todavía no hay nada aquí.</p>}
      </div>
      </>
      )}

      {editando && tab !== "diseno" && (
        <ServicioForm
          tipo={tipo}
          inicial={editando.item}
          catalogo={catalogo}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
