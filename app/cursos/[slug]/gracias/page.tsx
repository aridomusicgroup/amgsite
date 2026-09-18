import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { getCursoPublico } from "@/lib/cursos-publico";

export const metadata: Metadata = { title: "¡Bienvenido!", robots: { index: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preventa?: string }> };

/** Después del pago: el acceso lo da el webhook; aquí sólo se explica cómo entrar (o, en preventa, que ya apartó). */
export default async function GraciasCursoPage({ params, searchParams }: Props) {
  const [{ slug }, { preventa }] = await Promise.all([params, searchParams]);
  const lanzamiento = preventa === "1" ? ((await getCursoPublico(slug))?.venta.lanzamiento ?? "") : null;

  return (
    <main className="min-h-screen bg-lgb-black text-white flex items-center">
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
        {lanzamiento != null ? (
          <>
            <h1 className="font-coolvetica text-3xl mb-3">¡Tu lugar de fundador está apartado!</h1>
            <p className="text-white/70 leading-relaxed mb-6">
              Tu pago quedó confirmado.{lanzamiento ? <> Lanzamiento: <span className="font-medium text-white">{lanzamiento}</span>.</> : null} Ese día te llega un correo y entras con el mismo correo con el que pagaste. Mientras, puedes crear tu contraseña.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-coolvetica text-3xl mb-3">¡Ya estás dentro!</h1>
            <p className="text-white/70 leading-relaxed mb-6">
              Tu pago quedó confirmado. En unos minutos te llega un correo con tu acceso. Entra con el mismo correo con el que pagaste.
            </p>
          </>
        )}
        <Link href="/cuenta/login" className="inline-flex items-center justify-center gap-2 w-full bg-lgb-red text-white py-4 rounded-full font-medium hover:bg-red-700 transition-colors">
          {lanzamiento != null ? "Crear mi acceso" : "Entrar a mi curso"}
        </Link>
        <p className="flex items-center justify-center gap-1.5 text-xs text-white/50 mt-4">
          <Mail size={13} /> Si es tu primera vez, elige “Primera vez / olvidé mi contraseña”.
        </p>
      </div>
    </main>
  );
}
