import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { actualizar, eliminar, fail } from "@/lib/anyeli/crud";
import { PRESTAMOS } from "@/lib/anyeli/tablas";
import { actualizarMoras } from "@/lib/anyeli/motor";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET → devuelve el préstamo con su cronograma, pagos y reenganches en una
 *       sola llamada. Antes recalcula la mora de las cuotas vencidas.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const sb = createAdminClient();

    await actualizarMoras(id).catch(() => {});

    const [prestamo, cuotas, pagos, reenganches] = await Promise.all([
      sb.from("ia_v_prestamos").select("*").eq("id", id).single(),
      sb.from("ia_v_cuotas").select("*").eq("prestamo_id", id).order("ciclo").order("numero"),
      sb.from("ia_pagos").select("*").eq("prestamo_id", id).order("fecha", { ascending: false }),
      sb.from("ia_reenganches").select("*").eq("prestamo_id", id).order("fecha", { ascending: false }),
    ]);

    if (prestamo.error) throw prestamo.error;

    return NextResponse.json({
      data: {
        prestamo: prestamo.data,
        cuotas: cuotas.data ?? [],
        pagos: pagos.data ?? [],
        reenganches: reenganches.data ?? [],
      },
    });
  } catch (err) {
    return fail(err, "Préstamo no encontrado", 404);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return actualizar(req, (await ctx.params).id, PRESTAMOS);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const sb = createAdminClient();
  const { data } = await sb.from("ia_pagos").select("id").eq("prestamo_id", id).limit(1);
  if (data && data.length > 0) {
    // Con pagos registrados no se borra: se cancela para no perder la contabilidad
    const { error } = await sb.from("ia_prestamos").update({ estado: "cancelado" }).eq("id", id);
    if (error) return fail(error, "No se pudo cancelar el préstamo");
    return NextResponse.json({ message: "Préstamo cancelado (tenía pagos registrados)" });
  }
  return eliminar(id, PRESTAMOS);
}
