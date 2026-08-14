import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail } from "@/lib/tienda/crud";
import { abrirCaja, cerrarCaja } from "@/lib/tienda/motor";

/** GET → sesión abierta + historial.  POST → abrir o cerrar caja. */
export async function GET() {
  try {
    const sb = createAdminClient();
    const [abierta, historial] = await Promise.all([
      sb.from("ti_v_caja_actual").select("*").eq("estado", "abierta")
        .order("fecha_apertura", { ascending: false }).limit(1).maybeSingle(),
      sb.from("ti_v_caja_actual").select("*")
        .order("fecha_apertura", { ascending: false }).limit(40),
    ]);

    let movimientos: unknown[] = [];
    if (abierta.data?.id) {
      const { data } = await sb.from("ti_caja_movimientos").select("*")
        .eq("sesion_id", abierta.data.id).order("created_at", { ascending: false });
      movimientos = data ?? [];
    }

    return NextResponse.json({
      data: { abierta: abierta.data ?? null, historial: historial.data ?? [], movimientos },
    });
  } catch (err) {
    return fail(err, "Error al cargar la caja");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.accion === "abrir") {
      return NextResponse.json(
        { data: await abrirCaja(Number(body.monto_inicial ?? 0), body.usuario) },
        { status: 201 }
      );
    }
    if (body.accion === "cerrar") {
      if (!body.sesion_id) {
        return NextResponse.json({ error: "Falta la sesión a cerrar" }, { status: 400 });
      }
      return NextResponse.json({
        data: await cerrarCaja(body.sesion_id, Number(body.monto_contado ?? 0), body.notas, body.usuario),
      });
    }
    return NextResponse.json({ error: "Acción no reconocida (usa abrir o cerrar)" }, { status: 400 });
  } catch (err) {
    return fail(err, "Error en la caja");
  }
}
