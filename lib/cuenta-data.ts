import { supabaseAdmin } from "@/lib/supabase/admin";
import { STATUS_LABEL } from "@/lib/admin-data";
import driveLinks from "@/data/drive-links.json";
import rawBeats from "@/data/beats-beatstars.json";
import licensesRaw from "@/data/licenses.json";
import { cleanTitle } from "@/lib/beatstars";
import { EXCLUSIVE_DIRECT_PRICE } from "@/lib/exclusive";
import { emailsDeCliente } from "@/lib/cuenta-cliente";
import { overridesCarpetas } from "@/lib/beat-carpetas";

const links = driveLinks as Record<
  string,
  { driveFolderId: string; subfolders?: Record<string, string> }
>;
const beats = rawBeats as Array<{ id: string; title: string }>;
const licenses = licensesRaw as Array<{
  id: string;
  price: number | null;
  exclusive: boolean;
  files: string[];
}>;

// Mapa título-completo-normalizado → carpeta de Drive (general + subcarpetas), por título sin truncar
const titleToBeat = new Map<string, { driveFolderId: string; subfolders?: Record<string, string> }>();
for (const beat of beats) {
  const link = links[beat.id];
  if (link) titleToBeat.set(cleanTitle(beat.title).toLowerCase(), link);
}

/** Según el monto pagado deducimos la licencia y qué tipos de archivo incluye. */
function filesForAmount(amount: number): { files: string[] | null; exclusive: boolean } {
  if (amount >= EXCLUSIVE_DIRECT_PRICE) return { files: null, exclusive: true }; // exclusiva → todo
  const lic = licenses.find((l) => !l.exclusive && l.price !== null && Math.abs(l.price - amount) < 0.5);
  return { files: lic?.files ?? null, exclusive: false };
}

export interface CustomerItem {
  description: string;
  amount: number;
  downloads: { label: string; url: string }[];
}
export interface CustomerOrder {
  id: string;
  type: "beat" | "servicio";
  status: string;
  statusLabel: string;
  total: number;
  currency: string;
  date: string;
  items: CustomerItem[];
}

export async function getCustomerOrders(email: string): Promise<{
  name: string | null;
  orders: CustomerOrder[];
}> {
  const sb = supabaseAdmin();
  // Todos los correos ligados a esta cuenta (principal + adicionales) → sus pedidos.
  const emails = await emailsDeCliente(email);
  const { data: customers } = await sb
    .from("customers")
    .select("name, orders(id, type, status, total, currency, created_at, order_items(description, amount))")
    .in("email", emails);

  if (!customers || !customers.length) return { name: null, orders: [] };
  const nombre = (customers.find((c) => c.name)?.name as string | null) ?? null;

  // Mapa título→carpeta: los 53 del JSON + los beats agregados desde el admin (tabla beats)
  const beatMap = new Map(titleToBeat);
  const tituloPorId = new Map<string, string>(beats.map((b) => [b.id, b.title]));
  try {
    const { data: dbBeats } = await sb.from("beats").select("id, title, drive_folder_id, drive_subfolders");
    for (const db of dbBeats ?? []) {
      tituloPorId.set(db.id as string, db.title as string);
      if (db.drive_folder_id) {
        beatMap.set(cleanTitle(db.title as string).toLowerCase(), {
          driveFolderId: db.drive_folder_id as string,
          subfolders: (db.drive_subfolders as Record<string, string>) || undefined,
        });
      }
    }
  } catch {
    /* sin beats extra en DB */
  }

  // La carpeta asignada a mano en el panel gana sobre las dos fuentes de arriba.
  for (const [id, carpeta] of await overridesCarpetas()) {
    const t = tituloPorId.get(id);
    if (t) beatMap.set(cleanTitle(t).toLowerCase(), carpeta);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = customers.flatMap((c) => (c.orders as any[]) ?? []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

  const orders: CustomerOrder[] = raw.map((o) => ({
    id: o.id,
    type: o.type === "servicio" ? "servicio" : "beat",
    status: o.status,
    statusLabel: STATUS_LABEL[o.status] ?? o.status,
    total: Number(o.total),
    currency: o.currency,
    date: o.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: ((o.order_items as any[]) ?? []).map((it) => {
      const link = beatMap.get(String(it.description).toLowerCase());
      const downloads: { label: string; url: string }[] = [];
      if (o.type === "beat" && link) {
        const { files, exclusive } = filesForAmount(Number(it.amount));
        if (exclusive || !link.subfolders || !files) {
          // Exclusiva (o beat sin subcarpetas): carpeta general con todo
          downloads.push({ label: "Todo", url: folderUrl(link.driveFolderId) });
        } else {
          // Solo las carpetas que incluye la licencia comprada
          for (const ft of files) {
            const id = link.subfolders[ft.toUpperCase()];
            if (id) downloads.push({ label: ft.toUpperCase(), url: folderUrl(id) });
          }
          if (!downloads.length) downloads.push({ label: "Descargar", url: folderUrl(link.driveFolderId) });
        }
      }
      return { description: it.description, amount: Number(it.amount), downloads };
    }),
  }));

  return { name: nombre, orders };
}
