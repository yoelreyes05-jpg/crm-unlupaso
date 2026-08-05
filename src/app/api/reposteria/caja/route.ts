import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET  /api/reposteria/caja            → sesiones (?estado=abierta para la actual)
 * POST /api/reposteria/caja            → abrir sesión  { nombre, monto_apertura, abierto_por }
 * PATCH /api/reposteria/caja           → cerrar sesión { id, efectivo_declarado, cerrado_por, notas }
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const estado = req.nextUrl.searchParams.get("estado");

    let q = supabase
      .from("rep_caja_sesiones")
      .select("*")
      .order("fecha_apertura", { ascending: false })
      .limit(estado === "abierta" ? 1 : 100);

    if (estado) q = q.eq("estado", estado);

    const { data, error } = await q;
    if (error) throw error;

    // Movimientos de la sesión abierta
    if (estado === "abierta" && data && data.length > 0) {
      const { data: movs } = await supabase
        .from("rep_caja_movimientos")
        .select("*")
        .eq("sesion_id", data[0].id)
        .order("created_at", { ascending: false });
      return NextResponse.json({ data: data[0], movimientos: movs ?? [] });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al consultar caja";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const { data: abierta } = await supabase
      .from("rep_caja_sesiones")
      .select("id")
      .eq("estado", "abierta")
      .maybeSingle();

    if (abierta) {
      return NextResponse.json({ error: "Ya hay una sesión de caja abierta" }, { status: 409 });
    }

    const monto = Number(body.monto_apertura ?? 0);

    const { data, error } = await supabase
      .from("rep_caja_sesiones")
      .insert({
        nombre:            body.nombre ?? "Caja Repostería",
        monto_apertura:    monto,
        efectivo_esperado: monto,
        abierto_por:       body.abierto_por ?? null,
        notas:             body.notas ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al abrir caja";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Falta el id de la sesión" }, { status: 400 });

    const { data, error } = await supabase
      .from("rep_caja_sesiones")
      .update({
        estado:             "cerrada",
        fecha_cierre:       new Date().toISOString(),
        efectivo_declarado: Number(body.efectivo_declarado ?? 0),
        cerrado_por:        body.cerrado_por ?? null,
        notas:              body.notas ?? null,
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data, message: "Caja cerrada" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al cerrar caja";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
