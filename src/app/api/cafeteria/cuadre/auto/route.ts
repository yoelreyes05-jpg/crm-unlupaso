import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/cafeteria/cuadre/auto
// Query params: fecha (YYYY-MM-DD, default: today)
// Calcula automáticamente los totales del día desde ul_ventas
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = req.nextUrl;

    const fecha = searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);

    // Obtener de la vista ul_cuadre_auto
    const { data: autoData, error: autoError } = await supabase
      .from("ul_cuadre_auto")
      .select("*")
      .eq("fecha", fecha)
      .maybeSingle();

    if (autoError) throw autoError;

    // Ver si ya existe un cuadre cerrado para ese día
    const { data: cuadreExistente } = await supabase
      .from("ul_cuadre")
      .select("*")
      .eq("fecha", fecha)
      .maybeSingle();

    const resultado = {
      fecha,
      ventas_efectivo:      autoData?.ventas_efectivo      ?? 0,
      ventas_tarjeta:       autoData?.ventas_tarjeta       ?? 0,
      ventas_transferencia: autoData?.ventas_transferencia ?? 0,
      ventas_total:         autoData?.ventas_total         ?? 0,
      transacciones_count:  autoData?.transacciones_count  ?? 0,
      cuadre_existente:     cuadreExistente ?? null,
      ya_cerrado:           cuadreExistente?.cerrado       ?? false,
    };

    return NextResponse.json({ data: resultado });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al calcular cuadre automático";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
