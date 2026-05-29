import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/cafeteria/ordenes
// Query params: fecha, fecha_desde, fecha_hasta, metodo_pago, anulada, page, limit
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = req.nextUrl;

    const fecha       = searchParams.get("fecha");
    const fechaDesde  = searchParams.get("fecha_desde");
    const fechaHasta  = searchParams.get("fecha_hasta");
    const metodoPago  = searchParams.get("metodo_pago");
    const anulada     = searchParams.get("anulada");
    const page        = parseInt(searchParams.get("page")  ?? "1");
    const limit       = parseInt(searchParams.get("limit") ?? "50");
    const offset      = (page - 1) * limit;

    let query = supabase
      .from("ul_ventas")
      .select("*, ul_detalle_ventas(*)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtro por fecha exacta
    if (fecha) {
      const start = `${fecha}T00:00:00.000Z`;
      const end   = `${fecha}T23:59:59.999Z`;
      query = query.gte("created_at", start).lte("created_at", end);
    } else {
      if (fechaDesde) query = query.gte("created_at", `${fechaDesde}T00:00:00.000Z`);
      if (fechaHasta) query = query.lte("created_at", `${fechaHasta}T23:59:59.999Z`);
    }

    if (metodoPago) query = query.eq("metodo_pago", metodoPago);
    if (anulada !== null && anulada !== "") query = query.eq("anulada", anulada === "true");

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ data, count, page, limit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener órdenes";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/cafeteria/ordenes  — anular venta
// Body: { id, motivo_anulacion }
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { id, motivo_anulacion } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Se requiere id de la venta" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ul_ventas")
      .update({ anulada: true, motivo_anulacion: motivo_anulacion ?? "Sin especificar" })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data, message: "Venta anulada" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al anular venta";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
