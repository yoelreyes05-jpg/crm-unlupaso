import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail } from "@/lib/anyeli/crud";

/**
 * Contabilidad del módulo: ganancias por mes, por inversionista y el
 * resumen del período consultado (?desde=&hasta=).
 */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const anio = new Date().getFullYear();
    const desde = sp.get("desde") ?? `${anio}-01-01`;
    const hasta = sp.get("hasta") ?? new Date().toISOString().slice(0, 10);

    const sb = createAdminClient();

    const [kpis, meses, porInv, dist, cartera, inversionistas] = await Promise.all([
      sb.from("ia_v_dashboard").select("*").single(),
      sb.from("ia_v_ganancias_mensuales").select("*").limit(24),
      sb.from("ia_v_ganancias_inversionista").select("*").limit(300),
      sb.from("ia_distribuciones").select("*").gte("fecha", desde).lte("fecha", hasta),
      sb.from("ia_v_prestamos").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("ia_inversionistas").select("id,nombre,codigo"),
    ]);

    if (kpis.error) throw kpis.error;

    type Fila = {
      inversionista_id: string | null;
      capital_devuelto: number;
      interes_total: number;
      interes_inversionista: number;
      interes_administrador: number;
      mora_administrador: number;
    };
    const filas = (dist.data ?? []) as Fila[];
    const nombres = new Map(
      ((inversionistas.data ?? []) as { id: string; nombre: string }[]).map((i) => [i.id, i.nombre])
    );

    const resumen = filas.reduce(
      (a, x) => ({
        capital: a.capital + Number(x.capital_devuelto),
        interes: a.interes + Number(x.interes_total),
        inversionistas: a.inversionistas + Number(x.interes_inversionista),
        administrador:
          a.administrador + Number(x.interes_administrador) + Number(x.mora_administrador),
      }),
      { capital: 0, interes: 0, inversionistas: 0, administrador: 0 }
    );

    const porSocio = new Map<
      string,
      { id: string; nombre: string; capital: number; ganancia: number; administrador: number }
    >();
    for (const x of filas) {
      const key = x.inversionista_id ?? "propio";
      const actual =
        porSocio.get(key) ?? {
          id: key,
          nombre: x.inversionista_id
            ? nombres.get(x.inversionista_id) ?? "Inversionista"
            : "Capital propio (administrador)",
          capital: 0,
          ganancia: 0,
          administrador: 0,
        };
      actual.capital += Number(x.capital_devuelto);
      actual.ganancia += Number(x.interes_inversionista);
      actual.administrador += Number(x.interes_administrador) + Number(x.mora_administrador);
      porSocio.set(key, actual);
    }

    return NextResponse.json({
      data: {
        kpis: kpis.data,
        meses: meses.data ?? [],
        porInversionista: porInv.data ?? [],
        cartera: cartera.data ?? [],
        periodo: { desde, hasta, resumen, porSocio: Array.from(porSocio.values()) },
      },
    });
  } catch (err) {
    return fail(err, "Error al cargar la contabilidad");
  }
}
