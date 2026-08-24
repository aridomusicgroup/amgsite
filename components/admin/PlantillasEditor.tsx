"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Save, RotateCcw, Eye, Check } from "lucide-react";

// Datos serializados desde el server (getPlantillasEditor). Se define local para
// no importar el módulo de datos (que arrastra pdf-lib / supabase) al cliente.
export interface PlantillaItem {
  tipo: string;
  label: string;
  titulo: string;
  cuerpo: string;
  seedTitulo: string;
  seedCuerpo: string;
  editada: boolean;
  updated_at: string | null;
  updated_por: string | null;
  esCotizacion: boolean;
}

interface Props {
  plantillas: PlantillaItem[];
}

// Chuleta de campos disponibles (espejo de CAMPOS_PLANTILLA en plantilla-parse).
const CAMPOS: { campo: string; desc: string }[] = [
  { campo: "{{cliente}}", desc: "Nombre del cliente" },
  { campo: "{{obra}}", desc: "Beat / obra (en mayúsculas)" },
  { campo: "{{monto}}", desc: "Precio con moneda" },
  { campo: "{{moneda}}", desc: "MXN / USD" },
  { campo: "{{fecha}}", desc: "Fecha larga" },
  { campo: "{{cliente_direccion}}", desc: "Dirección del cliente" },
  { campo: "{{cliente_telefono}}", desc: "Teléfono del cliente" },
  { campo: "{{cliente_email}}", desc: "Correo del cliente" },
  { campo: "{{vendedor}}", desc: "Nombres de los productores (ARIDO)" },
];

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

export function PlantillasEditor({ plantillas }: Props) {
  const router = useRouter();
  const [selTipo, setSelTipo] = useState<string>(plantillas[0]?.tipo ?? "");
  const sel = useMemo(() => plantillas.find((p) => p.tipo === selTipo) ?? plantillas[0], [plantillas, selTipo]);

  return (
    <div className="grid gap-5 md:grid-cols-[260px_1fr]">
      {/* Lista de plantillas */}
      <div className="flex flex-col gap-1.5">
        {plantillas.map((p) => (
          <button
            key={p.tipo}
            onClick={() => setSelTipo(p.tipo)}
            className={`flex items-start gap-2 text-left px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer ${sel?.tipo === p.tipo ? "bg-lgb-red text-white" : "bg-white/5 text-white/70 hover:text-white"}`}
          >
            <FileText size={15} className="mt-0.5 shrink-0 opacity-70" />
            <span className="flex-1">
              {p.label}
              {p.editada && (
                <span className={`block text-[11px] mt-0.5 ${sel?.tipo === p.tipo ? "text-white/70" : "text-green-400/80"}`}>● editada</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Editor */}
      {sel && <Editor key={sel.tipo} item={sel} onSaved={() => router.refresh()} />}
    </div>
  );
}

function Editor({ item, onSaved }: { item: PlantillaItem; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(item.titulo);
  const [cuerpo, setCuerpo] = useState(item.cuerpo);
  const [busy, setBusy] = useState<"" | "save" | "reset" | "preview">("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dirty = titulo !== item.titulo || cuerpo !== item.cuerpo;

  const guardar = async () => {
    setBusy("save"); setErr(null); setOk(false);
    try {
      await api("/api/admin/plantillas", "PUT", item.esCotizacion
        ? { tipo: item.tipo, terminos: cuerpo }
        : { tipo: item.tipo, titulo, cuerpo });
      setOk(true);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setBusy(""); }
  };

  const restaurar = async () => {
    if (!confirm("¿Restaurar el texto original? Se perderán tus cambios guardados en esta plantilla.")) return;
    setBusy("reset"); setErr(null); setOk(false);
    try {
      await api(`/api/admin/plantillas?tipo=${encodeURIComponent(item.tipo)}`, "DELETE");
      setTitulo(item.seedTitulo);
      setCuerpo(item.seedCuerpo);
      onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al restaurar"); }
    finally { setBusy(""); }
  };

  const verPdf = async () => {
    setBusy("preview"); setErr(null);
    try {
      const res = await fetch("/api/admin/plantillas/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.esCotizacion
          ? { tipo: item.tipo, terminos: cuerpo }
          : { tipo: item.tipo, titulo, cuerpo }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error al generar PDF");
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e) { setErr(e instanceof Error ? e.message : "Error al generar PDF"); }
    finally { setBusy(""); }
  };

  return (
    <div className="min-w-0">
      {/* Aviso legal */}
      <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 text-[13px] text-amber-200/90">
        Estos son textos con validez legal. Revisa bien cualquier cambio (idealmente con un abogado) antes de enviar contratos a clientes.
      </div>

      {!item.esCotizacion && (
        <label className="block mb-3">
          <span className="block text-xs text-white/50 mb-1">Título del contrato</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red"
          />
        </label>
      )}

      <label className="block">
        <span className="block text-xs text-white/50 mb-1">
          {item.esCotizacion ? "Términos del pie de la cotización" : "Cuerpo del contrato"}
        </span>
        <textarea
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          spellCheck={false}
          rows={item.esCotizacion ? 8 : 22}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[13px] leading-relaxed text-white/90 font-mono focus:outline-none focus:border-lgb-red resize-y"
        />
      </label>

      {/* Ayuda de formato */}
      <div className="mt-3 rounded-xl bg-white/5 border border-white/10 px-3.5 py-3 text-[12px] text-white/60">
        <p className="mb-2">
          <b className="text-white/80">Formato:</b> línea en blanco = nuevo párrafo · <code className="text-white/80">#&nbsp;Título</code> = encabezado centrado · <code className="text-white/80">-&nbsp;texto</code> = viñeta.
        </p>
        <p className="mb-1"><b className="text-white/80">Campos</b> (se rellenan solos al generar el PDF):</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {CAMPOS.map((c) => (
            <span key={c.campo}><code className="text-lgb-red">{c.campo}</code> <span className="text-white/45">{c.desc}</span></span>
          ))}
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

      {/* Acciones */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={guardar}
          disabled={!dirty || busy !== ""}
          className="flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {ok && !dirty ? <Check size={16} /> : <Save size={16} />}
          {busy === "save" ? "Guardando…" : ok && !dirty ? "Guardado" : "Guardar"}
        </button>
        <button
          onClick={verPdf}
          disabled={busy !== ""}
          className="flex items-center gap-2 bg-white/5 text-white/80 px-4 py-2 rounded-xl text-sm font-medium hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
        >
          <Eye size={16} /> {busy === "preview" ? "Generando…" : "Ver PDF de ejemplo"}
        </button>
        {item.editada && (
          <button
            onClick={restaurar}
            disabled={busy !== ""}
            className="flex items-center gap-2 text-white/50 px-3 py-2 rounded-xl text-sm hover:text-white transition-colors disabled:opacity-40 cursor-pointer ml-auto"
          >
            <RotateCcw size={15} /> Restaurar original
          </button>
        )}
      </div>
      {item.updated_at && (
        <p className="mt-2 text-[11px] text-white/35">
          Última edición: {new Date(item.updated_at).toLocaleString("es-MX")}{item.updated_por ? ` · ${item.updated_por}` : ""}
        </p>
      )}
    </div>
  );
}
