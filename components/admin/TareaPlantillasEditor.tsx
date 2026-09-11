"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, X, ChevronUp, ChevronDown, Save, Music, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toast";
import { TIPO_PROY_LABEL } from "@/lib/erp-data";
import { TIPO_CANCION, LABEL_CANCION, PASOS_CANCION_FABRICA } from "@/lib/cancion-plantilla";
import { PASOS, PASO_LABEL, PASO_TITULO, tipoLlevaPasos, type PasoEntrega } from "@/lib/pasos-entrega";

type Item = {
  clase: "tarea" | "instrumentos";
  titulo: string;
  resp: string | null;
  responsable_id: string | null;
  subs: string[];
  /** "Aprobada" / "Subir a Drive": con los dos marcados corre la entrega automática. */
  paso: PasoEntrega | null;
};
type Equipo = { id: string; nombre: string };

const vacio = (): Item => ({ clase: "tarea", titulo: "", resp: null, responsable_id: null, subs: [], paso: null });

/**
 * Qué tareas nacen con cada tipo de proyecto.
 *
 * Antes vivían en el código con sólo 4 tipos cubiertos, así que 8 de los 12
 * tipos de proyecto nacían sin ninguna tarea y eso sólo se descubría proyecto
 * por proyecto. Aquí se ven los 12 de un golpe.
 *
 * La fila morada de instrumentos es el HUECO donde se expanden las tareas
 * "Grabar X" de lo que traiga la venta. Es una fila y no una casilla porque no
 * siempre van al final: en un beat personalizado van entre la maqueta y la
 * edición, que es el orden real del trabajo.
 */
