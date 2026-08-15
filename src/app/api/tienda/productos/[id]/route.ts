import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fail, obtener, actualizar, eliminar } from "@/lib/tienda/crud";
import { PRODUCTOS } from "@/lib/tienda/tablas";

type Ctx = { params: Promise<{ id: string }> };

export const GET   = async (_req: NextRequest, ctx: Ctx) => obtener((await ctx.params).id, PRODUCTOS);
export const PATCH = async (req: NextRequest, ctx: Ctx)  => actualizar(req, (await ctx.params).id, PRODUCTOS);
export const PUT   = PATCH;

/**
 * DELETE desactiva el producto: deja de aparecer en el catálogo pero se
 * conserva para que las facturas viejas sigan cuadrando.
 *
 * Con ?definitivo=1 se borra de verdad. Solo se permite si el producto nunca
 * se vendió ni se compró: un artículo con historial no se puede quitar sin
 * romper facturas ya emitidas, así que en ese caso se explica y no se toca.
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const definitivo = req.nextUrl.searchParams.get("definitivo");

    if (definitivo !== "1" && definitivo !== "true") {
      return eliminar(id, PRODUCTOS, "activo");
    }

    const sb = createAdminClient();

    const { data: producto } = await sb
      .from("ti_productos").select("id,nombre").eq("id", id).single();
    if (!producto) {
      return NextResponse.json({ error: "El producto ya no existe" }, { status: 404 });
    }

    const [ventas, compras] = await Promise.all([
      sb.from("ti_venta_items").select("id", { count: "exact", head: true }).eq("producto_id", id),
      sb.from("ti_compra_items").select("id", { count: "exact", head: true }).eq("producto_id", id),
    ]);
    const enVentas = ventas.count ?? 0;
    const enCompras = compras.count ?? 0;

    // Se borra aunque tenga historial. Las líneas de las facturas viejas
    // conservan descripción, código, cantidad, precio, costo e importe, así
    // que los totales y la contabilidad no cambian: lo único que se pierde
    // es el enlace al artículo del catálogo. El kardex sí se va con él.
    const { error } = await sb.from("ti_productos").delete().eq("id", id);
    if (error) throw error;

    const partes: string[] = [];
    if (enVentas > 0) partes.push(`${enVentas} línea(s) de factura`);
    if (enCompras > 0) partes.push(`${enCompras} línea(s) de compra`);

    return NextResponse.json({
      message: partes.length
        ? `«${producto.nombre}» se sacó del inventario. ` +
          `Sus ${partes.join(" y ")} quedan en el historial con su descripción y sus montos, ` +
          "así que las facturas y la contabilidad no cambian."
        : `«${producto.nombre}» se eliminó por completo.`,
    });
  } catch (err) {
    return fail(err, "No se pudo eliminar el producto");
  }
}
