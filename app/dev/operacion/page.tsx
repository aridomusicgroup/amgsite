import { notFound } from "next/navigation";
import { OperacionHarness } from "@/components/dev/OperacionHarness";

/** Banco de pruebas de Dashboard → Operación. En producción no existe. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <OperacionHarness />;
}
