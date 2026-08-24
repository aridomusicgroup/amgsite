import { NextResponse } from "next/server";
import licenses from "@/data/licenses.json";

export async function GET() {
  return NextResponse.json({ licenses });
}
