import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { actualizar, fail } from "@/lib/tienda/crud";
import { COMPRAS } from "@/lib/tienda/tablas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const sb = createAdminClient();
    const [compra, items, pagos] = await Promise.all([
      sb.from("ti_v_compras").select("*").eq("id", id).single(),
      sb.from("ti_compra_items").select("*, ti_productos(codigo,nombre,unidad)").eq("compra_id", id).order("created_at"),
      sb.from("ti_pagos_proveedor").select("*").eq("compra_id", id).order("fecha", { ascending: false }),
    ]);
    if (compra.error) throw compra.error;
    return NextResponse.json({
      data: { compra: compra.data, items: items.data ?? [], pagos: pagos.data ?? [] },
    });
  } catch (err) {
    return fail(err, "Compra no encontrada", 404);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return actualizar(req, (await ctx.params).id, COMPRAS);
}
