import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Clock, FolderDown, Lock } from "lucide-react";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { getPedidoDetalle, rendersDelPedido, entregaDelPedido } from "@/lib/cuenta-cliente";
import { acuerdosPendientes } from "@/lib/acuerdos/server";
import { PedidoProgreso, EntregaChip } from "@/components/cuenta/PedidoProgreso";
import { SubirArchivos } from "@/components/cuenta/SubirArchivos";
import { RendersPedido } from "@/components/cuenta/RendersPedido";
import { SOCIALS } from "@/lib/site";
import { WhatsappIcon } from "@/components/shared/BrandIcons";

export const metadata: Metadata = {
  title: "Mi pedido — Latino Gang Beats",
  robots: { index: false },
  icons: { icon: "/icon-lgb.png" },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PedidoPage({ params }: Props) {
  const { id } = await params;
  const email = await getCustomerEmail();
  if (!email) redirect("/cuenta/login");

  // El pedido es enlazable directo, así que la puerta del acuerdo también se
  // revisa aquí: si no, bastaba con guardar el link para saltársela.
  if ((await acuerdosPendientes(email)).length > 0) redirect("/cuenta");

  const d = await getPedidoDetalle(email, id);
  if (!d) redirect("/cuenta");

  // Primero la entrega: si ya liquidó y algo seguía retenido, aquí se libera, y
  // así los archivos aparecen abajo en esta misma visita.
  const ent = await entregaDelPedido(email, id);
  // Previos y entregables que el equipo marcó para compartirle.
  const renders = await rendersDelPedido(email, id);

  const entregado = d.total > 0 && d.hechas >= d.total;
  // Solo enlaces http(s) (evita esquemas peligrosos como javascript:). Y sólo
  // si ya liquidó: es la carpeta de los archivos finales.
  const entregable = ent.finiquitado && d.entregableUrl && /^https?:\/\//i.test(d.entregableUrl.trim()) ? d.entregableUrl.trim() : null;
  const saldoTxt = `$${Math.round(ent.saldo).toLocaleString("es-MX")}`;

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      <header className="border-b border-white/5">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <Image src="/logos/lgb-hero.png" alt="Latino Gang Beats" width={120} height={34} className="h-7 w-auto object-contain" />
          <a href="/cuenta" className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors">
            <ArrowLeft size={13} /> Mi cuenta
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8">
        {entregable && (
          <a
            href={entregable}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 mb-6 rounded-2xl border border-lgb-red/30 bg-lgb-red/[0.08] p-4 hover:bg-lgb-red/[0.14] transition-colors"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-lgb-red/20 text-lgb-red shrink-0">
              <FolderDown size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-white">Tus entregables están listos</span>
              <span className="block text-white/50 text-xs">Toca para abrir tus archivos 🎧</span>
            </span>
          </a>
        )}
        {d.total > 0 ? (
          <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-6 sm:p-8">
            <PedidoProgreso
              concepto={d.concepto}
              tareas={d.tareas}
              hechas={d.hechas}
              total={d.total}
              pct={d.pct}
              entregado={entregado}
              revisionActual={d.revisionActual}
              esAlbum={d.esAlbum}
              fechaEntrega={d.fechaEntrega}
              fechaEntregaReal={d.fechaEntregaReal}
            />
          </div>
        ) : (
          <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-8 text-center">
            <Clock size={36} strokeWidth={1.2} className="mx-auto mb-4 text-lgb-red" />
            <h1 className="font-coolvetica text-2xl mb-1">{d.concepto}</h1>
            <p className="text-white/50 text-sm">
              Estamos preparando tu producción. Muy pronto verás aquí el avance paso a paso. 🌵
            </p>
            {/* Aún sin etapas que mostrar, pero si ya hay fecha comprometida el
                cliente merece verla desde el primer día. */}
            <div className="pp-chips justify-center">
              <EntregaChip entregado={false} fechaEntrega={d.fechaEntrega} fechaEntregaReal={d.fechaEntregaReal} />
            </div>
          </div>
        )}

        {/* Ya está en Drive pero debe saldo: la buena noticia primero, y el
            saldo como el último paso — no como un reclamo. */}
        {!ent.finiquitado && ent.listas && (
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-5">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-400/15 text-amber-300 shrink-0">
                <Lock size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Tus archivos finales ya están listos 🎉</p>
                <p className="text-white/55 text-xs mt-1 leading-relaxed">
                  Se desbloquean en cuanto quede liquidado el saldo de <b className="text-white">{saldoTxt}</b>.
                  Tus previos siguen aquí abajo para escucharlos.
                </p>
                {ent.urlPago ? (
                  <a
                    href={ent.urlPago}
                    className="inline-flex items-center gap-2 mt-3 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    Pagar {saldoTxt} y descargar
                  </a>
                ) : (
                  <p className="text-white/40 text-xs mt-3">Escríbenos por WhatsApp y coordinamos el pago.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <RendersPedido pedidoId={id} renders={renders} />

        {d.proyectoEstado !== null && (
          <div className="mt-8">
            <SubirArchivos pedidoId={id} />
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-center">
          <p className="text-white/50 text-sm mb-3">¿Dudas sobre tu producción?</p>
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
