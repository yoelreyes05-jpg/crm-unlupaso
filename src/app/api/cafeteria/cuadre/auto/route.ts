import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

type VentaResumen = {
  total:       number | null;
  metodo_pago: string;
  anulada:     boolean;
};

// GET /api/cafeteria/cuadre/auto
// Query params: fecha (YYYY-MM-DD, default: today)
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = req.nextUrl;

    // Fecha local RD (UTC-4): si no se pasa fecha, usar hoy en zona RD
    const offsetHours = 4; // República Dominicana = UTC-4
    const ahora = new Date();
    const fechaDefault = new Date(ahora.getTime() - offsetHours * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    const fecha = searchParams.get("fecha") ?? fechaDefault;

    // Rango en UTC que cubre el día completo en zona UTC-4
    // Día local empieza a las 04:00 UTC y termina a las 03:59:59 UTC del día siguiente
    const inicioUTC = `${fecha}T04:00:00.000Z`;
    const finFecha  = new Date(new Date(`${fecha}T04:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 19) + ".999Z";

    const { data: raw, error: ventasError } = await supabase
      .from("ul_ventas")
      .select("*")
      .gte("created_at", inicioUTC)
      .lte("created_at", finFecha);

    if (ventasError) throw ventasError;

    const ventas = (raw ?? []) as VentaResumen[];
    const validas = ventas.filter((v) => !v.anulada);

    const sumar = (metodo: string) =>
      validas
        .filter((v) => v.metodo_pago === metodo)
        .reduce((s, v) => s + (v.total ?? 0), 0);

    const autoData = {
      fecha,
      ventas_efectivo:      sumar("EFECTIVO"),
      ventas_tarjeta:       sumar("TARJETA"),
      ventas_transferencia: sumar("TRANSFERENCIA"),
      ventas_total:         validas.reduce((s, v) => s + (v.total ?? 0), 0),
      transacciones_count:  validas.length,
    };

    // Ver si ya existe un cuadre cerrado para ese día
    const { data: cuadreExistente } = await supabase
      .from("ul_cuadre")
      .select("*")
      .eq("fecha", fecha)
      .maybeSingle();

    return NextResponse.json({
      data: {
        ...autoData,
        cuadre_existente: cuadreExistente ?? null,
        ya_cerrado:       (cuadreExistente as { cerrado?: boolean } | null)?.cerrado ?? false,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al calcular cuadre automático";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
