import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/cafeteria/cuadre
// Query params: fecha, page, limit
export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = req.nextUrl;

    const fecha = searchParams.get("fecha");
    const page  = parseInt(searchParams.get("page")  ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "30");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("ul_cuadre")
      .select("*", { count: "exact" })
      .order("fecha", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fecha) query = query.eq("fecha", fecha);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({ data, count, page, limit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener cuadres";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/cafeteria/cuadre
// Body: { fecha, usuario, ventas_efectivo, ventas_tarjeta, ventas_transferencia,
//         ventas_total, transacciones_count, efectivo_inicial, efectivo_contado,
//         diferencia, notas, cerrado }
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const {
      fecha,
      usuario               = null,
      ventas_efectivo       = 0,
      ventas_tarjeta        = 0,
      ventas_transferencia  = 0,
      ventas_total          = 0,
      transacciones_count   = 0,
      efectivo_inicial      = 0,
      efectivo_contado      = 0,
      diferencia            = 0,
      notas                 = null,
      cerrado               = true,
    } = body;

    if (!fecha) {
      return NextResponse.json({ error: "Se requiere fecha (YYYY-MM-DD)" }, { status: 400 });
    }

    // Upsert: si ya existe el cuadre de ese día, lo actualiza
    const { data, error } = await supabase
      .from("ul_cuadre")
      .upsert(
        {
          fecha,
          usuario,
          ventas_efectivo:      Number(ventas_efectivo),
          ventas_tarjeta:       Number(ventas_tarjeta),
          ventas_transferencia: Number(ventas_transferencia),
          ventas_total:         Number(ventas_total),
          transacciones_count:  Number(transacciones_count),
          efectivo_inicial:     Number(efectivo_inicial),
          efectivo_contado:     Number(efectivo_contado),
          diferencia:           Number(diferencia),
          notas,
          cerrado,
        },
        { onConflict: "fecha" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al guardar cuadre";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