export function TareaPlantillasEditor() {
  const [plantillas, setPlantillas] = useState<Record<string, Item[]> | null>(null);
  const [equipo, setEquipo] = useState<Equipo[]>([]);
  const [sinTabla, setSinTabla] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";
  const tipos = Object.entries(TIPO_PROY_LABEL) as [string, string][];

  const cargar = async () => {
    try {
      const r = await fetch("/api/admin/tarea-plantillas", { cache: "no-store" });
      if (!r.ok) { setPlantillas({}); return; }
      const d = await r.json();
      setPlantillas(d.plantillas ?? {});
      setEquipo(d.equipo ?? []);
      setSinTabla(Boolean(d.sinTabla));
    } catch { setPlantillas({}); }
  };
  useEffect(() => { cargar(); }, []);

  const abrir = (tipo: string) => {
    setSel(tipo);
    const guardada = plantillas?.[tipo] ?? [];
    // Los temas SIEMPRE tienen pasos: sin plantilla guardada se usa la de
    // fábrica. Se muestra esa en vez de una lista vacía, para no decir
    // "nace vacío" de algo que no nace vacío.
    if (tipo === TIPO_CANCION && !guardada.length) {
      setItems(PASOS_CANCION_FABRICA.map((p) => ({ clase: p.clase, titulo: p.titulo, resp: p.resp, responsable_id: null, subs: [], paso: p.paso ?? null })));
      return;
    }
    setItems(guardada.map((i) => ({ ...i, paso: i.paso ?? null, subs: [...(i.subs ?? [])] })));
  };
  const esCancion = sel === TIPO_CANCION;

  /** Marca un renglón como paso de la entrega; si otro ya lo era, se lo quita. */
  const marcarPaso = (i: number, paso: PasoEntrega | null) =>
    setItems(items.map((it, k) => (k === i ? { ...it, paso } : paso && it.paso === paso ? { ...it, paso: null } : it)));

  // Un tipo de cliente sin "Aprobada" o sin "Subir a Drive" nunca abre el cuadro
  // de entrega. Se avisa aquí, donde se arregla, y no proyecto por proyecto.
  const faltan = sel && tipoLlevaPasos(sel) && items.length > 0
    ? PASOS.filter((p) => !items.some((it) => it.paso === p))
    : [];
  const agregarPasos = () =>
    setItems([
      ...items,
      ...faltan.map((p) => ({ ...vacio(), titulo: PASO_TITULO[p], resp: p === "aprobacion" ? "luis" : null, paso: p })),
    ]);

  const guardar = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/tarea-plantillas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: sel, nombre: sel === TIPO_CANCION ? LABEL_CANCION : (TIPO_PROY_LABEL[sel] ?? sel), items }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo guardar"}`); return; }
      await cargar();
      toast("✓ Guardado — los proyectos NUEVOS de ese tipo ya nacen así");
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  const restaurar = async () => {
    if (!sel) return;
    if (!confirm("¿Borrar esta plantilla? Ese tipo vuelve a la de fábrica, o a nacer sin tareas si no tenía una.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/tarea-plantillas?tipo=${encodeURIComponent(sel)}`, { method: "DELETE" });
      if (r.ok) { await cargar(); setItems([]); toast("✓ Borrada"); }
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  const mover = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const copia = [...items];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setItems(copia);
  };
  const cambiar = (i: number, patch: Partial<Item>) =>
    setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  const hayHueco = items.some((i) => i.clase === "instrumentos");

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <h2 className="font-coolvetica text-lg">Tareas que nacen con cada proyecto</h2>
      <p className="text-white/40 text-xs mt-0.5 mb-3">
        Cambiarlas afecta a los proyectos <b className="text-white/60">nuevos</b>; los que ya existen no se tocan.
        Un tipo sin plantilla nace <b className="text-white/60">sin ninguna tarea</b>.
      </p>

      {sinTabla && (
        <p className="text-amber-300/70 text-xs mb-3">
          Falta correr <code className="text-amber-300">supabase-tarea-plantillas.sql</code>. Mientras tanto se usan
          las plantillas de fábrica que viven en el código.
        </p>
      )}

      {plantillas === null ? (
        <p className="text-white/30 text-xs flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Cargando…</p>
      ) : (
        <div className="grid md:grid-cols-[190px_1fr] gap-4">
          {/* Los 12 tipos, para que se vea de un golpe cuáles nacen vacíos */}
          <ul className="space-y-1">
            {/* Los pasos DENTRO de cada tema. Va aparte y arriba porque no es un
                tipo de proyecto: es lo que nace en cada tema de un EP o álbum. */}
            <li>
              <button onClick={() => abrir(TIPO_CANCION)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors cursor-pointer border ${
                  sel === TIPO_CANCION ? "bg-lgb-red/15 text-white border-lgb-red/30" : "text-white/70 hover:bg-white/5 border-white/10"}`}>
                <span className="block truncate">{LABEL_CANCION}</span>
                <span className="text-[10px] text-white/30">
                  {plantillas[TIPO_CANCION]?.length
                    ? `${plantillas[TIPO_CANCION].length} paso(s) por tema`
                    : "usa la de fábrica"}
                </span>
              </button>
            </li>
            <li className="border-t border-white/5 !mt-2 pt-1" aria-hidden />
            {tipos.map(([id, label]) => {
              const n = plantillas[id]?.length ?? 0;
              return (
                <li key={id}>
                  <button onClick={() => abrir(id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                      sel === id ? "bg-lgb-red/15 text-white" : "text-white/55 hover:bg-white/5"}`}>
                    <span className="block truncate">{label}</span>
                    <span className={`text-[10px] ${n || id === "ep" || id === "album" ? "text-white/30" : "text-amber-300/60"}`}>
                      {id === "ep" || id === "album"
                        ? (n ? `${n} del disco + cada tema` : "sólo cada tema")
                        : n ? `${n} tarea${n === 1 ? "" : "s"}` : "sin tareas — nace vacío"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-w-0">
            {!sel ? (
              <p className="text-white/25 text-xs">Elige un tipo de la izquierda.</p>
            ) : (
              <>
                {esCancion && (
                  <p className="text-[11px] text-white/45 mb-2 leading-relaxed border-l-2 border-lgb-red/40 pl-2.5">
                    Cada renglón es una <b className="text-white/70">subtarea</b> que nace dentro de cada tema del
                    EP o álbum, en este orden. Un disco de 5 temas nace con estos pasos 5 veces.
                    {!(plantillas[TIPO_CANCION]?.length) && (
                      <> Ésta es la de fábrica; en cuanto guardes, se usa la tuya.</>
                    )}
                  </p>
                )}
                {(sel === "ep" || sel === "album") && (
                  <p className="text-[11px] text-white/45 mb-2 leading-relaxed border-l-2 border-white/15 pl-2.5">
                    Aquí van las tareas del <b className="text-white/70">disco completo</b> (portada, distribución…),
                    que nacen después de los temas. Los pasos de cada tema se editan en
                    <button onClick={() => abrir(TIPO_CANCION)} className="text-white/70 underline mx-1 cursor-pointer">{LABEL_CANCION}</button>.
                  </p>
                )}
                {faltan.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-amber-200/80 mb-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-2.5 py-2">
                    <AlertTriangle size={12} className="text-amber-300 shrink-0" />
                    <span className="flex-1 min-w-0">
                      Sin {faltan.map((p) => `“${PASO_TITULO[p]}”`).join(" ni ")} marcado{faltan.length > 1 ? "s" : ""}, la entrega
                      automática no corre: nadie abre el cuadro de entregables y stems al aprobar.
                    </span>
                    <button onClick={agregarPasos}
                      className="shrink-0 bg-amber-400/15 hover:bg-amber-400/25 text-amber-100 px-2 py-1 rounded-md cursor-pointer">
                      Agregar {faltan.length > 1 ? "los dos pasos" : "el paso"}
                    </button>
                  </div>
                )}
                <ul className="space-y-1.5 mb-2">
                  {items.map((it, i) => (
                    <li key={i} className={`rounded-lg border px-2.5 py-2 ${
                      it.clase === "instrumentos" ? "border-purple-400/30 bg-purple-400/[0.06]"
                        : it.paso ? "border-lgb-red/25 bg-lgb-red/[0.04]" : "border-white/8 bg-white/[0.02]"}`}>
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col shrink-0">
                          <button onClick={() => mover(i, -1)} className="text-white/25 hover:text-white cursor-pointer"><ChevronUp size={12} /></button>
                          <button onClick={() => mover(i, 1)} className="text-white/25 hover:text-white cursor-pointer"><ChevronDown size={12} /></button>
                        </div>
                        {it.clase === "instrumentos" && <Music size={13} className="text-purple-300 shrink-0" />}
                        <input value={it.titulo} onChange={(e) => cambiar(i, { titulo: e.target.value })}
                          placeholder={it.clase === "instrumentos" ? "Grabar {instrumento}" : esCancion ? "Paso del tema" : "Título de la tarea"}
                          className={`${inp} flex-1 min-w-0`} />
                        {it.clase === "tarea" && sel && tipoLlevaPasos(sel) && (
                          <select value={it.paso ?? ""} onChange={(e) => marcarPaso(i, (e.target.value || null) as PasoEntrega | null)}
                            title="Si es uno de los dos pasos que mueven la entrega automática"
                            className={`${inp} w-[7.5rem] cursor-pointer ${it.paso ? "text-lgb-red" : "text-white/35"}`}>
                            <option value="" className="bg-lgb-dark text-white">— paso normal</option>
                            {PASOS.map((p) => <option key={p} value={p} className="bg-lgb-dark text-white">{PASO_LABEL[p]}</option>)}
                          </select>
                        )}
                        <select value={it.responsable_id ?? ""} onChange={(e) => cambiar(i, { responsable_id: e.target.value || null })}
                          className={`${inp} w-32 cursor-pointer`}>
                          <option value="" className="bg-lgb-dark">{it.resp ? `(${it.resp})` : "— nadie —"}</option>
                          {equipo.map((e) => <option key={e.id} value={e.id} className="bg-lgb-dark">{e.nombre}</option>)}
                        </select>
                        <button onClick={() => setItems(items.filter((_, k) => k !== i))}
                          className="text-white/25 hover:text-red-300 shrink-0 cursor-pointer"><X size={14} /></button>
                      </div>
                      {it.clase === "tarea" && !esCancion && (
                        <textarea value={it.subs.join("\n")}
                          onChange={(e) => cambiar(i, { subs: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                          rows={it.subs.length ? it.subs.length + 1 : 1}
                          placeholder="Subtareas, una por línea (opcional)"
                          className={`${inp} w-full mt-1.5 text-xs resize-y`} />
                      )}
                      {it.clase === "instrumentos" && (
                        <p className="text-[10px] text-purple-300/60 mt-1 ml-6">
                          Aquí se expande una tarea por cada instrumento de la venta. <code>{"{instrumento}"}</code> se
                          sustituye por su nombre.
                        </p>
                      )}
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="text-white/30 text-xs py-2">
                      Sin tareas. Los proyectos de este tipo nacen vacíos.
                    </li>
                  )}
                </ul>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setItems([...items, vacio()])}
                    className="flex items-center gap-1 bg-white/8 hover:bg-white/12 text-white/70 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer">
                    <Plus size={12} /> {esCancion ? "Paso" : "Tarea"}
                  </button>
                  <button onClick={() => setItems([...items, { ...vacio(), clase: "instrumentos", titulo: "Grabar {instrumento}", resp: "eliud" }])}
                    disabled={hayHueco}
                    title={hayHueco ? "Ya hay un lugar para los instrumentos" : "Dónde se expanden las tareas de los instrumentos vendidos"}
                    className="flex items-center gap-1 bg-purple-400/15 hover:bg-purple-400/25 text-purple-200 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <Music size={12} /> Aquí van los instrumentos
                  </button>
                  <div className="flex-1" />
                  {(plantillas[sel]?.length ?? 0) > 0 && (
                    <button onClick={restaurar} disabled={busy}
                      className="text-white/35 hover:text-red-300 px-2 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-40">
                      Borrar plantilla
                    </button>
                  )}
                  <button onClick={guardar} disabled={busy}
                    className="flex items-center gap-1 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                  </button>
                </div>

                <p className="text-white/25 text-[10px] mt-2 flex items-start gap-1">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-300/50" />
                  <span>
                    Las <b className="text-white/40">subtareas</b> sólo se crean al nacer el proyecto; agregarlas
                    aquí no las mete en los que ya existen. Y si le quitas el
                    <b className="text-white/40"> lugar de los instrumentos</b> a un tipo de grabación, esas tareas
                    dejan de crearse y el músico a distancia se queda sin dónde ver su fecha límite.
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
