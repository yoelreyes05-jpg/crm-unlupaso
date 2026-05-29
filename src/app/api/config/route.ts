import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/config  — obtener todas las configuraciones del negocio
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ul_config")
      .select("*")
      .order("clave");

    if (error) throw error;

    // Convertir array a objeto { clave: valor }
    const config: Record<string, string> = {};
    for (const row of data ?? []) {
      config[row.clave] = row.valor ?? "";
    }

    return NextResponse.json({ data: config });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener configuración";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/config  — actualizar/crear múltiples claves
// Body: { nombre, slogan, telefono, rnc, direccion, moneda, itbis_pct, ncf_default, logo_url }
export async function PUT(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const allowed = [
      "nombre", "slogan", "telefono", "rnc", "direccion",
      "moneda", "itbis_pct", "ncf_default", "logo_url",
    ];

    const upserts = Object.entries(body)
      .filter(([key]) => allowed.includes(key))
      .map(([clave, valor]) => ({
        clave,
        valor: String(valor),
        updated_at: new Date().toISOString(),
      }));

    if (upserts.length === 0) {
      return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("ul_config")
      .upsert(upserts, { onConflict: "clave" })
      .select();

    if (error) throw error;

    return NextResponse.json({ data, message: "Configuración actualizada" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al guardar configuración";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
