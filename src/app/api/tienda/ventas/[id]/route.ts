import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail } from "@/lib/tienda/crud";
import { anularVenta, editarVenta, eliminarVenta } from "@/lib/tienda/motor";

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

/**
 * PUT modifica una factura ya guardada: cambia sus líneas y sus datos.
 * El inventario se ajusta solo y los cobros ya recibidos se respetan.
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    return NextResponse.json({ data: await editarVenta(id, body) });
  } catch (err) {
    return fail(err, "No se pudo guardar la factura");
  }
}

/** PATCH hace lo mismo que PUT, por comodidad del cliente. */
export const PATCH = PUT;

/**
 * DELETE anula la factura: devuelve la mercancía y revierte los cobros,
 * pero conserva el registro en el historial.
 * Con ?definitivo=1 la borra por completo de la base de datos.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const definitivo = req.nextUrl.searchParams.get("definitivo");
    const usuario = req.nextUrl.searchParams.get("usuario") ?? undefined;

    if (definitivo === "1" || definitivo === "true") {
      return NextResponse.json({ data: await eliminarVenta(id, usuario) });
    }
    return NextResponse.json({ data: await anularVenta(id) });
  } catch (err) {
    return fail(err, "No se pudo eliminar la factura");
  }
}
