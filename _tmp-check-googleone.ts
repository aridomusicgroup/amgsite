import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
async function main() {
  const { data: registros } = await sb.from("gastos_recurrentes").select("*").ilike("nombre", "%google%");
  console.log("REGISTRO(S):", JSON.stringify(registros, null, 2));

  const { data: egresos } = await sb.from("egresos").select("id, fecha, categoria, proveedor, descripcion, total_mxn, created_at").ilike("descripcion", "%google%").order("fecha", { ascending: false });
  console.log("\nEGRESOS relacionados:", JSON.stringify(egresos, null, 2));

  const { data: actividad } = await sb.from("actividad").select("titulo, created_at, meta").eq("tipo", "pago_recurrente_pendiente").ilike("titulo", "%google%").order("created_at", { ascending: false }).limit(10);
  console.log("\nBITÁCORA de avisos:", JSON.stringify(actividad, null, 2));
}
main();
