import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail } from "@/lib/tienda/crud";
import { anularVenta } from "@/lib/tienda/motor";

type Ctx = { params: Promise<{ id: string }> };

/** Factura completa: cabecera, líneas y cobros recibidos. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const sb = createAdminClient();
    const [venta, items, cobros] = await Promise.all([
      sb.from("ti_v_ventas").select("*").eq("id", id).single(),
      sb.from("ti_venta_items").select("*, ti_productos(codigo,nombre,unidad)").eq("venta_id", id).order("created_at"),
      sb.from("ti_cobros").select("*").eq("venta_id", id).order("fecha", { ascending: false }),
    ]);
    if (venta.error) throw venta.error;
    return NextResponse.json({
      data: { venta: venta.data, items: items.data ?? [], cobros: cobros.data ?? [] },
    });
  } catch (err) {
    return fail(err, "Factura no encontrada", 404);
  }
}

/** DELETE anula la factura: devuelve mercancía y revierte los cobros. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ data: await anularVenta(id) });
  } catch (err) {
    return fail(err, "No se pudo anular la factura");
  }
}
