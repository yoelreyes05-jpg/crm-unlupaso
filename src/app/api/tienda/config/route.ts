import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail, pick } from "@/lib/tienda/crud";

const CAMPOS = [
  "nombre_empresa", "slogan", "rnc", "telefono", "telefono2", "email", "direccion",
  "moneda", "simbolo_moneda", "itbis_pct", "dias_credito", "fondo_caja",
  "logo_url", "pie_factura",
];

/** Datos de la empresa (fila única id = 1). */
export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb.from("ti_config").select("*").eq("id", 1).single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return fail(err, "Error al leer la configuración");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sb = createAdminClient();
    const body = await req.json();
    const { data, error } = await sb
      .from("ti_config").update(pick(body, CAMPOS)).eq("id", 1).select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return fail(err, "Error al guardar la configuración");
  }
}

export const PUT = PATCH;
