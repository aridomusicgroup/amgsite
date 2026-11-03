import { notFound } from "next/navigation";
import { VocesHarness } from "@/components/dev/VocesHarness";

/** Banco de pruebas de "Tus voces" del panel del cliente, con datos de ejemplo. En producción no existe. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VocesHarness />;
}
