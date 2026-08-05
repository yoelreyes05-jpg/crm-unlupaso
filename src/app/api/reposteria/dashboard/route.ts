import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/** GET /api/reposteria/dashboard — métricas del ERP repostería. */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const hoy      = new Date();
    const hoyISO   = hoy.toISOString().slice(0, 10);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
    const en7dias  = new Date(hoy.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const en3dias  = new Date(hoy.getTime() + 3 * 86400000).toISOString().slice(0, 10);

    const [
      ventasHoy, ventasMes, eventosProx, eventosMes,
      facturas, cxp, ingredientes, lotes, equipos, cotizaciones, caja,
    ] = await Promise.all([
      supabase.from("rep_ventas").select("total").eq("anulada", false).gte("created_at", `${hoyISO}T00:00:00`),
      supabase.from("rep_ventas").select("total").eq("anulada", false).gte("created_at", `${inicioMes}T00:00:00`),
      supabase.from("rep_eventos").select("id", { count: "exact", head: true })
        .gte("fecha_evento", hoyISO).lte("fecha_evento", en7dias)
        .not("estado", "in", '("cancelado","cerrado")'),
      supabase.from("rep_eventos").select("id", { count: "exact", head: true }).gte("fecha_evento", inicioMes),
      supabase.from("rep_facturas").select("balance").in("estado", ["pendiente", "parcial", "vencida"]),
      supabase.from("rep_cuentas_pagar").select("balance").in("estado", ["pendiente", "parcial", "vencida"]),
      supabase.from("rep_ingredientes_status").select("nivel_alerta"),
      supabase.from("rep_lotes").select("id", { count: "exact", head: true })
        .eq("estado", "disponible").lte("fecha_vencimiento", en3dias),
      supabase.from("rep_equipos").select("id", { count: "exact", head: true })
        .eq("estado", "disponible").eq("activo", true),
      supabase.from("rep_cotizaciones").select("id", { count: "exact", head: true })
        .in("estado", ["borrador", "enviada"]),
      supabase.from("rep_caja_sesiones").select("id").eq("estado", "abierta").maybeSingle(),
    ]);

    const suma = (rows: { total?: number; balance?: number }[] | null, campo: "total" | "balance") =>
      (rows ?? []).reduce((a, r) => a + Number(r[campo] ?? 0), 0);

    const criticos = (ingredientes.data ?? []).filter(
      (i: { nivel_alerta: string }) => i.nivel_alerta === "critico" || i.nivel_alerta === "agotado"
    ).length;

    return NextResponse.json({
      data: {
        ventas_hoy:            suma(ventasHoy.data, "total"),
        ventas_mes:            suma(ventasMes.data, "total"),
        transacciones_hoy:     (ventasHoy.data ?? []).length,
        eventos_proximos:      eventosProx.count ?? 0,
        eventos_mes:           eventosMes.count ?? 0,
        por_cobrar:            suma(facturas.data, "balance"),
        por_pagar:             suma(cxp.data, "balance"),
        ingredientes_criticos: criticos,
        lotes_por_vencer:      lotes.count ?? 0,
        equipos_disponibles:   equipos.count ?? 0,
        cotizaciones_abiertas: cotizaciones.count ?? 0,
        caja_abierta:          Boolean(caja.data),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al calcular el dashboard";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
