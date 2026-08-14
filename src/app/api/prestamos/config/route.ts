import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail, pick } from "@/lib/prestamos/crud";

const CAMPOS = [
  "nombre_empresa", "rnc", "telefono", "direccion", "moneda", "simbolo_moneda",
  "metodo_prorrateo", "dias_gracia", "tasa_mora", "mora_activa_default",
  "tasa_cliente_default", "tasa_inv_default", "logo_url",
];

/** Configuración del módulo (fila única id = 1). */
export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb.from("pr_config").select("*").eq("id", 1).single();
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
      .from("pr_config")
      .update(pick(body, CAMPOS))
      .eq("id", 1)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return fail(err, "Error al guardar la configuración");
  }
}

export const PUT = PATCH;
