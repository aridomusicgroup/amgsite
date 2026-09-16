import { notFound } from "next/navigation";
import { OrigenesHarness } from "@/components/dev/OrigenesHarness";

/** Banco de pruebas del tablero "De dónde llegan los clientes". En producción no existe. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <OrigenesHarness />;
}
