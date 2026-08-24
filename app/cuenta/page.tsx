import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { FolderDown, Clock, LogOut, ShoppingBag, Music2, Headphones, FileText, Download, GraduationCap } from "lucide-react";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { getCustomerOrders } from "@/lib/cuenta-data";
import { getClienteProfile, getClienteContratos } from "@/lib/cuenta-cliente";
import { cursosDelCliente } from "@/lib/cursos-cliente";
import { acuerdosPendientes } from "@/lib/acuerdos/server";
import { AcuerdoGate } from "@/components/cuenta/AcuerdoGate";
import { PerfilCard } from "@/components/cuenta/PerfilCard";
import { FidelidadBanner } from "@/components/cuenta/FidelidadBanner";
import { nivelDeCliente } from "@/lib/fidelidad-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SOCIALS } from "@/lib/site";
import { WhatsappIcon } from "@/components/shared/BrandIcons";

export const metadata: Metadata = {
  title: "Mi Cuenta — Latino Gang Beats",
  robots: { index: false },
  icons: { icon: "/icon-lgb.png" },
};

export const dynamic = "force-dynamic";

const STATUS_STEP: Record<string, number> = {
  nuevo: 1,
  en_produccion: 2,
  revision: 3,
  entregado: 4,
};

export default async function CuentaPage() {
  const email = await getCustomerEmail();
  if (!email) redirect("/cuenta/login");

  const [{ name, orders }, perfil, contratos, pendientes, fidelidad, cursos] = await Promise.all([
    getCustomerOrders(email),
    getClienteProfile(email),
    getClienteContratos(email),
    acuerdosPendientes(email),
    nivelDeCliente(supabaseAdmin(), email),
    cursosDelCliente(email),
  ]);

  // Puerta: solo bloquea si tiene un acuerdo pendiente de VERDAD — alguien que
  // nada más ha comprado licencias de catálogo no le toca firmar nada aquí.
  // Va después del perfil para poder proponerle su nombre ya escrito.
  if (pendientes.length > 0) {
    return <AcuerdoGate pendientes={pendientes} nombreSugerido={perfil.nombre || name || ""} />;
  }

  const beats = orders.filter((o) => o.type === "beat");
  const servicios = orders.filter((o) => o.type === "servicio");
  const displayName = perfil.nombre || name;

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Image
            src="/logos/lgb-hero.png"
            alt="Latino Gang Beats"
            width={120}
            height={34}
            className="h-7 w-auto object-contain"
          />
          <a
            href="/api/cuenta/logout"
            className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors"
          >
            <LogOut size={13} /> Salir
          </a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <h1 className="font-coolvetica text-3xl mb-1">
          Hola{displayName ? `, ${displayName.split(" ")[0]}` : ""} 🌵
        </h1>
        <p className="text-white/40 text-sm mb-8">{email}</p>

        <FidelidadBanner fidelidad={fidelidad} />

        {/* Datos del cliente → alimentan el CRM y los contratos */}
        <div className="mb-8">
          <PerfilCard
            nombre={perfil.nombre}
            telefono={perfil.telefono}
            direccion={perfil.direccion}
            completo={perfil.completo}
          />
        </div>

        {/* Mis contratos */}
        {contratos.length > 0 && (
          <section className="mb-10">
            <h2 className="flex items-center gap-2 font-coolvetica text-xl mb-4">
              <FileText size={18} className="text-lgb-red" /> Mis contratos
            </h2>
            <div className="flex flex-col gap-3">
              {contratos.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.concepto || "Contrato"}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {c.folio} · {new Date(c.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <a
                    href={`/api/cuenta/contrato/pdf?id=${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-lgb-red text-white text-xs px-3.5 py-2 rounded-full hover:bg-red-700 transition-all shrink-0"
                  >
                    <Download size={13} /> Ver PDF
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Mis cursos */}
        {cursos.length > 0 && (
          <section className="mb-10">
            <h2 className="flex items-center gap-2 font-coolvetica text-xl mb-4">
              <GraduationCap size={18} className="text-lgb-red" /> Mis cursos
            </h2>
            <div className="flex flex-col gap-3">
              {cursos.map((c) => (
                <a
                  key={c.id}
                  href={`/cuenta/curso/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 hover:border-white/20 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.titulo}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-24 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-lgb-red rounded-full" style={{ width: `${c.pct}%` }} />
                      </div>
                      <span className="text-white/40 text-[11px]">{c.pct}%</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {orders.length === 0 ? (
          contratos.length === 0 && cursos.length === 0 && (
            <div className="text-center py-12 text-white/40">
              <ShoppingBag size={40} strokeWidth={1} className="mx-auto mb-4" />
              <p className="mb-4">Aún no tienes compras con este correo.</p>
              <a
                href="https://beats.aridomusicgroup.com"
                className="inline-block bg-lgb-red text-white px-6 py-2.5 rounded-full text-sm hover:bg-red-700 transition-all"
              >
                Explorar beats
              </a>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-10">
            {/* Beats */}
            {beats.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 font-coolvetica text-xl mb-4">
                  <Music2 size={18} className="text-lgb-red" /> Mis beats
                </h2>
                <div className="flex flex-col gap-3">
                  {beats.flatMap((o) =>
                    o.items.map((it, idx) => (
                      <div
                        key={`${o.id}-${idx}`}
                        className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{it.description}</p>
                          <p className="text-white/40 text-xs mt-0.5">
                            {new Date(o.date).toLocaleDateString("es-MX", {
                              day: "2-digit", month: "long", year: "numeric",
                            })}
                          </p>
                        </div>
                        {it.downloads.length > 0 ? (
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {it.downloads.map((d) => (
                              <a
                                key={d.url}
                                href={d.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 bg-lgb-red text-white text-xs px-3.5 py-2 rounded-full hover:bg-red-700 transition-all"
                              >
                                <FolderDown size={13} /> {d.label}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1.5 text-white/40 text-xs shrink-0">
                            <Clock size={13} /> Por email
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Servicios con seguimiento */}
            {servicios.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 font-coolvetica text-xl mb-4">
                  <Headphones size={18} className="text-lgb-red" /> Mis producciones
                </h2>
                <div className="flex flex-col gap-4">
                  {servicios.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {o.items.map((i) => i.description).join(" · ") || "Producción"}
                          </p>
                          <p className="text-white/40 text-xs mt-0.5">
                            {new Date(o.date).toLocaleDateString("es-MX", {
                              day: "2-digit", month: "long", year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      {o.status === "cancelado" ? (
                        <p className="text-white/40 text-xs">Pedido cancelado.</p>
                      ) : (
                        <>
                          <Pipeline step={STATUS_STEP[o.status] ?? 1} label={o.statusLabel} />
                          <a
                            href={`/cuenta/pedido/${o.id}`}
                            className="mt-4 inline-flex items-center gap-1.5 bg-lgb-red/15 text-lgb-red border border-lgb-red/30 px-4 py-2 rounded-full text-xs font-medium hover:bg-lgb-red/25 transition-colors"
                          >
                            Ver detalles del avance →
                          </a>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Ayuda */}
        <div className="mt-12 rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-center">
          <p className="text-white/50 text-sm mb-3">
            ¿Dudas con tu compra o tu producción?
          </p>
          <a
            href={SOCIALS.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 px-5 py-2.5 rounded-full text-sm hover:bg-[#25D366]/25 transition-colors"
          >
            <WhatsappIcon size={14} /> Escríbenos por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}

function Pipeline({ step, label }: { step: number; label: string }) {
  const steps = ["Recibido", "En producción", "En revisión", "Entregado"];
  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < step ? "bg-lgb-red" : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-white/40 text-[11px]">{steps[0]}</span>
        <span className="text-lgb-red text-xs font-medium">{label}</span>
        <span className="text-white/40 text-[11px]">{steps[3]}</span>
      </div>
    </div>
  );
}
