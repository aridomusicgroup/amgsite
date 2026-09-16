import { notFound } from "next/navigation";
import { NuevaVentaForm } from "@/components/admin/NuevaVentaForm";

/** Banco de pruebas de "Nueva venta" con clientes de ejemplo. En producción no existe. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="min-h-screen bg-lgb-dark text-white p-4 sm:p-8 max-w-4xl mx-auto">
      <NuevaVentaForm
        beats={[{ id: "b1", nombre: "CHANEL" }]}
        clientes={[
          { id: "00000000-0000-0000-0000-00000000000a", nombre: "Juan José Pemberthy", email: "juanjo@correo.com", telefono: "4881234567", origen: "instagram", origen_post_id: null, origen_enlace: null },
          { id: "00000000-0000-0000-0000-00000000000b", nombre: "Rocha", email: null, telefono: "4779876543", origen: null, origen_post_id: null, origen_enlace: null },
        ]}
      />
    </main>
  );
}
