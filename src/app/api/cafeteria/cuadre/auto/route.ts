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

    const fecha = searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);

    // Usar select("*") para evitar que TypeScript infiera "never" en columnas parciales
    const { data: raw, error: ventasError } = await supabase
      .from("ul_ventas")
      .select("*")
      .gte("created_at", `${fecha}T00:00:00.000Z`)
      .lte("created_at", `${fecha}T23:59:59.999Z`);

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
