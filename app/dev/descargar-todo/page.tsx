import { notFound } from "next/navigation";
import { DescargarTodo } from "@/components/cuenta/DescargarTodo";

/** Banco de pruebas del botón "Descargar todo" del panel del cliente. En producción no existe. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const archivos = ["og-arido.png", "og-lgb.png", "icon-arido.png"].map((n) => ({ nombre: n, url: `/${n}?v=1` }));
  return (
    <div className="min-h-screen bg-lgb-black p-4 text-white max-w-md mx-auto">
      <div className="border rounded-2xl p-4 bg-white/5 border-white/10">
        <p className="text-sm font-medium mb-3">Stems</p>
        <DescargarTodo archivos={archivos} nombreZip="Sangreloco - Stems" />
      </div>
    </div>
  );
}
