import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail } from "@/lib/prestamos/crud";

/** Indicadores del tablero del módulo de préstamos. */
export async function GET() {
  try {
    const sb = createAdminClient();
    const hoy = new Date();
    const en7 = new Date(hoy.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    const [kpis, meses, atrasadas, proximas] = await Promise.all([
      sb.from("pr_v_dashboard").select("*").single(),
      sb.from("pr_v_ganancias_mensuales").select("*").limit(12),
      sb.from("pr_v_cobranza").select("*").eq("estado_visual", "atrasada").limit(15),
      sb.from("pr_v_cobranza").select("*")
        .gte("fecha_vencimiento", hoy.toISOString().slice(0, 10))
        .lte("fecha_vencimiento", en7)
        .limit(15),
    ]);

    if (kpis.error) throw kpis.error;

    return NextResponse.json({
      data: {
        kpis: kpis.data,
        meses: meses.data ?? [],
        atrasadas: atrasadas.data ?? [],
        proximas: proximas.data ?? [],
      },
    });
  } catch (err) {
    return fail(err, "Error al cargar el tablero");
  }
}
