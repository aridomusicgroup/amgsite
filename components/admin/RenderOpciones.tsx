"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Loader2, FolderOpen, AlertTriangle, Send } from "lucide-react";
import type { ArchivoRpp, Renderizable, TipoRender, OpcionesRender, MusicoLite } from "@/lib/render-jobs";

/**
 * Cuadro de opciones antes de encolar un render.
 *
 * Todo llega prellenado con lo que el script haría por su cuenta, así que
 * aceptar sin tocar nada equivale al comportamiento de siempre. Lo que se puede
 * cambiar: cuál .rpp usar de base, qué tramo renderizar y —en stems— qué pistas.
 */

const TITULO: Record<TipoRender, string> = {
  previo: "Previo",
  entregables: "Entregables",
  stems: "Stems",
  musico: "Previo para músico",
};

const FORMATO: Record<TipoRender, string> = {
  previo: "MP3 128 kbps · 44.1 kHz",
  entregables: "MP3 320 kbps · 48 kHz + WAV 32-bit float",
  stems: "WAV 24-bit por pista, con mezcla y máster",
  musico: "MP3 128 kbps · 44.1 kHz · con BPM y tonalidad en el nombre",
};

type ModoRango = "todo" | "seleccion" | "marcadores";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** "hoy 14:32", "ayer", "hace 3 días" — para distinguir versiones de un vistazo. */
function cuando(ms: number): string {
  const d = new Date(ms);
  const dias = Math.floor((Date.now() - ms) / 86400000);
  if (dias <= 0) return `hoy ${d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function RenderOpciones({ p, tipo, musicos, enviando, onCerrar, onConfirmar }: {
  p: Renderizable;
  tipo: TipoRender;
  musicos: MusicoLite[];
  enviando: boolean;
  onCerrar: () => void;
  onConfirmar: (op: OpcionesRender) => void;
}) {
  const esMusico = tipo === "musico";
  // Sólo se puede mandar a quien tenga correo registrado.
  const conCorreo = musicos.filter((m) => m.email);
  const archivos = useMemo(() => p.inventario?.proyectos ?? [], [p.inventario]);
  const [rpp, setRpp] = useState(archivos[0]?.archivo ?? "");
  const actual: ArchivoRpp | undefined = archivos.find((a) => a.archivo === rpp) ?? archivos[0];

  /**
   * Quién se contrató para ESTE proyecto, según su venta.
   *
   * El catálogo no puede responder "¿quién toca el tololoche?" — hay dos
   * registrados, igual que dos trombones. La venta sí: en EL NECIO son Martín
   * en charchetas y Adal en tololoche. Se piden aquí y se preseleccionan.
   */
  const [deVenta, setDeVenta] = useState<{ id: string; nombre: string; instrumento: string; tienePortal: boolean; tieneCorreo: boolean }[]>([]);
  const [musicoId, setMusicoId] = useState("");
  // Dejarle además el trabajo en su portal. Prendido por default: mandarle el
  // previo sin asignarle nada lo deja con un correo y un portal vacío.
  const [asignar, setAsignar] = useState(true);
  const [instrumento, setInstrumento] = useState("");

  useEffect(() => {
    if (!esMusico) return;
    let vivo = true;
    fetch(`/api/admin/musicos-de-venta?proyecto_id=${p.proyectoId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { musicos: [] }))
      .then((d) => {
        if (!vivo) return;
        const lista = (d.musicos ?? []).filter((m: { tieneCorreo: boolean }) => m.tieneCorreo);
        setDeVenta(lista);
        // Si sólo se contrató a uno, ya está: es ese. Con varios se elige.
        if (lista.length === 1) { setMusicoId(lista[0].id); setInstrumento(lista[0].instrumento); }
      })
      .catch(() => { /* se sigue con el catálogo completo */ });
    return () => { vivo = false; };
  }, [esMusico, p.proyectoId]);

  /** Lo que dice la venta manda sobre el catálogo. */
  const instrumentoSugerido = (id: string) =>
    deVenta.find((x) => x.id === id)?.instrumento
    ?? conCorreo.find((x) => x.id === id)?.instrumentos[0]
    ?? "";
  /**
   * De dónde salen BPM y tonalidad, en orden:
   *  1. Lo capturado al crear la venta/proyecto — es el dato bueno.
   *  2. Si no hay: el BPM de la línea TEMPO del .rpp, y la tonalidad adivinada
   *     de cómo están nombrados los archivos (REAPER no la guarda).
   * Lo que se confirme aquí se guarda en el proyecto para la próxima vez.
   */
  const [bpm, setBpm] = useState(() => String(p.bpm ?? archivos[0]?.bpm ?? ""));
  const [tonalidad, setTonalidad] = useState(() => p.tonalidad ?? archivos[0]?.tonalidad ?? "");
  // Sólo se marca como "sugerida" si NO viene del proyecto: ese sí es dato duro.
  const tonoSugerido = !p.tonalidad && Boolean(actual?.tonalidad) && tonalidad === actual?.tonalidad;

  const marcadores = actual?.marcadores ?? [];
  const seleccion = actual?.seleccion?.valida ? actual.seleccion : null;
  const pistas = actual?.pistas ?? [];

  // DESMARCADO por defecto, a propósito.
  //
  // Antes venía palomeado, y con eso la decisión de mandarle el render al
  // cliente se tomaba de pasada al lanzarlo: cuando REAPER terminaba, subía y
  // mandaba el correo sin volver a preguntar. Un previo que no acabó de
  // convencerte se iba solo. Mandarlo tiene que ser un acto, no un descuido;
  // olvidar marcarlo solo deja el archivo listo para compartirlo después.
  const [avisar, setAvisar] = useState(false);
  const [modo, setModo] = useState<ModoRango>("todo");
  const [desde, setDesde] = useState(0);
  const [hasta, setHasta] = useState(Math.max(0, marcadores.length - 1));
  // Elegidas: arranca con lo que el script propondría solo.
  const [marcadas, setMarcadas] = useState<Set<string>>(
    () => new Set(pistas.filter((t) => t.esStem).map((t) => t.nombre)),
  );

  /** Cambiar de .rpp reinicia lo que dependía del anterior: sus marcadores y
   *  pistas son otros, y arrastrar la elección vieja daría un render
   *  silenciosamente distinto al que se ve en pantalla. */
  const cambiarRpp = (nombre: string) => {
    const a = archivos.find((x) => x.archivo === nombre);
    setRpp(nombre);
    setModo("todo");
    setDesde(0);
    setHasta(Math.max(0, (a?.marcadores.length ?? 1) - 1));
    setMarcadas(new Set((a?.pistas ?? []).filter((t) => t.esStem).map((t) => t.nombre)));
    // Lo del proyecto manda sobre lo que traiga el .rpp.
    setBpm(String(p.bpm ?? a?.bpm ?? ""));
    setTonalidad(p.tonalidad ?? a?.tonalidad ?? "");
  };

  const alternar = (nombre: string) =>
    setMarcadas((s) => {
      const n = new Set(s);
      if (n.has(nombre)) n.delete(nombre);
      else n.add(nombre);
      return n;
    });

  const rango =
    modo === "seleccion" && seleccion
      ? { inicio: seleccion.inicio, fin: seleccion.fin }
      : modo === "marcadores" && marcadores[desde] && marcadores[hasta]
        ? { inicio: marcadores[desde].seg, fin: marcadores[hasta].seg }
        : null;

  // Proyecto que sigue siendo la plantilla sin tocar: REAPER no produce nada y
  // el render falla diez minutos después. Mejor no dejar encolarlo.
  const vacio = actual?.items === 0;
  const rangoMalo = modo === "marcadores" && (!rango || rango.fin - rango.inicio < 1);
  const sinPistas = tipo === "stems" && marcadas.size === 0;
  // BPM y tonalidad son obligatorios: van en el nombre del archivo y son lo que
  // el músico necesita para ensayar. Sin eso el botón no se habilita.
  const bpmNum = Number(bpm);
  const musicoIncompleto =
    esMusico && (!musicoId || !bpm || !Number.isFinite(bpmNum) || bpmNum < 20 || bpmNum > 400 || !tonalidad.trim()
      || (asignar && !instrumento.trim()));
  const listo = !!actual && !vacio && !rangoMalo && !sinPistas && !musicoIncompleto && !enviando;

  const confirmar = () => {
    if (!listo || !actual) return;
    const op: OpcionesRender = { rpp: actual.archivo };
    if (rango) op.rango = rango;
    if (tipo === "stems") op.pistas = [...marcadas];
    if (esMusico) {
      op.musicoId = musicoId;
      op.bpm = bpmNum;
      op.tonalidad = tonalidad.trim();
      op.asignar = asignar;
      if (asignar) op.instrumento = instrumento.trim();
    } else {
      op.avisar = avisar && p.puedeAvisar;
    }
    onConfirmar(op);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCerrar}>
      <div
        className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-lgb-dark border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <p className="font-coolvetica text-lg truncate">
              {TITULO[tipo]} · {p.titulo}
            </p>
            <p className="text-white/40 text-xs mt-0.5">{FORMATO[tipo]}</p>
          </div>
          <button onClick={onCerrar} className="text-white/40 hover:text-white cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 flex flex-col gap-5">
          {!p.inventario ? (
            <Aviso>
              El script local todavía no ha revisado esta carpeta. Corre cada 2 minutos; en cuanto
              pase, aquí van a aparecer los proyectos disponibles.
            </Aviso>
          ) : p.inventario.error ? (
            <Aviso>{p.inventario.error}</Aviso>
          ) : (
            <>
              <Seccion titulo="Proyecto base" nota={`${archivos.length} archivo(s) en la carpeta`}>
                <div className="flex flex-col gap-1">
                  {archivos.map((a, i) => (
                    <label
                      key={a.archivo}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer border transition-colors ${
                        a.archivo === actual?.archivo
                          ? "bg-lgb-red/10 border-lgb-red/40"
                          : "bg-white/5 border-transparent hover:bg-white/10"
                      }`}
                    >
                      <input
                        type="radio"
                        checked={a.archivo === actual?.archivo}
                        onChange={() => cambiarRpp(a.archivo)}
                        className="accent-lgb-red"
                      />
                      <span className="text-sm truncate flex-1">{a.archivo}</span>
                      <span className="text-[11px] text-white/40 shrink-0">{cuando(a.mtime)}</span>
                      {i === 0 && <span className="text-[10px] text-lgb-red shrink-0">más reciente</span>}
                    </label>
                  ))}
                </div>
                {actual?.error && <p className="text-[11px] text-amber-300 mt-2">⚠ {actual.error}</p>}
                {vacio && (
                  <div className="mt-2">
                    <Aviso>
                      Este proyecto no tiene ni un audio adentro — sigue siendo la plantilla tal
                      como se creó. Ábrelo en REAPER, mete las pistas y guarda; en cuanto lo hagas
                      el botón se habilita solo.
                    </Aviso>
                  </div>
                )}
              </Seccion>

              <Seccion titulo="Rango">
                <div className="flex flex-col gap-1">
                  <Opcion activo={modo === "todo"} onClick={() => setModo("todo")}>
                    Todo el proyecto
                  </Opcion>

                  <Opcion
                    activo={modo === "seleccion"}
                    onClick={() => seleccion && setModo("seleccion")}
                    inhabil={!seleccion}
                  >
                    Selección guardada
                    {seleccion ? (
                      <span className="text-white/40 ml-2">
                        {mmss(seleccion.inicio)} – {mmss(seleccion.fin)}
                      </span>
                    ) : (
                      <span className="text-white/30 ml-2">— este proyecto no tiene una válida</span>
                    )}
                  </Opcion>

                  <Opcion
                    activo={modo === "marcadores"}
                    onClick={() => marcadores.length >= 2 && setModo("marcadores")}
                    inhabil={marcadores.length < 2}
                  >
                    Entre marcadores
                    {marcadores.length < 2 && (
                      <span className="text-white/30 ml-2">— este proyecto no tiene marcadores</span>
                    )}
                  </Opcion>

                  {modo === "marcadores" && marcadores.length >= 2 && (
                    <div className="flex items-center gap-2 pl-8 pt-1">
                      <SelectMarcador valor={desde} onChange={setDesde} marcadores={marcadores} />
                      <span className="text-white/30 text-xs">→</span>
                      <SelectMarcador valor={hasta} onChange={setHasta} marcadores={marcadores} />
                    </div>
                  )}
                  {rangoMalo && (
                    <p className="text-[11px] text-red-300 pl-8 pt-1">
                      El segundo marcador tiene que ir después del primero.
                    </p>
                  )}
                </div>
              </Seccion>

              {tipo === "stems" && (
                <Seccion
                  titulo="Pistas a exportar"
                  nota={`${marcadas.size} de ${pistas.filter((t) => !t.silenciada).length}`}
                >
                  {pistas.length === 0 ? (
                    <p className="text-white/40 text-sm">No se encontraron pistas en este proyecto.</p>
                  ) : (
                    <>
                      {!pistas.some((t) => t.esStem) && (
                        <p className="text-[11px] text-amber-300 mb-2">
                          Este proyecto no usa la estructura de MIXBUS, así que no hay ninguna
                          propuesta automática — elige tú cuáles exportar.
                        </p>
                      )}
                      <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                        {pistas.map((t, i) => (
                          <label
                            key={`${t.nombre}-${i}`}
                            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm ${
                              t.silenciada ? "opacity-40" : "hover:bg-white/5 cursor-pointer"
                            }`}
                            style={{ paddingLeft: `${8 + Math.min(t.profundidad, 3) * 16}px` }}
                          >
                            <input
                              type="checkbox"
                              disabled={t.silenciada}
                              checked={marcadas.has(t.nombre)}
                              onChange={() => alternar(t.nombre)}
                              className="accent-lgb-red"
                            />
                            <span className="truncate">{t.nombre}</span>
                            {t.silenciada && <span className="text-[10px] text-white/40 shrink-0">silenciada</span>}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </Seccion>
              )}

              {esMusico ? (
                <Seccion titulo="Para quién es" nota="obligatorio">
                  {conCorreo.length === 0 ? (
                    <Aviso>
                      Ningún músico tiene correo registrado. Agrégaselo en Ajustes → Músicos y
                      vuelve aquí.
                    </Aviso>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <select
                        value={musicoId}
                        onChange={(e) => {
                          setMusicoId(e.target.value);
                          setInstrumento(instrumentoSugerido(e.target.value));
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lgb-red cursor-pointer"
                      >
                        <option value="" className="bg-lgb-dark">Elige al músico…</option>
                        {deVenta.length > 0 && (
                          <optgroup label="Contratados en esta venta" className="bg-lgb-dark">
                            {deVenta.map((m) => (
                              <option key={m.id} value={m.id} className="bg-lgb-dark">
                                {m.nombre}{m.instrumento ? ` — ${m.instrumento}` : ""}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label={deVenta.length ? "Todos los músicos" : ""} className="bg-lgb-dark">
                          {conCorreo
                            .filter((m) => !deVenta.some((x) => x.id === m.id))
                            .map((m) => (
                              <option key={m.id} value={m.id} className="bg-lgb-dark">
                                {m.nombre}{m.instrumentos.length ? ` — ${m.instrumentos.join(", ")}` : ""}
                              </option>
                            ))}
                        </optgroup>
                      </select>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="block text-[11px] text-white/40 mb-1">BPM</span>
                          <input
                            type="number" min={20} max={400} value={bpm} placeholder="154"
                            onChange={(e) => setBpm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-lgb-red"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[11px] text-white/40 mb-1">
                            Tonalidad
                            {tonoSugerido && <span className="text-amber-300/70"> · sugerida, confírmala</span>}
                          </span>
                          <input
                            type="text" maxLength={12} value={tonalidad} placeholder="Am"
                            onChange={(e) => setTonalidad(e.target.value)}
                            className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-lgb-red ${
                              tonoSugerido ? "border-amber-400/40" : "border-white/10"
                            }`}
                          />
                        </label>
                      </div>

                      <label
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                          asignar ? "bg-lgb-red/10 border-lgb-red/40" : "bg-white/5 border-transparent hover:bg-white/10"
                        }`}
                      >
                        <input type="checkbox" checked={asignar} onChange={(e) => setAsignar(e.target.checked)}
                          className="mt-0.5 accent-lgb-red" />
                        <span className="min-w-0">
                          <span className="block text-sm text-white">Habilitárselo en su portal</span>
                          <span className="block text-[11px] text-white/40 leading-relaxed mt-0.5">
                            Para que pueda subirte sus pistas desde /musico. Sin esto solo recibe el
                            previo por correo y su portal se queda vacío.
                          </span>
                        </span>
                      </label>

                      {asignar && (
                        <label className="block">
                          <span className="block text-[11px] text-white/40 mb-1">
                            Qué va a grabar{" "}
                            {deVenta.some((x) => x.id === musicoId)
                              ? <span className="text-green-300/60">· lo que dice la venta</span>
                              : <span className="text-white/25">(en esta canción)</span>}
                          </span>
                          <input
                            type="text" maxLength={40} value={instrumento} placeholder="Charchetas"
                            onChange={(e) => setInstrumento(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-lgb-red"
                          />
                        </label>
                      )}

                      <p className="text-[11px] text-white/30 leading-relaxed">
                        Van en el nombre del archivo:{" "}
                        <span className="text-white/50">
                          {p.titulo.toUpperCase()} {bpm || "___"}bpm {tonalidad || "__"}.mp3
                        </span>
                        <br />
                        Se le manda por correo un enlace de Drive. Ese enlace lo puede abrir
                        cualquiera que lo tenga, así que no lo reenvíes de más.
                      </p>
                    </div>
                  )}
                </Seccion>
              ) : (
              <Seccion titulo="Cliente">
                <label
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                    avisar ? "bg-lgb-red/10 border-lgb-red/40" : "bg-white/5 border-transparent"
                  } ${p.puedeAvisar ? "cursor-pointer hover:bg-white/10" : "opacity-40 cursor-not-allowed"}`}
                >
                  <input
                    type="checkbox"
                    checked={avisar}
                    disabled={!p.puedeAvisar}
                    onChange={(e) => setAvisar(e.target.checked)}
                    className="accent-lgb-red mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm">
                      <Send size={13} /> Avisar a {p.cliente}
                    </span>
                    <span className="block text-[11px] text-white/40 mt-0.5 leading-relaxed">
                      {p.puedeAvisar
                        ? "Le llega un correo y el archivo aparece en su cuenta para escucharlo. Sin marcar, el render queda solo para uso interno."
                        : "Este proyecto no tiene pedido ligado o el cliente no tiene correo, así que no se le puede avisar."}
                    </span>
                  </span>
                </label>
              </Seccion>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-5 pt-3 border-t border-white/5">
          {/* La carpeta y cuándo se revisó: si acabas de guardar en REAPER y
              todavía no aparece el .rpp nuevo, esto explica por qué. */}
          <p className="text-[11px] text-white/30 truncate flex items-center gap-1.5 min-w-0">
            <FolderOpen size={12} className="shrink-0" />
            <span className="truncate">{p.inventario?.carpeta ?? "—"}</span>
            {p.inventario && (
              <span className="shrink-0 text-white/20">· revisado {cuando(new Date(p.inventario.escaneadoEn).getTime())}</span>
            )}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onCerrar} className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={!listo}
              className="flex items-center gap-2 bg-lgb-red hover:bg-lgb-red/85 text-white px-4 py-2 rounded-xl text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {enviando && <Loader2 size={14} className="animate-spin" />}
              Renderizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs text-white/50">{titulo}</p>
        {nota && <p className="text-[11px] text-white/30">{nota}</p>}
      </div>
      {children}
    </div>
  );
}

function Opcion({ activo, inhabil, onClick, children }: {
  activo: boolean; inhabil?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={inhabil}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left border transition-colors ${
        activo ? "bg-lgb-red/10 border-lgb-red/40" : "bg-white/5 border-transparent"
      } ${inhabil ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-white/10"}`}
    >
      <span
        className={`w-3.5 h-3.5 rounded-full border shrink-0 ${
          activo ? "border-lgb-red bg-lgb-red" : "border-white/30"
        }`}
      />
      <span className="min-w-0">{children}</span>
    </button>
  );
}

function SelectMarcador({ valor, onChange, marcadores }: {
  valor: number; onChange: (n: number) => void; marcadores: { nombre: string; seg: number }[];
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-lgb-red cursor-pointer"
    >
      {marcadores.map((m, i) => (
        <option key={i} value={i} className="bg-lgb-dark">
          {m.nombre || `Marcador ${i + 1}`} · {mmss(m.seg)}
        </option>
      ))}
    </select>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3">
      <AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" />
      <p className="text-amber-100/80 text-xs leading-relaxed">{children}</p>
    </div>
  );
}
