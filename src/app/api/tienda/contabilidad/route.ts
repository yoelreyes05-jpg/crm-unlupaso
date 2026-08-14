import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail } from "@/lib/tienda/crud";

/**
 * Contabilidad de la tienda: cuentas por cobrar, cuentas por pagar,
 * gastos y estado de resultados del período (?desde=&hasta=).
 */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const anio = new Date().getFullYear();
    const desde = sp.get("desde") ?? `${anio}-01-01`;
    const hasta = sp.get("hasta") ?? new Date().toISOString().slice(0, 10);

    const sb = createAdminClient();
    const [kpis, meses, cxc, cxp, gastos, ventas] = await Promise.all([
      sb.from("ti_v_dashboard").select("*").single(),
      sb.from("ti_v_resultados_mensuales").select("*").limit(24),
      sb.from("ti_v_cuentas_cobrar").select("*"),
      sb.from("ti_v_cuentas_pagar").select("*"),
      sb.from("ti_gastos").select("*").gte("fecha", desde).lte("fecha", hasta)
        .order("fecha", { ascending: false }),
      sb.from("ti_v_ventas").select("*").neq("estado", "anulada")
        .gte("fecha", desde).lte("fecha", hasta),
    ]);
    if (kpis.error) throw kpis.error;

    type V = { total: number; itbis: number; costo_total: number };
    const periodo = ((ventas.data ?? []) as V[]).reduce(
      (a, v) => ({
        facturado: a.facturado + Number(v.total),
        itbis: a.itbis + Number(v.itbis),
        costo: a.costo + Number(v.costo_total),
      }),
      { facturado: 0, itbis: 0, costo: 0 }
    );
    const totalGastos = ((gastos.data ?? []) as { monto: number }[])
      .reduce((a, g) => a + Number(g.monto), 0);

    const ingresos = periodo.facturado - periodo.itbis;
    return NextResponse.json({
      data: {
        kpis: kpis.data,
        meses: meses.data ?? [],
        cxc: cxc.data ?? [],
        cxp: cxp.data ?? [],
        gastos: gastos.data ?? [],
        periodo: {
          desde, hasta,
          facturado: periodo.facturado,
          itbis: periodo.itbis,
          ingresos,
          costo: periodo.costo,
          ganancia_bruta: ingresos - periodo.costo,
          gastos: totalGastos,
          ganancia_neta: ingresos - periodo.costo - totalGastos,
          facturas: (ventas.data ?? []).length,
        },
      },
    });
  } catch (err) {
    return fail(err, "Error al cargar la contabilidad");
  }
}
