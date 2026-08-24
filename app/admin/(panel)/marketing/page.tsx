import { requireModule } from "@/lib/supabase/auth-server";
import { getContactos, getVentas, getRecompraMarcas } from "@/lib/erp-data";
import { getAnalitica } from "@/lib/analitica";
import { candidatosRecompra } from "@/lib/recompra";
import { MarketingPanel, type ResumenRecompra, type ResumenSocial } from "@/components/admin/MarketingPanel";

export const dynamic = "force-dynamic";

/** Cuántos posts se muestran como "lo que mejor funcionó". */
const TOP_POSTS = 3;
/** Días de historia de seguidores en la mini gráfica. */
const DIAS_SERIE = 30;

export default async function MarketingPage() {
  const [, contactos, ventas, marcas, analitica] = await Promise.all([
    requireModule("/admin/marketing"),
    getContactos(),
    getVentas(),
    getRecompraMarcas(),
    getAnalitica(),
  ]);

  const cand = candidatosRecompra(contactos, marcas);
  const recompra: ResumenRecompra = {
    total: cand.length,
    tibios: cand.filter((k) => k.temperatura === "tibio").length,
    ltv: cand.reduce((a, k) => a + k.c.ltv, 0),
    primero: cand[0]?.c.nombre ?? null,
  };

  // Se recorta aquí (servidor) para no mandarle 100 publicaciones al navegador.
  const serie = (analitica?.snapshots ?? [])
    .filter((s) => s.seguidores != null)
    .slice(-DIAS_SERIE)
    .map((s) => ({ fecha: s.fecha, valor: s.seguidores as number }));

  const social: ResumenSocial | null = analitica
    ? {
        cuenta: analitica.cuenta.nombre,
        seguidores: analitica.seguidores,
        serie,
        publicaciones: analitica.publicaciones,
        reproducciones: analitica.reproduccionesTotales,
        interacciones: analitica.interaccionesTotales,
        ultimaSync: analitica.ultimaSync,
        top: [...analitica.posts]
          .sort((a, b) => b.reproducciones - a.reproducciones)
          .slice(0, TOP_POSTS)
          .map((p) => ({
            id: p.media_id,
            permalink: p.permalink,
            thumbnail: p.thumbnail,
            caption: p.caption ? p.caption.slice(0, 90) : null,
            reproducciones: p.reproducciones,
            interacciones: p.interacciones,
            publicado: p.publicado_at,
          })),
      }
    : null;

  return <MarketingPanel contactos={contactos} ventas={ventas} recompra={recompra} social={social} />;
}
