import { notFound } from "next/navigation";
import { CarritoIntlHarness } from "@/components/dev/CarritoIntlHarness";

/** Banco de pruebas del carrito con comisión internacional. En producción no existe. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CarritoIntlHarness />;
}
