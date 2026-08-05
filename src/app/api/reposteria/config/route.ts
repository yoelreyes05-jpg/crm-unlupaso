import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const CLAVES = [
  "nombre","slogan","telefono","rnc","direccion",
  "moneda","itbis_pct","ncf_default","deposito_pct","logo_url",
];

// GET /api/reposteria/config → { data: { clave: valor } }
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("rep_config").select("*").order("clave");
    if (error) throw error;

    const config: Record<string, string> = {};
    for (const row of data ?? []) config[row.clave] = row.valor ?? "";
    return NextResponse.json({ data: config });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener configuración";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/reposteria/config
export async function PUT(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const upserts = Object.entries(body)
      .filter(([k]) => CLAVES.includes(k))
      .map(([clave, valor]) => ({
        clave,
        valor: String(valor ?? ""),
        updated_at: new Date().toISOString(),
      }));

    if (upserts.length === 0) {
      return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("rep_config")
      .upsert(upserts, { onConflict: "clave" })
      .select();

    if (error) throw error;
    return NextResponse.json({ data, message: "Configuración actualizada" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al guardar configuración";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
