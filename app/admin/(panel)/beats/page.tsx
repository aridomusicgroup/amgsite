import type { Metadata } from "next";
import { requireModule } from "@/lib/supabase/auth-server";
import { AddBeatPanel } from "@/components/admin/AddBeatPanel";

export const metadata: Metadata = { title: "Beats — Admin ARIDO", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BeatsPage() {
  await requireModule("/admin/beats");
  return <AddBeatPanel />;
}
