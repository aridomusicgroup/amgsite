import { notFound } from "next/navigation";
import { RenderNavHarness } from "@/components/dev/RenderNavHarness";

/**
 * Banco de pruebas de la onda de renders junto a "REAPER" en el menú, con el
 * menú de verdad y cada estado a un clic. En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RenderNavHarness />;
}
