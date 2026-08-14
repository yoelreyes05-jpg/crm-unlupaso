import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail } from "@/lib/tienda/crud";

/** Indicadores del tablero de la tienda. */
export async function GET() {
  try {
    const sb = createAdminClient();
    const [kpis, meses, bajos, top, ultimas, caja] = await Promise.all([
      sb.from("ti_v_dashboard").select("*").single(),
      sb.from("ti_v_resultados_mensuales").select("*").limit(12),
      sb.from("ti_v_productos").select("*").eq("activo", true)
        .in("estado_stock", ["bajo", "agotado"]).order("stock_actual").limit(12),
      sb.from("ti_v_top_productos").select("*").limit(8),
      sb.from("ti_v_ventas").select("*").order("fecha", { ascending: false }).limit(8),
      sb.from("ti_v_caja_actual").select("*").eq("estado", "abierta").maybeSingle(),
    ]);
    if (kpis.error) throw kpis.error;
    return NextResponse.json({
      data: {
        kpis: kpis.data,
        meses: meses.data ?? [],
        bajos: bajos.data ?? [],
        top: top.data ?? [],
        ultimas: ultimas.data ?? [],
        caja: caja.data ?? null,
      },
    });
  } catch (err) {
    return fail(err, "Error al cargar el tablero");
  }
}
